import "dotenv/config";
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import { generateEmbedding } from "@/lib/rag/embeddings";

async function check() {
  console.log("Dropping index (if exists)...");
  await db.execute(sql`DROP INDEX IF EXISTS chunks_embedding_idx`);

  console.log("Running audit...");
  const query = "Pembiayaan Pendidikan";
  const embedding = await generateEmbedding(query);
  const embStr = `[${embedding.join(",")}]`;

  const results = await db.execute(sql`
    SELECT id, content, (1 - (embedding <=> ${embStr}::vector)) as sim 
    FROM document_chunks
    ORDER BY embedding <=> ${embStr}::vector
  `);

  console.log(`Found ${results.length} chunks following the search:`);
  results.forEach((r, i) => {
    console.log(
      `${i + 1}. Sim: ${r.sim} | ID: ${r.id} | Snippet: ${(r.content as string)
        .slice(0, 50)
        .replace(/\n/g, " ")}`
    );
  });
}
check().catch(console.error);
