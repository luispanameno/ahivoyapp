"use client";

// Hub "Sincronización y registro": 4 tarjetas (reloj, sueño, báscula, rutina)
// que abren una hoja inferior con dos caminos — subir una captura (la IA la
// lee) o escribir los datos a mano con el teclado. Vive en Perfil →
// Sincronización.
//
// "Registro de rutina" es su propia tarjeta aunque la del reloj a veces ya
// traiga pasos + rutina junta: hay apps que solo muestran el resumen del
// entrenamiento (nombre + kcal), sin pasos ni el resto del día, y esa foto
// necesita su propio lugar para que igual se lea.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import BottomSheet from "./BottomSheet";
import Icon from "./Icon";
import Pressable from "./Pressable";
import ImageUploadZone, { ActionButton } from "./ImageUploadZone";
import { analyze } from "@/lib/analyze";
import { useApp } from "@/lib/store";
import { RoutineDay } from "@/lib/types";
import { sectionTitle } from "./profileUi";

type SheetKind = "activity" | "sleep" | "scale" | "routine" | null;
type Path = "upload" | "manual";
const ROUTINE_DAYS: RoutineDay[] = ["Push", "Pull", "Legs"];

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "#1b1e21",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 14,
  padding: "13px 14px",
  color: "#f4f3ee",
  fontSize: 14,
  fontWeight: 700,
  boxSizing: "border-box",
  outline: "none",
};

const label: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: "rgba(244,243,238,.45)",
  letterSpacing: ".03em",
  marginBottom: 4,
};

