import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL no está definida. Copia .env.example a .env.local y configura Turso.",
  );
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Una sola conexión por proceso (globalThis sobrevive a la recarga de módulos
// de Next en desarrollo).
const globalForDb = globalThis as unknown as {
  __vendoLibsql?: Client;
  __vendoDb?: Db;
};

const libsql: Client =
  globalForDb.__vendoLibsql ??
  createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

export const db: Db = globalForDb.__vendoDb ?? drizzle(libsql, { schema });

globalForDb.__vendoLibsql = libsql;
globalForDb.__vendoDb = db;

export { libsql };
