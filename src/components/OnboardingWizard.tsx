"use client";

// Asistente de bienvenida: se muestra UNA sola vez, la primera vez que un
// usuario aprobado entra a la app (profile.onboarded === false). Recolecta
// los datos necesarios para calcular sus metas diarias con criterio de
// nutricionista (Mifflin-St Jeor + TDEE + déficit saludable), con la báscula
// inteligente como atajo opcional para partir de datos más precisas. También
// pregunta el motivo y la cultura alimentaria de la persona — no son números,
// pero le dan al Coach el contexto para hablarle como a alguien real y no
// con consejos genéricos de plantilla.

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Pressable from "./Pressable";
import UploadCard from "./UploadCard";
import Icon from "./Icon";
import AvatarEditor from "./AvatarEditor";
import MascotIllustration from "./MascotIllustration";
import { getActivityOptions } from "./profileUi";
import { analyze, fileToDataURL } from "@/lib/analyze";
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

const fieldStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  background: "#1b1e21",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 18,
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

// Cada paso ocupa el alto disponible y deja su contenido centrado a media
// pantalla, en vez de pegado arriba con un hueco grande debajo.
const stepStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const titleStyle: React.CSSProperties = { fontSize: 20, fontWeight: 800, textAlign: "center" };
const heroTitleStyle: React.CSSProperties = { fontSize: 24, fontWeight: 800, lineHeight: 1.25, textAlign: "center" };
const subtitleStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: "rgba(244,243,238,.55)",
  marginTop: 6,
  marginBottom: 20,
  lineHeight: 1.5,
  textAlign: "center",
};

const TOTAL_STEPS = 9;

type T = (key: string, vars?: Record<string, string | number>) => string;

function motivationPresets(t: T) {
  return [
    { emoji: "🎯", label: t("onboarding.motivWeight"), value: t("onboarding.motivWeightValue") },
    { emoji: "🌿", label: t("onboarding.motivBetter"), value: t("onboarding.motivBetterValue") },
    { emoji: "⚡", label: t("onboarding.motivEnergy"), value: t("onboarding.motivEnergyValue") },
    { emoji: "📋", label: t("onboarding.motivTrack"), value: t("onboarding.motivTrackValue") },
  ] as const;
}

function exercisePresets(t: T) {
  return [
    { icon: "🏋️", label: t("onboarding.exWeights"), value: t("onboarding.exWeightsValue") },
    { icon: "/icons/glyphs/steps.png", label: t("onboarding.exWalk"), value: t("onboarding.exWalkValue") },
    { icon: "🌱", label: t("onboarding.exStarting"), value: t("onboarding.exStartingValue") },
  ] as const;
}

function iconFor(src: string, size: number) {
  return src.startsWith("/") ? (
    <Icon name={src.replace("/icons/glyphs/", "").replace(".png", "")} size={size} />
  ) : (
    <div style={{ fontSize: size - 4, flex: "none" }}>{src}</div>
  );
}

function PresetChips<T extends { label: string; value: string }>({
  options,
  selected,
  onSelect,
  renderIcon,
}: {
  options: readonly T[];
  selected: string;
  onSelect: (value: string) => void;
  renderIcon: (opt: T) => React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <Pressable
            key={opt.label}
            onClick={() => onSelect(opt.value)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: active ? "rgba(199,242,122,.12)" : "#1b1e21",
              border: active ? "1px solid rgba(199,242,122,.45)" : "1px solid rgba(255,255,255,.06)",
              borderRadius: 18,
              padding: "12px 14px",
              cursor: "pointer",
            }}
          >
            {renderIcon(opt)}
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: active ? "#c7f27a" : "#f4f3ee" }}>{opt.label}</div>
          </Pressable>
        );
      })}
    </div>
  );
}

