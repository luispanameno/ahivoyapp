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
import { WEEKDAY_LETTERS } from "@/lib/i18n";

type MeasureField = "armCm" | "waistCm" | "chestCm" | "legCm" | "gluteCm";

function measureFields(t: (key: string) => string): { field: MeasureField; label: string }[] {
  return [
    { field: "armCm", label: t("perfil.measureArm") },
    { field: "waistCm", label: t("perfil.measureWaist") },
    { field: "chestCm", label: t("perfil.measureChest") },
    { field: "legCm", label: t("perfil.measureLeg") },
    { field: "gluteCm", label: t("perfil.measureGlute") },
  ];
}

// Serie de una sola medida (solo las anotaciones QUE TRAEN ese campo — una
// entrada puede venir con solo alguna de las 5). Se ordena por fecha, sin
// agrupar por día/semana como el peso: las medidas no se cargan seguido, así
// que cada anotación real es su propia barra.
function measureSeries(measurements: MeasurementEntry[], field: MeasureField): { labels: string[]; values: number[] } {
  const withValue = measurements.filter((m) => m[field] != null).slice(-6);
  return {
    labels: withValue.map((m) => `${m.date.slice(8, 10)}/${m.date.slice(5, 7)}`),
    values: withValue.map((m) => m[field] as number),
  };
}

// Mini tarjeta de UNA medida: valor actual + si subió/bajó + una barrita
// por cada anotación real (sin fechas debajo — a esta escala no caben, el
// número grande y la flecha ya dicen lo que hace falta).
function MeasureMiniCard({ label, values, t }: { label: string; values: number[]; t: (key: string) => string }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, max);
  const heights = values.map((v) => Math.round(20 + ((v - min) / Math.max(0.1, max - min)) * 80));
  const latest = values[values.length - 1];
  const delta = values.length >= 2 ? Math.round((latest - values[values.length - 2]) * 10) / 10 : 0;
  const trendLabel =
    values.length >= 2
      ? delta === 0
        ? t("perfil.noChange")
        : `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)} cm`
      : values.length === 1
      ? t("perfil.firstMeasurement")
      : t("perfil.noData");

  return (
    <div style={{ background: "#232527", borderRadius: 16, padding: "11px 12px" }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(244,243,238,.45)", letterSpacing: ".03em" }}>{label.toUpperCase()}</div>
      {values.length ? (
        <>
          <div className="font-sora" style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>
            {latest}
            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(244,243,238,.4)" }}> cm</span>
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 1, color: "oklch(70% 0.13 220)" }}>{trendLabel}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 26, marginTop: 8 }}>
            {heights.map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  maxWidth: 12,
                  borderRadius: "2px 2px 0 0",
                  background: "oklch(70% 0.13 220)",
                  height: `${h}%`,
                  boxShadow: "0 0 6px oklch(70% 0.13 220 / .4)",
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.35)", marginTop: 8 }}>{t("perfil.noData")}</div>
      )}
    </div>
  );
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

