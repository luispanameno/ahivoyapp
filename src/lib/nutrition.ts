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
  const bmr =
    input.bmrOverride && input.bmrOverride > 0
      ? Math.round(input.bmrOverride)
      : mifflinBMR(input.weightLb, input.heightCm, input.age, input.sex);
  const tdee = Math.round(bmr * ACTIVITY_FACTORS[input.activityLevel]);
  const wantsToLose = input.weightGoalLb < input.weightLb;
  const floor = input.sex === "F" ? 1200 : 1500;
  const metaKcal = wantsToLose ? Math.max(floor, Math.round(tdee - 450)) : tdee;
  const metaProtein = Math.round(0.8 * input.weightGoalLb);
  const metaFat = Math.round((metaKcal * 0.27) / 9);
  const metaCarbs = Math.max(0, Math.round((metaKcal - metaProtein * 4 - metaFat * 9) / 4));
  return { metaKcal, metaProtein, metaCarbs, metaFat, metaWater: 3000, bmr, tdee };
}
