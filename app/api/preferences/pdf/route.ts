import { renderPreferencesPdf } from "@/lib/pdf";
import { getPreferences, getSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Always renders the current shared list straight from the database. */
export async function GET() {
  const [settings, preferences] = await Promise.all([getSettings(), getPreferences()]);
  const pdf = await renderPreferencesPdf(settings, preferences);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="preferences-${settings.studentScore}.pdf"; filename*=UTF-8''${encodeURIComponent("الرغبات الجامعية")}.pdf`,
      "Cache-Control": "no-store",
    },
  });
}
