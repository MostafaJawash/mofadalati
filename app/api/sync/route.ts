import { getRevision } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Cheap endpoint polled by every open page to detect shared-data changes. */
export async function GET() {
  const revision = await getRevision();
  return Response.json({ revision }, { headers: { "Cache-Control": "no-store" } });
}
