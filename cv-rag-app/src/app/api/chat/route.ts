/**
 * Chat API Route
 * Processes user queries using RAG pipeline with streaming responses
 * Updated to use AI SDK patterns from documentation
 */

import { streamText, UIMessage, convertToModelMessages } from "ai";
import { google } from "@ai-sdk/google";
import { generateEmbedding } from "@/lib/rag/embeddings";
import {
  retrieveRelevantChunks,
  buildContextFromChunks,
} from "@/lib/rag/retrieval";

// System prompt for budget transparency chatbot
const SYSTEM_PROMPT = `You are a helpful assistant for Indonesian government budget transparency.

Answer questions based ONLY on the provided source documents. If the information is not in the sources, say so clearly.

Rules:
- Be concise and factual
- Cite source numbers when referencing information (e.g., "According to [Source 1]...")
- Use Indonesian Rupiah (IDR) for currency
- Format large numbers with thousand separators (e.g., 1,500,000,000,000)
- If sources conflict, mention both perspectives
- Never make up budget figures
- If you cannot find relevant information, say "I couldn't find information about that in the available budget documents."`;

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    // Get the last user message from parts
    const lastMessage = messages[messages.length - 1];
    let userMessage = "";

    if (lastMessage?.parts) {
      userMessage = lastMessage.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { type: "text"; text: string }).text)
        .join("");
    }

    if (!userMessage) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(userMessage);

    // Retrieve relevant chunks
    const chunks = await retrieveRelevantChunks(queryEmbedding, 3);

    // Build context from chunks
    const context =
      chunks.length > 0
        ? buildContextFromChunks(chunks)
        : "No relevant budget documents found in the database.";

    // Prepare augmented messages with RAG context
    const augmentedMessages = await convertToModelMessages([
      ...messages.slice(0, -1), // Previous messages
      {
        id: lastMessage.id,
        role: "user" as const,
        parts: [
          {
            type: "text" as const,
            text: `Context from official budget documents:

${context}

User question: ${userMessage}

Answer:`,
          },
        ],
      },
    ]);

    // Generate streaming response using AI SDK
    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: SYSTEM_PROMPT,
      messages: augmentedMessages,
      temperature: 0.3,
      maxOutputTokens: 1000,
    });

    // Return streaming response compatible with useChat
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
