"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { saveScore, type SaveScoreErrorCode } from "@/app/games/actions";
import { ARENAS } from "@/components/arenas";
import type { Game } from "@/lib/games";
import type { ScoreSubmission } from "@/lib/scoring";

function isTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; code: SaveScoreErrorCode };

const SAVE_ERRORS: Record<SaveScoreErrorCode, string> = {
  unauthenticated: "[ERR] TU SESIÓN HA CADUCADO. INICIA SESIÓN PARA GUARDAR.",
  invalid: "[ERR] PUNTUACIÓN RECHAZADA.",
  unknown: "[ERR] NO SE PUDO GUARDAR.",
};

type GamePlayerProps = {
  game: Game;
  username: string | null; // de profiles (SPEC 04); null sin sesión
};

export function GamePlayer({ game, username }: GamePlayerProps) {
  const player = username ? username.toUpperCase() : "INVITADO";
  const arena = ARENAS[game.id];
  const { Arena, initial } = arena;
  const [progress, setProgress] = useState(initial);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  // Guarda contra el doble guardado: run de la última partida enviada y
  // resultado para REINTENTAR. Se usan refs, no un useEffect.
  const submittedRunRef = useRef<number | null>(null);
  const resultRef = useRef<ScoreSubmission | null>(null);
  const runRef = useRef(0);
  // Cambiar la key remonta la arena: partida nueva en fase "ready".
  const [run, setRun] = useState(0);
  const { score, lives, level } = progress;

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

  const submit = async (result: ScoreSubmission) => {
    const forRun = runRef.current;
    setSave({ status: "saving" });
    let next: SaveState;
    try {
      const res = await saveScore({ gameId: game.id, ...result });
      next = res.status === "saved" ? res : { status: "error", code: res.code };
    } catch (err) {
      console.error("[scores] saveScore:", err);
      next = { status: "error", code: "unknown" };
    }
    // JUGAR DE NUEVO durante el envío: la respuesta ya no es de esta partida.
    if (runRef.current === forRun) setSave(next);
  };

  const endGame = (result: ScoreSubmission) => {
    setProgress((p) => ({ ...p, score: result.score, level: result.level }));
    setOver(true);
    // Guardado automático: una sola vez por partida, con sesión y con puntos.
    if (!username || result.score <= 0) return;
    if (submittedRunRef.current === runRef.current) return;
    submittedRunRef.current = runRef.current;
    resultRef.current = result;
    void submit(result);
  };

  const retry = () => {
    if (resultRef.current) void submit(resultRef.current);
  };

  const restart = () => {
    runRef.current += 1;
    resultRef.current = null;
    setProgress(initial);
    setPaused(false);
    setOver(false);
    setSave({ status: "idle" });
    setRun((r) => r + 1);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="flex flex-wrap gap-6">
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v text-ink">{player}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">
              {lives === null ? "—" : "♥ ".repeat(lives).trim() || "—"}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">
              {level === null ? "—" : String(level).padStart(2, "0")}
            </div>
          </div>
        </div>
        <div className="hud-actions">
          <button
            type="button"
            className="btn yellow"
            onClick={() => setPaused((p) => !p)}
            disabled={over}
          >
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button
            type="button"
            className="btn magenta"
            onClick={() => setOver(true)}
          >
            FIN
          </button>
          <Link href={`/games/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <Arena
            key={run}
            paused={paused}
            over={over}
            onStats={setProgress}
            onGameOver={endGame}
          />
          {paused && (
            <div className="crt-content z-[5] bg-black/60">
              <div>
                <div className="pixel neon-yellow text-[22px]">EN PAUSA</div>
                <div className="mono mt-2.5 text-[11px] tracking-[0.16em] text-ink-dim">
                  PULSA REANUDAR PARA CONTINUAR
                </div>
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
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-over-title"
          >
            <h2 id="game-over-title">FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            <SaveStatus
              save={save}
              signedIn={username !== null}
              hasPoints={score > 0}
              onRetry={retry}
            />
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

function SaveStatus({
  save,
  signedIn,
  hasPoints,
  onRetry,
}: {
  save: SaveState;
  signedIn: boolean;
  hasPoints: boolean;
  onRetry: () => void;
}) {
  let body: ReactNode;
  if (!signedIn) {
    body = (
      <>
        <p className="save-msg">INICIA SESIÓN PARA GUARDAR TUS PUNTUACIONES</p>
        <Link href="/login" className="btn yellow">
          INICIAR SESIÓN
        </Link>
      </>
    );
  } else if (!hasPoints) {
    body = <p className="save-msg">▸ SIN PUNTOS QUE GUARDAR</p>;
  } else if (save.status === "saved") {
    body = <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>;
  } else if (save.status === "error") {
    body = (
      <>
        <p className="save-msg error">{SAVE_ERRORS[save.code]}</p>
        {save.code === "unknown" && (
          <button type="button" className="btn yellow" onClick={onRetry}>
            REINTENTAR
          </button>
        )}
        {save.code === "unauthenticated" && (
          <Link href="/login" className="btn yellow">
            INICIAR SESIÓN
          </Link>
        )}
      </>
    );
  } else {
    // idle dura lo que tarda endGame en lanzar el envío: se muestra como enviando.
    body = <p className="save-msg saving">▸ GUARDANDO…</p>;
  }

  return (
    <div className="save-zone" role="status" aria-live="polite">
      {body}
    </div>
  );
}
