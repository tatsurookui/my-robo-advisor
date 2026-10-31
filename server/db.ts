import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not configured. Attach a Replit PostgreSQL database before starting the server.",
  );
}

export const pool = new Pool({ connectionString });

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});
