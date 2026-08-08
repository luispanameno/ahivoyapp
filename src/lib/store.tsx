"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import * as db from "./db";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { analyze, CoachAction, CoachResult } from "./analyze";
import { resizeDataURL } from "./img";
import { Lang, translate, writeLocalLang } from "./i18n";
import {
  Activity,
  BodyComp,
  ChatMessage,
  DEFAULT_PROFILE,
  DEFAULT_ROUTINE,
  Drink,
  Meal,
  MealTime,
  MeasurementEntry,
  Profile,
  Routine,
  RoutineDay,
  SleepState,
  WeightEntry,
  WorkoutState,
  currentMealTime,
  todayISO,
} from "./types";

// El chat se guarda de forma permanente; solo se borra con el botón "Limpiar".
// OJO: la clave lleva el id del usuario. En un mismo teléfono pueden entrar
// varias cuentas (o alguien crear una nueva), y el chat es privado: sin el
// id, la cuenta nueva heredaba la conversación de la anterior.
const CHAT_KEY_PREFIX = "ahivoy:chat";
const LEGACY_CHAT_KEY = "ahivoy:chat"; // clave global vieja, sin usuario

function chatKey(userId: string | null): string {
  return `${CHAT_KEY_PREFIX}:${userId ?? "local"}`;
}

function loadChat(userId: string | null, greeting: ChatMessage): ChatMessage[] {
  if (typeof window === "undefined") return [greeting];
  try {
    const raw = localStorage.getItem(chatKey(userId));
    if (raw) {
      const saved = JSON.parse(raw) as { messages: ChatMessage[] };
      if (saved.messages?.length) return saved.messages;
    }
  } catch {
    // chat corrupto: empezamos de cero
  }
  return [greeting];
}

function saveChat(userId: string | null, messages: ChatMessage[]) {
  try {
    // Las imágenes que llegan aquí ya son miniaturas chicas (ver sendChat):
    // se guardan tal cual, así las fotos del historial siguen visibles
    // después de cerrar y reabrir la app, en vez de perderse.
    localStorage.setItem(chatKey(userId), JSON.stringify({ messages: messages.slice(-60) }));
  } catch {
    // sin espacio: no pasa nada
  }
}

// Borra el chat global de versiones anteriores. Existía una sola clave para
// todo el dispositivo, así que se quita en el primer arranque para que nadie
// vea la conversación de quien usó la app antes que él.
function dropLegacyChat() {
  try {
    localStorage.removeItem(LEGACY_CHAT_KEY);
  } catch {
    // sin acceso a storage: no pasa nada
  }
}

// Marcador de "ya le sugerí el ajuste por esta báscula". Sin esto, el Coach
// repetiría la propuesta de nuevas metas en CADA mensaje del día, porque la
// lectura sigue siendo la más reciente. Guarda la fecha ya sugerida.
const SCALE_KEY_PREFIX = "ahivoy:scale_suggested";

function scaleKey(userId: string | null): string {
  return `${SCALE_KEY_PREFIX}:${userId ?? "local"}`;
}

function wasScaleSuggested(userId: string | null, date: string): boolean {
  try {
    return localStorage.getItem(scaleKey(userId)) === date;
  } catch {
    return false;
  }
}

function markScaleSuggested(userId: string | null, date: string) {
  try {
    localStorage.setItem(scaleKey(userId), date);
  } catch {
    // sin espacio: como mucho, se vuelve a ofrecer el ajuste
  }
}

// Marcador de "pregunta en curso": si el navegador mata la app a media
// respuesta (ej. el sistema operativo cierra la pestaña/PWA en segundo
// plano — algo que ningún estado en memoria puede evitar), al reabrir la
// app detectamos el marcador huérfano y avisamos en vez de dejar el chat
// en silencio para siempre.
const PENDING_KEY_PREFIX = "ahivoy:chat_pending";

function pendingKey(userId: string | null): string {
  return `${PENDING_KEY_PREFIX}:${userId ?? "local"}`;
}

function setPendingMarker(userId: string | null, text: string) {
  try {
    localStorage.setItem(pendingKey(userId), JSON.stringify({ text, ts: Date.now() }));
  } catch {
    // sin espacio: no pasa nada
  }
}

function clearPendingMarker(userId: string | null) {
  try {
    localStorage.removeItem(pendingKey(userId));
  } catch {
    // sin acceso a storage: no pasa nada
  }
}

// Devuelve (y borra) la pregunta que quedó a medias. Si tiene más de 10
// minutos la descartamos: a esas alturas reenviarla sola sería raro, el
// usuario ya se fue hace rato.
const PENDING_MAX_AGE_MS = 10 * 60 * 1000;

function takeOrphanedPending(userId: string | null): string | null {
  try {
    const raw = localStorage.getItem(pendingKey(userId));
    if (!raw) return null;
    localStorage.removeItem(pendingKey(userId));
    const { text, ts } = JSON.parse(raw) as { text: string; ts: number };
    if (typeof ts === "number" && Date.now() - ts > PENDING_MAX_AGE_MS) return null;
    return text || null;
  } catch {
    return null;
  }
}

// Busca una comida por descripción (exacta o aproximada) — la usa el Coach.
function matchMeal(lista: { id: string; desc: string }[], desc: string) {
  const q = desc.trim().toLowerCase();
  return (
    lista.find((m) => m.desc.toLowerCase() === q) ??
    lista.find((m) => m.desc.toLowerCase().includes(q) || q.includes(m.desc.toLowerCase()))
  );
}

// ---- Normalización de las acciones del Coach ----
// La IA devuelve las acciones como texto libre (en modo coach no se puede
// usar responseSchema: hace que los modelos entren en bucles), así que a
// veces llegan a medias: un log_meal SIN "desc", el tiempo de comida
// traducido ("Breakfast" en vez de "Desayuno") o los números como string.
// Cada una de esas variantes se perdía EN SILENCIO:
//   - sin "desc", applyChatActions descartaba la acción… pero el Tablero
//     (que se calcula aparte, ver simulateBoardTotals) SÍ contaba la comida.
//     Resultado: el chat decía "ya lo registré" con los contadores intactos
//     y la comida nunca aparecía en Historial.
//   - con el tiempo traducido, la fila la rechaza el CHECK de "tiempo" en
//     Supabase (solo acepta los 4 valores en español) y la comida se
//     desvanecía al recargar.
// Normalizamos UNA sola vez y de ahí salen tanto lo que se guarda como el
// Tablero, así no pueden discrepar nunca.

