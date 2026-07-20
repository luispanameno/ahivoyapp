export type MealTime = "Desayuno" | "Almuerzo" | "Cena" | "Snack";
export type RoutineDay = "Push" | "Pull" | "Legs";

export interface Meal {
  id: string;
  date: string; // YYYY-MM-DD
  time: MealTime;
  desc: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export interface Profile {
  name: string;
  photo: string | null; // data URL de la foto de perfil
  sex: "M" | "F"; // para el cálculo de BMR (Mifflin-St Jeor)
  age: number;
  height: number; // cm
  weight: number; // lb
  weightGoal: number; // lb
  metaKcal: number;
  metaProtein: number;
  metaCarbs: number;
  metaFat: number;
  metaWater: number; // ml
}

export interface Activity {
  steps: number;
  activeMin: number;
  activityKcal: number; // kcal activas (de la captura del reloj)
  totalKcal: number; // total quemadas del día
  distance: number; // km
  synced: boolean;
}

export interface Exercise {
  name: string;
  sets: string;
}

export type Routine = Record<RoutineDay, Exercise[]>;

export interface WorkoutState {
  day: RoutineDay;
  done: boolean;
  kcal: number;
  name: string;
  notes: string;
}

export interface SleepPhases {
  deep: number;
  light: number;
  rem: number;
  awake: number;
}

export interface SleepState {
  minutes: number;
  phases: SleepPhases | null;
}

export interface BodyComp {
  score: number;
  build: string;
  bmi: number;
  fatPct: number;
  waterPct: number;
  proteinPct: number;
  bmr: number;
  visceralFat: number;
  muscle: number; // lb
  boneMass: number; // lb
  date: string;
}

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  lb: number;
}

export interface ChatMessage {
  role: "user" | "coach";
  text: string;
  image?: string;
}

export const DEFAULT_PROFILE: Profile = {
  name: "",
  photo: null,
  sex: "M",
  age: 25,
  height: 170,
  weight: 180,
  weightGoal: 165,
  metaKcal: 2000,
  metaProtein: 115,
  metaCarbs: 220,
  metaFat: 70,
  metaWater: 3000,
};

export const DEFAULT_ROUTINE: Routine = {
  Push: [
    { name: "Press banca", sets: "4x8" },
    { name: "Press militar", sets: "3x10" },
    { name: "Fondos en paralelas", sets: "3x12" },
    { name: "Extensión de tríceps", sets: "3x15" },
  ],
  Pull: [
    { name: "Dominadas", sets: "4x6" },
    { name: "Remo con barra", sets: "4x8" },
    { name: "Curl de bíceps", sets: "3x12" },
    { name: "Face pulls", sets: "3x15" },
  ],
  Legs: [
    { name: "Sentadilla", sets: "4x8" },
    { name: "Peso muerto rumano", sets: "3x10" },
    { name: "Prensa", sets: "3x12" },
    { name: "Elevación de talones", sets: "4x15" },
  ],
};

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function currentMealTime(): MealTime {
  const h = new Date().getHours();
  return h < 11 ? "Desayuno" : h < 16 ? "Almuerzo" : h < 21 ? "Cena" : "Snack";
}
