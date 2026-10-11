import { createClient, type Client } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const rawUrl = process.env.DATABASE_URL;

if (!rawUrl) {
  throw new Error(
    "DATABASE_URL no está definida. Configúrala en el entorno (Pages → Settings → Variables).",
  );
}

// En Cloudflare Workers/Pages usamos el transporte HTTP de libSQL (https://).
const url = rawUrl.replace(/^libsql:\/\//, "https://");

type Db = ReturnType<typeof drizzle<typeof schema>>;

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
