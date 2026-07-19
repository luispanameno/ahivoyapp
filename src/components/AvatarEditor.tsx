"use client";

// Editor de foto de perfil: arrastra para centrar y usa el slider para zoom.

import { useEffect, useRef, useState } from "react";
import { fileToDataURL } from "@/lib/analyze";

const VIEW = 280; // lado del recuadro de edición en px
const OUT = 256; // lado de la imagen final guardada

export default function AvatarEditor({
  src,
  onCancel,
  onSave,
}: {
  src: string;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const [imgSrc, setImgSrc] = useState(src);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setNatural({ w: img.width, h: img.height });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      imgRef.current = img;
    };
    img.src = imgSrc;
  }, [imgSrc]);

  const baseScale = natural ? VIEW / Math.min(natural.w, natural.h) : 1;
  const scale = baseScale * zoom;

  const clamp = (o: { x: number; y: number }, z = zoom) => {
    if (!natural) return o;
    const s = baseScale * z;
    const maxX = Math.max(0, (natural.w * s - VIEW) / 2);
    const maxY = Math.max(0, (natural.h * s - VIEW) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, o.x)),
      y: Math.min(maxY, Math.max(-maxY, o.y)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setOffset(clamp({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y }));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const save = () => {
    const img = imgRef.current;
    if (!img || !natural) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const k = OUT / VIEW;
    const drawW = natural.w * scale * k;
    const drawH = natural.h * scale * k;
    const dx = OUT / 2 + offset.x * k - drawW / 2;
    const dy = OUT / 2 + offset.y * k - drawH / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
    onSave(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(8,10,9,.92)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="font-sora" style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
        Ajusta tu foto
      </div>
      <div style={{ fontSize: 11.5, color: "rgba(244,243,238,.5)", marginBottom: 16 }}>
        Arrastra para centrar · desliza para acercar
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          width: VIEW,
          height: VIEW,
          borderRadius: "50%",
          overflow: "hidden",
          position: "relative",
          border: "3px solid #c7f27a",
          boxShadow: "0 0 30px rgba(199,242,122,.35)",
          touchAction: "none",
          cursor: "grab",
          flex: "none",
          background: "#1b1e21",
        }}
      >
        {natural && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt="Ajustar foto"
            draggable={false}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: natural.w * scale,
              height: natural.h * scale,
              maxWidth: "none",
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        )}
      </div>

      <input
        type="range"
        min={1}
        max={3}
        step={0.01}
        value={zoom}
        onChange={(e) => {
          const z = Number(e.target.value);
          setZoom(z);
          setOffset((o) => clamp(o, z));
        }}
        style={{ width: VIEW, marginTop: 20, accentColor: "#c7f27a" }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 20, width: VIEW }}>
        <div
          onClick={onCancel}
          style={{
            flex: 1,
            textAlign: "center",
            padding: 13,
            borderRadius: 14,
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            background: "#1b1e21",
            color: "rgba(244,243,238,.7)",
          }}
        >
          Cancelar
        </div>
        <div
          onClick={save}
          style={{
            flex: 1,
            textAlign: "center",
            padding: 13,
            borderRadius: 14,
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            background: "#c7f27a",
            color: "#10240a",
            boxShadow: "0 0 16px rgba(199,242,122,.45)",
          }}
        >
          Guardar
        </div>
      </div>

      <div
        onClick={() => pickRef.current?.click()}
        style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: "rgba(244,243,238,.55)", cursor: "pointer" }}
      >
        🖼️ Elegir otra foto
      </div>
      <input
        ref={pickRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) setImgSrc(await fileToDataURL(f));
        }}
      />
    </div>
  );
}
