"use client";

// Ilustración de la tortuga para las pantallas estáticas (bienvenida,
// historial vacío, cuenta en revisión…). Son PNG recortados con fondo
// transparente desde los mockups, así que se apoyan sobre el fondo de la
// app sin recuadro visible.
//
// El movimiento es a propósito MILIMÉTRICO: sube y baja unos pocos píxeles
// como si respirara, sobre un halo que late a un ritmo distinto. Dos ritmos
// desfasados dan sensación de profundidad sin robarle atención al contenido
// ni a los botones. Con "reducir movimiento" activado se queda quieta.

import { motion, useReducedMotion } from "motion/react";

export type MascotArt =
  | "bienvenida"
  | "saludo-guapo"
  | "motivo"
  | "numeros"
  | "meta-peso"
  | "actividad"
  | "bascula"
  | "historial-vacia"
  | "en-revision";

// Texto alternativo real: la ilustración acompaña al contenido, así que
// describe lo que se ve en vez de dejar un alt vacío.
const ALT: Record<MascotArt, string> = {
  bienvenida: "Tortuga de AHIVOYAPP saludando",
  "saludo-guapo": "Tortuga con lentes de sol y chaqueta",
  motivo: "Tortuga descansando en una hamaca con un coco",
  numeros: "Tortuga midiendo su estatura",
  "meta-peso": "Tortuga marcando músculo",
  actividad: "Tortuga levantando mancuernas",
  bascula: "Tortuga parada sobre una báscula inteligente",
  "historial-vacia": "Tortuga con una libreta, lista para anotar",
  "en-revision": "Tortuga sentada sobre un reloj de arena, esperando",
};

export default function MascotIllustration({
  art,
  height = 150,
  glow = true,
  style,
}: {
  art: MascotArt;
  /** Alto en px. Se mantiene chico a propósito para no tapar el contenido. */
  height?: number;
  glow?: boolean;
  style?: React.CSSProperties;
}) {
  const reduce = useReducedMotion();

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        height,
        flex: "none",
        pointerEvents: "none",
        ...style,
      }}
    >
      {/* Halo: late más lento que la tortuga, así los dos planos no van
          sincronizados y se lee profundidad. */}
      {glow && (
        <motion.div
          aria-hidden="true"
          animate={reduce ? undefined : { opacity: [0.5, 0.85, 0.5], scale: [0.96, 1.04, 0.96] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            bottom: "6%",
            width: height * 1.15,
            height: height * 0.42,
            borderRadius: "50%",
            background: "radial-gradient(closest-side, rgba(199,242,122,.22), rgba(199,242,122,0))",
            filter: "blur(6px)",
          }}
        />
      )}

      <motion.img
        src={`/mascota/paginas/${art}.png`}
        alt={ALT[art]}
        animate={reduce ? undefined : { y: [0, -5, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "relative",
          height: "100%",
          width: "auto",
          maxWidth: "100%",
          objectFit: "contain",
          filter: "drop-shadow(0 10px 18px rgba(0,0,0,.45))",
        }}
      />
    </div>
  );
}
