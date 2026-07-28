"use client";

// Dashboard "Hoy" (screenshots/01-hoy.png)

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import Pressable from "@/components/Pressable";
import Icon from "@/components/Icon";
import CoachAvatar, { useCoachMood } from "@/components/CoachAvatar";
import ActivityDetailModal from "@/components/ActivityDetailModal";
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
  "Suda ahora, sonríe después.",
  "Un día a la vez. ¡Tú puedes!",
  "El agua es tu mejor amiga hoy.",
  "Menos excusas, más sudor.",
  "Tu única competencia eres tú de ayer.",
  "Cero carbohidratos tristes, pura disciplina.",
  "Hoy no, refrigerador. Hoy no.",
  "Menos plato, más músculo.",
  "El sofá no quema calorías, amigo.",
  "Agua sí, gaseosa no. Fácil.",
  "Camina como si llegaras tarde al gym.",
  "Tu abdomen vota por la ensalada hoy.",
  "Respira hondo y síguele.",
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
  const [activityModalOpen, setActivityModalOpen] = useState(false);

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
    routine,
    kcalEaten,
    proteinG,
    carbsG,
    fatG,
    burnedKcal,
    kcalBudget,
    kcalRemaining,
  } = app;

  const { messages: coachMessages } = useCoachMood();

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

  // Resumen dinámico de la tarjeta de actividad: distingue rutina de pesas
  // marcada como hecha de solo actividad general del reloj (caminata, etc.)
  const activitySummary = workout?.done
    ? `Rutina hecha · ${workout.day}`
    : (activity?.steps ?? 0) > 3000
    ? "Solo caminata"
    : activity
    ? "Actividad ligera"
    : "Sin registrar aún";

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

  const waterExceeded = profile.metaWater > 0 && water > profile.metaWater;
  const waterAltValue = waterExceeded ? `+${water - profile.metaWater}ml` : `${Math.max(0, profile.metaWater - water)}ml`;
  const waterAltLabel = waterExceeded ? "de más" : "faltan";

  const steps = activity?.steps ?? 0;
  const activeMin = activity?.activeMin ?? 0;
  // Las calorías del anillo salen de burnedKcal (el mayor entre reloj y
  // rutina), no solo del reloj: al subir SOLO la rutina, el anillo se
  // quedaba en cero aunque el centro de la rueda ya mostrara las kcal.
  const actKcal = Math.max(activity?.activityKcal ?? 0, burnedKcal);
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
        {/* minWidth 0 deja que este bloque se encoja y la frase baje de
            línea en vez de cortarse con puntos suspensivos. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", fontWeight: 600 }}>{todayLabel}</div>
          <motion.div
            key={heroMessage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="font-sora"
            style={{
              fontSize: 14.5,
              fontWeight: 800,
              marginTop: 3,
              color: "#c7f27a",
              textShadow: "0 0 14px rgba(199,242,122,.45)",
              lineHeight: 1.3,
              // La frase siempre se lee completa: envuelve en varias líneas.
              overflowWrap: "anywhere",
            }}
          >
            {heroMessage}
          </motion.div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#c7f27a" }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(244,243,238,.5)" }}>{healthSyncLabel}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
          <Pressable
            onClick={() => router.push("/resumen-dia")}
            ariaLabel="Ver resumen diario"
            style={{
              width: 44,
              height: 44,
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
          </Pressable>
          <Pressable
            onClick={() => router.push("/perfil")}
            ariaLabel="Ir a tu perfil"
            style={{
              width: 44,
              height: 44,
              flex: "none",
              borderRadius: "50%",
              padding: 2,
              background: "linear-gradient(135deg,#a6f06a,#39c9a3)",
              cursor: "pointer",
              boxShadow: "0 0 14px rgba(90,220,150,.35)",
              boxSizing: "border-box",
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
                <Icon name="user" size={20} />
              )}
            </div>
          </Pressable>
        </div>
      </div>

      {/* Mascota: reacciona a lo registrado hoy. Al tocarla cambia de consejo. */}
      <div style={{ marginTop: 14 }}>
        <CoachAvatar messages={coachMessages} />
      </div>

      {/* Macros */}
      <div style={{ borderRadius: 24, background: "#1b1e21", padding: "16px 10px", marginTop: 14, animation: "fadeUp .5s ease both" }}>
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
      <div style={{ borderRadius: 24, background: "#1b1e21", padding: "16px 18px", marginTop: 10 }}>
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
            {/* Alterna cada 5s entre "consumido / meta" y "cuánto falta"
                (o "+X de más" si ya se pasó) — el mismo vaivén que ya
                tienen las ruedas de macros arriba, para que el agua se
                sienta igual de informativa que ellas. */}
            <AnimatePresence mode="wait">
              <motion.div
                key={showRemaining ? "falta" : "actual"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="font-sora"
                style={{ fontSize: 19, fontWeight: 800, color: showRemaining && waterExceeded ? OVER_COLOR : undefined }}
              >
                {showRemaining ? waterAltValue : `${water}ml`}
                <span style={{ fontSize: 12, fontWeight: 600, color: showRemaining && waterExceeded ? OVER_COLOR : "rgba(244,243,238,.4)" }}>
                  {" "}
                  {showRemaining ? waterAltLabel : `/ ${profile.metaWater}ml`}
                </span>
              </motion.div>
            </AnimatePresence>
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
                borderRadius: 12,
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
              ariaLabel="Quitar agua"
              style={{
                width: 44,
                height: 44,
                flex: "none",
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
              ariaLabel="Agregar agua"
              style={{
                width: 44,
                height: 44,
                flex: "none",
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

      {/* Tarjeta Sueño: total grande + barra horizontal de fases (solo lectura,
          revelación progresiva — el detalle completo vive en /sueno). El
          acceso a la rutina ya no vive aquí: se ve completo al tocar la
          tarjeta "Actividad de hoy" más abajo (evita el mismo dato dos veces). */}
      <Pressable
        onClick={() => router.push("/sueno")}
        hoverScale={1}
        style={{ display: "block", background: "#1b1e21", borderRadius: 24, padding: 16, marginTop: 12, cursor: "pointer" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="sleep" size={16} />
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)", letterSpacing: ".04em" }}>SUEÑO</div>
          </div>
          {sleep && (
            <div style={{ fontSize: 10.5, fontWeight: 700, color: sleepOk ? "#c7f27a" : "oklch(75% 0.15 60)" }}>
              {sleepOk ? "Dentro de tu meta" : "Bajo tu meta de 7–8h"}
            </div>
          )}
        </div>
        <div className="font-sora" style={{ fontSize: 26, fontWeight: 800, textShadow: "0 0 12px oklch(72% 0.15 300 / 0.4)" }}>
          {sleepLabel}
        </div>
        {sleep?.phases ? (
          <>
            <div style={{ display: "flex", height: 10, borderRadius: 100, overflow: "hidden", marginTop: 12 }}>
              <div style={{ width: `${sleep.phases.deep}%`, background: "oklch(55% 0.18 290)" }} />
              <div style={{ width: `${sleep.phases.light}%`, background: "oklch(68% 0.14 260)" }} />
              <div style={{ width: `${sleep.phases.rem}%`, background: "oklch(78% 0.12 220)" }} />
              <div style={{ width: `${sleep.phases.awake}%`, background: "rgba(255,255,255,.15)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 9.5, color: "rgba(244,243,238,.45)" }}>
              <span>Profundo {sleep.phases.deep}%</span>
              <span>Ligero {sleep.phases.light}%</span>
              <span>REM {sleep.phases.rem}%</span>
              <span>Despierto {sleep.phases.awake}%</span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: "rgba(244,243,238,.4)", marginTop: 10 }}>
            {sleep ? "Sin datos de fases — solo duración" : "Toca para anotar tus horas"}
          </div>
        )}
      </Pressable>

      {/* Alerta de límite */}
      {limitAlertText && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(230,120,60,.15)",
            border: "1px solid rgba(230,120,60,.35)",
            borderRadius: 18,
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
          borderRadius: 18,
          padding: "10px 12px",
          marginTop: 12,
        }}
      >
        <Icon name="food" size={18} />
        <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "rgba(244,243,238,.7)", lineHeight: 1.4 }}>{menuSuggestion}</div>
      </div>

      {/* Atajo al resumen del día: barras de macros y el veredicto del día
          completo. Vivía en Perfil, pero tiene más sentido aquí en Hoy. */}
      <Pressable
        onClick={() => router.push("/resumen-dia")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(199,242,122,.08)",
          border: "1px solid rgba(199,242,122,.25)",
          borderRadius: 18,
          padding: "12px 14px",
          marginTop: 12,
          cursor: "pointer",
        }}
      >
        <Icon name="history-trends" size={20} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#c7f27a" }}>Resumen del día</div>
          <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.5)", marginTop: 1 }}>Barras de macros y cómo te fue</div>
        </div>
        <span style={{ fontSize: 11, color: "rgba(244,243,238,.4)", flex: "none" }}>Ver ›</span>
      </Pressable>

      {/* Actividad de hoy (rueda estilo Samsung Health) — interactiva: al
          tocarla se abre el detalle completo (revelación progresiva). */}
      <div style={{ marginTop: 12 }}>
        <motion.div
          onClick={() => setActivityModalOpen(true)}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          role="button"
          tabIndex={0}
          aria-label="Ver detalle de actividad"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setActivityModalOpen(true);
            }
          }}
          style={{ borderRadius: 24, background: "#1b1e21", padding: 16, animation: "fadeUp .5s ease both", cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)", letterSpacing: ".04em" }}>ACTIVIDAD DE HOY</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#c7f27a", marginTop: 2 }}>{activitySummary}</div>
            </div>
            <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.35)" }}>Ver detalle ›</div>
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
            <div style={{ flex: 1, background: "#232527", borderRadius: 14, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "rgba(244,243,238,.5)", fontWeight: 600 }}>Total quemadas</div>
              <div className="font-sora" style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                {Math.max(activity?.totalKcal ?? 0, burnedKcal).toLocaleString()}{" "}
                <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(244,243,238,.4)" }}>kcal</span>
              </div>
            </div>
            <div style={{ flex: 1, background: "#232527", borderRadius: 14, padding: "10px 12px" }}>
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
              borderRadius: 14,
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
        </motion.div>
      </div>

      <ActivityDetailModal
        open={activityModalOpen}
        onClose={() => setActivityModalOpen(false)}
        activity={activity}
        workout={workout}
        exercises={workout?.done ? routine[workout.day] : []}
        burnedKcal={burnedKcal}
      />
    </div>
  );
}
