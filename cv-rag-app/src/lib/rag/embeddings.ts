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
 * Google AI limits to 100 items per batch, so we chunk accordingly
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  // Process in batches of 100
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: batch,
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
