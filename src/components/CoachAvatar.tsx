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
  | "Aburrida"
  | "Durmiendo"
  | "Despertando"
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
  /** Minutos desde el último dato registrado (agua, comida, ejercicio). */
  minutosInactiva: number;
}

// Una hora sin registrar nada y la tortuga se duerme, sea la hora que sea.
const SLEEP_AFTER_MIN = 60;

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

// Recordatorios como PULSOS, no como estados fijos: la base es la tortuga
// respirando tranquila, y cada cierto rato (si algo va atrasado) hace su
// gesto unos segundos y vuelve a la calma. Verla TODO el día tomando agua
// desesperaba — un recordatorio que no para deja de ser recordatorio.
const PULSE_EVERY_MS = 5 * 60_000; // cada cuánto puede aparecer un recordatorio
const PULSE_SHOW_MS = 8_000; // cuánto dura el gesto antes de volver a respirar

// Ritmo de las frases: cuánto se queda una en pantalla y cuántos segundos
// de silencio (sin burbuja) van entre una y la siguiente.
const PHRASE_HOLD_MS = 20_000;
const PHRASE_GAP_MS = 3_000;

// Qué recordatorio toca (o ninguno) según los datos del momento.
export function pendingReminder(data: DailyProgress): MascotState | null {
  if (data.metaKcal > 0 && data.kcalEaten > data.metaKcal) return "LlenoDeComida";
  if (data.metaWater > 0 && data.water / data.metaWater < expectedWaterPct(data.hour) - 0.15) {
    return "TomandoAgua";
  }
  if (!data.workoutDone && data.hour >= 17) return "Ejercicio";
  return null;
}

export function getMascotState(
  data: DailyProgress,
  lastAction?: ActionEvent,
  pulse?: MascotState | null
): MascotState {
  const now = Date.now();

  // 1-3) Eventos transitorios (registros recién hechos: prioridad máxima).
  if (isRecent(lastAction, now)) {
    if (lastAction!.type === "celebrar") return "Celebrando";
    if (lastAction!.type === "ejercicio") return "Ejercicio";
    return "LlenoDeComida";
  }

  // 4-5) Pulso de recordatorio activo (unos segundos, luego vuelve a base).
  if (pulse) return pulse;

  // 6a) Dormir: de 23:00 a 06:00, día sin registros ya entrada la noche, o
  // una hora entera sin que se registre nada nuevo.
  if (data.hour >= 23 || data.hour < 6) return "Durmiendo";
  if (!data.hasAnyLog && data.hour >= 20) return "Durmiendo";
  if (data.minutosInactiva >= SLEEP_AFTER_MIN) return "Durmiendo";

  // 6b) Aburrida: es de día y todavía no has registrado nada.
  if (!data.hasAnyLog) return "Aburrida";

  // 6c) Base: respirando tranquila (rota entre varios videos).
  return "Respirando";
}

// El estado base no es UN video: la tortuga respirando tranquila es el
// ancla (se reproduce DOS veces seguidas) y entre medio se cuela una
// variación distinta cada vez. Los clips duran ~5s, así que el ciclo es
// 10s de calma → 5s de acción → 10s de calma → otra acción…
const BASE_IDLE = "/mascota/Tortuga-Respirando.mp4";
const BASE_VARIANTS = [
  "/mascota/Tortuga-respirando2.mp4",
  "/mascota/Tortuga-respirando3.mp4",
  "/mascota/Tortuga-respirando4.mp4",
  // El "Durmiendo" original (que en realidad se ve descansando, no
  // dormida) entra también en la rotación de reposo, además de seguir
  // siendo el video del estado "Aburrida".
  "/mascota/Tortuga-Durmiendo.mp4",
];
const BASE_SEQUENCE: { src: string; plays: number }[] = BASE_VARIANTS.flatMap((v) => [
  { src: BASE_IDLE, plays: 2 },
  { src: v, plays: 1 },
]);

