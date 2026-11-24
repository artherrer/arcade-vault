import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GamePlayer } from "@/components/game-player";
import { getCurrentProfile } from "@/lib/auth";
import { GAMES, getGame } from "@/lib/games";
import { isConnected } from "@/lib/scoring";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default function GamePlayPage({
  params,
}: PageProps<"/games/[id]/play">) {
  // Leer params es dato de URL: con Cache Components debe ir dentro de <Suspense>.
  return (
    <Suspense
      fallback={
        <div className="pixel py-20 text-center text-[11px] text-ink-faint">
          CARGANDO…
        </div>
      }
    >
      <GamePlay params={params} />
    </Suspense>
  );
}

async function GamePlay({
  params,
}: {
  params: PageProps<"/games/[id]/play">["params"];
}) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  const profile = await getCurrentProfile();

  return (
    <GamePlayer
      game={game}
      username={profile?.username ?? null}
      connected={isConnected(game.id)}
    />
  );
}
