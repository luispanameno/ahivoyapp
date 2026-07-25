"use client";

// Mascota del Coach: un robot amigable dibujado en SVG (nada de emoji, así
// escala limpio y hereda los colores del tema) que reacciona a los datos del
// día con tres estados — durmiendo, con un consejo, o feliz.
//
// Cada estado tiene VARIAS frases, no una sola: se rotan solas cada ~9s y
// también al tocar la mascota, así no se vuelve repetitiva. Cuando hay un
// número de por medio (agua, proteína, calorías) la frase trae el dato real
// y un tip concreto para cerrar la brecha.
//
// La animación es el único elemento vivo de la pantalla a propósito: animar
// varias cosas a la vez cansa la vista. Con "reducir movimiento" activado se
// queda quieto y solo cambia de expresión.

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useApp } from "@/lib/store";

export type CoachMood = "sleeping" | "alert" | "happy";

const ACCENT = "#c7f27a";
const SLEEP = "oklch(72% 0.15 300)";

const DORMIDO = [
  "Zzz… despiértame con un vaso de agua.",
  "Sigo aquí, esperando tu primer registro.",
  "Modo siesta activado. Tú dirás.",
  "Todavía no he visto nada hoy. ¿Desayunaste?",
  "Me quedé dormido esperándote.",
  "Soñando con pupusas… digo, con ensalada.",
  "Despiértame cuando comas algo.",
  "Aquí acostado, sin nada que anotar.",
];

const FELIZ = [
  "¡Metas del día completas! Te luciste.",
  "Día redondo. Así se hace.",
  "Todo en verde. Duerme tranquilo.",
  "Cumpliste todo. Yo aquí aplaudiendo.",
  "Perfecto. Mañana repetimos, ¿va?",
  "Nada que corregir hoy. Raro y hermoso.",
  "Tu yo de enero estaría orgulloso.",
];

const ANIMO = [
  "Vas bien, no aflojes.",
  "Un día a la vez. Aquí ando.",
  "Nada de rendirse a media tarde.",
  "Lento pero sin parar, así se gana.",
];

function pick(list: string[], i: number): string {
  return list[i % list.length];
}

// Deriva el estado y TODAS las frases que aplican ahora mismo.
export function useCoachMood(): { mood: CoachMood; messages: string[] } {
  const { profile, water, kcalEaten, proteinG, carbsG, fatG, kcalBudget, kcalRemaining } = useApp();

  if (kcalEaten === 0 && water === 0) {
    return { mood: "sleeping", messages: DORMIDO };
  }

  const msgs: string[] = [];

  // Lo más urgente primero: pasarse de la meta.
  if (kcalEaten > kcalBudget) {
    const sobra = kcalEaten - kcalBudget;
    msgs.push(
      `Te pasaste ${sobra} kcal. Una caminata de 30 min quema ~150.`,
      "Ya cruzaste tu meta. Cena ligerito y listo.",
      "Nada de dramas: mañana es otro día."
    );
  }
  if (carbsG > profile.metaCarbs) {
    msgs.push(
      `Carbos ${carbsG}/${profile.metaCarbs}g. Ojo con el arroz y el pan.`,
      "Carbos al tope. Que la cena sea proteína y verduras.",
      "El pan dulce no era necesario, ¿verdad?"
    );
  }
  if (fatG > profile.metaFat) {
    msgs.push(
      `Grasas ${fatG}/${profile.metaFat}g. Mejor a la plancha que frito.`,
      "Grasas al tope. Baja el aceite en la próxima.",
      "La fritura es rica, pero pesa. Literal."
    );
  }

  // Agua: siempre con el dato y cuántos vasos faltan.
  if (water < profile.metaWater) {
    const faltan = profile.metaWater - water;
    const vasos = Math.max(1, Math.round(faltan / 250));
    msgs.push(
      `Agua ${water}/${profile.metaWater}ml. Te faltan ~${vasos} vaso${vasos === 1 ? "" : "s"}.`,
      "¿Ya tomaste agua? El vaso no se llena solo.",
      "El agua no engorda y quita el hambre falsa.",
      "Tomá agua ahorita, no cuando ya tengas sed."
    );
  }

  // Proteína: el tip más útil, con equivalencias reales.
  const faltaProt = Math.max(0, profile.metaProtein - proteinG);
  if (faltaProt > 0) {
    msgs.push(
      `Te faltan ${faltaProt}g de proteína. Un huevo ~6g, pollo ~30g.`,
      `Proteína ${proteinG}/${profile.metaProtein}g. Un puño de pollo lo arregla.`,
      "La proteína es la que te deja lleno. No la dejes de último."
    );
  }

  if (kcalRemaining > 0) {
    msgs.push(`Te quedan ${kcalRemaining} kcal libres hoy.`);
  }

  // Todo cumplido → feliz.
  const todoOk =
    proteinG >= profile.metaProtein && water >= profile.metaWater && kcalEaten <= kcalBudget;
  if (todoOk) return { mood: "happy", messages: FELIZ };

  return { mood: "alert", messages: msgs.length ? msgs : ANIMO };
}

