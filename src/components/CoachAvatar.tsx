"use client";

// Mascota del Coach: la tortuga de AHIVOYAPP en video (public/mascota/*.mp4),
// con 6 estados que reaccionan a los datos del día. Los eventos transitorios
// (celebrar, post-entrenamiento, comida grande) duran unos segundos y luego
// caen al estado ambiental (agua pendiente, ejercicio pendiente, dormir,
// respirar).
//
// El sistema de frases se conserva tal cual (rotan cada ~9s y al tocar la
// tortuga): el video comunica el ánimo, la frase da el dato y el tip.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useApp } from "@/lib/store";

export type CoachMood = "sleeping" | "alert" | "happy";

export type MascotState =
  | "Respirando"
  | "Durmiendo"
  | "TomandoAgua"
  | "Ejercicio"
  | "LlenoDeComida"
  | "Celebrando";

const DORMIDO = [
  "Zzz… despiértame con un vaso de agua.",
  "Sigo aquí, esperando tu primer registro.",
  "Modo siesta activado. Tú dirás.",
  "Todavía no he visto nada hoy. ¿Desayunaste?",
  "Me quedé dormido esperándote.",
  "Soñando con pupusas… digo, con ensalada.",
  "Despiértame cuando comas algo.",
  "Aquí acostado, sin nada que anotar.",
];

const FELIZ = [
  "¡Metas del día completas! Te luciste.",
  "Día redondo. Así se hace.",
  "Todo en verde. Duerme tranquilo.",
  "Cumpliste todo. Yo aquí aplaudiendo.",
  "Perfecto. Mañana repetimos, ¿va?",
  "Nada que corregir hoy. Raro y hermoso.",
  "Tu yo de enero estaría orgulloso.",
  // Frases de celebración (estado Celebrando)
  "¡Meta cumplida, crack! 🎉",
  "Hoy sí que la rompiste.",
  "¡Así se hace! La tortuga está orgullosa.",
  "Victoria total. A dormir como campeón.",
];

const ANIMO = [
  "Vas bien, no aflojes.",
  "Un día a la vez. Aquí ando.",
  "Nada de rendirse a media tarde.",
  "Lento pero sin parar, así se gana.",
];

function pick(list: string[], i: number): string {
  return list[i % list.length];
}

// Deriva el estado y TODAS las frases que aplican ahora mismo.
export function useCoachMood(): { mood: CoachMood; messages: string[] } {
  const { profile, water, kcalEaten, proteinG, carbsG, fatG, kcalBudget, kcalRemaining } = useApp();

  if (kcalEaten === 0 && water === 0) {
    return { mood: "sleeping", messages: DORMIDO };
  }

  const msgs: string[] = [];

  // Lo más urgente primero: pasarse de la meta.
  if (kcalEaten > kcalBudget) {
    const sobra = kcalEaten - kcalBudget;
    msgs.push(
      `Te pasaste ${sobra} kcal. Una caminata de 30 min quema ~150.`,
      "Ya cruzaste tu meta. Cena ligerito y listo.",
      "Nada de dramas: mañana es otro día."
    );
  }
  if (carbsG > profile.metaCarbs) {
    msgs.push(
      `Carbos ${carbsG}/${profile.metaCarbs}g. Ojo con el arroz y el pan.`,
      "Carbos al tope. Que la cena sea proteína y verduras.",
      "El pan dulce no era necesario, ¿verdad?"
    );
  }
  if (fatG > profile.metaFat) {
    msgs.push(
      `Grasas ${fatG}/${profile.metaFat}g. Mejor a la plancha que frito.`,
      "Grasas al tope. Baja el aceite en la próxima.",
      "La fritura es rica, pero pesa. Literal."
    );
  }

  // Agua: siempre con el dato y cuántos vasos faltan.
  if (water < profile.metaWater) {
    const faltan = profile.metaWater - water;
    const vasos = Math.max(1, Math.round(faltan / 250));
    msgs.push(
      `Agua ${water}/${profile.metaWater}ml. Te faltan ~${vasos} vaso${vasos === 1 ? "" : "s"}.`,
      "¿Ya tomaste agua? El vaso no se llena solo.",
      "El agua no engorda y quita el hambre falsa.",
      "Tomá agua ahorita, no cuando ya tengas sed."
    );
  }

  // Proteína: el tip más útil, con equivalencias reales.
  const faltaProt = Math.max(0, profile.metaProtein - proteinG);
  if (faltaProt > 0) {
    msgs.push(
      `Te faltan ${faltaProt}g de proteína. Un huevo ~6g, pollo ~30g.`,
      `Proteína ${proteinG}/${profile.metaProtein}g. Un puño de pollo lo arregla.`,
      "La proteína es la que te deja lleno. No la dejes de último."
    );
  }

  if (kcalRemaining > 0) {
    msgs.push(`Te quedan ${kcalRemaining} kcal libres hoy.`);
  }

  // Todo cumplido → feliz.
  const todoOk =
    proteinG >= profile.metaProtein && water >= profile.metaWater && kcalEaten <= kcalBudget;
  if (todoOk) return { mood: "happy", messages: FELIZ };

  return { mood: "alert", messages: msgs.length ? msgs : ANIMO };
}

