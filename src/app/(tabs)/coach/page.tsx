"use client";

// Coach IA: chat con contexto real del día; foto para analizar; acciones por texto.

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { motion, AnimatePresence } from "motion/react";
import Pressable from "@/components/Pressable";
import { fileToDataURL } from "@/lib/analyze";
import { useApp } from "@/lib/store";

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

// Rojo de alerta cuando el usuario se pasó de la meta (mismo tono que en "Hoy").
const OVER_COLOR = "oklch(65% 0.19 25)";
const OVER_GLOW = "oklch(65% 0.19 25 / .55)";

// Tarjeta de la tira de contexto: si el usuario se pasó de la meta, en vez
// de clavarse en 0 muestra cuánto se pasó ("+Xg") en rojo, con su propia etiqueta.
function statInfo(
  actual: number,
  meta: number,
  unit: string,
  normalLabel: string,
  overLabel: string,
  color: string,
  glow: string
) {
  const over = meta > 0 && actual > meta;
  return over
    ? { value: `+${actual - meta}${unit}`, label: overLabel, color: OVER_COLOR, glow: OVER_GLOW }
    : { value: `${Math.max(0, meta - actual)}${unit}`, label: normalLabel, color, glow };
}

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
    proteinG,
    carbsG,
    fatG,
    kcalEaten,
    kcalBudget,
    chatMessages,
    chatTyping,
    sendChat,
    clearChat,
    showToast,
  } = app;

  // El chat (mensajes, "escribiendo…", envío a la IA, aplicar acciones) vive
  // en el store: así una respuesta que sigue en camino NO se pierde si
  // navegas a otra pestaña y vuelves — antes se perdía porque esta página
  // se desmontaba junto con la petición en curso.
  const [input, setInput] = useState("");
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

  const kcalCard = statInfo(kcalEaten, kcalBudget, "", "KCAL LIBRES", "KCAL DE MÁS", "#c7f27a", "rgba(199,242,122,.5)");
  const carbsCard = statInfo(carbsG, profile.metaCarbs, "g", "CARBS FALTAN", "CARBS DE MÁS", "oklch(78% 0.15 85)", "oklch(78% 0.15 85 / .5)");
  const protCard = statInfo(proteinG, profile.metaProtein, "g", "PROTEÍNA FALTA", "PROTEÍNA DE MÁS", "oklch(80% 0.14 25)", "oklch(80% 0.14 25 / .5)");
  const fatCard = statInfo(fatG, profile.metaFat, "g", "GRASAS FALTAN", "GRASAS DE MÁS", "oklch(72% 0.15 40)", "oklch(72% 0.15 40 / .5)");
  const waterCard = statInfo(water, profile.metaWater, "ml", "AGUA FALTA", "AGUA DE MÁS", "oklch(80% 0.13 230)", "oklch(80% 0.13 230 / .5)");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, chatTyping]);

  // Envoltorio delgado de UI: limpia el borrador local (input, foto, mic) y
  // delega el envío real a la IA al store, que sigue vivo aunque cambies de página.
  const send = async (text: string, image?: string) => {
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
    }
    const clean = text.trim();
    const photo = image ?? pendingPhoto ?? undefined;
    if (!clean && !photo) return;
    setInput("");
    setPendingPhoto(null);
    await sendChat(clean, photo);
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
          onClick={clearChat}
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
        <ContextCard value={kcalCard.value} label={kcalCard.label} color={kcalCard.color} glow={kcalCard.glow} />
        <ContextCard value={carbsCard.value} label={carbsCard.label} color={carbsCard.color} glow={carbsCard.glow} />
        <ContextCard value={protCard.value} label={protCard.label} color={protCard.color} glow={protCard.glow} />
        <ContextCard value={fatCard.value} label={fatCard.label} color={fatCard.color} glow={fatCard.glow} />
        <ContextCard value={waterCard.value} label={waterCard.label} color={waterCard.color} glow={waterCard.glow} />
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 20px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
        {chatMessages.map((m, i) => {
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
        {chatTyping && (
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
