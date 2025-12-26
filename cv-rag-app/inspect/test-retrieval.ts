import "dotenv/config";
import { generateEmbedding } from "../src/lib/rag/embeddings";
import { retrieveRelevantChunks } from "../src/lib/rag/retrieval";

async function testRetrieval() {
  const query = "Pembiayaan Pendidikan";
  console.log(`Testing query: "${query}"`);

  const embedding = await generateEmbedding(query);
  const chunks = await retrieveRelevantChunks(embedding, 10, 0.1); // Lower threshold to see what matches

  console.log(`Found ${chunks.length} chunks above 0.1 similarity:`);

  chunks.forEach((c, i) => {
    console.log(
      `\nMatch ${i + 1} (Score: ${(c.similarity * 100).toFixed(2)}%)`
    );
    console.log(`Content: ${c.content.slice(0, 200)}...`);
  });
}

testRetrieval().catch(console.error);
