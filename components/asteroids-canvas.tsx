"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ReadyOverlay } from "@/components/ready-overlay";
import {
  createAsteroidsGame,
  type AsteroidsGame,
  type AsteroidsPhase,
} from "@/lib/asteroids/engine";
import type { ArenaProps } from "@/lib/game-types";

const CONTROLS: { keys: string[]; action: string }[] = [
  { keys: ["←", "→"], action: "ROTAR" },
  { keys: ["↑"], action: "PROPULSAR" },
  { keys: ["ESPACIO"], action: "DISPARAR" },
  { keys: ["P", "ESC"], action: "PAUSA" },
];

export function AsteroidsCanvas({
  paused,
  over,
  onStats,
  onGameOver,
}: ArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AsteroidsGame | null>(null);
  // Los callbacks van en una ref para no recrear el motor cuando el padre los cambia.
  const callbacksRef = useRef({ onStats, onGameOver });
  const [phase, setPhase] = useState<AsteroidsPhase>("ready");

  useLayoutEffect(() => {
    callbacksRef.current = { onStats, onGameOver };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createAsteroidsGame(canvas, {
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
    <div className="asteroids-stage">
      <canvas
        ref={canvasRef}
        className="asteroids-canvas"
        aria-label="Campo de asteroides de ROCAS"
      />
      {phase === "ready" && <ReadyOverlay controls={CONTROLS} />}
    </div>
  );
}
