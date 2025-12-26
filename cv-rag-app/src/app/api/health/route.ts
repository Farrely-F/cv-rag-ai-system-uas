/**
 * Health Check API Route
 */

import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import { getRootCount } from "@/lib/blockchain/registry";

export async function GET() {
  const status = {
    status: "healthy",
    database: "unknown",
    blockchain: "unknown",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  };

  // Check database connection
  try {
    await db.execute(sql`SELECT 1`);
    status.database = "connected";
  } catch {
    status.database = "disconnected";
    status.status = "degraded";
  }

  // Check blockchain connection
  try {
    await getRootCount();
    status.blockchain = "connected";
  } catch {
    status.blockchain = "disconnected";
    status.status = "degraded";
  }

  return Response.json(status);
}
