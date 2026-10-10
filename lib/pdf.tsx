import "server-only";
import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { trackMinimum } from "./eligibility";
import { trackLabel, type Preference, type Settings } from "./types";

const fontDir = path.join(process.cwd(), "assets", "fonts");
Font.register({
  family: "Plex",
  fonts: [
    { src: path.join(fontDir, "IBMPlexSansArabic-Regular.ttf") },
    { src: path.join(fontDir, "IBMPlexSansArabic-Bold.ttf"), fontWeight: "bold" },
  ],
});
// Arabic words must never be hyphenated.
Font.registerHyphenationCallback((word) => [word]);

const s = StyleSheet.create({
  page: { fontFamily: "Plex", fontSize: 9.5, lineHeight: 1.35, paddingTop: 20, paddingBottom: 30, paddingHorizontal: 30, color: "#1f2933" },
  title: { fontSize: 18, fontWeight: "bold", textAlign: "center", lineHeight: 1.6, marginBottom: 6 },
  meta: { flexDirection: "row-reverse", justifyContent: "center", marginBottom: 10 },
  metaItem: { flexDirection: "row-reverse", width: 130, justifyContent: "center" },
  metaLabel: { color: "#52606d", width: 46, textAlign: "left", paddingLeft: 4 },
  metaValue: { fontWeight: "bold", width: 70, textAlign: "right" },
  head: { flexDirection: "row-reverse", backgroundColor: "#1f3a5f", color: "#ffffff", fontWeight: "bold" },
  row: { flexDirection: "row-reverse", borderBottomWidth: 0.5, borderBottomColor: "#cbd2d9", minHeight: 16.5 },
  zebra: { backgroundColor: "#f5f7fa" },
  cell: { paddingHorizontal: 5, paddingVertical: 1, textAlign: "right" },
  num: { width: 26, textAlign: "center" },
  name: { flex: 1 },
  city: { width: 170 },
  track: { width: 44, textAlign: "center" },
  min: { width: 62, textAlign: "center" },
  empty: { color: "#9aa5b1" },
  footer: { position: "absolute", bottom: 12, left: 30, right: 30, fontSize: 8, color: "#7b8794", flexDirection: "row-reverse", justifyContent: "space-between" },
});

function PreferencesDocument({ settings, preferences }: { settings: Settings; preferences: Preference[] }) {
  const generated = new Date().toISOString().slice(0, 16).replace("T", " ");
  return (
    <Document title="الرغبات الجامعية" author="mofadalati" language="ar">
      <Page size="A4" style={s.page}>
        <Text style={s.title}>الرغبات الجامعية</Text>
        <View style={s.meta}>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>المعدل:</Text>
            <Text style={s.metaValue}>{`${settings.studentScore}%`}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>السنة:</Text>
            <Text style={s.metaValue}>{settings.academicYear}</Text>
          </View>
          <View style={s.metaItem}>
            <Text style={s.metaLabel}>الحالة:</Text>
            <Text style={s.metaValue}>{settings.preferencesLocked ? "مثبتة" : "غير مثبتة"}</Text>
          </View>
        </View>

        <View style={s.head} fixed>
          <Text style={[s.cell, s.num]}>#</Text>
          <Text style={[s.cell, s.name]}>الاختصاص</Text>
          <Text style={[s.cell, s.city]}>الجامعة / المدينة</Text>
          <Text style={[s.cell, s.track]}>النوع</Text>
          <Text style={[s.cell, s.min]}>الحد الأدنى %</Text>
        </View>
        {preferences.map((p) => {
          const min = trackMinimum(p.admission, p.track);
          return (
            <View key={p.id} style={[s.row, p.position % 2 === 0 ? s.zebra : {}]} wrap={false}>
              <Text style={[s.cell, s.num]}>{String(p.position)}</Text>
              <Text style={[s.cell, s.name]}>{p.admission.specialization}</Text>
              <Text style={[s.cell, s.city]}>{[p.admission.city, p.admission.university].filter(Boolean).join(" - ")}</Text>
              <Text style={[s.cell, s.track]}>{trackLabel(p.admission.category, p.track)}</Text>
              <Text style={[s.cell, s.min]}>{min === null ? "—" : String(min)}</Text>
            </View>
          );
        })}
        {preferences.length === 0 && (
          <View style={s.row}>
            <Text style={[s.cell, s.name, s.empty]}>لا توجد رغبات</Text>
          </View>
        )}
        <View style={s.footer} fixed>
          {/* Separate Text nodes: react-pdf mis-orders numbers mixed into Arabic runs. */}
          <View style={{ flexDirection: "row-reverse", gap: 3 }}>
            <Text>عدد الرغبات:</Text>
            <Text>{String(preferences.length)}</Text>
          </View>
          <Text>{generated} UTC</Text>
        </View>
      </Page>
    </Document>
  );
}

export function renderPreferencesPdf(settings: Settings, preferences: Preference[]) {
  return renderToBuffer(<PreferencesDocument settings={settings} preferences={preferences} />);
}
