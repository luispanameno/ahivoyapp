"use client";

// Entrenamiento: rutina del día, captura del reloj para marcar hecho con kcal reales, notas.

import { useRouter } from "next/navigation";
import { useState } from "react";
import ImageDrop from "@/components/ImageDrop";
import { analyze } from "@/lib/analyze";
import { useApp } from "@/lib/store";
import { RoutineDay } from "@/lib/types";

const DAYS: RoutineDay[] = ["Push", "Pull", "Legs"];

export default function Entrenamiento() {
  const router = useRouter();
  const { routine, workout, setWorkout, showToast } = useApp();

  const [day, setDay] = useState<RoutineDay>(workout?.day ?? "Push");
  const [notes, setNotes] = useState(workout?.notes ?? "");
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exercises = routine[day];

  const readCapture = async () => {
    if (!shot) {
      setError("Primero sube la captura de tu entrenamiento.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await analyze<{ nombre: string; kcal: number }>({ mode: "workout", image: shot });
      await setWorkout({ day, done: true, kcal: Math.round(res.kcal) || 300, name: res.nombre || "Entrenamiento", notes });
      showToast(`Entrenamiento leído · ${Math.round(res.kcal)} kcal quemadas`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la captura");
    } finally {
      setBusy(false);
    }
  };

  const markManual = async () => {
    const kcal = workout?.kcal || 300;
    await setWorkout({ day, done: true, kcal, name: workout?.name || `Rutina ${day}`, notes });
    showToast("Marcado como hecho");
  };

  const saveNotes = async (text: string) => {
    setNotes(text);
    if (workout) await setWorkout({ ...workout, notes: text });
  };

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 24px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="font-sora" style={{ fontSize: 20, fontWeight: 700 }}>Entrenamiento</div>
          <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>Tu rutina de hoy</div>
        </div>
        <div
          onClick={() => router.push("/rutina")}
          style={{ fontSize: 12, fontWeight: 700, color: "#c7f27a", cursor: "pointer", padding: "6px 0" }}
        >
          Editar ›
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {DAYS.map((d) => (
          <div
            key={d}
            onClick={() => setDay(d)}
            style={{
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
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {exercises.map((ex, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", background: "#1b1e21", borderRadius: 14, padding: "12px 14px" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{ex.name}</span>
            <span style={{ fontSize: 12, color: "rgba(244,243,238,.45)" }}>{ex.sets}</span>
          </div>
        ))}
      </div>

      {workout?.done && (
        <div style={{ marginTop: 16, background: "rgba(199,242,122,.1)", border: "1px solid rgba(199,242,122,.3)", borderRadius: 16, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#c7f27a", boxShadow: "0 0 8px #c7f27a" }} />
            <div style={{ fontSize: 13, fontWeight: 800, color: "#c7f27a" }}>Registrado hoy</div>
          </div>
          <div style={{ fontSize: 12.5, color: "rgba(244,243,238,.85)", marginTop: 6 }}>
            {workout.name} · <span style={{ fontWeight: 800 }}>{workout.kcal} kcal quemadas</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(244,243,238,.5)", marginTop: 2 }}>Ya sumadas a tu conteo de calorías del día.</div>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".03em", marginTop: 18, marginBottom: 8 }}>
        SUBE LA CAPTURA DE TU ENTRENAMIENTO
      </div>
      <div style={{ fontSize: 11, color: "rgba(244,243,238,.5)", marginBottom: 10, lineHeight: 1.4 }}>
        De tu reloj o app (Samsung Health, etc.). La leemos y marcamos la rutina como hecha con las calorías reales.
      </div>
      <ImageDrop placeholder="Toca para subir la captura de tu entrenamiento" height={130} radius={14} onImage={setShot} />
      {error && <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)" }}>{error}</div>}
      <div
        onClick={readCapture}
        style={{
          background: "#c7f27a",
          color: "#10240a",
          textAlign: "center",
          padding: 13,
          borderRadius: 14,
          fontWeight: 800,
          fontSize: 13,
          marginTop: 10,
          cursor: "pointer",
          opacity: busy ? 0.6 : 1,
          boxShadow: "0 0 16px rgba(199,242,122,.45)",
        }}
      >
        {busy ? "Leyendo captura…" : "Leer captura y marcar hecho"}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".03em", marginTop: 18, marginBottom: 8 }}>
        NOTAS (OPCIONAL)
      </div>
      <textarea
        value={notes}
        onChange={(e) => saveNotes(e.target.value)}
        placeholder="Ej. subí peso en press banca, sentí molestia en hombro…"
        style={{
          width: "100%",
          minHeight: 70,
          background: "#1b1e21",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 14,
          padding: "12px 14px",
          color: "#f4f3ee",
          fontSize: 13,
          boxSizing: "border-box",
          resize: "none",
          outline: "none",
        }}
      />

      <div
        onClick={markManual}
        style={{ textAlign: "center", marginTop: 14, fontSize: 12, fontWeight: 700, color: "rgba(244,243,238,.5)", cursor: "pointer" }}
      >
        Marcar como hecho manualmente
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}
