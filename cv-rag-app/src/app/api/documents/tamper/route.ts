/**
 * Document Tampering API
 * Simulates tampering for CV-RAG demonstration
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { documentChunks, documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Tampering marker
const TAMPER_MARKER = "\n\n[⚠️ TAMPERED - Modified for demonstration]";

// POST - Tamper or restore a chunk
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chunkId, action } = body as {
      chunkId: string;
      action: "tamper" | "restore";
    };

    if (!chunkId) {
      return Response.json({ error: "Chunk ID is required" }, { status: 400 });
    }

    // Get the chunk
    const [chunk] = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.id, chunkId))
      .limit(1);

    if (!chunk) {
      return Response.json({ error: "Chunk not found" }, { status: 404 });
    }

    const metadata = chunk.metadata as Record<string, unknown>;

    if (action === "tamper") {
      // Check if already tampered
      if (metadata.originalContent) {
        return Response.json(
          { error: "Chunk already tampered", isTampered: true },
          { status: 400 }
        );
      }

      // Store original content and tamper
      const tamperedContent = chunk.content + TAMPER_MARKER;

      await db
        .update(documentChunks)
        .set({
          content: tamperedContent,
          metadata: {
            ...metadata,
            originalContent: chunk.content,
            tamperedAt: new Date().toISOString(),
          },
        })
        .where(eq(documentChunks.id, chunkId));

      return Response.json({
        success: true,
        action: "tampered",
        chunkId,
        message: "Chunk content modified. Verification will now fail.",
      });
    } else if (action === "restore") {
      // Check if tampered
      if (!metadata.originalContent) {
        return Response.json(
          { error: "Chunk is not tampered", isTampered: false },
          { status: 400 }
        );
      }

      // Restore original content
      const originalContent = metadata.originalContent as string;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { originalContent: _, tamperedAt: __, ...restMetadata } = metadata;

      await db
        .update(documentChunks)
        .set({
          content: originalContent,
          metadata: restMetadata,
        })
        .where(eq(documentChunks.id, chunkId));

      return Response.json({
        success: true,
        action: "restored",
        chunkId,
        message: "Chunk content restored. Verification will pass again.",
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Tampering API error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to process",
      },
      { status: 500 }
    );
  }
}

// GET - Get chunks for a document with tampered status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return Response.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Get document info
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    // Get all chunks for document
    const chunks = await db
      .select({
        id: documentChunks.id,
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        sha256Hash: documentChunks.sha256Hash,
        metadata: documentChunks.metadata,
      })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))
      .orderBy(documentChunks.chunkIndex);

    // Map chunks with tampered status
    const chunksWithStatus = chunks.map((chunk) => {
      const metadata = chunk.metadata as Record<string, unknown>;
      return {
        id: chunk.id,
        chunkIndex: chunk.chunkIndex,
        contentPreview: chunk.content.slice(0, 200),
        isTampered: !!metadata.originalContent,
        tamperedAt: metadata.tamperedAt || null,
      };
    });

    return Response.json({
      document: {
        id: doc.id,
        fileName: doc.fileName,
        chunkCount: doc.chunkCount,
      },
      chunks: chunksWithStatus,
      tamperedCount: chunksWithStatus.filter((c) => c.isTampered).length,
    });
  } catch (error) {
    console.error("Get chunks error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to get chunks",
      },
      { status: 500 }
    );
  }
}
