// API de análisis con Gemini. La GEMINI_API_KEY vive SOLO aquí (servidor).

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

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

// Esquemas de respuesta: con responseSchema el API restringe la generación
// a JSON bien formado (evita respuestas cortadas o con texto extra).
const NUM = { type: Type.NUMBER } as const;
const NUM_NULL = { type: Type.NUMBER, nullable: true } as const;
const STR = { type: Type.STRING } as const;
const STR_NULL = { type: Type.STRING, nullable: true } as const;

const SCHEMAS: Record<Mode, object> = {
  food: {
    type: Type.OBJECT,
    properties: { descripcion: STR, kcal: NUM, proteina: NUM, carbos: NUM, grasa: NUM, gramos: NUM, pregunta: STR_NULL },
    required: ["descripcion", "kcal", "proteina", "carbos", "grasa"],
  },
  scale: {
    type: Type.OBJECT,
    properties: {
      peso_lb: NUM,
      score: NUM_NULL,
      complexion: STR_NULL,
      imc: NUM_NULL,
      grasa_pct: NUM_NULL,
      agua_pct: NUM_NULL,
      proteina_pct: NUM_NULL,
      bmr: NUM_NULL,
      grasa_visceral: NUM_NULL,
      musculo_lb: NUM_NULL,
      masa_osea_lb: NUM_NULL,
    },
    required: ["peso_lb"],
  },
  activity: {
    type: Type.OBJECT,
    properties: { pasos: NUM, min_activos: NUM, kcal_activas: NUM, kcal_totales: NUM, distancia_km: NUM },
    required: ["pasos", "kcal_activas", "kcal_totales"],
  },
  sleep: {
    type: Type.OBJECT,
    properties: { minutos: NUM, profundo_pct: NUM_NULL, ligero_pct: NUM_NULL, rem_pct: NUM_NULL, despierto_pct: NUM_NULL },
    required: ["minutos"],
  },
  workout: {
    type: Type.OBJECT,
    properties: { nombre: STR, kcal: NUM },
    required: ["nombre", "kcal"],
  },
  coach: {
    type: Type.OBJECT,
    properties: {
      reply: STR,
      actions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: [
                "add_water",
                "remove_water",
                "set_weight",
                "set_goal_weight",
                "set_meta_kcal",
                "log_workout",
                "log_sleep",
                "log_meal",
                "delete_meal",
                "update_meal",
              ],
            },
            ml: NUM,
            lb: NUM,
            kcal: NUM,
            minutos: NUM,
            nombre: STR,
            // OJO: sin enum, los modelos interpretan "time" como hora de
            // reloj y el decodificador entra en bucle.
            time: { type: Type.STRING, enum: ["Desayuno", "Almuerzo", "Cena", "Snack"] },
            desc: STR,
            p: NUM,
            c: NUM,
            f: NUM,
          },
          required: ["type"],
        },
      },
    },
    required: ["reply", "actions"],
  },
};

const COACH_PROMPT = `Eres el "Coach IA" de AHIVOYAPP, una app de conteo de calorías y pérdida de peso. Hablas español, cercano y motivador, con emojis con moderación. Respuestas CORTAS (2-5 frases).
Recibes el contexto del día del usuario en JSON (metas, comido, quemado, agua, sueño, rutina, hora local).
Usa SIEMPRE los números reales del contexto (kcal libres, proteína faltante, agua faltante) en tus consejos.

Además de aconsejar, puedes REGISTRAR, MODIFICAR y BORRAR datos cuando el usuario te lo pida con lenguaje natural. Detecta intenciones como:
- agregar agua ("tomé 500 ml") o QUITAR agua ("quítame un vaso", "me equivoqué, borra 250 ml")
- registrar peso ("pesé 193 lb") o meta de peso ("mi meta ahora es 170")
- cambiar meta de calorías
- registrar entrenamiento hecho ("ya entrené", con kcal si las menciona)
- registrar sueño ("dormí 7 horas y media")
- registrar una comida SIN foto ("agrega a mi almuerzo: pollo con arroz") — estima kcal y macros tú mismo
- BORRAR una comida del historial ("borra el pollo del almuerzo") — usa delete_meal con la descripción EXACTA que aparece en comidas_hoy del contexto
- CORREGIR una comida ("el desayuno eran 300 kcal, no 500") — usa update_meal con la descripción exacta de comidas_hoy y los valores nuevos completos.
Si envía una FOTO de comida: analízala y estima macros; si además pide registrarla ("agrégala"), regístrala con log_meal.

Responde SOLO con JSON válido:
{"reply": string (tu respuesta al usuario),
 "actions": [
   {"type":"add_water","ml":number} |
   {"type":"remove_water","ml":number} |
   {"type":"set_weight","lb":number} |
   {"type":"set_goal_weight","lb":number} |
   {"type":"set_meta_kcal","kcal":number} |
   {"type":"log_workout","kcal":number,"nombre":string} |
   {"type":"log_sleep","minutos":number} |
   {"type":"log_meal","time":"Desayuno"|"Almuerzo"|"Cena"|"Snack","desc":string,"kcal":number,"p":number,"c":number,"f":number} |
   {"type":"delete_meal","desc":string} |
   {"type":"update_meal","desc":string,"kcal":number,"p":number,"c":number,"f":number}
 ]}
"actions" va vacío [] si el usuario solo pregunta. Cuando registres/borres/modifiques algo, confírmalo en "reply" con los números.
En log_meal incluye SIEMPRE los campos desc, kcal, p, c y f con tus estimaciones — NUNCA los omitas. En add_water/remove_water incluye siempre ml.
En delete_meal y update_meal, "desc" debe coincidir con una descripción de comidas_hoy. Si no hay coincidencia clara, pregunta cuál es en vez de actuar.
Elige "time" según la hora local del contexto si el usuario no la dice.`;

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  return m ? { mimeType: m[1], data: m[2] } : null;
}

