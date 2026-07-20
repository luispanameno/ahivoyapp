"use client";

// Zona unificada de carga de capturas: borde punteado, ícono sutil centrado,
// texto dinámico y micro-animaciones (motion) al tocar/pasar el cursor.
// También exporta ActionButton y StatusBadge para que los botones de acción
// y los badges de estado queden idénticos en todas las secciones.

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { fileToDataURL } from "@/lib/analyze";

const spring = { type: "spring", stiffness: 400, damping: 25 } as const;

export default function ImageUploadZone({
  placeholder,
  icon = "📷",
  height = 120,
  radius = 14,
  onImage,
}: {
  placeholder: string;
  icon?: string;
  height?: number;
  radius?: number;
  onImage: (dataUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    const url = await fileToDataURL(file);
    setPreview(url);
    onImage(url);
  };

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      whileHover={{ scale: 1.02 }}
      transition={spring}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        handleFile(e.dataTransfer.files?.[0]);
      }}
      style={{
        width: "100%",
        height,
        borderRadius: radius,
        border: preview ? "none" : "1.5px dashed rgba(255,255,255,.25)",
        background: preview ? `center/cover no-repeat url(${preview})` : "#1b1e21",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: "pointer",
        boxSizing: "border-box",
        overflow: "hidden",
        padding: preview ? 0 : "0 20px",
      }}
    >
      {!preview && (
        <>
          <div style={{ fontSize: 22, opacity: 0.5, lineHeight: 1 }}>{icon}</div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(244,243,238,.45)",
              fontWeight: 600,
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            {placeholder}
          </div>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </motion.div>
  );
}

// Botón de acción estándar bajo una zona de carga (misma altura/margen en todas)
export function ActionButton({
  label,
  onClick,
  busy = false,
}: {
  label: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      whileHover={{ scale: 1.02 }}
      transition={spring}
      onClick={onClick}
      style={{
        background: "#c7f27a",
        color: "#10240a",
        textAlign: "center",
        padding: 13,
        borderRadius: 14,
        fontWeight: 800,
        fontSize: 12.5,
        marginTop: 10,
        cursor: "pointer",
        opacity: busy ? 0.6 : 1,
        boxShadow: "0 0 16px rgba(199,242,122,.45)",
      }}
    >
      {label}
    </motion.div>
  );
}

// Badge de estado estándar (ej. "Actualizado · 9,188 pasos…")
export function StatusBadge({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 10,
        background: "rgba(199,242,122,.1)",
        border: "1px solid rgba(199,242,122,.3)",
        borderRadius: 14,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 44,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#c7f27a",
          boxShadow: "0 0 8px #c7f27a",
          flex: "none",
        }}
      />
      <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "#c7f27a" }}>{text}</div>
    </div>
  );
}
