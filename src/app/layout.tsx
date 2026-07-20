import type { Metadata, Viewport } from "next";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import SWRegister from "@/components/SWRegister";

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-sora",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "AHIVOYAPP · Escáner Nutricional",
  description: "AI Metabolic Scanner · contador de calorías con IA · By PanaApp",
  manifest: "/manifest.json",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-180.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AHIVOYAPP",
  },
};

export const viewport: Viewport = {
  themeColor: "#121416",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${sora.variable} ${jakarta.variable}`}>
      <body>
        {/* Barra fija sobre la zona del notch / Dynamic Island: el contenido
            pasa por debajo con desenfoque al hacer scroll (como la tab bar). */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            margin: "0 auto",
            maxWidth: 480,
            height: "env(safe-area-inset-top)",
            background: "rgba(18,20,22,.88)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 90,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            maxWidth: 480,
            margin: "0 auto",
            minHeight: "100dvh",
            position: "relative",
            background: "#121416",
          }}
        >
          {children}
        </div>
        <SWRegister />
      </body>
    </html>
  );
}
