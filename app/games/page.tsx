import { Suspense } from "react";
import { Library } from "@/components/library";
import { getBestScores } from "@/lib/scores";

export default function GamesPage() {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>
      {/* Mejores puntuaciones reales: lectura dinámica, dentro de <Suspense>. */}
      <Suspense fallback={<Library />}>
        <LibraryWithBests />
      </Suspense>
    </div>
  );
}

async function LibraryWithBests() {
  const bests = await getBestScores();
  return <Library bests={bests} />;
}
