// API de análisis con Gemini. La GEMINI_API_KEY vive SOLO aquí (servidor).

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const maxDuration = 90;

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

  scale: `Eres un lector OCR EXHAUSTIVO de apps de báscula inteligente (Zepp Life, Renpho, Samsung Health, Fitdays, etc.), en cualquier idioma. La imagen puede ser una captura de pantalla O una FOTO de la pantalla de otro celular (con reflejos o ángulo): léela igual, con máximo esfuerzo.

INSTRUCCIONES OBLIGATORIAS:
1. Recorre la imagen COMPLETA fila por fila, de arriba a abajo, incluyendo filas parcialmente visibles o con poco contraste.
2. Extrae TODOS los campos que aparezcan. Solo usa null si el campo de verdad NO está visible en ninguna parte de la imagen. Dejar en null un valor visible es un ERROR GRAVE.
3. Busca estos campos con sus sinónimos habituales:
   - peso_lb: "Peso"/"Weight" (si está en kg → kg×2.2046; en libras déjalo igual)
   - score: "Puntuación corporal"/"Body score" → ENTERO redondeado
   - complexion: "Complexión física"/"Body type" (ej. "Robusto", "Normal", "Delgado")
   - imc: "IMC"/"BMI"
   - grasa_pct: "Grasa corporal"/"Body fat" (%)
   - agua_pct: "Nivel de agua"/"Agua corporal"/"Body water" (%)
   - proteina_pct: "Proteínas"/"Protein" (%)
   - bmr: "Metabolismo basal"/"BMR" (kcal, entero)
   - grasa_visceral: "Grasa visceral"/"Visceral fat" (número pequeño, sin unidad)
   - musculo_lb: "Músculo"/"Masa muscular"/"Muscle" (si está en kg → ×2.2046)
   - masa_osea_lb: "Masa ósea"/"Bone mass" (si está en kg → ×2.2046)
4. Los porcentajes van como número (44.5, no "44.5%"). Redondea a 1 decimal; score y bmr a entero.
5. Ignora textos de la app como "5 elementos no alcanzaron los objetivos", etiquetas de estado ("Alto", "Normal") y la fecha.

Responde SOLO con JSON válido:
{"peso_lb": number, "score": number|null, "complexion": string|null, "imc": number|null,
 "grasa_pct": number|null, "agua_pct": number|null, "proteina_pct": number|null,
 "bmr": number|null, "grasa_visceral": number|null, "musculo_lb": number|null, "masa_osea_lb": number|null}`,

  activity: `Eres un lector OCR EXHAUSTIVO de apps de salud/reloj (Samsung Health, Apple Salud/Fitness, Garmin, Zepp, Fitbit, etc.), en cualquier idioma. La imagen puede ser captura de pantalla o FOTO de otra pantalla: léela igual.

INSTRUCCIONES OBLIGATORIAS:
1. Recorre la imagen COMPLETA, incluyendo anillos, tarjetas y filas pequeñas. NO dejes campos en 0 si el valor está visible en cualquier parte.
2. Campos y sinónimos:
   - pasos: "Pasos"/"Steps" (ej. "9,188" → 9188)
   - min_activos: "Tiempo de actividad"/"Minutos activos"/"Exercise minutes" (si aparece en horas: h×60+min)
   - kcal_activas: "Calorías de actividad"/"Active calories"/"Kcal activas"/"Energía activa"
   - kcal_totales: "Calorías totales"/"Total quemadas"/"Total burned" — si NO aparece, estima kcal_activas + 1600
   - distancia_km: "Distancia" (si está en millas → mi×1.609; redondea a 2 decimales)
3. Números con separador de miles: "1,022" = 1022.

Responde SOLO con JSON válido:
{"pasos": number, "min_activos": number, "kcal_activas": number, "kcal_totales": number, "distancia_km": number}`,

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
    // TODOS los campos requeridos (aunque acepten null): con solo peso_lb
    // requerido, el modelo respondía el mínimo y dejaba el resto vacío.
    required: [
      "peso_lb",
      "score",
      "complexion",
      "imc",
      "grasa_pct",
      "agua_pct",
      "proteina_pct",
      "bmr",
      "grasa_visceral",
      "musculo_lb",
      "masa_osea_lb",
    ],
  },
  activity: {
    type: Type.OBJECT,
    properties: { pasos: NUM, min_activos: NUM, kcal_activas: NUM, kcal_totales: NUM, distancia_km: NUM },
    required: ["pasos", "min_activos", "kcal_activas", "kcal_totales", "distancia_km"],
  },
  sleep: {
    type: Type.OBJECT,
    properties: { minutos: NUM, profundo_pct: NUM_NULL, ligero_pct: NUM_NULL, rem_pct: NUM_NULL, despierto_pct: NUM_NULL },
    required: ["minutos", "profundo_pct", "ligero_pct", "rem_pct", "despierto_pct"],
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
                "set_macros",
                "set_body_comp",
              ],
            },
            ml: NUM,
            lb: NUM,
            kcal: NUM,
            minutos: NUM,
            nombre: STR,
            peso_lb: NUM,
            score: NUM,
            complexion: STR,
            imc: NUM,
            grasa_pct: NUM,
            agua_pct: NUM,
            proteina_pct: NUM,
            bmr: NUM,
            grasa_visceral: NUM,
            musculo_lb: NUM,
            masa_osea_lb: NUM,
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
   {"type":"update_meal","desc":string,"kcal":number,"p":number,"c":number,"f":number} |
   {"type":"set_macros","kcal":number,"p":number,"c":number,"f":number} |
   {"type":"set_body_comp","peso_lb":number,"score":number,"complexion":string,"imc":number,"grasa_pct":number,"agua_pct":number,"proteina_pct":number,"bmr":number,"grasa_visceral":number,"musculo_lb":number,"masa_osea_lb":number}
 ]}
