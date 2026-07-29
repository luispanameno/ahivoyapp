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

type T = (key: string, vars?: Record<string, string | number>) => string;

function dormido(t: T): string[] {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((n) => t(`mascot.dormido${n}`));
}

function feliz(t: T): string[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => t(`mascot.feliz${n}`));
}

function animo(t: T): string[] {
  return [1, 2, 3, 4].map((n) => t(`mascot.animo${n}`));
}

// Palabra "vaso(s)"/"glass(es)" según cantidad, en el idioma activo.
function glassWord(t: T, vasos: number): string {
  return vasos === 1 ? t("mascot.glassSingular") : t("mascot.glassPlural");
}

function pick(list: string[], i: number): string {
  return list[i % list.length];
}

// Deriva el estado y TODAS las frases que aplican ahora mismo.
export function useCoachMood(): { mood: CoachMood; messages: string[] } {
  const { profile, water, kcalEaten, proteinG, carbsG, fatG, kcalBudget, kcalRemaining, t } = useApp();

  if (kcalEaten === 0 && water === 0) {
    return { mood: "sleeping", messages: dormido(t) };
  }

  const msgs: string[] = [];

  // Lo más urgente primero: pasarse de la meta.
  if (kcalEaten > kcalBudget) {
    const sobra = kcalEaten - kcalBudget;
    msgs.push(
      t("mascot.overKcal1", { kcal: sobra }),
      t("mascot.overKcal2"),
      t("mascot.overKcal3")
    );
  }
  if (carbsG > profile.metaCarbs) {
    msgs.push(
      t("mascot.overCarbs1", { actual: carbsG, meta: profile.metaCarbs }),
      t("mascot.overCarbs2"),
      t("mascot.overCarbs3")
    );
  }
  if (fatG > profile.metaFat) {
    msgs.push(
      t("mascot.overFat1", { actual: fatG, meta: profile.metaFat }),
      t("mascot.overFat2"),
      t("mascot.overFat3")
    );
  }

  // Agua: siempre con el dato y cuántos vasos faltan.
  if (water < profile.metaWater) {
    const faltan = profile.metaWater - water;
    const vasos = Math.max(1, Math.round(faltan / 250));
    msgs.push(
      t("mascot.needWater1", { actual: water, meta: profile.metaWater, vasos, glassWord: glassWord(t, vasos) }),
      t("mascot.needWater2"),
      t("mascot.needWater3"),
      t("mascot.needWater4")
    );
  }

  // Proteína: el tip más útil, con equivalencias reales.
  const faltaProt = Math.max(0, profile.metaProtein - proteinG);
  if (faltaProt > 0) {
    msgs.push(
      t("mascot.needProtein1", { g: faltaProt }),
      t("mascot.needProtein2", { actual: proteinG, meta: profile.metaProtein }),
      t("mascot.needProtein3")
    );
  }

  if (kcalRemaining > 0) {
    msgs.push(t("mascot.kcalLeft", { kcal: kcalRemaining }));
  }

  // Todo cumplido → feliz.
  const todoOk =
    proteinG >= profile.metaProtein && water >= profile.metaWater && kcalEaten <= kcalBudget;
  if (todoOk) return { mood: "happy", messages: feliz(t) };

  return { mood: "alert", messages: msgs.length ? msgs : animo(t) };
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
// La ÚLTIMA FIRMA vista también se guarda en localStorage (no solo en un
// ref en memoria): un ref se reinicia cada vez que este componente se
// desmonta y vuelve a montar (ej. subiste el desayuno desde el chat/escáner
// y volviste a Hoy), así que comparando solo contra el ref, ese cambio real
// pasaba desapercibido y la tortuga seguía "dormida" aunque ya hubieras
// registrado algo. Comparando contra lo guardado, el cambio se detecta
// sin importar qué pantalla lo generó.
const ACTIVITY_SIG_KEY = "ahivoy:ultima_firma";

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

function leerUltimaFirma(): string | null {
  try {
    return localStorage.getItem(ACTIVITY_SIG_KEY);
  } catch {
    return null;
  }
}

function guardarUltimaFirma(sig: string) {
  try {
    localStorage.setItem(ACTIVITY_SIG_KEY, sig);
  } catch {
    // sin storage: como mucho, la tortuga tarda más en dormirse
  }
}

// Frases atadas a lo que la tortuga está HACIENDO en pantalla: si sale
// corriendo, motiva; si duerme, habla de descansar. Donde el dato ayuda
// (agua, calorías) la frase trae el número real.
function phrasesForState(
  state: MascotState,
  d: { water: number; metaWater: number; kcalEaten: number; metaKcal: number; burned: number; duermePorInactividad: boolean },
  fallback: string[],
  t: T
): string[] {
  const vasos = Math.max(1, Math.round((d.metaWater - d.water) / 250));
  switch (state) {
    case "Durmiendo":
      // Se duerme por dos motivos distintos y las frases NO son iguales: de
      // noche toca desear buenas noches; de día, hacer notar que lleva rato
      // sin registros para que la persona sepa cómo despertarla.
      return d.duermePorInactividad
        ? [1, 2, 3, 4, 5].map((n) => t(`mascot.sleepInactivity${n}`))
        : [1, 2, 3, 4, 5].map((n) => t(`mascot.sleepNight${n}`));
    case "Despertando":
      return [1, 2, 3].map((n) => t(`mascot.wake${n}`));
    case "Aburrida":
      return [1, 2, 3, 4].map((n) => t(`mascot.bored${n}`));
    case "TomandoAgua":
      return [
        t("mascot.drink1", { vasos, glassWord: glassWord(t, vasos) }),
        t("mascot.drink2", { actual: d.water, meta: d.metaWater }),
        t("mascot.drink3"),
        t("mascot.drink4"),
      ];
    case "Ejercicio":
      return [
        t("mascot.exercise1"),
        t("mascot.exercise2"),
        d.burned > 0 ? t("mascot.exercise3burned", { kcal: d.burned }) : t("mascot.exercise3noBurned"),
        t("mascot.exercise4"),
      ];
    case "LlenoDeComida":
      return [
        t("mascot.full1"),
        t("mascot.full2", { actual: d.kcalEaten, meta: d.metaKcal }),
        t("mascot.full3"),
        t("mascot.full4"),
      ];
    case "Celebrando":
      return [1, 2, 3, 4].map((n) => t(`mascot.celebrate${n}`));
    default:
      // Respirando: se queda el sistema de frases con datos y tips de siempre.
      return fallback;
  }
}

function stateLabel(state: MascotState, t: T): string {
  const MAP: Record<MascotState, string> = {
    Respirando: t("mascot.stateBreathing"),
    Aburrida: t("mascot.stateBored"),
    Durmiendo: t("mascot.stateSleeping"),
    Despertando: t("mascot.stateWaking"),
    TomandoAgua: t("mascot.stateDrinkingWater"),
    Ejercicio: t("mascot.stateExercise"),
    LlenoDeComida: t("mascot.stateFull"),
    Celebrando: t("mascot.stateCelebrating"),
  };
  return MAP[state];
}

// El ánimo (mood) ya no llega por prop: el estado del video lo comunica y se
// calcula aquí adentro con los mismos datos del día.
export default function CoachAvatar({ messages }: { messages: string[] }) {
  const reduce = useReducedMotion();
  const { profile, water, kcalEaten, proteinG, kcalBudget, burnedKcal, workout, t } = useApp();
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
      const timer = setTimeout(() => setBubbleVisible(false), PHRASE_HOLD_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setI((n) => n + 1);
      setBubbleVisible(true);
    }, PHRASE_GAP_MS);
    return () => clearTimeout(timer);
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
      const timer = setTimeout(() => setLastAction(undefined), TRANSIENT_MS[ev.type] + 100);
      return () => clearTimeout(timer);
    }
  }, [water, kcalEaten, proteinG, workout?.done, kcalBudget, profile.metaWater, profile.metaProtein, profile.metaKcal]);

  // Reloj propio: se refresca cada minuto y de él salen la hora y el tiempo
  // de inactividad. Leer Date.now() durante el render sería impuro (React
  // puede repetir renders) y además no volvería a evaluarse solo.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(timer);
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
    if (firmaPrevia.current === datosFirma) return;
    firmaPrevia.current = datosFirma;
    // Compara contra la ÚLTIMA FIRMA GUARDADA (localStorage), no contra la
    // nada: así, si el dato cambió mientras este componente no estaba
    // montado (subiste el desayuno desde el chat o el escáner y volviste a
    // Hoy), el cambio real SÍ se detecta. Sin firma previa guardada (primera
    // vez que corre esto en el dispositivo) solo se siembra, sin contar como
    // actividad — abrir la app por primera vez no debe resetear el sueño.
    const guardada = leerUltimaFirma();
    guardarUltimaFirma(datosFirma);
    if (guardada === null || guardada === datosFirma) return;
    // El setState va dentro de un callback (no directo en el cuerpo del
    // efecto): React desaconseja llamarlo síncrono ahí porque encadena
    // renders. El retraso de 0ms es imperceptible.
    const timer = setTimeout(() => {
      const ahora = Date.now();
      guardarUltimoRegistro(ahora);
      setUltimoRegistro(ahora);
    }, 0);
    return () => clearTimeout(timer);
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
    const timer = setInterval(() => {
      const reminder = pendingReminder(dataRef.current);
      if (reminder) {
        setPulse(reminder);
        hide = setTimeout(() => setPulse(null), PULSE_SHOW_MS);
      }
    }, PULSE_EVERY_MS);
    return () => {
      clearInterval(timer);
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
      const timer = setTimeout(() => setWaking(false), WAKE_MS);
      return () => clearTimeout(timer);
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
      // De noche no: solo cuando se durmió por llevar rato sin registros.
      duermePorInactividad: data.minutosInactiva >= SLEEP_AFTER_MIN && data.hour >= 6 && data.hour < 23,
    },
    messages,
    t
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
      aria-label={`${stateLabel(state, t)}: ${message}. ${t("mascot.tapHint")}`}
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
