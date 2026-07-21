"use client";

// Coach IA: chat con contexto real del día; foto para analizar; acciones por texto.

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { motion, AnimatePresence } from "motion/react";
import Pressable from "@/components/Pressable";
import { analyze, CoachAction, CoachResult, fileToDataURL } from "@/lib/analyze";
import * as db from "@/lib/db";
import { useApp, currentMealTime } from "@/lib/store";
import { ChatMessage, MealTime, RoutineDay, todayISO } from "@/lib/types";

// El chat se guarda de forma permanente; solo se borra con el botón "Limpiar".
const CHAT_KEY = "ahivoy:chat";

function loadChat(greeting: ChatMessage): ChatMessage[] {
  if (typeof window === "undefined") return [greeting];
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { messages: ChatMessage[] };
      if (saved.messages?.length) return saved.messages;
    }
  } catch {
    // chat corrupto: empezamos de cero
  }
  return [greeting];
}

function saveChat(messages: ChatMessage[]) {
  try {
    // Sin imágenes (pesan mucho): se reemplazan por un marcador.
    const light = messages.map((m) => (m.image ? { ...m, image: "", text: m.text || "(foto)" } : m));
    localStorage.setItem(CHAT_KEY, JSON.stringify({ messages: light.slice(-60) }));
  } catch {
    // sin espacio: no pasa nada
  }
}

// Markdown de las burbujas del coach (negritas, listas, saltos de línea)
// `tight` = usado dentro de la tarjeta del tablero (líneas pegadas, sin margen extra)
function CoachMarkdown({ text, tight = false }: { text: string; tight?: boolean }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkBreaks]}
      components={{
        p: ({ children }) => <p style={{ margin: tight ? 0 : "0 0 6px" }}>{children}</p>,
        strong: ({ children }) => <strong style={{ fontWeight: 800 }}>{children}</strong>,
        ul: ({ children }) => <ul style={{ margin: "4px 0", paddingLeft: 18 }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: "4px 0", paddingLeft: 18 }}>{children}</ol>,
        li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
        h1: ({ children }) => <div style={{ fontWeight: 800, fontSize: 14, margin: "4px 0" }}>{children}</div>,
        h2: ({ children }) => <div style={{ fontWeight: 800, fontSize: 13.5, margin: "4px 0" }}>{children}</div>,
        h3: ({ children }) => <div style={{ fontWeight: 800, fontSize: 13, margin: "4px 0" }}>{children}</div>,
        code: ({ children }) => (
          <code style={{ background: "rgba(255,255,255,.08)", borderRadius: 4, padding: "1px 5px", fontSize: 12 }}>{children}</code>
        ),
        a: ({ children }) => <span style={{ color: "#c7f27a", fontWeight: 700 }}>{children}</span>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

// Separa el bloque del Tablero Nutricional del resto del mensaje
function splitTablero(text: string): { board: string | null; rest: string } {
  if (!text.includes("TABLERO NUTRICIONAL")) return { board: null, rest: text };
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.includes("TABLERO NUTRICIONAL"));
  if (start === -1) return { board: null, rest: text };
  let end = start;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l === "" && end === start) continue; // línea en blanco justo tras el título
    if (/^(🟢|🟡|🔵|🟠|💧)/.test(l)) end = i;
    else if (l !== "") break;
  }
  const board = lines.slice(start, end + 1).join("\n");
  const rest = [...lines.slice(0, start), ...lines.slice(end + 1)].join("\n").trim();
  return { board, rest };
}

// Ícono de portapapeles (SVG, hereda el color del texto)
function ClipboardIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// Tarjeta de la tira de contexto del chat (valor + etiqueta).
// Compacta a propósito: las 5 caben en una sola fila en móvil; la
// etiqueta puede partirse en 2 líneas, el valor nunca se rompe.
function ContextCard({ value, label, color, glow }: { value: string; label: string; color: string; glow: string }) {
  return (
    <div style={{ background: "#1b1e21", borderRadius: 10, padding: "7px 3px", textAlign: "center" }}>
      <div className="font-sora" style={{ fontSize: 12.5, fontWeight: 800, color, textShadow: `0 0 8px ${glow}`, whiteSpace: "nowrap" }}>
        {value}
      </div>
      <div style={{ fontSize: 7.3, fontWeight: 700, color: "rgba(244,243,238,.45)", lineHeight: 1.15, marginTop: 1 }}>{label}</div>
    </div>
  );
}

