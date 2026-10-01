import "server-only";
import type { PoolClient } from "pg";
import { db } from "./db";
import type { Admission, AuditEntry, Preference, Settings, Track } from "./types";

type Queryable = Pick<PoolClient, "query">;

const ADMISSION_COLUMNS = `
  a.id, a.specialization, a.university, a.city, a.category,
  a.general_available, a.general_minimum, a.general_conditions,
  a.parallel_available, a.parallel_minimum, a.parallel_conditions,
  a.source_page, a.source_order`;

export async function getSettings(q: Queryable = db()): Promise<Settings> {
  const { rows } = await q.query<{ key: string; value: unknown }>("SELECT key, value FROM settings");
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    studentScore: Number(map.get("student_score") ?? 83),
    academicYear: String(map.get("academic_year") ?? "2026-2027"),
    siteTitle: String(map.get("site_title") ?? ""),
    preferencesLocked: map.get("preferences_locked") === true,
  };
}

/** Admissions with at least one track open to `score`, filtered in SQL. */
export async function getAvailableAdmissions(score: number): Promise<Admission[]> {
  const { rows } = await db().query<Admission>(
    `SELECT ${ADMISSION_COLUMNS} FROM admissions a
     WHERE (a.general_available AND (a.general_minimum IS NULL OR a.general_minimum <= $1))
        OR (a.parallel_available AND (a.parallel_minimum IS NULL OR a.parallel_minimum <= $1))
     ORDER BY a.source_order NULLS LAST, a.id`,
    [score],
  );
  return rows;
}

export async function getAllAdmissions(): Promise<Admission[]> {
  const { rows } = await db().query<Admission>(
    `SELECT ${ADMISSION_COLUMNS} FROM admissions a ORDER BY a.source_order NULLS LAST, a.id`,
  );
  return rows;
}

export async function getAdmission(q: Queryable, id: number): Promise<Admission | null> {
  const { rows } = await q.query<Admission>(`SELECT ${ADMISSION_COLUMNS} FROM admissions a WHERE a.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getPreferences(q: Queryable = db()): Promise<Preference[]> {
  const { rows } = await q.query<Admission & { pref_id: number; position: number; track: Track }>(
    `SELECT p.id AS pref_id, p.position, p.track, ${ADMISSION_COLUMNS}
     FROM preferences p JOIN admissions a ON a.id = p.admission_id
     ORDER BY p.position`,
  );
  return rows.map(({ pref_id, position, track, ...admission }) => ({
    id: pref_id,
    position,
    track,
    admission,
  }));
}

export async function getRevision(): Promise<number> {
  const { rows } = await db().query<{ revision: number }>("SELECT revision FROM sync_state WHERE id = 1");
  return rows[0]?.revision ?? 0;
}

export async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  const { rows } = await db().query<AuditEntry>(
    "SELECT id, action, actor, details, created_at::text FROM audit_log ORDER BY created_at DESC, id DESC LIMIT $1",
    [limit],
  );
  return rows;
}
