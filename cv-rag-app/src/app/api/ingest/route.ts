/**
 * Document Ingestion API Route
 * Processes PDF uploads, generates embeddings, and anchors to blockchain
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { documents, documentChunks } from "@/lib/db/schema";
import { processDocument } from "@/lib/rag/processing";
import { anchorMerkleRoot } from "@/lib/blockchain/registry";
import { rootToBytes32 } from "@/lib/crypto/merkle";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Extract file and metadata
    const file = formData.get("file") as File | null;
    const documentType = formData.get("documentType") as string;
    const fiscalYear = parseInt(formData.get("fiscalYear") as string);
    const source = formData.get("source") as string;
    const uploadedBy = (formData.get("uploadedBy") as string) || "admin";

    // Validate required fields
    if (!file) {
      return Response.json({ error: "File is required" }, { status: 400 });
    }

    if (!documentType || !fiscalYear || !source) {
      return Response.json(
        { error: "documentType, fiscalYear, and source are required" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith(".pdf")) {
      return Response.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Process document: extract text, chunk, hash, embed
    const { chunks, merkleRoot, proofs } = await processDocument(buffer);

    // Anchor Merkle root on blockchain
    const merkleRootBytes = rootToBytes32(merkleRoot);

    // Generate document ID
    const documentId = crypto.randomUUID();

    // Anchor to blockchain
    const blockchainTxId = await anchorMerkleRoot(merkleRootBytes, documentId);

    // Save document to database
    const [savedDocument] = await db
      .insert(documents)
      .values({
        id: documentId,
        fileName: file.name,
        documentType,
        fiscalYear,
        source,
        uploadedBy,
        merkleRoot,
        blockchainTxId,
        chunkCount: chunks.length,
        status: "active",
      })
      .returning();

    // Save chunks to database
    const chunkInserts = chunks.map((chunk) => ({
      documentId: savedDocument.id,
      chunkIndex: chunk.index,
      content: chunk.text,
      embedding: chunk.embedding,
      sha256Hash: chunk.hash,
      merkleProof: proofs.get(chunk.hash) || [],
      metadata: chunk.metadata,
    }));

    await db.insert(documentChunks).values(chunkInserts);

    const processingTimeMs = Date.now() - startTime;

    return Response.json({
      success: true,
      documentId: savedDocument.id,
      chunksProcessed: chunks.length,
      merkleRoot,
      blockchainTxId,
      processingTimeMs,
    });
  } catch (error) {
    console.error("Ingest API error:", error);
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to process document",
      },
      { status: 500 }
    );
  }
}
