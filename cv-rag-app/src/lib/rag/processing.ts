/**
 * Document Processing Pipeline
 * Handles PDF parsing, chunking, and embedding generation
 * Supports multiple chunking strategies
 */

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { generateChunkHashes } from "@/lib/crypto/hash";
import { buildMerkleTree } from "@/lib/crypto/merkle";
import { generateEmbeddings } from "./embeddings";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import PdfParse from "pdf-parse";

// Chunking strategy types
export type ChunkingStrategy =
  | "semantic" // Uses LangChain's recursive splitter (default)
  | "fixed" // Fixed character length
  | "sentence" // Split by sentences
  | "paragraph" // Split by paragraphs
  | "page" // Split by rough page markers
  | "agentic"; // LLM-powered intelligent chunking

export interface ChunkingOptions {
  strategy: ChunkingStrategy;
  chunkSize?: number; // For semantic/fixed
  overlap?: number; // For semantic/fixed
}

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
    strategy: ChunkingStrategy;
  };
}

/**
 * Extract text from PDF buffer
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await PdfParse(buffer);
  return data.text;
}

/**
 * Split text using semantic chunking (RecursiveCharacterTextSplitter)
 */
async function splitSemantic(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap: overlap,
    separators: ["\n\n", "\n", ". ", ", ", " "],
  });

  const docs = await splitter.createDocuments([text]);
  return docs.map((doc) => doc.pageContent);
}

/**
 * Split text by fixed character length
 */
function splitFixed(text: string, chunkSize: number = 1000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
  }
  return chunks;
}

/**
 * Split text by sentences
 */
function splitSentence(text: string): string[] {
  // Split by sentence-ending punctuation
  const sentences = text.split(/(?<=[.!?])\s+/);

  // Group sentences into reasonable chunks (3-5 sentences per chunk)
  const chunks: string[] = [];
  let current: string[] = [];

  for (const sentence of sentences) {
    current.push(sentence.trim());
    if (current.length >= 4 || current.join(" ").length > 800) {
      chunks.push(current.join(" "));
      current = [];
    }
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks.filter((c) => c.length > 20);
}

/**
 * Split text by paragraphs
 */
function splitParagraph(text: string): string[] {
  // Split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\s*\n/);

  return paragraphs.map((p) => p.trim()).filter((p) => p.length > 50); // Filter out very short paragraphs
}

/**
 * Split text by approximate page markers (form feeds or consistent patterns)
 */
function splitPage(text: string): string[] {
  // Try form feed first, then fall back to large gaps
  let pages = text.split(/\f/);

  if (pages.length <= 1) {
    // Fall back to splitting by every ~3000 chars at paragraph boundaries
    pages = [];
    let current = "";
    const paragraphs = text.split(/\n\s*\n/);

    for (const para of paragraphs) {
      if (current.length + para.length > 3000 && current.length > 0) {
        pages.push(current.trim());
        current = para;
      } else {
        current += "\n\n" + para;
      }
    }
    if (current.trim().length > 0) {
      pages.push(current.trim());
    }
  }

  return pages.filter((p) => p.length > 100);
}

/**
 * Split text using agentic (LLM-powered) chunking
 * The LLM analyzes the text and identifies logical topic boundaries
 */
async function splitAgentic(text: string): Promise<string[]> {
  const { Output } = await import("ai");
  const { z } = await import("zod");

  // First, split into manageable sections for LLM processing
  const maxInputLength = 15000;
  const sections = [];

  for (let i = 0; i < text.length; i += maxInputLength) {
    sections.push(text.slice(i, i + maxInputLength));
  }

  const allChunks: string[] = [];

  for (const section of sections) {
    try {
      const { output } = await generateText({
        model: google("gemini-2.5-flash"),
        output: Output.object({
          schema: z.object({
            chunks: z.array(
              z.object({
                content: z.string().describe("The text content of this chunk"),
                topic: z
                  .string()
                  .describe("The main topic covered in this chunk"),
              })
            ),
          }),
        }),
        prompt: `You are a document chunking assistant. Analyze the following text and split it into logical, self-contained chunks based on topic boundaries.

Each chunk should:
- Be 200-800 words
- Cover a complete topic or subtopic
- Be understandable on its own
- Have a clear topic/theme

Text to chunk:
${section}`,
        temperature: 0.1,
        maxOutputTokens: 8000,
      });

      // Extract chunk content from structured output
      const chunks = output.chunks
        .map((chunk) => chunk.content.trim())
        .filter((c) => c.length > 50);

      allChunks.push(...chunks);
    } catch (error) {
      console.error(
        "Agentic chunking failed, falling back to semantic:",
        error
      );
      // Fallback to semantic chunking for this section
      const fallbackChunks = await splitSemantic(section, 1000, 200);
      allChunks.push(...fallbackChunks);
    }
  }

  return allChunks;
}

/**
 * Extract text from PDF using Gemini AI (structured extraction)
 * Best for documents with tables and complex layouts
 */
export async function extractTextWithAI(buffer: Buffer): Promise<string> {
  // Convert buffer to Base64 for the AI SDK
  const base64 = buffer.toString("base64");

  const { text: structuredText } = await generateText({
    model: google("gemini-3-flash-preview"),
    system:
      "You are a specialized document extraction assistant. Your goal is to convert PDF documents into structured text.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all text from this PDF document. For any tables found, preserve their structure perfectly by formatting them as Markdown tables. Ensure all labels and numeric values are correctly aligned and associated. Do not omit any data. If there are multiple pages, process them all in order.",
          },
          {
            type: "file",
            data: base64,
            mediaType: "application/pdf",
          },
        ],
      },
    ],
  });

  return structuredText;
}

