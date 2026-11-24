// Registro de juegos conectados al leaderboard (SPEC 06).
// Un juego está conectado si tiene reglas aquí. Para guardar, además debe tener
// fila en public.games (FK de scores). Conectar un juego = entrada aquí + migración.

export type ScoreSubmission = {
  score: number;
  level: number | null;
  durationMs: number;
};

// true si la partida es plausible para ese juego.
export type ScoreRule = (s: ScoreSubmission) => boolean;

export const SCORE_RULES: Record<string, ScoreRule> = {
  // ROCAS: puntos 20/50/100 → múltiplo de 10; máx. 1500 pts/s (disparo triple:
  // 3 balas × 100 cada 0,2 s); superar un nivel exige ≥ 2080 puntos (4 grandes × 520).
  rocas: ({ score, level, durationMs }) =>
    level !== null &&
    score % 10 === 0 &&
    score <= (durationMs / 1000) * 1500 &&
    level <= 1 + Math.floor(score / 2080),
};

export function isConnected(gameId: string): boolean {
  return Object.hasOwn(SCORE_RULES, gameId);
}
