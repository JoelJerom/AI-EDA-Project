import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "../components/Toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--sans" });

export const metadata: Metadata = {
  title: "Circuit Engine — Smarter circuits, reviewed by rules",
  description: "Score, simplify and verify any circuit against a 13-block engineering rulebook.",
  icons: { icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%23060b14'/%3E%3Ctext x='16' y='23' font-size='20' font-family='Arial' font-weight='700' text-anchor='middle' fill='%23e8f1fb'%3EC%3C/text%3E%3C/svg%3E" },
};
export const viewport: Viewport = { themeColor: "#060b14", width: "device-width", initialScale: 1, viewportFit: "cover" };

const intro = `(function(){try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){var r=document.documentElement;r.classList.add('intro');setTimeout(function(){r.classList.remove('intro')},5000)}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: intro }} /></head>
      <body className={inter.variable}><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
