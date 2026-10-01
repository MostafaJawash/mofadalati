import { AdmissionsBrowser } from "@/components/AdmissionsBrowser";
import { PreferenceList } from "@/components/PreferenceList";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import { getAvailableAdmissions, getPreferences, getSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [settings, session] = await Promise.all([getSettings(), getSession()]);
  const [admissions, preferences] = await Promise.all([
    getAvailableAdmissions(settings.studentScore),
    getPreferences(),
  ]);
  const taken = Object.fromEntries(preferences.map((p) => [`${p.admission.id}:${p.track}`, p.position]));
  const isAdmin = session !== null;

  return (
    <>
      <SiteHeader settings={settings} isAdmin={isAdmin} active="home" />
      <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div>
          <AdmissionsBrowser
            admissions={admissions}
            score={settings.studentScore}
            taken={taken}
            canEdit={isAdmin && !settings.preferencesLocked}
            preferenceCount={preferences.length}
          />
        </div>
        <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
          <PreferenceList
            preferences={preferences}
            score={settings.studentScore}
            locked={settings.preferencesLocked}
            isAdmin={isAdmin}
          />
        </aside>
      </main>
    </>
  );
}
