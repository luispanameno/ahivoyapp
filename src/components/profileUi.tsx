"use client";

// Piezas compartidas por las dos vistas del Perfil ("Mi progreso" y
// "Ajustes"): estilos, el encabezado con la foto, y el conmutador entre
// ambas. Viven aquí para que las dos pantallas se vean como una sola.

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import AvatarEditor from "./AvatarEditor";
import Icon from "./Icon";
import Pressable from "./Pressable";
import { fileToDataURL } from "@/lib/analyze";
import { useApp } from "@/lib/store";
import { ActivityLevel } from "@/lib/types";

export const spring = { type: "spring", stiffness: 400, damping: 25 } as const;

export function getActivityOptions(t: (key: string) => string): { value: ActivityLevel; label: string; desc: string }[] {
  return [
    { value: "sedentario", label: t("perfil.activitySedentary"), desc: t("perfil.activitySedentaryDesc") },
    { value: "ligero", label: t("perfil.activityLight"), desc: t("perfil.activityLightDesc") },
    { value: "activo", label: t("perfil.activityActive"), desc: t("perfil.activityActiveDesc") },
  ];
}

export interface ScaleResult {
  peso_lb: number;
  score?: number;
  complexion?: string;
  imc?: number;
  grasa_pct?: number;
  agua_pct?: number;
  proteina_pct?: number;
  bmr?: number;
  grasa_visceral?: number;
  musculo_lb?: number;
  masa_osea_lb?: number;
}

export const cardStyle: React.CSSProperties = { background: "#1b1e21", borderRadius: 18, padding: "12px 14px" };
export const labelStyle: React.CSSProperties = { fontSize: 10.5, color: "rgba(244,243,238,.4)", fontWeight: 700 };
export const numInput: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#f4f3ee",
  fontSize: 14,
  fontWeight: 700,
  marginTop: 2,
  padding: 0,
};
export const notesTextarea: React.CSSProperties = {
  width: "100%",
  background: "#1b1e21",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 18,
  padding: "12px 14px",
  color: "#f4f3ee",
  fontSize: 13,
  fontFamily: "inherit",
  boxSizing: "border-box",
  resize: "none",
  outline: "none",
};
export const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(244,243,238,.4)",
  letterSpacing: ".04em",
  marginTop: 20,
  marginBottom: 8,
};

// Redondeo a 1 decimal para mostrar (evita 55.000000000000014)
export function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

// "20/07 · 6:58 p. m." para la marca de última actualización de las tarjetas.
export function fmtStamp(d: Date): string {
  return (
    d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" }) +
    " · " +
    d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true })
  );
}

export function ProfileHeader() {
  const { profile, saveProfile, showToast, userEmail, t } = useApp();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);

  return (
    <>
      {editorSrc && (
        <AvatarEditor
          src={editorSrc}
          onCancel={() => setEditorSrc(null)}
          onSave={async (url) => {
            try {
              await saveProfile({ ...profile, photo: url });
            } catch {
              // El store ya revirtió la foto: dejamos el editor abierto para
              // que se pueda reintentar sin volver a recortar la imagen.
              showToast(t("store.saveFailed"));
              return;
            }
            setEditorSrc(null);
            showToast(t("perfil.photoUpdated"));
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Pressable
          onClick={() => {
            if (profile.photo) setEditorSrc(profile.photo);
            else photoInputRef.current?.click();
          }}
          ariaLabel={t("perfil.changePhoto")}
          style={{
            width: 64,
            height: 64,
            flex: "none",
            borderRadius: "50%",
            padding: 2,
            background: "linear-gradient(135deg,#a6f06a,#39c9a3)",
            cursor: "pointer",
            position: "relative",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              overflow: "hidden",
              background: "#1b1e21",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {profile.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photo} alt={t("perfil.yourPhoto")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Icon name="user" size={26} />
            )}
          </div>
          <div
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#c7f27a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 10px rgba(199,242,122,.5)",
            }}
          >
            <Icon name="camera" size={13} />
          </div>
        </Pressable>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              setEditorSrc(await fileToDataURL(file));
            } catch {
              showToast(t("perfil.photoLoadError"));
            }
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={profile.name}
            placeholder={t("perfil.namePlaceholder")}
            // Se guarda en cada tecla: si la base rechaza el guardado el
            // store revierte el nombre, así que hay que avisar en vez de
            // dejar la promesa rechazada en silencio.
            onChange={(e) => {
              saveProfile({ ...profile, name: e.target.value }).catch(() => showToast(t("store.saveFailed")));
            }}
            className="font-sora"
            style={{
              background: "transparent",
              border: "none",
              borderBottom: "1px dashed rgba(244,243,238,.3)",
              outline: "none",
              fontSize: 19,
              fontWeight: 700,
              color: "#f4f3ee",
              padding: "0 0 4px",
              width: "100%",
            }}
          />
          <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.4)", marginTop: 4, wordBreak: "break-all" }}>
            {userEmail ?? t("perfil.editHint")}
          </div>
        </div>
      </div>
    </>
  );
}

export function ProfileFooter() {
  return (
    <>
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <div
          className="font-sora"
          style={{
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: ".04em",
            background: "linear-gradient(180deg,#b7f06a,#39c9a3)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          AHIVOYAPP
        </div>
        <div style={{ fontSize: 10, color: "rgba(244,243,238,.35)", marginTop: 2, letterSpacing: ".02em" }}>
          AI Metabolic Scanner · v1.0 · By PanaApp
        </div>
      </div>
      <div style={{ height: 40 }} />
    </>
  );
}

// Ícono de tuerca (ajustes) — SVG propio, sin depender del set de glifos
// extraído (ese set no incluye uno de configuración).
function GearIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// Conmutador entre las tres vistas. La píldora activa se desliza con un
// resorte compartido (layoutId), así se lee de dónde a dónde se movió.
export function ProfileTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { t } = useApp();
  const tabs = [
    { label: t("perfil.tabProgress"), route: "/perfil" },
    { label: t("perfil.tabSync"), route: "/perfil/sincronizacion" },
    { label: t("perfil.tabSettings"), route: "/perfil/ajustes", gear: true },
  ];

  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        gap: 4,
        background: "#1b1e21",
        borderRadius: 100,
        padding: 4,
        marginTop: 18,
      }}
    >
      {tabs.map((tab) => {
        const active = pathname === tab.route;
        return (
          <motion.div
            key={tab.route}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            onClick={() => router.push(tab.route)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(tab.route);
              }
            }}
            whileTap={reduce ? undefined : { scale: 0.95 }}
            transition={spring}
            style={{
              position: "relative",
              flex: 1,
              minHeight: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 100,
              cursor: "pointer",
              boxSizing: "border-box",
            }}
          >
            {active && (
              <motion.div
                layoutId="perfil-tab-activa"
                transition={reduce ? { duration: 0 } : spring}
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "#c7f27a",
                  borderRadius: 100,
                  boxShadow: "0 0 14px rgba(199,242,122,.45)",
                }}
              />
            )}
            {tab.gear ? (
              <span
                aria-label={tab.label}
                style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <GearIcon color={active ? "#10240a" : "rgba(244,243,238,.6)"} />
              </span>
            ) : (
              <span
                style={{
                  position: "relative",
                  fontSize: 11,
                  fontWeight: 800,
                  color: active ? "#10240a" : "rgba(244,243,238,.6)",
                  whiteSpace: "nowrap",
                  padding: "0 2px",
                }}
              >
                {tab.label}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
