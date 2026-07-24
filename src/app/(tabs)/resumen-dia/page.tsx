"use client";

// DailyHistoryDashboard — resumen nutricional + actividad de cualquier día,
// con una lista de barras de progreso (calorías, carbs, proteína, grasas,
// agua) que cambian a color de alerta cuando se supera la meta.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import * as db from "@/lib/db";
import { useApp } from "@/lib/store";
import { Activity, Drink, Meal, Profile, WorkoutState, todayISO } from "@/lib/types";

const DIA_ABBR = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DIA_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Mismo rojo de alerta que usa el resto de la app cuando se supera una meta.
const OVER_COLOR = "oklch(65% 0.19 25)";
const OVER_GLOW = "oklch(65% 0.19 25 / 0.6)";

function isoAddDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Últimos `n` días terminando en `end` (inclusive), del más antiguo al más reciente.
function lastNDays(end: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(isoAddDays(end, -i));
  return out;
}

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DIA_LARGO[dt.getDay()]}, ${dt.getDate()} ${MESES[dt.getMonth()]}`;
}

function computeDerived(meals: Meal[], drinks: Drink[], activity: Activity | null, workout: WorkoutState | null, profile: Profile) {
  const sum = (k: "kcal" | "p" | "c" | "f") => meals.reduce((a, m) => a + (Number(m[k]) || 0), 0);
  const kcalEaten = sum("kcal");
  const activityBurned = activity?.activityKcal ?? 0;
  const workoutBurned = workout?.done ? workout.kcal : 0;
  const burnedKcal = Math.max(activityBurned, workoutBurned);
  const kcalBudget = profile.metaKcal + burnedKcal;
  const water = drinks.reduce((a, d) => a + d.ml, 0);
  return {
    kcalEaten,
    proteinG: sum("p"),
    carbsG: sum("c"),
    fatG: sum("f"),
    burnedKcal,
    kcalBudget,
    water,
  };
}

function joinEs(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

interface DayVerdict {
  goalReached: boolean;
  headline: string;
  body: string;
}

// Veredicto motivador del día: no es solo "sí/no cumpliste" — dice qué SÍ
// se cumplió, qué NO, y una recomendación. Si el día es HOY (aún no
// termina), la recomendación mira hacia adelante ("aún estás a tiempo");
// si es un día pasado, mira hacia la próxima vez.
function buildDayVerdict(params: {
  hasAnyData: boolean;
  isToday: boolean;
  kcalOk: boolean;
  carbsOk: boolean;
  fatOk: boolean;
  proteinOk: boolean;
}): DayVerdict | null {
  const { hasAnyData, isToday, kcalOk, carbsOk, fatOk, proteinOk } = params;
  if (!hasAnyData) return null;

  const checks = [
    { label: "las calorías", ok: kcalOk },
    { label: "los carbohidratos", ok: carbsOk },
    { label: "las grasas", ok: fatOk },
    { label: "la proteína", ok: proteinOk },
  ];
  const met = checks.filter((c) => c.ok).map((c) => c.label);
  const missed = checks.filter((c) => !c.ok).map((c) => c.label);

  if (missed.length === 0) {
    return {
      goalReached: true,
      headline: "¡Meta alcanzada!",
      body: isToday
        ? "Calorías, carbohidratos, grasas y proteína bajo control. Sigue así y cierras el día como un campeón."
        : "Ese día cerraste todo dentro de tus metas. Así se hace.",
    };
  }

  let tip = "";
  if (!kcalOk) tip = "baja un poco las porciones o elige algo más ligero";
  else if (!carbsOk) tip = "cambia el arroz o el pan por más vegetales";
  else if (!fatOk) tip = "evita las frituras y elige proteínas a la plancha";
  else tip = "suma un huevo, pollo o un batido de proteína";

  const metText = met.length ? `Cumpliste con ${joinEs(met)}` : "Todavía no cumples ninguna meta";
  const adviceText = isToday ? `Aún estás a tiempo: ${tip}.` : `Para la próxima, ${tip}.`;

  return {
    goalReached: false,
    headline: "Meta no alcanzada",
    body: `${metText}, pero te faltó en ${joinEs(missed)}. ${adviceText}`,
  };
}

// ---------- Iconos minimalistas (SVG, no emoji) ----------

function CalendarIcon({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

// Fuego — calorías
function FlameIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.176 7.547 7.547 0 01-1.705-1.715.75.75 0 00-1.152-.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" />
    </svg>
  );
}

// Espiga de trigo — carbohidratos
function WheatIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="21" x2="12" y2="6" />
      <path d="M12 8c0-1.8 1.6-2.6 2.6-3.4" />
      <path d="M12 8c0-1.8-1.6-2.6-2.6-3.4" />
      <path d="M12 12.5c0-1.8 1.6-2.6 2.6-3.4" />
      <path d="M12 12.5c0-1.8-1.6-2.6-2.6-3.4" />
      <path d="M12 17c0-1.8 1.6-2.6 2.6-3.4" />
      <path d="M12 17c0-1.8-1.6-2.6-2.6-3.4" />
    </svg>
  );
}

// Pesa — proteína
function DumbbellIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="9" width="3" height="6" rx="1" />
      <rect x="19.5" y="9" width="3" height="6" rx="1" />
      <rect x="5.5" y="7" width="2.5" height="10" rx="1" />
      <rect x="16" y="7" width="2.5" height="10" rx="1" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

// Gota — grasas (contorno) / agua (rellena)
function DropletIcon({ size = 16, color = "currentColor", filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3c3 4 6 7.8 6 11.2a6 6 0 11-12 0C6 10.8 9 7 12 3z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10240a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10240a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface BarMetric {
  key: string;
  label: string;
  actual: number;
  meta: number;
  unit: string;
  color: string;
  glow: string;
  icon: React.ReactNode;
}

// Una barra de progreso ancha e independiente, estilo glassmorphism. Si el
// valor supera el 100% de la meta, la barra se llena hasta el tope (nunca
// desborda el contenedor) y cambia de su color vibrante habitual a rojo de
// alerta. Crece de izquierda a derecha con `motion` al cargar o al cambiar
// de día — sin remontar el componente, así la transición entre valores es
// una animación fluida, no un salto.
function ProgressBarRow({ metric, index }: { metric: BarMetric; index: number }) {
  const ratio = metric.meta > 0 ? metric.actual / metric.meta : 0;
  const exceeded = ratio > 1;
  const fillPct = Math.min(100, Math.round(ratio * 100));
  const barColor = exceeded ? OVER_COLOR : metric.color;
  const barGlow = exceeded ? OVER_GLOW : metric.glow;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-md" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ color: barColor, display: "flex", flex: "none", filter: `drop-shadow(0 0 4px ${barGlow})` }}>{metric.icon}</div>
          <div className="font-sora" style={{ fontSize: 13, fontWeight: 700, color: "#f4f3ee" }}>
            {metric.label}
          </div>
        </div>
        <div className="font-sora" style={{ fontSize: 13, fontWeight: 800, color: exceeded ? OVER_COLOR : "#f4f3ee", whiteSpace: "nowrap", flex: "none" }}>
          {metric.actual.toLocaleString()}
          {metric.unit}
          <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(244,243,238,.4)" }}>
            {" "}
            / {metric.meta.toLocaleString()}
            {metric.unit}
          </span>
        </div>
      </div>
      <div style={{ height: 10, borderRadius: 100, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 0.85, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: "100%", borderRadius: 100, background: barColor, boxShadow: `0 0 8px ${barGlow}` }}
        />
      </div>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md" style={{ flex: 1, padding: "12px 10px", textAlign: "center" }}>
      <div className="font-sora" style={{ fontSize: 17, fontWeight: 800 }}>
        {value}
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(244,243,238,.5)", marginTop: 3, letterSpacing: ".02em" }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: "rgba(244,243,238,.35)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export default function DailyHistoryDashboard() {
  const router = useRouter();
  const app = useApp();
  const { profile } = app;
  const today = todayISO();

  const days = useMemo(() => lastNDays(today, 21), [today]);
  const [selectedDate, setSelectedDate] = useState(today);
  // `date` marca a qué día pertenece este snapshot: comparándolo contra
  // `selectedDate` en el render se deriva `loading` sin ningún setState
  // síncrono en el efecto — el único setState ocurre dentro del callback
  // de la promesa, que es el patrón que React recomienda para efectos.
  const [fetched, setFetched] = useState<{
    date: string;
    meals: Meal[];
    drinks: Drink[];
    activity: Activity | null;
    workout: WorkoutState | null;
  } | null>(null);
  const isToday = selectedDate === today;
  const loading = !isToday && fetched?.date !== selectedDate;

  useEffect(() => {
    if (isToday) return; // los datos de hoy ya viven en el store, sin fetch
    let cancelled = false;
    Promise.all([db.mealsFor(selectedDate), db.drinksFor(selectedDate), db.activityFor(selectedDate), db.workoutFor(selectedDate)]).then(
      ([meals, drinks, activity, workout]) => {
        if (cancelled) return;
        setFetched({ date: selectedDate, meals, drinks, activity, workout });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [selectedDate, isToday]);

  const activeData = useMemo(
    () =>
      isToday
        ? { meals: app.meals, drinks: app.drinks, activity: app.activity, workout: app.workout }
        : { meals: fetched?.meals ?? [], drinks: fetched?.drinks ?? [], activity: fetched?.activity ?? null, workout: fetched?.workout ?? null },
    [isToday, app.meals, app.drinks, app.activity, app.workout, fetched]
  );
  const { meals: activeMeals, drinks: activeDrinks, activity: activeActivity, workout: activeWorkout } = activeData;
  const hasAnyData = activeMeals.length > 0 || activeDrinks.length > 0 || !!activeActivity || !!activeWorkout;

  const derived = useMemo(
    () => computeDerived(activeData.meals, activeData.drinks, activeData.activity, activeData.workout, profile),
    [activeData, profile]
  );

  const metrics: BarMetric[] = [
    {
      key: "kcal",
      label: "Calorías",
      actual: derived.kcalEaten,
      meta: derived.kcalBudget,
      unit: "",
      color: "#c7f27a",
      glow: "rgba(199,242,122,.65)",
      icon: <FlameIcon />,
    },
    {
      key: "carbs",
      label: "Carbohidratos",
      actual: derived.carbsG,
      meta: profile.metaCarbs,
      unit: "g",
      color: "oklch(78% 0.15 85)",
      glow: "oklch(78% 0.15 85 / 0.55)",
      icon: <WheatIcon />,
    },
    {
      key: "prot",
      label: "Proteína",
      actual: derived.proteinG,
      meta: profile.metaProtein,
      unit: "g",
      color: "oklch(72% 0.15 250)",
      glow: "oklch(72% 0.15 250 / 0.55)",
      icon: <DumbbellIcon />,
    },
    {
      key: "fat",
      label: "Grasas",
      actual: derived.fatG,
      meta: profile.metaFat,
      unit: "g",
      color: "oklch(72% 0.15 40)",
      glow: "oklch(72% 0.15 40 / 0.55)",
      icon: <DropletIcon />,
    },
    {
      key: "water",
      label: "Agua",
      actual: derived.water,
      meta: profile.metaWater,
      unit: "ml",
      color: "oklch(70% 0.13 220)",
      glow: "oklch(70% 0.13 220 / 0.65)",
      icon: <DropletIcon filled />,
    },
  ];

  // Veredicto del día: calorías y macros "máximo" dentro de meta, proteína
  // (mínimo) cumplida. Sin datos, no juzgamos el día.
  const kcalOk = derived.kcalBudget === 0 || derived.kcalEaten <= derived.kcalBudget;
  const carbsOk = derived.carbsG <= profile.metaCarbs;
  const fatOk = derived.fatG <= profile.metaFat;
  const proteinOk = derived.proteinG >= profile.metaProtein;

  const dayVerdict = buildDayVerdict({ hasAnyData, isToday, kcalOk, carbsOk, fatOk, proteinOk });

  // Carrusel: centra automáticamente el día seleccionado.
  const dayRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const firstScrollRef = useRef(true);
  useEffect(() => {
    const el = dayRefs.current.get(selectedDate);
    el?.scrollIntoView({ behavior: firstScrollRef.current ? "auto" : "smooth", inline: "center", block: "nearest" });
    firstScrollRef.current = false;
  }, [selectedDate]);

  const steps = activeActivity?.steps ?? 0;
  const routineDone = activeWorkout?.done ?? false;

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 32px", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div onClick={() => router.push("/hoy")} style={{ fontSize: 13, fontWeight: 700, color: "rgba(244,243,238,.7)", cursor: "pointer" }}>
          ‹ Volver
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <div
          style={{
            width: 38,
            height: 38,
            flex: "none",
            borderRadius: 12,
            background: "linear-gradient(135deg,#a6f06a,#39c9a3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 16px rgba(90,220,150,.4)",
            color: "#10240a",
          }}
        >
          <CalendarIcon size={19} color="#10240a" />
        </div>
        <div>
          <div className="font-sora" style={{ fontSize: 18, fontWeight: 800 }}>
            Resumen diario
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(244,243,238,.5)", marginTop: 1 }}>
            {isToday ? "Hoy · " : ""}
            {dayLabel(selectedDate)}
          </div>
        </div>
      </div>

      {/* Carrusel de días */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 18, paddingBottom: 4, scrollSnapType: "x proximity" }}>
        {days.map((iso) => {
          const [, , d] = iso.split("-").map(Number);
          const dow = new Date(iso + "T00:00:00").getDay();
          const selected = iso === selectedDate;
          const isTodayPill = iso === today;
          return (
            <div
              key={iso}
              ref={(el) => {
                if (el) dayRefs.current.set(iso, el);
              }}
              onClick={() => setSelectedDate(iso)}
              style={{
                flex: "none",
                width: 46,
                scrollSnapAlign: "center",
                borderRadius: 14,
                padding: "9px 0",
                textAlign: "center",
                cursor: "pointer",
                background: selected ? "#c7f27a" : "#1b1e21",
                border: !selected && isTodayPill ? "1px solid rgba(199,242,122,.5)" : "1px solid transparent",
                transition: "background .18s ease",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: selected ? "#10240a" : "rgba(244,243,238,.45)" }}>{DIA_ABBR[dow]}</div>
              <div className="font-sora" style={{ fontSize: 15, fontWeight: 800, color: selected ? "#10240a" : "#f4f3ee", marginTop: 2 }}>
                {d}
              </div>
            </div>
          );
        })}
      </div>

      {/* Veredicto del día — motivador: qué cumpliste, qué no, y cómo mejorar */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedDate}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-white/12 bg-white/[0.06] backdrop-blur-xl shadow-lg"
          style={{ marginTop: 18, padding: 16 }}
        >
          {!dayVerdict ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 18 }}>—</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(244,243,238,.55)" }}>Sin registros para este día.</div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  flex: "none",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: dayVerdict.goalReached ? "#c7f27a" : OVER_COLOR,
                  marginTop: 1,
                }}
              >
                {dayVerdict.goalReached ? <CheckIcon /> : <CrossIcon />}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  className="font-sora"
                  style={{ fontSize: 13.5, fontWeight: 800, color: dayVerdict.goalReached ? "#c7f27a" : OVER_COLOR }}
                >
                  {dayVerdict.headline}
                </div>
                <div style={{ fontSize: 12, color: "rgba(244,243,238,.8)", marginTop: 4, lineHeight: 1.5 }}>{dayVerdict.body}</div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Barras de progreso — glassmorphism, una tarjeta ancha e independiente por métrica */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18, position: "relative" }}>
        {metrics.map((m, i) => (
          <ProgressBarRow key={m.key} metric={m} index={i} />
        ))}
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(18,20,22,.4)",
              backdropFilter: "blur(2px)",
              borderRadius: 20,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                border: "3px solid rgba(199,242,122,.2)",
                borderTopColor: "#c7f27a",
                animation: "spin 0.9s linear infinite",
              }}
            />
          </div>
        )}
      </div>

      {/* Actividad física — glassmorphism */}
      <div className="rounded-2xl border border-white/12 bg-white/[0.06] backdrop-blur-xl shadow-lg" style={{ marginTop: 14, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)", letterSpacing: ".04em", marginBottom: 10 }}>
          ACTIVIDAD FÍSICA
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <StatTile label="PASOS" value={steps.toLocaleString()} />
          <StatTile label="KCAL EJERCICIO" value={String(derived.burnedKcal)} />
          <StatTile label="RUTINAS" value={routineDone ? "1" : "0"} sub={routineDone ? activeWorkout?.day : "—"} />
        </div>
      </div>
    </div>
  );
}
