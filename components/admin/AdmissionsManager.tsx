"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { createAdmission, deleteAdmission, updateAdmission, type AdmissionInput } from "@/app/actions";
import { eligibleTracks, formatScore } from "@/lib/eligibility";
import { normalizeArabic } from "@/lib/text";
import { CATEGORY_LABEL, type Admission } from "@/lib/types";
import { toast } from "../Toaster";

const PAGE = 50;

type Props = { admissions: Admission[]; score: number; usedIds: Record<number, boolean> };

export function AdmissionsManager({ admissions, score, usedIds }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [eligibility, setEligibility] = useState<"" | "yes" | "no">("");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const deferred = useDeferredValue(query);

  const filtered = useMemo(() => {
    const terms = normalizeArabic(deferred).split(" ").filter(Boolean);
    return admissions.filter((a) => {
      const hay = normalizeArabic(`${a.specialization} ${a.city ?? ""} ${a.university ?? ""}`);
      const ok = eligibleTracks(a, score).length > 0;
      return (
        (!category || a.category === category) &&
        (!eligibility || (eligibility === "yes") === ok) &&
        terms.every((t) => hay.includes(t))
      );
    });
  }, [admissions, deferred, category, eligibility, score]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">بيانات المفاضلة</h2>
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-sm font-semibold tabular">
          {filtered.length} / {admissions.length}
        </span>
        <button
          onClick={() => setEditing("new")}
          className="ms-auto rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white dark:text-background"
        >
          + إضافة اختصاص
        </button>
      </div>

      {editing === "new" && (
        <AdmissionForm
          onDone={() => setEditing(null)}
          submit={(input) => createAdmission(input)}
          title="اختصاص جديد"
        />
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="بحث…"
          className="rounded-lg border border-border bg-surface px-3 py-2"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2">
          <option value="">كل الجهات</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={eligibility}
          onChange={(e) => setEligibility(e.target.value as "" | "yes" | "no")}
          className="rounded-lg border border-border bg-surface px-3 py-2"
        >
          <option value="">الكل</option>
          <option value="yes">متاح لمعدل {score}%</option>
          <option value="no">غير متاح لمعدل {score}%</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-2 text-right text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">الاختصاص</th>
              <th className="px-3 py-2 font-semibold">المدينة / الجامعة</th>
              <th className="px-3 py-2 font-semibold">عام</th>
              <th className="px-3 py-2 font-semibold">موازي</th>
              <th className="px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.slice(0, limit).map((a) =>
              editing === a.id ? (
                <tr key={a.id}>
                  <td colSpan={6} className="p-3">
                    <AdmissionForm
                      initial={a}
                      title={`تعديل: ${a.specialization}`}
                      onDone={() => setEditing(null)}
                      submit={(input) => updateAdmission(a.id, input)}
                    />
                  </td>
                </tr>
              ) : (
                <AdmissionRow key={a.id} admission={a} score={score} used={!!usedIds[a.id]} onEdit={() => setEditing(a.id)} />
              ),
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > limit && (
        <button
          onClick={() => setLimit((l) => l + PAGE)}
          className="mx-auto rounded-lg border border-border bg-surface px-5 py-2 font-medium hover:bg-surface-2"
        >
          عرض المزيد ({filtered.length - limit} متبقية)
        </button>
      )}
    </section>
  );
}

function TrackCell({ available, minimum, eligible }: { available: boolean; minimum: number | null; eligible: boolean }) {
  if (!available) return <span className="text-muted">غير متاح</span>;
  return (
    <span className={`font-semibold tabular ${eligible ? "text-success" : "text-muted line-through"}`}>
      {minimum === null ? "بدون حد" : formatScore(minimum)}
    </span>
  );
}

function AdmissionRow({ admission: a, score, used, onEdit }: { admission: Admission; score: number; used: boolean; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const tracks = eligibleTracks(a, score);

  function remove() {
    const warn = used ? "\nهذا الاختصاص موجود في قائمة الرغبات وسيُحذف منها." : "";
    if (!confirm(`حذف "${a.specialization}${a.city ? ` - ${a.city}` : ""}" نهائياً؟${warn}`)) return;
    startTransition(async () => {
      const res = await deleteAdmission(a.id);
      if (res.ok) toast(res.message ?? "تم الحذف");
      else toast(res.error, "error");
    });
  }

  return (
    <tr className={pending ? "opacity-50" : ""}>
      <td className="px-3 py-2 text-muted tabular">{a.source_order}</td>
      <td className="px-3 py-2 font-medium">
        {a.specialization}
        {used && <span className="ms-2 rounded bg-primary-soft px-1.5 text-xs text-primary">في الرغبات</span>}
      </td>
      <td className="px-3 py-2 text-muted">{[a.city, a.university].filter(Boolean).join(" · ")}</td>
      <td className="px-3 py-2">
        <TrackCell available={a.general_available} minimum={a.general_minimum} eligible={tracks.includes("general")} />
      </td>
      <td className="px-3 py-2">
        <TrackCell available={a.parallel_available} minimum={a.parallel_minimum} eligible={tracks.includes("parallel")} />
      </td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-1">
          <button onClick={onEdit} className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-surface-2">
            تعديل
          </button>
          <button
            onClick={remove}
            disabled={pending}
            className="rounded-md border border-danger/40 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger-soft"
          >
            حذف
          </button>
        </div>
      </td>
    </tr>
  );
}

const EMPTY: AdmissionInput = {
  specialization: "",
  university: null,
  city: null,
  category: "ministry",
  general_available: true,
  general_minimum: null,
  general_conditions: null,
  parallel_available: true,
  parallel_minimum: null,
  parallel_conditions: null,
  source_order: null,
};

function AdmissionForm({
  initial,
  title,
  submit,
  onDone,
}: {
  initial?: Admission;
  title: string;
  submit: (input: AdmissionInput) => ReturnType<typeof createAdmission>;
  onDone: () => void;
}) {
  const [form, setForm] = useState<AdmissionInput>(() => (initial ? { ...EMPTY, ...pick(initial) } : EMPTY));
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof AdmissionInput>(k: K, v: AdmissionInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await submit(form);
      if (res.ok) {
        toast(res.message ?? "تم الحفظ");
        onDone();
      } else toast(res.error, "error");
    });
  }

  const input = "rounded-lg border border-border bg-background px-3 py-2";
  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary-soft/40 p-4">
      <h3 className="font-bold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
          الاختصاص *
          <input required value={form.specialization} onChange={(e) => set("specialization", e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          المدينة
          <input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          الجامعة
          <input value={form.university ?? ""} onChange={(e) => set("university", e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          الجهة
          <select value={form.category} onChange={(e) => set("category", e.target.value)} className={input}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          ترتيب المصدر
          <input
            type="number"
            value={form.source_order ?? ""}
            onChange={(e) => set("source_order", num(e.target.value))}
            className={input}
          />
        </label>
        {(["general", "parallel"] as const).map((t) => (
          <fieldset key={t} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
            <legend className="px-1 text-sm font-bold">{t === "general" ? "المفاضلة العامة" : "التعليم الموازي"}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form[`${t}_available`]}
                onChange={(e) => set(`${t}_available`, e.target.checked)}
              />
              متاح
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              الحد الأدنى (%) — فارغ = بدون حد أدنى للمجموع
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={form[`${t}_minimum`] ?? ""}
                onChange={(e) => set(`${t}_minimum`, num(e.target.value))}
                className={input}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              الشروط
              <textarea
                rows={2}
                value={form[`${t}_conditions`] ?? ""}
                onChange={(e) => set(`${t}_conditions`, e.target.value)}
                className={input}
              />
            </label>
          </fieldset>
        ))}
      </div>
      <div className="flex gap-2">
        <button disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:text-background">
          {pending ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          إلغاء
        </button>
      </div>
    </form>
  );
}

function pick(a: Admission): AdmissionInput {
  return {
    specialization: a.specialization,
    university: a.university,
    city: a.city,
    category: a.category,
    general_available: a.general_available,
    general_minimum: a.general_minimum,
    general_conditions: a.general_conditions,
    parallel_available: a.parallel_available,
    parallel_minimum: a.parallel_minimum,
    parallel_conditions: a.parallel_conditions,
    source_order: a.source_order,
  };
}