const MOOD_LABEL: Record<CoachMood, string> = {
  sleeping: "Tu coach está descansando",
  alert: "Tu coach tiene un consejo",
  happy: "Tu coach está feliz",
};

function RobotFace({ mood, color }: { mood: CoachMood; color: string }) {
  return (
    <svg width="62" height="62" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <line x1="32" y1="6" x2="32" y2="13" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="4.5" r="3" fill={color} />
      <rect x="9" y="13" width="46" height="40" rx="14" stroke={color} strokeWidth="2.5" fill="rgba(255,255,255,.04)" />
      <rect x="3.5" y="27" width="4.5" height="11" rx="2.2" fill={color} opacity="0.75" />
      <rect x="56" y="27" width="4.5" height="11" rx="2.2" fill={color} opacity="0.75" />

      {mood === "sleeping" ? (
        <>
          <path d="M18 31c2.4 2.6 5.6 2.6 8 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M38 31c2.4 2.6 5.6 2.6 8 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M28 42h8" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : mood === "happy" ? (
        <>
          <path d="M18 33c2.4-3.4 5.6-3.4 8 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M38 33c2.4-3.4 5.6-3.4 8 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="16.5" cy="40" r="3" fill={color} opacity="0.35" />
          <circle cx="47.5" cy="40" r="3" fill={color} opacity="0.35" />
          <path d="M25 40c3.6 4.6 10.4 4.6 14 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="22" cy="31.5" r="3.6" fill={color} />
          <circle cx="42" cy="31.5" r="3.6" fill={color} />
          <path d="M26 41.5c3 3 9 3 12 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export default function CoachAvatar({ mood, messages }: { mood: CoachMood; messages: string[] }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const color = mood === "sleeping" ? SLEEP : ACCENT;
  const message = pick(messages, i);

  // Rota sola para que la mascota se sienta viva aunque no la toquen.
  useEffect(() => {
    if (messages.length < 2) return;
    const t = setInterval(() => setI((n) => n + 1), 9000);
    return () => clearInterval(t);
  }, [messages.length]);

  const loop =
    reduce || mood === "alert"
      ? {}
      : mood === "sleeping"
      ? { scale: [1, 1.035, 1] }
      : { y: [0, -7, 0] };
  const loopTransition =
    mood === "sleeping"
      ? { duration: 3.6, repeat: Infinity, ease: "easeInOut" as const }
      : { duration: 1.5, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <motion.div
      onClick={() => setI((n) => n + 1)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setI((n) => n + 1);
        }
      }}
      aria-label={`${MOOD_LABEL[mood]}: ${message}. Toca para otro consejo.`}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 24,
        background: "rgba(255,255,255,.045)",
        border: `1px solid ${mood === "sleeping" ? "rgba(190,150,255,.22)" : "rgba(199,242,122,.22)"}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        cursor: "pointer",
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "relative", flex: "none" }}>
        <motion.div
          // key: al cambiar de frase da un respingo, como si reaccionara.
          key={i}
          animate={loop}
          transition={loopTransition}
          style={{ filter: `drop-shadow(0 0 14px ${mood === "sleeping" ? "rgba(190,150,255,.4)" : "rgba(199,242,122,.4)"})` }}
        >
          <RobotFace mood={mood} color={color} />
        </motion.div>

        {mood === "sleeping" && !reduce && (
          <div aria-hidden="true" style={{ position: "absolute", top: -6, right: -10 }}>
            {[0, 1, 2].map((z) => (
              <motion.span
                key={z}
                animate={{ opacity: [0, 1, 0], y: [0, -12], scale: [0.7, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: z * 0.8, ease: "easeOut" }}
                style={{
                  position: "absolute",
                  fontSize: 10 + z * 2,
                  fontWeight: 800,
                  color: SLEEP,
                  left: z * 7,
                }}
              >
                z
              </motion.span>
            ))}
          </div>
        )}
      </div>

      <motion.div
        key={message}
        initial={reduce ? false : { opacity: 0, scale: 0.92, x: -6 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 24 }}
        style={{ position: "relative", flex: 1, minWidth: 0 }}
      >
        <div
          style={{
            position: "relative",
            background: "#232527",
            borderRadius: 16,
            padding: "10px 13px",
            fontSize: 12.5,
            fontWeight: 700,
            lineHeight: 1.35,
            color: "#f4f3ee",
            overflowWrap: "anywhere",
          }}
        >
          {message}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: -5,
              top: "50%",
              transform: "translateY(-50%) rotate(45deg)",
              width: 10,
              height: 10,
              background: "#232527",
              borderRadius: 2,
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
