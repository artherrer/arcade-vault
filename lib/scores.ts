import "server-only";
import { connection } from "next/server";
import type { ScoreRow } from "@/lib/games";
import { SCORE_RULES } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";

// Lecturas de rankings reales (SPEC 06). Son dinámicas (el cliente lee cookies):
// llamarlas siempre dentro de un <Suspense>. Si Supabase falla, se registra el
// error y se devuelve el valor vacío para que la página muestre su estado vacío.

// Las lecturas son siempre de la petición: nunca se prerenderizan (el cliente
// de Supabase usa Date.now() al revisar la sesión de las cookies).
async function readClient() {
  await connection();
  return createClient();
}

const pad = (n: number) => String(n).padStart(2, "0");

// dd/mm/aaaa en UTC, como las fechas del mock.
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Top N de la vista leaderboard (mejor puntuación por jugador): score desc, created_at asc.
export async function getLeaderboard(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]> {
  const supabase = await readClient();
  const { data, error } = await supabase
    .from("leaderboard")
    .select("username, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[scores] getLeaderboard:", error);
    return [];
  }

  // La vista tipa todo como nullable; con el join interno nunca llegan nulos.
  return data.flatMap((r, i) =>
    r.username && r.score !== null && r.created_at
      ? [
          {
            rank: i + 1,
            name: r.username.toUpperCase(),
            score: r.score,
            date: formatDate(r.created_at),
          },
        ]
      : [],
  );
}

// Número de filas de scores para el juego.
export async function getPlays(gameId: string): Promise<number> {
  const supabase = await readClient();
  const { count, error } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId);

  if (error) {
    console.error("[scores] getPlays:", error);
    return 0;
  }
  return count ?? 0;
}

// Mejor puntuación de cada juego conectado (0 si no tiene). Para la biblioteca.
export async function getBestScores(): Promise<Record<string, number>> {
  const ids = Object.keys(SCORE_RULES);
  const tops = await Promise.all(ids.map((id) => getLeaderboard(id, 1)));
  return Object.fromEntries(ids.map((id, i) => [id, tops[i][0]?.score ?? 0]));
}
