/**
 * Chat API Route - Agentic RAG Pattern
 *
 * Uses AI SDK tools to let the LLM decide when to search documents.
 * This saves tokens by not injecting context for simple greetings/conversations.
 */

import {
  streamText,
  UIMessage,
  convertToModelMessages,
  tool,
  stepCountIs,
} from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import { generateEmbedding } from "@/lib/rag/embeddings";
import {
  retrieveRelevantChunks,
  buildContextFromChunks,
} from "@/lib/rag/retrieval";

// System prompt - instructs LLM to use tools when needed
const SYSTEM_PROMPT = `You are a helpful assistant for Indonesian government budget transparency (APBN/APBD).

When users ask questions about budget data, use the searchBudgetDocuments tool to find relevant information.

For general greetings or non-budget questions, respond directly without searching.

IMPORTANT: Call the search tool ONLY ONCE per question. After receiving results, immediately provide your answer.

Answer format rules:
- Give SHORT, DIRECT answers
- Report EXACT values from documents with their original units
- Example: "Anggaran Kemendikbud: 93.600.821.056 Ribu Rupiah"
- NEVER add conversions like "≈ triliun" or "≈ miliar" 
- NEVER use tables unless asked
- Cite the source document name
- If no results found, say so`;

// Compact system prompt for models with low token limits (Groq free tier)
const COMPACT_SYSTEM_PROMPT = `You assist with Indonesian budget (APBN/APBD) queries. 
IMPORTANT: Call searchBudgetDocuments ONLY ONCE, then answer immediately with the results. 
Be concise, cite sources, preserve original values and units.`;

// Allowed models for validation
const ALLOWED_MODELS = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  // Groq models via OpenAI-compatible API
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
] as const;

/**
 * Check if model is a low-token-limit model (Groq free tier = 8K TPM)
 */
function isLowTokenModel(modelId: string): boolean {
  return modelId.startsWith("openai/");
}

/**
 * Get model-specific limits
 */
function getModelLimits(modelId: string) {
  if (isLowTokenModel(modelId)) {
    return {
      maxTopK: 10, // Fewer chunks to reduce tokens
      maxContextChars: 1500, // Truncate context
      maxOutputTokens: 500,
      maxMessages: 4, // Keep only 2 exchanges
    };
  }
  return {
    maxTopK: 10,
    maxContextChars: 10000,
    maxOutputTokens: 1000,
    maxMessages: 10, // Keep 5 exchanges
  };
}

/**
 * Truncate text to max characters
 */
function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "... [truncated]";
}

/**
 * Get the appropriate model instance based on model ID
 */
function getModelInstance(modelId: string) {
  if (modelId.startsWith("openai/")) {
    // Groq models use OpenAI-compatible format
    return groq(modelId);
  }
  // Default to Google Gemini
  return google(modelId);
}

/**
 * Trim conversation history to reduce token usage
 * Keeps only recent messages and strips heavy tool results
 */
function trimConversationHistory(
  messages: UIMessage[],
  maxMessages: number = 10
): UIMessage[] {
  // Keep only recent messages based on model limits
  const recentMessages = messages.slice(-maxMessages);

  // Strip heavy data from tool results to save tokens
  return recentMessages.map((msg) => {
    if (msg.role === "assistant" && msg.parts) {
      return {
        ...msg,
        parts: msg.parts.map((part) => {
          // If it's a tool result, strip the heavy verification data
          if (
            part.type === "tool-searchBudgetDocuments" &&
            "output" in part &&
            part.output
          ) {
            const output = part.output as SearchToolOutput;
            const trimmedOutput: TrimmedSearchToolOutput = {
              found: output.found,
              message: output.message,
              context: output.context,
              sources: output.sources.map((s) => ({
                chunkId: s.chunkId,
                similarity: s.similarity,
                document: s.document,
              })),
            };
            return {
              ...part,
              output: trimmedOutput,
            };
          }
          return part;
        }),
      } as UIMessage;
    }
    return msg;
  });
}

