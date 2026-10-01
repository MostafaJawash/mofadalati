"use client";

import { useState, useTransition } from "react";
import { updateSettings } from "@/app/actions";
import type { Settings } from "@/lib/types";
import { toast } from "../Toaster";

export function SettingsForm({ settings }: { settings: Settings }) {
  const [score, setScore] = useState(String(settings.studentScore));
  const [year, setYear] = useState(settings.academicYear);
  const [title, setTitle] = useState(settings.siteTitle);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateSettings({ studentScore: Number(score), academicYear: year, siteTitle: title });
      if (res.ok) toast(res.message ?? "تم الحفظ");
      else toast(res.error, "error");
    });
  }

  return (
    <form onSubmit={save} className="flex max-w-lg flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">إعدادات الموقع</h2>
      <label className="flex flex-col gap-1 text-sm font-medium">
        معدل الطالب (%)
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          required
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="w-40 rounded-lg border border-border bg-background px-3 py-2 tabular"
        />
        <span className="text-xs font-normal text-muted">
          تتحدث الاختصاصات المتاحة في الصفحة الرئيسية فوراً لجميع الزوار عند تغيير المعدل.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        العام الدراسي
        <input
          required
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="w-40 rounded-lg border border-border bg-background px-3 py-2 tabular"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        عنوان الموقع
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>
      <button
        disabled={pending}
        className="self-start rounded-lg bg-primary px-5 py-2 font-semibold text-white disabled:opacity-60 dark:text-background"
      >
        {pending ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
      </button>
    </form>
  );
}
