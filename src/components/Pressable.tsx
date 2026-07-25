"use client";

// Botón táctil estándar de la app: micro-feedback uniforme con motion
// (whileTap 0.95 / whileHover 1.02) y respeto a "reducir movimiento".

import { motion, useReducedMotion } from "motion/react";

export default function Pressable({
  children,
  onClick,
  style,
  tapScale = 0.95,
  hoverScale = 1.02,
  ariaLabel,
  role = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  tapScale?: number;
  hoverScale?: number;
  // Obligatorio cuando el control es solo un ícono: sin esto un lector de
  // pantalla lo anuncia como "botón" a secas.
  ariaLabel?: string;
  role?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      whileTap={reduce ? undefined : { scale: tapScale }}
      whileHover={reduce ? undefined : { scale: hoverScale }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? role : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      style={style}
    >
      {children}
    </motion.div>
  );
}
