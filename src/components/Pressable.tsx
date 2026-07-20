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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  tapScale?: number;
  hoverScale?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      whileTap={reduce ? undefined : { scale: tapScale }}
      whileHover={reduce ? undefined : { scale: hoverScale }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={onClick}
      style={style}
    >
      {children}
    </motion.div>
  );
}
