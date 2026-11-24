"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ReadyOverlay } from "@/components/ready-overlay";
import { createApilaGame, type ApilaGame, type ApilaPhase } from "@/lib/apila/engine";
import type { ArenaProps } from "@/lib/game-types";

const CONTROLS: { keys: string[]; action: string }[] = [
  { keys: ["←", "→"], action: "MOVER" },
  { keys: ["↑", "X"], action: "ROTAR" },
  { keys: ["↓"], action: "BAJAR" },
  { keys: ["ESPACIO"], action: "CAÍDA" },
  { keys: ["P", "ESC"], action: "PAUSA" },
];

export function ApilaCanvas({ paused, over, onStats, onGameOver }: ArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<ApilaGame | null>(null);
  // Los callbacks van en una ref para no recrear el motor cuando el padre los cambia.
  const callbacksRef = useRef({ onStats, onGameOver });
  const [phase, setPhase] = useState<ApilaPhase>("ready");

  useLayoutEffect(() => {
    callbacksRef.current = { onStats, onGameOver };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createApilaGame(canvas, {
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
    <div className="apila-stage">
      <canvas ref={canvasRef} className="apila-canvas" aria-label="Pozo de piezas de APILA" />
      {phase === "ready" && <ReadyOverlay controls={CONTROLS} />}
    </div>
  );
}
