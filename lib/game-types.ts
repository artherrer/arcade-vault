// Contrato común entre GamePlayer y las arenas de los juegos reales (SPEC 07).

import type { ScoreSubmission } from "@/lib/scoring";

export type GameStats = {
  score: number;
  lives: number | null; // null: el juego no tiene vidas (el HUD muestra —)
  level: number | null; // null: el juego no tiene niveles
};

export type ArenaProps = {
  paused: boolean;
  over: boolean;
  onStats: (stats: GameStats) => void;
  onGameOver: (result: ScoreSubmission) => void; // una vez por partida
};
