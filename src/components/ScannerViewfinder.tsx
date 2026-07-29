"use client";

// Visor del escáner: el HUD estilo "mira de cámara" dibujado en SVG en vez
// de una imagen PNG. Vectorial pesa nada, se ve nítido en cualquier
// pantalla (incluida la retina del iPhone), hereda el verde del tema y deja
// superponer el láser encima sin pelearse con los píxeles de un mapa de bits.
//
// El láser es una franja con degradado (no una línea dura de 1px): así se
// lee como un haz de luz y no como un borde. Con "reducir movimiento"
// activado se queda quieto — un barrido infinito es justo lo que marea a
// quien activa esa preferencia.

import { useReducedMotion } from "motion/react";
import { useApp } from "@/lib/store";

const NEON = "#c7f27a";

export default function ScannerViewfinder({ label }: { label?: string }) {
  const reduce = useReducedMotion();
  const { t } = useApp();
  const shownLabel = label ?? t("scanner.defaultLabel");

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minHeight: 150,
        borderRadius: 28,
        overflow: "hidden",
        border: "1px solid rgba(199,242,122,.14)",
        background: "radial-gradient(120% 90% at 50% 50%, rgba(199,242,122,.07) 0%, rgba(8,9,10,0) 70%), #08090a",
      }}
    >
      {/* HUD: rejilla, esquinas y retícula central */}
      <svg
        viewBox="0 0 300 300"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {/* Cruz de encuadre punteada */}
        <line x1="150" y1="8" x2="150" y2="292" stroke={NEON} strokeWidth="0.6" strokeDasharray="3 5" opacity="0.35" />
        <line x1="8" y1="150" x2="292" y2="150" stroke={NEON} strokeWidth="0.6" strokeDasharray="3 5" opacity="0.35" />
        {/* Guías de tercios, muy tenues */}
        <line x1="100" y1="20" x2="100" y2="280" stroke={NEON} strokeWidth="0.4" strokeDasharray="1 6" opacity="0.18" />
        <line x1="200" y1="20" x2="200" y2="280" stroke={NEON} strokeWidth="0.4" strokeDasharray="1 6" opacity="0.18" />

        {/* Retícula central */}
        <circle cx="150" cy="150" r="52" fill="none" stroke={NEON} strokeWidth="1.4" opacity="0.9" />
        <circle cx="150" cy="150" r="66" fill="none" stroke={NEON} strokeWidth="0.7" strokeDasharray="2 4" opacity="0.5" />
        <circle cx="150" cy="150" r="78" fill="none" stroke={NEON} strokeWidth="0.5" strokeDasharray="26 40" opacity="0.35" />

        {/* Esquinas del marco: dobles, como en una mira real */}
        {[
          { x: 0, y: 0, sx: 1, sy: 1 },
          { x: 300, y: 0, sx: -1, sy: 1 },
          { x: 0, y: 300, sx: 1, sy: -1 },
          { x: 300, y: 300, sx: -1, sy: -1 },
        ].map((c, i) => (
          <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy})`}>
            <path d="M6 40 L6 16 Q6 6 16 6 L40 6" fill="none" stroke={NEON} strokeWidth="3" strokeLinecap="round" />
            <path d="M24 52 L24 34 Q24 24 34 24 L52 24" fill="none" stroke={NEON} strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
          </g>
        ))}
      </svg>

      {/* Punto de mira: el "+" dentro de un corchete, como en el diseño */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: `drop-shadow(0 0 12px ${NEON})`,
        }}
      >
        <svg width="52" height="52" viewBox="0 0 40 40" fill="none">
          <path d="M4 13V7a3 3 0 0 1 3-3h6M36 13V7a3 3 0 0 0-3-3h-6M4 27v6a3 3 0 0 0 3 3h6M36 27v6a3 3 0 0 1-3 3h-6"
            stroke={NEON} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M20 13v14M13 20h14" stroke={NEON} strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </div>

      {/* Láser: barre el visor de lado a lado, en bucle.
          Va con keyframes CSS y no con motion porque motion no interpola
          "left" en porcentajes — se quedaba clavado en el valor inicial. */}
      {!reduce && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "12%",
              background: `linear-gradient(90deg, rgba(199,242,122,0) 0%, rgba(199,242,122,.16) 45%, rgba(199,242,122,.5) 50%, rgba(199,242,122,.16) 55%, rgba(199,242,122,0) 100%)`,
              boxShadow: `0 0 26px 4px rgba(199,242,122,.35)`,
              pointerEvents: "none",
              animation: "scanSweep 4.2s ease-in-out infinite",
            }}
          />
          <style>{`
            @keyframes scanSweep {
              0%   { left: -14%; }
              50%  { left: 100%; }
              100% { left: -14%; }
            }
          `}</style>
        </>
      )}

      {/* Etiqueta flotante */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 100,
            background: "rgba(8,9,10,.72)",
            border: "1px solid rgba(199,242,122,.28)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            fontSize: 12,
            fontWeight: 700,
            color: "#f4f3ee",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3"
              stroke={NEON} strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="3" stroke={NEON} strokeWidth="2" />
          </svg>
          {shownLabel}
        </div>
      </div>
    </div>
  );
}