const WAKE_MS = 4_000; // cuánto dura el video de despertar

const VIDEO: Record<Exclude<MascotState, "Respirando">, string> = {
  // El "Durmiendo" original no se veía dormida: ahora es la cara de
  // aburrimiento de cuando no hay nada registrado todavía.
  Aburrida: "/mascota/Tortuga-Durmiendo.mp4",
  Durmiendo: "/mascota/Tortuga-durmiendo2.mp4",
  Despertando: "/mascota/Tortuga-despertando.mp4",
  TomandoAgua: "/mascota/Tortuga-TomandoAgua.mp4",
  Ejercicio: "/mascota/Tortuga-Ejercicio.mp4",
  LlenoDeComida: "/mascota/Tortuga-LlenoDeComida.mp4",
  Celebrando: "/mascota/Tortuga-Celebrando.mp4",
};

function videoFor(state: MascotState, step: number): string {
  if (state === "Respirando") return BASE_SEQUENCE[step % BASE_SEQUENCE.length].src;
  return VIDEO[state];
}

// Los 11 clips, en el orden en que se recorren al tocar la tortuga.
const ALL_VIDEOS = [
  BASE_IDLE,
  ...BASE_VARIANTS,
  VIDEO.Durmiendo,
  VIDEO.Despertando,
  VIDEO.TomandoAgua,
  VIDEO.Ejercicio,
  VIDEO.LlenoDeComida,
  VIDEO.Celebrando,
];

// Si deja de tocar este rato, la mascota vuelve a decidir sola.
const MANUAL_RESET_MS = 30_000;

// Marca del último dato registrado. Vive en localStorage para que "lleva una
// hora sin registrar nada" siga siendo cierto aunque se cierre y reabra la
// app — si viviera solo en memoria, el contador se reiniciaría cada vez.
const ACTIVITY_KEY = "ahivoy:ultimo_registro";

