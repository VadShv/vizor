import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../shared/schema";

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/vizor";
const client = postgres(connectionString, { max: 10 });
export const db = drizzle(client, { schema });
