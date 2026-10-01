"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useTransition } from "react";
import { clearPreferences, movePreference, removePreference, setPreferencesLocked, type ActionResult } from "@/app/actions";
import { formatScore, isEligible, trackMinimum } from "@/lib/eligibility";
import { MAX_PREFERENCES, TRACK_LABEL, type Preference } from "@/lib/types";
import { toast } from "./Toaster";

type Props = {
  preferences: Preference[];
  score: number;
  locked: boolean;
  isAdmin: boolean;
};

export function PreferenceList({ preferences, score, locked, isAdmin }: Props) {
  // Local copy for optimistic reordering; replaced whenever the server data changes.
  const [items, setItems] = useState(preferences);
  const [source, setSource] = useState(preferences);
  if (source !== preferences) {
    setSource(preferences);
    setItems(preferences);
  }
  const [pending, startTransition] = useTransition();
  const editable = isAdmin && !locked;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function run(action: () => Promise<ActionResult>, onFail?: () => void) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        onFail?.();
        toast(res.error, "error");
      } else if (res.message) {
        toast(res.message);
      }
    });
  }

  function move(id: number, toIndex: number) {
    const from = items.findIndex((p) => p.id === id);
    if (from === -1 || toIndex < 0 || toIndex >= items.length || from === toIndex) return;
    setItems(arrayMove(items, from, toIndex));
    run(() => movePreference(id, toIndex + 1), () => setItems(preferences));
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    move(Number(active.id), items.findIndex((p) => p.id === Number(over.id)));
  }

  function toggleLock() {
    const msg = locked
      ? "إلغاء تثبيت الرغبات؟ سيتمكن المشرفون من تعديلها مجدداً."
      : "تثبيت الرغبات؟ لن يتمكن أحد من الإضافة أو الحذف أو إعادة الترتيب حتى يتم إلغاء التثبيت.";
    if (confirm(msg)) run(() => setPreferencesLocked(!locked));
  }

  function clearAll() {
    if (confirm(`حذف جميع الرغبات (${items.length})؟ لا يمكن التراجع عن هذا.`)) run(clearPreferences);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">قائمة الرغبات</h2>
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-sm font-semibold tabular">
          {items.length} / {MAX_PREFERENCES}
        </span>
        {locked ? (
          <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-sm font-semibold text-success">تم تثبيت الرغبات 🔒</span>
        ) : (
          <span className="rounded-full bg-parallel-soft px-2.5 py-0.5 text-sm font-semibold text-parallel">غير مثبتة</span>
        )}
        <div className="ms-auto flex flex-wrap gap-2">
          <a
            href="/api/preferences/pdf"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold hover:bg-surface-2"
          >
            تنزيل الرغبات PDF
          </a>
          {isAdmin && (
            <>
              <button
                onClick={toggleLock}
                disabled={pending}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${
                  locked ? "bg-parallel" : "bg-success"
                } dark:text-background`}
              >
                {locked ? "إلغاء التثبيت" : "تثبيت الرغبات"}
              </button>
              {editable && items.length > 0 && (
                <button
                  onClick={clearAll}
                  disabled={pending}
                  className="rounded-lg border border-danger px-3 py-1.5 text-sm font-semibold text-danger disabled:opacity-50"
                >
                  مسح الكل
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!isAdmin && (
        <p className="text-sm text-muted">هذه القائمة مشتركة ويراها جميع الزوار. التعديل متاح للمشرفين فقط.</p>
      )}

      <DndContext id="preferences-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <ol className={`flex flex-col gap-1.5 ${pending ? "opacity-80" : ""}`}>
            {items.map((p, i) => (
              <PreferenceRow
                key={p.id}
                preference={p}
                position={i + 1}
                score={score}
                editable={editable}
                isFirst={i === 0}
                isLast={i === items.length - 1}
                onMove={(dir) => move(p.id, i + dir)}
                onRemove={() => run(() => removePreference(p.id), () => setItems(preferences))}
                busy={pending}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <ol className="flex flex-col gap-1.5">
        {Array.from({ length: MAX_PREFERENCES - items.length }, (_, i) => items.length + i + 1).map((pos) => (
          <li
            key={pos}
            className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted"
          >
            <span className="w-7 text-center font-semibold tabular">{pos}</span>
            <span>فارغة</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PreferenceRow({
  preference: p,
  position,
  score,
  editable,
  isFirst,
  isLast,
  onMove,
  onRemove,
  busy,
}: {
  preference: Preference;
  position: number;
  score: number;
  editable: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: p.id,
    disabled: !editable,
  });
  const min = trackMinimum(p.admission, p.track);
  const stillEligible = isEligible(p.admission, p.track, score);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-lg border bg-surface px-3 py-2 ${
        isDragging ? "z-10 border-primary shadow-lg" : "border-border"
      }`}
    >
      {editable && (
        <button
          {...attributes}
          {...listeners}
          aria-label="اسحب لإعادة الترتيب"
          className="cursor-grab touch-none select-none px-1 text-lg leading-none text-muted active:cursor-grabbing"
        >
          ⋮⋮
        </button>
      )}
      <span className="w-7 shrink-0 text-center font-bold text-primary tabular">{position}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">{p.admission.specialization}</p>
        <p className="text-xs text-muted">
          {p.admission.city ?? p.admission.university}
          {!stillEligible && <span className="ms-2 font-semibold text-danger">· لم يعد متاحاً لمعدل {score}%</span>}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
          p.track === "general" ? "bg-accent-soft text-accent" : "bg-parallel-soft text-parallel"
        }`}
      >
        {TRACK_LABEL[p.track]}
      </span>
      <span className="w-12 shrink-0 text-center text-sm font-bold tabular">{min === null ? "—" : formatScore(min)}</span>
      {editable && (
        <div className="flex shrink-0 gap-1">
          <IconButton label="تحريك للأعلى" disabled={busy || isFirst} onClick={() => onMove(-1)}>
            ↑
          </IconButton>
          <IconButton label="تحريك للأسفل" disabled={busy || isLast} onClick={() => onMove(1)}>
            ↓
          </IconButton>
          <IconButton label="حذف" danger disabled={busy} onClick={onRemove}>
            ✕
          </IconButton>
        </div>
      )}
    </li>
  );
}

function IconButton({
  label,
  danger,
  children,
  ...rest
}: { label: string; danger?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={`flex size-7 items-center justify-center rounded-md border text-sm disabled:opacity-30 ${
        danger ? "border-danger/40 text-danger hover:bg-danger-soft" : "border-border hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}