function leerUltimoRegistro(): number {
  try {
    const v = Number(localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

function guardarUltimoRegistro(ts: number) {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(ts));
  } catch {
    // sin storage: como mucho, la tortuga tarda más en dormirse
  }
}

// Frases atadas a lo que la tortuga está HACIENDO en pantalla: si sale
// corriendo, motiva; si duerme, habla de descansar. Donde el dato ayuda
// (agua, calorías) la frase trae el número real.
function phrasesForState(
  state: MascotState,
  d: { water: number; metaWater: number; kcalEaten: number; metaKcal: number; burned: number },
  fallback: string[]
): string[] {
  const vasos = Math.max(1, Math.round((d.metaWater - d.water) / 250));
  switch (state) {
    case "Durmiendo":
      return [
        "Zzz… mañana seguimos.",
        "Descansar también es progreso.",
        "Dormir bien baja el antojo del día siguiente.",
        "A esta hora ya no contamos calorías, contamos ovejas.",
        "Buenas noches. Apaga el teléfono, va.",
      ];
    case "Despertando":
      return [
        "¡Buenos días! ¿Arrancamos con un vaso de agua?",
        "Ya desperté. ¿Qué desayunamos?",
        "Día nuevo, cuenta nueva. Vamos.",
      ];
    case "Aburrida":
      return [
        "Aquí esperando… ¿ya comiste algo?",
        "No he anotado nada hoy. ¿Empezamos?",
        "Me aburro. Registrame algo, ¿va?",
        "Sin datos no puedo ayudarte. Tírame uno.",
      ];
    case "TomandoAgua":
      return [
        `Glup glup. Te faltan ~${vasos} vaso${vasos === 1 ? "" : "s"}.`,
        `Agua ${d.water}/${d.metaWater} ml. Acompáñame.`,
        "El agua primero, lo demás después.",
        "Tomá agua ahorita, no cuando ya tengas sed.",
      ];
    case "Ejercicio":
      return [
        "¡Vamos! Que el sillón no quema nada.",
        "20 minutos caminando ya cuentan. Arranca.",
        d.burned > 0 ? `Llevas ${d.burned} kcal quemadas. Súmale más.` : "Muévete un ratito, aunque sea poquito.",
        "Sudar hoy es sentirte bien mañana.",
      ];
    case "LlenoDeComida":
      return [
        "Uf, quedé llena. Vamos suave con la próxima.",
        `Vas ${d.kcalEaten}/${d.metaKcal} kcal. Agua y a caminar.`,
        "Nada de culpas — solo ajustamos la cena.",
        "Comimos bastante. Mañana lo compensamos.",
      ];
    case "Celebrando":
      return [
        "¡Meta cumplida, crack! 🎉",
        "Hoy sí que la rompiste.",
        "¡Así se hace! Estoy orgullosa.",
        "Día redondo. A dormir como campeón.",
      ];
    default:
      // Respirando: se queda el sistema de frases con datos y tips de siempre.
      return fallback;
  }
}

const STATE_LABEL: Record<MascotState, string> = {
  Respirando: "Tu coach está tranquilo",
  Aburrida: "Tu coach está aburrida esperándote",
  Durmiendo: "Tu coach está durmiendo",
  Despertando: "Tu coach está despertando",
  TomandoAgua: "Tu coach te recuerda tomar agua",
  Ejercicio: "Tu coach te recuerda el ejercicio",
  LlenoDeComida: "Tu coach quedó lleno de comida",
  Celebrando: "¡Tu coach está celebrando!",
};

// El ánimo (mood) ya no llega por prop: el estado del video lo comunica y se
// calcula aquí adentro con los mismos datos del día.
export default function CoachAvatar({ messages }: { messages: string[] }) {
  const reduce = useReducedMotion();
  const { profile, water, kcalEaten, proteinG, kcalBudget, burnedKcal, workout } = useApp();
  const [i, setI] = useState(0);
  // La frase se decide DESPUÉS de saber el estado (más abajo): así lo que
  // dice va a juego con lo que la tortuga está haciendo en pantalla.

  // Ciclo de la burbuja: la frase se queda un buen rato, luego DESAPARECE
  // unos segundos —para poder ver la tortuga completa, sin nada encima— y
  // recién ahí entra la siguiente. Encadenar frases sin ese respiro tapaba
  // el dibujo todo el tiempo.
  const [bubbleVisible, setBubbleVisible] = useState(true);
  const [cycleNonce, setCycleNonce] = useState(0);

  useEffect(() => {
    if (messages.length < 2) return;
    if (bubbleVisible) {
      const t = setTimeout(() => setBubbleVisible(false), PHRASE_HOLD_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setI((n) => n + 1);
      setBubbleVisible(true);
    }, PHRASE_GAP_MS);
    return () => clearTimeout(t);
  }, [bubbleVisible, cycleNonce, messages.length]);

  // Al tocar: siguiente frase de una vez y se reinicia el ciclo.
  const nextPhrase = () => {
    setI((n) => n + 1);
    setBubbleVisible(true);
    setCycleNonce((n) => n + 1);
  };

  // Un toque = siguiente video + siguiente frase.
  const onTap = () => {
    nextVideoManual();
    nextPhrase();
  };

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

  // Reloj propio: se refresca cada minuto y de él salen la hora y el tiempo
  // de inactividad. Leer Date.now() durante el render sería impuro (React
  // puede repetir renders) y además no volvería a evaluarse solo.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ---- Inactividad: ¿cuánto hace que no se registra nada? ----
  // Cada vez que cambia un dato del día se sella la hora; si pasa una hora
  // sin cambios, la tortuga se duerme hasta que vuelva a haber movimiento.
  const [ultimoRegistro, setUltimoRegistro] = useState<number>(() =>
    typeof window === "undefined" ? Date.now() : leerUltimoRegistro() || Date.now()
  );
  const datosFirma = `${kcalEaten}|${water}|${proteinG}|${workout?.done ?? false}`;
  const firmaPrevia = useRef<string | null>(null);
  useEffect(() => {
    // El primer render solo memoriza la firma: si sellara aquí, abrir la app
    // contaría como "actividad" y nunca se dormiría.
    if (firmaPrevia.current === null) {
      firmaPrevia.current = datosFirma;
      return;
    }
    if (firmaPrevia.current === datosFirma) return;
    firmaPrevia.current = datosFirma;
    const ahora = Date.now();
    guardarUltimoRegistro(ahora);
    setUltimoRegistro(ahora);
  }, [datosFirma]);

  // ---- Pulsos de recordatorio ----
  // Cada PULSE_EVERY_MS mira si algo va atrasado (agua, ejercicio, exceso) y
  // hace el gesto PULSE_SHOW_MS segundos; el resto del tiempo, a respirar.
  const [pulse, setPulse] = useState<MascotState | null>(null);
  const dNow = new Date(ahora);
  const data: DailyProgress = {
    kcalEaten,
    metaKcal: kcalBudget || profile.metaKcal,
    proteinG,
    metaProtein: profile.metaProtein,
    water,
    metaWater: profile.metaWater,
    workoutDone: workout?.done ?? false,
    hasAnyLog: kcalEaten > 0 || water > 0 || (workout?.done ?? false),
    hour: dNow.getHours() + dNow.getMinutes() / 60,
    minutosInactiva: (ahora - ultimoRegistro) / 60_000,
  };
  // El intervalo del pulso lee los datos por ref para no reiniciarse en
  // cada render (se sincroniza después de cada render, nunca durante).
  const dataRef = useRef<DailyProgress>(data);
  useEffect(() => {
    dataRef.current = data;
  });
  useEffect(() => {
    let hide: ReturnType<typeof setTimeout> | null = null;
    const t = setInterval(() => {
      const reminder = pendingReminder(dataRef.current);
      if (reminder) {
        setPulse(reminder);
        hide = setTimeout(() => setPulse(null), PULSE_SHOW_MS);
      }
    }, PULSE_EVERY_MS);
    return () => {
      clearInterval(t);
      if (hide) clearTimeout(hide);
    };
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

  const baseState = getMascotState(data, lastAction, pulse);

  // Rotación del estado base por REPRODUCCIONES, no por reloj: el clip
  // termina, se cuenta, y cuando cumplió las pasadas que le tocan (2 a la
  // original, 1 a cada variación) avanza al siguiente.
  const [step, setStep] = useState(0);
  const playsRef = useRef(0);

  // Capas del reproductor: 0 y 1. "front" es la que se ve.
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null]);
  const [front, setFront] = useState(0);
  const frontRef = useRef(0);
  const baseRef = useRef(true); // ¿el clip actual pertenece a la secuencia base?

  const onLayerEnded = (layer: number, el: HTMLVideoElement) => {
    // Solo manda la capa visible; la oculta puede terminar sin efecto.
    if (layer !== frontRef.current) return;
    if (!baseRef.current) {
      // Estados de ánimo: el mismo clip se repite en bucle.
      el.currentTime = 0;
      el.play().catch(() => {});
      return;
    }
    playsRef.current += 1;
    const actual = BASE_SEQUENCE[step % BASE_SEQUENCE.length];
    if (playsRef.current >= actual.plays) {
      playsRef.current = 0;
      setStep((n) => n + 1);
    } else {
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  };

  // Al salir de "Durmiendo" reproduce el video de despertar unos segundos,
  // en vez de saltar de golpe a la tortuga ya despierta.
  const [waking, setWaking] = useState(false);
  const prevSleepRef = useRef(baseState === "Durmiendo");
  useEffect(() => {
    const wasSleeping = prevSleepRef.current;
    const isSleeping = baseState === "Durmiendo";
    prevSleepRef.current = isSleeping;
    if (wasSleeping && !isSleeping) {
      setWaking(true);
      const t = setTimeout(() => setWaking(false), WAKE_MS);
      return () => clearTimeout(t);
    }
  }, [baseState]);

  // ---- Recorrido manual: al TOCAR, pasa al siguiente de los 11 videos ----
  // Solo con el toque; si deja de tocar un rato, vuelve al automático.
  const [manual, setManual] = useState<number | null>(null);
  const manualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextVideoManual = () => {
    setManual((m) => (m === null ? 0 : m + 1));
    if (manualTimer.current) clearTimeout(manualTimer.current);
    manualTimer.current = setTimeout(() => setManual(null), MANUAL_RESET_MS);
  };
  useEffect(() => () => { if (manualTimer.current) clearTimeout(manualTimer.current); }, []);

  const state: MascotState = waking ? "Despertando" : baseState;
  const videoSrc = manual === null ? videoFor(state, step) : ALL_VIDEOS[manual % ALL_VIDEOS.length];
  const phrases = phrasesForState(
    state,
    {
      water,
      metaWater: profile.metaWater,
      kcalEaten,
      metaKcal: kcalBudget || profile.metaKcal,
      burned: burnedKcal,
    },
    messages
  );
  const message = pick(phrases, i);

  // Carga el clip objetivo en la capa oculta y cruza SOLO cuando ya tiene
  // imagen ("loadeddata"), para que nunca se vea el hueco negro del video
  // sin decodificar. Como todos los clips empiezan y terminan igual, el
  // cruce se percibe como si siguiera el mismo video.
  useEffect(() => {
    baseRef.current = manual === null && state === "Respirando";
    const activo = videoRefs.current[frontRef.current];
    const oculto = videoRefs.current[1 - frontRef.current];
    if (!activo || !oculto) return;

    // Primer montaje: arranca directo en la capa visible, sin cruce.
    if (!activo.getAttribute("src")) {
      activo.src = videoSrc;
      activo.play().catch(() => {});
      return;
    }
    if (activo.getAttribute("src") === videoSrc) return;

    const cruzar = () => {
      oculto.currentTime = 0;
      oculto.play().catch(() => {});
      const siguiente = 1 - frontRef.current;
      const anterior = frontRef.current;
      frontRef.current = siguiente;
      setFront(siguiente);
      // Al terminar el fundido, la capa que quedó atrás se pausa: dejarla
      // corriendo invisible gasta batería sin que nadie la vea.
      setTimeout(() => videoRefs.current[anterior]?.pause(), 600);
    };
    oculto.src = videoSrc;
    oculto.load();
    if (oculto.readyState >= 2) {
      cruzar();
      return;
    }
    oculto.addEventListener("loadeddata", cruzar, { once: true });
    return () => oculto.removeEventListener("loadeddata", cruzar);
  }, [videoSrc, manual, state]);

  return (
    <motion.div
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap();
        }
      }}
      aria-label={`${STATE_LABEL[state]}: ${message}. Toca para ver otra animación y otro consejo.`}
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
      {/* Dos capas de video superpuestas. El siguiente clip se carga en la
          capa OCULTA y solo cuando ya tiene imagen decodificada se cruzan
          las opacidades. Montar un <video> nuevo y desvanecerlo de una vez
          mostraba un frame vacío (el negro que se veía entre cambios). */}
      {[0, 1].map((layer) => (
        <video
          key={layer}
          ref={(node) => {
            videoRefs.current[layer] = node;
          }}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          data-mascota
          onEnded={(e) => onLayerEnded(layer, e.currentTarget)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            pointerEvents: "none",
            opacity: front === layer ? 1 : 0,
            transition: reduce ? "none" : "opacity .5s ease-out",
          }}
        />
      ))}

      {/* Burbuja de frase: aparece, se queda un rato y se va, dejando unos
          segundos la tortuga sola antes de la siguiente. */}
      <AnimatePresence mode="wait">
        {bubbleVisible && (
        <motion.div
          key={message}
          initial={reduce ? false : { opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, y: 6, scale: 0.96 }}
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
        )}
      </AnimatePresence>
    </motion.div>
  );
}
