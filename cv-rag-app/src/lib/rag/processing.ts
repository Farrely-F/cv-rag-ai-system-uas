/**
 * Document Processing Pipeline
 * Handles PDF parsing, chunking, and embedding generation
 */

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { generateChunkHashes } from "@/lib/crypto/hash";
import { buildMerkleTree } from "@/lib/crypto/merkle";
import { generateEmbeddings } from "./embeddings";

export interface ProcessedDocument {
  chunks: ProcessedChunk[];
  merkleRoot: string;
  proofs: Map<string, string[]>;
}

export interface ProcessedChunk {
  text: string;
  hash: string;
  embedding: number[];
  index: number;
  metadata: {
    position: number;
    tokens: number;
  };
}

/**
 * Extract text from PDF buffer
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (
    buffer: Buffer
  ) => Promise<{ text: string }>;
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Split text into semantic chunks
 */
export async function splitTextIntoChunks(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap: overlap,
    separators: ["\n\n", "\n", ". ", " "],
  });

  const docs = await splitter.createDocuments([text]);
  return docs.map((doc) => doc.pageContent);
}

/**
 * Process a document completely: extract, chunk, hash, embed
 */
export async function processDocument(
  pdfBuffer: Buffer
): Promise<ProcessedDocument> {
  // 1. Extract text from PDF
  const text = await extractTextFromPdf(pdfBuffer);

  // 2. Split into chunks
  const chunkTexts = await splitTextIntoChunks(text);

  // 3. Generate hashes for each chunk
  const hashes = generateChunkHashes(chunkTexts);

  // 4. Build Merkle tree
  const { root, proofs } = buildMerkleTree(hashes);

  // 5. Generate embeddings (batched)
  const embeddings = await generateEmbeddings(chunkTexts);

  // 6. Assemble processed chunks
  const chunks: ProcessedChunk[] = chunkTexts.map((text, index) => ({
    text,
    hash: hashes[index],
    embedding: embeddings[index],
    index,
    metadata: {
      position: index,
      tokens: Math.ceil(text.length / 4), // Approximate token count
    },
  }));

  return {
    chunks,
    merkleRoot: root,
    proofs,
  };
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
