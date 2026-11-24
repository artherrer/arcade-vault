import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { GameDetailSkeleton } from "@/components/game-detail-skeleton";
import { Leaderboard } from "@/components/leaderboard";
import { GAMES, getGame } from "@/lib/games";
import { getLeaderboard, getPlays } from "@/lib/scores";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default function GameDetailPage({ params }: PageProps<"/games/[id]">) {
  // Leer params es dato de URL: con Cache Components debe ir dentro de <Suspense>
  // (incluso con generateStaticParams) para que la navegación sea instantánea.
  return (
    <Suspense fallback={<GameDetailSkeleton />}>
      <GameDetail params={params} />
    </Suspense>
  );
}

async function GameDetail({
  params,
}: {
  params: PageProps<"/games/[id]">["params"];
}) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  // Ranking, mejor global y partidas reales (SPEC 06).
  const [scores, count] = await Promise.all([
    getLeaderboard(id, 10),
    getPlays(id),
  ]);
  const best = scores[0]?.score ?? 0;
  const plays = count.toLocaleString("es-ES");

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div className="detail-info mt-5">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div className="v text-magenta [text-shadow:0_0_6px_rgba(255,0,110,0.5)]">
                {best.toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div className="v text-yellow [text-shadow:0_0_6px_rgba(245,255,0,0.5)]">
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/games/${game.id}/play`} className="btn xl pulse">
              ▶ JUGAR AHORA
            </Link>
            <Link href="/games" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <Leaderboard rows={scores} />
      </aside>
    </div>
  );
}
