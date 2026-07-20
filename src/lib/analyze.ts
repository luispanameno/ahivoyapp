"use client";

// Cliente del endpoint /api/analyze (Gemini corre SOLO en el servidor).

export type AnalyzeMode =
  | "food"
  | "scale"
  | "activity"
  | "sleep"
  | "workout"
  | "coach";

export interface FoodResult {
  descripcion: string;
  kcal: number;
  proteina: number;
  carbos: number;
  grasa: number;
  gramos?: number;
  pregunta?: string | null;
}

export interface CoachAction {
  type:
    | "add_water"
    | "remove_water"
    | "set_weight"
    | "set_goal_weight"
    | "set_meta_kcal"
    | "log_meal"
    | "log_sleep"
    | "log_workout"
    | "delete_meal"
    | "update_meal"
    | "set_macros"
    | "set_body_comp";
  ml?: number;
  lb?: number;
  kcal?: number;
  minutos?: number;
  nombre?: string;
  time?: string;
  desc?: string;
  p?: number;
  c?: number;
  f?: number;
  fecha?: string; // YYYY-MM-DD cuando la acción es de otro día
  // set_body_comp (báscula subida al chat)
  peso_lb?: number;
  score?: number;
  complexion?: string;
  imc?: number;
  grasa_pct?: number;
  agua_pct?: number;
  proteina_pct?: number;
  bmr?: number;
  grasa_visceral?: number;
  musculo_lb?: number;
  masa_osea_lb?: number;
}

export interface CoachResult {
  reply: string;
  actions: CoachAction[];
}

export async function analyze<T = unknown>(payload: {
  mode: AnalyzeMode;
  image?: string; // data URL
  text?: string;
  context?: unknown;
}): Promise<T> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status} analizando`);
  }
  return res.json();
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
