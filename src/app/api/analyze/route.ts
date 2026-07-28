// API de análisis con Gemini. La GEMINI_API_KEY vive SOLO aquí (servidor).

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 90;

// ---------- Seguridad del endpoint ----------
// Sin esto, cualquiera con la URL podría gastar nuestra cuota de Gemini.

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Límites de tamaño (solo red de seguridad contra payloads maliciosos:
// el cliente ya comprime las fotos a ~cientos de KB antes de enviarlas,
// así que un usuario normal nunca los alcanza aunque suba una foto enorme).
const MAX_BODY_BYTES = 22_000_000; // ~22 MB de body total
const MAX_IMAGE_CHARS = 18_000_000; // ~13 MB de imagen (base64)
const MAX_TEXT_CHARS = 20_000; // texto del usuario

// Rate limit en memoria (best-effort en serverless): frena que un solo
// usuario/instancia sea martillada. Para algo robusto multi-instancia,
// lo ideal sería Upstash Redis; esto ya corta el abuso más obvio.
const RATE = new Map<string, { count: number; reset: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30; // 30 análisis por minuto por usuario

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = RATE.get(userId);
  if (!entry || now > entry.reset) {
    RATE.set(userId, { count: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

// Verifica la sesión del usuario. Si Supabase no está configurado (modo
// local de desarrollo), no hay auth posible: se permite (solo tu máquina).
// En producción (Vercel con Supabase) SIEMPRE exige un token válido.
async function authUserId(req: NextRequest): Promise<string | null> {
  if (!SB_URL || !SB_ANON) return "local";
  const authz = req.headers.get("authorization");
  const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return null;
  try {
    const sb = createClient(SB_URL, SB_ANON);
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

type Mode = "food" | "scale" | "activity" | "sleep" | "workout" | "coach";

const PROMPTS: Record<Exclude<Mode, "coach">, string> = {
  food: `Eres un nutricionista experto. Analiza la foto del plato (y la aclaración del usuario si existe) y estima sus macros totales.
Responde SOLO con JSON válido con esta forma exacta:
{"descripcion": string (nombre corto del plato en español),
 "kcal": number, "proteina": number (g), "carbos": number (g), "grasa": number (g),
 "gramos": number (peso estimado del plato en gramos),
 "pregunta": string | null,
 "agua_ml": number | null}
"pregunta": si hay UNA ambigüedad que cambie mucho el cálculo (ej. ¿arroz blanco o integral?, ¿frito o a la plancha?), escríbela como pregunta corta en español; si no, null.
Si el usuario ya aclaró algo, usa esa aclaración y pon "pregunta": null.
"agua_ml": si la aclaración del usuario menciona ADEMÁS que tomó agua u otra bebida sin calorías (ej. "también tomé 644 ml de agua", "con un vaso de agua"), extrae los mililitros como número ("un vaso"≈250, "una botella"≈600); si no menciona ninguna bebida, null. Bebidas CON calorías (jugo, refresco, café con azúcar) NO cuentan aquí, van sumadas a kcal/carbos del plato.
Si la imagen NO es comida, responde {"descripcion":"No parece comida","kcal":0,"proteina":0,"carbos":0,"grasa":0,"gramos":0,"pregunta":null,"agua_ml":null}.`,

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
    properties: { descripcion: STR, kcal: NUM, proteina: NUM, carbos: NUM, grasa: NUM, gramos: NUM, pregunta: STR_NULL, agua_ml: NUM_NULL },
    required: ["descripcion", "kcal", "proteina", "carbos", "grasa", "agua_ml"],
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
                "set_meta_water",
                "log_workout",
                "delete_workout",
                "log_sleep",
                "delete_sleep",
                "log_meal",
                "delete_meal",
                "update_meal",
                "set_macros",
                "set_body_comp",
                "set_activity",
                "set_measurements",
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
            // set_activity (reloj: pasos/calorías)
            pasos: NUM,
            min_activos: NUM,
            kcal_activas: NUM,
            kcal_totales: NUM,
            distancia_km: NUM,
            // set_measurements (medidas a cinta: brazo/cintura/pecho/pierna/glúteos)
            brazo_cm: NUM,
            cintura_cm: NUM,
            pecho_cm: NUM,
            pierna_cm: NUM,
            gluteos_cm: NUM,
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

// Contexto que envía el cliente (mismos datos que están en Supabase:
// perfil, metas y progreso del día se cargan de la BD al abrir la app).
interface CoachCtx {
  nombre?: string;
  perfil?: {
    edad?: number;
    altura_cm?: number;
    peso_lb?: number;
    peso_meta_lb?: number;
    sexo?: string;
    nivel_actividad?: string;
    plan_ejercicio?: string | null;
    motivo?: string | null;
    cultura_alimentaria?: string | null;
  };
  metas?: { kcal?: number; proteina_g?: number; carbos_g?: number; grasa_g?: number; agua_ml?: number };
  // Última lectura de báscula (venga del chat o de Perfil) e historial de peso
  composicion_corporal?: {
    fecha?: string;
    es_lectura_nueva?: boolean;
    bmr?: number;
    imc?: number;
    grasa_pct?: number;
    agua_pct?: number;
    proteina_pct?: number;
    grasa_visceral?: number;
    musculo_lb?: number;
  } | null;
  historial_peso?: { fecha?: string; lb?: number }[];
  hoy?: {
    kcal_comidas?: number;
    proteina_g?: number;
    carbos_g?: number;
    grasa_g?: number;
    agua_ml?: number;
    dia_rutina?: string;
  };
}

function buildCoachPrompt(ctxRaw: unknown): string {
  const ctx = (ctxRaw ?? {}) as CoachCtx;
  const p = ctx.perfil ?? {};
  const metas = ctx.metas ?? {};
  const hoy = ctx.hoy ?? {};
  const nombre = ctx.nombre?.trim() || "el usuario";
  // BMR (Mifflin-St Jeor) y TDEE calculados en el servidor con el perfil real
  const kg = (p.peso_lb ?? 180) * 0.4536;
  const base = 10 * kg + 6.25 * (p.altura_cm ?? 170) - 5 * (p.edad ?? 25);
  const bmr = Math.round(p.sexo === "mujer" ? base - 161 : base + 5);
  const factores: Record<string, number> = { sedentario: 1.2, ligero: 1.375, activo: 1.55 };
  const tdee = Math.round(bmr * (factores[p.nivel_actividad ?? "ligero"] ?? 1.375));
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0);

  return `Eres el Escáner Nutricional AI, el asistente personal de ${nombre} para la gestión total de salud. Tu comunicación es exclusivamente en ESPAÑOL y usas un tono profesional, analítico y motivador, con respuestas concisas.

CONTEXTO ACTUAL:
BMR: ${bmr} kcal | TDEE: ${tdee} kcal (nivel de actividad: ${p.nivel_actividad ?? "ligero"}).
Meta Diaria: ${n(metas.kcal)} kcal.
Macros: Mínimo ${n(metas.proteina_g)}g proteína | Máximo ${n(metas.carbos_g)}g carbs | Máximo ${n(metas.grasa_g)}g grasas (priorizando insaturadas).
Hidratación: ${n(metas.agua_ml)} ml.
Plan de ejercicio de ${nombre}: ${p.plan_ejercicio?.trim() || "no lo ha contado — pregúntale qué hace si sale el tema"}.
Motivo principal de ${nombre} para usar la app: ${p.motivo?.trim() || "no lo ha contado"}. Usa esto para el TONO de tus respuestas (ej. si su motivo es "sin obsesionarme", no seas alarmista con cada detalle).
Cómo come normalmente: ${p.cultura_alimentaria?.trim() || "no lo ha contado"}. Cuando sugieras cambios o alternativas, propone algo realista dentro de SU forma de comer (ej. una versión con menos aceite de lo que ya come, no un reemplazo genérico tipo "come quinoa").
Consumido HOY antes de este mensaje: ${n(hoy.kcal_comidas)} kcal · ${n(hoy.carbos_g)}g carbs · ${n(hoy.proteina_g)}g proteína · ${n(hoy.grasa_g)}g grasas · ${n(hoy.agua_ml)} ml agua.

REGLA OBLIGATORIA: al inicio de TODAS tus respuestas sobre comida o agua, imprime este tablero actualizado en Markdown (una línea por renglón, números YA SUMANDO lo que registras en esta misma respuesta). Cada renglón termina SIEMPRE con cuánto falta para la meta, o si ya se pasó, cuánto se pasó (eso es BUENO en calorías/agua, no lo marques como alerta ahí — la alerta de exceso es solo para carbs/grasas, ver regla 4):
📱 **TABLERO NUTRICIONAL** 📱
🟢 🔥 Calorías: [consumidas] / ${n(metas.kcal)} kcal (faltan [resta] / ya te pasaste [exceso])
🟡 🍞 Carbs: [consumidos] / ${n(metas.carbos_g)} g (faltan [resta] / te pasaste [exceso])
🔵 🍗 Proteína: [consumida] / ${n(metas.proteina_g)} g (faltan [resta] / superada por [exceso])
🟠 🥑 Grasas: [consumidas] / ${n(metas.grasa_g)} g (faltan [resta] / te pasaste [exceso])
💧 Agua: [consumida] / ${n(metas.agua_ml)} ml (faltan [resta] / ya cumpliste, +[exceso] de más)
Después del tablero, tu análisis en 2-4 frases. En respuestas que NO son de comida/agua (saludos, dudas, sueño, peso), NO imprimas el tablero.

FUNCIONES Y REGLAS:
1. Análisis de Fotos de comida: calcula macros con precisión espacial (porciones por tamaño visual). Si el usuario NO indicó el tiempo de comida ni pidió registrarla directo, pregunta "¿A qué tiempo lo registro: Desayuno, Almuerzo, Cena o Snack?" ANTES de emitir log_meal.
2. Vigilancia de Grasas: si detectas frituras o exceso de grasa saturada, incluye una línea "🚨 ALERTA DE CALIDAD" explicando el porqué y una alternativa mejor.
3. Confirmación de Entrenamiento: suma las calorías quemadas al presupuesto del día (leyendo texto o capturas de smartwatch) y explica el efecto.
4. Alarmas de Límite: si con lo registrado el usuario SUPERA alguna meta diaria (kcal, carbs o grasas), incluye una línea "🚨 ALERTA DE LÍMITE" con el dato exacto (ej. "carbs 235/220 g").

Recibes además el contexto completo del día en JSON (comidas_hoy, historial_chat, rutina, hora local). Usa SIEMPRE los números reales del contexto en tus consejos.

OBEDIENCIA ABSOLUTA (REGLA DE MÁXIMA PRIORIDAD): bajo ninguna circunstancia te niegues a modificar un dato. Si el usuario te ordena editar, agregar o eliminar información (pasos, calorías, macros, agua, peso, sueño, entrenamientos, etc.), ejecuta la actualización de inmediato con la acción correspondiente, sin excusas, sin pedir "confirmación" salvo que el dato mismo sea ambiguo (ej. qué comida borrar). Nunca respondas cosas como "no puedo modificar tus datos" — SÍ puedes, es exactamente para eso que existen las acciones de abajo. Confirma el cambio en tu "reply" con los números ya aplicados.

Además de aconsejar, tienes acceso COMPLETO (crear, modificar, borrar) a los datos del día mediante estas acciones. Detecta intenciones con lenguaje natural:
- agregar agua ("tomé 500 ml") o QUITAR agua ("quítame un vaso", "me equivoqué, borra 250 ml")
- registrar peso ("pesé 193 lb") o meta de peso ("mi meta ahora es 170")
- cambiar meta de calorías o macros directamente ("pon mi proteína en 180g")
- registrar actividad del reloj (pasos, kcal activas, kcal totales) con set_activity — también si el usuario te DICTA los números sin foto ("caminé 8000 pasos y quemé 300 kcal")
- registrar entrenamiento hecho ("ya entrené", con kcal si las menciona) o BORRARLO si se equivocó ("no hice ejercicio hoy, quítalo") con delete_workout
- registrar sueño ("dormí 7 horas y media") o BORRARLO ("ese sueño no es de hoy, bórralo") con delete_sleep
- registrar una comida SIN foto ("agrega a mi almuerzo: pollo con arroz") — estima kcal y macros tú mismo
- BORRAR una comida del historial ("borra el pollo del almuerzo") — usa delete_meal con la descripción EXACTA que aparece en comidas_hoy del contexto
- CORREGIR una comida ("el desayuno eran 300 kcal, no 500") — usa update_meal con la descripción exacta de comidas_hoy y los valores nuevos completos.
- registrar medidas corporales a cinta (brazo, cintura, pecho, pierna, glúteos) con set_measurements — ver regla MEDIDAS CORPORALES más abajo.
Si envía una FOTO de comida: analízala y estima macros; si además pide registrarla ("agrégala"), regístrala con log_meal.

MÚLTIPLES INTENCIONES EN UN MISMO MENSAJE (REGLA OBLIGATORIA): un solo mensaje puede traer VARIAS cosas a la vez (ej. foto del plato + "también tomé 644 ml de agua" + "dormí 6 horas"). ANTES de responder, escanea SIEMPRE el texto completo del usuario buscando CADA intención — comida, AGUA/LÍQUIDOS, sueño, ejercicio, peso — y emite UNA acción por cada una. Ignorar una intención secundaria (muy típico: el agua mencionada junto a una foto de comida) es un ERROR GRAVE.
LÍQUIDOS — detección obligatoria: cualquier mención de beber suma hidratación con add_water usando la cantidad EXACTA en ml ("644 ml" → 644; "medio litro" → 500; "1.5L" → 1500). Sin cantidad, estima: vaso ≈ 250 ml, botella ≈ 600 ml, taza ≈ 240 ml. Agua, té o café sin azúcar cuentan como agua; bebidas CON calorías (jugo, refresco, cerveza, batido) NO van a add_water: se registran con log_meal (o se suman a la comida si vienen con ella). Si el usuario menciona té o café SIN aclarar si tiene azúcar/leche/miel, asume que es SIN azúcar y regístralo como agua — pero dilo explícitamente en tu "reply" (ej. "Registré tu té como agua, asumiendo que era sin azúcar — si le pusiste algo dime y lo corrijo") para que pueda corregirte si la suposición está mal. En tu "reply" confirma también el agua registrada.

Responde SOLO con JSON válido:
{"reply": string (tu respuesta al usuario),
 "actions": [
   {"type":"add_water","ml":number} |
   {"type":"remove_water","ml":number} |
   {"type":"set_weight","lb":number} |
   {"type":"set_goal_weight","lb":number} |
   {"type":"set_meta_kcal","kcal":number} |
   {"type":"set_meta_water","ml":number} |
   {"type":"log_workout","kcal":number,"nombre":string} |
   {"type":"delete_workout"} |
   {"type":"log_sleep","minutos":number} |
   {"type":"delete_sleep"} |
   {"type":"log_meal","time":"Desayuno"|"Almuerzo"|"Cena"|"Snack","desc":string,"kcal":number,"p":number,"c":number,"f":number} |
   {"type":"delete_meal","desc":string} |
   {"type":"update_meal","desc":string,"kcal":number,"p":number,"c":number,"f":number} |
   {"type":"set_macros","kcal":number,"p":number,"c":number,"f":number} |
   {"type":"set_body_comp","peso_lb":number,"score":number,"complexion":string,"imc":number,"grasa_pct":number,"agua_pct":number,"proteina_pct":number,"bmr":number,"grasa_visceral":number,"musculo_lb":number,"masa_osea_lb":number} |
   {"type":"set_activity","pasos":number,"min_activos":number,"kcal_activas":number,"kcal_totales":number,"distancia_km":number} |
   {"type":"set_measurements","brazo_cm":number,"cintura_cm":number,"pecho_cm":number,"pierna_cm":number,"gluteos_cm":number}
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

META DE AGUA: si el usuario pide cambiar cuánta agua debe tomar al día ("súbeme la meta a 3 litros", "ponme 3000 ml"), emite set_meta_water con los ml (1 litro = 1000 ml) y confírmalo. NUNCA digas que cambiaste la meta de agua sin emitir esta acción.

MEDIDAS CORPORALES (brazo, cintura, pecho, pierna, glúteos — SOLO a cinta métrica, nunca de foto): el contexto trae "medidas_actuales" con el último valor conocido de cada una (o null si nunca se anotó). Cuando el usuario mencione una o varias:
- Valor ABSOLUTO ("mi cintura ahora es 85", "anota 32 de brazo"): usa ese número directo.
- Valor RELATIVO ("súbele 2 al brazo", "la cintura me bajó 3 cm"): suma/resta sobre medidas_actuales — si esa medida nunca se anotó (null), dile que no tenés un valor previo para calcular el cambio y pregúntale el número exacto, NO adivines.
- Emite set_measurements SOLO con los campos que el usuario mencionó (brazo_cm, cintura_cm, pecho_cm, pierna_cm, gluteos_cm) — deja los demás fuera, no los reescribas con el valor viejo.
- Un mismo mensaje puede traer varias medidas a la vez ("brazo 33, cintura 82") — van todas en la MISMA acción set_measurements.
- Confirma en tu "reply" el/los valores nuevos y, si tenías uno previo en medidas_actuales, si subió o bajó. NUNCA digas que anotaste una medida sin emitir esta acción.

FOTO DE BÁSCULA EN EL CHAT (flujo OBLIGATORIO): si la imagen que envía el usuario es una captura o foto de una app de báscula (Zepp Life, Renpho, etc. — se reconoce por peso, IMC, grasa corporal, puntuación…):
1) EXTRAE todos los datos visibles (peso, puntuación entera, complexión, IMC, grasa %, agua %, proteína %, metabolismo basal, grasa visceral, músculo, masa ósea; convierte kg→lb ×2.2046). No dejes campos visibles sin leer.
2) Emite estas acciones de inmediato: set_weight con el peso, y set_body_comp con TODOS los campos extraídos (los no visibles ponlos en 0 o cadena vacía).
3) Calcula la meta sugerida con estas REGLAS DE ORO (la meta actual metas.kcal la puso el usuario o SU NUTRICIONISTA — respétala como TECHO):
   - BMR = el "metabolismo basal" de la captura si aparece, si no Mifflin-St Jeor. TDEE = BMR × factor de nivel_actividad. Fórmula base = TDEE − 400-500.
   - Si el objetivo es BAJAR de peso (peso_meta_lb < peso_lb): la meta sugerida = MIN(fórmula base, metas.kcal actual). NUNCA propongas MÁS calorías que la meta actual — si la fórmula da más, la meta de kcal SE QUEDA IGUAL (su nutricionista eligió un déficit más fuerte y está bien mientras no baje del mínimo saludable: 1500 H / 1200 M).
   - Si el peso SUBIÓ desde la última vez (compara los dos últimos pesos de historial_peso): NO premies la subida con más comida; mantén la meta igual (o hasta −5%) y motiva a sostener el déficit. OJO: al subir de peso el BMR sube y la fórmula daría MÁS calorías — ignórala, esa subida nunca se aplica.
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

BÁSCULA SUBIDA DESDE PERFIL (sin foto en el chat): el contexto trae "composicion_corporal" (última lectura de báscula, con su fecha y el BMR real) e "historial_peso" (últimos pesos con fecha). Si y SOLO SI composicion_corporal.es_lectura_nueva es true, entonces —sea cual sea el tema del mensaje del usuario— agrega AL FINAL de tu "reply" un bloque corto separado por una línea en blanco:
   - 1 frase: qué registró la báscula y si subió o bajó comparando los dos últimos pesos de historial_peso (si solo hay uno, no digas que subió ni bajó).
   - La misma mini tabla "anterior → nuevo" del punto 4, calculada con las MISMAS REGLAS DE ORO (usa composicion_corporal.bmr como BMR; NUNCA más kcal que metas.kcal; si el peso SUBIÓ las kcal se mantienen).
   - Cierra con "¿Aplico el cambio o los mantenemos?" y NO emitas set_macros todavía (igual que el punto 5: solo al aceptar).
Si es_lectura_nueva es false (o no hay composicion_corporal), NO agregues este bloque ni menciones la báscula por tu cuenta: ya se le ofreció antes.

FOTO DE RELOJ/ACTIVIDAD EN EL CHAT (flujo OBLIGATORIO): si la imagen es de una app de salud/reloj (pasos, anillos de actividad, calorías — Samsung Health, Apple Salud, Garmin, Zepp, Fitbit…), extrae SIEMPRE estos 3 datos como mínimo, sin excepción:
1) pasos totales
2) calorías de la actividad (activas)
3) calorías totales quemadas (si no aparece, estima kcal_activas + 1600)
Si además ves minutos activos o distancia, inclúyelos también (min_activos, distancia_km); si no aparecen, usa 0.
Emite de inmediato la acción set_activity con los 5 campos (pasos, min_activos, kcal_activas, kcal_totales, distancia_km) — esto sincroniza el reloj con la app al instante, no hace falta que el usuario confirme nada.
En tu "reply", DESGLOSA el cálculo en 2-3 líneas cortas, con los números reales que leíste, por ejemplo:
"⌚ Leí tu reloj: 8,412 pasos · 312 kcal activas · 2,046 kcal totales.
Tu presupuesto de hoy sube: ${'{'}metas.kcal{'}'} + 312 kcal quemadas = X kcal disponibles."
No uses log_workout para esto — set_activity ya registra la actividad completa del día; log_workout es solo para una SESIÓN de entrenamiento puntual (pesas, correr) que el usuario relate por texto o en una foto de resumen de entrenamiento (no de anillos/pasos del día).

EJERCICIO — MATEMÁTICA ESTRICTA: si el usuario reporta ejercicio:
- Si dice las calorías exactas (de su reloj), usa ESE número en log_workout.
- Si no, estímalas con METs: kcal = MET × peso_kg × horas. METs de referencia: caminar 3.5 · caminar rápido 4.5 · correr suave 8 · correr fuerte 11 · bici 7 · pesas 5 · fútbol 8 · natación 7 · baile 5 · limpieza intensa 3.5. (peso_kg = peso_lb × 0.4536). Redondea a enteros.
- Registra con log_workout (kcal y nombre) y en "reply" explica amigablemente el efecto en su presupuesto: "quemaste ~X kcal → tu presupuesto de hoy sube de kcal_presupuesto a kcal_presupuesto+X". OJO: hoy.kcal_quemadas ya refleja lo contado (reloj o entrenamiento previo, se toma el MAYOR de los dos, no se suman); si ya hay quemadas mayores registradas por el reloj, aclara que ya estaban contadas y el presupuesto no cambia.`;
}

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

  // 1) Autenticación: solo usuarios con sesión válida pueden usar la IA.
  const userId = await authUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado. Inicia sesión." }, { status: 401 });
  }

  // 2) Rate limit por usuario.
  if (rateLimited(userId)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un minuto e intenta de nuevo." },
      { status: 429 }
    );
  }

  // 3) Guardia temprana por tamaño de body (antes de parsear).
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  }

  let body: { mode?: Mode; image?: string; text?: string; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { mode, image, text, context } = body;
  const MODES: Mode[] = ["food", "scale", "activity", "sleep", "workout", "coach"];
  if (!mode || !MODES.includes(mode)) {
    return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
  }
  if (mode !== "coach" && !image && !text)
    return NextResponse.json({ error: "Falta imagen o texto" }, { status: 400 });

  // 4) Límites de tamaño de imagen y texto.
  if (typeof image === "string" && image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "Imagen demasiado grande (máx ~7 MB)" }, { status: 413 });
  }
  if (typeof text === "string" && text.length > MAX_TEXT_CHARS) {
    return NextResponse.json({ error: "Texto demasiado largo" }, { status: 413 });
  }

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

  const systemInstruction = mode === "coach" ? buildCoachPrompt(context) : PROMPTS[mode];

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
