"use client";

// Redimensiona una imagen (data URL) a una miniatura JPEG ligera.
// Se usa para guardar la foto de cada comida sin inflar la base de datos
// ni el localStorage: ~300px de lado, calidad 0.75 ≈ 20-40 KB.
export function resizeDataURL(
  dataUrl: string,
  maxSize = 320,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo procesar la imagen"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = dataUrl;
  });
}

// Comprime una foto ANTES de mandarla a la IA. La reduce a ~1600px de lado
// mayor con calidad alta: el texto de capturas (báscula/reloj) sigue siendo
// legible, pero el archivo baja de varios MB a unos cientos de KB. Así el
// usuario puede subir cualquier foto de su celular sin ver "imagen demasiado
// grande" ni tener que reducirla a mano. Si algo falla, devuelve la original.
export async function compressForAnalysis(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  try {
    return await resizeDataURL(dataUrl, 1600, 0.85);
  } catch {
    return dataUrl;
  }
}
