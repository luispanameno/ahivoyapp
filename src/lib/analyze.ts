"use client";

// Cliente del endpoint /api/analyze (Gemini corre SOLO en el servidor).

import { getSupabase } from "./supabase";
import { compressForAnalysis } from "./img";

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
  agua_ml?: number | null;
}

export interface CoachAction {
  type:
    | "add_water"
    | "remove_water"
    | "set_weight"
    | "set_goal_weight"
    | "set_meta_kcal"
    | "set_meta_water"
    | "log_meal"
    | "log_sleep"
    | "delete_sleep"
    | "log_workout"
    | "delete_workout"
    | "delete_meal"
    | "update_meal"
    | "set_macros"
    | "set_body_comp"
    | "set_activity"
    | "set_measurements";
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
  // set_activity (reloj: pasos/calorías, del chat o de un registro manual)
  pasos?: number;
  min_activos?: number;
  kcal_activas?: number;
  kcal_totales?: number;
  distancia_km?: number;
  // set_measurements (medidas a cinta: se cargan a mano/por chat, nunca por
  // foto). Solo van los campos que el usuario mencionó — el resto se deja
  // como está.
  brazo_cm?: number;
  cintura_cm?: number;
  pecho_cm?: number;
  pierna_cm?: number;
  gluteos_cm?: number;
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
  // Idioma en que la IA debe responder los campos de texto libre (reply,
  // descripcion, pregunta, nombre). Por defecto español si se omite.
  lang?: "es" | "en";
}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // Adjuntamos el token de sesión para que el servidor autentique la llamada
  // y nadie externo pueda gastar la cuota de la IA con nuestra API.
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  // Comprimimos la foto aquí, en el único punto por el que pasan todas las
  // imágenes: el usuario sube cualquier foto y nunca ve "imagen muy grande".
  const image = payload.image ? await compressForAnalysis(payload.image) : payload.image;

  const res = await fetch("/api/analyze", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...payload, image }),
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
