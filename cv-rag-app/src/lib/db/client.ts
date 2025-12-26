/**
 * Database Client
 * Connects to PostgreSQL via Drizzle ORM
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Create connection string from environment
const connectionString = process.env.DATABASE_URL!;

// Create postgres client
const client = postgres(connectionString, { prepare: false });

// Create drizzle database instance
export const db = drizzle(client, { schema });

// Export schema for convenience
export { schema };