const MEAL_TIME_ALIASES: Record<string, MealTime> = {
  desayuno: "Desayuno",
  breakfast: "Desayuno",
  almuerzo: "Almuerzo",
  comida: "Almuerzo",
  lunch: "Almuerzo",
  cena: "Cena",
  dinner: "Cena",
  supper: "Cena",
  snack: "Snack",
  snacks: "Snack",
  merienda: "Snack",
  bocadillo: "Snack",
};

function canonicalMealTime(raw: unknown): MealTime | null {
  if (typeof raw !== "string") return null;
  return MEAL_TIME_ALIASES[raw.trim().toLowerCase()] ?? null;
}

// Los modelos a veces mandan "259" (texto) en vez de 259; sumarlo tal cual
// concatenaba strings y descuadraba el Tablero.
function num(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

const NUM_FIELDS = [
  "ml", "lb", "kcal", "minutos", "p", "c", "f",
  "peso_lb", "score", "imc", "grasa_pct", "agua_pct", "proteina_pct", "bmr",
  "grasa_visceral", "musculo_lb", "masa_osea_lb",
  "pasos", "min_activos", "kcal_activas", "kcal_totales", "distancia_km",
  "brazo_cm", "cintura_cm", "pecho_cm", "pierna_cm", "gluteos_cm",
];

function normalizeActions(actions: CoachAction[] | undefined, fallbackDesc: string): CoachAction[] {
  const out: CoachAction[] = [];
  for (const raw of actions ?? []) {
    if (!raw || typeof raw.type !== "string") continue;
    const a: Record<string, unknown> = { ...raw };
    for (const k of NUM_FIELDS) {
      if (!(k in a)) continue;
      const v = num(a[k]);
      if (v === undefined) delete a[k];
      else a[k] = v;
    }
    const act = a as unknown as CoachAction;
    if (act.type === "log_meal") {
      act.time = canonicalMealTime(act.time) ?? currentMealTime();
      act.desc = act.desc?.trim() || fallbackDesc;
      // Un log_meal sin nada que sumar no es un registro real: descartarlo
      // aquí evita que el Tablero cuente una comida vacía.
      if (!act.kcal && !act.p && !act.c && !act.f) continue;
    }
    out.push(act);
  }
  return out;
}

// ---- Tablero Nutricional determinista ----
// El prompt del servidor le pasa a la IA los números reales, pero el bloque
// del Tablero lo redacta ella misma en texto libre (tiene que "sumar" lo que
// acaba de registrar en la misma respuesta) — y esa cuenta a veces no cuadra
// con lo que de verdad queda guardado, que es justo lo que muestra Hoy. Para
// que el chat NUNCA pueda mostrar un macro distinto al de Hoy, el bloque se
// recalcula acá con la misma lógica que usa `derived` y se pisa el de la IA.
interface BoardTotals {
  kcalEaten: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  water: number;
  metaKcal: number;
  metaProtein: number;
  metaCarbs: number;
  metaFat: number;
  metaWater: number;
}

function simulateBoardTotals(actions: CoachAction[], meals: Meal[], today: string, base: BoardTotals): BoardTotals {
  const t = { ...base };
  for (const a of actions) {
    // Acciones de OTRO día no tocan el tablero de hoy.
    if (a.fecha && /^\d{4}-\d{2}-\d{2}$/.test(a.fecha) && a.fecha !== today) continue;
    if (a.type === "add_water" && a.ml) t.water += a.ml;
    else if (a.type === "remove_water" && a.ml) t.water -= Math.min(a.ml, t.water);
    else if (a.type === "log_meal") {
      t.kcalEaten += a.kcal ?? 0;
      t.proteinG += a.p ?? 0;
      t.carbsG += a.c ?? 0;
      t.fatG += a.f ?? 0;
    } else if (a.type === "delete_meal" && a.desc) {
      const meal = matchMeal(meals, a.desc) as Meal | undefined;
      if (meal) {
        t.kcalEaten -= meal.kcal;
        t.proteinG -= meal.p;
        t.carbsG -= meal.c;
        t.fatG -= meal.f;
      }
    } else if (a.type === "update_meal" && a.desc) {
      const meal = matchMeal(meals, a.desc) as Meal | undefined;
      if (meal) {
        t.kcalEaten += (a.kcal ?? meal.kcal) - meal.kcal;
        t.proteinG += (a.p ?? meal.p) - meal.p;
        t.carbsG += (a.c ?? meal.c) - meal.c;
        t.fatG += (a.f ?? meal.f) - meal.f;
      }
    } else if (a.type === "set_meta_kcal" && a.kcal) t.metaKcal = Math.round(a.kcal);
    else if (a.type === "set_meta_water" && a.ml) t.metaWater = Math.round(a.ml);
    else if (a.type === "set_macros" && a.kcal) {
      t.metaKcal = Math.round(a.kcal);
      t.metaProtein = Math.round(a.p ?? t.metaProtein);
      t.metaCarbs = Math.round(a.c ?? t.metaCarbs);
      t.metaFat = Math.round(a.f ?? t.metaFat);
    }
  }
  t.kcalEaten = Math.max(0, Math.round(t.kcalEaten));
  t.proteinG = Math.max(0, Math.round(t.proteinG));
  t.carbsG = Math.max(0, Math.round(t.carbsG));
  t.fatG = Math.max(0, Math.round(t.fatG));
  t.water = Math.max(0, Math.round(t.water));
  return t;
}

// Arma el bloque del Tablero con números reales, mismo formato y mismas
// etiquetas que el prompt le pide a la IA — la sustitución es invisible.
function renderTablero(lang: Lang, tt: BoardTotals): string {
  const en = lang === "en";
  const diff = (actual: number, meta: number) => Math.abs(meta - actual);
  const tail = (
    actual: number,
    meta: number,
    overEs: string,
    overEn: string
  ) =>
    actual > meta
      ? en
        ? `${overEn} ${diff(actual, meta)}`
        : `${overEs} ${diff(actual, meta)}`
      : en
      ? `${diff(actual, meta)} left`
      : `faltan ${diff(actual, meta)}`;

  const title = en ? "📱 **NUTRITION DASHBOARD** 📱" : "📱 **TABLERO NUTRICIONAL** 📱";
  return [
    title,
    `🟢 🔥 ${en ? "Calories" : "Calorías"}: ${tt.kcalEaten} / ${tt.metaKcal} kcal (${tail(tt.kcalEaten, tt.metaKcal, "ya te pasaste", "over")})`,
    `🟡 🍞 Carbs: ${tt.carbsG} / ${tt.metaCarbs} g (${tail(tt.carbsG, tt.metaCarbs, "te pasaste", "over")})`,
    `🔵 🍗 ${en ? "Protein" : "Proteína"}: ${tt.proteinG} / ${tt.metaProtein} g (${tail(tt.proteinG, tt.metaProtein, "superada por", "over")})`,
    `🟠 🥑 ${en ? "Fat" : "Grasas"}: ${tt.fatG} / ${tt.metaFat} g (${tail(tt.fatG, tt.metaFat, "te pasaste", "over")})`,
    `💧 ${en ? "Water" : "Agua"}: ${tt.water} / ${tt.metaWater} ml (${
      tt.water > tt.metaWater
        ? en
          ? `goal met, +${diff(tt.water, tt.metaWater)} over`
          : `ya cumpliste, +${diff(tt.water, tt.metaWater)} de más`
        : en
        ? `${diff(tt.water, tt.metaWater)} left`
        : `faltan ${diff(tt.water, tt.metaWater)}`
    })`,
  ].join("\n");
}

// Detecta y reemplaza el bloque del Tablero dentro de la respuesta del Coach.
// Misma detección que splitTablero() en coach/page.tsx: el título se ubica
// por el emoji 📱 (no por el texto, que en inglés viene traducido).
function replaceTablero(reply: string, board: string): string {
  if (!reply.includes("📱")) return reply;
  const lines = reply.split("\n");
  const start = lines.findIndex((l) => l.includes("📱"));
  if (start === -1) return reply;
  let end = start;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l === "" && end === start) continue;
    if (/^(🟢|🟡|🔵|🟠|💧)/.test(l)) end = i;
    else if (l !== "") break;
  }
  return [...lines.slice(0, start), board, ...lines.slice(end + 1)].join("\n");
}

