"use client";

// Perfil · Vista 1 "Mi progreso": solo lo que se MIRA — metabolismo,
// tendencia de peso y composición corporal. Todo lo que se CONFIGURA vive
// en /perfil/ajustes, para que esta pantalla no sea un muro de formularios.

import { useState } from "react";
import Pressable from "@/components/Pressable";
import InfoModal from "@/components/InfoModal";
import { ProfileFooter, ProfileHeader, ProfileTabs, sectionTitle } from "@/components/profileUi";
import { useApp } from "@/lib/store";
import { ACTIVITY_FACTORS, MeasurementEntry, WeightEntry } from "@/lib/types";
import { mifflinBMR } from "@/lib/nutrition";

type MeasureField = "armCm" | "waistCm" | "chestCm" | "legCm";

// Último valor + cuánto cambió desde la anotación anterior QUE TENÍA ese
// mismo campo (una entrada puede traer solo alguna de las 4 medidas).
function measureTrend(measurements: MeasurementEntry[], field: MeasureField): { value: number; delta: number; hasPrev: boolean } | null {
  const withValue = measurements.filter((m) => m[field] != null);
  if (!withValue.length) return null;
  const latest = withValue[withValue.length - 1];
  const prev = withValue.length >= 2 ? withValue[withValue.length - 2] : null;
  const value = latest[field] as number;
  const delta = prev ? Math.round((value - (prev[field] as number)) * 10) / 10 : 0;
  return { value, delta, hasPrev: !!prev };
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

export default function PerfilProgreso() {
  const { profile, weights, bodyComp, measurements } = useApp();
  const [range, setRange] = useState<"days" | "weeks">("days");
  const [infoModal, setInfoModal] = useState<"bmr" | "tdee" | null>(null);

  const bmr = bodyComp?.bmr || mifflinBMR(profile.weight, profile.height, profile.age, profile.sex);
  const tdee = Math.round(bmr * ACTIVITY_FACTORS[profile.activityLevel]);

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

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 0" }}>
      <ProfileHeader />
      <ProfileTabs />

      {/* El atajo al resumen del día se movió a Hoy — tiene más sentido ahí,
          junto al resto de lo que pasa hoy, que en Perfil. */}

      {/* Metabolismo */}
      <div style={{ ...sectionTitle, marginTop: 18 }}>TU METABOLISMO</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {(
          [
            { key: "bmr" as const, label: "BMR", value: bmr },
            { key: "tdee" as const, label: "TDEE", value: tdee },
          ]
        ).map((m) => (
          <div key={m.key} style={{ background: "#1b1e21", borderRadius: 20, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 11, color: "rgba(244,243,238,.45)", fontWeight: 700 }}>{m.label}</div>
              <Pressable
                onClick={() => setInfoModal(m.key)}
                tapScale={0.85}
                ariaLabel={`Qué es el ${m.label}`}
                style={{
                  width: 22,
                  height: 22,
                  flex: "none",
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
            <div className="font-sora" style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
              {m.value.toLocaleString()} kcal
            </div>
          </div>
        ))}
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
      <div style={{ background: "#1b1e21", borderRadius: 20, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["days", "weeks"] as const).map((r) => (
            <Pressable
              key={r}
              onClick={() => setRange(r)}
              style={{
                flex: 1,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
                borderRadius: 100,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                background: range === r ? "#c7f27a" : "#232527",
                color: range === r ? "#10240a" : "rgba(244,243,238,.6)",
              }}
            >
              {r === "days" ? "Días" : "Semanas"}
            </Pressable>
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
            Sube tu peso (en Ajustes o con la báscula) y verás tu progreso.
          </div>
        )}
      </div>

      {/* Historial de medidas: brazo, cintura, pecho, pierna — se cargan a
          mano en Sincronización; acá solo se reflejan (subió/bajó). */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em" }}>HISTORIAL DE MEDIDAS</div>
      </div>
      <div style={{ background: "#1b1e21", borderRadius: 20, padding: 14 }}>
        {measurements.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {(
              [
                { field: "armCm" as const, label: "Brazo" },
                { field: "waistCm" as const, label: "Cintura" },
                { field: "chestCm" as const, label: "Pecho" },
                { field: "legCm" as const, label: "Pierna" },
              ]
            ).map((m) => {
              const t = measureTrend(measurements, m.field);
              return (
                <div key={m.field} style={{ background: "#232527", borderRadius: 16, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(244,243,238,.45)" }}>{m.label.toUpperCase()}</div>
                  {t ? (
                    <>
                      <div className="font-sora" style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                        {t.value}
                        <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(244,243,238,.4)" }}> cm</span>
                      </div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 2, color: !t.hasPrev ? "rgba(244,243,238,.4)" : t.delta === 0 ? "rgba(244,243,238,.4)" : "oklch(70% 0.13 220)" }}>
                        {!t.hasPrev ? "Primera medida" : t.delta === 0 ? "Sin cambio" : `${t.delta > 0 ? "↑" : "↓"} ${Math.abs(t.delta)} cm`}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: "rgba(244,243,238,.35)", marginTop: 6 }}>Sin datos</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", fontSize: 12, color: "rgba(244,243,238,.45)", padding: "10px 0" }}>
            Anota tus medidas en <b style={{ color: "#c7f27a" }}>Sincronización</b> y aquí verás si subieron o bajaron.
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
      <div style={{ background: "#1b1e21", borderRadius: 20, padding: 18 }}>
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
            Sube una captura de tu báscula desde <b style={{ color: "#c7f27a" }}>Ajustes</b> y aquí verás tu composición
            corporal completa.
          </div>
        )}
      </div>

      <ProfileFooter />
    </div>
  );
}