/**
 * Split text into chunks based on strategy
 */
export async function splitTextIntoChunks(
  text: string,
  options: ChunkingOptions = { strategy: "semantic" }
): Promise<string[]> {
  const { strategy, chunkSize = 1000, overlap = 200 } = options;

  switch (strategy) {
    case "semantic":
      return splitSemantic(text, chunkSize, overlap);
    case "fixed":
      return splitFixed(text, chunkSize);
    case "sentence":
      return splitSentence(text);
    case "paragraph":
      return splitParagraph(text);
    case "page":
      return splitPage(text);
    case "agentic":
      return splitAgentic(text);
    default:
      return splitSemantic(text, chunkSize, overlap);
  }
}

/**
 * Process a document completely: extract, chunk, hash, embed
 */
export async function processDocument(
  pdfBuffer: Buffer,
  options: ChunkingOptions = { strategy: "semantic" }
): Promise<ProcessedDocument> {
  // 1. Extract text from PDF
  const text = await extractTextFromPdf(pdfBuffer);

  // 2. Split into chunks using selected strategy
  const chunkTexts = await splitTextIntoChunks(text, options);

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
      tokens: Math.ceil(text.length / 4),
      strategy: options.strategy,
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

/**
 * Get chunking strategy descriptions for UI
 */
export const CHUNKING_STRATEGIES = [
  {
    id: "semantic" as const,
    name: "Semantic (Recommended)",
    description: "Smart splitting at natural boundaries - best for Q&A",
  },
  {
    id: "fixed" as const,
    name: "Fixed Length",
    description: "Split by character count - predictable chunk sizes",
  },
  {
    id: "sentence" as const,
    name: "Sentence-based",
    description: "Groups of 3-4 sentences - granular retrieval",
  },
  {
    id: "paragraph" as const,
    name: "Paragraph-based",
    description: "One paragraph per chunk - preserves context",
  },
  {
    id: "page" as const,
    name: "Page-based",
    description: "Roughly one page per chunk - broad coverage",
  },
  {
    id: "agentic" as const,
    name: "Agentic (AI-powered)",
    description: "LLM identifies topic boundaries - most intelligent",
  },
];
