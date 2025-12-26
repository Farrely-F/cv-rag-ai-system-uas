/**
 * Embedding Generation Utility
 * Uses Google's text-embedding-004 model via AI SDK
 */

import { google } from "@ai-sdk/google";
import { embed, embedMany } from "ai";

const embeddingModel = google.embeddingModel("text-embedding-004");

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
  });
  return embeddings;
}
