"use client";

import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import Icon from "./Icon";

// Barra de navegación clásica anclada al borde inferior (a pedido del
// usuario: sin isla flotante), pero con los íconos del set propio:
// inactivo = escala de grises apagada; activo = color + glow del label.
//
// El botón central SOLO navega a /escanear: ahí mismo (sin cambiar de
// página de nuevo) viven los botones "Tomar foto" / "Elegir de galería".
// Antes la foto se recogía aquí y viajaba por contexto hasta /escanear;
// ese traspaso entre páginas resultó frágil (Android e iPhone podían
// perderlo y la app volvía a pedir la foto). Todo en una sola pantalla
// elimina ese riesgo por completo.

const TABS_LEFT: { route: string; icon: string; label: string }[] = [
  { route: "/hoy", icon: "date", label: "Hoy" },
  { route: "/historial", icon: "history-trends", label: "Historial" },
];
const TABS_RIGHT: { route: string; icon: string; label: string }[] = [
  { route: "/coach", icon: "users", label: "Coach" },
  { route: "/perfil", icon: "user", label: "Perfil" },
];

function Tab({ route, icon, label }: { route: string; icon: string; label: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  // startsWith y no ===: /perfil/ajustes también es "Perfil".
  const active = pathname === route || pathname.startsWith(route + "/");
  return (
    <motion.div
      onClick={() => router.push(route)}
      whileTap={reduce ? undefined : { scale: 0.88 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      role="link"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        cursor: "pointer",
        minWidth: 48,
        padding: "6px 4px",
      }}
    >
      <Icon
        name={icon}
        size={26}
        style={{
          filter: active ? "none" : "grayscale(1) brightness(.8) opacity(.5)",
          transition: "filter .2s ease",
        }}
      />
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: active ? "#c7f27a" : "rgba(244,243,238,.35)",
          textShadow: active ? "0 0 8px rgba(199,242,122,.6)" : "none",
          transition: "color .2s ease",
        }}
      >
        {label}
      </div>
    </motion.div>
  );
}

export default function TabBar() {
  const router = useRouter();
  const reduce = useReducedMotion();

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        margin: "0 auto",
        maxWidth: 480,
        height: 88,
        background: "rgba(18,20,22,.92)",
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
        borderTop: "1px solid rgba(255,255,255,.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        paddingBottom: "max(10px, env(safe-area-inset-bottom))",
        boxSizing: "border-box",
        zIndex: 50,
      }}
    >
      {TABS_LEFT.map((t) => (
        <Tab key={t.route} {...t} />
      ))}

      <motion.div
        onClick={() => router.push("/escanear")}
        whileTap={reduce ? undefined : { scale: 0.9 }}
        whileHover={reduce ? undefined : { scale: 1.04 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        role="link"
        aria-label="Escanear comida"
        style={{
          width: 54,
          height: 54,
          borderRadius: 20,
          background: "linear-gradient(135deg,#d3f78f,#a8e35f)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: -24,
          boxShadow: "0 6px 22px rgba(199,242,122,.55)",
          border: "1px solid rgba(255,255,255,.25)",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 20,
            height: 15,
            border: "2.5px solid #10240a",
            borderRadius: 5,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ position: "absolute", top: -4, left: 5, width: 7, height: 3, background: "#10240a", borderRadius: 1.5 }} />
          <div style={{ width: 8, height: 8, border: "1.8px solid #10240a", borderRadius: "50%" }} />
        </div>
      </motion.div>

      {TABS_RIGHT.map((t) => (
        <Tab key={t.route} {...t} />
      ))}
    </div>
  );
}
