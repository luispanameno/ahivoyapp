"use client";

// Dashboard "Hoy" (screenshots/01-hoy.png)

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import Pressable from "@/components/Pressable";
import { useApp } from "@/lib/store";

const DIAS = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

// Rojo de alerta cuando el usuario se pasó de la meta (mismo tono en toda la app).
const OVER_COLOR = "oklch(65% 0.19 25)";
const OVER_GLOW = "oklch(65% 0.19 25 / 0.6)";

// Frases del header: una al azar cada vez que se carga la pantalla.
const HERO_PHRASES = [
  "Dile no a esa Coca-Cola heladita.",
  "El café es delicioso sin pan dulce.",
  "Esa pupusa extra no cuenta como cardio.",
  "Suda ahora, sonríe en el espejo después.",
  "Un día a la vez. ¡Tú puedes!",
  "El agua es tu mejor amiga hoy.",
  "Menos excusas, más sudor. ¡A darle!",
  "Tu única competencia eres tú mismo ayer.",
  "Cero carbohidratos tristes, pura disciplina.",
  "El esfuerzo de hoy es el cuerpo de tus sueños mañana.",
  "No cuentes los días, haz que los días cuenten (y quemen).",
  "Respira hondo, mantén el ritmo y síguele.",
  "Si la dieta fuera fácil, verías a medio mundo corriendo maratones en calzoncillos.",
  "Recuerda: el chocolate oscuro te ama, pero tu abdomen finge demencia.",
  "Hoy tu mayor logro será no comerte la refri de un solo mordisco.",
  "¿Hacer ejercicio o llorar en posición fetal? Elige sabiamente.",
  "Ese cheat meal de ayer ya pidió nacionalidad en tus caderas. ¡A moverse!",
];

// Ícono minimalista de calendario (SVG, no emoji) para abrir el resumen diario.
function CalendarIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="rgba(244,243,238,.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="14.5" x2="8" y2="14.5" />
      <line x1="12" y1="14.5" x2="12" y2="14.5" />
      <line x1="16" y1="14.5" x2="16" y2="14.5" />
    </svg>
  );
}

