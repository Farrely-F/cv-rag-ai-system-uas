/**
 * Vector Similarity Search
 * Retrieves relevant document chunks from PostgreSQL + pgvector
 */

import { db } from "@/lib/db/client";
import { documentChunks, documents } from "@/lib/db/schema";
import { sql, eq, cosineDistance, gt, desc } from "drizzle-orm";

export interface RetrievedChunk {
  chunkId: string;
  content: string;
  chunkHash: string;
  merkleProof: string[];
  merkleRoot: string;
  blockchainTxId: string;
  similarity: number;
  documentMetadata: {
    fileName: string;
    fiscalYear: number;
    source: string;
  };
}

/**
 * Retrieve relevant chunks using vector similarity search
 */
export async function retrieveRelevantChunks(
  queryEmbedding: number[],
  topK: number = 10,
  similarityThreshold: number = 0.3
): Promise<RetrievedChunk[]> {
  const embeddingString = `[${queryEmbedding.join(",")}]`;

  const similarity = sql<number>`1 - (${cosineDistance(
    documentChunks.embedding,
    embeddingString
  )})`;

  const results = await db
    .select({
      chunkId: documentChunks.id,
      content: documentChunks.content,
      chunkHash: documentChunks.sha256Hash,
      merkleProof: documentChunks.merkleProof,
      similarity,
      documentId: documentChunks.documentId,
      fileName: documents.fileName,
      fiscalYear: documents.fiscalYear,
      source: documents.source,
      merkleRoot: documents.merkleRoot,
      blockchainTxId: documents.blockchainTxId,
    })
    .from(documentChunks)
    .where(gt(similarity, similarityThreshold))
    .orderBy((t) => desc(t.similarity))
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .limit(topK);

  return results.map((r) => ({
    chunkId: r.chunkId,
    content: r.content,
    chunkHash: r.chunkHash,
    merkleProof: r.merkleProof as string[],
    merkleRoot: r.merkleRoot,
    blockchainTxId: r.blockchainTxId,
    similarity: r.similarity,
    documentMetadata: {
      fileName: r.fileName,
      fiscalYear: r.fiscalYear,
      source: r.source,
    },
  }));
}

/**
 * Build context string from retrieved chunks
 */
export function buildContextFromChunks(chunks: RetrievedChunk[]): string {
  return chunks.map((c, i) => `[Source ${i + 1}]\n${c.content}`).join("\n\n");
}
