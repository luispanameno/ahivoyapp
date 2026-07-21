"use client";

import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      return;
    }
    // En desarrollo, un service worker viejo (por ejemplo de un build de
    // producción probado antes en este mismo localhost) sigue sirviendo JS
    // cacheado y rompe la navegación entre pestañas. Lo quitamos, borramos
    // las cachés y, si de verdad estaba controlando la página, recargamos
    // UNA vez para arrancar limpio.
    (async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      const controlled = !!navigator.serviceWorker.controller;
      if (!regs.length && !controlled) return;
      await Promise.all(regs.map((r) => r.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if (controlled) window.location.reload();
    })();
  }, []);
  return null;
}
