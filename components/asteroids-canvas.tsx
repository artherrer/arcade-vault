"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  createAsteroidsGame,
  type AsteroidsGame,
  type AsteroidsPhase,
  type AsteroidsStats,
} from "@/lib/asteroids/engine";

type AsteroidsCanvasProps = {
  paused: boolean;
  over: boolean;
  onStats: (stats: AsteroidsStats) => void;
  onGameOver: (score: number) => void;
};

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
}: AsteroidsCanvasProps) {
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
      onGameOver: (score) => callbacksRef.current.onGameOver(score),
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
      {phase === "ready" && (
        <div className="asteroids-ready">
          <p className="asteroids-cta">PULSA ESPACIO PARA EMPEZAR</p>
          <ul className="asteroids-keys" aria-label="Controles">
            {CONTROLS.map(({ keys, action }) => (
              <li key={action}>
                <span className="asteroids-caps">
                  {keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </span>
                <span className="asteroids-action">{action}</span>
              </li>
            ))}
          </ul>
          <p className="asteroids-touch">NECESITAS UN TECLADO PARA JUGAR</p>
        </div>
      )}
    </div>
  );
}
