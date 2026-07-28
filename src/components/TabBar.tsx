"use client";

import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import Icon from "./Icon";
import { useApp } from "@/lib/store";

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

const TABS_LEFT: { route: string; icon: string; labelKey: string }[] = [
  { route: "/hoy", icon: "date", labelKey: "tabbar.hoy" },
  { route: "/historial", icon: "history-trends", labelKey: "tabbar.historial" },
];
const TABS_RIGHT: { route: string; icon: string; labelKey: string }[] = [
  { route: "/coach", icon: "users", labelKey: "tabbar.coach" },
  { route: "/perfil", icon: "user", labelKey: "tabbar.perfil" },
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
      // Hundido corto y con rebote, como iOS: baja rápido al tocar y vuelve
      // con un resorte firme. 0.88 se sentía flojo y "de web".
      whileTap={reduce ? undefined : { scale: 0.92 }}
      transition={{ type: "spring", stiffness: 600, damping: 20, mass: 0.5 }}
      role="link"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        cursor: "pointer",
        // Área táctil generosa (mínimo 48px recomendado en Android/iOS)
        minWidth: 60,
        minHeight: 52,
        padding: "6px 8px",
        borderRadius: 18,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Pastilla que envuelve la pestaña activa: se desliza de una a otra
          con un resorte compartido, en vez de aparecer y desaparecer. */}
      {active && (
        <motion.div
          layoutId="tab-activa"
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 18,
            background: "rgba(199,242,122,.12)",
            border: "1px solid rgba(199,242,122,.22)",
          }}
        />
      )}
      <Icon
        name={icon}
        size={26}
        style={{
          position: "relative",
          filter: active ? "none" : "grayscale(1) brightness(.85) opacity(.55)",
          transition: "filter .22s ease",
        }}
      />
      <div
        style={{
          position: "relative",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".01em",
          color: active ? "#c7f27a" : "rgba(244,243,238,.42)",
          textShadow: active ? "0 0 8px rgba(199,242,122,.6)" : "none",
          transition: "color .22s ease",
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
  const { t } = useApp();

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
      {TABS_LEFT.map((tab) => (
        <Tab key={tab.route} route={tab.route} icon={tab.icon} label={t(tab.labelKey)} />
      ))}

      <motion.div
        onClick={() => router.push("/escanear")}
        whileTap={reduce ? undefined : { scale: 0.93 }}
        whileHover={reduce ? undefined : { scale: 1.05 }}
        transition={{ type: "spring", stiffness: 600, damping: 20, mass: 0.5 }}
        role="link"
        aria-label="Escanear comida"
        style={{
          width: 60,
          height: 60,
          borderRadius: 22,
          // Degradado con un brillo arriba: da volumen, como un botón físico
          // iluminado desde arriba, en vez de un plano de color liso.
          background: "linear-gradient(160deg,#e2fbaa 0%,#c7f27a 45%,#a3e055 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: -26,
          boxShadow: "0 8px 26px rgba(199,242,122,.5), 0 2px 6px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.6)",
          border: "1px solid rgba(255,255,255,.3)",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
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

      {TABS_RIGHT.map((tab) => (
        <Tab key={tab.route} route={tab.route} icon={tab.icon} label={t(tab.labelKey)} />
      ))}
    </div>
  );
}
