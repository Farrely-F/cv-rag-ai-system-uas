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

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    // Convert UI messages to model messages
    const modelMessages = await convertToModelMessages(messages);

    // Generate streaming response with RAG tool
    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      // Allow multi-step so LLM can use tool results
      stopWhen: stepCountIs(5),
      tools: {
        searchBudgetDocuments: tool({
          description:
            "Search the official Indonesian budget documents database. Use this tool when users ask about budget allocations, spending, fiscal data, APBN, or APBD.",
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
                "Number of results to return (default: 5, use higher for broad queries)"
              ),
          }),
          execute: async ({
            query,
            topK,
          }: {
            query: string;
            topK?: number;
          }) => {
            const k = topK ?? 15;
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
