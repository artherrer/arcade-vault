"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ReadyOverlay } from "@/components/ready-overlay";
import {
  createSerpentinaGame,
  type SerpentinaGame,
  type SerpentinaPhase,
} from "@/lib/serpentina/engine";
import type { ArenaProps } from "@/lib/game-types";

const CONTROLS: { keys: string[]; action: string }[] = [
  { keys: ["←", "↑", "→", "↓", "WASD"], action: "MOVER" },
  { keys: ["ESPACIO"], action: "EMPEZAR" },
  { keys: ["P", "ESC"], action: "PAUSA" },
];

export function SerpentinaCanvas({
  paused,
  over,
  onStats,
  onGameOver,
}: ArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SerpentinaGame | null>(null);
  // Los callbacks van en una ref para no recrear el motor cuando el padre los cambia.
  const callbacksRef = useRef({ onStats, onGameOver });
  const [phase, setPhase] = useState<SerpentinaPhase>("ready");

  useLayoutEffect(() => {
    callbacksRef.current = { onStats, onGameOver };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createSerpentinaGame(canvas, {
      onStats: (stats) => callbacksRef.current.onStats(stats),
      onGameOver: (result) => callbacksRef.current.onGameOver(result),
      onPhase: setPhase,
    });
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    gameRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (over) gameRef.current?.end();
  }, [over]);

  return (
    <div className="serpentina-stage">
      <canvas
        ref={canvasRef}
        className="serpentina-canvas"
        aria-label="Rejilla de SERPENTINA"
      />
      {phase === "ready" && <ReadyOverlay controls={CONTROLS} />}
    </div>
  );
}
