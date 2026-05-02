import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getDatabaseUrl } from "./env.server";

declare global {
  var __postgresClient: ReturnType<typeof postgres> | undefined;
}

const connectionString = getDatabaseUrl();

const client =
  globalThis.__postgresClient ??
  postgres(connectionString, {
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__postgresClient = client;
}

export const db = drizzle(client, { schema });
export const dbClient = client;

export type Database = typeof db;