export default function OnboardingWizard({ onFinished }: { onFinished?: () => void } = {}) {
  const { profile, saveProfile, setBodyComp, showToast, t } = useApp();
  const [step, setStep] = useState(0);

  const [photo, setPhoto] = useState<string | null>(profile.photo);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile.name);
  const [goalMotivation, setGoalMotivation] = useState(profile.goalMotivation || "");
  const [sex, setSex] = useState<"M" | "F">(profile.sex);
  const [age, setAge] = useState(String(profile.age === 25 ? "" : profile.age));
  const [height, setHeight] = useState(String(profile.height === 170 ? "" : profile.height));
  const [weight, setWeight] = useState(String(profile.weight === 180 ? "" : profile.weight));
  const [weightGoal, setWeightGoal] = useState(String(profile.weightGoal === 165 ? "" : profile.weightGoal));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("ligero");
  const [exercisePlan, setExercisePlan] = useState(profile.exercisePlan || "");
  // Ya no se pregunta en el asistente; se conserva lo que hubiera guardado.
  const foodCulture = profile.foodCulture || "";

  const [scaleBusy, setScaleBusy] = useState(false);
  const [scaleError, setScaleError] = useState<string | null>(null);
  const [scaleResult, setScaleResult] = useState<ScaleResult | null>(null);

  const [saving, setSaving] = useState(false);

  const canContinueName = name.trim().length > 0;
  const canContinueBasics = Number(age) > 0 && Number(height) > 0 && Number(weight) > 0;
  const canContinueWeightGoal = Number(weightGoal) > 0;
  const displayName = name.trim();
  const wantsToLose = Number(weightGoal) > 0 && Number(weight) > 0 && Number(weightGoal) < Number(weight);

  const goals = computeGoals({
    sex,
    age: Number(age) || 25,
    heightCm: Number(height) || 170,
    weightLb: Number(scaleResult?.peso_lb || weight) || 180,
    weightGoalLb: Number(weightGoal) || 165,
    activityLevel,
    bmrOverride: scaleResult?.bmr,
  });

  const onPickPhoto = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      setEditorSrc(await fileToDataURL(file));
    } catch {
      showToast(t("perfil.photoLoadError"));
    }
  };

  const readScale = async (imageUrl: string) => {
    setScaleBusy(true);
    setScaleError(null);
    try {
      const res = await analyze<ScaleResult>({ mode: "scale", image: imageUrl });
      setScaleResult(res);
      if (res.peso_lb > 0) setWeight(String(Math.round(res.peso_lb)));
    } catch (e) {
      setScaleError(e instanceof Error ? e.message : t("entrenamiento.errCaptureFailed"));
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
        photo,
        goalMotivation: goalMotivation.trim(),
        sex,
        age: Number(age) || 25,
        height: Number(height) || 170,
        weight: Number(scaleResult?.peso_lb || weight) || 180,
        weightGoal: Number(weightGoal) || 165,
        activityLevel,
        exercisePlan: exercisePlan.trim(),
        foodCulture: foodCulture.trim(),
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
      showToast(t("onboarding.toastFinished", { name: name.trim() || t("onboarding.defaultWelcomeName") }));
      onFinished?.();
    } catch {
      showToast(t("onboarding.toastSaveError"));
      setSaving(false);
    }
  };

  const next = () => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div style={{ minHeight: "100dvh", boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "calc(24px + env(safe-area-inset-top)) 22px calc(24px + env(safe-area-inset-bottom))" }}>
      {editorSrc && (
        <AvatarEditor
          src={editorSrc}
          onCancel={() => setEditorSrc(null)}
          onSave={(url) => {
            setPhoto(url);
            setEditorSrc(null);
          }}
        />
      )}

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

      <div style={stepStyle}>
        <AnimatePresence mode="popLayout" initial={false}>
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={stepStyle}>
              <MascotIllustration art="bienvenida" height={132} style={{ marginBottom: 10 }} />
              <div className="font-sora" style={heroTitleStyle}>
                {t("onboarding.s0Title")}
              </div>
              <div style={{ ...subtitleStyle, fontSize: 13, color: "rgba(244,243,238,.6)", marginTop: 8, marginBottom: 24 }}>
                {t("onboarding.s0Subtitle")}
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
                <div
                  onClick={() => {
                    if (photo) setEditorSrc(photo);
                    else photoInputRef.current?.click();
                  }}
                  style={{
                    width: 92,
                    height: 92,
                    borderRadius: "50%",
                    padding: 2,
                    background: "linear-gradient(135deg,#a6f06a,#39c9a3)",
                    cursor: "pointer",
                    position: "relative",
                  }}
                >
                  <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "#1b1e21", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={t("perfil.yourPhoto")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Icon name="user" size={36} />
                    )}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      right: -2,
                      bottom: -2,
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "#c7f27a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 0 10px rgba(199,242,122,.5)",
                    }}
                  >
                    <Icon name="camera" size={15} />
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      onPickPhoto(file);
                    }}
                  />
                </div>
              </div>
              <div style={{ ...labelStyle, marginBottom: 8, textAlign: "center" }}>{t("onboarding.sex")}</div>
              <div style={{ display: "flex", gap: 8 }}>
                {(
                  [
                    { value: "M", label: t("ajustes.male") },
                    { value: "F", label: t("ajustes.female") },
                  ] as const
                ).map((s) => (
                  <Pressable
                    key={s.value}
                    onClick={() => setSex(s.value)}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "12px 0",
                      borderRadius: 18,
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
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={stepStyle}>
              <MascotIllustration art="saludo-guapo" height={158} style={{ marginBottom: 12 }} />
              <div className="font-sora" style={heroTitleStyle}>
                {sex === "F" ? t("onboarding.s1TitleF") : t("onboarding.s1TitleM")}
              </div>
              <div style={{ ...subtitleStyle, fontSize: 13, color: "rgba(244,243,238,.6)", marginTop: 8, marginBottom: 0 }}>
                {sex === "F" ? t("onboarding.s1SubtitleF") : t("onboarding.s1SubtitleM")}
              </div>
              <div style={{ marginTop: 32 }}>
                <div style={{ ...labelStyle, textAlign: "center" }}>{t("onboarding.nameLabel")}</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("onboarding.namePlaceholder")}
                  autoFocus
                  style={{ ...fieldStyle, fontSize: 16 }}
                  onKeyDown={(e) => e.key === "Enter" && canContinueName && next()}
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={stepStyle}>
              <div className="font-sora" style={titleStyle}>
                {displayName ? t("onboarding.s2TitleNamed", { name: displayName }) : t("onboarding.s2Title")}
              </div>
              <div style={subtitleStyle}>
                {t("onboarding.s2Subtitle")}
              </div>
              <PresetChips
                options={motivationPresets(t)}
                selected={goalMotivation}
                onSelect={setGoalMotivation}
                renderIcon={(opt) => <div style={{ fontSize: 18, flex: "none" }}>{opt.emoji}</div>}
              />
              {/* La hamaca va abajo y completa: arriba quedaba apretada y
                  cortada. Sin el campo de texto libre, aquí sobra espacio. */}
              <MascotIllustration art="motivo" height={150} glow={false} style={{ marginTop: 6 }} />
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={stepStyle}>
              <MascotIllustration art="numeros" height={150} style={{ marginBottom: 8 }} />
              <div className="font-sora" style={titleStyle}>
                {t("onboarding.s3Title")}
              </div>
              <div style={subtitleStyle}>
                {t("onboarding.s3Subtitle")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={labelStyle}>{t("ajustes.age")}</div>
                  <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" style={fieldStyle} autoFocus />
                </div>
                <div>
                  <div style={labelStyle}>{t("ajustes.height")}</div>
                  <input type="number" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" style={fieldStyle} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={labelStyle}>{t("ajustes.currentWeight")}</div>
                  <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="180" style={fieldStyle} />
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={stepStyle}>
              <MascotIllustration art="meta-peso" height={172} style={{ marginBottom: 8 }} />
              <div className="font-sora" style={titleStyle}>
                {t("onboarding.s4Title")}
              </div>
              <div style={subtitleStyle}>
                {t("onboarding.s4Subtitle")}
              </div>
              <div style={{ ...labelStyle, textAlign: "center" }}>{t("onboarding.goalWeightLabel")}</div>
              <input type="number" inputMode="decimal" value={weightGoal} onChange={(e) => setWeightGoal(e.target.value)} placeholder="165" style={{ ...fieldStyle, fontSize: 18, textAlign: "center" }} autoFocus />
              {Number(weightGoal) > 0 && Number(weight) > 0 && (
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(244,243,238,.5)", textAlign: "center" }}>
                  {Number(weightGoal) < Number(weight)
                    ? t("onboarding.goalLose", { lb: r1(Number(weight) - Number(weightGoal)) })
                    : Number(weightGoal) > Number(weight)
                    ? t("onboarding.goalGain", { lb: r1(Number(weightGoal) - Number(weight)) })
                    : t("onboarding.goalMaintain")}
                </div>
              )}
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={stepStyle}>
              <MascotIllustration art="actividad" height={150} style={{ marginBottom: 8 }} />
              <div className="font-sora" style={titleStyle}>
                {t("onboarding.s5Title")}
              </div>
              <div style={subtitleStyle}>
                {t("onboarding.s5Subtitle")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {getActivityOptions(t).map((opt) => {
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
                        borderRadius: 18,
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

          {step === 6 && (
            <motion.div key="s6" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={stepStyle}>
              <div className="font-sora" style={titleStyle}>
                {t("onboarding.s6Title")}
              </div>
              <div style={subtitleStyle}>
                {t("onboarding.s6Subtitle")}
              </div>
              <PresetChips options={exercisePresets(t)} selected={exercisePlan} onSelect={setExercisePlan} renderIcon={(opt) => iconFor(opt.icon, 22)} />
              <div style={{ ...labelStyle, textAlign: "center" }}>{t("onboarding.ownWordsLabel")}</div>
              <textarea
                value={exercisePlan}
                onChange={(e) => setExercisePlan(e.target.value)}
                placeholder={t("onboarding.exercisePlaceholder")}
                rows={3}
                style={{ ...fieldStyle, resize: "none", fontFamily: "inherit" }}
              />
            </motion.div>
          )}

          {step === 7 && (
            <motion.div key="s7" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={stepStyle}>
              <MascotIllustration art="bascula" height={165} style={{ marginBottom: 8 }} />
              <div className="font-sora" style={titleStyle}>
                {t("onboarding.s7Title")}
              </div>
              <div style={subtitleStyle}>
                {t("onboarding.s7SubtitlePre")}<b style={{ color: "#c7f27a" }}>{t("onboarding.s7SubtitleBold")}</b>{t("onboarding.s7SubtitlePost")}
              </div>
              <UploadCard
                title={t("onboarding.scaleCardTitle")}
                subtitle={t("onboarding.scaleCardSubtitle")}
                icon="/icons/glyphs/smart-scale.png"
                lastUpdated={scaleResult ? { timestamp: t("onboarding.scaleReadyTimestamp"), label: t("onboarding.scaleReadyLabel") } : undefined}
                isUpdated={!!scaleResult}
                busy={scaleBusy}
                busyMessages={[t("onboarding.scaleBusy1"), t("onboarding.scaleBusy2"), t("onboarding.scaleBusy3")]}
                onImage={readScale}
              />
              {scaleError && (
                <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)", background: "rgba(230,120,60,.1)", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(230,120,60,.2)" }}>
                  {scaleError}
                </div>
              )}
              {scaleResult && (
                <div style={{ marginTop: 12, fontSize: 12.5, color: "#c7f27a", fontWeight: 700 }}>
                  {t("onboarding.scaleDetected", {
                    lb: Math.round(scaleResult.peso_lb),
                    bmr: scaleResult.bmr ? t("onboarding.scaleDetectedBmr", { bmr: Math.round(scaleResult.bmr) }) : "",
                  })}
                </div>
              )}
            </motion.div>
          )}

          {step === 8 && (
            <motion.div key="s8" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} style={stepStyle}>
              <div className="font-sora" style={titleStyle}>
                {displayName ? t("onboarding.s8TitleNamed", { name: displayName }) : t("onboarding.s8Title")}
              </div>
              <div style={{ ...subtitleStyle, marginBottom: 12 }}>
                {t("onboarding.s8SubtitleTemplate", {
                  source: scaleResult?.bmr ? t("onboarding.s8SubtitleScale") : t("onboarding.s8SubtitleEstimated"),
                  goalNote: goalMotivation ? t("onboarding.s8SubtitleGoalNote") : t("onboarding.s8SubtitleNoGoalNote"),
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div style={{ background: "#1b1e21", borderRadius: 18, padding: 12, textAlign: "center" }}>
                  <div style={labelStyle}>BMR</div>
                  <div className="font-sora" style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{goals.bmr.toLocaleString()} kcal</div>
                </div>
                <div style={{ background: "#1b1e21", borderRadius: 18, padding: 12, textAlign: "center" }}>
                  <div style={labelStyle}>TDEE</div>
                  <div className="font-sora" style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{goals.tdee.toLocaleString()} kcal</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "rgba(244,243,238,.4)", marginBottom: 10, lineHeight: 1.4, textAlign: "center" }}>
                {wantsToLose ? t("onboarding.explainDeficit") : t("onboarding.explainMaintain")}
              </div>
              <div style={{ background: "#1b1e21", borderRadius: 20, padding: 16 }}>
                {[
                  { label: t("onboarding.rowCalories"), value: `${goals.metaKcal.toLocaleString()} kcal`, color: "#c7f27a" },
                  { label: t("onboarding.rowProteinMin"), value: `${goals.metaProtein}g`, color: "oklch(72% 0.15 250)" },
                  { label: t("onboarding.rowCarbsMax"), value: `${goals.metaCarbs}g`, color: "oklch(78% 0.15 85)" },
                  { label: t("onboarding.rowFatMax"), value: `${goals.metaFat}g`, color: "oklch(72% 0.15 40)" },
                  { label: t("onboarding.rowWater"), value: `${goals.metaWater.toLocaleString()} ml`, color: "oklch(70% 0.13 220)" },
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
              {/* Cierra celebrando. Va con el borde inferior recortado para
                  que asome por detrás del botón "Empezar" sin taparlo, pero
                  con la cabeza siempre completa a la vista. */}
              <MascotIllustration art="bienvenida" height={112} style={{ marginTop: 6, marginBottom: -14 }} />
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
              borderRadius: 22,
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
        {step === 7 && !scaleResult && (
          <Pressable
            onClick={next}
            style={{
              flex: 1,
              textAlign: "center",
              padding: 16,
              borderRadius: 22,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              background: "#1b1e21",
              color: "rgba(244,243,238,.6)",
            }}
          >
            {t("onboarding.skipForNow")}
          </Pressable>
        )}
        <Pressable
          onClick={() => {
            if (step === 1 && !canContinueName) return;
            if (step === 3 && !canContinueBasics) return;
            if (step === 4 && !canContinueWeightGoal) return;
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
            borderRadius: 22,
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            background:
              (step === 1 && !canContinueName) || (step === 3 && !canContinueBasics) || (step === 4 && !canContinueWeightGoal) || saving
                ? "rgba(199,242,122,.3)"
                : "#c7f27a",
            color: "#10240a",
            boxShadow: "0 0 20px rgba(199,242,122,.4)",
          }}
        >
          {saving ? t("onboarding.saving") : step === TOTAL_STEPS - 1 ? t("onboarding.start") : t("onboarding.continue")}
        </Pressable>
      </div>
    </div>
  );
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}
