"use client";

// Entrenamiento: rutina del día, captura del reloj para marcar hecho con kcal reales, notas.

import { useRouter } from "next/navigation";
import { useState } from "react";
import ImageUploadZone, { ActionButton } from "@/components/ImageUploadZone";
import Pressable from "@/components/Pressable";
import { analyze } from "@/lib/analyze";
import { useApp } from "@/lib/store";
import { RoutineDay } from "@/lib/types";

const DAYS: RoutineDay[] = ["Push", "Pull", "Legs"];

export default function Entrenamiento() {
  const router = useRouter();
  const { routine, workout, setWorkout, showToast, t, lang } = useApp();

  const [day, setDay] = useState<RoutineDay>(workout?.day ?? "Push");
  const [notes, setNotes] = useState(workout?.notes ?? "");
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exercises = routine[day];

  const readCapture = async () => {
    if (!shot) {
      setError(t("entrenamiento.errNoCapture"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await analyze<{ nombre: string; kcal: number }>({ mode: "workout", image: shot, lang });
      await setWorkout({ day, done: true, kcal: Math.round(res.kcal) || 300, name: res.nombre || t("sync.defaultWorkoutName"), notes });
      showToast(t("entrenamiento.toastRead", { kcal: Math.round(res.kcal) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("entrenamiento.errCaptureFailed"));
    } finally {
      setBusy(false);
    }
  };

  const markManual = async () => {
    const kcal = workout?.kcal || 300;
    await setWorkout({ day, done: true, kcal, name: workout?.name || t("entrenamiento.defaultName", { day }), notes });
    showToast(t("entrenamiento.toastManual"));
  };

  const saveNotes = async (text: string) => {
    setNotes(text);
    if (workout) await setWorkout({ ...workout, notes: text });
  };

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 24px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="font-sora" style={{ fontSize: 20, fontWeight: 700 }}>{t("entrenamiento.title")}</div>
          <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>{t("entrenamiento.subtitle")}</div>
        </div>
        <Pressable
          onClick={() => router.push("/rutina")}
          style={{ fontSize: 12, fontWeight: 700, color: "#c7f27a", cursor: "pointer", padding: "12px 4px", minHeight: 44, display: "flex", alignItems: "center" }}
        >
          {t("entrenamiento.edit")}
        </Pressable>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {DAYS.map((d) => (
          <Pressable
            key={d}
            onClick={() => setDay(d)}
            style={{
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
              flex: 1,
              textAlign: "center",
              padding: "9px 0",
              borderRadius: 100,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              background: day === d ? "#c7f27a" : "#1b1e21",
              color: day === d ? "#10240a" : "rgba(244,243,238,.6)",
              boxShadow: day === d ? "0 0 14px rgba(199,242,122,.5)" : "none",
            }}
          >
            {d}
          </Pressable>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {exercises.map((ex, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", background: "#1b1e21", borderRadius: 18, padding: "12px 14px" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{ex.name}</span>
            <span style={{ fontSize: 12, color: "rgba(244,243,238,.45)" }}>{ex.sets}</span>
          </div>
        ))}
      </div>

      {workout?.done && (
        <div style={{ marginTop: 16, background: "rgba(199,242,122,.1)", border: "1px solid rgba(199,242,122,.3)", borderRadius: 20, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#c7f27a", boxShadow: "0 0 8px #c7f27a" }} />
            <div style={{ fontSize: 13, fontWeight: 800, color: "#c7f27a" }}>{t("entrenamiento.loggedToday")}</div>
          </div>
          <div style={{ fontSize: 12.5, color: "rgba(244,243,238,.85)", marginTop: 6 }}>
            {workout.name} · <span style={{ fontWeight: 800 }}>{workout.kcal} {t("entrenamiento.kcalBurned")}</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(244,243,238,.5)", marginTop: 2 }}>{t("entrenamiento.alreadyCounted")}</div>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".03em", marginTop: 18, marginBottom: 8 }}>
        {t("entrenamiento.uploadTitle")}
      </div>
      <div style={{ fontSize: 11, color: "rgba(244,243,238,.5)", marginBottom: 10, lineHeight: 1.4 }}>
        {t("entrenamiento.uploadHint")}
      </div>
      <ImageUploadZone placeholder={t("entrenamiento.uploadPlaceholder")} icon="🏋️" height={130} radius={14} onImage={setShot} />
      {error && <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)" }}>{error}</div>}
      <ActionButton label={busy ? t("entrenamiento.readingCapture") : t("entrenamiento.readAndMark")} onClick={readCapture} busy={busy} />

      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".03em", marginTop: 18, marginBottom: 8 }}>
        {t("entrenamiento.notesTitle")}
      </div>
      <textarea
        value={notes}
        onChange={(e) => saveNotes(e.target.value)}
        placeholder={t("entrenamiento.notesPlaceholder")}
        style={{
          width: "100%",
          minHeight: 70,
          background: "#1b1e21",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 18,
          padding: "12px 14px",
          color: "#f4f3ee",
          fontSize: 13,
          boxSizing: "border-box",
          resize: "none",
          outline: "none",
        }}
      />

      <Pressable
        onClick={markManual}
        style={{ textAlign: "center", marginTop: 14, fontSize: 12, fontWeight: 700, color: "rgba(244,243,238,.5)", cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        {t("entrenamiento.markManual")}
      </Pressable>
      <div style={{ height: 20 }} />
    </div>
  );
}
