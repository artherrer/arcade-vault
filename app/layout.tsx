import type { Metadata } from "next";
import { Courier_Prime, JetBrains_Mono, Press_Start_2P } from "next/font/google";
import { Suspense } from "react";
import { Nav } from "@/components/nav";
import { NavAccount, NavAccountPlaceholder } from "@/components/nav-account";
import "./globals.css";

const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arcade Vault · Portal Retro",
  description: "Juega y compite por la puntuación más alta.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${pressStart.variable} ${jetbrainsMono.variable} ${courierPrime.variable}`}
    >
      <body>
        <div className="av-bg" aria-hidden="true" />
        <div className="av-noise" aria-hidden="true" />
        <div className="av-root">
          <Nav
            desktopAccount={
              <Suspense fallback={<NavAccountPlaceholder variant="desktop" />}>
                <NavAccount variant="desktop" />
              </Suspense>
            }
            mobileAccount={
              <Suspense fallback={<NavAccountPlaceholder variant="mobile" />}>
                <NavAccount variant="mobile" />
              </Suspense>
            }
          />
          <main className="av-main">{children}</main>
          <footer className="border-t border-line px-8 py-5 text-center font-mono text-[11px] tracking-[0.16em] text-ink-faint">
            © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
          </footer>
        </div>
      </body>
    </html>
  );
}
