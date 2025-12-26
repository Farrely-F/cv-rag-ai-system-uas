/**
 * Documents API Route
 * List and delete documents with their chunks
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { documents, documentChunks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET - List all documents
export async function GET() {
  try {
    const docs = await db
      .select({
        id: documents.id,
        fileName: documents.fileName,
        documentType: documents.documentType,
        fiscalYear: documents.fiscalYear,
        source: documents.source,
        uploadedBy: documents.uploadedBy,
        uploadedAt: documents.uploadedAt,
        merkleRoot: documents.merkleRoot,
        blockchainTxId: documents.blockchainTxId,
        chunkCount: documents.chunkCount,
        status: documents.status,
      })
      .from(documents)
      .orderBy(desc(documents.uploadedAt));

    return Response.json({ documents: docs });
  } catch (error) {
    console.error("List documents error:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list documents",
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete a document and its chunks
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("id");

    if (!documentId) {
      return Response.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // First delete all chunks for this document
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, documentId));

    // Then delete the document
    const deletedDocs = await db
      .delete(documents)
      .where(eq(documents.id, documentId))
      .returning();

    if (deletedDocs.length === 0) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      deleted: {
        documentId: deletedDocs[0].id,
        fileName: deletedDocs[0].fileName,
      },
    });
  } catch (error) {
    console.error("Delete document error:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete document",
      },
      { status: 500 }
    );
  }
}