interface AppState {
  ready: boolean;
  userEmail: string | null;
  profile: Profile;
  lang: Lang;
  t: (key: string, vars?: Record<string, string | number>) => string;
  meals: Meal[];
  drinks: Drink[];
  water: number; // suma de "drinks" del día — se calcula sola, no se guarda
  activity: Activity | null;
  workout: WorkoutState | null;
  sleep: SleepState | null;
  bodyComp: BodyComp | null;
  routine: Routine;
  weights: WeightEntry[];
  measurements: MeasurementEntry[];
  toast: string | null;

  // chat del Coach — vive aquí (no en la página) para que una respuesta en
  // curso no se pierda si el usuario cambia de pestaña y vuelve antes de
  // que la IA conteste.
  chatMessages: ChatMessage[];
  chatTyping: boolean;
  sendChat: (text: string, image?: string, opts?: { resend?: boolean }) => Promise<void>;
  clearChat: () => void;

  // derivados
  kcalEaten: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  burnedKcal: number;
  kcalBudget: number;
  kcalRemaining: number;

  // acciones
  showToast: (msg: string) => void;
  saveProfile: (p: Profile) => Promise<void>;
  addMeal: (m: Omit<Meal, "id" | "date">) => Promise<void>;
  updateMeal: (m: Meal) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  addWater: (ml: number, label?: string) => Promise<void>;
  updateDrink: (d: Drink) => Promise<void>;
  deleteDrink: (id: string) => Promise<void>;
  setActivity: (a: Activity) => Promise<void>;
  setWorkout: (w: WorkoutState) => Promise<void>;
  setSleep: (s: SleepState) => Promise<void>;
  setBodyComp: (b: BodyComp, weightLb?: number) => Promise<void>;
  saveRoutine: (r: Routine) => Promise<void>;
  setWeight: (lb: number) => Promise<void>;
  setWeightGoal: (lb: number) => Promise<void>;
  addMeasurement: (m: Omit<MeasurementEntry, "date">) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp fuera de AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const lang: Lang = profile.language ?? "es";
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );
  // La pantalla de login (sin sesión, sin AppProvider) lee este respaldo en
  // localStorage — se mantiene al día con cada carga/cambio de perfil.
  useEffect(() => {
    writeLocalLang(lang);
  }, [lang]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [activity, setActivityState] = useState<Activity | null>(null);
  const [workout, setWorkoutState] = useState<WorkoutState | null>(null);
  const [sleep, setSleepState] = useState<SleepState | null>(null);
  const [bodyComp, setBodyCompState] = useState<BodyComp | null>(null);
  const [routine, setRoutineState] = useState<Routine>(DEFAULT_ROUTINE);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat del Coach: vive en el provider, no en la página /coach, para que
  // una respuesta que sigue en camino no se pierda si el usuario navega
  // a otra pestaña y vuelve.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatTyping, setChatTyping] = useState(false);
  const chatHydratedRef = useRef(false);
  // Id del usuario de la sesión: separa el chat guardado por cuenta.
  const userIdRef = useRef<string | null>(null);
  // Pregunta que quedó sin respuesta porque la app se recargó a media
  // respuesta: se reenvía sola en cuanto el chat termina de hidratarse.
  const [pendingRetry, setPendingRetry] = useState<string | null>(null);
  const retryFiredRef = useRef(false);

  const date = todayISO();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isSupabaseConfigured) {
        const sb = getSupabase()!;
        const { data } = await sb.auth.getSession();
        // Excepción SOLO en desarrollo: /dev-onboarding-preview renderiza el
        // asistente de bienvenida sin sesión real, para poder revisarlo sin
        // tener que crear+aprobar una cuenta cada vez.
        const isDevPreview = process.env.NODE_ENV !== "production" && pathname === "/dev-onboarding-preview";
        if (!data.session && !isDevPreview) {
          router.replace("/login");
          return;
        }
        if (data.session) userIdRef.current = data.session.user.id;
        if (!cancelled && data.session) setUserEmail(data.session.user.email ?? null);
      }
      dropLegacyChat();
      const all = await db.loadAll(date);
      if (cancelled) return;
      setProfile(all.profile);
      setMeals(all.meals);
      setDrinks(all.drinks);
      setActivityState(all.activity);
      setWorkoutState(all.workout);
      setSleepState(all.sleep);
      setBodyCompState(all.bodyComp);
      setRoutineState(all.routine);
      setWeights(all.weights);
      setMeasurements(all.measurements);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sesión expirada: si el token caduca y no se puede refrescar, Supabase
  // emite SIGNED_OUT. Ahí mandamos al usuario a iniciar sesión de nuevo
  // en vez de dejar la app fallando en silencio.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabase()!;
    const { data } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  // Carga el chat guardado (o el saludo inicial) una sola vez, cuando ya
  // conocemos el perfil (para personalizar el saludo con el nombre).
  useEffect(() => {
    if (!ready || chatHydratedRef.current) return;
    chatHydratedRef.current = true;
    const firstName = profile.name ? profile.name.split(" ")[0] : "";
    const greeting: ChatMessage = {
      role: "coach",
      text: t("store.greetingInitial", { name: firstName ? " " + firstName : "" }),
    };
    const uid = userIdRef.current;
    const messages = loadChat(uid, greeting);
    // Si quedó un marcador huérfano, la app se recargó a media respuesta
    // (el SO cerró la PWA en segundo plano, se recargó la página…). Tu
    // mensaje ya está guardado en el historial: reenviamos la pregunta sola
    // para que la conversación siga donde iba, sin pedirte que la repitas.
    const orphaned = takeOrphanedPending(uid);
    setChatMessages(messages);
    if (orphaned && orphaned !== "(foto)") {
      setPendingRetry(orphaned);
    } else if (orphaned === "(foto)") {
      // Una foto no se guarda en el historial (pesa demasiado), así que
      // esa sí hay que pedirla de nuevo.
      setChatMessages([
        ...messages,
        {
          role: "coach",
          text: t("store.photoResponseLost"),
        },
      ]);
    }
  }, [ready, profile.name, t]);

  useEffect(() => {
    if (chatMessages.length > 1) saveChat(userIdRef.current, chatMessages);
  }, [chatMessages]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // Todas las mutaciones son OPTIMISTAS: primero se pinta el cambio y luego
  // se guarda. Si la base lo rechaza (sin conexión, sesión caída, un CHECK
  // que no cuadra…) hay que DESHACER el cambio local antes de propagar el
  // error — si no, el dato se queda en pantalla como si se hubiera guardado
  // y desaparece en la siguiente recarga, que es justo la "pérdida
  // silenciosa" que estamos persiguiendo. Quien llama decide qué mostrar.
  const saveProfile = useCallback(
    async (p: Profile) => {
      const prev = profile;
      setProfile(p);
      try {
        await db.saveProfile(p);
      } catch (e) {
        setProfile(prev);
        throw e;
      }
    },
    [profile]
  );

  const addMeal = useCallback(
    async (m: Omit<Meal, "id" | "date">) => {
      const meal: Meal = { ...m, id: crypto.randomUUID(), date };
      setMeals((prev) => [...prev, meal]);
      try {
        await db.addMeal(meal);
      } catch (e) {
        // Se revierte por id, no restaurando la lista entera: así no se
        // pierde nada que se haya agregado mientras tanto.
        setMeals((prev) => prev.filter((x) => x.id !== meal.id));
        throw e;
      }
    },
    [date]
  );

  const updateMeal = useCallback(
    async (m: Meal) => {
      const before = meals.find((x) => x.id === m.id);
      setMeals((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      try {
        await db.updateMeal(m);
      } catch (e) {
        if (before) setMeals((prev) => prev.map((x) => (x.id === m.id ? before : x)));
        throw e;
      }
    },
    [meals]
  );

  const deleteMeal = useCallback(
    async (id: string) => {
      const before = meals.find((x) => x.id === id);
      setMeals((prev) => prev.filter((x) => x.id !== id));
      try {
        await db.deleteMeal(id);
      } catch (e) {
        if (before) setMeals((prev) => (prev.some((x) => x.id === id) ? prev : [...prev, before]));
        throw e;
      }
    },
    [meals]
  );

  // Cada llamada crea un NUEVO registro (como una comida) en vez de
  // sobreescribir un total único: así cualquier valor erróneo se puede
  // borrar en Historial y nunca queda un número dañado sin forma de arreglarlo.
  const addWater = useCallback(
    async (ml: number, label?: string) => {
      const entry: Drink = {
        id: crypto.randomUUID(),
        date,
        ml,
        label: label || (ml < 0 ? t("hoy.adjustment") : t("resumen.water")),
      };
      setDrinks((prev) => [...prev, entry]);
      try {
        await db.addDrink(entry);
      } catch (e) {
        setDrinks((prev) => prev.filter((x) => x.id !== entry.id));
        throw e;
      }
    },
    [date, t]
  );

  const updateDrink = useCallback(
    async (d: Drink) => {
      const before = drinks.find((x) => x.id === d.id);
      setDrinks((prev) => prev.map((x) => (x.id === d.id ? d : x)));
      try {
        await db.updateDrink(d);
      } catch (e) {
        if (before) setDrinks((prev) => prev.map((x) => (x.id === d.id ? before : x)));
        throw e;
      }
    },
    [drinks]
  );

  const deleteDrink = useCallback(
    async (id: string) => {
      const before = drinks.find((x) => x.id === id);
      setDrinks((prev) => prev.filter((d) => d.id !== id));
      try {
        await db.deleteDrink(id);
      } catch (e) {
        if (before) setDrinks((prev) => (prev.some((x) => x.id === id) ? prev : [...prev, before]));
        throw e;
      }
    },
    [drinks]
  );

  const setActivity = useCallback(
    async (a: Activity) => {
      const before = activity;
      setActivityState(a);
      try {
        await db.setActivity(date, a);
      } catch (e) {
        setActivityState(before);
        throw e;
      }
    },
    [date, activity]
  );

  const setWorkout = useCallback(
    async (w: WorkoutState) => {
      const before = workout;
      setWorkoutState(w);
      try {
        await db.setWorkout(date, w);
      } catch (e) {
        setWorkoutState(before);
        throw e;
      }
    },
    [date, workout]
  );

  const setSleep = useCallback(
    async (s: SleepState) => {
      const before = sleep;
      setSleepState(s);
      try {
        await db.setSleep(date, s);
      } catch (e) {
        setSleepState(before);
        throw e;
      }
    },
    [date, sleep]
  );

  const setWeight = useCallback(
    async (lb: number) => {
      const beforeProfile = profile;
      const beforeWeights = weights;
      const p = { ...profile, weight: lb };
      const entry = { date, lb };
      setProfile(p);
      setWeights((prev) => [...prev.filter((w) => w.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date)));
      try {
        await db.saveProfile(p);
        await db.addWeight(entry);
      } catch (e) {
        // Son dos escrituras: si la segunda falla también se revierte la
        // primera, para no dejar el perfil y el historial descuadrados.
        setProfile(beforeProfile);
        setWeights(beforeWeights);
        throw e;
      }
    },
    [profile, weights, date]
  );

  const setWeightGoal = useCallback(
    async (lb: number) => {
      const before = profile;
      const p = { ...profile, weightGoal: lb };
      setProfile(p);
      try {
        await db.saveProfile(p);
      } catch (e) {
        setProfile(before);
        throw e;
      }
    },
    [profile]
  );

  const addMeasurement = useCallback(
    async (m: Omit<MeasurementEntry, "date">) => {
      const entry: MeasurementEntry = { date, ...m };
      const before = measurements;
      // Se combina con lo que ya hubiera guardado hoy (igual que en db.ts):
      // así completar solo el brazo no borra la cintura anotada esta mañana.
      setMeasurements((prev) => {
        const existing = prev.find((x) => x.date === date);
        const merged: MeasurementEntry = {
          date,
          armCm: entry.armCm ?? existing?.armCm,
          waistCm: entry.waistCm ?? existing?.waistCm,
          chestCm: entry.chestCm ?? existing?.chestCm,
          legCm: entry.legCm ?? existing?.legCm,
          gluteCm: entry.gluteCm ?? existing?.gluteCm,
        };
        return [...prev.filter((x) => x.date !== date), merged].sort((a, b) => a.date.localeCompare(b.date));
      });
      try {
        await db.addMeasurement(entry);
      } catch (e) {
        setMeasurements(before);
        throw e;
      }
    },
    [date, measurements]
  );

  const setBodyComp = useCallback(
    async (b: BodyComp, weightLb?: number) => {
      const beforeComp = bodyComp;
      const beforeProfile = profile;
      const beforeWeights = weights;
      setBodyCompState(b);
      const p = weightLb && weightLb > 0 ? { ...profile, weight: weightLb } : null;
      const entry = weightLb && weightLb > 0 ? { date, lb: weightLb } : null;
      if (p) setProfile(p);
      if (entry)
        setWeights((prev) => [...prev.filter((w) => w.date !== date), entry].sort((a, c) => a.date.localeCompare(c.date)));
      try {
        await db.addBodyComp(b);
        if (p) await db.saveProfile(p);
        if (entry) await db.addWeight(entry);
      } catch (e) {
        setBodyCompState(beforeComp);
        setProfile(beforeProfile);
        setWeights(beforeWeights);
        throw e;
      }
    },
    [profile, weights, bodyComp, date]
  );

  const saveRoutine = useCallback(
    async (r: Routine) => {
      const before = routine;
      setRoutineState(r);
      try {
        await db.saveRoutine(r);
      } catch (e) {
        setRoutineState(before);
        throw e;
      }
    },
    [routine]
  );

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    // El chat en memoria es de la cuenta que se va: se limpia para que la
    // siguiente que entre en este teléfono no alcance a verlo. Lo guardado
    // en localStorage sigue ahí, pero bajo la clave de SU usuario.
    setChatMessages([]);
    chatHydratedRef.current = false;
    userIdRef.current = null;
    router.replace("/login");
  }, [router]);

  const derived = useMemo(() => {
    const sum = (k: "kcal" | "p" | "c" | "f") =>
      meals.reduce((a, m) => a + (Number(m[k]) || 0), 0);
    const kcalEaten = sum("kcal");
    const activityBurned = activity?.activityKcal ?? 0;
    const workoutBurned = workout?.done ? workout.kcal : 0;
    // La actividad del reloj normalmente ya incluye el entrenamiento;
    // tomamos el mayor de los dos para no duplicar.
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
      kcalRemaining: Math.max(0, kcalBudget - kcalEaten),
      water,
    };
  }, [meals, activity, workout, profile.metaKcal, drinks]);

  // Acciones que el Coach detecta en el mensaje del usuario (agregar agua,
  // registrar comida, cambiar metas, etc.) — vive aquí para poder aplicarse
  // aunque la respuesta llegue después de que el usuario cambió de pantalla.
  // Devuelve QUÉ acciones se aplicaron de verdad: el Tablero del chat se
  // dibuja solo con esas, así el mensaje del Coach nunca puede afirmar que
  // registró algo que en realidad no se guardó.
  const applyChatActions = useCallback(
    async (actions: CoachAction[]): Promise<{ applied: CoachAction[]; failed: number }> => {
      const today = date;
      const applied: CoachAction[] = [];
      let failed = 0;
      for (const a of actions) {
        try {
          const fecha = a.fecha && /^\d{4}-\d{2}-\d{2}$/.test(a.fecha) && a.fecha !== today ? a.fecha : null;

          if (!fecha) {
            // ---- Acciones sobre HOY (actualizan la pantalla al instante) ----
            if (a.type === "add_water" && a.ml) await addWater(a.ml);
            else if (a.type === "remove_water" && a.ml) {
              const removeMl = Math.min(a.ml, derived.water);
              if (removeMl > 0) await addWater(-removeMl, t("hoy.adjustment"));
            } else if (a.type === "delete_meal" && a.desc) {
              const meal = matchMeal(meals, a.desc);
              if (meal) await deleteMeal(meal.id);
            } else if (a.type === "update_meal" && a.desc) {
              const meal = matchMeal(meals, a.desc) as (typeof meals)[number] | undefined;
              if (meal)
                await updateMeal({
                  ...meal,
                  kcal: a.kcal ?? meal.kcal,
                  p: a.p ?? meal.p,
                  c: a.c ?? meal.c,
                  f: a.f ?? meal.f,
                });
            } else if (a.type === "set_weight" && a.lb) await setWeight(a.lb);
            else if (a.type === "set_goal_weight" && a.lb) await setWeightGoal(a.lb);
            else if (a.type === "set_meta_kcal" && a.kcal) await saveProfile({ ...profile, metaKcal: a.kcal });
            else if (a.type === "set_meta_water" && a.ml) await saveProfile({ ...profile, metaWater: Math.round(a.ml) });
            else if (a.type === "log_sleep" && a.minutos) await setSleep({ minutes: a.minutos, phases: sleep?.phases ?? null });
            else if (a.type === "delete_sleep") await setSleep({ minutes: 0, phases: null });
            else if (a.type === "log_workout")
              await setWorkout({
                day: workout?.day ?? "Push",
                done: true,
                kcal: a.kcal ?? 300,
                name: a.nombre ?? "Entrenamiento",
                notes: workout?.notes ?? "",
                // Se suma a lo que ya hubiera hoy: si reportás varias
                // sesiones en el día, "Tiempo de actividad" las acumula
                // todas en vez de quedarse solo con la última.
                minutes: (workout?.minutes ?? 0) + Math.round(a.minutos ?? 0),
              });
            else if (a.type === "delete_workout")
              await setWorkout({ day: workout?.day ?? "Push", done: false, kcal: 0, name: "", notes: workout?.notes ?? "", minutes: 0 });
            else if (a.type === "set_activity")
              await setActivity({
                steps: Math.round(a.pasos ?? 0),
                activeMin: Math.round(a.min_activos ?? 0),
                activityKcal: Math.round(a.kcal_activas ?? 0),
                totalKcal: Math.round(a.kcal_totales ?? 0),
                distance: a.distancia_km ?? 0,
                synced: true,
              });
            else if (a.type === "log_meal" && a.desc)
              await addMeal({
                time: (a.time as MealTime) || currentMealTime(),
                desc: a.desc,
                kcal: a.kcal ?? 0,
                p: a.p ?? 0,
                c: a.c ?? 0,
                f: a.f ?? 0,
              });
            else if (a.type === "set_macros" && a.kcal)
              await saveProfile({
                ...profile,
                metaKcal: Math.round(a.kcal),
                metaProtein: Math.round(a.p ?? profile.metaProtein),
                metaCarbs: Math.round(a.c ?? profile.metaCarbs),
                metaFat: Math.round(a.f ?? profile.metaFat),
              });
            else if (a.type === "set_body_comp")
              await setBodyComp(
                {
                  score: Math.round(a.score ?? 0),
                  build: a.complexion || "—",
                  bmi: a.imc ?? 0,
                  fatPct: a.grasa_pct ?? 0,
                  waterPct: a.agua_pct ?? 0,
                  proteinPct: a.proteina_pct ?? 0,
                  bmr: Math.round(a.bmr ?? 0),
                  visceralFat: a.grasa_visceral ?? 0,
                  muscle: a.musculo_lb ?? 0,
                  boneMass: a.masa_osea_lb ?? 0,
                  date: today,
                },
                a.peso_lb && a.peso_lb > 0 ? a.peso_lb : undefined
              );
            else if (
              a.type === "set_measurements" &&
              (a.brazo_cm || a.cintura_cm || a.pecho_cm || a.pierna_cm || a.gluteos_cm)
            )
              await addMeasurement({
                armCm: a.brazo_cm,
                waistCm: a.cintura_cm,
                chestCm: a.pecho_cm,
                legCm: a.pierna_cm,
                gluteCm: a.gluteos_cm,
              });
          } else {
            // ---- Acciones sobre OTRO día (directo a la base de datos) ----
            if (a.type === "add_water" && a.ml) {
              await db.addDrink({ id: crypto.randomUUID(), date: fecha, ml: a.ml, label: t("resumen.water") });
            } else if (a.type === "remove_water" && a.ml) {
              const actual = (await db.drinksFor(fecha)).reduce((s, d) => s + d.ml, 0);
              const removeMl = Math.min(a.ml, actual);
              if (removeMl > 0) {
                await db.addDrink({ id: crypto.randomUUID(), date: fecha, ml: -removeMl, label: t("hoy.adjustment") });
              }
            } else if (a.type === "log_meal" && a.desc) {
              await db.addMeal({
                id: crypto.randomUUID(),
                date: fecha,
                time: (a.time as MealTime) || "Snack",
                desc: a.desc,
                kcal: a.kcal ?? 0,
                p: a.p ?? 0,
                c: a.c ?? 0,
                f: a.f ?? 0,
              });
            } else if (a.type === "delete_meal" && a.desc) {
              const meal = matchMeal(await db.mealsFor(fecha), a.desc);
              if (meal) await db.deleteMeal(meal.id);
            } else if (a.type === "update_meal" && a.desc) {
              const lista = await db.mealsFor(fecha);
              const meal = matchMeal(lista, a.desc) as (typeof lista)[number] | undefined;
              if (meal)
                await db.updateMeal({
                  ...meal,
                  kcal: a.kcal ?? meal.kcal,
                  p: a.p ?? meal.p,
                  c: a.c ?? meal.c,
                  f: a.f ?? meal.f,
                });
            } else if (a.type === "log_sleep" && a.minutos) {
              await db.setSleep(fecha, { minutes: a.minutos, phases: null });
            } else if (a.type === "delete_sleep") {
              await db.setSleep(fecha, { minutes: 0, phases: null });
            } else if (a.type === "log_workout") {
              await db.setWorkout(fecha, {
                day: (workout?.day ?? "Push") as RoutineDay,
                done: true,
                kcal: a.kcal ?? 300,
                name: a.nombre ?? "Entrenamiento",
                notes: "",
                minutes: Math.round(a.minutos ?? 0),
              });
            } else if (a.type === "delete_workout") {
              await db.setWorkout(fecha, { day: (workout?.day ?? "Push") as RoutineDay, done: false, kcal: 0, name: "", notes: "", minutes: 0 });
            } else if (a.type === "set_activity") {
              await db.setActivity(fecha, {
                steps: Math.round(a.pasos ?? 0),
                activeMin: Math.round(a.min_activos ?? 0),
                activityKcal: Math.round(a.kcal_activas ?? 0),
                totalKcal: Math.round(a.kcal_totales ?? 0),
                distance: a.distancia_km ?? 0,
                synced: true,
              });
            } else if (a.type === "set_weight" && a.lb) {
              await db.addWeight({ date: fecha, lb: a.lb });
            }
          }
          applied.push(a);
        } catch {
          // Una acción fallida no rompe el chat, pero tampoco se da por
          // buena: no entra al Tablero y el usuario recibe el aviso.
          failed += 1;
        }
      }
      if (failed) showToast(t("store.coachSaveFailed"));
      else if (applied.length) showToast(t("store.coachUpdatedData"));
      return { applied, failed };
    },
    [
      date,
      meals,
      workout,
      sleep,
      profile,
      derived.water,
      addWater,
      deleteMeal,
      updateMeal,
      setWeight,
      setWeightGoal,
      saveProfile,
      setSleep,
      setWorkout,
      setActivity,
      addMeal,
      setBodyComp,
      addMeasurement,
      showToast,
      t,
    ]
  );

  const sendChat = useCallback(
    async (text: string, image?: string, opts?: { resend?: boolean }) => {
      const clean = text.trim();
      if (!clean && !image) return;
      // En un reenvío automático el mensaje del usuario ya está en el
      // historial guardado: volver a agregarlo lo duplicaría.
      if (!opts?.resend) {
        // La miniatura (chica) es lo que se MUESTRA y se GUARDA — así la foto
        // sigue visible en el historial después de cerrar la app. La imagen
        // ORIGINAL (más grande) es la que se manda a analizar más abajo, para
        // no perder calidad en la lectura de báscula/reloj.
        let thumb = image;
        if (image) {
          try {
            thumb = await resizeDataURL(image, 480, 0.8);
          } catch {
            // si falla el redimensionado, se muestra la original tal cual
          }
        }
        const userMsg: ChatMessage = { role: "user", text: clean, image: thumb };
        setChatMessages((prev) => [...prev, userMsg]);
      }
      setChatTyping(true);
      // Si la app muere antes de que esto se limpie (el SO cierra la
      // pestaña/PWA en segundo plano), el próximo arranque encuentra este
      // marcador huérfano y reenvía la pregunta en vez de quedarse callado.
      setPendingMarker(userIdRef.current, clean || "(foto)");
      try {
        const protLeft = Math.max(0, profile.metaProtein - derived.proteinG);
        const waterLeft = Math.max(0, profile.metaWater - derived.water);
        // ¿Hay una báscula reciente (de hoy o ayer) que el Coach todavía no
        // haya comentado? Solo entonces propone ajustar las metas.
        const ayer = new Date(date + "T12:00:00");
        ayer.setDate(ayer.getDate() - 1);
        // En local, no con toISOString(): en zonas horarias al este ese
        // método devuelve el día anterior y descuadraría la comparación.
        const ayerISO = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, "0")}-${String(ayer.getDate()).padStart(2, "0")}`;
        const scaleDate = bodyComp?.date ?? null;
        const scaleIsFresh =
          !!scaleDate &&
          (scaleDate === date || scaleDate === ayerISO) &&
          !wasScaleSuggested(userIdRef.current, scaleDate);
        const context = {
          nombre: profile.name,
          idioma: lang,
          perfil: {
            edad: profile.age,
            altura_cm: profile.height,
            peso_lb: profile.weight,
            peso_meta_lb: profile.weightGoal,
            sexo: profile.sex === "F" ? "mujer" : "hombre",
            nivel_actividad: profile.activityLevel,
            plan_ejercicio: profile.exercisePlan || null,
            motivo: profile.goalMotivation || null,
            cultura_alimentaria: profile.foodCulture || null,
          },
          metas: {
            kcal: profile.metaKcal,
            proteina_g: profile.metaProtein,
            carbos_g: profile.metaCarbs,
            grasa_g: profile.metaFat,
            agua_ml: profile.metaWater,
            peso_meta_lb: profile.weightGoal,
          },
          hoy: {
            kcal_comidas: derived.kcalEaten,
            kcal_quemadas: derived.burnedKcal,
            kcal_presupuesto: profile.metaKcal + derived.burnedKcal,
            kcal_libres: derived.kcalRemaining,
            proteina_g: derived.proteinG,
            proteina_faltante_g: protLeft,
            carbos_g: derived.carbsG,
            grasa_g: derived.fatG,
            agua_ml: derived.water,
            agua_faltante_ml: waterLeft,
            entrenamiento_hecho: workout?.done ?? false,
            dia_rutina: workout?.day ?? "Push",
            sueno_min: sleep?.minutes ?? null,
          },
          comidas_hoy: meals.map((m) => ({
            desc: m.desc,
            time: m.time,
            kcal: m.kcal,
            p: m.p,
            c: m.c,
            f: m.f,
          })),
          // Últimos mensajes para que el coach recuerde qué propuso
          // (ej. macros pendientes de confirmar tras subir la báscula)
          historial_chat: chatMessages.slice(-8).map((m) => ({
            de: m.role === "user" ? "usuario" : "coach",
            texto: m.text.slice(0, 400),
          })),
          peso_actual_lb: profile.weight,
          // Última lectura de báscula + historial de peso: sin esto el Coach
          // no puede enterarse de una báscula subida desde Perfil (fuera del
          // chat) ni comparar si el peso subió o bajó.
          composicion_corporal: bodyComp
            ? {
                fecha: bodyComp.date,
                es_lectura_nueva: scaleIsFresh,
                bmr: bodyComp.bmr,
                imc: bodyComp.bmi,
                grasa_pct: bodyComp.fatPct,
                agua_pct: bodyComp.waterPct,
                proteina_pct: bodyComp.proteinPct,
                grasa_visceral: bodyComp.visceralFat,
                musculo_lb: bodyComp.muscle,
              }
            : null,
          historial_peso: weights.slice(-6).map((w) => ({ fecha: w.date, lb: w.lb })),
          // Última medida a cinta de cada parte (la más reciente que TRAIGA
          // ese campo — un registro puede venir con solo alguna): sin esto
          // el Coach no puede calcular pedidos relativos ("súbele 2cm al
          // brazo") ni saber si ya hay una medida hoy para combinarla.
          medidas_actuales: {
            brazo_cm: [...measurements].reverse().find((m) => m.armCm != null)?.armCm ?? null,
            cintura_cm: [...measurements].reverse().find((m) => m.waistCm != null)?.waistCm ?? null,
            pecho_cm: [...measurements].reverse().find((m) => m.chestCm != null)?.chestCm ?? null,
            pierna_cm: [...measurements].reverse().find((m) => m.legCm != null)?.legCm ?? null,
            gluteos_cm: [...measurements].reverse().find((m) => m.gluteCm != null)?.gluteCm ?? null,
          },
          rutina: routine,
          hora_local: new Date().toTimeString().slice(0, 5),
          fecha_hoy: date,
          dia_semana: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][new Date().getDay()],
        };
        const res = await analyze<CoachResult>({ mode: "coach", text: clean, image, context, lang });
        // Ya se le ofreció el ajuste por esta lectura: no repetirlo en cada
        // mensaje siguiente del día.
        if (scaleIsFresh && scaleDate) markScaleSuggested(userIdRef.current, scaleDate);
        // Las acciones se aplican ANTES de publicar la respuesta, y el
        // Tablero se calcula solo con las que de verdad se guardaron: antes
        // el mensaje se mostraba primero y el Tablero contaba TODO lo que
        // pidió la IA, así que una acción descartada (ej. un log_meal sin
        // "desc") dejaba al Coach diciendo "ya lo registré" con los
        // contadores de la app en cero.
        const acciones = normalizeActions(res.actions, t("store.mealFromCoach"));
        const { applied, failed } = acciones.length
          ? await applyChatActions(acciones)
          : { applied: [] as CoachAction[], failed: 0 };
        const totals = simulateBoardTotals(applied, meals, date, {
          kcalEaten: derived.kcalEaten,
          proteinG: derived.proteinG,
          carbsG: derived.carbsG,
          fatG: derived.fatG,
          water: derived.water,
          metaKcal: profile.metaKcal,
          metaProtein: profile.metaProtein,
          metaCarbs: profile.metaCarbs,
          metaFat: profile.metaFat,
          metaWater: profile.metaWater,
        });
        const board = renderTablero(lang, totals);
        let reply = replaceTablero(typeof res.reply === "string" ? res.reply : "", board);
        // La IA se quedó sin texto (respuesta vacía) pero sí registró algo:
        // mejor mostrar el Tablero que una burbuja en blanco.
        if (!reply.trim()) reply = applied.length ? `${board}\n\n${t("store.coachUpdatedData")}` : t("store.replyFailed");
        if (failed) reply += `\n\n${t("store.coachSaveFailedNote")}`;
        setChatMessages((prev) => [...prev, { role: "coach", text: reply }]);
      } catch (e) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "coach",
            text:
              e instanceof Error && e.message.includes("GEMINI")
                ? t("store.aiNotConnected")
                : t("store.replyFailed"),
          },
        ]);
      } finally {
        clearPendingMarker(userIdRef.current);
        setChatTyping(false);
      }
    },
    [profile, derived, workout, sleep, routine, meals, chatMessages, date, bodyComp, weights, measurements, lang, applyChatActions, t]
  );

  // Reenvía sola la pregunta que quedó a medias por una recarga.
  useEffect(() => {
    if (!pendingRetry || retryFiredRef.current) return;
    retryFiredRef.current = true;
    const text = pendingRetry;
    setPendingRetry(null);
    sendChat(text, undefined, { resend: true });
  }, [pendingRetry, sendChat]);

  const clearChat = useCallback(() => {
    const firstName = profile.name ? profile.name.split(" ")[0] : "";
    const greeting: ChatMessage = {
      role: "coach",
      text: t("store.greetingAfterClear", { name: firstName ? " " + firstName : "" }),
    };
    setChatMessages([greeting]);
    try {
      localStorage.removeItem(chatKey(userIdRef.current));
    } catch {
      // sin acceso a storage: no pasa nada
    }
    clearPendingMarker(userIdRef.current);
    showToast(t("store.chatCleared"));
  }, [profile.name, showToast, t]);

  const value: AppState = {
    ready,
    userEmail,
    profile,
    lang,
    t,
    meals,
    drinks,
    activity,
    workout,
    sleep,
    bodyComp,
    routine,
    weights,
    measurements,
    toast,
    chatMessages,
    chatTyping,
    sendChat,
    clearChat,
    ...derived,
    showToast,
    saveProfile,
    addMeal,
    updateMeal,
    deleteMeal,
    addWater,
    updateDrink,
    deleteDrink,
    setActivity,
    setWorkout,
    setSleep,
    setBodyComp,
    saveRoutine,
    setWeight,
    setWeightGoal,
    addMeasurement,
    signOut,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { currentMealTime, todayISO };
export type { MealTime, RoutineDay };
