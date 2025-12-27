import "dotenv/config";
import { documents, documentChunks } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";

async function listDocs() {
  const docs = await db.select().from(documents);
  console.log(`Found ${docs.length} documents:`);

  for (const doc of docs) {
    const chunkCount = await db
      .select({ value: count() })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, doc.id));

    console.log(`- ID: ${doc.id}`);
    console.log(`  File: ${doc.fileName}`);
    console.log(`  Chunks: ${chunkCount[0].value}`);
    console.log(`  Merkle Root: ${doc.merkleRoot}`);
    console.log(`  Created: ${doc.uploadedAt}`);
  }
}

listDocs().catch(console.error);