export default function PerfilProgreso() {
  const { profile, weights, bodyComp, measurements, t, lang } = useApp();
  const DAY_LETTERS = WEEKDAY_LETTERS[lang];
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
      ? `${delta <= 0 ? "↓" : "↑"} ${Math.abs(delta)} lb ${range === "days" ? t("perfil.weightTrendWeek") : t("perfil.weightTrendPeriod")}`
      : t("perfil.weightTrendNoData");
  const trendColor = delta <= 0 ? "oklch(78% 0.15 145)" : "oklch(75% 0.15 60)";

  const GREEN = { bg: "rgba(199,242,122,.15)", color: "#c7f27a" };
  const ORANGE = { bg: "rgba(230,150,60,.15)", color: "oklch(75% 0.15 60)" };
  const RED = { bg: "rgba(230,90,60,.15)", color: "oklch(72% 0.18 30)" };
  const bodyRows = bodyComp
    ? [
        {
          label: t("perfil.bmi"),
          value: String(bodyComp.bmi),
          ...(bodyComp.bmi < 25
            ? { badge: t("perfil.badgeNormal"), ...GREEN }
            : bodyComp.bmi < 30
            ? { badge: t("perfil.badgeHigh"), ...ORANGE }
            : { badge: t("perfil.badgeVeryHigh"), ...RED }),
        },
        {
          label: t("perfil.bodyFat"),
          value: `${bodyComp.fatPct}%`,
          ...(bodyComp.fatPct < 20
            ? { badge: t("perfil.badgeGood"), ...GREEN }
            : bodyComp.fatPct < 32
            ? { badge: t("perfil.badgeHigh"), ...ORANGE }
            : { badge: t("perfil.badgeVeryHigh"), ...RED }),
        },
        {
          label: t("perfil.waterLevel"),
          value: `${bodyComp.waterPct}%`,
          ...(bodyComp.waterPct >= 50 ? { badge: t("perfil.badgeNormal"), ...GREEN } : { badge: t("perfil.badgeInsufficient"), ...ORANGE }),
        },
        {
          label: t("perfil.proteinLevel"),
          value: `${bodyComp.proteinPct}%`,
          ...(bodyComp.proteinPct >= 16 ? { badge: t("perfil.badgeNormal"), ...GREEN } : { badge: t("perfil.badgeInsufficient"), ...ORANGE }),
        },
        {
          label: t("perfil.basalMetabolism"),
          value: `${bodyComp.bmr.toLocaleString()} kcal`,
          ...(bodyComp.bmr >= mifflinBMR(profile.weight, profile.height, profile.age, profile.sex) * 0.95
            ? { badge: t("perfil.badgeNormal"), ...GREEN }
            : { badge: t("perfil.badgeBelowIdeal"), ...ORANGE }),
        },
        {
          label: t("perfil.visceralFat"),
          value: String(bodyComp.visceralFat),
          ...(bodyComp.visceralFat < 10
            ? { badge: t("perfil.badgeNormal"), ...GREEN }
            : bodyComp.visceralFat < 15
            ? { badge: t("perfil.badgeHighF"), ...ORANGE }
            : { badge: t("perfil.badgeVeryHighF"), ...RED }),
        },
        { label: t("perfil.muscle"), value: `${bodyComp.muscle} lb`, badge: t("perfil.badgeGood"), ...GREEN },
        { label: t("perfil.boneMass"), value: `${bodyComp.boneMass} lb`, badge: t("perfil.badgeNormal"), ...GREEN },
      ]
    : [];

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 0" }}>
      <ProfileHeader />
      <ProfileTabs />

      {/* El atajo al resumen del día se movió a Hoy — tiene más sentido ahí,
          junto al resto de lo que pasa hoy, que en Perfil. */}

      {/* Metabolismo */}
      <div style={{ ...sectionTitle, marginTop: 18 }}>{t("perfil.metabolismTitle")}</div>
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
                ariaLabel={t("perfil.whatIs", { term: m.label })}
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

      <InfoModal open={infoModal === "bmr"} title={t("perfil.bmrTitle")} onClose={() => setInfoModal(null)}>
        {t("perfil.bmrBody")}
      </InfoModal>
      <InfoModal open={infoModal === "tdee"} title={t("perfil.tdeeTitle")} onClose={() => setInfoModal(null)}>
        {t("perfil.tdeeBody")}
      </InfoModal>

      {/* Historial de peso */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em" }}>{t("perfil.weightHistoryTitle")}</div>
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
              {r === "days" ? t("perfil.days") : t("perfil.weeks")}
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
            {t("perfil.weightEmpty")}
          </div>
        )}
      </div>

      {/* Historial de medidas: brazo, cintura, pecho, pierna, glúteos — se
          cargan a mano en Sincronización. Las 5 se ven a la vez (letras
          chicas, sin scroll) con su propia barrita chica debajo — así se
          compara todo de un vistazo, sin tener que elegir una por una. */}
      <div style={{ marginTop: 20, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em" }}>{t("perfil.measurementsTitle")}</div>
      </div>
      {measurements.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {measureFields(t).map((m) => (
            <MeasureMiniCard key={m.field} label={m.label} values={measureSeries(measurements, m.field).values} t={t} />
          ))}
        </div>
      ) : (
        <div style={{ background: "#1b1e21", borderRadius: 20, padding: "16px 14px", textAlign: "center", fontSize: 12, color: "rgba(244,243,238,.45)" }}>
          {t("perfil.measurementsEmpty", { sync: t("perfil.tabSync") })}
        </div>
      )}

      {/* Composición corporal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em" }}>{t("perfil.bodyCompTitle")}</div>
        <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.35)" }}>
          {bodyComp ? t("perfil.lastCapture", { date: `${bodyComp.date.slice(8, 10)}/${bodyComp.date.slice(5, 7)}` }) : t("perfil.noCaptureYet")}
        </div>
      </div>
      <div style={{ background: "#1b1e21", borderRadius: 20, padding: 18 }}>
        {bodyComp ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em" }}>{t("perfil.bodyScoreTitle")}</div>
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
                <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.45)", marginTop: 2 }}>{t("perfil.weightLabel")}</div>
              </div>
              <div style={{ textAlign: "center", borderLeft: "1px solid rgba(255,255,255,.06)" }}>
                <div className="font-sora" style={{ fontSize: 17, fontWeight: 800 }}>{bodyComp.build}</div>
                <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.45)", marginTop: 2 }}>{t("perfil.bodyBuild")}</div>
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
            {t("perfil.bodyCompEmpty", { settings: t("perfil.tabSettings") })}
          </div>
        )}
      </div>

      <ProfileFooter />
    </div>
  );
}