// Ícono de micrófono (SVG, hereda color por prop)
function MicIcon({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

// Botón sutil de copiar con tooltip "¡Copiado!" animado (motion)
function CopyButton({
  text,
  index,
  copiedIdx,
  onCopy,
  color,
}: {
  text: string;
  index: number;
  copiedIdx: number | null;
  onCopy: (text: string, i: number) => void;
  color: string;
}) {
  const copied = copiedIdx === index;
  return (
    <div style={{ position: "relative" }}>
      <motion.button
        type="button"
        aria-label="Copiar mensaje"
        whileTap={{ scale: 0.9 }}
        onClick={() => onCopy(text, index)}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color,
          opacity: 0.55,
        }}
      >
        <ClipboardIcon />
      </motion.button>
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              bottom: "100%",
              right: 0,
              marginBottom: 4,
              background: "#c7f27a",
              color: "#10240a",
              fontSize: 10,
              fontWeight: 800,
              padding: "3px 8px",
              borderRadius: 6,
              whiteSpace: "nowrap",
              boxShadow: "0 0 10px rgba(199,242,122,.5)",
            }}
          >
            ¡Copiado!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Tipos mínimos de la Web Speech API (no vienen en TS estándar)
interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEventLike {
  results: { length: number; [i: number]: SpeechResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const QUICK_PROMPTS = [
  { text: "Calcula mi meta ideal", send: "Calcula mi meta diaria de calorías ideal según mi peso, altura, edad y sexo, con un déficit saludable, explícame el cálculo y actualízala" },
  { text: "Registré ejercicio", send: "Acabo de hacer ejercicio, ¿cómo lo registro para que sume a mi presupuesto?" },
  { text: "Registrar sin foto", send: "Agrega a mi almuerzo: pollo con arroz y ensalada" },
  { text: "¿Qué ceno hoy?", send: "¿Qué me recomiendas cenar hoy?" },
  { text: "Revisa un menú", send: "Voy a un restaurante, ¿qué me recomiendas pedir según mis macros de hoy?" },
  { text: "Sigo con hambre", send: "Llegué a mi meta de proteína pero sigo con hambre, ¿qué como?" },
  { text: "¿Esto o aquello?", send: "¿Me recomiendas esto o aquello?" },
];

export default function Coach() {
  const app = useApp();
  const {
    profile,
    water,
    workout,
    sleep,
    routine,
    kcalEaten,
    proteinG,
    carbsG,
    fatG,
    burnedKcal,
    kcalRemaining,
    showToast,
  } = app;

  const firstName = profile.name ? profile.name.split(" ")[0] : "";
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadChat({
      role: "coach",
      text: `¡Hola${firstName ? " " + firstName : ""}! 👋 Soy tu Coach IA. Conozco tus macros, tu meta y tu rutina de hoy. Pregúntame qué comer, pídeme que revise el menú de un restaurante o cuéntame cómo te sientes.`,
    })
  );
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  // Foto elegida pero AÚN no enviada: el usuario puede escribir contexto antes.
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Copiar mensajes
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Dictado por voz (Web Speech API)
  const [listening, setListening] = useState(false);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const dictationBaseRef = useRef("");

  useEffect(() => {
    return () => recogRef.current?.stop();
  }, []);

  const copyMessage = (text: string, i: number) => {
    const markCopied = () => {
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 1400);
    };
    // Fallback para navegadores/WebViews donde el Clipboard API moderno
    // no está disponible o el permiso viene denegado por el contexto.
    const legacyCopy = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) markCopied();
        else showToast("No se pudo copiar");
      } catch {
        showToast("No se pudo copiar");
      }
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(markCopied).catch(legacyCopy);
    } else {
      legacyCopy();
    }
  };

  const toggleMic = () => {
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      showToast("Tu navegador no soporta dictado por voz");
      return;
    }
    const rec = new Ctor();
    rec.lang = "es-ES";
    rec.continuous = true;
    rec.interimResults = true;
    dictationBaseRef.current = input.trim();
    rec.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      const base = dictationBaseRef.current;
      setInput((base ? base + " " : "") + txt.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recogRef.current = rec;
    setListening(true);
    rec.start();
  };

  const protLeft = Math.max(0, profile.metaProtein - proteinG);
  const carbsLeft = Math.max(0, profile.metaCarbs - carbsG);
  const fatLeft = Math.max(0, profile.metaFat - fatG);
  const waterLeft = Math.max(0, profile.metaWater - water);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (messages.length > 1) saveChat(messages);
  }, [messages]);

  // Busca una comida por descripción (exacta o aproximada)
  const matchMeal = (lista: { id: string; desc: string }[], desc: string) => {
    const q = desc.trim().toLowerCase();
    return (
      lista.find((m) => m.desc.toLowerCase() === q) ??
      lista.find((m) => m.desc.toLowerCase().includes(q) || q.includes(m.desc.toLowerCase()))
    );
  };

  const applyActions = async (actions: CoachAction[]) => {
    const today = todayISO();
    for (const a of actions) {
      try {
        const fecha = a.fecha && /^\d{4}-\d{2}-\d{2}$/.test(a.fecha) && a.fecha !== today ? a.fecha : null;

        if (!fecha) {
          // ---- Acciones sobre HOY (actualizan la pantalla al instante) ----
          if (a.type === "add_water" && a.ml) await app.addWater(a.ml);
          else if (a.type === "remove_water" && a.ml) await app.addWater(-a.ml);
          else if (a.type === "delete_meal" && a.desc) {
            const meal = matchMeal(app.meals, a.desc);
            if (meal) await app.deleteMeal(meal.id);
          } else if (a.type === "update_meal" && a.desc) {
            const meal = matchMeal(app.meals, a.desc) as (typeof app.meals)[number] | undefined;
            if (meal)
              await app.updateMeal({
                ...meal,
                kcal: a.kcal ?? meal.kcal,
                p: a.p ?? meal.p,
                c: a.c ?? meal.c,
                f: a.f ?? meal.f,
              });
          } else if (a.type === "set_weight" && a.lb) await app.setWeight(a.lb);
          else if (a.type === "set_goal_weight" && a.lb) await app.setWeightGoal(a.lb);
          else if (a.type === "set_meta_kcal" && a.kcal) await app.saveProfile({ ...profile, metaKcal: a.kcal });
          else if (a.type === "log_sleep" && a.minutos) await app.setSleep({ minutes: a.minutos, phases: sleep?.phases ?? null });
          else if (a.type === "log_workout")
            await app.setWorkout({
              day: workout?.day ?? "Push",
              done: true,
              kcal: a.kcal ?? 300,
              name: a.nombre ?? "Entrenamiento",
              notes: workout?.notes ?? "",
            });
          else if (a.type === "log_meal" && a.desc)
            await app.addMeal({
              time: (a.time as MealTime) || currentMealTime(),
              desc: a.desc,
              kcal: a.kcal ?? 0,
              p: a.p ?? 0,
              c: a.c ?? 0,
              f: a.f ?? 0,
            });
          else if (a.type === "set_macros" && a.kcal)
            await app.saveProfile({
              ...profile,
              metaKcal: Math.round(a.kcal),
              metaProtein: Math.round(a.p ?? profile.metaProtein),
              metaCarbs: Math.round(a.c ?? profile.metaCarbs),
              metaFat: Math.round(a.f ?? profile.metaFat),
            });
          else if (a.type === "set_body_comp")
            await app.setBodyComp(
              {
                score: Math.round(a.score ?? 0),
                build: a.complexion || "—",
                bmi: a.imc ?? 0,
                fatPct: a.grasa_pct ?? 0,
                waterPct: a.agua_pct ?? 0,
                proteinPct: a.proteina_pct ?? 0,
                bmr: Math.round(a.bmr ?? 0),
                visceralFat: a.grasa_visceral ?? 0,
                muscle: a.musculo_lb ?? 0,
                boneMass: a.masa_osea_lb ?? 0,
                date: today,
              },
              a.peso_lb && a.peso_lb > 0 ? a.peso_lb : undefined
            );
        } else {
          // ---- Acciones sobre OTRO día (directo a la base de datos) ----
          if ((a.type === "add_water" || a.type === "remove_water") && a.ml) {
            const actual = await db.waterFor(fecha);
            const delta = a.type === "add_water" ? a.ml : -a.ml;
            await db.setWater(fecha, Math.max(0, actual + delta));
          } else if (a.type === "log_meal" && a.desc) {
            await db.addMeal({
              id: crypto.randomUUID(),
              date: fecha,
              time: (a.time as MealTime) || "Snack",
              desc: a.desc,
              kcal: a.kcal ?? 0,
              p: a.p ?? 0,
              c: a.c ?? 0,
              f: a.f ?? 0,
            });
          } else if (a.type === "delete_meal" && a.desc) {
            const meal = matchMeal(await db.mealsFor(fecha), a.desc);
            if (meal) await db.deleteMeal(meal.id);
          } else if (a.type === "update_meal" && a.desc) {
            const lista = await db.mealsFor(fecha);
            const meal = matchMeal(lista, a.desc) as (typeof lista)[number] | undefined;
            if (meal)
              await db.updateMeal({
                ...meal,
                kcal: a.kcal ?? meal.kcal,
                p: a.p ?? meal.p,
                c: a.c ?? meal.c,
                f: a.f ?? meal.f,
              });
          } else if (a.type === "log_sleep" && a.minutos) {
            await db.setSleep(fecha, { minutes: a.minutos, phases: null });
          } else if (a.type === "log_workout") {
            await db.setWorkout(fecha, {
              day: (workout?.day ?? "Push") as RoutineDay,
              done: true,
              kcal: a.kcal ?? 300,
              name: a.nombre ?? "Entrenamiento",
              notes: "",
            });
          } else if (a.type === "set_weight" && a.lb) {
            await db.addWeight({ date: fecha, lb: a.lb });
          }
        }
      } catch {
        // una acción fallida no debe romper el chat
      }
    }
    if (actions.length) showToast("Coach actualizó tus datos ✓");
  };

  const send = async (text: string, image?: string) => {
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
    }
    const clean = text.trim();
    const photo = image ?? pendingPhoto ?? undefined;
    if (!clean && !photo) return;
    const userMsg: ChatMessage = { role: "user", text: clean, image: photo };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingPhoto(null);
    setTyping(true);
    try {
      const context = {
        nombre: profile.name,
        perfil: {
          edad: profile.age,
          altura_cm: profile.height,
          peso_lb: profile.weight,
          peso_meta_lb: profile.weightGoal,
          sexo: profile.sex === "F" ? "mujer" : "hombre",
          nivel_actividad: profile.activityLevel,
        },
        metas: {
          kcal: profile.metaKcal,
          proteina_g: profile.metaProtein,
          carbos_g: profile.metaCarbs,
          grasa_g: profile.metaFat,
          agua_ml: profile.metaWater,
          peso_meta_lb: profile.weightGoal,
        },
        hoy: {
          kcal_comidas: kcalEaten,
          kcal_quemadas: burnedKcal,
          kcal_presupuesto: profile.metaKcal + burnedKcal,
          kcal_libres: kcalRemaining,
          proteina_g: proteinG,
          proteina_faltante_g: protLeft,
          carbos_g: carbsG,
          grasa_g: fatG,
          agua_ml: water,
          agua_faltante_ml: waterLeft,
          entrenamiento_hecho: workout?.done ?? false,
          dia_rutina: workout?.day ?? "Push",
          sueno_min: sleep?.minutes ?? null,
        },
        comidas_hoy: app.meals.map((m) => ({
          desc: m.desc,
          time: m.time,
          kcal: m.kcal,
          p: m.p,
          c: m.c,
          f: m.f,
        })),
        // Últimos mensajes para que el coach recuerde qué propuso
        // (ej. macros pendientes de confirmar tras subir la báscula)
        historial_chat: messages.slice(-8).map((m) => ({
          de: m.role === "user" ? "usuario" : "coach",
          texto: m.text.slice(0, 400),
        })),
        peso_actual_lb: profile.weight,
        rutina: routine,
        hora_local: new Date().toTimeString().slice(0, 5),
        fecha_hoy: todayISO(),
        dia_semana: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][new Date().getDay()],
      };
      const res = await analyze<CoachResult>({ mode: "coach", text: clean, image: photo, context });
      setMessages((prev) => [...prev, { role: "coach", text: res.reply }]);
      if (res.actions?.length) await applyActions(res.actions);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "coach",
          text:
            e instanceof Error && e.message.includes("GEMINI")
              ? "Aún no tengo conectada la IA (falta la GEMINI_API_KEY en el servidor). Pídele a Luis que la configure 😉"
              : "Ups, no pude responder ahora. Intenta de nuevo en un momento.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const onPickPhoto = async (file: File | undefined | null) => {
    if (!file) return;
    const url = await fileToDataURL(file);
    // No se envía todavía: queda en vista previa para que agregues contexto.
    setPendingPhoto(url);
  };

  return (
    <div
      style={{
        height: "calc(100dvh - 88px - env(safe-area-inset-top))",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
        background: "radial-gradient(120% 55% at 50% 0%, #10281a 0%, #0c1410 46%, #0a0d0b 100%)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 20px 12px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div
          style={{
            width: 38,
            height: 38,
            flex: "none",
            borderRadius: 12,
            background: "linear-gradient(135deg,#a6f06a,#39c9a3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 16px rgba(90,220,150,.5)",
          }}
        >
          <div style={{ width: 14, height: 14, border: "2.5px solid #10240a", borderRadius: "6px 6px 6px 2px" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="font-sora" style={{ fontSize: 16, fontWeight: 800 }}>Coach IA</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#c7f27a", boxShadow: "0 0 6px #c7f27a" }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(244,243,238,.55)" }}>Con tus datos de hoy en tiempo real</div>
          </div>
        </div>
        <div
          onClick={() => {
            const greeting: ChatMessage = {
              role: "coach",
              text: `¡Hola${firstName ? " " + firstName : ""}! 👋 Chat limpio. ¿En qué te ayudo?`,
            };
            setMessages([greeting]);
            try {
              localStorage.removeItem(CHAT_KEY);
            } catch {
              // sin acceso a storage: no pasa nada
            }
            showToast("Chat limpiado");
          }}
          style={{
            flex: "none",
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(244,243,238,.55)",
            border: "1px solid rgba(255,255,255,.15)",
            borderRadius: 100,
            padding: "6px 12px",
            cursor: "pointer",
          }}
        >
          🗑 Limpiar
        </div>
      </div>

      {/* Tira de contexto — las 5 métricas en una sola fila (mobile-first) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5, padding: "10px 20px 4px", flex: "none" }}>
        <ContextCard value={String(kcalRemaining)} label="KCAL LIBRES" color="#c7f27a" glow="rgba(199,242,122,.5)" />
        <ContextCard value={`${carbsLeft}g`} label="CARBS FALTAN" color="oklch(78% 0.15 85)" glow="oklch(78% 0.15 85 / .5)" />
        <ContextCard value={`${protLeft}g`} label="PROTEÍNA FALTA" color="oklch(80% 0.14 25)" glow="oklch(80% 0.14 25 / .5)" />
        <ContextCard value={`${fatLeft}g`} label="GRASAS FALTAN" color="oklch(72% 0.15 40)" glow="oklch(72% 0.15 40 / .5)" />
        <ContextCard value={`${waterLeft}ml`} label="AGUA FALTA" color="oklch(80% 0.13 230)" glow="oklch(80% 0.13 230 / .5)" />
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 20px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => {
          // Tableros y alertas entran con un "pop" más notorio
          const destacado = m.role === "coach" && (m.text.includes("TABLERO NUTRICIONAL") || m.text.includes("🚨"));
          const { board, rest } = m.role === "coach" ? splitTablero(m.text) : { board: null, rest: m.text };
          const bubbleColor = m.role === "user" ? "#10240a" : "#f4f3ee";
          return (
            <motion.div
              key={i}
              initial={destacado ? { opacity: 0, scale: 0.95, y: 10 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={
                destacado
                  ? { type: "spring", stiffness: 320, damping: 24 }
                  : { duration: 0.2, ease: "easeOut" }
              }
              style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}
            >
              <div
                style={{
                  maxWidth: "82%",
                  background: m.role === "user" ? "#c7f27a" : "#1b1e21",
                  color: bubbleColor,
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontWeight: 500,
                  padding: "11px 14px",
                  borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  boxShadow: m.role === "user" ? "0 0 16px rgba(199,242,122,.35)" : "none",
                  ...(m.role === "user" ? { whiteSpace: "pre-wrap" as const } : {}),
                }}
              >
                {m.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.image}
                    alt="foto"
                    style={{ width: "100%", maxWidth: 180, borderRadius: 10, display: "block", marginBottom: m.text ? 8 : 0 }}
                  />
                )}
                {/* Tablero Nutricional: tarjeta de cristal flotante (glassmorphism) */}
                {board && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.05 }}
                    className="mb-2 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-lg px-3.5 py-3"
                  >
                    <CoachMarkdown text={board} tight />
                  </motion.div>
                )}
                {m.role === "coach" ? rest && <CoachMarkdown text={rest} /> : m.text}
                {m.text?.trim() && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                    <CopyButton text={m.text} index={i} copiedIdx={copiedIdx} onCopy={copyMessage} color={bubbleColor} />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        {typing && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ background: "#1b1e21", padding: "12px 16px", borderRadius: "16px 16px 16px 4px", display: "flex", gap: 5 }}>
              {[0, 0.2, 0.4].map((d) => (
                <div
                  key={d}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "rgba(244,243,238,.5)",
                    animation: `pulse 1s ease ${d}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chips rápidos */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "6px 20px 8px", flex: "none" }}>
        {QUICK_PROMPTS.map((p) => (
          <Pressable
            key={p.text}
            onClick={() => send(p.send)}
            style={{
              flex: "none",
              background: "rgba(199,242,122,.1)",
              border: "1px solid rgba(199,242,122,.3)",
              color: "#c7f27a",
              fontSize: 11,
              fontWeight: 700,
              padding: "7px 12px",
              borderRadius: 100,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {p.text}
          </Pressable>
        ))}
      </div>

      {/* Vista previa de foto pendiente */}
      {pendingPhoto && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "0 16px 6px",
            padding: 8,
            background: "#1b1e21",
            border: "1px solid rgba(199,242,122,.3)",
            borderRadius: 14,
            flex: "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pendingPhoto}
            alt="foto pendiente"
            style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flex: "none" }}
          />
          <div style={{ flex: 1, fontSize: 11.5, color: "rgba(244,243,238,.6)", fontWeight: 600, lineHeight: 1.4 }}>
            Foto lista 📸 — escribe contexto si quieres (ej. &quot;dejé la mitad&quot;) y presiona enviar
          </div>
          <div
            onClick={() => setPendingPhoto(null)}
            style={{
              width: 28,
              height: 28,
              flex: "none",
              borderRadius: "50%",
              background: "rgba(255,255,255,.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(244,243,238,.7)",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            ×
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px 10px", flex: "none" }}>
        <label
          style={{
            width: 46,
            height: 46,
            flex: "none",
            borderRadius: "50%",
            background: "#1b1e21",
            border: "1px solid rgba(255,255,255,.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 18,
              height: 14,
              border: "2px solid rgba(244,243,238,.7)",
              borderRadius: 4,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ position: "absolute", top: -4, left: 5, width: 7, height: 3, background: "rgba(244,243,238,.7)", borderRadius: 1 }} />
            <div style={{ width: 7, height: 7, border: "1.6px solid rgba(244,243,238,.7)", borderRadius: "50%" }} />
          </div>
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              onPickPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={listening ? "Escuchando…" : pendingPhoto ? "Agrega contexto a tu foto…" : "Pregúntale o sube una foto…"}
          style={{
            flex: 1,
            minWidth: 0,
            background: "#1b1e21",
            border: listening ? "1px solid rgba(199,242,122,.4)" : "1px solid rgba(255,255,255,.08)",
            borderRadius: 100,
            color: "#f4f3ee",
            fontSize: 13,
            fontWeight: 500,
            padding: "13px 18px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {/* Dictado por voz (Web Speech API, es-ES) — pulso infinito mientras escucha */}
        <motion.div
          onClick={toggleMic}
          whileTap={{ scale: 0.9 }}
          animate={
            listening
              ? {
                  scale: [1, 1.14, 1],
                  boxShadow: [
                    "0 0 8px rgba(199,242,122,.35)",
                    "0 0 22px rgba(199,242,122,.9)",
                    "0 0 8px rgba(199,242,122,.35)",
                  ],
                }
              : { scale: 1, boxShadow: "0 0 0px rgba(199,242,122,0)" }
          }
          transition={listening ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
          style={{
            width: 44,
            height: 44,
            flex: "none",
            borderRadius: "50%",
            background: listening ? "#c7f27a" : "#1b1e21",
            border: listening ? "none" : "1px solid rgba(255,255,255,.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <MicIcon color={listening ? "#10240a" : "rgba(244,243,238,.75)"} />
        </motion.div>
        <Pressable
          onClick={() => send(input)}
          tapScale={0.9}
          style={{
            width: 46,
            height: 46,
            flex: "none",
            borderRadius: "50%",
            background: "#c7f27a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 0 18px rgba(199,242,122,.5)",
          }}
        >
          <div style={{ width: 0, height: 0, borderTop: "7px solid transparent", borderBottom: "7px solid transparent", borderLeft: "12px solid #10240a", marginLeft: 3 }} />
        </Pressable>
      </div>
    </div>
  );
}