"actions" va vacío [] si el usuario solo pregunta. Cuando registres/borres/modifiques algo, confírmalo en "reply" con los números.
En log_meal incluye SIEMPRE los campos desc, kcal, p, c y f con tus estimaciones — NUNCA los omitas. En add_water/remove_water incluye siempre ml.
En delete_meal y update_meal, "desc" debe coincidir con una descripción de comidas_hoy. Si no hay coincidencia clara, pregunta cuál es en vez de actuar.
Elige "time" según la hora local del contexto si el usuario no la dice.

DÍAS PASADOS: también puedes registrar/borrar/corregir datos de OTROS días. Si el usuario menciona otro día ("ayer", "anoche", "el viernes"), agrega a la acción el campo "fecha":"YYYY-MM-DD" calculado a partir de fecha_hoy y dia_semana del contexto (ej. "ayer" = fecha_hoy menos 1 día). "Anoche dormí 6 horas" o "anoche tomé 500ml" se refieren a AYER si es de madrugada/mañana. Para comidas de otros días usa la descripción que dé el usuario. Sin mención de otro día, NO incluyas "fecha".

META CALÓRICA PERSONALIZADA (cálculo biomédico): el contexto trae "perfil" (edad, altura_cm, peso_lb, peso_meta_lb, sexo, nivel_actividad). Cuando el usuario pida calcular/revisar su meta, o cuando notes que su meta actual (metas.kcal) no encaja con su perfil, calcula:
1) BMR con Mifflin-St Jeor: peso_kg = peso_lb × 0.4536; hombre: 10×kg + 6.25×altura_cm − 5×edad + 5; mujer: igual pero − 161.
2) TDEE = BMR × factor según nivel_actividad del perfil: sedentario ×1.2, ligero ×1.375, activo ×1.55.
3) Meta = TDEE − déficit saludable de 400-500 kcal si quiere bajar de peso (peso_meta_lb < peso_lb). NUNCA propongas menos de 1500 kcal (hombre) o 1200 kcal (mujer).
Muestra el cálculo en corto (BMR → TDEE → meta) y aplica la nueva meta con set_meta_kcal SOLO si el usuario acepta o lo pidió explícitamente.

