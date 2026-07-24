"use client";

// Asistente de bienvenida: se muestra UNA sola vez, la primera vez que un
// usuario aprobado entra a la app (profile.onboarded === false). Recolecta
// los datos necesarios para calcular sus metas diarias con criterio de
// nutricionista (Mifflin-St Jeor + TDEE + déficit saludable), con la báscula
// inteligente como atajo opcional para partir de datos más precisos.

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Pressable from "./Pressable";
import UploadCard from "./UploadCard";
import { analyze } from "@/lib/analyze";
import { useApp } from "@/lib/store";
import { ACTIVITY_FACTORS, ActivityLevel } from "@/lib/types";
import { computeGoals } from "@/lib/nutrition";

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

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: "sedentario", label: "Sedentario", desc: "No haces nada de ejercicio" },
  { value: "ligero", label: "Ligero", desc: "Por tu trabajo o rutina te mantienes caminando / en movimiento" },
  { value: "activo", label: "Activo", desc: "Haces ejercicio 3 días a la semana o más" },
];

const fieldStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  background: "#1b1e21",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 14,
  padding: "13px 14px",
  color: "#f4f3ee",
  fontSize: 14,
  fontWeight: 700,
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(244,243,238,.45)",
  letterSpacing: ".03em",
  marginBottom: 2,
};

const TOTAL_STEPS = 6;

