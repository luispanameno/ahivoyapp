import { Lang, translate } from "./i18n";

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
  // En sus propias palabras, qué plan de ejercicio sigue (no todos hacen
  // pesas Push/Pull/Legs — puede ser "camino 1 hora diaria", nada aún, etc.)
  exercisePlan: string;
  // Por qué está usando la app (baja de peso, energía, solo control, etc.)
  // — le da tono al Coach en vez de hablarle igual a todo el mundo.
  goalMotivation: string;
  // Qué tan seguido come comida típica — para que las sugerencias del Coach
  // sean realistas (swaps de pupusas/tamales, no "cambia todo por quinoa").
  foodCulture: string;
  // Idioma de toda la app (interfaz Y el Coach IA). "es" por defecto para no
  // afectar a nadie que ya use la app.
  language: "es" | "en";
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
  // Minutos reportados al chat (se van sumando si reportás varias sesiones
  // el mismo día) — alimentan "Tiempo de actividad" en Hoy junto con lo del
  // reloj. Opcional: el reloj y las capturas de entrenamiento no lo traen.
  minutes?: number;
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

// Medidas corporales: solo se cargan a mano (en Sincronización), nunca por
// foto. Cada campo es opcional porque un registro puede traer solo alguna
// medida (ej. solo brazo esta semana).
export interface MeasurementEntry {
  date: string; // YYYY-MM-DD
  armCm?: number;
  waistCm?: number;
  chestCm?: number;
  legCm?: number;
  gluteCm?: number;
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
  exercisePlan: "",
  goalMotivation: "",
  foodCulture: "",
  language: "es",
};

// Rutina semilla para un usuario nuevo (sin rutina propia guardada aún).
// Es función de `lang` para que los nombres de ejercicio salgan en el
// idioma elegido en Ajustes en vez de quedar fijos en español.
export function defaultRoutine(lang: Lang): Routine {
  const t = (key: string) => translate(lang, key);
  return {
    Push: [
      { name: t("routine.benchPress"), sets: "4x8" },
      { name: t("routine.overheadPress"), sets: "3x10" },
      { name: t("routine.dips"), sets: "3x12" },
      { name: t("routine.tricepsExt"), sets: "3x15" },
    ],
    Pull: [
      { name: t("routine.pullUps"), sets: "4x6" },
      { name: t("routine.barbellRow"), sets: "4x8" },
      { name: t("routine.bicepCurl"), sets: "3x12" },
      { name: t("routine.facePulls"), sets: "3x15" },
    ],
    Legs: [
      { name: t("routine.squat"), sets: "4x8" },
      { name: t("routine.romanianDeadlift"), sets: "3x10" },
      { name: t("routine.legPress"), sets: "3x12" },
      { name: t("routine.calfRaise"), sets: "4x15" },
    ],
  };
}

// Compatibilidad: versión fija en español, para los pocos lugares donde
// todavía no se conoce el idioma del usuario (ver defaultRoutine arriba
// para la versión correcta según Ajustes).
export const DEFAULT_ROUTINE: Routine = defaultRoutine("es");

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function currentMealTime(): MealTime {
  const h = new Date().getHours();
  return h < 11 ? "Desayuno" : h < 16 ? "Almuerzo" : h < 21 ? "Cena" : "Snack";
}
