"use server";

import { createClient } from "@/lib/supabase/server";
import { SCORE_RULES, isConnected } from "@/lib/scoring";

export type SaveScoreInput = {
  gameId: string;
  score: number;
  level: number | null;
  durationMs: number;
};

export type SaveScoreErrorCode =
  | "unauthenticated" // getClaims() sin usuario
  | "invalid" // falla una regla genérica o del juego, o un check/FK de la BD
  | "unknown"; // cualquier otro error (se registra con console.error)

export type SaveScoreResult =
  { status: "saved" } | { status: "error"; code: SaveScoreErrorCode };

const MAX_SCORE = 10_000_000;
const MIN_DURATION_MS = 1000;

function fail(code: SaveScoreErrorCode): SaveScoreResult {
  return { status: "error", code };
}

// La entrada llega del navegador: no se confía en su forma ni en sus valores.
function isValid(input: unknown): input is SaveScoreInput {
  if (typeof input !== "object" || input === null) return false;
  const { gameId, score, level, durationMs } = input as Record<string, unknown>;

  if (typeof gameId !== "string" || !isConnected(gameId)) return false;
  if (!Number.isInteger(score) || !Number.isInteger(durationMs)) return false;
  if (level !== null && !Number.isInteger(level)) return false;

  const s = score as number;
  const d = durationMs as number;
  const l = level as number | null;
  if (s <= 0 || s > MAX_SCORE) return false;
  if (d < MIN_DURATION_MS) return false;
  if (l !== null && l < 1) return false;

  return SCORE_RULES[gameId]({ score: s, level: l, durationMs: d });
}

export async function saveScore(
  input: SaveScoreInput,
): Promise<SaveScoreResult> {
  const supabase = await createClient();

  // getClaims() verifica el JWT. El user_id nunca sale del cliente.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) return fail("unauthenticated");

  if (!isValid(input)) return fail("invalid");

  const { error } = await supabase.from("scores").insert({
    user_id: userId,
    game_id: input.gameId,
    score: input.score,
    level: input.level,
    duration_ms: input.durationMs,
  });

  if (error) {
    // 23514: check; 23503: FK (juego sin fila en public.games).
    if (error.code === "23514" || error.code === "23503")
      return fail("invalid");
    console.error("[scores] saveScore:", error);
    return fail("unknown");
  }

  return { status: "saved" };
}
