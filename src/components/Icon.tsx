// Ícono del set /public/icons/glyphs (recortado de la hoja de íconos del
// diseño): un pequeño chip cuadrado con fondo oscuro + glifo con glow.
export default function Icon({
  name,
  size = 20,
  style,
}: {
  name: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/glyphs/${name}.png`}
      alt=""
      width={size}
      height={size}
      style={{ display: "block", flex: "none", borderRadius: Math.round(size * 0.22), ...style }}
    />
  );
}
