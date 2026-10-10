"use server";

import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";
import { checkPassword, createSession, destroySession, requireAdmin } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { isEligible } from "@/lib/eligibility";
import { getAdmission, getSettings } from "@/lib/queries";
import { CATEGORY_LABEL, trackLabel, type Track } from "@/lib/types";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

class UserError extends Error {}

/**
 * Runs a mutation as the signed-in admin inside a transaction that holds the
 * global sync_state row lock, so concurrent editors are serialized and the
 * list can never end up with duplicate or missing positions.
 */
async function mutate(
  fn: (client: PoolClient, actor: string) => Promise<string | void>,
): Promise<ActionResult> {
  try {
    const { name } = await requireAdmin();
    const message = await withTransaction(async (client) => {
      await client.query("SELECT 1 FROM sync_state WHERE id = 1 FOR UPDATE");
      return fn(client, name);
    });
    revalidatePath("/", "layout");
    return { ok: true, message: message || undefined };
  } catch (err) {
    if (err instanceof UserError) return { ok: false, error: err.message };
    if (err instanceof Error && err.message.startsWith("غير مصرح")) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "تعذر حفظ التغيير. حاول مرة أخرى." };
  }
}

async function audit(client: PoolClient, actor: string, action: string, details: Record<string, unknown>) {
  await client.query("INSERT INTO audit_log (action, actor, details) VALUES ($1, $2, $3)", [action, actor, details]);
}

async function assertUnlocked(client: PoolClient) {
  const settings = await getSettings(client);
  if (settings.preferencesLocked) throw new UserError("الرغبات مثبتة. يجب إلغاء التثبيت أولاً.");
}

async function orderedPreferenceIds(client: PoolClient): Promise<number[]> {
  const { rows } = await client.query<{ id: number }>("SELECT id FROM preferences ORDER BY position");
  return rows.map((r) => r.id);
}

/** Rewrites positions to 1..n in the given order (unique constraint is deferred). */
async function rewritePositions(client: PoolClient, ids: number[]) {
  if (ids.length === 0) return;
  await client.query(
    `UPDATE preferences p SET position = v.pos, updated_at = now()
     FROM (SELECT * FROM unnest($1::int[]) WITH ORDINALITY AS t(id, pos)) v
     WHERE p.id = v.id AND p.position <> v.pos`,
    [ids],
  );
}

function describe(a: { specialization: string; city: string | null; university?: string | null; category?: string }, track: Track) {
  const where = [a.university, a.city].filter(Boolean).join(" - ");
  return `${a.specialization}${where ? ` - ${where}` : ""} (${trackLabel(a.category ?? "", track)})`;
}

// ---------------------------------------------------------------- auth

