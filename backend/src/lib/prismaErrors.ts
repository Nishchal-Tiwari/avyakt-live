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

/** Table missing (P2021) or raw PG error when a model's table was never migrated. */
export function isPrismaMissingRelationOrTable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2021" || err.code === "P2022") return true;
  }
  if (isPrismaMissingColumnError(err)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /\bClassAttendanceDaily\b/i.test(msg) ||
    /\brelation\b.*\bdoes not exist\b/i.test(msg) ||
    /\btable\b.*\bdoes not exist\b/i.test(msg)
  );
}
