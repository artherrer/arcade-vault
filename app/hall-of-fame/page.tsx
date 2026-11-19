import Link from "next/link";
import { Suspense } from "react";
import { GAMES, getGame, seededScores } from "@/lib/games";

const TOP_CLASS = [" top1", " top2", " top3"];
const formatScore = (n: number) => n.toLocaleString("es-ES");

export default function HallOfFamePage({ searchParams }: PageProps<"/hall-of-fame">) {
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel text-[10px]">LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA</p>
      </div>

      {/* Leer searchParams es dinámico: con Cache Components debe ir dentro de <Suspense>. */}
      <Suspense fallback={<div className="pixel py-20 text-center text-[11px] text-ink-faint">CARGANDO…</div>}>
        <HallBoard searchParams={searchParams} />
      </Suspense>

      <div className="mt-8 text-center">
        <Link href="/games" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}

async function HallBoard({ searchParams }: { searchParams: PageProps<"/hall-of-fame">["searchParams"] }) {
  const { game: param } = await searchParams;
  const requested = Array.isArray(param) ? param[0] : param;
  const game = (requested && getGame(requested)) || GAMES[0];
  const rows = seededScores(game.id.length * 23 + 7, 12);
  const [first, second, third] = rows;

  return (
    <>
      <div className="hall-tabs">
        {GAMES.map((g) => (
          <Link
            key={g.id}
            href={`/hall-of-fame?game=${g.id}`}
            className={"chip" + (g.id === game.id ? " active" : "")}
            aria-current={g.id === game.id ? "page" : undefined}
            scroll={false}
          >
            {g.title}
          </Link>
        ))}
      </div>

      <div className="podium">
        <div className="podium-slot silver">
          <div className="rank-num">02</div>
          <div className="name">{second.name}</div>
          <div className="score">{formatScore(second.score)}</div>
          <div className="date">{second.date}</div>
        </div>
        <div className="podium-slot gold">
          <div className="pixel text-[9px] tracking-[0.18em] text-gold">CAMPEÓN</div>
          <div className="rank-num mt-1 text-4xl">01</div>
          <div className="name">{first.name}</div>
          <div className="score text-xl">{formatScore(first.score)}</div>
          <div className="date">{first.date}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <div className="name">{third.name}</div>
          <div className="score">{formatScore(third.score)}</div>
          <div className="date">{third.date}</div>
        </div>
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.map((r, i) => (
          <div key={r.name} className={"tr" + (TOP_CLASS[i] ?? "")} style={{ animationDelay: `${i * 50}ms` }}>
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{formatScore(r.score)}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
      </div>
    </>
  );
}
