/**
 * Document Ingestion API Route with Streaming Progress
 * Processes PDF uploads with real-time status updates via Server-Sent Events
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { documents, documentChunks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  extractTextFromPdf,
  extractTextWithAI,
  splitTextIntoChunks,
  type ChunkingStrategy,
} from "@/lib/rag/processing";
import { generateChunkHashes } from "@/lib/crypto/hash";
import { buildMerkleTree, rootToBytes32 } from "@/lib/crypto/merkle";
import { generateEmbeddings } from "@/lib/rag/embeddings";
import { anchorMerkleRoot } from "@/lib/blockchain/registry";

// Progress event types
interface ProgressEvent {
  step: string;
  progress: number;
  message: string;
  detail?: string;
}

// Helper to create SSE message
function createSSEMessage(event: ProgressEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (event: ProgressEvent) => {
        controller.enqueue(encoder.encode(createSSEMessage(event)));
      };

      try {
        const formData = await req.formData();

        // Extract file and metadata
        const file = formData.get("file") as File | null;
        const documentType = formData.get("documentType") as string;
        const fiscalYear = parseInt(formData.get("fiscalYear") as string);
        const source = formData.get("source") as string;
        const uploadedBy = (formData.get("uploadedBy") as string) || "admin";
        const chunkingStrategy =
          (formData.get("chunkingStrategy") as ChunkingStrategy) || "semantic";
        const parentDocumentId = formData.get("parentDocumentId") as
          | string
          | null;

        let version = 1;
        if (parentDocumentId) {
          const [parentDoc] = await db
            .select()
            .from(documents)
            .where(eq(documents.id, parentDocumentId))
            .limit(1);

          if (parentDoc) {
            version = (parentDoc.version || 1) + 1;
            // Optionally override metadata if not provided, but usually they stay same
            // for the same document lineage.
          }
        }

        // Validate
        if (!file || !documentType || !fiscalYear || !source) {
          sendProgress({
            step: "error",
            progress: 0,
            message: "Validation failed",
            detail: "Missing required fields",
          });
          controller.close();
          return;
        }

        const startTime = Date.now();

        const buffer = Buffer.from(await file.arrayBuffer());

        // Use AI-powered structured extraction for better table handling
        // We now make this the default if the document is likely to have complex tables
        const useAIExtraction = formData.get("highQuality") === "true";

        let text = "";
        if (useAIExtraction) {
          sendProgress({
            step: "extracting",
            progress: 10,
            message:
              "Extracting structured text using AI (this takes longer)...",
            detail: file.name,
          });
          text = await extractTextWithAI(buffer);
        } else {
          sendProgress({
            step: "extracting",
            progress: 10,
            message: "Extracting text from PDF (basic)...",
            detail: file.name,
          });
          text = await extractTextFromPdf(buffer);
        }

        // Step 2: Chunk text
        sendProgress({
          step: "chunking",
          progress: 20,
          message: `Splitting using ${chunkingStrategy} strategy...`,
          detail: `Extracted ${text.length} characters`,
        });

        const chunkTexts = await splitTextIntoChunks(text, {
          strategy: chunkingStrategy,
        });

        // Step 3: Hash chunks
        sendProgress({
          step: "hashing",
          progress: 30,
          message: "Generating SHA-256 hashes...",
          detail: `${chunkTexts.length} chunks to process`,
        });

        const hashes = generateChunkHashes(chunkTexts);

        // Step 4: Build Merkle tree
        sendProgress({
          step: "merkle",
          progress: 40,
          message: "Building Merkle tree...",
          detail: `${hashes.length} leaf nodes`,
        });

        const { root, proofs } = buildMerkleTree(hashes);

        // Step 5: Generate embeddings (this is the slowest part)
        sendProgress({
          step: "embedding",
          progress: 50,
          message: "Generating embeddings (this may take a while)...",
          detail: `${chunkTexts.length} chunks × 768 dimensions`,
        });

        const embeddings = await generateEmbeddings(chunkTexts);

        // Step 6: Anchor on blockchain
        sendProgress({
          step: "blockchain",
          progress: 70,
          message: "Anchoring Merkle root on Base Sepolia...",
          detail: `Root: ${root.slice(0, 20)}...`,
        });

        const merkleRootBytes = rootToBytes32(root);
        const documentId = crypto.randomUUID();
        const blockchainTxId = await anchorMerkleRoot(
          merkleRootBytes,
          documentId
        );

        // Step 7: Save to database
        sendProgress({
          step: "database",
          progress: 85,
          message: "Saving to database...",
          detail: `Document ID: ${documentId.slice(0, 8)}...`,
        });

        const [savedDocument] = await db
          .insert(documents)
          .values({
            id: documentId,
            fileName: file.name,
            documentType,
            fiscalYear,
            source,
            uploadedBy,
            merkleRoot: root,
            blockchainTxId,
            chunkCount: chunkTexts.length,
            version,
            previousId: parentDocumentId,
            status: "active",
          })
          .returning();

        // Save chunks
        sendProgress({
          step: "chunks",
          progress: 95,
          message: "Saving chunks to database...",
          detail: `${chunkTexts.length} chunks with embeddings`,
        });

        const chunkInserts = chunkTexts.map((text, index) => ({
          documentId: savedDocument.id,
          chunkIndex: index,
          content: text,
          embedding: embeddings[index],
          sha256Hash: hashes[index],
          merkleProof: proofs.get(hashes[index]) || [],
          metadata: { position: index, tokens: Math.ceil(text.length / 4) },
        }));

        await db.insert(documentChunks).values(chunkInserts);

        const processingTimeMs = Date.now() - startTime;

        // Step 8: Complete
        sendProgress({
          step: "complete",
          progress: 100,
          message: "Processing complete!",
          detail: JSON.stringify({
            success: true,
            documentId: savedDocument.id,
            chunksProcessed: chunkTexts.length,
            merkleRoot: root,
            blockchainTxId,
            processingTimeMs,
          }),
        });

        controller.close();
      } catch (error) {
        console.error("Ingest API error:", error);
        const sendProgress = (event: ProgressEvent) => {
          controller.enqueue(encoder.encode(createSSEMessage(event)));
        };
        sendProgress({
          step: "error",
          progress: 0,
          message: "Processing failed",
          detail: error instanceof Error ? error.message : "Unknown error",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
