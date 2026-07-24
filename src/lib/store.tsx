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
import { useRouter } from "next/navigation";
import * as db from "./db";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { analyze, CoachAction, CoachResult } from "./analyze";
import {
  Activity,
  BodyComp,
  ChatMessage,
  DEFAULT_PROFILE,
  DEFAULT_ROUTINE,
  Drink,
  Meal,
  MealTime,
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
const CHAT_KEY = "ahivoy:chat";

function loadChat(greeting: ChatMessage): ChatMessage[] {
  if (typeof window === "undefined") return [greeting];
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { messages: ChatMessage[] };
      if (saved.messages?.length) return saved.messages;
    }
  } catch {
    // chat corrupto: empezamos de cero
  }
  return [greeting];
}

function saveChat(messages: ChatMessage[]) {
  try {
    // Sin imágenes (pesan mucho): se reemplazan por un marcador.
    const light = messages.map((m) => (m.image ? { ...m, image: "", text: m.text || "(foto)" } : m));
    localStorage.setItem(CHAT_KEY, JSON.stringify({ messages: light.slice(-60) }));
  } catch {
    // sin espacio: no pasa nada
  }
}

// Marcador de "pregunta en curso": si el navegador mata la app a media
// respuesta (ej. el sistema operativo cierra la pestaña/PWA en segundo
// plano — algo que ningún estado en memoria puede evitar), al reabrir la
// app detectamos el marcador huérfano y avisamos en vez de dejar el chat
// en silencio para siempre.
const PENDING_KEY = "ahivoy:chat_pending";

function setPendingMarker(text: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ text, ts: Date.now() }));
  } catch {
    // sin espacio: no pasa nada
  }
}

function clearPendingMarker() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // sin acceso a storage: no pasa nada
  }
}

function takeOrphanedPending(): string | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_KEY);
    const { text } = JSON.parse(raw) as { text: string; ts: number };
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

interface AppState {
  ready: boolean;
  userEmail: string | null;
  profile: Profile;
  meals: Meal[];
  drinks: Drink[];
  water: number; // suma de "drinks" del día — se calcula sola, no se guarda
  activity: Activity | null;
  workout: WorkoutState | null;
  sleep: SleepState | null;
  bodyComp: BodyComp | null;
  routine: Routine;
  weights: WeightEntry[];
  toast: string | null;

  // chat del Coach — vive aquí (no en la página) para que una respuesta en
  // curso no se pierda si el usuario cambia de pestaña y vuelve antes de
  // que la IA conteste.
  chatMessages: ChatMessage[];
  chatTyping: boolean;
  sendChat: (text: string, image?: string) => Promise<void>;
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
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [activity, setActivityState] = useState<Activity | null>(null);
  const [workout, setWorkoutState] = useState<WorkoutState | null>(null);
  const [sleep, setSleepState] = useState<SleepState | null>(null);
  const [bodyComp, setBodyCompState] = useState<BodyComp | null>(null);
  const [routine, setRoutineState] = useState<Routine>(DEFAULT_ROUTINE);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat del Coach: vive en el provider, no en la página /coach, para que
  // una respuesta que sigue en camino no se pierda si el usuario navega
  // a otra pestaña y vuelve.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatTyping, setChatTyping] = useState(false);
  const chatHydratedRef = useRef(false);