export async function login(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60) || "مشرف";
  if (!checkPassword(password)) return { ok: false, error: "كلمة المرور غير صحيحة" };
  await createSession(name);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logout(): Promise<void> {
  await destroySession();
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- preferences

export async function addPreference(admissionId: number, track: Track): Promise<ActionResult> {
  return mutate(async (client, actor) => {
    if (track !== "general" && track !== "parallel") throw new UserError("نوع المفاضلة غير صالح");
    await assertUnlocked(client);
    const admission = await getAdmission(client, Number(admissionId));
    if (!admission) throw new UserError("الاختصاص غير موجود");
    const { studentScore } = await getSettings(client);
    if (!isEligible(admission, track, studentScore)) {
      throw new UserError(`هذا الخيار غير متاح لمعدل ${studentScore}%`);
    }
    const ids = await orderedPreferenceIds(client);
    const dup = await client.query("SELECT position FROM preferences WHERE admission_id = $1 AND track = $2", [
      admission.id,
      track,
    ]);
    if (dup.rowCount) throw new UserError(`هذا الخيار موجود مسبقاً في الرغبة رقم ${dup.rows[0].position}`);
    const position = ids.length + 1;
    await client.query("INSERT INTO preferences (position, admission_id, track) VALUES ($1, $2, $3)", [
      position,
      admission.id,
      track,
    ]);
    await audit(client, actor, "preference_added", { position, admission_id: admission.id, track, label: describe(admission, track) });
    return `أضيفت إلى الرغبة رقم ${position}`;
  });
}

export async function removePreference(preferenceId: number): Promise<ActionResult> {
  return mutate(async (client, actor) => {
    await assertUnlocked(client);
    const { rows } = await client.query(
      `DELETE FROM preferences p USING admissions a
       WHERE p.id = $1 AND a.id = p.admission_id
       RETURNING p.position, p.track, a.specialization, a.city, a.university, a.category`,
      [Number(preferenceId)],
    );
    if (!rows[0]) throw new UserError("الرغبة غير موجودة (ربما حذفها مشرف آخر)");
    await rewritePositions(client, await orderedPreferenceIds(client));
    await audit(client, actor, "preference_removed", { position: rows[0].position, label: describe(rows[0], rows[0].track) });
  });
}

export async function movePreference(preferenceId: number, toPosition: number): Promise<ActionResult> {
  return mutate(async (client, actor) => {
    await assertUnlocked(client);
    const ids = await orderedPreferenceIds(client);
    const from = ids.indexOf(Number(preferenceId));
    if (from === -1) throw new UserError("الرغبة غير موجودة (ربما حذفها مشرف آخر)");
    const to = Math.min(Math.max(Math.trunc(Number(toPosition)) - 1, 0), ids.length - 1);
    if (from === to) return;
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    await rewritePositions(client, ids);
    await audit(client, actor, "preference_reordered", { preference_id: id, from: from + 1, to: to + 1 });
  });
}

export async function clearPreferences(): Promise<ActionResult> {
  return mutate(async (client, actor) => {
    await assertUnlocked(client);
    const { rowCount } = await client.query("DELETE FROM preferences");
    await audit(client, actor, "preferences_cleared", { removed: rowCount });
  });
}

export async function setPreferencesLocked(locked: boolean): Promise<ActionResult> {
  return mutate(async (client, actor) => {
    await client.query("UPDATE settings SET value = $1, updated_at = now() WHERE key = 'preferences_locked'", [
      JSON.stringify(Boolean(locked)),
    ]);
    await audit(client, actor, locked ? "preferences_locked" : "preferences_unlocked", {});
    return locked ? "تم تثبيت الرغبات" : "تم إلغاء تثبيت الرغبات";
  });
}

// ---------------------------------------------------------------- admissions

export type AdmissionInput = {
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
  source_order: number | null;
};

function validateAdmission(input: AdmissionInput): AdmissionInput {
  const text = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s === "" ? null : s;
  };
  const score = (v: unknown, label: string) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new UserError(`${label} يجب أن يكون بين 0 و 100`);
    return Math.round(n * 100) / 100;
  };
  const specialization = text(input.specialization);
  if (!specialization) throw new UserError("اسم الاختصاص مطلوب");
  const order = input.source_order === null || input.source_order === undefined ? null : Math.trunc(Number(input.source_order));
  return {
    specialization,
    university: text(input.university),
    city: text(input.city),
    category: input.category in CATEGORY_LABEL ? input.category : "ministry",
    general_available: Boolean(input.general_available),
    general_minimum: score(input.general_minimum, "الحد الأدنى للعام"),
    general_conditions: text(input.general_conditions),
    parallel_available: Boolean(input.parallel_available),
    parallel_minimum: score(input.parallel_minimum, "الحد الأدنى للموازي"),
    parallel_conditions: text(input.parallel_conditions),
    source_order: Number.isFinite(order) ? order : null,
  };
}

const ADMISSION_FIELDS = [
  "specialization", "university", "city", "category",
  "general_available", "general_minimum", "general_conditions",
  "parallel_available", "parallel_minimum", "parallel_conditions",
  "source_order",
] as const;

