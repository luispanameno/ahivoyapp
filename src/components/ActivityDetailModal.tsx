"use client";

// Modal de detalle de actividad: se abre al tocar la tarjeta "Actividad de
// hoy" en Hoy. Revelación progresiva — la tarjeta solo muestra un resumen;
// aquí está el desglose completo (grid de métricas + línea de tiempo
// vertical de los ejercicios de la rutina del día, si ya se marcó hecha).

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Activity, Exercise, WorkoutState } from "@/lib/types";
import { useApp } from "@/lib/store";

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "#232527", borderRadius: 16, padding: "12px 14px" }}>
      <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.5)", fontWeight: 600 }}>{label}</div>
      <div className="font-sora" style={{ fontSize: 17, fontWeight: 800, marginTop: 3, color }}>{value}</div>
    </div>
  );
}

export default function ActivityDetailModal({
  open,
  onClose,
  activity,
  workout,
  exercises,
  burnedKcal,
}: {
  open: boolean;
  onClose: () => void;
  activity: Activity | null;
  workout: WorkoutState | null;
  exercises: Exercise[];
  burnedKcal: number;
}) {
  const reduce = useReducedMotion();
  const { t } = useApp();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 20,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 400,
              maxHeight: "85dvh",
              overflowY: "auto",
              background: "#1b1e21",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 26,
              padding: 20,
              boxShadow: "0 12px 40px rgba(0,0,0,.5)",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div className="font-sora" style={{ fontSize: 17, fontWeight: 800 }}>{t("activityModal.title")}</div>
                <div style={{ fontSize: 11.5, color: "rgba(244,243,238,.5)", marginTop: 2 }}>
                  {workout?.done ? t("activityModal.routineDone", { day: workout.day }) : t("activityModal.noRoutine")}
                </div>
              </div>
              <motion.div
                whileTap={reduce ? undefined : { scale: 0.9 }}
                onClick={onClose}
                role="button"
                aria-label={t("activityModal.close")}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClose();
                  }
                }}
                style={{
                  width: 34,
                  height: 34,
                  flex: "none",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "rgba(244,243,238,.7)",
                }}
              >
                ✕
              </motion.div>
            </div>

            {/* Grid de métricas: pasos y sus kcal primero, y las kcal de la
                rutina SEPARADAS (no mezcladas) — son dos fuentes distintas. */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Metric label={t("activityModal.steps")} value={(activity?.steps ?? 0).toLocaleString()} color="#7ed957" />
              <Metric label={t("activityModal.kcalSteps")} value={String(activity?.activityKcal ?? 0)} color="#a56bff" />
              <Metric label={t("activityModal.kcalRoutine")} value={String(workout?.done ? workout.kcal : 0)} color="oklch(72% 0.18 25)" />
              <Metric label={t("activityModal.activeMin")} value={String(activity?.activeMin ?? 0)} color="oklch(72% 0.14 220)" />
              <Metric label={t("activityModal.totalKcal")} value={(activity?.totalKcal ?? 0).toLocaleString()} color="#f4f3ee" />
              <Metric label={t("activityModal.distance")} value={`${activity?.distance ?? 0} km`} color="oklch(70% 0.13 220)" />
            </div>
            <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.4)", marginTop: 10, lineHeight: 1.4 }}>
              {t("activityModal.sourcesNote", { kcal: burnedKcal })}
            </div>

            {/* Línea de tiempo vertical de los ejercicios de la rutina */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em", margin: "20px 0 4px" }}>
              {t("activityModal.exercisesToday")}
            </div>
            {workout?.done && exercises.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                {exercises.map((ex, i) => (
                  <div key={i} style={{ display: "flex", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#c7f27a",
                          color: "#10240a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 800,
                          flex: "none",
                          boxShadow: "0 0 8px rgba(199,242,122,.5)",
                        }}
                      >
                        ✓
                      </div>
                      {i < exercises.length - 1 && <div style={{ width: 2, flex: 1, background: "rgba(199,242,122,.25)", minHeight: 22 }} />}
                    </div>
                    <div style={{ paddingBottom: 16, flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{ex.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(244,243,238,.45)", marginTop: 1 }}>{ex.sets}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "rgba(244,243,238,.45)", lineHeight: 1.5, padding: "8px 0 4px" }}>
                {workout?.done
                  ? t("activityModal.routineNoExercises")
                  : t("activityModal.markRoutineHint")}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