function MacroRing({
  actual,
  meta,
  label,
  unit,
  color,
  glow,
  showRemaining,
}: {
  actual: number;
  meta: number;
  label: string;
  unit: string; // "" para calorías, "g" para macros
  color: string;
  glow: string;
  showRemaining: boolean;
}) {
  const exceeded = meta > 0 && actual > meta;
  const ringColor = exceeded ? OVER_COLOR : color;
  const ringGlow = exceeded ? OVER_GLOW : glow;
  const deg = Math.min(360, meta ? Math.round((actual / meta) * 360) : 0);

  const center = `${actual}${unit}`;
  const sub = meta ? `/${meta}${unit}` : "";
  // Cuando se excede, la parte "faltan/libres" pasa a mostrar cuánto se pasó.
  const centerAlt = exceeded ? `+${actual - meta}${unit}` : `${Math.max(0, meta - actual)}${unit}`;
  const subAlt = exceeded ? "te has pasado" : unit ? "faltan" : "libres";

  const displayCenter = showRemaining ? centerAlt : center;
  const displaySub = showRemaining ? subAlt : sub;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        style={{
          position: "relative",
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: `conic-gradient(${ringColor} ${deg}deg, rgba(255,255,255,.06) ${deg}deg 360deg)`,
          filter: `drop-shadow(0 0 10px ${ringGlow})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "absolute", inset: 6, borderRadius: "50%", background: "#1b1e21" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={displayCenter + displaySub}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                className="font-sora"
                style={{ fontSize: 15, fontWeight: 800, color: exceeded ? OVER_COLOR : undefined, textShadow: `0 0 8px ${ringGlow}` }}
              >
                {displayCenter}
              </div>
              <div style={{ fontSize: 8.5, color: exceeded ? OVER_COLOR : "rgba(244,243,238,.4)" }}>{displaySub}</div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(244,243,238,.6)" }}>{label}</div>
    </div>
  );
}

export default function Hoy() {
  const router = useRouter();
  const app = useApp();
  const [waterStep, setWaterStep] = useState("250");
  const [showRemaining, setShowRemaining] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowRemaining((prev) => !prev);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const {
    profile,
    water,
    activity,
    workout,
    sleep,
    kcalEaten,
    proteinG,
    carbsG,
    fatG,
    burnedKcal,
    kcalBudget,
    kcalRemaining,
  } = app;

  const now = new Date();
  const todayLabel = `${DIAS[now.getDay()]}, ${now.getDate()} ${MESES[now.getMonth()]}`;
  // Una frase al azar cada vez que se monta la pantalla (no en cada render).
  const [heroMessage] = useState(() => HERO_PHRASES[Math.floor(Math.random() * HERO_PHRASES.length)]);

  const healthSyncLabel = activity
    ? `${activity.steps.toLocaleString()} pasos · ${activity.activityKcal} kcal activas`
    : "Sube la captura de tu reloj en Perfil";

  const sleepMins = sleep?.minutes ?? 0;
  const sleepOk = sleepMins >= 420 && sleepMins <= 510;
  const sleepLabel = sleep
    ? `${Math.floor(sleepMins / 60)}h ${String(sleepMins % 60).padStart(2, "0")}m`
    : "sin registro";

  let limitAlertText: string | null = null;
  if (kcalEaten > kcalBudget)
    limitAlertText = `Superaste tu meta de ${kcalBudget.toLocaleString()} kcal (incluye lo quemado). Considera una cena ligera.`;
  else if (carbsG > profile.metaCarbs)
    limitAlertText = `Superaste el límite de ${profile.metaCarbs}g de carbohidratos hoy.`;
  else if (fatG > profile.metaFat)
    limitAlertText = `Superaste el límite de ${profile.metaFat}g de grasas hoy.`;

  const protLeft = Math.max(0, profile.metaProtein - proteinG);
  const menuSuggestion =
    protLeft > 0
      ? `Asesor de menús: te faltan ${protLeft}g de proteína y tienes ${kcalRemaining} kcal. Ideal: pescado o pollo a la plancha con verduras.`
      : `¡Proteína completa! Con ${kcalRemaining} kcal restantes, una cena ligera de verduras cierra perfecto el día.`;

  const steps = activity?.steps ?? 0;
  const activeMin = activity?.activeMin ?? 0;
  const actKcal = activity?.activityKcal ?? 0;
  const stepsDeg = Math.min(360, Math.round((steps / 6000) * 360));
  const activeMinDeg = Math.min(360, Math.round((activeMin / 50) * 360));
  const actKcalDeg = Math.min(360, Math.round((actKcal / 500) * 360));

  const addWaterNow = () => {
    const ml = Number(waterStep) || 0;
    if (ml > 0) app.addWater(ml);
  };

  const removeWaterNow = () => {
    const ml = Number(waterStep) || 0;
    const removeMl = Math.min(ml, water);
    if (removeMl > 0) app.addWater(-removeMl, "Ajuste");
  };

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 24px" }}>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", fontWeight: 600 }}>{todayLabel}</div>
          <motion.div
            key={heroMessage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="font-sora"
            style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}
          >
            {heroMessage}
          </motion.div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#c7f27a" }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(244,243,238,.5)" }}>{healthSyncLabel}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
          <div
            onClick={() => router.push("/resumen-dia")}
            aria-label="Ver resumen diario"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#1b1e21",
              border: "1px solid rgba(255,255,255,.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <CalendarIcon />
          </div>
          <div
            onClick={() => router.push("/perfil")}
            style={{
              width: 44,
              height: 44,
              flex: "none",
              borderRadius: "50%",
              padding: 2,
              background: "linear-gradient(135deg,#a6f06a,#39c9a3)",
              cursor: "pointer",
              boxShadow: "0 0 14px rgba(90,220,150,.35)",
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
                fontSize: 18,
              }}
            >
              {profile.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photo} alt="Perfil" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                "👤"
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Macros */}
      <div style={{ borderRadius: 20, background: "#1b1e21", padding: "16px 10px", marginTop: 14, animation: "fadeUp .5s ease both" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)", letterSpacing: ".04em", marginBottom: 12, paddingLeft: 4 }}>
          MACRONUTRIENTES HOY
        </div>
        <div style={{ display: "flex", justifyContent: "space-around", animation: "ringIn .6s cubic-bezier(.2,.8,.2,1) both" }}>
          <MacroRing
            actual={kcalEaten}
            meta={kcalBudget}
            unit=""
            label="CALORÍAS"
            color="#c7f27a"
            glow="rgba(199,242,122,.65)"
            showRemaining={showRemaining}
          />
          <MacroRing
            actual={carbsG}
            meta={profile.metaCarbs}
            unit="g"
            label="CARBS"
            color="oklch(78% 0.15 85)"
            glow="oklch(78% 0.15 85 / 0.55)"
            showRemaining={showRemaining}
          />
          <MacroRing
            actual={proteinG}
            meta={profile.metaProtein}
            unit="g"
            label="PROTEÍNA"
            color="oklch(72% 0.15 250)"
            glow="oklch(72% 0.15 250 / 0.55)"
            showRemaining={showRemaining}
          />
          <MacroRing
            actual={fatG}
            meta={profile.metaFat}
            unit="g"
            label="GRASAS"
            color="oklch(72% 0.15 40)"
            glow="oklch(72% 0.15 40 / 0.55)"
            showRemaining={showRemaining}
          />
        </div>
      </div>

      {/* Agua */}
      <div style={{ borderRadius: 20, background: "#1b1e21", padding: "16px 18px", marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)", letterSpacing: ".04em" }}>
            SEGUIMIENTO DE HIDRATACIÓN
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 34,
              height: 34,
              flex: "none",
              border: "2.5px solid oklch(70% 0.13 220)",
              borderRadius: "50% 50% 50% 0",
              transform: "rotate(45deg)",
              filter: "drop-shadow(0 0 8px oklch(70% 0.13 220 / 0.65))",
            }}
          />
          <div style={{ flex: 1 }}>
            <div className="font-sora" style={{ fontSize: 19, fontWeight: 800 }}>
              {water}ml
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(244,243,238,.4)" }}> / {profile.metaWater}ml</span>
            </div>
            <div style={{ height: 6, borderRadius: 100, background: "rgba(255,255,255,.08)", marginTop: 8 }}>
              <div
                style={{
                  width: `${Math.min(100, Math.round((water / profile.metaWater) * 100))}%`,
                  height: "100%",
                  borderRadius: 100,
                  background: "oklch(70% 0.13 220)",
                  boxShadow: "0 0 10px oklch(70% 0.13 220 / 0.8)",
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
            <input
              value={waterStep}
              inputMode="numeric"
              onChange={(e) => setWaterStep(e.target.value.replace(/[^0-9]/g, ""))}
              style={{
                width: 52,
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 10,
                color: "#f4f3ee",
                fontSize: 13,
                fontWeight: 700,
                textAlign: "center",
                padding: "6px 4px",
                outline: "none",
                boxSizing: "border-box",
              }}
              className="font-sora"
            />
            <div style={{ fontSize: 11, color: "rgba(244,243,238,.4)", fontWeight: 600 }}>ml</div>
            <Pressable
              onClick={removeWaterNow}
              tapScale={0.9}
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "rgba(255,255,255,.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 700,
                color: "rgba(244,243,238,.5)",
                cursor: "pointer",
              }}
            >
              −
            </Pressable>
            <Pressable
              onClick={addWaterNow}
              tapScale={0.9}
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "rgba(199,242,122,.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 700,
                color: "#c7f27a",
                cursor: "pointer",
              }}
            >
              +
            </Pressable>
          </div>
        </div>
      </div>

      {/* Accesos entrenamiento / sueño */}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <div
          onClick={() => router.push("/entrenamiento")}
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#1b1e21", borderRadius: 14, padding: "10px 12px", cursor: "pointer" }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "#c7f27a", flex: "none" }} />
          <div style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: "rgba(244,243,238,.75)" }}>
            {workout?.done ? `${workout.day} · ${workout.kcal} kcal` : "Tu rutina de hoy"}
          </div>
          <div style={{ fontSize: 11, color: workout?.done ? "#c7f27a" : "rgba(244,243,238,.4)" }}>
            {workout?.done ? "✓ Hecho" : "Ver ›"}
          </div>
        </div>
        <div
          onClick={() => router.push("/sueno")}
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#1b1e21", borderRadius: 14, padding: "10px 12px", cursor: "pointer" }}
        >
          <div style={{ fontSize: 13 }}>😴</div>
          <div style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: "rgba(244,243,238,.75)" }}>Anoche: {sleepLabel}</div>
          <div style={{ fontSize: 11, color: sleepOk ? "#c7f27a" : "oklch(75% 0.15 60)" }}>
            {sleep ? (sleepOk ? "✓ Meta" : "Bajo meta") : "›"}
          </div>
        </div>
      </div>

      {/* Alerta de límite */}
      {limitAlertText && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(230,120,60,.15)",
            border: "1px solid rgba(230,120,60,.35)",
            borderRadius: 14,
            padding: "10px 12px",
            marginTop: 12,
          }}
        >
          <div style={{ fontSize: 14 }}>🚨</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "oklch(78% 0.15 50)" }}>{limitAlertText}</div>
        </div>
      )}

      {/* Sugerencia de menú */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(199,242,122,.08)",
          border: "1px solid rgba(199,242,122,.2)",
          borderRadius: 14,
          padding: "10px 12px",
          marginTop: 12,
        }}
      >
        <div style={{ fontSize: 13 }}>🍽️</div>
        <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "rgba(244,243,238,.7)", lineHeight: 1.4 }}>{menuSuggestion}</div>
      </div>

      {/* Actividad de hoy (rueda estilo Samsung Health) */}
      <div style={{ marginTop: 12 }}>
        <div style={{ borderRadius: 20, background: "#1b1e21", padding: 16, animation: "fadeUp .5s ease both" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)", letterSpacing: ".04em" }}>ACTIVIDAD DE HOY</div>
            <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.35)" }}>de tu reloj</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ position: "relative", width: 132, height: 132, flex: "none" }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: `conic-gradient(#7ed957 ${stepsDeg}deg, rgba(255,255,255,.07) ${stepsDeg}deg 360deg)`,
                  filter: "drop-shadow(0 0 5px rgba(126,217,87,.6))",
                }}
              />
              <div style={{ position: "absolute", inset: 12, borderRadius: "50%", background: "#1b1e21" }} />
              <div
                style={{
                  position: "absolute",
                  inset: 17,
                  borderRadius: "50%",
                  background: `conic-gradient(oklch(72% 0.14 220) ${activeMinDeg}deg, rgba(255,255,255,.07) ${activeMinDeg}deg 360deg)`,
                  filter: "drop-shadow(0 0 5px oklch(72% 0.14 220 / .55))",
                }}
              />
              <div style={{ position: "absolute", inset: 29, borderRadius: "50%", background: "#1b1e21" }} />
              <div
                style={{
                  position: "absolute",
                  inset: 34,
                  borderRadius: "50%",
                  background: `conic-gradient(#a56bff ${actKcalDeg}deg, rgba(255,255,255,.07) ${actKcalDeg}deg 360deg)`,
                  filter: "drop-shadow(0 0 5px rgba(165,107,255,.55))",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 46,
                  borderRadius: "50%",
                  background: "#1b1e21",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div className="font-sora" style={{ fontSize: 14, fontWeight: 800, color: "#c7f27a", lineHeight: 1 }}>
                  {burnedKcal}
                </div>
                <div style={{ fontSize: 7.5, color: "rgba(244,243,238,.4)" }}>kcal act.</div>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { color: "#7ed957", label: "Pasos", value: steps.toLocaleString(), meta: " /6,000" },
                { color: "oklch(72% 0.14 220)", label: "Tiempo de actividad", value: String(activeMin), meta: " min /50" },
                { color: "#a56bff", label: "Calorías de actividad", value: String(actKcal), meta: " /500" },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: row.color, flex: "none", boxShadow: `0 0 6px ${row.color}` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "rgba(244,243,238,.5)", fontWeight: 600 }}>{row.label}</div>
                    <div>
                      <span className="font-sora" style={{ fontSize: 16, fontWeight: 800 }}>{row.value}</span>
                      <span style={{ fontSize: 10, color: "rgba(244,243,238,.4)", fontWeight: 600 }}>{row.meta}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1, background: "#232527", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "rgba(244,243,238,.5)", fontWeight: 600 }}>Total quemadas</div>
              <div className="font-sora" style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                {(activity?.totalKcal ?? 0).toLocaleString()}{" "}
                <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(244,243,238,.4)" }}>kcal</span>
              </div>
            </div>
            <div style={{ flex: 1, background: "#232527", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "rgba(244,243,238,.5)", fontWeight: 600 }}>Distancia</div>
              <div className="font-sora" style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                {activity?.distance ?? 0}{" "}
                <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(244,243,238,.4)" }}>km</span>
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 12,
              background: "rgba(199,242,122,.08)",
              border: "1px solid rgba(199,242,122,.2)",
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(244,243,238,.78)",
              lineHeight: 1.4,
            }}
          >
            🔥 {burnedKcal} kcal quemadas suman a tu meta →{" "}
            <span style={{ color: "#c7f27a", fontWeight: 800 }}>{kcalRemaining} kcal disponibles</span> hoy
          </div>
        </div>
      </div>
    </div>
  );
}
