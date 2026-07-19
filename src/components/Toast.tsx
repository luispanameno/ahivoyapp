"use client";

import { useApp } from "@/lib/store";

export default function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: 20,
        right: 20,
        margin: "0 auto",
        maxWidth: 440,
        background: "#c7f27a",
        color: "#10240a",
        fontWeight: 700,
        fontSize: 12.5,
        textAlign: "center",
        padding: 10,
        borderRadius: 100,
        boxShadow: "0 0 20px rgba(199,242,122,.6)",
        zIndex: 100,
      }}
    >
      {toast}
    </div>
  );
}
