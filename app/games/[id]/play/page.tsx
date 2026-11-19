import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GamePlayer } from "@/components/game-player";
import { GAMES, getGame } from "@/lib/games";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default function GamePlayPage({ params }: PageProps<"/games/[id]/play">) {
  // Leer params es dato de URL: con Cache Components debe ir dentro de <Suspense>.
  return (
    <Suspense fallback={<div className="pixel py-20 text-center text-[11px] text-ink-faint">CARGANDO…</div>}>
      <GamePlay params={params} />
    </Suspense>
  );
}

async function GamePlay({ params }: { params: PageProps<"/games/[id]/play">["params"] }) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
