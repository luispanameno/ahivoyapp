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
import {
  Activity,
  BodyComp,
  DEFAULT_PROFILE,
  DEFAULT_ROUTINE,
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

interface AppState {
  ready: boolean;
  userEmail: string | null;
  profile: Profile;
  meals: Meal[];
  water: number;
  activity: Activity | null;
  workout: WorkoutState | null;
  sleep: SleepState | null;
  bodyComp: BodyComp | null;
  routine: Routine;
  weights: WeightEntry[];
  toast: string | null;

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
  addWater: (ml: number) => Promise<void>;
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
  const [water, setWaterState] = useState(0);
  const [activity, setActivityState] = useState<Activity | null>(null);
  const [workout, setWorkoutState] = useState<WorkoutState | null>(null);
  const [sleep, setSleepState] = useState<SleepState | null>(null);
  const [bodyComp, setBodyCompState] = useState<BodyComp | null>(null);
  const [routine, setRoutineState] = useState<Routine>(DEFAULT_ROUTINE);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setWaterState(all.water);
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

  const addWater = useCallback(
    async (ml: number) => {
      const next = Math.max(0, water + ml);
      setWaterState(next);
      await db.setWater(date, next);
    },
    [water, date]
  );

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
    return {
      kcalEaten,
      proteinG: sum("p"),
      carbsG: sum("c"),
      fatG: sum("f"),
      burnedKcal,
      kcalBudget,
      kcalRemaining: Math.max(0, kcalBudget - kcalEaten),
    };
  }, [meals, activity, workout, profile.metaKcal]);

  const value: AppState = {
    ready,
    userEmail,
    profile,
    meals,
    water,
    activity,
    workout,
    sleep,
    bodyComp,
    routine,
    weights,
    toast,
    ...derived,
    showToast,
    saveProfile,
    addMeal,
    updateMeal,
    deleteMeal,
    addWater,
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
