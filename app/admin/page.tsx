import Link from "next/link";
import { logout } from "@/app/actions";
import { AdmissionsBrowser } from "@/components/AdmissionsBrowser";
import { AdmissionsManager } from "@/components/admin/AdmissionsManager";
import { AuditLog } from "@/components/admin/AuditLog";
import { LoginForm } from "@/components/admin/LoginForm";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { PreferenceList } from "@/components/PreferenceList";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import { getAllAdmissions, getAuditLog, getAvailableAdmissions, getPreferences, getSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "preferences", label: "الرغبات" },
  { key: "admissions", label: "بيانات المفاضلة" },
  { key: "settings", label: "إعدادات الموقع" },
  { key: "history", label: "سجل التغييرات" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const [settings, session, params] = await Promise.all([getSettings(), getSession(), searchParams]);

  if (!session) {
    return (
      <>
        <SiteHeader settings={settings} isAdmin={false} active="admin" />
        <main className="mx-auto w-full max-w-sm px-4 py-12">
          <LoginForm />
        </main>
      </>
    );
  }

  const tab: TabKey = TABS.some((t) => t.key === params.tab) ? (params.tab as TabKey) : "preferences";

  return (
    <>
      <SiteHeader settings={settings} isAdmin active="admin" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/admin?tab=${t.key}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  tab === t.key ? "bg-surface shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-3 text-sm">
            <span className="text-muted">
              مسجل باسم: <strong className="text-foreground">{session.name}</strong>
            </span>
            <form action={logout}>
              <button className="rounded-lg border border-border px-3 py-1.5 font-medium hover:bg-surface-2">خروج</button>
            </form>
          </div>
        </div>

        {tab === "preferences" && <PreferencesTab />}
        {tab === "admissions" && <AdmissionsTab />}
        {tab === "settings" && <SettingsForm key={JSON.stringify(settings)} settings={settings} />}
        {tab === "history" && <AuditLog entries={await getAuditLog(200)} />}
      </main>
    </>
  );
}

async function PreferencesTab() {
  const settings = await getSettings();
  const [admissions, preferences] = await Promise.all([
    getAvailableAdmissions(settings.studentScore),
    getPreferences(),
  ]);
  const taken = Object.fromEntries(preferences.map((p) => [`${p.admission.id}:${p.track}`, p.position]));
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <PreferenceList preferences={preferences} score={settings.studentScore} locked={settings.preferencesLocked} isAdmin />
      <div>
        {settings.preferencesLocked ? (
          <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
            الرغبات مثبتة. ألغِ التثبيت لإضافة رغبات جديدة.
          </p>
        ) : (
          <AdmissionsBrowser
            admissions={admissions}
            score={settings.studentScore}
            taken={taken}
            canEdit
          />
        )}
      </div>
    </div>
  );
}

async function AdmissionsTab() {
  const [admissions, settings, preferences] = await Promise.all([getAllAdmissions(), getSettings(), getPreferences()]);
  const used = Object.fromEntries(preferences.map((p) => [p.admission.id, true]));
  return <AdmissionsManager admissions={admissions} score={settings.studentScore} usedIds={used} />;
}