// ---------------------------------------------------------------------------
// Máquina de estados de la tortuga

interface DailyProgress {
  kcalEaten: number;
  metaKcal: number;
  proteinG: number;
  metaProtein: number;
  water: number;
  metaWater: number;
  workoutDone: boolean;
  hasAnyLog: boolean;
  hour: number; // 0-23 (+fracción)
}

interface ActionEvent {
  type: "celebrar" | "ejercicio" | "comida-grande";
  ts: number;
}

const TRANSIENT_MS: Record<ActionEvent["type"], number> = {
  celebrar: 4000,
  ejercicio: 4000,
  "comida-grande": 3000,
};

function isRecent(ev: ActionEvent | undefined, now: number): boolean {
  return !!ev && now - ev.ts < TRANSIENT_MS[ev.type];
}

// % de la meta de agua que "deberías llevar" según la hora: lineal de
// 6 am (0%) a 10 pm (100%) — a las 6 pm da ~75%.
function expectedWaterPct(hour: number): number {
  return Math.min(1, Math.max(0, (hour - 6) / 16));
}

export function getMascotState(data: DailyProgress, lastAction?: ActionEvent): MascotState {
  const now = Date.now();

  // 1-3) Eventos transitorios (prioridad sobre lo ambiental mientras duren).
  if (isRecent(lastAction, now)) {
    if (lastAction!.type === "celebrar") return "Celebrando";
    if (lastAction!.type === "ejercicio") return "Ejercicio";
    return "LlenoDeComida";
  }

  // 3b) Exceso sostenido de calorías → sigue lleno (ambiental).
  if (data.metaKcal > 0 && data.kcalEaten > data.metaKcal) return "LlenoDeComida";

  // 6a) Dormir: de 23:00 a 06:00, o día sin registros ya entrada la noche.
  if (data.hour >= 23 || data.hour < 6) return "Durmiendo";
  if (!data.hasAnyLog && data.hour >= 20) return "Durmiendo";

  // 4) Recordatorio de ejercicio: nada registrado y ya es tarde.
  if (!data.workoutDone && data.hour >= 17) return "Ejercicio";

  // 5) Agua atrasada para la hora que es.
  if (data.metaWater > 0 && data.water / data.metaWater < expectedWaterPct(data.hour) - 0.15) {
    return "TomandoAgua";
  }

  // 6b) Idle normal.
  return "Respirando";
}

const VIDEO: Record<MascotState, string> = {
  Respirando: "/mascota/Tortuga-Respirando.mp4",
  Durmiendo: "/mascota/Tortuga-Durmiendo.mp4",
  TomandoAgua: "/mascota/Tortuga-TomandoAgua.mp4",
  Ejercicio: "/mascota/Tortuga-Ejercicio.mp4",
  LlenoDeComida: "/mascota/Tortuga-LlenoDeComida.mp4",
  Celebrando: "/mascota/Tortuga-Celebrando.mp4",
};

const STATE_LABEL: Record<MascotState, string> = {
  Respirando: "Tu coach está tranquilo",
  Durmiendo: "Tu coach está durmiendo",
  TomandoAgua: "Tu coach te recuerda tomar agua",
  Ejercicio: "Tu coach te recuerda el ejercicio",
  LlenoDeComida: "Tu coach quedó lleno de comida",
  Celebrando: "¡Tu coach está celebrando!",
};

