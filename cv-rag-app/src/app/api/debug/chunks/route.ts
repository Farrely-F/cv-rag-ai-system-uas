/**
 * Debug API Route - Check database chunks
 * Temporary endpoint for debugging RAG retrieval
 */

import { db } from "@/lib/db/client";
import { documentChunks, documents } from "@/lib/db/schema";
import { sql, eq, ilike } from "drizzle-orm";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const keyword = url.searchParams.get("keyword") || "pendidikan";
  const limit = parseInt(url.searchParams.get("limit") || "10");

  try {
    // Search for keyword in chunks
    const results = await db
      .select({
        chunkId: documentChunks.id,
        content: documentChunks.content,
        documentId: documentChunks.documentId,
        fileName: documents.fileName,
        fiscalYear: documents.fiscalYear,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(ilike(documentChunks.content, `%${keyword}%`))
      .limit(limit);

    // Get total chunk count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documentChunks);

    // Get chunks containing keyword count
    const [{ keywordCount }] = await db
      .select({ keywordCount: sql<number>`count(*)` })
      .from(documentChunks)
      .where(ilike(documentChunks.content, `%${keyword}%`));

    return Response.json({
      totalChunks: count,
      chunksWithKeyword: keywordCount,
      keyword,
      samples: results.map((r) => ({
        chunkId: r.chunkId.slice(0, 8),
        fileName: r.fileName,
        fiscalYear: r.fiscalYear,
        preview: r.content.slice(0, 300) + "...",
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
