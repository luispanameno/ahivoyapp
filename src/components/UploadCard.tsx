"use client";

import { useState, useRef } from "react";
import Pressable from "./Pressable";

interface UploadCardProps {
  title: string;
  subtitle: string;
  icon: string;
  lastUpdated?: { timestamp: string; label?: string };
  onImage: (url: string) => void;
  isUpdated?: boolean;
  busy?: boolean;
  onAction?: () => void;
}

export default function UploadCard({
  title,
  subtitle,
  icon,
  lastUpdated,
  onImage,
  isUpdated = false,
  busy = false,
  onAction,
}: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      onImage(url);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      style={{
        position: "relative",
        background: "#1b1e21",
        border: "1px solid rgba(199, 242, 122, 0.2)",
        borderRadius: 20,
        padding: "24px 20px",
        overflow: "hidden",
      }}
    >
      {/* Contenedor principal: icono + título + timestamp */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        {/* Icono grande a la izquierda */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: 16,
            border: "2px solid rgba(199, 242, 122, 0.3)",
            background: "rgba(199, 242, 122, 0.08)",
            fontSize: 28,
            flex: "none",
          }}
        >
          {icon}
        </div>

        {/* Contenido: título, subtítulo, timestamp */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#f4f3ee",
              marginBottom: 4,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(244, 243, 238, 0.6)",
              marginBottom: 8,
            }}
          >
            {subtitle}
          </div>

          {/* Última actualización */}
          {lastUpdated && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: isUpdated ? "#c7f27a" : "rgba(199, 242, 122, 0.4)",
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(244, 243, 238, 0.5)",
                }}
              >
                Última actualización:{" "}
                <span style={{ color: "#c7f27a", fontWeight: 700 }}>
                  {lastUpdated.timestamp}
                </span>
              </div>
              {isUpdated && lastUpdated.label && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#c7f27a",
                    marginLeft: 4,
                  }}
                >
                  {lastUpdated.label}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Botón flotante a la derecha */}
        <Pressable
          onClick={() => {
            if (isUpdated && onAction) {
              onAction();
            } else {
              inputRef.current?.click();
            }
          }}
          tapScale={0.9}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 14,
            background: isUpdated
              ? "rgba(199, 242, 122, 0.15)"
              : "rgba(199, 242, 122, 0.1)",
            border: "1.5px solid rgba(199, 242, 122, 0.3)",
            cursor: "pointer",
            flex: "none",
            fontSize: 20,
            color: "#c7f27a",
            transition: "all 0.2s ease",
            boxShadow: isUpdated
              ? "0 0 12px rgba(199, 242, 122, 0.3)"
              : "none",
          }}
        >
          {busy ? (
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "2px solid rgba(199, 242, 122, 0.2)",
                borderTopColor: "#c7f27a",
                animation: "spin 0.8s linear infinite",
              }}
            />
          ) : isUpdated ? (
            "✓"
          ) : (
            "⬆"
          )}
        </Pressable>
      </div>

      {/* Input file oculto */}
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

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
