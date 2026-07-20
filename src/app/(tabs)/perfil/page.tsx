"use client";

// Perfil: datos y metas editables, historial de peso, composición corporal,
// actividad del reloj por captura, báscula por captura, invitar familia.

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import ImageUploadZone, { ActionButton, StatusBadge } from "@/components/ImageUploadZone";
import Pressable from "@/components/Pressable";
import AvatarEditor from "@/components/AvatarEditor";
import { analyze, fileToDataURL } from "@/lib/analyze";
import { useApp } from "@/lib/store";
import { ACTIVITY_FACTORS, ActivityLevel, WeightEntry, todayISO } from "@/lib/types";
import InfoModal from "@/components/InfoModal";

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: "sedentario", label: "Sedentario", desc: "No haces nada de ejercicio" },
  { value: "ligero", label: "Ligero", desc: "Por tu trabajo o rutina te mantienes caminando / en movimiento" },
  { value: "activo", label: "Activo", desc: "Haces ejercicio 3 días a la semana o más" },
];

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

const cardStyle: React.CSSProperties = { background: "#1b1e21", borderRadius: 14, padding: "12px 14px" };
const labelStyle: React.CSSProperties = { fontSize: 10.5, color: "rgba(244,243,238,.4)", fontWeight: 700 };
const numInput: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#f4f3ee",
  fontSize: 14,
  fontWeight: 700,
  marginTop: 2,
  padding: 0,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(244,243,238,.4)",
  letterSpacing: ".04em",
  marginTop: 20,
  marginBottom: 8,
};

function mifflinBMR(weightLb: number, heightCm: number, age: number, sex: "M" | "F"): number {
  const kg = weightLb * 0.4536;
  return Math.round(10 * kg + 6.25 * heightCm - 5 * age + (sex === "F" ? -161 : 5));
}

// Redondeo a 1 decimal para mostrar (evita 55.000000000000014)
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

function weeklySeries(weights: WeightEntry[]): { labels: string[]; values: number[] } {
  const byWeek = new Map<string, number[]>();
  for (const w of weights) {
    const d = new Date(w.date + "T12:00:00");
    const year = d.getFullYear();
    const week = Math.floor((d.getTime() - new Date(year, 0, 1).getTime()) / (7 * 864e5));
    const key = `${year}-${week}`;
    byWeek.set(key, [...(byWeek.get(key) ?? []), w.lb]);
  }
  const entries = [...byWeek.entries()].slice(-6);
  return {
    labels: entries.map((_, i) => `S${i + 1}`),
    values: entries.map(([, vals]) => Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10),
  };
}

const DAY_LETTERS = ["D", "L", "M", "M", "J", "V", "S"];

