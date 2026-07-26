"use client";

// Hoja inferior reutilizable: fondo con fade, panel que entra con resorte
// desde abajo y se puede arrastrar hacia abajo para cerrar (drag-to-dismiss).
// Usada por el hub "Sincronización y registro" en Ajustes para ofrecer
// "subir captura" o "ingresar a mano" sin cambiar de pantalla.

import { AnimatePresence, motion, useReducedMotion, PanInfo } from "motion/react";

export default function BottomSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 90 || info.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 34 }}
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={onDragEnd}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              margin: "0 auto",
              maxHeight: "88dvh",
              overflowY: "auto",
              background: "#16181a",
              border: "1px solid rgba(255,255,255,.08)",
              borderBottom: "none",
              borderRadius: "28px 28px 0 0",
              padding: "10px 20px calc(24px + env(safe-area-inset-bottom))",
              boxSizing: "border-box",
              boxShadow: "0 -12px 40px rgba(0,0,0,.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 14px", touchAction: "none" }}>
              <div style={{ width: 36, height: 4, borderRadius: 100, background: "rgba(255,255,255,.2)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: subtitle ? 4 : 14 }}>
              <div className="font-sora" style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>
              <motion.div
                whileTap={reduce ? undefined : { scale: 0.9 }}
                onClick={onClose}
                role="button"
                aria-label="Cerrar"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClose();
                  }
                }}
                style={{
                  width: 34,
                  height: 34,
                  flex: "none",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "rgba(244,243,238,.7)",
                }}
              >
                ✕
              </motion.div>
            </div>
            {subtitle && (
              <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginBottom: 16, lineHeight: 1.4 }}>{subtitle}</div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