export default function OnboardingWizard() {
  const { profile, saveProfile, setBodyComp, showToast } = useApp();
  const [step, setStep] = useState(0);

  const [name, setName] = useState(profile.name);
  const [sex, setSex] = useState<"M" | "F">(profile.sex);
  const [age, setAge] = useState(String(profile.age === 25 ? "" : profile.age));
  const [height, setHeight] = useState(String(profile.height === 170 ? "" : profile.height));
  const [weight, setWeight] = useState(String(profile.weight === 180 ? "" : profile.weight));
  const [weightGoal, setWeightGoal] = useState(String(profile.weightGoal === 165 ? "" : profile.weightGoal));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("ligero");

  const [scaleBusy, setScaleBusy] = useState(false);
  const [scaleError, setScaleError] = useState<string | null>(null);
  const [scaleResult, setScaleResult] = useState<ScaleResult | null>(null);

  const [saving, setSaving] = useState(false);

  const canContinueStep0 = name.trim().length > 0;
  const canContinueStep1 = Number(age) > 0 && Number(height) > 0 && Number(weight) > 0;
  const canContinueStep2 = Number(weightGoal) > 0;

  const goals = computeGoals({
    sex,
    age: Number(age) || 25,
    heightCm: Number(height) || 170,
    weightLb: Number(scaleResult?.peso_lb || weight) || 180,
    weightGoalLb: Number(weightGoal) || 165,
    activityLevel,
    bmrOverride: scaleResult?.bmr,
  });

  const readScale = async (imageUrl: string) => {
    setScaleBusy(true);
    setScaleError(null);
    try {
      const res = await analyze<ScaleResult>({ mode: "scale", image: imageUrl });
      setScaleResult(res);
      if (res.peso_lb > 0) setWeight(String(Math.round(res.peso_lb)));
    } catch (e) {
      setScaleError(e instanceof Error ? e.message : "No se pudo leer la captura");
    } finally {
      setScaleBusy(false);
    }
  };

  const finish = async () => {
    setSaving(true);
    try {
      await saveProfile({
        ...profile,
        name: name.trim(),
        sex,
        age: Number(age) || 25,
        height: Number(height) || 170,
        weight: Number(scaleResult?.peso_lb || weight) || 180,
        weightGoal: Number(weightGoal) || 165,
        activityLevel,
        metaKcal: goals.metaKcal,
        metaProtein: goals.metaProtein,
        metaCarbs: goals.metaCarbs,
        metaFat: goals.metaFat,
        metaWater: goals.metaWater,
        onboarded: true,
      });
      if (scaleResult) {
        await setBodyComp(
          {
            score: Math.round(scaleResult.score ?? 0),
            build: scaleResult.complexion ?? "—",
            bmi: scaleResult.imc ?? 0,
            fatPct: scaleResult.grasa_pct ?? 0,
            waterPct: scaleResult.agua_pct ?? 0,
            proteinPct: scaleResult.proteina_pct ?? 0,
            bmr: Math.round(scaleResult.bmr ?? 0),
            visceralFat: scaleResult.grasa_visceral ?? 0,
            muscle: scaleResult.musculo_lb ?? 0,
            boneMass: scaleResult.masa_osea_lb ?? 0,
            date: new Date().toISOString().slice(0, 10),
          },
          undefined
        );
      }
      showToast(`¡Listo, ${name.trim() || "bienvenido"}! Tus metas ya están configuradas`);
    } catch {
      showToast("No se pudo guardar. Intenta de nuevo.");
      setSaving(false);
    }
  };

  const next = () => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div style={{ minHeight: "100dvh", boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "calc(24px + env(safe-area-inset-top)) 22px calc(24px + env(safe-area-inset-bottom))" }}>
      {/* Progreso */}
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 100,
              background: i <= step ? "#c7f27a" : "rgba(255,255,255,.1)",
              boxShadow: i <= step ? "0 0 6px rgba(199,242,122,.6)" : "none",
              transition: "background .3s ease",
            }}
          />
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 22,
                  background: "linear-gradient(135deg,#a6f06a,#39c9a3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 34,
                  boxShadow: "0 0 30px rgba(199,242,122,.4)",
                  marginBottom: 20,
                }}
              >
                👋
              </div>
              <div className="font-sora" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.25 }}>
                ¡Bienvenido a AHIVOYAPP!
              </div>
              <div style={{ fontSize: 13, color: "rgba(244,243,238,.6)", marginTop: 8, lineHeight: 1.5 }}>
                Antes de empezar, arma tu perfil nutricional en menos de un minuto — así te damos metas hechas a tu medida, no genéricas.
              </div>
              <div style={{ marginTop: 32 }}>
                <div style={labelStyle}>¿CÓMO QUIERES QUE TE LLAMEMOS?</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  autoFocus
                  style={{ ...fieldStyle, fontSize: 16 }}
                  onKeyDown={(e) => e.key === "Enter" && canContinueStep0 && next()}
                />
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="font-sora" style={{ fontSize: 20, fontWeight: 800 }}>
                Datos básicos
              </div>
              <div style={{ fontSize: 12.5, color: "rgba(244,243,238,.55)", marginTop: 4, marginBottom: 20 }}>
                Con esto calculamos tu metabolismo basal (BMR), como haría un nutricionista.
              </div>
              <div style={{ ...labelStyle, marginBottom: 8 }}>SEXO</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {(
                  [
                    { value: "M", label: "Hombre" },
                    { value: "F", label: "Mujer" },
                  ] as const
                ).map((s) => (
                  <Pressable
                    key={s.value}
                    onClick={() => setSex(s.value)}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "12px 0",
                      borderRadius: 14,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: sex === s.value ? "#c7f27a" : "#1b1e21",
                      color: sex === s.value ? "#10240a" : "rgba(244,243,238,.6)",
                    }}
                  >
                    {s.label}
                  </Pressable>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={labelStyle}>EDAD</div>
                  <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" style={fieldStyle} />
                </div>
                <div>
                  <div style={labelStyle}>ALTURA (cm)</div>
                  <input type="number" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" style={fieldStyle} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={labelStyle}>PESO ACTUAL (lb)</div>
                  <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="180" style={fieldStyle} />
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="font-sora" style={{ fontSize: 20, fontWeight: 800 }}>
                ¿Cuál es tu meta de peso?
              </div>
              <div style={{ fontSize: 12.5, color: "rgba(244,243,238,.55)", marginTop: 4, marginBottom: 20 }}>
                Si es menor a tu peso actual, calculamos un déficit saludable; si es igual o mayor, mantenimiento.
              </div>
              <div style={labelStyle}>PESO META (lb)</div>
              <input type="number" inputMode="decimal" value={weightGoal} onChange={(e) => setWeightGoal(e.target.value)} placeholder="165" style={{ ...fieldStyle, fontSize: 18 }} autoFocus />
              {Number(weightGoal) > 0 && Number(weight) > 0 && (
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(244,243,238,.5)" }}>
                  {Number(weightGoal) < Number(weight)
                    ? `Meta de bajar ${r1(Number(weight) - Number(weightGoal))} lb.`
                    : Number(weightGoal) > Number(weight)
                    ? `Meta de subir ${r1(Number(weightGoal) - Number(weight))} lb.`
                    : "Meta de mantenerte en tu peso actual."}
                </div>
              )}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="font-sora" style={{ fontSize: 20, fontWeight: 800 }}>
                Tu nivel de actividad diaria
              </div>
              <div style={{ fontSize: 12.5, color: "rgba(244,243,238,.55)", marginTop: 4, marginBottom: 20, lineHeight: 1.5 }}>
                No es solo ejercicio: es qué tanto te mueves en un día normal. Esto ajusta tu gasto calórico total (TDEE) sobre tu metabolismo basal.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ACTIVITY_OPTIONS.map((opt) => {
                  const active = activityLevel === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onClick={() => setActivityLevel(opt.value)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: active ? "rgba(199,242,122,.12)" : "#1b1e21",
                        border: active ? "1px solid rgba(199,242,122,.45)" : "1px solid rgba(255,255,255,.06)",
                        borderRadius: 14,
                        padding: "13px 14px",
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
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: active ? "#c7f27a" : "#f4f3ee" }}>{opt.label}</div>
                        <div style={{ fontSize: 11.5, color: "rgba(244,243,238,.5)", marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
                      </div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(244,243,238,.35)", flex: "none" }}>×{ACTIVITY_FACTORS[opt.value]}</div>
                    </Pressable>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="font-sora" style={{ fontSize: 20, fontWeight: 800 }}>
                ¿Tienes báscula inteligente?
              </div>
              <div style={{ fontSize: 12.5, color: "rgba(244,243,238,.55)", marginTop: 4, marginBottom: 20, lineHeight: 1.5 }}>
                Es opcional, pero <b style={{ color: "#c7f27a" }}>muy recomendado</b>: con una captura de tu báscula (Zepp Life, Renpho, etc.) leemos tu metabolismo basal real en vez de estimarlo, y tus metas quedan más precisas.
              </div>
              <UploadCard
                title="Báscula inteligente"
                subtitle="peso · grasa · metabolismo basal"
                icon="⚖️"
                lastUpdated={scaleResult ? { timestamp: "lista", label: "Leída" } : undefined}
                isUpdated={!!scaleResult}
                busy={scaleBusy}
                busyMessages={["Leyendo tu captura…", "Extrayendo peso, IMC y BMR…", "Casi listo…"]}
                onImage={readScale}
              />
              {scaleError && (
                <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)", background: "rgba(230,120,60,.1)", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(230,120,60,.2)" }}>
                  {scaleError}
                </div>
              )}
              {scaleResult && (
                <div style={{ marginTop: 12, fontSize: 12.5, color: "#c7f27a", fontWeight: 700 }}>
                  ✓ Peso {Math.round(scaleResult.peso_lb)} lb{scaleResult.bmr ? ` · BMR ${Math.round(scaleResult.bmr)} kcal` : ""} detectados
                </div>
              )}
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="font-sora" style={{ fontSize: 20, fontWeight: 800 }}>
                Tus metas diarias
              </div>
              <div style={{ fontSize: 12.5, color: "rgba(244,243,238,.55)", marginTop: 4, marginBottom: 18, lineHeight: 1.5 }}>
                Calculadas con tu {scaleResult?.bmr ? "báscula" : "metabolismo basal estimado"} y nivel de actividad. Podrás ajustarlas cuando quieras en Perfil.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div style={{ background: "#1b1e21", borderRadius: 14, padding: 12 }}>
                  <div style={labelStyle}>BMR</div>
                  <div className="font-sora" style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{goals.bmr.toLocaleString()} kcal</div>
                </div>
                <div style={{ background: "#1b1e21", borderRadius: 14, padding: 12 }}>
                  <div style={labelStyle}>TDEE</div>
                  <div className="font-sora" style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{goals.tdee.toLocaleString()} kcal</div>
                </div>
              </div>
              <div style={{ background: "#1b1e21", borderRadius: 16, padding: 16 }}>
                {[
                  { label: "Calorías", value: `${goals.metaKcal.toLocaleString()} kcal`, color: "#c7f27a" },
                  { label: "Proteína mínima", value: `${goals.metaProtein}g`, color: "oklch(72% 0.15 250)" },
                  { label: "Carbohidratos máximo", value: `${goals.metaCarbs}g`, color: "oklch(78% 0.15 85)" },
                  { label: "Grasas máximo", value: `${goals.metaFat}g`, color: "oklch(72% 0.15 40)" },
                  { label: "Agua", value: `${goals.metaWater.toLocaleString()} ml`, color: "oklch(70% 0.13 220)" },
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "11px 0",
                      borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "rgba(244,243,238,.7)" }}>{row.label}</span>
                    <span className="font-sora" style={{ fontSize: 14, fontWeight: 800, color: row.color }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navegación */}
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        {step > 0 && (
          <Pressable
            onClick={back}
            style={{
              flex: "none",
              width: 52,
              textAlign: "center",
              padding: 16,
              borderRadius: 18,
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
              background: "#1b1e21",
              color: "rgba(244,243,238,.7)",
            }}
          >
            ‹
          </Pressable>
        )}
        {step === 4 && !scaleResult && (
          <Pressable
            onClick={next}
            style={{
              flex: 1,
              textAlign: "center",
              padding: 16,
              borderRadius: 18,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              background: "#1b1e21",
              color: "rgba(244,243,238,.6)",
            }}
          >
            Omitir por ahora
          </Pressable>
        )}
        <Pressable
          onClick={() => {
            if (step === 0 && !canContinueStep0) return;
            if (step === 1 && !canContinueStep1) return;
            if (step === 2 && !canContinueStep2) return;
            if (step === TOTAL_STEPS - 1) {
              finish();
              return;
            }
            next();
          }}
          style={{
            flex: 1,
            textAlign: "center",
            padding: 16,
            borderRadius: 18,
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            background:
              (step === 0 && !canContinueStep0) || (step === 1 && !canContinueStep1) || (step === 2 && !canContinueStep2) || saving
                ? "rgba(199,242,122,.3)"
                : "#c7f27a",
            color: "#10240a",
            boxShadow: "0 0 20px rgba(199,242,122,.4)",
          }}
        >
          {saving ? "Guardando…" : step === TOTAL_STEPS - 1 ? "Empezar" : step === 4 && scaleResult ? "Continuar" : "Continuar"}
        </Pressable>
      </div>
    </div>
  );
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}
