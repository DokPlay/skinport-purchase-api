import postgres, { Sql } from 'postgres';
import { env } from './env.js';

export type DbClient = Sql<{}>;

let client: DbClient | null = null;

// Lazily initialise a singleton Postgres client for reuse across requests.
export const getDbClient = (): DbClient => {
  if (client) {
    return client;
  }

  client = postgres(env.databaseUrl, {
    max: 10
  });

  return client;
};
