import { Prisma } from "@prisma/client";

/** Shown when the DB is missing columns that the Prisma schema expects (e.g. after a git pull). */
export const DB_SCHEMA_OUT_OF_SYNC_MESSAGE =
  "Database schema is out of date. In the backend directory run: npx prisma db push && npx prisma generate, then restart the server.";

export function isPrismaMissingColumnError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2022") return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /\bcolumn\b.*\bdoes not exist\b/i.test(msg) || /\bno such column\b/i.test(msg);
}
