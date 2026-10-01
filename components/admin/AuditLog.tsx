import type { AuditEntry } from "@/lib/types";

const ACTION_LABEL: Record<string, string> = {
  preference_added: "إضافة رغبة",
  preference_removed: "حذف رغبة",
  preference_reordered: "إعادة ترتيب رغبة",
  preferences_cleared: "مسح جميع الرغبات",
  preferences_locked: "تثبيت الرغبات",
  preferences_unlocked: "إلغاء تثبيت الرغبات",
  admission_created: "إضافة اختصاص",
  admission_updated: "تعديل اختصاص",
  admission_deleted: "حذف اختصاص",
  settings_updated: "تعديل الإعدادات",
  admissions_seeded: "استيراد بيانات المفاضلة",
};

const FIELD_LABEL: Record<string, string> = {
  specialization: "الاختصاص",
  university: "الجامعة",
  city: "المدينة",
  category: "الجهة",
  general_available: "العام متاح",
  general_minimum: "الحد الأدنى للعام",
  general_conditions: "شروط العام",
  parallel_available: "الموازي متاح",
  parallel_minimum: "الحد الأدنى للموازي",
  parallel_conditions: "شروط الموازي",
  source_order: "الترتيب",
};

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (v === true) return "نعم";
  if (v === false) return "لا";
  return String(v);
}

function summarize(e: AuditEntry): string {
  const d = (e.details ?? {}) as Record<string, unknown>;
  switch (e.action) {
    case "preference_added":
      return `${d.label} ← الرغبة ${d.position}`;
    case "preference_removed":
      return `${d.label} (كانت الرغبة ${d.position})`;
    case "preference_reordered":
      return `من الرغبة ${d.from} إلى الرغبة ${d.to}`;
    case "preferences_cleared":
      return `حذف ${d.removed} رغبة`;
    case "admission_created":
    case "admission_deleted":
      return `${d.specialization}${d.city ? ` - ${d.city}` : ""}`;
    case "admission_updated": {
      const changes = (d.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
      const parts = Object.entries(changes).map(
        ([k, c]) => `${FIELD_LABEL[k] ?? k}: ${show(c.from)} ← ${show(c.to)}`,
      );
      return `${d.specialization}${d.city ? ` - ${d.city}` : ""}${parts.length ? ` — ${parts.join("، ")}` : " — بدون تغيير"}`;
    }
    case "settings_updated": {
      const parts = Object.entries(d as Record<string, { from: unknown; to: unknown }>)
        .filter(([, c]) => c && c.from !== c.to)
        .map(([k, c]) => `${k === "student_score" ? "المعدل" : k === "academic_year" ? "العام" : "العنوان"}: ${show(c.from)} ← ${show(c.to)}`);
      return parts.join("، ") || "بدون تغيير";
    }
    case "admissions_seeded":
      return `${d.count} اختصاص`;
    default:
      return "";
  }
}

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">سجل التغييرات</h2>
      {entries.length === 0 ? (
        <p className="text-muted">لا توجد تغييرات بعد.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <time className="text-xs text-muted tabular" dir="ltr">
                {new Date(e.created_at).toLocaleString("en-GB", { timeZone: "Asia/Damascus" })}
              </time>
              <span className="font-semibold">{ACTION_LABEL[e.action] ?? e.action}</span>
              <span className="text-muted">— {e.actor}</span>
              <span className="basis-full text-foreground/90 sm:basis-auto">{summarize(e)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
