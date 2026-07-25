// Fórmulas biomédicas compartidas (Perfil, asistente de bienvenida y, en el
// prompt del Coach, la misma lógica reimplementada en el servidor) — se
// mantienen en un solo lugar para que los tres cálculos siempre coincidan.

import { ACTIVITY_FACTORS, ActivityLevel } from "./types";

// Mifflin-St Jeor: metabolismo basal (BMR) a partir de peso, altura, edad y sexo.
export function mifflinBMR(weightLb: number, heightCm: number, age: number, sex: "M" | "F"): number {
  const kg = weightLb * 0.4536;
  return Math.round(10 * kg + 6.25 * heightCm - 5 * age + (sex === "F" ? -161 : 5));
}

export interface ComputedGoals {
  metaKcal: number;
  metaProtein: number;
  metaCarbs: number;
  metaFat: number;
  metaWater: number;
  bmr: number;
  tdee: number;
}

// Mismas "reglas de oro" que ya usa el Coach al leer una báscula: déficit de
// ~450 kcal si la meta es bajar de peso (piso 1500 kcal hombre / 1200 mujer),
// proteína = 0.8 × peso meta (lb), grasa = 27% de las kcal, resto en carbos.
export function computeGoals(input: {
  sex: "M" | "F";
  age: number;
  heightCm: number;
  weightLb: number;
  weightGoalLb: number;
  activityLevel: ActivityLevel;
  bmrOverride?: number | null; // si viene de una báscula inteligente
}): ComputedGoals {
  // Rango humano plausible de BMR (~700–2600 kcal). Una báscula mal leída
  // por la IA a veces devuelve un número fuera de este rango (p. ej. leyó
  // otro campo por error) — mejor ignorarlo y calcularlo con la fórmula que
  // confiar en un dato claramente absurdo que dispararía todas las metas.
  const scaleBmrPlausible = input.bmrOverride != null && input.bmrOverride >= 700 && input.bmrOverride <= 2600;
  const bmr = scaleBmrPlausible
    ? Math.round(input.bmrOverride!)
    : mifflinBMR(input.weightLb, input.heightCm, input.age, input.sex);
  const tdee = Math.round(bmr * ACTIVITY_FACTORS[input.activityLevel]);
  const wantsToLose = input.weightGoalLb < input.weightLb;
  const floor = input.sex === "F" ? 1200 : 1500;
  const metaKcal = wantsToLose ? Math.max(floor, Math.round(tdee - 450)) : tdee;
  const macros = macrosForKcal(metaKcal, input.weightGoalLb);
  return { metaKcal, ...macros, metaWater: waterGoalMl(input.weightLb), bmr, tdee };
}

// Reparte unas calorías dadas en proteína / grasa / carbos. Se usa tanto al
// calcular las metas iniciales como cuando el usuario edita a mano sus
// calorías en Perfil: si bajan las kcal, los macros tienen que bajar con
// ellas o el reparto deja de cuadrar.
export function macrosForKcal(
  metaKcal: number,
  weightGoalLb: number
): { metaProtein: number; metaCarbs: number; metaFat: number } {
  const metaProtein = Math.round(0.8 * weightGoalLb);
  const metaFat = Math.round((metaKcal * 0.27) / 9);
  const metaCarbs = Math.max(0, Math.round((metaKcal - metaProtein * 4 - metaFat * 9) / 4));
  return { metaProtein, metaCarbs, metaFat };
}

// Agua diaria según el peso real (~35 ml por kg), redondeada a 100 ml y
// acotada a un rango sensato — antes era un 3000 fijo para todo el mundo,
// que se queda corto en alguien de 130 kg y sobra en alguien de 50 kg.
export function waterGoalMl(weightLb: number): number {
  const kg = weightLb * 0.4536;
  const raw = kg * 35;
  const clamped = Math.min(4000, Math.max(2000, raw));
  return Math.round(clamped / 100) * 100;
}
