import "dotenv/config";
import { db } from "../src/lib/db/client";
import { documentChunks } from "../src/lib/db/schema";

async function search() {
  const query = "Pembiayaan Pendidikan";

  console.log(`Searching for "${query}" in chunks...`);

  const results = await db
    .select()
    .from(documentChunks)
    .where(sql`content ILIKE ${"%" + query + "%"}`);

  console.log(`Found ${results.length} occurrences.`);

  results.forEach((r, i) => {
    console.log(`\nOccurrence ${i + 1} (Doc ID: ${r.documentId}):`);
    console.log("--- CONTENT START ---");
    console.log(r.content);
    console.log("--- CONTENT END ---");
  });
}

import { sql } from "drizzle-orm";
search().catch(console.error);
