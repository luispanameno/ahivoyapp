"use client";

// Importar de báscula: captura → Gemini lee composición corporal → actualizar perfil.

import { useRouter } from "next/navigation";
import { useState } from "react";
import ImageDrop from "@/components/ImageDrop";
import { analyze } from "@/lib/analyze";
import { useApp } from "@/lib/store";
import { todayISO } from "@/lib/types";

interface ScaleResult {
  peso_lb: number;
  score?: number;
  complexion?: string;
  imc?: number;
  grasa_pct?: number;
  agua_pct?: number;
  proteina_pct?: number;
  bmr?: number;
  grasa_visceral?: number;
  musculo_lb?: number;
  masa_osea_lb?: number;
}

export default function Bascula() {
  const router = useRouter();
  const { setBodyComp, showToast } = useApp();
  const [shot, setShot] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ScaleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = async () => {
    if (!shot) {
      setError("Primero sube la captura de tu báscula.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await analyze<ScaleResult>({ mode: "scale", image: shot });
      setParsed(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la captura");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!parsed) return;
    await setBodyComp(
      {
        score: Math.round(parsed.score ?? 0),
        build: parsed.complexion ?? "—",
        bmi: parsed.imc ?? 0,
        fatPct: parsed.grasa_pct ?? 0,
        waterPct: parsed.agua_pct ?? 0,
        proteinPct: parsed.proteina_pct ?? 0,
        bmr: Math.round(parsed.bmr ?? 0),
        visceralFat: parsed.grasa_visceral ?? 0,
        muscle: parsed.musculo_lb ?? 0,
        boneMass: parsed.masa_osea_lb ?? 0,
        date: todayISO(),
      },
      parsed.peso_lb > 0 ? parsed.peso_lb : undefined
    );
    showToast("Perfil actualizado desde tu báscula");
    router.push("/perfil");
  };

  const rows: [string, string][] = parsed
    ? [
        ["Puntuación corporal", String(parsed.score ?? "—")],
        ["Peso", `${parsed.peso_lb} lb`],
        ["Complexión física", parsed.complexion ?? "—"],
        ["IMC", String(parsed.imc ?? "—")],
        ["Grasa corporal", parsed.grasa_pct != null ? `${parsed.grasa_pct}%` : "—"],
        ["Nivel de agua", parsed.agua_pct != null ? `${parsed.agua_pct}%` : "—"],
        ["Proteína", parsed.proteina_pct != null ? `${parsed.proteina_pct}%` : "—"],
        ["Metabolismo basal", parsed.bmr != null ? `${parsed.bmr.toLocaleString()} kcal` : "—"],
        ["Grasa visceral", String(parsed.grasa_visceral ?? "—")],
        ["Músculo", parsed.musculo_lb != null ? `${parsed.musculo_lb} lb` : "—"],
        ["Masa ósea", parsed.masa_osea_lb != null ? `${parsed.masa_osea_lb} lb` : "—"],
      ]
    : [];

  return (
    <div style={{ minHeight: "100dvh", boxSizing: "border-box", padding: "24px 20px 24px", display: "flex", flexDirection: "column" }}>
      <div onClick={() => router.push("/perfil")} style={{ fontSize: 13, fontWeight: 700, color: "rgba(244,243,238,.6)", cursor: "pointer", marginBottom: 10 }}>
        ‹ Perfil
      </div>
      <div className="font-sora" style={{ fontSize: 18, fontWeight: 700 }}>Importar de báscula</div>
      <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>
        Sube una captura de tu app de báscula y actualizamos tu perfil
      </div>

      <div style={{ marginTop: 16 }}>
        <ImageDrop placeholder="Toca para subir tu captura de báscula" height={180} radius={18} onImage={(url) => { setShot(url); setParsed(null); }} />
      </div>
      {error && <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)" }}>{error}</div>}

      {parsed && (
        <div style={{ marginTop: 16, background: "#1b1e21", borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em", marginBottom: 10 }}>
            DATOS DETECTADOS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12.5 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(244,243,238,.5)" }}>{label}</span>
                <span style={{ fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />
      <div
        onClick={parsed ? apply : read}
        style={{
          background: "#c7f27a",
          color: "#10240a",
          textAlign: "center",
          padding: 15,
          borderRadius: 18,
          fontWeight: 800,
          fontSize: 13.5,
          marginTop: 10,
          cursor: "pointer",
          opacity: busy ? 0.6 : 1,
          boxShadow: "0 0 20px rgba(199,242,122,.5)",
        }}
      >
        {busy ? "Leyendo captura…" : parsed ? "Actualizar mi perfil" : "Leer captura"}
      </div>
    </div>
  );
}
