"use client";

import { useActionState, useState } from "react";
import { login } from "@/app/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);
  const [name, setName] = useState("");
  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
      <div>
        <h2 className="text-xl font-bold">دخول المشرفين</h2>
        <p className="mt-1 text-sm text-muted">التعديل على الرغبات وبيانات المفاضلة متاح للمشرفين فقط.</p>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        الاسم (يظهر في سجل التغييرات)
        {/* Controlled so the name survives React's form reset after a failed attempt. */}
        <input
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        كلمة المرور
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>
      {state && !state.ok && <p className="text-sm font-medium text-danger">{state.error}</p>}
      <button
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-60 dark:text-background"
      >
        {pending ? "جارٍ الدخول…" : "دخول"}
      </button>
    </form>
  );
}
