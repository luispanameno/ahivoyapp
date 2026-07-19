"use client";

// Redimensiona una imagen (data URL) a un cuadrado pequeño para guardarla
// como foto de perfil sin ocupar mucho espacio.

export function resizeToAvatar(dataUrl: string, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas no disponible"));
      // Recorte cuadrado centrado
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = dataUrl;
  });
}
