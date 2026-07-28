"use client";

// Sueño: fases, meta 7–8 h y anotación manual. Las capturas del reloj
// se suben desde Perfil → Sincronización (o por el chat del Coach).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ImageUploadZone";
import Pressable from "@/components/Pressable";
import Icon from "@/components/Icon";
import { useApp } from "@/lib/store";

const timeInputStyle: React.CSSProperties = {
  flex: 1,
  background: "#0f1113",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 14,
  padding: "12px 14px",
  color: "#f4f3ee",
  fontSize: 14,
  fontWeight: 700,
  outline: "none",
  boxSizing: "border-box",
  colorScheme: "dark",
};

// De/hasta -> minutos, asumiendo que cruza medianoche si "hasta" es menor o igual a "de".
function rangeToMinutes(from: string, to: string): number {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  if ([fh, fm, th, tm].some((n) => Number.isNaN(n))) return 0;
  const start = fh * 60 + fm;
  let end = th * 60 + tm;
  if (end <= start) end += 24 * 60;
  return end - start;
}

export default function Sueno() {
  const router = useRouter();
  const { sleep, setSleep, showToast } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [manualFrom, setManualFrom] = useState("23:00");
  const [manualTo, setManualTo] = useState("07:00");
  const [savingManual, setSavingManual] = useState(false);

  const mins = sleep?.minutes ?? 0;
  const sleepOk = mins >= 420 && mins <= 510;
  const label = sleep ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m` : "— —";
  const phases = sleep?.phases;
  const manualMinutes = rangeToMinutes(manualFrom, manualTo);

  const saveManual = async () => {
    if (manualMinutes <= 0) {
      setError("Esas horas no cuadran — revisa a qué hora te acostaste y a qué hora despertaste.");
      return;
    }
    setSavingManual(true);
    setError(null);
    try {
      await setSleep({ minutes: manualMinutes, phases: null });
      showToast(`Sueño actualizado: ${Math.floor(manualMinutes / 60)}h ${String(manualMinutes % 60).padStart(2, "0")}m`);
    } finally {
      setSavingManual(false);
    }
  };


  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 24px", display: "flex", flexDirection: "column" }}>
      <div className="font-sora" style={{ fontSize: 20, fontWeight: 700 }}>Sueño</div>
      <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>Meta: 7–8 horas · con captura de tu reloj o a mano</div>

      <div style={{ background: "#1b1e21", borderRadius: 20, padding: 18, marginTop: 16, textAlign: "center" }}>
        <div className="font-sora" style={{ fontSize: 36, fontWeight: 800, textShadow: "0 0 12px oklch(72% 0.15 300 / 0.5)" }}>{label}</div>
        <div style={{ fontSize: 11.5, color: sleepOk ? "#c7f27a" : "oklch(75% 0.15 60)", fontWeight: 700, marginTop: 4 }}>
          {sleep ? (sleepOk ? "Dentro de tu meta de 7–8 horas" : "Fuera de tu meta de 7–8 horas") : "Sin registro de anoche"}
        </div>
      </div>

      {phases && (
        <div style={{ background: "#1b1e21", borderRadius: 20, padding: 14, marginTop: 10 }}>
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

      {/* Subir capturas de sueño vive SOLO en Perfil → Sincronización (y en
          el chat del Coach). Aquí queda únicamente la anotación a mano, para
          no tener el mismo registro repartido en dos sitios. */}
      <Pressable
        onClick={() => router.push("/perfil/sincronizacion")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(199,242,122,.08)",
          border: "1px solid rgba(199,242,122,.22)",
          borderRadius: 18,
          padding: "12px 14px",
          marginTop: 16,
          minHeight: 44,
          boxSizing: "border-box",
          cursor: "pointer",
        }}
      >
        <Icon name="sleep" size={18} />
        <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "rgba(244,243,238,.8)" }}>
          ¿Tienes captura del reloj? Súbela en Sincronización
        </div>
        <span style={{ fontSize: 11, color: "rgba(244,243,238,.4)", flex: "none" }}>Ir ›</span>
      </Pressable>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 14px" }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.08)" }} />
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(244,243,238,.35)", letterSpacing: ".04em" }}>
          O ANÓTALO A MANO
        </div>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.08)" }} />
      </div>

      <div style={{ background: "#1b1e21", borderRadius: 20, padding: 16 }}>
        <div style={{ fontSize: 11.5, color: "rgba(244,243,238,.5)", marginBottom: 12 }}>
          ¿Sin reloj o app del celular a la mano? Escribe a qué hora te acostaste y a qué hora despertaste.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(244,243,238,.4)", marginBottom: 6 }}>ME ACOSTÉ</div>
            <input type="time" value={manualFrom} onChange={(e) => setManualFrom(e.target.value)} style={timeInputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(244,243,238,.4)", marginBottom: 6 }}>DESPERTÉ</div>
            <input type="time" value={manualTo} onChange={(e) => setManualTo(e.target.value)} style={timeInputStyle} />
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#c7f27a", marginTop: 12 }}>
          {manualMinutes > 0
            ? `Total: ${Math.floor(manualMinutes / 60)}h ${String(manualMinutes % 60).padStart(2, "0")}m`
            : "Revisa las horas"}
        </div>
        <ActionButton label={savingManual ? "Guardando…" : "Guardar horas de sueño"} onClick={saveManual} busy={savingManual} />
      </div>

      {error && <div style={{ marginTop: 12, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)" }}>{error}</div>}
    </div>
  );
}
