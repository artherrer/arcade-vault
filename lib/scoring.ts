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
  // APILA: granularidad 1 (la caída suave suma 1).
  // Cota mínima: el nivel N exige ≥ 10·(N−1) líneas de ≥ 100 puntos → level ≤ 1 + floor(score/1000).
  // Cota máxima: con L = 10·level − 1 líneas como mucho:
  //   líneas ≤ 200·level cada una (una tetrada son 800·level entre 4 líneas, y el nivel nunca baja);
  //   caídas ≤ 38 por pieza (19 filas × 2), con piezas ≤ (10L + 200)/4 + 1 (≥ 4 celdas por pieza,
  //   tablero de 200 celdas, más la pieza que está cayendo) → ≤ 95L + 1938.
  //   score ≤ L·(200·level + 95) + 1938. Nivel 1 → 4.593.
  // Sin límite de puntos/s: la caída instantánea no tiene tope físico de velocidad.
  apila: ({ score, level }) => {
    if (level === null || level > 1 + Math.floor(score / 1000)) return false;
    const lines = 10 * level - 1;
    return score <= lines * (200 * level + 95) + 1938;
  },
};

export function isConnected(gameId: string): boolean {
  return Object.hasOwn(SCORE_RULES, gameId);
}
