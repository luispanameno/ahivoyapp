// API de análisis con Gemini. La GEMINI_API_KEY vive SOLO aquí (servidor).

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

type Mode = "food" | "scale" | "activity" | "sleep" | "workout" | "coach";

const PROMPTS: Record<Exclude<Mode, "coach">, string> = {
  food: `Eres un nutricionista experto. Analiza la foto del plato (y la aclaración del usuario si existe) y estima sus macros totales.
Responde SOLO con JSON válido con esta forma exacta:
{"descripcion": string (nombre corto del plato en español),
 "kcal": number, "proteina": number (g), "carbos": number (g), "grasa": number (g),
 "gramos": number (peso estimado del plato en gramos),
 "pregunta": string | null}
"pregunta": si hay UNA ambigüedad que cambie mucho el cálculo (ej. ¿arroz blanco o integral?, ¿frito o a la plancha?), escríbela como pregunta corta en español; si no, null.
Si el usuario ya aclaró algo, usa esa aclaración y pon "pregunta": null.
Si la imagen NO es comida, responde {"descripcion":"No parece comida","kcal":0,"proteina":0,"carbos":0,"grasa":0,"gramos":0,"pregunta":null}.`,

  scale: `Lee esta captura de una app de báscula inteligente (Zepp Life, Renpho, Samsung, etc.), en cualquier idioma.
Responde SOLO con JSON válido:
{"peso_lb": number (peso en libras; si la captura está en kg, conviértelo: kg*2.2046),
 "score": number|null, "complexion": string|null (ej. "Robusto","Normal"),
 "imc": number|null, "grasa_pct": number|null, "agua_pct": number|null,
 "proteina_pct": number|null, "bmr": number|null (kcal),
 "grasa_visceral": number|null, "musculo_lb": number|null, "masa_osea_lb": number|null}
Convierte masas a libras si vienen en kg. Usa null para lo que no aparezca.`,

  activity: `Lee esta captura de una app de salud/reloj (Samsung Health, Apple Salud, Garmin, etc.), en cualquier idioma.
Responde SOLO con JSON válido:
{"pasos": number, "min_activos": number (minutos de actividad), "kcal_activas": number (calorías de actividad/ejercicio),
 "kcal_totales": number (calorías totales quemadas del día; si no aparece, estima kcal_activas + 1600),
 "distancia_km": number (si viene en millas: mi*1.609)}
Usa 0 para lo que no aparezca (excepto kcal_totales, ver regla).`,

  sleep: `Lee esta captura de sueño de un reloj/app de salud, en cualquier idioma.
Responde SOLO con JSON válido:
{"minutos": number (duración total de sueño en minutos),
 "profundo_pct": number|null, "ligero_pct": number|null, "rem_pct": number|null, "despierto_pct": number|null}
Si aparecen tiempos por fase pero no porcentajes, calcula los porcentajes. Deben sumar ~100.`,

  workout: `Lee esta captura de un entrenamiento (reloj o app de fitness), en cualquier idioma.
Responde SOLO con JSON válido:
{"nombre": string (nombre del entrenamiento, ej. "Entrenamiento de fuerza"),
 "kcal": number (calorías quemadas en la sesión)}`,
};

const COACH_PROMPT = `Eres el "Coach IA" de AHIVOYAPP, una app de conteo de calorías y pérdida de peso. Hablas español, cercano y motivador, con emojis con moderación. Respuestas CORTAS (2-5 frases).
Recibes el contexto del día del usuario en JSON (metas, comido, quemado, agua, sueño, rutina, hora local).
Usa SIEMPRE los números reales del contexto (kcal libres, proteína faltante, agua faltante) en tus consejos.

Además de aconsejar, puedes REGISTRAR datos cuando el usuario te lo pida con lenguaje natural. Detecta intenciones como:
- agregar agua ("tomé 500 ml", "medio litro de agua")
- registrar peso ("pesé 193 lb") o meta de peso ("mi meta ahora es 170")
- cambiar meta de calorías
- registrar entrenamiento hecho ("ya entrené", con kcal si las menciona)
- registrar sueño ("dormí 7 horas y media")
- registrar una comida SIN foto ("agrega a mi almuerzo: pollo con arroz") — estima kcal y macros tú mismo.
Si envía una FOTO de comida: analízala y estima macros; si además pide registrarla ("agrégala"), regístrala con log_meal.

Responde SOLO con JSON válido:
{"reply": string (tu respuesta al usuario),
 "actions": [
   {"type":"add_water","ml":number} |
   {"type":"set_weight","lb":number} |
   {"type":"set_goal_weight","lb":number} |
   {"type":"set_meta_kcal","kcal":number} |
   {"type":"log_workout","kcal":number,"nombre":string} |
   {"type":"log_sleep","minutos":number} |
   {"type":"log_meal","time":"Desayuno"|"Almuerzo"|"Cena"|"Snack","desc":string,"kcal":number,"p":number,"c":number,"f":number}
 ]}
"actions" va vacío [] si el usuario solo pregunta. Cuando registres algo, confírmalo en "reply" con los números.
Elige "time" según la hora local del contexto si el usuario no la dice.`;

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  return m ? { mimeType: m[1], data: m[2] } : null;
}

function extractJson(text: string): unknown {
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("La IA no devolvió JSON");
  return JSON.parse(clean.slice(start, end + 1));
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY no configurada en el servidor" },
      { status: 500 }
    );
  }

  let body: { mode?: Mode; image?: string; text?: string; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { mode, image, text, context } = body;
  if (!mode) return NextResponse.json({ error: "Falta 'mode'" }, { status: 400 });
  if (mode !== "coach" && !image && !text)
    return NextResponse.json({ error: "Falta imagen o texto" }, { status: 400 });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (image) {
    const parsed = parseDataUrl(image);
    if (!parsed) return NextResponse.json({ error: "Imagen inválida" }, { status: 400 });
    parts.push({ inlineData: parsed });
  }

  if (mode === "coach") {
    parts.push({
      text: `CONTEXTO DEL DÍA:\n${JSON.stringify(context ?? {}, null, 2)}\n\nMENSAJE DEL USUARIO:\n${text || "(solo envió una foto)"}`,
    });
  } else if (text) {
    parts.push({ text: `Aclaración del usuario: ${text}` });
  } else {
    parts.push({ text: "Analiza la imagen." });
  }

  const systemInstruction = mode === "coach" ? COACH_PROMPT : PROMPTS[mode];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    });
    const raw = response.text ?? "";
    const json = extractJson(raw);
    return NextResponse.json(json);
  } catch (e) {
    console.error("Gemini error:", e);
    const msg = e instanceof Error ? e.message : "Error llamando a Gemini";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