// El ánimo (mood) ya no llega por prop: el estado del video lo comunica y se
// calcula aquí adentro con los mismos datos del día.
export default function CoachAvatar({ messages }: { messages: string[] }) {
  const reduce = useReducedMotion();
  const { profile, water, kcalEaten, proteinG, kcalBudget, workout } = useApp();
  const [i, setI] = useState(0);
  const message = pick(messages, i);

  // Rota sola para que la mascota se sienta viva aunque no la toquen.
  useEffect(() => {
    if (messages.length < 2) return;
    const t = setInterval(() => setI((n) => n + 1), 9000);
    return () => clearInterval(t);
  }, [messages.length]);

  // ---- Detección de eventos transitorios (comparando contra el valor previo) ----
  const [lastAction, setLastAction] = useState<ActionEvent | undefined>(undefined);
  const prevRef = useRef({ water, kcalEaten, workoutDone: workout?.done ?? false, celebrated: false });

  useEffect(() => {
    const prev = prevRef.current;
    const metaKcal = kcalBudget || profile.metaKcal;
    const kcalPct = metaKcal > 0 ? kcalEaten / metaKcal : 0;
    const prevKcalPct = metaKcal > 0 ? prev.kcalEaten / metaKcal : 0;
    const waterPct = profile.metaWater > 0 ? water / profile.metaWater : 0;
    const prevWaterPct = profile.metaWater > 0 ? prev.water / profile.metaWater : 0;

    let ev: ActionEvent | undefined;

    // 1) Celebrar: metas del día en rango, o el agua cruza el 90% por primera vez.
    const metasOk = kcalPct >= 0.9 && kcalPct <= 1.05 && proteinG >= profile.metaProtein && water >= profile.metaWater;
    const crossedWater = prevWaterPct < 0.9 && waterPct >= 0.9;
    if ((metasOk && !prev.celebrated) || crossedWater) {
      ev = { type: "celebrar", ts: Date.now() };
      prev.celebrated = prev.celebrated || metasOk;
    }
    // 2) Post-entrenamiento: workout pasó de pendiente a hecho.
    const workoutDone = workout?.done ?? false;
    if (!ev && workoutDone && !prev.workoutDone) ev = { type: "ejercicio", ts: Date.now() };
    // 3) Comida grande: el % de calorías del día sube >30 puntos de golpe.
    if (!ev && kcalPct - prevKcalPct > 0.3 && prev.kcalEaten > 0) ev = { type: "comida-grande", ts: Date.now() };

    prev.water = water;
    prev.kcalEaten = kcalEaten;
    prev.workoutDone = workoutDone;
    if (ev) {
      setLastAction(ev);
      // Al expirar la ventana, un re-render re-evalúa el estado ambiental.
      const t = setTimeout(() => setLastAction(undefined), TRANSIENT_MS[ev.type] + 100);
      return () => clearTimeout(t);
    }
  }, [water, kcalEaten, proteinG, workout?.done, kcalBudget, profile.metaWater, profile.metaProtein, profile.metaKcal]);

  // Re-evaluación ambiental periódica (la hora avanza aunque no pase nada).
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Los navegadores no reproducen video en pestañas ocultas: cuando el PWA
  // vuelve de segundo plano, el video quedaría congelado sin esto.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        document.querySelectorAll<HTMLVideoElement>("video[data-mascota]").forEach((v) => {
          v.play().catch(() => {});
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const d = new Date();
  const state = getMascotState(
    {
      kcalEaten,
      metaKcal: kcalBudget || profile.metaKcal,
      proteinG,
      metaProtein: profile.metaProtein,
      water,
      metaWater: profile.metaWater,
      workoutDone: workout?.done ?? false,
      hasAnyLog: kcalEaten > 0 || water > 0 || (workout?.done ?? false),
      hour: d.getHours() + d.getMinutes() / 60,
    },
    lastAction
  );

  return (
    <motion.div
      onClick={() => setI((n) => n + 1)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setI((n) => n + 1);
        }
      }}
      aria-label={`${STATE_LABEL[state]}: ${message}. Toca para otro consejo.`}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="relative w-full aspect-[1536/1024] overflow-hidden cursor-pointer"
      style={{
        borderRadius: 24,
        border: "1px solid rgba(199,242,122,.22)",
        background: "rgba(255,255,255,.045)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Crossfade entre estados: el video saliente se desvanece encima del
          entrante (ambos absolutos), sin cortes negros. */}
      <AnimatePresence initial={false}>
        <motion.video
          key={state}
          src={VIDEO[state]}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          data-mascota
          // autoPlay se pierde si el video carga antes de que React hidrate
          // (o al entrar por AnimatePresence): play() explícito al montar —
          // si aún no hay datos, la promesa espera a que los haya.
          ref={(node) => {
            node?.play().catch(() => {});
          }}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="absolute inset-0 object-cover w-full h-full pointer-events-none"
        />
      </AnimatePresence>

      {/* Burbuja de frase: el sistema de frases de siempre, sobre el video. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={message}
          initial={reduce ? false : { opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ type: "spring", stiffness: 380, damping: 24 }}
          className="absolute left-3 right-3 bottom-3 pointer-events-none"
        >
          <div
            style={{
              background: "rgba(18,20,22,.72)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 16,
              padding: "10px 13px",
              fontSize: 12.5,
              fontWeight: 700,
              lineHeight: 1.35,
              color: "#f4f3ee",
              overflowWrap: "anywhere",
            }}
          >
            {message}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
