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
  photo?: string | null; // miniatura JPEG (data URL) de la foto del plato
}

export type ActivityLevel = "sedentario" | "ligero" | "activo";

// Factores para TDEE = BMR × factor
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  activo: 1.55,
};

export type AccessStatus = "pending" | "approved" | "rejected";

export interface Profile {
  name: string;
  photo: string | null; // data URL de la foto de perfil
  sex: "M" | "F"; // para el cálculo de BMR (Mifflin-St Jeor)
  activityLevel: ActivityLevel; // nivel de actividad diaria (para el TDEE)
  age: number;
  height: number; // cm
  weight: number; // lb
  weightGoal: number; // lb
  metaKcal: number;
  metaProtein: number;
  metaCarbs: number;
  metaFat: number;
  metaWater: number; // ml
  // Control de acceso: solo el admin puede cambiar status/isAdmin (protegido
  // también a nivel de base de datos, no solo aquí).
  status: AccessStatus;
  isAdmin: boolean;
  // Si ya completó el asistente de bienvenida (datos + metas iniciales).
  onboarded: boolean;
}

// Fila resumida de un usuario para el panel de administración (aprobar
// cuentas nuevas). No lleva metas/macros — eso solo lo necesita el dueño.
export interface AdminUserRow {
  id: string;
  nombre: string;
  email: string;
  status: AccessStatus;
  creado: string;
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

// Registro individual de agua/bebida (como una comida, pero solo ml + etiqueta).
// El total del día se calcula sumando estos registros — así cualquier valor
// erróneo se puede borrar en Historial en vez de quedar pegado para siempre.
export interface Drink {
  id: string;
  date: string; // YYYY-MM-DD
  ml: number; // puede ser negativo (ajuste/resta)
  label: string; // "Agua", "Café", "Jugo", "Ajuste", etc.
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
  activityLevel: "ligero",
  age: 25,
  height: 170,
  weight: 180,
  weightGoal: 165,
  metaKcal: 2000,
  metaProtein: 115,
  metaCarbs: 220,
  metaFat: 70,
  metaWater: 3000,
  // En modo local (sin Supabase) no hay control de acceso ni asistente.
  status: "approved",
  isAdmin: false,
  onboarded: true,
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