FOTO DE BÁSCULA EN EL CHAT (flujo OBLIGATORIO): si la imagen que envía el usuario es una captura o foto de una app de báscula (Zepp Life, Renpho, etc. — se reconoce por peso, IMC, grasa corporal, puntuación…):
1) EXTRAE todos los datos visibles (peso, puntuación entera, complexión, IMC, grasa %, agua %, proteína %, metabolismo basal, grasa visceral, músculo, masa ósea; convierte kg→lb ×2.2046). No dejes campos visibles sin leer.
2) Emite estas acciones de inmediato: set_weight con el peso, y set_body_comp con TODOS los campos extraídos (los no visibles ponlos en 0 o cadena vacía).
3) Calcula la meta sugerida con estas REGLAS DE ORO (la meta actual metas.kcal la puso el usuario o SU NUTRICIONISTA — respétala como TECHO):
   - BMR = el "metabolismo basal" de la captura si aparece, si no Mifflin-St Jeor. TDEE = BMR × factor de nivel_actividad. Fórmula base = TDEE − 400-500.
   - Si el objetivo es BAJAR de peso (peso_meta_lb < peso_lb): la meta sugerida = MIN(fórmula base, metas.kcal actual). NUNCA propongas MÁS calorías que la meta actual — si la fórmula da más, la meta de kcal SE QUEDA IGUAL (su nutricionista eligió un déficit más fuerte y está bien mientras no baje del mínimo saludable: 1500 H / 1200 M).
   - Si el peso SUBIÓ desde la última vez: NO premies la subida con más comida; mantén la meta igual (o hasta −5%) y motiva a sostener el déficit.
   - Si el peso BAJÓ: mantén o baja la meta gradualmente (la fórmula baja sola con el peso). Así el déficit se conserva mientras progresa.
   - Aunque las kcal no cambien, SÍ recalcula la distribución de macros para esas kcal: proteína = 0.8 × peso_meta_lb (g), grasa = 27% de las kcal ÷ 9 (g), carbos = kcal restantes ÷ 4 (g). Enteros.
4) NO apliques todavía set_macros. Estructura tu "reply" así (natural, sin repetir dos veces lo mismo):
   - 1 frase leyendo la báscula (peso y 1-2 métricas que destaquen, y si subió/bajó vs peso anterior del perfil).
   - Una mini tabla "anterior → nuevo" con saltos de línea, ej.:
"📊 Te sugiero este ajuste (anterior → nuevo):
🔥 Calorías: 2000 → 2000 (se mantiene)
🥩 Proteína: 115g → 200g
🍚 Carbos: 220g → 180g
🥑 Grasa: 70g → 60g"
   - 1-2 frases explicando el PORQUÉ (TDEE, déficit resultante, por qué las kcal se mantienen o bajan; si su meta ya es más estricta que la fórmula, dilo como algo positivo y menciona que la puso su nutricionista).
   - Cierra con: "¿Aplico el cambio o los mantenemos?"
5) Si en el SIGUIENTE mensaje el usuario acepta ("sí", "cámbialos", "dale"), emite set_macros con esos números (kcal, p, c, f) y confírmalo. Si los quiere mantener, no cambies nada.

FOTO DE RELOJ/ACTIVIDAD EN EL CHAT: si la imagen es de actividad (pasos, calorías activas), extrae las calorías activas y regístralas con log_workout (nombre "Actividad del reloj") explicando cómo sube su presupuesto del día.

EJERCICIO — MATEMÁTICA ESTRICTA: si el usuario reporta ejercicio:
- Si dice las calorías exactas (de su reloj), usa ESE número en log_workout.
- Si no, estímalas con METs: kcal = MET × peso_kg × horas. METs de referencia: caminar 3.5 · caminar rápido 4.5 · correr suave 8 · correr fuerte 11 · bici 7 · pesas 5 · fútbol 8 · natación 7 · baile 5 · limpieza intensa 3.5. (peso_kg = peso_lb × 0.4536). Redondea a enteros.
- Registra con log_workout (kcal y nombre) y en "reply" explica amigablemente el efecto en su presupuesto: "quemaste ~X kcal → tu presupuesto de hoy sube de kcal_presupuesto a kcal_presupuesto+X". OJO: hoy.kcal_quemadas ya refleja lo contado (reloj o entrenamiento previo, se toma el MAYOR de los dos, no se suman); si ya hay quemadas mayores registradas por el reloj, aclara que ya estaban contadas y el presupuesto no cambia.`;

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

  // Cadena de modelos: si uno agota su cuota gratuita (429), no está
  // disponible (404) o se cuelga (timeout), se intenta el siguiente.
  // gemini-3-flash-preview probado: lee capturas completas en ~4s.
  // (gemini-3.5-flash se cuelga con imágenes; los "lite" dejan campos vacíos.)
  const modelos = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : ["gemini-3-flash-preview", "gemini-3.5-flash", "gemini-3.1-flash-lite"];

  try {
    // timeout 25s por modelo: un modelo lento/colgado pasa al siguiente
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 25000 } });
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
            // El "pensamiento" interno de Gemini 3 cuenta contra este límite;
            // el coach necesita margen para no truncar reply+actions.
            maxOutputTokens: mode === "coach" ? 4000 : 2000,
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
          m.includes("high demand") ||
          m.includes("timeout") ||
          m.includes("Timeout") ||
          m.includes("fetch failed") ||
          m.includes("aborted") ||
          m.includes("504") ||
          m.includes("DEADLINE");
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