export async function createAdmission(input: AdmissionInput): Promise<ActionResult> {
  return mutate(async (client, actor) => {
    const a = validateAdmission(input);
    if (a.source_order === null) {
      const { rows: max } = await client.query<{ next: number }>(
        "SELECT COALESCE(MAX(source_order), 0) + 1 AS next FROM admissions",
      );
      a.source_order = max[0].next;
    }
    const { rows } = await client.query(
      `INSERT INTO admissions (${ADMISSION_FIELDS.join(", ")})
       VALUES (${ADMISSION_FIELDS.map((_, i) => `$${i + 1}`).join(", ")})
       RETURNING id`,
      ADMISSION_FIELDS.map((f) => a[f]),
    );
    await audit(client, actor, "admission_created", { admission_id: rows[0].id, specialization: a.specialization, city: a.city });
    return "تمت إضافة الاختصاص";
  });
}

export async function updateAdmission(id: number, input: AdmissionInput): Promise<ActionResult> {
  return mutate(async (client, actor) => {
    const before = await getAdmission(client, Number(id));
    if (!before) throw new UserError("الاختصاص غير موجود");
    const a = validateAdmission(input);
    await client.query(
      `UPDATE admissions SET ${ADMISSION_FIELDS.map((f, i) => `${f} = $${i + 2}`).join(", ")}, updated_at = now()
       WHERE id = $1`,
      [before.id, ...ADMISSION_FIELDS.map((f) => a[f])],
    );
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const f of ADMISSION_FIELDS) {
      if (before[f] !== a[f]) changes[f] = { from: before[f], to: a[f] };
    }
    await audit(client, actor, "admission_updated", {
      admission_id: before.id,
      specialization: a.specialization,
      city: a.city,
      changes,
    });
    return "تم حفظ التعديلات";
  });
}

export async function deleteAdmission(id: number): Promise<ActionResult> {
  return mutate(async (client, actor) => {
    const used = await client.query("SELECT position FROM preferences WHERE admission_id = $1", [Number(id)]);
    if (used.rowCount) await assertUnlocked(client);
    const { rows } = await client.query("DELETE FROM admissions WHERE id = $1 RETURNING specialization, city", [Number(id)]);
    if (!rows[0]) throw new UserError("الاختصاص غير موجود");
    if (used.rowCount) await rewritePositions(client, await orderedPreferenceIds(client));
    await audit(client, actor, "admission_deleted", {
      admission_id: Number(id),
      specialization: rows[0].specialization,
      city: rows[0].city,
      removed_preferences: used.rows.map((r) => r.position),
    });
    return used.rowCount ? "تم حذف الاختصاص وإزالته من الرغبات" : "تم حذف الاختصاص";
  });
}

// ---------------------------------------------------------------- settings

export async function updateSettings(input: {
  studentScore: number;
  academicYear: string;
  siteTitle: string;
}): Promise<ActionResult> {
  return mutate(async (client, actor) => {
    const score = Number(input.studentScore);
    if (!Number.isFinite(score) || score < 0 || score > 100) throw new UserError("المعدل يجب أن يكون بين 0 و 100");
    const academicYear = String(input.academicYear ?? "").trim();
    const siteTitle = String(input.siteTitle ?? "").trim();
    if (!academicYear) throw new UserError("السنة الدراسية مطلوبة");
    const before = await getSettings(client);
    const values: [string, unknown][] = [
      ["student_score", Math.round(score * 100) / 100],
      ["academic_year", academicYear],
      ["site_title", siteTitle],
    ];
    for (const [key, value] of values) {
      await client.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
         WHERE settings.value IS DISTINCT FROM EXCLUDED.value`,
        [key, JSON.stringify(value)],
      );
    }
    await audit(client, actor, "settings_updated", {
      student_score: { from: before.studentScore, to: values[0][1] },
      academic_year: { from: before.academicYear, to: academicYear },
      site_title: { from: before.siteTitle, to: siteTitle },
    });
    return "تم حفظ الإعدادات";
  });
}
