// Registro de arenas jugables (SPEC 07). Un juego sin entrada sigue con la simulación.

import type { ComponentType } from "react";
import { ApilaCanvas } from "@/components/apila-canvas";
import { AsteroidsCanvas } from "@/components/asteroids-canvas";
import { BloqueBusterCanvas } from "@/components/bloque-buster-canvas";
import { SerpentinaCanvas } from "@/components/serpentina-canvas";
import type { ArenaProps, GameStats } from "@/lib/game-types";

export type ArenaEntry = {
  Arena: ComponentType<ArenaProps>;
  initial: GameStats; // HUD al montar y tras JUGAR DE NUEVO
};

export const ARENAS: Partial<Record<string, ArenaEntry>> = {
  rocas: { Arena: AsteroidsCanvas, initial: { score: 0, lives: 3, level: 1 } },
  apila: { Arena: ApilaCanvas, initial: { score: 0, lives: null, level: 1 } },
  "bloque-buster": { Arena: BloqueBusterCanvas, initial: { score: 0, lives: 3, level: 1 } },
  serpentina: { Arena: SerpentinaCanvas, initial: { score: 0, lives: null, level: 1 } },
};