// Las dos "pestañas" Subir captura / Ingresar a mano, con píldora deslizante.
function PathToggle({ path, onChange }: { path: Path; onChange: (p: Path) => void }) {
  const reduce = useReducedMotion();
  const opts: { value: Path; label: string }[] = [
    { value: "upload", label: "Subir captura" },
    { value: "manual", label: "Ingresar a mano" },
  ];
  return (
    <div style={{ display: "flex", gap: 4, background: "#1b1e21", borderRadius: 100, padding: 4, marginBottom: 16 }}>
      {opts.map((o) => {
        const active = path === o.value;
        return (
          <motion.div
            key={o.value}
            onClick={() => onChange(o.value)}
            whileTap={reduce ? undefined : { scale: 0.96 }}
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
                layoutId="sync-path-activa"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 25 }}
                style={{ position: "absolute", inset: 0, background: "#c7f27a", borderRadius: 100 }}
              />
            )}
            <span style={{ position: "relative", fontSize: 12, fontWeight: 800, color: active ? "#10240a" : "rgba(244,243,238,.6)" }}>
              {o.label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

function SyncCard({ icon, title, subtitle, lastLabel, onClick }: { icon: string; title: string; subtitle: string; lastLabel: string; onClick: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "#1b1e21",
        border: "1px solid rgba(255,255,255,.06)",
        borderRadius: 18,
        padding: "13px 14px",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          flex: "none",
          borderRadius: 14,
          background: "rgba(199,242,122,.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 11, color: "rgba(244,243,238,.5)", marginTop: 1 }}>{subtitle}</div>
      </div>
      <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.35)", flex: "none", textAlign: "right" }}>{lastLabel}</div>
    </motion.div>
  );
}

export default function SyncHub() {
  const router = useRouter();
  const app = useApp();
  const { activity, sleep, bodyComp, workout, setActivity, setSleep, setBodyComp, setWorkout, showToast } = app;
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [path, setPath] = useState<Path>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Actividad del reloj ----
  const [pasos, setPasos] = useState("");
  const [minActivos, setMinActivos] = useState("");
  const [kcalActivas, setKcalActivas] = useState("");
  const [kcalTotales, setKcalTotales] = useState("");
  const [distancia, setDistancia] = useState("");

  // ---- Sueño ----
  const [meAcoste, setMeAcoste] = useState("23:00");
  const [desperte, setDesperte] = useState("07:00");
  const sleepManualMin = (() => {
    const [fh, fm] = meAcoste.split(":").map(Number);
    const [th, tm] = desperte.split(":").map(Number);
    if ([fh, fm, th, tm].some((n) => Number.isNaN(n))) return 0;
    const start = fh * 60 + fm;
    let end = th * 60 + tm;
    if (end <= start) end += 24 * 60;
    return end - start;
  })();

  // ---- Báscula ----
  const [pesoLb, setPesoLb] = useState("");
  const [imc, setImc] = useState("");
  const [grasaPct, setGrasaPct] = useState("");
  const [aguaPct, setAguaPct] = useState("");
  const [proteinaPct, setProteinaPct] = useState("");
  const [bmr, setBmr] = useState("");

  // ---- Rutina ----
  const [routineDay, setRoutineDay] = useState<RoutineDay>(workout?.day ?? "Push");
  const [routineNombre, setRoutineNombre] = useState("");
  const [routineKcal, setRoutineKcal] = useState("");

  const closeSheet = () => {
    setSheet(null);
    setError(null);
    setPath("upload");
  };

  const openSheet = (kind: SheetKind) => {
    setSheet(kind);
    setPath("upload");
    setError(null);
  };

  const uploadImage = async (mode: "activity" | "sleep" | "scale" | "workout", dataUrl: string) => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "workout") {
        const res = await analyze<{ nombre: string; kcal: number }>({ mode: "workout", image: dataUrl });
        await setWorkout({
          day: routineDay,
          done: true,
          kcal: Math.round(res.kcal) || 300,
          name: res.nombre || "Entrenamiento",
          notes: workout?.notes ?? "",
        });
        showToast(`Rutina leída · ${Math.round(res.kcal)} kcal quemadas`);
      } else if (mode === "activity") {
        const res = await analyze<{ pasos: number; min_activos: number; kcal_activas: number; kcal_totales: number; distancia_km: number }>({
          mode: "activity",
          image: dataUrl,
        });
        await setActivity({
          steps: Math.round(res.pasos) || 0,
          activeMin: Math.round(res.min_activos) || 0,
          activityKcal: Math.round(res.kcal_activas) || 0,
          totalKcal: Math.round(res.kcal_totales) || 0,
          distance: Math.round((res.distancia_km || 0) * 100) / 100,
          synced: true,
        });
        showToast("Actividad actualizada desde tu captura");
      } else if (mode === "sleep") {
        const res = await analyze<{ minutos: number; profundo_pct?: number; ligero_pct?: number; rem_pct?: number; despierto_pct?: number }>({
          mode: "sleep",
          image: dataUrl,
        });
        const total = Math.round(res.minutos) || 0;
        await setSleep({
          minutes: total,
          phases:
            res.profundo_pct != null
              ? { deep: Math.round(res.profundo_pct), light: Math.round(res.ligero_pct ?? 0), rem: Math.round(res.rem_pct ?? 0), awake: Math.round(res.despierto_pct ?? 0) }
              : null,
        });
        showToast(`Sueño actualizado: ${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`);
      } else {
        const res = await analyze<{
          peso_lb: number; score?: number; complexion?: string; imc?: number; grasa_pct?: number; agua_pct?: number;
          proteina_pct?: number; bmr?: number; grasa_visceral?: number; musculo_lb?: number; masa_osea_lb?: number;
        }>({ mode: "scale", image: dataUrl });
        await setBodyComp(
          {
            score: Math.round(res.score ?? 0),
            build: res.complexion ?? "—",
            bmi: res.imc ?? 0,
            fatPct: res.grasa_pct ?? 0,
            waterPct: res.agua_pct ?? 0,
            proteinPct: res.proteina_pct ?? 0,
            bmr: Math.round(res.bmr ?? 0),
            visceralFat: res.grasa_visceral ?? 0,
            muscle: res.musculo_lb ?? 0,
            boneMass: res.masa_osea_lb ?? 0,
            date: new Date().toISOString().slice(0, 10),
          },
          res.peso_lb > 0 ? res.peso_lb : undefined
        );
        showToast("Perfil actualizado desde tu báscula");
      }
      closeSheet();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la captura");
    } finally {
      setBusy(false);
    }
  };

  const saveActivityManual = async () => {
    await setActivity({
      steps: Number(pasos) || 0,
      activeMin: Number(minActivos) || 0,
      activityKcal: Number(kcalActivas) || 0,
      totalKcal: Number(kcalTotales) || Number(kcalActivas) + 1600,
      distance: Number(distancia) || 0,
      synced: true,
    });
    showToast("Actividad guardada");
    closeSheet();
  };

  const saveSleepManual = async () => {
    if (sleepManualMin <= 0) {
      setError("Esas horas no cuadran — revisa a qué hora te acostaste y despertaste.");
      return;
    }
    await setSleep({ minutes: sleepManualMin, phases: null });
    showToast(`Sueño guardado: ${Math.floor(sleepManualMin / 60)}h ${String(sleepManualMin % 60).padStart(2, "0")}m`);
    closeSheet();
  };

  const saveScaleManual = async () => {
    const lb = Number(pesoLb);
    if (!lb || lb <= 0) {
      setError("Escribe tu peso.");
      return;
    }
    await setBodyComp(
      {
        score: bodyComp?.score ?? 0,
        build: bodyComp?.build ?? "—",
        bmi: Number(imc) || 0,
        fatPct: Number(grasaPct) || 0,
        waterPct: Number(aguaPct) || 0,
        proteinPct: Number(proteinaPct) || 0,
        bmr: Number(bmr) || 0,
        visceralFat: bodyComp?.visceralFat ?? 0,
        muscle: bodyComp?.muscle ?? 0,
        boneMass: bodyComp?.boneMass ?? 0,
        date: new Date().toISOString().slice(0, 10),
      },
      lb
    );
    showToast("Peso y báscula guardados");
    closeSheet();
  };

  const saveRoutineManual = async () => {
    if (!routineNombre.trim()) {
      setError("Escribe el nombre del entrenamiento.");
      return;
    }
    await setWorkout({
      day: routineDay,
      done: true,
      kcal: Number(routineKcal) || 300,
      name: routineNombre.trim(),
      notes: workout?.notes ?? "",
    });
    showToast("Rutina guardada");
    closeSheet();
  };

  return (
    <>
      <div style={sectionTitle}>SINCRONIZACIÓN Y REGISTRO</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SyncCard
          icon="watch-activity"
          title="Actividad del reloj"
          subtitle="Pasos · kcal activas · kcal totales"
          lastLabel={activity?.synced ? `${activity.steps.toLocaleString()} pasos` : "Sin datos"}
          onClick={() => openSheet("activity")}
        />
        <SyncCard
          icon="sleep"
          title="Registro de sueño"
          subtitle="Duración y fases"
          lastLabel={sleep ? `${Math.floor(sleep.minutes / 60)}h ${String(sleep.minutes % 60).padStart(2, "0")}m` : "Sin datos"}
          onClick={() => openSheet("sleep")}
        />
        <SyncCard
          icon="smart-scale"
          title="Báscula inteligente"
          subtitle="Peso · grasa · composición"
          lastLabel={bodyComp ? `${bodyComp.date.slice(8, 10)}/${bodyComp.date.slice(5, 7)}` : "Sin datos"}
          onClick={() => openSheet("scale")}
        />
        <SyncCard
          icon="routine-plan"
          title="Registro de rutina"
          subtitle="Entrenamiento de hoy · kcal quemadas"
          lastLabel={workout?.done ? `${workout.day} · ${workout.kcal} kcal` : "Sin datos"}
          onClick={() => openSheet("routine")}
        />
      </div>

      <BottomSheet
        open={sheet === "activity"}
        onClose={closeSheet}
        title="Actividad del reloj"
        subtitle="Sube la captura de tu app de salud o escribe los números tú mismo."
      >
        <PathToggle path={path} onChange={setPath} />
        {path === "upload" ? (
          <>
            <ImageUploadZone placeholder="Toca para subir la captura de tu reloj" icon="/icons/glyphs/watch-activity.png" height={120} radius={16} onImage={(url) => uploadImage("activity", url)} />
            {busy && <div style={{ marginTop: 10, fontSize: 12, color: "#c7f27a", fontWeight: 700, textAlign: "center" }}>Leyendo captura…</div>}
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={label}>PASOS</div>
                <input type="number" inputMode="numeric" value={pasos} onChange={(e) => setPasos(e.target.value)} placeholder="8000" style={fieldStyle} />
              </div>
              <div>
                <div style={label}>MIN. ACTIVOS</div>
                <input type="number" inputMode="numeric" value={minActivos} onChange={(e) => setMinActivos(e.target.value)} placeholder="35" style={fieldStyle} />
              </div>
              <div>
                <div style={label}>KCAL ACTIVAS</div>
                <input type="number" inputMode="numeric" value={kcalActivas} onChange={(e) => setKcalActivas(e.target.value)} placeholder="300" style={fieldStyle} />
              </div>
              <div>
                <div style={label}>KCAL TOTALES</div>
                <input type="number" inputMode="numeric" value={kcalTotales} onChange={(e) => setKcalTotales(e.target.value)} placeholder="2000" style={fieldStyle} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={label}>DISTANCIA (KM)</div>
                <input type="number" inputMode="decimal" value={distancia} onChange={(e) => setDistancia(e.target.value)} placeholder="5.2" style={fieldStyle} />
              </div>
            </div>
            <ActionButton label="Guardar actividad" onClick={saveActivityManual} busy={false} />
          </>
        )}
        {error && <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)" }}>{error}</div>}
      </BottomSheet>

      <BottomSheet
        open={sheet === "sleep"}
        onClose={closeSheet}
        title="Registro de sueño"
        subtitle="Sube la captura de tu reloj o anota a qué hora te acostaste y despertaste."
      >
        <PathToggle path={path} onChange={setPath} />
        {path === "upload" ? (
          <>
            <ImageUploadZone placeholder="Toca para subir la captura de sueño de tu reloj" icon="/icons/glyphs/sleep.png" height={120} radius={16} onImage={(url) => uploadImage("sleep", url)} />
            {busy && <div style={{ marginTop: 10, fontSize: 12, color: "#c7f27a", fontWeight: 700, textAlign: "center" }}>Leyendo captura…</div>}
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={label}>ME ACOSTÉ</div>
                <input type="time" value={meAcoste} onChange={(e) => setMeAcoste(e.target.value)} style={{ ...fieldStyle, colorScheme: "dark" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={label}>DESPERTÉ</div>
                <input type="time" value={desperte} onChange={(e) => setDesperte(e.target.value)} style={{ ...fieldStyle, colorScheme: "dark" }} />
              </div>
            </div>
            <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#c7f27a", marginTop: 12 }}>
              {sleepManualMin > 0 ? `Total: ${Math.floor(sleepManualMin / 60)}h ${String(sleepManualMin % 60).padStart(2, "0")}m` : "Revisa las horas"}
            </div>
            <ActionButton label="Guardar horas de sueño" onClick={saveSleepManual} busy={false} />
          </>
        )}
        {error && <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)" }}>{error}</div>}
      </BottomSheet>

      <BottomSheet
        open={sheet === "scale"}
        onClose={closeSheet}
        title="Báscula inteligente"
        subtitle="Sube la captura de tu báscula o escribe tu peso y composición a mano."
      >
        <PathToggle path={path} onChange={setPath} />
        {path === "upload" ? (
          <>
            <ImageUploadZone placeholder="Toca para subir la captura de tu báscula" icon="/icons/glyphs/smart-scale.png" height={120} radius={16} onImage={(url) => uploadImage("scale", url)} />
            {busy && <div style={{ marginTop: 10, fontSize: 12, color: "#c7f27a", fontWeight: 700, textAlign: "center" }}>Leyendo captura…</div>}
          </>
        ) : (
          <>
            <div style={label}>PESO (LB)</div>
            <input type="number" inputMode="decimal" value={pesoLb} onChange={(e) => setPesoLb(e.target.value)} placeholder="180" style={{ ...fieldStyle, fontSize: 18, marginBottom: 12 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={label}>IMC</div>
                <input type="number" inputMode="decimal" value={imc} onChange={(e) => setImc(e.target.value)} placeholder="24.5" style={fieldStyle} />
              </div>
              <div>
                <div style={label}>METAB. BASAL</div>
                <input type="number" inputMode="numeric" value={bmr} onChange={(e) => setBmr(e.target.value)} placeholder="1800" style={fieldStyle} />
              </div>
              <div>
                <div style={label}>GRASA %</div>
                <input type="number" inputMode="decimal" value={grasaPct} onChange={(e) => setGrasaPct(e.target.value)} placeholder="22" style={fieldStyle} />
              </div>
              <div>
                <div style={label}>AGUA %</div>
                <input type="number" inputMode="decimal" value={aguaPct} onChange={(e) => setAguaPct(e.target.value)} placeholder="55" style={fieldStyle} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={label}>PROTEÍNA %</div>
                <input type="number" inputMode="decimal" value={proteinaPct} onChange={(e) => setProteinaPct(e.target.value)} placeholder="18" style={fieldStyle} />
              </div>
            </div>
            <ActionButton label="Guardar báscula" onClick={saveScaleManual} busy={false} />
          </>
        )}
        {error && <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)" }}>{error}</div>}
      </BottomSheet>

      <BottomSheet
        open={sheet === "routine"}
        onClose={closeSheet}
        title="Registro de rutina"
        subtitle="Sube la captura del resumen de tu entrenamiento o escribe qué hiciste."
      >
        <div style={{ ...label, marginBottom: 8 }}>DÍA</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {ROUTINE_DAYS.map((d) => (
            <div
              key={d}
              onClick={() => setRoutineDay(d)}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "9px 0",
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                background: routineDay === d ? "#c7f27a" : "#1b1e21",
                color: routineDay === d ? "#10240a" : "rgba(244,243,238,.6)",
              }}
            >
              {d}
            </div>
          ))}
        </div>
        <PathToggle path={path} onChange={setPath} />
        {path === "upload" ? (
          <>
            <ImageUploadZone placeholder="Toca para subir el resumen de tu entrenamiento" icon="/icons/glyphs/routine-plan.png" height={120} radius={16} onImage={(url) => uploadImage("workout", url)} />
            {busy && <div style={{ marginTop: 10, fontSize: 12, color: "#c7f27a", fontWeight: 700, textAlign: "center" }}>Leyendo captura…</div>}
          </>
        ) : (
          <>
            <div style={label}>NOMBRE DEL ENTRENAMIENTO</div>
            <input
              value={routineNombre}
              onChange={(e) => setRoutineNombre(e.target.value)}
              placeholder="Ej. Push del gimnasio"
              style={{ ...fieldStyle, marginBottom: 12 }}
            />
            <div style={label}>KCAL QUEMADAS</div>
            <input type="number" inputMode="numeric" value={routineKcal} onChange={(e) => setRoutineKcal(e.target.value)} placeholder="300" style={fieldStyle} />
            <ActionButton label="Guardar rutina" onClick={saveRoutineManual} busy={false} />
          </>
        )}
        {error && <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 600, color: "oklch(78% 0.15 50)" }}>{error}</div>}

        <Pressable
          onClick={() => router.push("/rutina")}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#1b1e21",
            borderRadius: 18,
            padding: "12px 14px",
            marginTop: 16,
            minHeight: 44,
            boxSizing: "border-box",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>Ejercicios de pesas (Push / Pull / Legs)</span>
          <span style={{ fontSize: 11, color: "rgba(244,243,238,.4)" }}>Editar ›</span>
        </Pressable>
      </BottomSheet>
    </>
  );
}
