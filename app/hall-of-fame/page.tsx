import Link from "next/link";
import { Suspense } from "react";
import { GAMES, getGame, seededScores, type ScoreRow } from "@/lib/games";
import { getLeaderboard } from "@/lib/scores";
import { isConnected } from "@/lib/scoring";

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
  // Juegos conectados (SPEC 06): top 12 real. El resto sigue con el mock.
  const rows: ScoreRow[] = isConnected(game.id)
    ? await getLeaderboard(game.id, 12)
    : seededScores(game.id.length * 23 + 7, 12);
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
          <PodiumEntry row={second} />
        </div>
        <div className="podium-slot gold">
          <div className="pixel text-[9px] tracking-[0.18em] text-gold">CAMPEÓN</div>
          <div className="rank-num mt-1 text-4xl">01</div>
          <PodiumEntry row={first} scoreClass="text-xl" />
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <PodiumEntry row={third} />
        </div>
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.length === 0 && <p className="board-empty">SIN PUNTUACIONES TODAVÍA</p>}
        {rows.map((r, i) => (
          <div key={r.rank} className={"tr" + (TOP_CLASS[i] ?? "")} style={{ animationDelay: `${i * 50}ms` }}>
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

// Puesto del podio. Sin jugador (menos de 3 filas), muestra "—".
function PodiumEntry({ row, scoreClass }: { row: ScoreRow | undefined; scoreClass?: string }) {
  return (
    <>
      <div className="name">{row?.name ?? "—"}</div>
      <div className={"score" + (scoreClass ? " " + scoreClass : "")}>{row ? formatScore(row.score) : "—"}</div>
      <div className="date">{row?.date ?? "\u00a0"}</div>
    </>
  );
}
