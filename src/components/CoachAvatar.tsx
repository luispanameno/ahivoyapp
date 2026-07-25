"use client";

// Mascota del Coach: un robot amigable dibujado en SVG (nada de emoji, así
// escala limpio y hereda los colores del tema) que reacciona a los datos del
// día con tres estados — durmiendo, con un consejo, o feliz.
//
// La animación es el único elemento vivo de la pantalla a propósito: animar
// varias cosas a la vez cansa la vista. Con "reducir movimiento" activado se
// queda quieto y solo cambia de expresión.

import { motion, useReducedMotion } from "motion/react";
import { useApp } from "@/lib/store";

export type CoachMood = "sleeping" | "alert" | "happy";

const ACCENT = "#c7f27a";
const SLEEP = "oklch(72% 0.15 300)";

// Deriva el estado a partir de lo que el usuario lleva registrado hoy.
export function useCoachMood(): { mood: CoachMood; message: string } {
  const { profile, water, kcalEaten, proteinG, carbsG, fatG, kcalBudget } = useApp();

  const sinRegistros = kcalEaten === 0 && water === 0;
  if (sinRegistros) {
    return { mood: "sleeping", message: "Aquí estaré cuando registres algo." };
  }

  // Avisos, del más urgente al más leve.
  if (kcalEaten > kcalBudget) {
    return { mood: "alert", message: "Ya pasaste tus calorías de hoy." };
  }
  if (carbsG > profile.metaCarbs) {
    return { mood: "alert", message: "¡Cuidado con los carbohidratos!" };
  }
  if (fatG > profile.metaFat) {
    return { mood: "alert", message: "Ojo con las grasas de hoy." };
  }
  if (water < profile.metaWater * 0.5) {
    return { mood: "alert", message: "¿Ya tomaste agua?" };
  }

  const metasCumplidas =
    proteinG >= profile.metaProtein && water >= profile.metaWater && kcalEaten <= kcalBudget;
  if (metasCumplidas) {
    return { mood: "happy", message: "¡Metas del día completas!" };
  }

  const faltaProteina = Math.max(0, profile.metaProtein - proteinG);
  if (faltaProteina > 0) {
    return { mood: "alert", message: `Te faltan ${faltaProteina}g de proteína.` };
  }
  return { mood: "alert", message: "Vas bien, sigue así." };
}

const MOOD_LABEL: Record<CoachMood, string> = {
  sleeping: "Tu coach está descansando",
  alert: "Tu coach tiene un consejo",
  happy: "Tu coach está feliz",
};

function RobotFace({ mood, color }: { mood: CoachMood; color: string }) {
  return (
    <svg width="62" height="62" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* Antena */}
      <line x1="32" y1="6" x2="32" y2="13" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="4.5" r="3" fill={color} />

      {/* Cabeza */}
      <rect x="9" y="13" width="46" height="40" rx="14" stroke={color} strokeWidth="2.5" fill="rgba(255,255,255,.04)" />

      {/* Orejas */}
      <rect x="3.5" y="27" width="4.5" height="11" rx="2.2" fill={color} opacity="0.75" />
      <rect x="56" y="27" width="4.5" height="11" rx="2.2" fill={color} opacity="0.75" />

      {mood === "sleeping" ? (
        <>
          {/* Ojos cerrados */}
          <path d="M18 31c2.4 2.6 5.6 2.6 8 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M38 31c2.4 2.6 5.6 2.6 8 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          {/* Boca relajada */}
          <path d="M28 42h8" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : mood === "happy" ? (
        <>
          {/* Ojos contentos (arcos hacia arriba) */}
          <path d="M18 33c2.4-3.4 5.6-3.4 8 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M38 33c2.4-3.4 5.6-3.4 8 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          {/* Cachetes */}
          <circle cx="16.5" cy="40" r="3" fill={color} opacity="0.35" />
          <circle cx="47.5" cy="40" r="3" fill={color} opacity="0.35" />
          {/* Sonrisa */}
          <path d="M25 40c3.6 4.6 10.4 4.6 14 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* Ojos atentos */}
          <circle cx="22" cy="31.5" r="3.6" fill={color} />
          <circle cx="42" cy="31.5" r="3.6" fill={color} />
          {/* Boca neutra-amable */}
          <path d="M26 41.5c3 3 9 3 12 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export default function CoachAvatar({
  mood,
  message,
  onClick,
}: {
  mood: CoachMood;
  message: string;
  onClick?: () => void;
}) {
  const reduce = useReducedMotion();
  const color = mood === "sleeping" ? SLEEP : ACCENT;

  // Cada estado tiene su propio ritmo: dormido respira lento, feliz da
  // saltitos, y con un consejo se balancea apenas para llamar la atención.
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
      onClick={onClick}
      role="img"
      aria-label={`${MOOD_LABEL[mood]}: ${message}`}
      whileTap={reduce || !onClick ? undefined : { scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 24,
        // Glassmorphism sobre el fondo oscuro de la app
        background: "rgba(255,255,255,.045)",
        border: `1px solid ${mood === "sleeping" ? "rgba(190,150,255,.22)" : "rgba(199,242,122,.22)"}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        cursor: onClick ? "pointer" : "default",
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "relative", flex: "none" }}>
        <motion.div
          animate={loop}
          transition={loopTransition}
          style={{ filter: `drop-shadow(0 0 14px ${mood === "sleeping" ? "rgba(190,150,255,.4)" : "rgba(199,242,122,.4)"})` }}
        >
          <RobotFace mood={mood} color={color} />
        </motion.div>

        {/* Zzz flotantes mientras duerme */}
        {mood === "sleeping" && !reduce && (
          <div aria-hidden="true" style={{ position: "absolute", top: -6, right: -10 }}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ opacity: [0, 1, 0], y: [0, -12], scale: [0.7, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
                style={{
                  position: "absolute",
                  fontSize: 10 + i * 2,
                  fontWeight: 800,
                  color: SLEEP,
                  left: i * 7,
                }}
              >
                z
              </motion.span>
            ))}
          </div>
        )}
      </div>

      {/* Globo de texto */}
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
          }}
        >
          {message}
          {/* Colita del globo apuntando a la mascota */}
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
