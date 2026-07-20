"use client";

// Sueño: fases, meta 7–8 h, respaldo por captura del reloj.

import { useState } from "react";
import ImageUploadZone, { ActionButton } from "@/components/ImageUploadZone";
import { analyze } from "@/lib/analyze";
import { useApp } from "@/lib/store";

export default function Sueno() {
  const { sleep, setSleep, showToast } = useApp();
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mins = sleep?.minutes ?? 0;
  const sleepOk = mins >= 420 && mins <= 510;
  const label = sleep ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m` : "— —";
  const phases = sleep?.phases;

  const readCapture = async () => {
    if (!shot) {
      setError("Primero sube la captura de sueño de tu reloj.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await analyze<{
        minutos: number;
        profundo_pct?: number;
        ligero_pct?: number;
        rem_pct?: number;
        despierto_pct?: number;
      }>({ mode: "sleep", image: shot });
      const total = Math.round(res.minutos) || 0;
      await setSleep({
        minutes: total,
        phases:
          res.profundo_pct != null
            ? {
                deep: Math.round(res.profundo_pct),
                light: Math.round(res.ligero_pct ?? 0),
                rem: Math.round(res.rem_pct ?? 0),
                awake: Math.round(res.despierto_pct ?? 0),
              }
            : null,
      });
      showToast(`Sueño actualizado: ${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la captura");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 24px", display: "flex", flexDirection: "column" }}>
      <div className="font-sora" style={{ fontSize: 20, fontWeight: 700 }}>Sueño</div>
      <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>Meta: 7–8 horas · respaldo con captura de tu reloj</div>

      <div style={{ background: "#1b1e21", borderRadius: 16, padding: 18, marginTop: 16, textAlign: "center" }}>
        <div className="font-sora" style={{ fontSize: 36, fontWeight: 800, textShadow: "0 0 12px oklch(72% 0.15 300 / 0.5)" }}>{label}</div>
        <div style={{ fontSize: 11.5, color: sleepOk ? "#c7f27a" : "oklch(75% 0.15 60)", fontWeight: 700, marginTop: 4 }}>
          {sleep ? (sleepOk ? "Dentro de tu meta de 7–8 horas" : "Fuera de tu meta de 7–8 horas") : "Sin registro de anoche"}
        </div>
      </div>

      {phases && (
        <div style={{ background: "#1b1e21", borderRadius: 16, padding: 14, marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em", marginBottom: 10 }}>
            FASES DE ANOCHE
          </div>
          <div style={{ display: "flex", height: 14, borderRadius: 100, overflow: "hidden" }}>
            <div style={{ width: `${phases.deep}%`, background: "oklch(55% 0.18 290)" }} />
            <div style={{ width: `${phases.light}%`, background: "oklch(68% 0.14 260)" }} />
            <div style={{ width: `${phases.rem}%`, background: "oklch(78% 0.12 220)" }} />
            <div style={{ width: `${phases.awake}%`, background: "rgba(255,255,255,.15)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "rgba(244,243,238,.45)" }}>
            <span>Profundo {phases.deep}%</span>
            <span>Ligero {phases.light}%</span>
            <span>REM {phases.rem}%</span>
            <span>Despierto {phases.awake}%</span>
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em", marginTop: 18, marginBottom: 8 }}>
        SUBE UNA CAPTURA DE TU RELOJ
      </div>
      <ImageUploadZone placeholder="Toca para subir la captura de sueño de tu reloj" icon="😴" height={120} radius={14} onImage={setShot} />
      {error && <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)" }}>{error}</div>}
      <ActionButton label={busy ? "Leyendo captura…" : "Leer captura del reloj"} onClick={readCapture} busy={busy} />
    </div>
  );
}
