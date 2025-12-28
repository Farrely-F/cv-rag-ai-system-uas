/**
 * Database Stats API Route
 * Get database size and statistics
 */

import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Query PostgreSQL for database size
    const result = await db.execute(sql`
      SELECT 
        pg_database_size(current_database()) as db_size_bytes,
        pg_size_pretty(pg_database_size(current_database())) as db_size_human
    `);

    const row = result[0] as {
      db_size_bytes: string;
      db_size_human: string;
    };

    // Calculate percentage (assuming a reasonable max size, e.g., 10GB for development)
    // In production, you might want to query the actual disk space or set a quota
    const maxSizeBytes = 10 * 1024 * 1024 * 1024; // 10GB
    const usedBytes = parseInt(row.db_size_bytes);
    const usedPercentage = Math.round((usedBytes / maxSizeBytes) * 100);
    const freePercentage = 100 - usedPercentage;

    return Response.json({
      sizeBytes: usedBytes,
      sizeHuman: row.db_size_human,
      usedPercentage,
      freePercentage,
      maxSizeHuman: "10 GB", // Could be configurable
    });
  } catch (error) {
    console.error("Database stats error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch database stats",
      },
      { status: 500 }
    );
  }
}
