import "dotenv/config";
import { db } from "@/lib/db/client";
import { documentChunks } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { generateEmbedding } from "@/lib/rag/embeddings";

async function auditScores() {
  const query = "Pembiayaan Pendidikan";
  const embedding = await generateEmbedding(query);
  const embeddingString = `[${embedding.join(",")}]`;

  console.log(`Auditing query: "${query}"`);

  const results = await db
    .select({
      chunkId: documentChunks.id,
      content: documentChunks.content,
      similarity: sql<number>`1 - (${documentChunks.embedding} <=> ${embeddingString}::vector)`,
      documentId: documentChunks.documentId,
    })
    .from(documentChunks)
    .orderBy(sql`${documentChunks.embedding} <=> ${embeddingString}::vector`);

  console.log(`Found ${results.length} total chunks check:`);

  results.forEach((r, i) => {
    console.log(
      `${i + 1}. Score: ${(r.similarity * 100).toFixed(2)}% | ID: ${
        r.chunkId
      } | Snippet: ${r.content.slice(0, 50).replace(/\n/g, " ")}`
    );
  });
}

auditScores().catch(console.error);
