"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AsteroidsCanvas } from "@/components/asteroids-canvas";
import type { AsteroidsStats } from "@/lib/asteroids/engine";
import type { Game } from "@/lib/games";

// ROCAS es el único juego real (SPEC 05). El resto sigue con la simulación visual:
// la puntuación sube sola.
const TICK_MS = 220;
const INITIAL: AsteroidsStats = { score: 0, lives: 3, level: 1 };

function isTextField(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function GamePlayer({ game }: { game: Game }) {
  const [progress, setProgress] = useState(INITIAL);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);
  // Cambiar la key remonta AsteroidsCanvas: partida nueva en fase "ready".
  const [run, setRun] = useState(0);
  const { score, lives, level } = progress;
  const isRocas = game.id === "rocas";

  useEffect(() => {
    if (isRocas || over || paused) return;
    const t = setInterval(() => {
      setProgress((p) => {
        const next = p.score + Math.floor(10 + Math.random() * 90);
        return { ...p, score: next, level: next % 2500 < 100 ? p.level + 1 : p.level };
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, [isRocas, over, paused]);

  // P / Escape = botón PAUSA. Sin efecto con el modal abierto o escribiendo en un campo.
  useEffect(() => {
    if (over) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isTextField(e.target)) return;
      if (e.code === "KeyP" || e.key === "Escape") setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [over]);

  // Pestaña oculta → pausa. Al volver no se reanuda sola.
  useEffect(() => {
    if (over) return;
    const onVisibility = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [over]);

  const endGame = (finalScore: number) => {
    setProgress((p) => ({ ...p, score: finalScore }));
    setOver(true);
  };

  const restart = () => {
    setProgress(INITIAL);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setRun((r) => r + 1);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="flex flex-wrap gap-6">
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v text-ink">{name}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button type="button" className="btn yellow" onClick={() => setPaused((p) => !p)} disabled={over}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button type="button" className="btn magenta" onClick={() => setOver(true)}>
            FIN
          </button>
          <Link href={`/games/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isRocas ? (
            <AsteroidsCanvas key={run} paused={paused} over={over} onStats={setProgress} onGameOver={endGame} />
          ) : (
            <div className="game-arena" aria-hidden="true">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div className="crt-content z-[5] bg-black/60">
              <div>
                <div className="pixel neon-yellow text-[22px]">EN PAUSA</div>
                <div className="mono mt-2.5 text-[11px] tracking-[0.16em] text-ink-dim">PULSA REANUDAR PARA CONTINUAR</div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
            <h2 id="game-over-title">FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                  aria-label="Tus iniciales"
                />
                {/* Solo feedback visual: la persistencia de puntuaciones va en otra spec. */}
                <button type="button" className="btn yellow" onClick={() => setSaved(true)}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button type="button" className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/games" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
