"use client";

// Modal informativo elegante con micro-animaciones (motion):
// fondo con fade y tarjeta con spring; botón X para cerrar.

import { AnimatePresence, motion } from "motion/react";

export default function InfoModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 28,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 380,
              background: "#1b1e21",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 20,
              padding: 20,
              boxShadow: "0 12px 40px rgba(0,0,0,.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div className="font-sora" style={{ fontSize: 16, fontWeight: 800, color: "#c7f27a" }}>{title}</div>
              <motion.div
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "rgba(244,243,238,.7)",
                }}
              >
                ✕
              </motion.div>
            </div>
            <div style={{ fontSize: 13, color: "rgba(244,243,238,.75)", lineHeight: 1.6 }}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
