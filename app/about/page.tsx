import { ContactForm } from "@/components/contact-form";
import { HighlightIcon, type HighlightIconKind } from "@/components/home-art";
import { RevealObserver } from "@/components/reveal-observer";
import type { AccentColor } from "@/lib/games";

type Highlight = { i: HighlightIconKind; t: string; c: AccentColor };
type Tip = { t: string; led: "" | "y" | "m" };

const HIGHLIGHTS: Highlight[] = [
  { i: "HEART", t: "HECHO CON ❤️ PARA JUGADORES", c: "magenta" },
  { i: "BROWSER", t: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR", c: "cyan" },
  { i: "PLANT", t: "PROYECTO EN CONSTANTE CRECIMIENTO", c: "green" },
];

const TIPS: Tip[] = [
  { t: "RESPUESTA EN 24-48H", led: "" },
  { t: "SUGERENCIAS BIENVENIDAS", led: "y" },
  { t: "SIN SPAM, JAMÁS", led: "m" },
];

export default function AboutPage() {
  return (
    <div className="about fade-in">
      <RevealObserver />

      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ACERCA DE</div>
        <h1 className="about-title">ACERCA DE ARCADE VAULT</h1>
        <p className="about-mission">
          ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y celebrar
          los arcades que definieron una generación, haciéndolos accesibles para todos, en cualquier lugar
          y sin costo.
        </p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((h, i) => (
            <div key={h.i} className={"highlight " + h.c} style={{ transitionDelay: i * 80 + "ms" }}>
              <HighlightIcon kind={h.i} />
              <div className="hl-text pixel">{h.t}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="about-divider reveal" aria-hidden="true">
        <div className="div-bar"></div>
        <div className="div-pixels">
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} style={{ animationDelay: i * 80 + "ms" }}></span>
          ))}
        </div>
        <div className="div-bar"></div>
      </div>

      <section className="about-contact reveal">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACTO</div>
            <h2 className="contact-title">CONTÁCTANOS</h2>
            <p className="contact-sub">
              ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar?
              Escríbenos.
            </p>
            <div className="contact-tips">
              {TIPS.map((tip) => (
                <div key={tip.t} className="tip">
                  <span className={"tip-led" + (tip.led ? " " + tip.led : "")}></span>
                  {tip.t}
                </div>
              ))}
            </div>
          </div>

          <ContactForm />
        </div>
      </section>
    </div>
  );
}
