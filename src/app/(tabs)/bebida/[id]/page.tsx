"use client";

// Editar / eliminar un registro de agua o bebida.

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Pressable from "@/components/Pressable";
import { useApp } from "@/lib/store";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  background: "#1b1e21",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 14,
  padding: "12px 14px",
  color: "#f4f3ee",
  fontSize: 13,
  boxSizing: "border-box",
  outline: "none",
};

export default function EditarBebida() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { drinks, updateDrink, deleteDrink, showToast, t } = useApp();

  const drink = drinks.find((d) => d.id === params.id);
  const [label, setLabel] = useState(drink?.label ?? "");
  const [ml, setMl] = useState(String(drink?.ml ?? 0));

  if (!drink) {
    return (
      <div style={{ padding: "80px 24px", textAlign: "center", color: "rgba(244,243,238,.5)", fontSize: 13 }}>
        {t("comida.notFound")}
        <Pressable onClick={() => router.push("/historial")} style={{ marginTop: 16, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "#c7f27a", fontWeight: 700, cursor: "pointer" }}>
          {t("comida.backToHistory")}
        </Pressable>
      </div>
    );
  }

  const save = async () => {
    await updateDrink({ ...drink, label: label.trim() || t("resumen.water"), ml: Number(ml) || 0 });
    showToast(t("bebida.toastUpdated"));
    router.push("/historial");
  };

  const remove = async () => {
    await deleteDrink(drink.id);
    showToast(t("bebida.toastDeleted"));
    router.push("/historial");
  };

  return (
    <div style={{ minHeight: "100dvh", boxSizing: "border-box", padding: "24px 20px", display: "flex", flexDirection: "column" }}>
      <div className="font-sora" style={{ fontSize: 18, fontWeight: 700 }}>{t("bebida.editTitle")}</div>
      <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>{t("bebida.subtitle")}</div>

      <div style={{ marginTop: 16, fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)" }}>{t("bebida.label")}</div>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("bebida.labelPlaceholder")} style={fieldStyle} />

      <div style={{ marginTop: 16, fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)" }}>{t("bebida.milliliters")}</div>
      <input
        type="number"
        inputMode="numeric"
        value={ml}
        onChange={(e) => setMl(e.target.value)}
        style={fieldStyle}
      />
      <div style={{ fontSize: 11, color: "rgba(244,243,238,.4)", marginTop: 6 }}>
        {t("bebida.negativeHint")}
      </div>

      <div style={{ flex: 1 }} />
      <Pressable
        onClick={save}
        style={{
          background: "#c7f27a",
          color: "#10240a",
          textAlign: "center",
          padding: 15,
          borderRadius: 22,
          fontWeight: 800,
          fontSize: 13.5,
          marginTop: 20,
          cursor: "pointer",
          boxShadow: "0 0 20px rgba(199,242,122,.5)",
        }}
      >
        {t("comida.saveChanges")}
      </Pressable>
      <Pressable
        onClick={remove}
        style={{
          textAlign: "center",
          padding: 14,
          borderRadius: 22,
          fontWeight: 700,
          fontSize: 13,
          marginTop: 10,
          cursor: "pointer",
          color: "oklch(72% 0.18 25)",
          border: "1px solid oklch(72% 0.18 25 / 0.4)",
        }}
      >
        {t("comida.deleteRecord")}
      </Pressable>
    </div>
  );
}
