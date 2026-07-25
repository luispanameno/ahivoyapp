"use client";

// Skeleton de carga: en vez de un texto tipo "Cargando…" que rompe la
// inmersión, mostramos el esqueleto de la pantalla con un brillo que recorre
// las piezas. Ocupa el mismo espacio que el contenido real, así no hay salto
// de layout cuando llegan los datos.
//
// El brillo se apaga solo con "reducir movimiento" (ver globals.css).

export function SkeletonBox({
  height,
  width = "100%",
  radius = 16,
  style,
}: {
  height: number | string;
  width?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton-shimmer"
      style={{ height, width, borderRadius: radius, flex: "none", ...style }}
    />
  );
}

// Esqueleto de la pantalla principal: encabezado, mascota, macros y tarjetas.
export default function HomeSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      aria-label="Cargando tus datos"
      style={{
        minHeight: "100dvh",
        boxSizing: "border-box",
        padding: "calc(24px + env(safe-area-inset-top)) 20px 24px",
      }}
    >
      {/* Encabezado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <SkeletonBox height={11} width="45%" radius={100} />
          <SkeletonBox height={16} width="72%" radius={100} style={{ marginTop: 9 }} />
          <SkeletonBox height={10} width="58%" radius={100} style={{ marginTop: 9 }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <SkeletonBox height={40} width={40} radius={999} />
          <SkeletonBox height={44} width={44} radius={999} />
        </div>
      </div>

      {/* Mascota */}
      <SkeletonBox height={90} radius={24} style={{ marginTop: 14 }} />

      {/* Macros */}
      <SkeletonBox height={150} radius={24} style={{ marginTop: 14 }} />

      {/* Agua */}
      <SkeletonBox height={96} radius={24} style={{ marginTop: 12 }} />

      {/* Accesos rutina / sueño */}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <SkeletonBox height={46} radius={18} style={{ flex: 1 }} />
        <SkeletonBox height={46} radius={18} style={{ flex: 1 }} />
      </div>

      {/* Tarjeta de actividad */}
      <SkeletonBox height={132} radius={24} style={{ marginTop: 12 }} />
    </div>
  );
}
