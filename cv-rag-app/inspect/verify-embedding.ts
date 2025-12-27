import "dotenv/config";
import { db } from "@/lib/db/client";
import { documentChunks } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateEmbedding } from "@/lib/rag/embeddings";

async function verifyEmbedding() {
  const query = "Pembiayaan Pendidikan";

  // 1. Find the chunk that has the text
  const chunks = await db
    .select()
    .from(documentChunks)
    .where(sql`content ILIKE '%Pembiayaan Pendidikan%'`);

  if (chunks.length === 0) {
    console.log("Chunk not found via LIKE search");
    return;
  }

  const chunk = chunks[0];
  console.log(`Found chunk with LIKE search. ID: ${chunk.id}`);
  console.log(`Content snippet: ${chunk.content.slice(0, 50)}...`);

  // 2. Generate fresh embedding for the same content
  const freshEmbedding = await generateEmbedding(chunk.content);

  // 3. Compare with stored embedding
  // documentChunks.embedding is a string in pgvector or a number[] in Drizzle if typed?
  // Let's check similarity manually in SQL
  const freshEmbeddingString = `[${freshEmbedding.join(",")}]`;

  const similarityResult = await db
    .select({
      similarity: sql<number>`1 - (${documentChunks.embedding} <=> ${freshEmbeddingString}::vector)`,
    })
    .from(documentChunks)
    .where(eq(documentChunks.id, chunk.id));

  console.log(
    `Similarity between stored embedding and fresh embedding: ${(
      similarityResult[0].similarity * 100
    ).toFixed(6)}%`
  );

  // 4. Check similarity between query and stored embedding
  const queryEmbedding = await generateEmbedding(query);
  const queryEmbeddingString = `[${queryEmbedding.join(",")}]`;

  const querySimilarityResult = await db
    .select({
      similarity: sql<number>`1 - (${documentChunks.embedding} <=> ${queryEmbeddingString}::vector)`,
    })
    .from(documentChunks)
    .where(eq(documentChunks.id, chunk.id));

  console.log(
    `Similarity between query "${query}" and stored embedding: ${(
      querySimilarityResult[0].similarity * 100
    ).toFixed(6)}%`
  );

  // 5. Check dimension
  // The embedding column is a vector. Let's get its length.
  const dimResult = await db.execute(
    sql`SELECT vector_dims(embedding) FROM document_chunks LIMIT 1`
  );
  console.log(`Embedding dimensions: ${JSON.stringify(dimResult)}`);
}

verifyEmbedding().catch(console.error);
