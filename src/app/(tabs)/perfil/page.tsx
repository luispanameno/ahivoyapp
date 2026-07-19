"use client";

// Perfil: datos y metas editables, historial de peso, composición corporal,
// actividad del reloj por captura, báscula por captura, invitar familia.

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import ImageDrop from "@/components/ImageDrop";
import { analyze, fileToDataURL } from "@/lib/analyze";
import { resizeToAvatar } from "@/lib/image";
import { useApp } from "@/lib/store";
import { WeightEntry } from "@/lib/types";

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

function mifflinBMR(weightLb: number, heightCm: number, age: number): number {
  const kg = weightLb * 0.4536;
  return Math.round(10 * kg + 6.25 * heightCm - 5 * age + 5);
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
  const [healthShot, setHealthShot] = useState<string | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const setField = (field: keyof typeof profile, value: string | number) => {
    saveProfile({ ...profile, [field]: value });
  };

  const setNumField = (field: keyof typeof profile) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value);
    if (!Number.isNaN(n)) setField(field, n);
  };

  const bmr = bodyComp?.bmr || mifflinBMR(profile.weight, profile.height, profile.age);
  const tdee = Math.round(bmr * 1.35);

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
          ...(bodyComp.bmr >= mifflinBMR(profile.weight, profile.height, profile.age) * 0.95
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

  const invite = async () => {
    const url = window.location.origin;
    const text = `Te invito a AHIVOYAPP 🥗 crea tu cuenta y lleva tus calorías con IA: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "AHIVOYAPP", text, url });
        return;
      } catch {
        // usuario canceló
      }
    } else {
      await navigator.clipboard.writeText(text);
      showToast("Link copiado — pégalo donde quieras");
    }
  };

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 0" }}>
      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          onClick={() => photoInputRef.current?.click()}
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
                const raw = await fileToDataURL(file);
                const small = await resizeToAvatar(raw);
                await saveProfile({ ...profile, photo: small });
                showToast("Foto de perfil actualizada");
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
      <div style={{ ...sectionTitle, marginTop: 22 }}>DATOS PERSONALES</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>EDAD</div>
          <input type="number" inputMode="numeric" defaultValue={profile.age} onBlur={setNumField("age")} style={numInput} />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>ALTURA (cm)</div>
          <input type="number" inputMode="numeric" defaultValue={profile.height} onBlur={setNumField("height")} style={numInput} />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>PESO ACTUAL (lb)</div>
          <input
            type="number"
            inputMode="decimal"
            defaultValue={profile.weight}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n) && n > 0) app.setWeight(n);
            }}
            style={numInput}
          />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>PESO META (lb)</div>
          <input type="number" inputMode="decimal" defaultValue={profile.weightGoal} onBlur={setNumField("weightGoal")} style={numInput} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <div style={{ background: "#1b1e21", borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 11, color: "rgba(244,243,238,.45)", fontWeight: 700 }}>BMR</div>
          <div className="font-sora" style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{bmr.toLocaleString()} kcal</div>
        </div>
        <div style={{ background: "#1b1e21", borderRadius: 16, padding: 14 }}>
          <div style={{ fontSize: 11, color: "rgba(244,243,238,.45)", fontWeight: 700 }}>TDEE</div>
          <div className="font-sora" style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{tdee.toLocaleString()} kcal</div>
        </div>
      </div>

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
          <div key={m.field} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1b1e21", borderRadius: 14, padding: "12px 14px" }}>
            <span style={{ fontSize: 13, color: "rgba(244,243,238,.6)" }}>{m.label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <input
                type="number"
                inputMode="numeric"
                defaultValue={profile[m.field]}
                onBlur={setNumField(m.field)}
                style={{ ...numInput, width: 64, textAlign: "right", marginTop: 0, fontSize: 13 }}
              />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{m.suffix}</span>
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
      <ImageDrop placeholder="Toca para subir la captura de tu app de salud (kcal, pasos)" height={120} radius={14} onImage={setHealthShot} />
      {healthError && <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)" }}>{healthError}</div>}
      <div
        onClick={readHealthCapture}
        style={{
          background: "#c7f27a",
          color: "#10240a",
          textAlign: "center",
          padding: 13,
          borderRadius: 14,
          fontWeight: 800,
          fontSize: 12.5,
          marginTop: 10,
          cursor: "pointer",
          opacity: healthBusy ? 0.6 : 1,
          boxShadow: "0 0 16px rgba(199,242,122,.45)",
        }}
      >
        {healthBusy ? "Leyendo captura…" : "Actualizar actividad desde la captura"}
      </div>
      {activity?.synced && (
        <div
          style={{
            marginTop: 10,
            background: "rgba(199,242,122,.1)",
            border: "1px solid rgba(199,242,122,.3)",
            borderRadius: 14,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#c7f27a", boxShadow: "0 0 8px #c7f27a", flex: "none" }} />
          <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "#c7f27a" }}>
            Actualizado · {activity.steps.toLocaleString()} pasos · {activity.activityKcal} kcal activas hoy
          </div>
        </div>
      )}

      {/* Báscula */}
      <div style={sectionTitle}>BÁSCULA INTELIGENTE</div>
      <div
        onClick={() => router.push("/bascula")}
        style={{ borderRadius: 14, padding: 12, textAlign: "center", fontSize: 12, fontWeight: 700, cursor: "pointer", background: "#1b1e21", color: "rgba(244,243,238,.7)" }}
      >
        📸 Sube una captura de tu báscula
      </div>
      <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.4)", marginTop: 6, textAlign: "center" }}>
        Funciona con cualquier marca (Zepp Life, Renpho, etc.)
      </div>

      {/* Invitar familia */}
      <div style={{ marginTop: 20, background: "linear-gradient(135deg,#c7f27a,#8fd15a)", borderRadius: 16, padding: 16, color: "#10240a" }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>Invita a familia y amigos a usar la app</div>
        <div style={{ fontSize: 11.5, marginTop: 4, opacity: 0.8, lineHeight: 1.4 }}>
          Envíales un link para que se creen su propia cuenta dentro de la app — cada quien pone su edad, peso, metas de
          calorías/macros y su propia rutina, sin afectar la tuya.
        </div>
        <div
          onClick={invite}
          style={{ marginTop: 10, background: "#10240a", color: "#c7f27a", display: "inline-block", padding: "8px 14px", borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          Compartir link de invitación
        </div>
      </div>

      {userEmail && (
        <div
          onClick={signOut}
          style={{ textAlign: "center", marginTop: 18, fontSize: 12, fontWeight: 700, color: "rgba(244,243,238,.5)", cursor: "pointer" }}
        >
          Cerrar sesión
        </div>
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
