"use client";

// Perfil · Vista 2 "Ajustes": todo lo que se CONFIGURA — datos personales,
// nivel de actividad, metas, contexto para el Coach, plan de ejercicio y la
// conexión con reloj/báscula. Lo que solo se mira vive en /perfil.

import { useRouter } from "next/navigation";
import { useState } from "react";
import UploadCard from "@/components/UploadCard";
import { ActionButton } from "@/components/ImageUploadZone";
import Pressable from "@/components/Pressable";
import Icon from "@/components/Icon";
import {
  ACTIVITY_OPTIONS,
  ProfileFooter,
  ProfileHeader,
  ProfileTabs,
  ScaleResult,
  cardStyle,
  fmtStamp,
  labelStyle,
  notesTextarea,
  numInput,
  r1,
  sectionTitle,
} from "@/components/profileUi";
import { analyze } from "@/lib/analyze";
import { useApp } from "@/lib/store";
import { ACTIVITY_FACTORS, todayISO } from "@/lib/types";
import { computeGoals, macrosForKcal } from "@/lib/nutrition";

export default function PerfilAjustes() {
  const router = useRouter();
  const app = useApp();
  const { profile, saveProfile, bodyComp, setActivity, activity, showToast, userEmail, signOut } = app;

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

  const [healthBusy, setHealthBusy] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthUpdatedAt, setHealthUpdatedAt] = useState<Date | null>(null);

  const [scaleParsed, setScaleParsed] = useState<ScaleResult | null>(null);
  const [scaleBusy, setScaleBusy] = useState(false);
  const [scaleError, setScaleError] = useState<string | null>(null);
  const [scaleUpdatedAt, setScaleUpdatedAt] = useState<Date | null>(null);

  // Los campos de metas son "no controlados" (defaultValue): al recalcularlos
  // por código hay que remontarlos con una key nueva para que muestren el
  // valor nuevo en vez del que el usuario tenía escrito.
  const [metasVersion, setMetasVersion] = useState(0);

  const readScaleCapture = async (shot: string) => {
    setScaleBusy(true);
    setScaleError(null);
    try {
      const res = await analyze<ScaleResult>({ mode: "scale", image: shot });
      setScaleParsed(res);
    } catch (e) {
      setScaleError(e instanceof Error ? e.message : "No se pudo leer la captura");
    } finally {
      setScaleBusy(false);
    }
  };

  const onScaleImage = (url: string) => {
    setScaleParsed(null);
    readScaleCapture(url);
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
    setScaleUpdatedAt(new Date());
    showToast("Perfil actualizado desde tu báscula");
  };

  const readHealthCapture = async (shot: string) => {
    setHealthBusy(true);
    setHealthError(null);
    try {
      const res = await analyze<{
        pasos: number;
        min_activos: number;
        kcal_activas: number;
        kcal_totales: number;
        distancia_km: number;
      }>({ mode: "activity", image: shot });
      await setActivity({
        steps: Math.round(res.pasos) || 0,
        activeMin: Math.round(res.min_activos) || 0,
        activityKcal: Math.round(res.kcal_activas) || 0,
        totalKcal: Math.round(res.kcal_totales) || 0,
        distance: Math.round((res.distancia_km || 0) * 100) / 100,
        synced: true,
      });
      setHealthUpdatedAt(new Date());
      showToast("Actividad actualizada desde tu captura");
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : "No se pudo leer la captura");
    } finally {
      setHealthBusy(false);
    }
  };

  const setField = (field: keyof typeof profile, value: string | number) => {
    saveProfile({ ...profile, [field]: value });
  };

  const setNumField = (field: keyof typeof profile) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value);
    if (Number.isNaN(n)) return;
    // Al cambiar las calorías a mano, los macros se reparten de nuevo sobre
    // ese total: si bajas las kcal y la grasa/carbos se quedan igual, el
    // reparto deja de cuadrar (sumarían más de lo que puedes comer).
    if (field === "metaKcal" && n > 0) {
      saveProfile({ ...profile, metaKcal: n, ...macrosForKcal(n, profile.weightGoal) });
      setMetasVersion((v) => v + 1);
      showToast("Metas ajustadas a tus nuevas calorías");
      return;
    }
    setField(field, n);
  };

  const recalcMetas = () => {
    const goals = computeGoals({
      sex: profile.sex,
      age: profile.age,
      heightCm: profile.height,
      weightLb: profile.weight,
      weightGoalLb: profile.weightGoal,
      activityLevel: profile.activityLevel,
      bmrOverride: bodyComp?.bmr,
    });
    saveProfile({
      ...profile,
      metaKcal: goals.metaKcal,
      metaProtein: goals.metaProtein,
      metaCarbs: goals.metaCarbs,
      metaFat: goals.metaFat,
      metaWater: goals.metaWater,
    });
    setMetasVersion((v) => v + 1);
    showToast("Metas recalculadas con tus datos");
  };

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 0" }}>
      <ProfileHeader />
      <ProfileTabs />

      {/* Datos personales */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em" }}>DATOS PERSONALES</div>
        <Pressable
          onClick={saveDatos}
          tapScale={0.9}
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: "10px 18px",
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
          <input type="number" inputMode="numeric" value={draft.age} onChange={(e) => setDraft({ ...draft, age: e.target.value })} style={numInput} />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>ALTURA (cm)</div>
          <input type="number" inputMode="numeric" value={draft.height} onChange={(e) => setDraft({ ...draft, height: e.target.value })} style={numInput} />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>PESO ACTUAL (lb)</div>
          <input type="number" inputMode="decimal" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} style={numInput} />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>PESO META (lb)</div>
          <input type="number" inputMode="decimal" value={draft.weightGoal} onChange={(e) => setDraft({ ...draft, weightGoal: e.target.value })} style={numInput} />
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
              <Pressable
                key={s.value}
                onClick={() => saveProfile({ ...profile, sex: s.value })}
                style={{
                  flex: 1,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: profile.sex === s.value ? "#c7f27a" : "rgba(255,255,255,.06)",
                  color: profile.sex === s.value ? "#10240a" : "rgba(244,243,238,.6)",
                }}
              >
                {s.label}
              </Pressable>
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
                borderRadius: 18,
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
              borderRadius: 18,
              padding: "12px 14px",
              minHeight: 44,
              boxSizing: "border-box",
            }}
          >
            <span style={{ fontSize: 13, color: "rgba(244,243,238,.6)", flex: "none", whiteSpace: "nowrap" }}>{m.label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, justifyContent: "flex-end", minWidth: 0 }}>
              <input
                key={`${m.field}-${metasVersion}`}
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
        <div style={{ display: "flex", justifyContent: "space-between", background: "#1b1e21", borderRadius: 18, padding: "12px 14px" }}>
          <span style={{ fontSize: 13, color: "rgba(244,243,238,.6)" }}>Sueño</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>7–8 h</span>
        </div>
        <Pressable
          onClick={recalcMetas}
          style={{
            textAlign: "center",
            padding: "13px 14px",
            borderRadius: 18,
            fontSize: 12.5,
            fontWeight: 800,
            cursor: "pointer",
            background: "rgba(199,242,122,.1)",
            border: "1px solid rgba(199,242,122,.3)",
            color: "#c7f27a",
          }}
        >
          Recalcular con mis datos
        </Pressable>
        <div style={{ fontSize: 11, color: "rgba(244,243,238,.4)", lineHeight: 1.4, padding: "0 2px" }}>
          Vuelve a calcular calorías, macros y agua desde tu peso, altura, edad y nivel de actividad. El agua sale de tu
          peso (~35 ml por kg), no es un número fijo.
        </div>
      </div>

      {/* Sobre ti: le da tono al Coach y hace sus consejos más realistas */}
      <div style={sectionTitle}>SOBRE TI</div>
      <div style={{ ...labelStyle, marginBottom: 4 }}>TU MOTIVO</div>
      <textarea
        defaultValue={profile.goalMotivation}
        onBlur={(e) => {
          if (e.target.value !== profile.goalMotivation) saveProfile({ ...profile, goalMotivation: e.target.value });
        }}
        placeholder="Ej. bajar de peso"
        rows={1}
        style={notesTextarea}
      />
      <div style={{ ...labelStyle, marginTop: 8, marginBottom: 4 }}>CÓMO COMES NORMALMENTE</div>
      <textarea
        defaultValue={profile.foodCulture}
        onBlur={(e) => {
          if (e.target.value !== profile.foodCulture) saveProfile({ ...profile, foodCulture: e.target.value });
        }}
        placeholder="Ej. pupusas casi a diario"
        rows={1}
        style={notesTextarea}
      />

      {/* Plan de ejercicio */}
      <div style={{ ...sectionTitle, marginTop: 20 }}>TU PLAN DE EJERCICIO</div>
      <textarea
        defaultValue={profile.exercisePlan}
        onBlur={(e) => {
          if (e.target.value !== profile.exercisePlan) saveProfile({ ...profile, exercisePlan: e.target.value });
        }}
        placeholder="Ej. camino 1 hora al día"
        rows={1}
        style={notesTextarea}
      />
      <Pressable
        onClick={() => router.push("/rutina")}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1b1e21", borderRadius: 18, padding: "12px 14px", marginTop: 8, minHeight: 44, boxSizing: "border-box", cursor: "pointer" }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>Ejercicios de pesas (Push / Pull / Legs)</span>
        <span style={{ fontSize: 11, color: "rgba(244,243,238,.4)" }}>Editar ›</span>
      </Pressable>

      {/* Conexión con reloj y báscula */}
      <div style={sectionTitle}>RELOJ Y BÁSCULA</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <UploadCard
          title="Actividad del reloj"
          subtitle="kcal · pasos · tiempo"
          icon="/icons/glyphs/watch-activity.png"
          lastUpdated={
            healthUpdatedAt
              ? { timestamp: fmtStamp(healthUpdatedAt), label: "Actualizado" }
              : activity?.synced
              ? { timestamp: "hoy", label: "Actualizado" }
              : undefined
          }
          isUpdated={!!healthUpdatedAt || !!activity?.synced}
          busy={healthBusy}
          busyMessages={["Leyendo tu captura…", "Buscando pasos y calorías…", "Recopilando todos tus datos…", "Casi listo…"]}
          onImage={readHealthCapture}
        />
        {healthError && (
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)", background: "rgba(230,120,60,.1)", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(230,120,60,.2)" }}>
            {healthError}
          </div>
        )}

        <UploadCard
          title="Báscula inteligente"
          subtitle="peso · grasa · IMC"
          icon="/icons/glyphs/smart-scale.png"
          lastUpdated={
            scaleUpdatedAt
              ? { timestamp: fmtStamp(scaleUpdatedAt), label: "Actualizado" }
              : bodyComp
              ? { timestamp: `${bodyComp.date.slice(8, 10)}/${bodyComp.date.slice(5, 7)}`, label: "Actualizado" }
              : undefined
          }
          isUpdated={(!!scaleUpdatedAt || !!bodyComp) && !scaleParsed}
          busy={scaleBusy}
          busyMessages={["Leyendo tu captura…", "Recopilando todos tus datos…", "Extrayendo peso, IMC y composición…", "Casi listo…"]}
          onImage={onScaleImage}
        />
        {scaleError && (
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)", background: "rgba(230,120,60,.1)", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(230,120,60,.2)" }}>
            {scaleError}
          </div>
        )}
      </div>

      {/* Datos detectados por la báscula: preview antes de confirmar */}
      {scaleParsed && (
        <>
          <div style={{ marginTop: 14, background: "#1b1e21", borderRadius: 18, padding: 14 }}>
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
          <ActionButton label="Actualizar mi perfil" onClick={applyScale} busy={false} />
        </>
      )}

      {/* Control de acceso (solo admin) */}
      {profile.isAdmin && (
        <Pressable
          onClick={() => router.push("/admin")}
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(199,242,122,.08)",
            border: "1px solid rgba(199,242,122,.25)",
            borderRadius: 20,
            padding: "14px 16px",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: "#c7f27a" }}>
            <Icon name="premium" size={18} /> Control de acceso
          </span>
          <span style={{ fontSize: 11, color: "rgba(244,243,238,.4)" }}>Aprobar usuarios ›</span>
        </Pressable>
      )}

      {/* Cerrar sesión */}
      {userEmail && (
        <Pressable
          onClick={signOut}
          style={{
            marginTop: 24,
            textAlign: "center",
            padding: 14,
            borderRadius: 20,
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

      <ProfileFooter />
    </div>
  );
}
