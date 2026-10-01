import Link from "next/link";
import type { Settings } from "@/lib/types";

export function SiteHeader({ settings, isAdmin, active }: { settings: Settings; isAdmin: boolean; active: "home" | "admin" }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4">
        <div>
          <h1 className="text-2xl font-bold">
            مفاضلة <span className="text-primary tabular">{settings.studentScore}%</span>
          </h1>
          <p className="text-sm text-muted">
            {settings.siteTitle} · العام الدراسي {settings.academicYear}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-primary-soft px-4 py-2">
          <span className="text-sm text-muted">معدلك:</span>
          <span className="text-xl font-bold text-primary tabular">{settings.studentScore}%</span>
        </div>
        <nav className="ms-auto flex gap-1 text-sm font-medium">
          <Link
            href="/"
            className={`rounded-lg px-3 py-1.5 ${active === "home" ? "bg-surface-2" : "text-muted hover:bg-surface-2"}`}
          >
            الصفحة الرئيسية
          </Link>
          <Link
            href="/admin"
            className={`rounded-lg px-3 py-1.5 ${active === "admin" ? "bg-surface-2" : "text-muted hover:bg-surface-2"}`}
          >
            {isAdmin ? "لوحة التحكم" : "دخول المشرفين"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
