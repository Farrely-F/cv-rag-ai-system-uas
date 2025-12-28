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
import { z } from "zod";
import { generateEmbedding } from "@/lib/rag/embeddings";
import {
  retrieveRelevantChunks,
  buildContextFromChunks,
} from "@/lib/rag/retrieval";

// System prompt - instructs LLM to use tools when needed
const SYSTEM_PROMPT = `You are a helpful assistant for Indonesian government budget transparency (APBN/APBD).

When users ask questions about budget data, spending, allocations, or fiscal information, use the searchBudgetDocuments tool to find relevant information from the official database.

For general greetings, clarifications, or non-budget questions, respond directly without searching.

Rules when answering budget questions:
- Be concise and factual
- Cite sources when referencing information
- Use Indonesian Rupiah (IDR) for currency
- Format large numbers with thousand separators (e.g., 1,500,000,000,000)
- If sources conflict, mention both perspectives
- Never make up budget figures
- If the search returns no results, say you couldn't find the information`;

// Allowed models for validation
const ALLOWED_MODELS = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
] as const;

/**
 * Trim conversation history to reduce token usage
 * Keeps only recent messages and strips heavy tool results
 */
function trimConversationHistory(messages: UIMessage[]): UIMessage[] {
  // Keep only last 10 messages (5 exchanges)
  const recentMessages = messages.slice(-10);

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

    // Trim conversation history to reduce token usage
    const trimmedMessages = trimConversationHistory(messages);

    console.log(
      `📊 Token optimization: ${messages.length} messages → ${trimmedMessages.length} messages`
    );

    // Convert UI messages to model messages
    const modelMessages = await convertToModelMessages(trimmedMessages);

    // Generate streaming response with RAG tool
    const result = streamText({
      model: google(selectedModel),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      // Allow multi-step so LLM can use tool results
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
            const k = topK ?? 10; // Balance between quality and token usage
            try {
              // Generate embedding for the query
              const queryEmbedding = await generateEmbedding(query);

              // Retrieve relevant chunks from database
              // Use slightly lower threshold to catch table rows
              const chunks = await retrieveRelevantChunks(
                queryEmbedding,
                k,
                0.3
              );

              if (chunks.length === 0) {
                return {
                  found: false,
                  message: "No relevant budget documents found for this query.",
                  sources: [],
                };
              }

              // Return sources with verification data
              return {
                found: true,
                context: buildContextFromChunks(chunks),
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
      maxOutputTokens: 1000,
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