function extractJson(text: string): unknown {
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    // El modelo a veces agrega texto extra u otro objeto después del JSON:
    // extraemos el PRIMER objeto balanceado, respetando strings con llaves.
  }
  const start = clean.indexOf("{");
  if (start === -1) throw new Error("La IA no devolvió JSON");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < clean.length; i++) {
    const ch = clean[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = inString;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
    } else if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return JSON.parse(clean.slice(start, i + 1));
      }
    }
  }
  // JSON truncado (el modelo a veces corta la última llave):
  // cerramos strings/llaves/corchetes pendientes y probamos parsear.
  return JSON.parse(repairTruncated(clean.slice(start)));
}

function repairTruncated(s: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of s) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = inString;
      continue;
    }
    if (ch === '"') inString = !inString;
    else if (!inString) {
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") stack.pop();
    }
  }
  let out = s.trimEnd();
  if (escaped) out = out.slice(0, -1);
  if (inString) out += '"';
  out = out.replace(/,\s*$/, "");
  while (stack.length) out += stack.pop();
  return out;
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

  // Cadena de modelos: si uno agota su cuota gratuita (429) o no está
  // disponible (404), se intenta el siguiente.
  const modelos = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : ["gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-3.5-flash"];

  try {
    const ai = new GoogleGenAI({ apiKey });
    let lastError: unknown = null;
    for (const model of modelos) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            // En modo coach el esquema restringido hace que estos modelos
            // entren en bucles de repetición (array anidado); mejor solo prompt.
            ...(mode === "coach" ? {} : { responseSchema: SCHEMAS[mode] }),
            temperature: 0.4,
            maxOutputTokens: 1500,
          },
        });
        const raw = response.text ?? "";
        try {
          const json = extractJson(raw) as Record<string, unknown>;
          if (mode === "coach" && Array.isArray(json.actions)) {
            // Defensa contra bucles del modelo: sin duplicados y máximo 5 acciones.
            const vistos = new Set<string>();
            json.actions = json.actions
              .filter((a) => {
                const k = JSON.stringify(a);
                if (vistos.has(k)) return false;
                vistos.add(k);
                return true;
              })
              .slice(0, 5);
          }
          return NextResponse.json(json);
        } catch (parseErr) {
          // Respuesta corrupta de este modelo: registrarla y probar el siguiente.
          console.error(`JSON inválido de ${model}:`, raw.slice(0, 600));
          lastError = parseErr;
          continue;
        }
      } catch (err) {
        lastError = err;
        const m = err instanceof Error ? err.message : String(err);
        const agotado =
          m.includes("RESOURCE_EXHAUSTED") ||
          m.includes("429") ||
          m.includes("NOT_FOUND") ||
          m.includes("404") ||
          m.includes("UNAVAILABLE") ||
          m.includes("503") ||
          m.includes("high demand");
        if (!agotado) throw err;
        console.warn(`Modelo ${model} no disponible/agotado; probando siguiente…`);
      }
    }
    throw lastError;
  } catch (e) {
    console.error("Gemini error:", e);
    const msg = e instanceof Error ? e.message : "Error llamando a Gemini";
    if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
      return NextResponse.json(
        { error: "La IA alcanzó su límite gratuito por ahora. Espera un momento e intenta de nuevo." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
