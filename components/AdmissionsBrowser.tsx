"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { addPreference } from "@/app/actions";
import { eligibleTracks, formatScore, trackConditions, trackMinimum } from "@/lib/eligibility";
import { governorate, normalizeArabic } from "@/lib/text";
import { CATEGORY_LABEL, TRACK_LABEL, type Admission, type Track } from "@/lib/types";
import { toast } from "./Toaster";

const PAGE = 60;

type Props = {
  admissions: Admission[];
  score: number;
  /** "admissionId:track" -> position in the shared list */
  taken: Record<string, number>;
  canEdit: boolean;
};

export function AdmissionsBrowser({ admissions, score, taken, canEdit }: Props) {
  const [query, setQuery] = useState("");
  const [gov, setGov] = useState("");
  const [track, setTrack] = useState<"" | Track>("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const deferredQuery = useDeferredValue(query);

  const indexed = useMemo(
    () =>
      admissions.map((a) => ({
        a,
        tracks: eligibleTracks(a, score),
        haystack: normalizeArabic(`${a.specialization} ${a.city ?? ""} ${a.university ?? ""}`),
        gov: governorate(a.city) || (a.university ?? ""),
      })),
    [admissions, score],
  );

  const governorates = useMemo(
    () => [...new Set(indexed.map((x) => x.gov).filter(Boolean))].sort((x, y) => x.localeCompare(y, "ar")),
    [indexed],
  );
  const categories = useMemo(() => [...new Set(admissions.map((a) => a.category))], [admissions]);

  const filtered = useMemo(() => {
    const terms = normalizeArabic(deferredQuery).split(" ").filter(Boolean);
    return indexed.filter(
      (x) =>
        (!gov || x.gov === gov) &&
        (!category || x.a.category === category) &&
        (!track || x.tracks.includes(track)) &&
        terms.every((t) => x.haystack.includes(t)),
    );
  }, [indexed, deferredQuery, gov, track, category]);

  const trackCounts = useMemo(
    () => ({
      general: indexed.filter((x) => x.tracks.includes("general")).length,
      parallel: indexed.filter((x) => x.tracks.includes("parallel")).length,
    }),
    [indexed],
  );

  const resetLimit = () => setLimit(PAGE);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-xl font-bold">
          الاختصاصات المتاحة حسب معدلك
          <span className="ms-2 rounded-full bg-primary-soft px-2.5 py-0.5 text-sm font-semibold text-primary tabular">
            {filtered.length}
          </span>
        </h2>
        <p className="text-sm text-muted">
          عام: {trackCounts.general} · موازي: {trackCounts.parallel}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            resetLimit();
          }}
          placeholder="ابحث عن اختصاص أو مدينة…"
          className="rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-primary lg:col-span-1"
        />
        <select
          value={gov}
          onChange={(e) => {
            setGov(e.target.value);
            resetLimit();
          }}
          className="rounded-lg border border-border bg-surface px-3 py-2"
          aria-label="المحافظة"
        >
          <option value="">كل المحافظات</option>
          {governorates.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={track}
          onChange={(e) => {
            setTrack(e.target.value as "" | Track);
            resetLimit();
          }}
          className="rounded-lg border border-border bg-surface px-3 py-2"
          aria-label="نوع المفاضلة"
        >
          <option value="">العام والموازي</option>
          <option value="general">العام فقط</option>
          <option value="parallel">الموازي فقط</option>
        </select>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            resetLimit();
          }}
          className="rounded-lg border border-border bg-surface px-3 py-2"
          aria-label="الجهة"
        >
          <option value="">كل الجهات</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c] ?? c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
          لا توجد نتائج مطابقة.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.slice(0, limit).map(({ a, tracks }) => (
            <AdmissionCard
              key={a.id}
              admission={a}
              tracks={track ? tracks.filter((t) => t === track) : tracks}
              taken={taken}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}

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

function AdmissionCard({
  admission: a,
  tracks,
  taken,
  canEdit,
}: {
  admission: Admission;
  tracks: Track[];
  taken: Record<string, number>;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function add(track: Track) {
    startTransition(async () => {
      const res = await addPreference(a.id, track);
      if (res.ok) toast(res.message ?? "تمت الإضافة");
      else toast(res.error, "error");
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div>
        <h3 className="font-semibold leading-snug">{a.specialization}</h3>
        <p className="mt-0.5 text-sm text-muted">
          {[a.city, a.university].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {tracks.map((t) => {
          const min = trackMinimum(a, t);
          const conditions = trackConditions(a, t);
          const position = taken[`${a.id}:${t}`];
          return (
            <div key={t} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-sm font-semibold ${
                    t === "general" ? "bg-accent-soft text-accent" : "bg-parallel-soft text-parallel"
                  }`}
                >
                  {TRACK_LABEL[t]}
                </span>
                <span className="font-bold tabular">{min === null ? "بدون حد أدنى للمجموع" : formatScore(min)}</span>
                <span className="ms-auto">
                  {position ? (
                    <span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                      الرغبة رقم {position}
                    </span>
                  ) : canEdit ? (
                    <button
                      onClick={() => add(t)}
                      disabled={pending}
                      className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50 dark:text-background"
                    >
                      إضافة للرغبات
                    </button>
                  ) : null}
                </span>
              </div>
              {conditions && <p className="text-xs leading-relaxed text-muted">{conditions}</p>}
            </div>
          );
        })}
      </div>
    </li>
  );
}
