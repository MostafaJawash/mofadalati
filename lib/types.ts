export type Track = "general" | "parallel";

export const TRACK_LABEL: Record<Track, string> = {
  general: "عام",
  parallel: "موازي",
};

export const MAX_PREFERENCES = 40;

export type Admission = {
  id: number;
  specialization: string;
  university: string | null;
  city: string | null;
  category: string;
  general_available: boolean;
  general_minimum: number | null;
  general_conditions: string | null;
  parallel_available: boolean;
  parallel_minimum: number | null;
  parallel_conditions: string | null;
  source_page: number | null;
  source_order: number | null;
};

export type Settings = {
  studentScore: number;
  academicYear: string;
  siteTitle: string;
  preferencesLocked: boolean;
};

export type Preference = {
  id: number;
  position: number;
  track: Track;
  admission: Admission;
};

export type AuditEntry = {
  id: number;
  action: string;
  actor: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export const CATEGORY_LABEL: Record<string, string> = {
  ministry: "الجامعات الحكومية",
  defense: "الجامعة الوطنية للعلوم الدفاعية",
  security: "الجامعة السورية للعلوم الأمنية",
};
