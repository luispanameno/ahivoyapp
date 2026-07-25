"use client";

// Sección colapsable: por defecto solo se ve el botón, y al tocarlo el
// contenido se despliega con un resorte. Sirve para esconder listas
// secundarias (ej. accesos rechazados) sin sacarlas de la pantalla.

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

function Chevron({ open }: { open: boolean }) {
  return (
    <motion.svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      style={{ flex: "none" }}
    >
      <path d="M6 9l6 6 6-6" />
    </motion.svg>
  );
}

export default function Accordion({
  label,
  count,
  children,
  defaultOpen = false,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();
  const panelId = useId();

  return (
    <div>
      {/* Un solo elemento interactivo: anidar dos role="button" rompe el
          orden de lectura y hace ambiguo dónde cae el toque. */}
      <motion.div
        onClick={() => setOpen((o) => !o)}
        whileTap={reduce ? undefined : { scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={panelId}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          // 44px de alto mínimo: objetivo táctil accesible
          minHeight: 44,
          boxSizing: "border-box",
          background: "#1b1e21",
          border: "1px solid rgba(255,255,255,.07)",
          borderRadius: 18,
          padding: "12px 16px",
          cursor: "pointer",
          color: "rgba(244,243,238,.72)",
          fontSize: 12.5,
          fontWeight: 700,
        }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
        {count != null && count > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "rgba(244,243,238,.5)",
              background: "rgba(255,255,255,.07)",
              borderRadius: 100,
              padding: "2px 9px",
            }}
          >
            {count}
          </span>
        )}
        <Chevron open={open} />
      </motion.div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            initial={reduce ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
            transition={{
              height: { type: "spring", stiffness: 320, damping: 32 },
              opacity: { duration: 0.18, ease: "easeOut" },
            }}
            // overflow hidden para que el contenido se "recorte" al plegarse
            style={{ overflow: "hidden" }}
          >
            <div style={{ paddingTop: 8 }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
