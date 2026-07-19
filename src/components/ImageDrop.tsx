"use client";

// Recuadro para subir/arrastrar una captura (reemplaza los image-slot del prototipo).

import { useRef, useState } from "react";
import { fileToDataURL } from "@/lib/analyze";

export default function ImageDrop({
  placeholder,
  height = 120,
  radius = 14,
  onImage,
}: {
  placeholder: string;
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
    <div
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
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {!preview && (
        <div style={{ fontSize: 12, color: "rgba(244,243,238,.45)", fontWeight: 600, textAlign: "center", padding: "0 20px" }}>
          {placeholder}
        </div>
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
    </div>
  );
}