export async function POST(req: Request) {
  try {
    const { messages, model }: { messages: UIMessage[]; model?: string } =
      await req.json();

    console.log(model);

    // Validate and use selected model (default to gemini-2.0-flash-exp)
    const selectedModel =
      model && (ALLOWED_MODELS as readonly string[]).includes(model)
        ? model
        : "gemini-2.0-flash";

    // Get model-specific limits first (needed for trimming)
    const limits = getModelLimits(selectedModel);
    const systemPrompt = isLowTokenModel(selectedModel)
      ? COMPACT_SYSTEM_PROMPT
      : SYSTEM_PROMPT;

    // Trim conversation history to reduce token usage
    const trimmedMessages = trimConversationHistory(
      messages,
      limits.maxMessages
    );

    console.log(
      `📊 Token optimization: ${messages.length} messages → ${trimmedMessages.length} messages`
    );

    // Convert UI messages to model messages
    const modelMessages = await convertToModelMessages(trimmedMessages);

    console.log(
      `🔧 Model limits: topK=${limits.maxTopK}, context=${limits.maxContextChars}chars, output=${limits.maxOutputTokens}tokens`
    );

    // Generate streaming response with RAG tool
    const result = streamText({
      model: getModelInstance(selectedModel),
      system: systemPrompt,
      messages: modelMessages,
      // stopWhen: stepCountIs(2) allows 2 steps max:
      // Step 1: tool call + result, Step 2: generate text response
      stopWhen: stepCountIs(5),
      tools: {
        searchBudgetDocuments: tool({
          description:
            "Search the official Indonesian budget documents database. Use this tool when users ask about budget allocations, spending, fiscal data, APBN, or APBD. For specific budget queries (e.g., education, healthcare), request 15-20 results to ensure finding detailed data.",
          inputSchema: z.object({
            query: z
              .string()
              .describe(
                "The search query - use specific Indonesian terms like 'anggaran pendidikan' or 'belanja kesehatan'"
              ),
            topK: z
              .number()
              .optional()
              .describe(
                "Number of results to return (default: 10, use 15-20 for specific budget queries to find detailed allocations)"
              ),
          }),
          execute: async ({
            query,
            topK,
          }: {
            query: string;
            topK?: number;
          }) => {
            // Use model-specific limits for topK
            const k = Math.min(topK ?? limits.maxTopK, limits.maxTopK);
            try {
              // Generate embedding for the query
              const queryEmbedding = await generateEmbedding(query);

              // Retrieve relevant chunks from database
              // Use slightly lower threshold to catch table rows
              const chunks = await retrieveRelevantChunks(
                queryEmbedding,
                k,
                0.25
              );

              if (chunks.length === 0) {
                return {
                  found: false,
                  message: "No relevant budget documents found for this query.",
                  sources: [],
                };
              }

              // Return sources with verification data
              // Truncate context for low-token models
              const rawContext = buildContextFromChunks(chunks);
              const context = truncateText(rawContext, limits.maxContextChars);

              return {
                found: true,
                context,
                sources: chunks.map((c) => ({
                  chunkId: c.chunkId,
                  content: c.content, // Full content required for hash verification
                  similarity: c.similarity,
                  document: {
                    fileName: c.documentMetadata.fileName,
                    fiscalYear: c.documentMetadata.fiscalYear,
                    source: c.documentMetadata.source,
                  },
                  // Include verification data
                  chunkHash: c.chunkHash,
                  merkleProof: c.merkleProof,
                  merkleRoot: c.merkleRoot,
                  blockchainTxId: c.blockchainTxId,
                })),
              };
            } catch (error) {
              console.error("Search tool error:", error);
              return {
                found: false,
                message:
                  "Failed to search documents. Database may not be connected.",
                sources: [],
              };
            }
          },
        }),
      },
      temperature: 0.3,
      maxOutputTokens: limits.maxOutputTokens,
    });

    // Return streaming response
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);

    // Check for rate limit error
    const errorMessage = error instanceof Error ? error.message : "";
    const isRateLimit =
      errorMessage.includes("quota") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("429") ||
      errorMessage.includes("rate limit");

    if (isRateLimit) {
      // Extract retry delay if available
      const retryMatch = errorMessage.match(/retry in (\d+\.?\d*)/i);
      const retrySeconds = retryMatch
        ? Math.ceil(parseFloat(retryMatch[1]))
        : 30;

      return Response.json(
        {
          error: "rate_limit",
          message: `API rate limit reached. Please wait ${retrySeconds} seconds and try again.`,
          retryAfter: retrySeconds,
        },
        { status: 429 }
      );
    }

    return Response.json(
      {
        error: "server_error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to process chat request",
      },
      { status: 500 }
    );
  }
}
