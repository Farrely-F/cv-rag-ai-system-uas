import "dotenv/config";
import { db } from "@/lib/db/client";
import { documentChunks, documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function inspectChunks() {
  const doc = await db.query.documents.findFirst({
    where: eq(documents.fileName, "Buku-I-UU-APBN-TA-2025-SPLIT.pdf"),
    orderBy: (docs, { desc }) => [desc(docs.id)],
  });

  if (!doc) {
    console.log("Document not found");
    return;
  }

  console.log(`Inspecting Document: ${doc.fileName} (${doc.id})`);

  const chunks = await db
    .select()
    .from(documentChunks)
    .where(eq(documentChunks.documentId, doc.id));

  chunks.forEach((chunk, i) => {
    console.log(
      `\n--- Chunk ${i + 1} (Hash: ${chunk.sha256Hash?.slice(0, 10)}...) ---`
    );
    console.log(chunk.content);
    console.log("-------------------------------------------");
  });
}

inspectChunks().catch(console.error);
