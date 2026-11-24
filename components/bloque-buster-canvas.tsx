"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ReadyOverlay } from "@/components/ready-overlay";
import {
  createBloqueBusterGame,
  type BloqueBusterGame,
  type BloqueBusterPhase,
} from "@/lib/bloque-buster/engine";
import type { ArenaProps } from "@/lib/game-types";

const CONTROLS: { keys: string[]; action: string }[] = [
  { keys: ["←", "→", "RATÓN"], action: "MOVER" },
  { keys: ["ESPACIO"], action: "EMPEZAR" },
  { keys: ["P", "ESC"], action: "PAUSA" },
];

export function BloqueBusterCanvas({
  paused,
  over,
  onStats,
  onGameOver,
}: ArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<BloqueBusterGame | null>(null);
  // Los callbacks van en una ref para no recrear el motor cuando el padre los cambia.
  const callbacksRef = useRef({ onStats, onGameOver });
  const [phase, setPhase] = useState<BloqueBusterPhase>("ready");

  useLayoutEffect(() => {
    callbacksRef.current = { onStats, onGameOver };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createBloqueBusterGame(canvas, {
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

  // Solo mientras el ratón mueve la paleta (playing sin pausa) se oculta el cursor.
  const steering = phase === "playing" && !paused && !over;

  return (
    <div className="bloque-stage" data-steering={steering || undefined}>
      <canvas
        ref={canvasRef}
        className="bloque-canvas"
        aria-label="Muro de bloques de BLOQUE BUSTER"
      />
      {phase === "ready" && <ReadyOverlay controls={CONTROLS} />}
    </div>
  );
}