export default function Perfil() {
  const router = useRouter();
  const app = useApp();
  const { profile, saveProfile, weights, bodyComp, setActivity, activity, showToast, userEmail, signOut } = app;

  const [range, setRange] = useState<"days" | "weeks">("days");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);

  // Borrador de datos personales: se guardan solo al tocar "Guardar"
  const [draft, setDraft] = useState({
    age: String(profile.age),
    height: String(profile.height),
    weight: String(profile.weight),
    weightGoal: String(profile.weightGoal),
  });
  const dirty =
    Number(draft.age) !== profile.age ||
    Number(draft.height) !== profile.height ||
    Number(draft.weight) !== profile.weight ||
    Number(draft.weightGoal) !== profile.weightGoal;

  const saveDatos = async () => {
    const age = Number(draft.age) || profile.age;
    const height = Number(draft.height) || profile.height;
    const weight = Number(draft.weight) || profile.weight;
    const weightGoal = Number(draft.weightGoal) || profile.weightGoal;
    await saveProfile({ ...profile, age, height, weightGoal });
    if (weight !== profile.weight && weight > 0) await app.setWeight(weight);
    showToast("Datos guardados ✓");
  };
  const [healthShot, setHealthShot] = useState<string | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Báscula inline (mismo patrón que la actividad del reloj)
  const [scaleShot, setScaleShot] = useState<string | null>(null);
  const [scaleParsed, setScaleParsed] = useState<ScaleResult | null>(null);
  const [scaleBusy, setScaleBusy] = useState(false);
  const [scaleError, setScaleError] = useState<string | null>(null);

  const readScaleCapture = async () => {
    if (!scaleShot) {
      setScaleError("Primero sube la captura de tu báscula.");
      return;
    }
    setScaleBusy(true);
    setScaleError(null);
    try {
      const res = await analyze<ScaleResult>({ mode: "scale", image: scaleShot });
      setScaleParsed(res);
    } catch (e) {
      setScaleError(e instanceof Error ? e.message : "No se pudo leer la captura");
    } finally {
      setScaleBusy(false);
    }
  };

  const applyScale = async () => {
    if (!scaleParsed) return;
    await app.setBodyComp(
      {
        score: Math.round(scaleParsed.score ?? 0),
        build: scaleParsed.complexion ?? "—",
        bmi: scaleParsed.imc ?? 0,
        fatPct: scaleParsed.grasa_pct ?? 0,
        waterPct: scaleParsed.agua_pct ?? 0,
        proteinPct: scaleParsed.proteina_pct ?? 0,
        bmr: Math.round(scaleParsed.bmr ?? 0),
        visceralFat: scaleParsed.grasa_visceral ?? 0,
        muscle: scaleParsed.musculo_lb ?? 0,
        boneMass: scaleParsed.masa_osea_lb ?? 0,
        date: todayISO(),
      },
      scaleParsed.peso_lb > 0 ? scaleParsed.peso_lb : undefined
    );
    setScaleParsed(null);
    setScaleShot(null);
    showToast("Perfil actualizado desde tu báscula");
  };

  const setField = (field: keyof typeof profile, value: string | number) => {
    saveProfile({ ...profile, [field]: value });
  };

  const setNumField = (field: keyof typeof profile) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value);
    if (!Number.isNaN(n)) setField(field, n);
  };

  const bmr = bodyComp?.bmr || mifflinBMR(profile.weight, profile.height, profile.age, profile.sex);
  const tdee = Math.round(bmr * ACTIVITY_FACTORS[profile.activityLevel]);
  const [infoModal, setInfoModal] = useState<"bmr" | "tdee" | null>(null);

  // Serie de peso
  const daySeries = {
    labels: weights.slice(-7).map((w) => DAY_LETTERS[new Date(w.date + "T12:00:00").getDay()]),
    values: weights.slice(-7).map((w) => w.lb),
  };
  const series = range === "days" ? daySeries : weeklySeries(weights);
  const wMax = Math.max(...series.values, 1);
  const wMin = Math.min(...series.values, wMax);
  const bars = series.values.map((v, i) => ({
    label: series.labels[i],
    h: Math.round(20 + ((v - wMin) / Math.max(0.1, wMax - wMin)) * 80),
  }));
  const delta = series.values.length >= 2 ? Math.round((series.values[series.values.length - 1] - series.values[0]) * 10) / 10 : 0;
  const trendLabel =
    series.values.length >= 2
      ? `${delta <= 0 ? "↓" : "↑"} ${Math.abs(delta)} lb ${range === "days" ? "esta semana" : "en este periodo"}`
      : "Registra tu peso para ver tendencia";
  const trendColor = delta <= 0 ? "oklch(78% 0.15 145)" : "oklch(75% 0.15 60)";

  // Badges de composición corporal
  const GREEN = { bg: "rgba(199,242,122,.15)", color: "#c7f27a" };
  const ORANGE = { bg: "rgba(230,150,60,.15)", color: "oklch(75% 0.15 60)" };
  const RED = { bg: "rgba(230,90,60,.15)", color: "oklch(72% 0.18 30)" };
  const bodyRows = bodyComp
    ? [
        {
          label: "IMC",
          value: String(bodyComp.bmi),
          ...(bodyComp.bmi < 25 ? { badge: "Normal", ...GREEN } : bodyComp.bmi < 30 ? { badge: "Alto", ...ORANGE } : { badge: "Muy alto", ...RED }),
        },
        {
          label: "Grasa corporal",
          value: `${bodyComp.fatPct}%`,
          ...(bodyComp.fatPct < 20 ? { badge: "Bueno", ...GREEN } : bodyComp.fatPct < 32 ? { badge: "Alto", ...ORANGE } : { badge: "Muy alto", ...RED }),
        },
        {
          label: "Nivel de agua",
          value: `${bodyComp.waterPct}%`,
          ...(bodyComp.waterPct >= 50 ? { badge: "Normal", ...GREEN } : { badge: "Insuficiente", ...ORANGE }),
        },
        {
          label: "Proteína",
          value: `${bodyComp.proteinPct}%`,
          ...(bodyComp.proteinPct >= 16 ? { badge: "Normal", ...GREEN } : { badge: "Insuficiente", ...ORANGE }),
        },
        {
          label: "Metabolismo basal",
          value: `${bodyComp.bmr.toLocaleString()} kcal`,
          ...(bodyComp.bmr >= mifflinBMR(profile.weight, profile.height, profile.age, profile.sex) * 0.95
            ? { badge: "Normal", ...GREEN }
            : { badge: "Bajo lo ideal", ...ORANGE }),
        },
        {
          label: "Grasa visceral",
          value: String(bodyComp.visceralFat),
          ...(bodyComp.visceralFat < 10 ? { badge: "Normal", ...GREEN } : bodyComp.visceralFat < 15 ? { badge: "Alta", ...ORANGE } : { badge: "Muy alta", ...RED }),
        },
        { label: "Músculo", value: `${bodyComp.muscle} lb`, badge: "Bueno", ...GREEN },
        { label: "Masa ósea", value: `${bodyComp.boneMass} lb`, badge: "Normal", ...GREEN },
      ]
    : [];

  const readHealthCapture = async () => {
    if (!healthShot) {
      setHealthError("Primero sube la captura de tu app de salud.");
      return;
    }
    setHealthBusy(true);
    setHealthError(null);
    try {
      const res = await analyze<{
        pasos: number;
        min_activos: number;
        kcal_activas: number;
        kcal_totales: number;
        distancia_km: number;
      }>({ mode: "activity", image: healthShot });
      await setActivity({
        steps: Math.round(res.pasos) || 0,
        activeMin: Math.round(res.min_activos) || 0,
        activityKcal: Math.round(res.kcal_activas) || 0,
        totalKcal: Math.round(res.kcal_totales) || 0,
        distance: Math.round((res.distancia_km || 0) * 100) / 100,
        synced: true,
      });
      showToast("Actividad actualizada desde tu captura");
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : "No se pudo leer la captura");
    } finally {
      setHealthBusy(false);
    }
  };


  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 0" }}>
      {editorSrc && (
        <AvatarEditor
          src={editorSrc}
          onCancel={() => setEditorSrc(null)}
          onSave={async (url) => {
            await saveProfile({ ...profile, photo: url });
            setEditorSrc(null);
            showToast("Foto de perfil actualizada");
          }}
        />
      )}
      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          onClick={() => {
            if (profile.photo) setEditorSrc(profile.photo);
            else photoInputRef.current?.click();
          }}
          style={{
            width: 64,
            height: 64,
            flex: "none",
            borderRadius: "50%",
            padding: 2,
            background: "linear-gradient(135deg,#a6f06a,#39c9a3)",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              overflow: "hidden",
              background: "#1b1e21",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {profile.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photo} alt="Tu foto" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 22 }}>👤</span>
            )}
          </div>
          <div
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#c7f27a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              boxShadow: "0 0 10px rgba(199,242,122,.5)",
            }}
          >
            📷
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                setEditorSrc(await fileToDataURL(file));
              } catch {
                showToast("No se pudo cargar esa foto");
              }
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <input
            value={profile.name}
            placeholder="Tu nombre"
            onChange={(e) => setField("name", e.target.value)}
            className="font-sora"
            style={{
              background: "transparent",
              border: "none",
              borderBottom: "1px dashed rgba(244,243,238,.3)",
              outline: "none",
              fontSize: 19,
              fontWeight: 700,
              color: "#f4f3ee",
              padding: "0 0 4px",
              width: "100%",
            }}
          />
          <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.4)", marginTop: 4 }}>
            {userEmail ?? "Toca tu nombre para editarlo · toca la foto para cambiarla"}
          </div>
        </div>
      </div>

      {/* Datos personales */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em" }}>DATOS PERSONALES</div>
        <Pressable
          onClick={saveDatos}
          tapScale={0.9}
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: "8px 16px",
            borderRadius: 100,
            cursor: "pointer",
            background: dirty ? "#c7f27a" : "rgba(255,255,255,.08)",
            color: dirty ? "#10240a" : "rgba(244,243,238,.5)",
            boxShadow: dirty ? "0 0 12px rgba(199,242,122,.5)" : "none",
          }}
        >
          Guardar
        </Pressable>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>EDAD</div>
          <input
            type="number"
            inputMode="numeric"
            value={draft.age}
            onChange={(e) => setDraft({ ...draft, age: e.target.value })}
            style={numInput}
          />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>ALTURA (cm)</div>
          <input
            type="number"
            inputMode="numeric"
            value={draft.height}
            onChange={(e) => setDraft({ ...draft, height: e.target.value })}
            style={numInput}
          />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>PESO ACTUAL (lb)</div>
          <input
            type="number"
            inputMode="decimal"
            value={draft.weight}
            onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
            style={numInput}
          />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>PESO META (lb)</div>
          <input
            type="number"
            inputMode="decimal"
            value={draft.weightGoal}
            onChange={(e) => setDraft({ ...draft, weightGoal: e.target.value })}
            style={numInput}
          />
        </div>
        <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
          <div style={labelStyle}>SEXO (para calcular tu metabolismo)</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {(
              [
                { value: "M", label: "Hombre" },
                { value: "F", label: "Mujer" },
              ] as const
            ).map((s) => (
              <div
                key={s.value}
                onClick={() => saveProfile({ ...profile, sex: s.value })}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "8px 0",
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: profile.sex === s.value ? "#c7f27a" : "rgba(255,255,255,.06)",
                  color: profile.sex === s.value ? "#10240a" : "rgba(244,243,238,.6)",
                }}
              >
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nivel de actividad diaria (para el TDEE) */}
      <div style={sectionTitle}>NIVEL DE ACTIVIDAD DIARIA</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ACTIVITY_OPTIONS.map((opt) => {
          const active = profile.activityLevel === opt.value;
          return (
            <Pressable
              key={opt.value}
              onClick={() => saveProfile({ ...profile, activityLevel: opt.value })}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: active ? "rgba(199,242,122,.12)" : "#1b1e21",
                border: active ? "1px solid rgba(199,242,122,.45)" : "1px solid rgba(255,255,255,.06)",
                borderRadius: 14,
                padding: "12px 14px",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  flex: "none",
                  borderRadius: "50%",
                  border: active ? "5px solid #c7f27a" : "2px solid rgba(244,243,238,.3)",
                  boxSizing: "border-box",
                  boxShadow: active ? "0 0 10px rgba(199,242,122,.5)" : "none",
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: active ? "#c7f27a" : "#f4f3ee" }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: "rgba(244,243,238,.5)", marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(244,243,238,.35)", flex: "none" }}>
                ×{ACTIVITY_FACTORS[opt.value]}
              </div>
            </Pressable>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <div style={{ background: "#1b1e21", borderRadius: 16, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 11, color: "rgba(244,243,238,.45)", fontWeight: 700 }}>BMR</div>
            <Pressable
              onClick={() => setInfoModal("bmr")}
              tapScale={0.85}
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "1.5px solid rgba(244,243,238,.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(244,243,238,.5)",
                cursor: "pointer",
              }}
            >
              ?
            </Pressable>
          </div>
          <div className="font-sora" style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{bmr.toLocaleString()} kcal</div>
        </div>
        <div style={{ background: "#1b1e21", borderRadius: 16, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 11, color: "rgba(244,243,238,.45)", fontWeight: 700 }}>TDEE</div>
            <Pressable
              onClick={() => setInfoModal("tdee")}
              tapScale={0.85}
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "1.5px solid rgba(244,243,238,.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(244,243,238,.5)",
                cursor: "pointer",
              }}
            >
              ?
            </Pressable>
          </div>
          <div className="font-sora" style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{tdee.toLocaleString()} kcal</div>
        </div>
      </div>

      <InfoModal open={infoModal === "bmr"} title="¿Qué es el BMR?" onClose={() => setInfoModal(null)}>
        Es tu <b>Tasa Metabólica Basal</b>: las calorías que tu cuerpo quema <b>en reposo total</b> — solo por respirar,
        pensar y mantener tus órganos funcionando. Se calcula con tu peso, altura, edad y sexo (o viene directo de tu
        báscula inteligente). Aunque no te muevas en todo el día, tu cuerpo gasta esto.
      </InfoModal>
      <InfoModal open={infoModal === "tdee"} title="¿Qué es el TDEE?" onClose={() => setInfoModal(null)}>
        Es tu <b>Gasto Energético Total Diario</b>: el BMR multiplicado por tu nivel de actividad (caminar, trabajar,
        entrenar). Representa todas las calorías que quemas en un día normal. Para <b>bajar de peso</b> hay que comer
        por debajo del TDEE (déficit); para mantenerte, igual al TDEE.
      </InfoModal>

      {/* Historial de peso */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em" }}>HISTORIAL DE PESO</div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: trendColor }}>{trendLabel}</div>
      </div>
      <div style={{ background: "#1b1e21", borderRadius: 16, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["days", "weeks"] as const).map((r) => (
            <div
              key={r}
              onClick={() => setRange(r)}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "7px 0",
                borderRadius: 100,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                background: range === r ? "#c7f27a" : "#232527",
                color: range === r ? "#10240a" : "rgba(244,243,238,.6)",
              }}
            >
              {r === "days" ? "Días" : "Semanas"}
            </div>
          ))}
        </div>
        {bars.length ? (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 64 }}>
              {bars.map((b, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 18,
                      borderRadius: "4px 4px 0 0",
                      background: "oklch(70% 0.13 220)",
                      height: `${b.h}%`,
                      boxShadow: "0 0 8px oklch(70% 0.13 220 / 0.5)",
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              {bars.map((b, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 9.5, color: "rgba(244,243,238,.4)" }}>{b.label}</div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", fontSize: 12, color: "rgba(244,243,238,.45)", padding: "16px 0" }}>
            Sube tu peso (aquí o con la báscula) y verás tu progreso.
          </div>
        )}
      </div>

      {/* Composición corporal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em" }}>COMPOSICIÓN CORPORAL</div>
        <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.35)" }}>
          {bodyComp ? `Última captura: ${bodyComp.date.slice(8, 10)}/${bodyComp.date.slice(5, 7)}` : "Sin captura aún"}
        </div>
      </div>
      <div style={{ background: "#1b1e21", borderRadius: 16, padding: 18 }}>
        {bodyComp ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em" }}>PUNTUACIÓN CORPORAL</div>
              <div className="font-sora" style={{ fontSize: 40, fontWeight: 800, marginTop: 4, textShadow: "0 0 12px rgba(199,242,122,.4)" }}>
                {bodyComp.score}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <div style={{ textAlign: "center" }}>
                <div className="font-sora" style={{ fontSize: 17, fontWeight: 800 }}>
                  {profile.weight}
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(244,243,238,.4)" }}> lb</span>
                </div>
                <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.45)", marginTop: 2 }}>Peso</div>
              </div>
              <div style={{ textAlign: "center", borderLeft: "1px solid rgba(255,255,255,.06)" }}>
                <div className="font-sora" style={{ fontSize: 17, fontWeight: 800 }}>{bodyComp.build}</div>
                <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.45)", marginTop: 2 }}>Complexión física</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", paddingTop: 6 }}>
              {bodyRows.map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                  <span style={{ fontSize: 12.5, color: "rgba(244,243,238,.55)" }}>{row.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{row.value}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: row.bg, color: row.color }}>
                      {row.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", fontSize: 12, color: "rgba(244,243,238,.45)", lineHeight: 1.5 }}>
            Sube una captura de tu báscula (abajo) y aquí verás tu composición corporal completa.
          </div>
        )}
      </div>

      {/* Metas diarias */}
      <div style={sectionTitle}>METAS DIARIAS (EDITABLES)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(
          [
            { label: "Calorías", field: "metaKcal", suffix: " kcal" },
            { label: "Proteína mínima", field: "metaProtein", suffix: "g" },
            { label: "Carbs máximo", field: "metaCarbs", suffix: "g" },
            { label: "Grasas máximo", field: "metaFat", suffix: "g" },
            { label: "Agua", field: "metaWater", suffix: " ml" },
          ] as const
        ).map((m) => (
          <div
            key={m.field}
            style={{
              display: "flex",
              flexWrap: "nowrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              background: "#1b1e21",
              borderRadius: 14,
              padding: "12px 14px",
              minHeight: 44,
              boxSizing: "border-box",
            }}
          >
            <span style={{ fontSize: 13, color: "rgba(244,243,238,.6)", flex: "none", whiteSpace: "nowrap" }}>{m.label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, justifyContent: "flex-end", minWidth: 0 }}>
              <input
                type="number"
                inputMode="numeric"
                defaultValue={profile[m.field]}
                onBlur={setNumField(m.field)}
                style={{ ...numInput, width: 56, minWidth: 0, textAlign: "right", marginTop: 0, fontSize: 13, flex: "none" }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, flex: "none", whiteSpace: "nowrap" }}>{m.suffix}</span>
            </div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", background: "#1b1e21", borderRadius: 14, padding: "12px 14px" }}>
          <span style={{ fontSize: 13, color: "rgba(244,243,238,.6)" }}>Sueño</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>7–8 h</span>
        </div>
      </div>

      {/* Rutina */}
      <div style={sectionTitle}>TU RUTINA</div>
      <div
        onClick={() => router.push("/rutina")}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1b1e21", borderRadius: 14, padding: "12px 14px", cursor: "pointer" }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>Push / Pull / Legs</span>
        <span style={{ fontSize: 11, color: "rgba(244,243,238,.4)" }}>Editar ›</span>
      </div>

      {/* Actividad del reloj */}
      <div style={sectionTitle}>ACTIVIDAD DE TU RELOJ</div>
      <div style={{ fontSize: 11, color: "rgba(244,243,238,.5)", marginBottom: 10, lineHeight: 1.4 }}>
        Sube una captura de las calorías o actividad de tu app de salud (Samsung Health, Apple Salud, Garmin, etc.) y la
        leemos por ti.
      </div>
      <ImageUploadZone
        placeholder="Toca para subir la captura de tu app de salud (kcal, pasos)"
        icon="⌚"
        height={120}
        radius={14}
        onImage={setHealthShot}
      />
      {healthError && <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)" }}>{healthError}</div>}
      <ActionButton
        label={healthBusy ? "Leyendo captura…" : "Actualizar actividad desde la captura"}
        onClick={readHealthCapture}
        busy={healthBusy}
      />
      {activity?.synced && (
        <StatusBadge text={`Actualizado · ${activity.steps.toLocaleString()} pasos · ${activity.activityKcal} kcal activas hoy`} />
      )}

      {/* Báscula (inline, mismo patrón que la actividad del reloj) */}
      <div style={sectionTitle}>BÁSCULA INTELIGENTE</div>
      <div style={{ fontSize: 11, color: "rgba(244,243,238,.5)", marginBottom: 10, lineHeight: 1.4 }}>
        Sube una captura de tu app de báscula — funciona con cualquier marca (Zepp Life, Renpho, etc.) — y
        actualizamos tu peso y composición corporal.
      </div>
      <ImageUploadZone
        placeholder="Toca para subir la captura de tu báscula (cualquier marca)"
        icon="⚖️"
        height={120}
        radius={14}
        onImage={(url) => {
          setScaleShot(url);
          setScaleParsed(null);
        }}
      />
      {scaleError && <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)" }}>{scaleError}</div>}
      {scaleParsed && (
        <div style={{ marginTop: 10, background: "#1b1e21", borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em", marginBottom: 10 }}>
            DATOS DETECTADOS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12.5 }}>
            {(
              [
                ["Puntuación", scaleParsed.score != null ? String(Math.round(scaleParsed.score)) : "—"],
                ["Peso", `${r1(scaleParsed.peso_lb)} lb`],
                ["Complexión", scaleParsed.complexion ?? "—"],
                ["IMC", scaleParsed.imc != null ? String(r1(scaleParsed.imc)) : "—"],
                ["Grasa corporal", scaleParsed.grasa_pct != null ? `${r1(scaleParsed.grasa_pct)}%` : "—"],
                ["Nivel de agua", scaleParsed.agua_pct != null ? `${r1(scaleParsed.agua_pct)}%` : "—"],
                ["Proteína", scaleParsed.proteina_pct != null ? `${r1(scaleParsed.proteina_pct)}%` : "—"],
                ["Metab. basal", scaleParsed.bmr != null ? `${Math.round(scaleParsed.bmr).toLocaleString()} kcal` : "—"],
                ["Grasa visceral", scaleParsed.grasa_visceral != null ? String(Math.round(scaleParsed.grasa_visceral)) : "—"],
                ["Músculo", scaleParsed.musculo_lb != null ? `${r1(scaleParsed.musculo_lb)} lb` : "—"],
                ["Masa ósea", scaleParsed.masa_osea_lb != null ? `${r1(scaleParsed.masa_osea_lb)} lb` : "—"],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(244,243,238,.5)" }}>{label}</span>
                <span style={{ fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <ActionButton
        label={scaleBusy ? "Leyendo captura…" : scaleParsed ? "Actualizar mi perfil" : "Leer captura de la báscula"}
        onClick={scaleParsed ? applyScale : readScaleCapture}
        busy={scaleBusy}
      />
      {bodyComp && (
        <StatusBadge
          text={`Actualizado · última captura ${bodyComp.date.slice(8, 10)}/${bodyComp.date.slice(5, 7)} · ${profile.weight} lb`}
        />
      )}

      {/* Cerrar sesión */}
      {userEmail && (
        <Pressable
          onClick={signOut}
          style={{
            marginTop: 24,
            textAlign: "center",
            padding: 14,
            borderRadius: 16,
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            color: "oklch(72% 0.18 25)",
            border: "1px solid oklch(72% 0.18 25 / 0.4)",
          }}
        >
          Cerrar sesión
        </Pressable>
      )}

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <div
          className="font-sora"
          style={{
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: ".04em",
            background: "linear-gradient(180deg,#b7f06a,#39c9a3)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          AHIVOYAPP
        </div>
        <div style={{ fontSize: 10, color: "rgba(244,243,238,.35)", marginTop: 2, letterSpacing: ".02em" }}>
          AI Metabolic Scanner · v1.0 · By PanaApp
        </div>
      </div>
      <div style={{ height: 40 }} />
    </div>
  );
}