  const date = todayISO();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isSupabaseConfigured) {
        const sb = getSupabase()!;
        const { data } = await sb.auth.getSession();
        if (!data.session) {
          router.replace("/login");
          return;
        }
        if (!cancelled) setUserEmail(data.session.user.email ?? null);
      }
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
      text: `¡Hola${firstName ? " " + firstName : ""}! 👋 Soy tu Coach IA. Conozco tus macros, tu meta y tu rutina de hoy. Pregúntame qué comer, pídeme que revise el menú de un restaurante o cuéntame cómo te sientes.`,
    };
    const messages = loadChat(greeting);
    // Si quedó un marcador huérfano, la app se cerró a media respuesta en
    // la sesión anterior (nada que un estado en memoria pueda prevenir):
    // avisamos en vez de dejar el chat en silencio para siempre.
    const orphaned = takeOrphanedPending();
    setChatMessages(
      orphaned
        ? [
            ...messages,
            {
              role: "coach",
              text: "Parece que la app se cerró justo cuando te estaba respondiendo y tu último mensaje se perdió. ¿Me lo envías de nuevo? 🙏",
            },
          ]
        : messages
    );
  }, [ready, profile.name]);

  useEffect(() => {
    if (chatMessages.length > 1) saveChat(chatMessages);
  }, [chatMessages]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const saveProfile = useCallback(async (p: Profile) => {
    setProfile(p);
    await db.saveProfile(p);
  }, []);

  const addMeal = useCallback(
    async (m: Omit<Meal, "id" | "date">) => {
      const meal: Meal = { ...m, id: crypto.randomUUID(), date };
      setMeals((prev) => [...prev, meal]);
      await db.addMeal(meal);
    },
    [date]
  );

  const updateMeal = useCallback(async (m: Meal) => {
    setMeals((prev) => prev.map((x) => (x.id === m.id ? m : x)));
    await db.updateMeal(m);
  }, []);

  const deleteMeal = useCallback(async (id: string) => {
    setMeals((prev) => prev.filter((x) => x.id !== id));
    await db.deleteMeal(id);
  }, []);

  // Cada llamada crea un NUEVO registro (como una comida) en vez de
  // sobreescribir un total único: así cualquier valor erróneo se puede
  // borrar en Historial y nunca queda un número dañado sin forma de arreglarlo.
  const addWater = useCallback(
    async (ml: number, label?: string) => {
      const entry: Drink = {
        id: crypto.randomUUID(),
        date,
        ml,
        label: label || (ml < 0 ? "Ajuste" : "Agua"),
      };
      setDrinks((prev) => [...prev, entry]);
      await db.addDrink(entry);
    },
    [date]
  );

  const updateDrink = useCallback(async (d: Drink) => {
    setDrinks((prev) => prev.map((x) => (x.id === d.id ? d : x)));
    await db.updateDrink(d);
  }, []);

  const deleteDrink = useCallback(async (id: string) => {
    setDrinks((prev) => prev.filter((d) => d.id !== id));
    await db.deleteDrink(id);
  }, []);

  const setActivity = useCallback(
    async (a: Activity) => {
      setActivityState(a);
      await db.setActivity(date, a);
    },
    [date]
  );

  const setWorkout = useCallback(
    async (w: WorkoutState) => {
      setWorkoutState(w);
      await db.setWorkout(date, w);
    },
    [date]
  );

  const setSleep = useCallback(
    async (s: SleepState) => {
      setSleepState(s);
      await db.setSleep(date, s);
    },
    [date]
  );

  const setWeight = useCallback(
    async (lb: number) => {
      const p = { ...profile, weight: lb };
      setProfile(p);
      await db.saveProfile(p);
      const entry = { date, lb };
      setWeights((prev) => [...prev.filter((w) => w.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date)));
      await db.addWeight(entry);
    },
    [profile, date]
  );

  const setWeightGoal = useCallback(
    async (lb: number) => {
      const p = { ...profile, weightGoal: lb };
      setProfile(p);
      await db.saveProfile(p);
    },
    [profile]
  );

  const setBodyComp = useCallback(
    async (b: BodyComp, weightLb?: number) => {
      setBodyCompState(b);
      await db.addBodyComp(b);
      if (weightLb && weightLb > 0) {
        const p = { ...profile, weight: weightLb };
        setProfile(p);
        await db.saveProfile(p);
        const entry = { date, lb: weightLb };
        setWeights((prev) => [...prev.filter((w) => w.date !== date), entry].sort((a, c) => a.date.localeCompare(c.date)));
        await db.addWeight(entry);
      }
    },
    [profile, date]
  );

  const saveRoutine = useCallback(async (r: Routine) => {
    setRoutineState(r);
    await db.saveRoutine(r);
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
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
  const applyChatActions = useCallback(
    async (actions: CoachAction[]) => {
      const today = date;
      for (const a of actions) {
        try {
          const fecha = a.fecha && /^\d{4}-\d{2}-\d{2}$/.test(a.fecha) && a.fecha !== today ? a.fecha : null;

          if (!fecha) {
            // ---- Acciones sobre HOY (actualizan la pantalla al instante) ----
            if (a.type === "add_water" && a.ml) await addWater(a.ml);
            else if (a.type === "remove_water" && a.ml) {
              const removeMl = Math.min(a.ml, derived.water);
              if (removeMl > 0) await addWater(-removeMl, "Ajuste");
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
            else if (a.type === "log_sleep" && a.minutos) await setSleep({ minutes: a.minutos, phases: sleep?.phases ?? null });
            else if (a.type === "log_workout")
              await setWorkout({
                day: workout?.day ?? "Push",
                done: true,
                kcal: a.kcal ?? 300,
                name: a.nombre ?? "Entrenamiento",
                notes: workout?.notes ?? "",
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
          } else {
            // ---- Acciones sobre OTRO día (directo a la base de datos) ----
            if (a.type === "add_water" && a.ml) {
              await db.addDrink({ id: crypto.randomUUID(), date: fecha, ml: a.ml, label: "Agua" });
            } else if (a.type === "remove_water" && a.ml) {
              const actual = (await db.drinksFor(fecha)).reduce((s, d) => s + d.ml, 0);
              const removeMl = Math.min(a.ml, actual);
              if (removeMl > 0) {
                await db.addDrink({ id: crypto.randomUUID(), date: fecha, ml: -removeMl, label: "Ajuste" });
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
            } else if (a.type === "log_workout") {
              await db.setWorkout(fecha, {
                day: (workout?.day ?? "Push") as RoutineDay,
                done: true,
                kcal: a.kcal ?? 300,
                name: a.nombre ?? "Entrenamiento",
                notes: "",
              });
            } else if (a.type === "set_weight" && a.lb) {
              await db.addWeight({ date: fecha, lb: a.lb });
            }
          }
        } catch {
          // una acción fallida no debe romper el chat
        }
      }
      if (actions.length) showToast("Coach actualizó tus datos ✓");
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
      addMeal,
      setBodyComp,
      showToast,
    ]
  );

  const sendChat = useCallback(
    async (text: string, image?: string) => {
      const clean = text.trim();
      if (!clean && !image) return;
      const userMsg: ChatMessage = { role: "user", text: clean, image };
      setChatMessages((prev) => [...prev, userMsg]);
      setChatTyping(true);
      // Si la app muere antes de que esto se limpie (el SO cierra la
      // pestaña/PWA en segundo plano), el próximo arranque encuentra este
      // marcador huérfano y avisa en vez de quedarse en silencio.
      setPendingMarker(clean || "(foto)");
      try {
        const protLeft = Math.max(0, profile.metaProtein - derived.proteinG);
        const waterLeft = Math.max(0, profile.metaWater - derived.water);
        const context = {
          nombre: profile.name,
          perfil: {
            edad: profile.age,
            altura_cm: profile.height,
            peso_lb: profile.weight,
            peso_meta_lb: profile.weightGoal,
            sexo: profile.sex === "F" ? "mujer" : "hombre",
            nivel_actividad: profile.activityLevel,
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
          rutina: routine,
          hora_local: new Date().toTimeString().slice(0, 5),
          fecha_hoy: date,
          dia_semana: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][new Date().getDay()],
        };
        const res = await analyze<CoachResult>({ mode: "coach", text: clean, image, context });
        setChatMessages((prev) => [...prev, { role: "coach", text: res.reply }]);
        if (res.actions?.length) await applyChatActions(res.actions);
      } catch (e) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "coach",
            text:
              e instanceof Error && e.message.includes("GEMINI")
                ? "Aún no tengo conectada la IA (falta la GEMINI_API_KEY en el servidor). Pídele a Luis que la configure 😉"
                : "Ups, no pude responder ahora. Intenta de nuevo en un momento.",
          },
        ]);
      } finally {
        clearPendingMarker();
        setChatTyping(false);
      }
    },
    [profile, derived, workout, sleep, routine, meals, chatMessages, date, applyChatActions]
  );

  const clearChat = useCallback(() => {
    const firstName = profile.name ? profile.name.split(" ")[0] : "";
    const greeting: ChatMessage = {
      role: "coach",
      text: `¡Hola${firstName ? " " + firstName : ""}! 👋 Chat limpio. ¿En qué te ayudo?`,
    };
    setChatMessages([greeting]);
    try {
      localStorage.removeItem(CHAT_KEY);
    } catch {
      // sin acceso a storage: no pasa nada
    }
    showToast("Chat limpiado");
  }, [profile.name, showToast]);

  const value: AppState = {
    ready,
    userEmail,
    profile,
    meals,
    drinks,
    activity,
    workout,
    sleep,
    bodyComp,
    routine,
    weights,
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
    signOut,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { currentMealTime, todayISO };
export type { MealTime, RoutineDay };
