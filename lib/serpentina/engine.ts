// SERPENTINA (SPEC 09): Snake clásico, diseño propio.
// Todo el estado vive dentro de cada instancia de createSerpentinaGame; a nivel
// de módulo solo hay constantes y funciones puras.

import type { GameStats } from "@/lib/game-types";
import type { ScoreSubmission } from "@/lib/scoring";

export type SerpentinaPhase = "ready" | "playing" | "gameover";

export type SerpentinaCallbacks = {
  onStats: (stats: GameStats) => void; // { score, lives: null, level }, solo si cambia
  onPhase: (phase: SerpentinaPhase) => void; // ready → playing → gameover
  onGameOver: (result: ScoreSubmission) => void; // muro, cuerpo, tablero lleno, o end()
};

export type SerpentinaGame = {
  setPaused: (paused: boolean) => void;
  end: () => void; // congela el juego (botón FIN) y llama a onGameOver si aún no se llamó
  destroy: () => void; // cancela el rAF y quita los listeners de window
};

type Cell = { x: number; y: number }; // columna 0..31, fila 0..23
type Dir = "up" | "down" | "left" | "right";
type Sprite = { x: number; y: number; w: number; h: number };

// ── Reglas ────────────────────────────────────────────────────────────────────
const W = 800;
const H = 600;
const CELL = 25;
const COLS = 32;
const ROWS = 24;
const MIN_STEP = 60; // ms
const POINTS_PER_FRUIT = 10;
const FRUITS_PER_LEVEL = 5;
const MAX_QUEUE = 2;
const MAX_DT = 50; // ms

const stepInterval = (level: number) =>
  Math.max(MIN_STEP, 150 - (level - 1) * 10);

// Recortes de la fila de pixel art de fruits.png (coordenadas de sprites.js;
// sus nombres no coinciden con la imagen, así que no se usan).
const FRUIT_SPRITES: readonly Sprite[] = (
  [
    [34, 110],
    [186, 150],
    [378, 110],
    [540, 130],
    [712, 130],
    [894, 110],
    [1066, 110],
    [1228, 130],
    [1400, 130],
    [1582, 110],
    [1734, 150],
    [1906, 150],
    [2068, 170],
    [2250, 140],
    [2432, 130],
    [2604, 130],
    [2786, 110],
    [2948, 130],
    [3110, 150],
    [3302, 110],
    [3454, 150],
    [3637, 130],
  ] as const
).map(([x, w]) => ({ x, y: 136, w, h: 160 }));

// ── Colores y ruta ────────────────────────────────────────────────────────────
const BG = "#0a0a0f"; // --bg
const GRID_LINE = "#14141f";
const SNAKE = "#00ff88"; // --green
const SNAKE_HEAD = "#b3ffd9";
const SPRITES_SRC = "/serpentina/fruits.png";

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

// Teclas por event.key; las letras se normalizan a minúscula.
const KEY_DIR: Record<string, Dir> = {
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

// ── Utils ─────────────────────────────────────────────────────────────────────
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

export function createSerpentinaGame(
  canvas: HTMLCanvasElement,
  callbacks: SerpentinaCallbacks,
): SerpentinaGame {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  // Backing store a resolución de pantalla; la lógica sigue en 800×600.
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ── Estado ──
  const snake: Cell[] = [
    { x: 16, y: 12 },
    { x: 15, y: 12 },
    { x: 14, y: 12 },
  ];
  let dir: Dir = "right";
  const queue: Dir[] = [];
  let fruit: { cell: Cell; sprite: number } | null = null;
  let fruits = 0;
  let score = 0;
  let level = 1;
  let acc = 0;
  let phase: SerpentinaPhase = "ready";

  // Suma de dt (ya capados) en playing. La pausa no llega a update().
  let playedMs = 0;
  let reported = false;

  let paused = false;
  let ended = false;
  let lastTime: number | null = null;
  let rafId = 0;
  let emitted: GameStats = { score, lives: null, level };

  const img = new Image();
  let imgLoaded = false;

  // ── Lógica ──
  const setPhase = (nextPhase: SerpentinaPhase) => {
    phase = nextPhase;
    callbacks.onPhase(nextPhase);
  };

  const emitStats = () => {
    if (emitted.score === score && emitted.level === level) return;
    emitted = { score, lives: null, level };
    callbacks.onStats(emitted);
  };

  const reportGameOver = () => {
    if (reported) return;
    reported = true;
    callbacks.onGameOver({ score, level, durationMs: Math.round(playedMs) });
  };

  const gameOver = () => {
    setPhase("gameover");
    reportGameOver();
  };

  // Celda libre al azar; false si el tablero está lleno.
  const spawnFruit = () => {
    const occupied = new Set(snake.map((c) => c.y * COLS + c.x));
    const free: number[] = [];
    for (let i = 0; i < COLS * ROWS; i++) if (!occupied.has(i)) free.push(i);
    if (free.length === 0) {
      fruit = null;
      return false;
    }
    const i = free[Math.floor(Math.random() * free.length)];
    fruit = {
      cell: { x: i % COLS, y: Math.floor(i / COLS) },
      sprite: Math.floor(Math.random() * FRUIT_SPRITES.length),
    };
    return true;
  };

  const queueTurn = (next: Dir) => {
    if (queue.length >= MAX_QUEUE) return;
    const last = queue.length ? queue[queue.length - 1] : dir;
    if (next === last || next === OPPOSITE[last]) return;
    queue.push(next);
  };

  const step = () => {
    dir = queue.shift() ?? dir;
    const head = snake[0];
    const d = DELTA[dir];
    const nextHead = { x: head.x + d.x, y: head.y + d.y };

    if (
      nextHead.x < 0 ||
      nextHead.x >= COLS ||
      nextHead.y < 0 ||
      nextHead.y >= ROWS
    ) {
      gameOver();
      return;
    }

    const eating = fruit !== null && sameCell(nextHead, fruit.cell);
    // La cola se mueve en este mismo paso si no se come: cuenta como libre.
    const body = eating ? snake : snake.slice(0, -1);
    if (body.some((c) => sameCell(c, nextHead))) {
      gameOver();
      return;
    }

    snake.unshift(nextHead);
    if (!eating) {
      snake.pop();
      return;
    }

    fruits++;
    score += POINTS_PER_FRUIT;
    level = Math.floor(fruits / FRUITS_PER_LEVEL) + 1;
    if (!spawnFruit()) gameOver(); // tablero lleno: fin natural
  };

  const update = (dt: number) => {
    if (phase !== "playing") return;
    playedMs += dt;
    acc += dt;
    // Cada paso se resuelve entero (choque y comida) antes del siguiente.
    while (phase === "playing" && acc >= stepInterval(level)) {
      acc -= stepInterval(level);
      step();
    }
  };

  // ── Input ──
  const onKeyDown = (e: KeyboardEvent) => {
    if (isTextField(e.target) || ended || phase === "gameover") return;
    const isSpace = e.key === " ";
    const turn = KEY_DIR[e.key.toLowerCase()];
    if (!isSpace && !turn) return;
    e.preventDefault();
    if (paused) return;

    if (phase === "ready") {
      if (isSpace && !e.repeat && imgLoaded) {
        acc = 0;
        setPhase("playing");
      }
      return;
    }

    if (turn) queueTurn(turn);
  };

  // ── Dibujo ──
  const drawGrid = () => {
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(c * CELL + 0.5, 0);
      ctx.lineTo(c * CELL + 0.5, H);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(0, r * CELL + 0.5);
      ctx.lineTo(W, r * CELL + 0.5);
    }
    ctx.stroke();
  };

  const drawFruit = () => {
    if (!fruit || !imgLoaded) return;
    const s = FRUIT_SPRITES[fruit.sprite];
    const pad = 2;
    const scale = Math.min((CELL - pad * 2) / s.w, (CELL - pad * 2) / s.h);
    const dw = s.w * scale;
    const dh = s.h * scale;
    const dx = fruit.cell.x * CELL + (CELL - dw) / 2;
    const dy = fruit.cell.y * CELL + (CELL - dh) / 2;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, s.x, s.y, s.w, s.h, dx, dy, dw, dh);
  };

  const drawSnake = () => {
    for (let i = snake.length - 1; i >= 0; i--) {
      const c = snake[i];
      ctx.fillStyle = i === 0 ? SNAKE_HEAD : SNAKE;
      ctx.fillRect(c.x * CELL + 2, c.y * CELL + 2, CELL - 3, CELL - 3);
    }
  };

  const draw = () => {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    drawFruit();
    drawSnake();
  };

  // ── Bucle ──
  const loop = (ts: number) => {
    if (!paused && !ended) {
      const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
      lastTime = ts;
      update(dt);
      emitStats();
      draw();
    }
    rafId = requestAnimationFrame(loop);
  };

  spawnFruit();
  img.onload = () => {
    imgLoaded = true;
    draw();
  };
  img.src = SPRITES_SRC;

  window.addEventListener("keydown", onKeyDown);
  draw();
  rafId = requestAnimationFrame(loop);

  return {
    setPaused(nextPaused) {
      if (paused === nextPaused) return;
      paused = nextPaused;
      // Al reanudar, el primer frame tiene dt = 0: la serpiente no da un salto.
      lastTime = null;
    },
    end() {
      ended = true;
      reportGameOver();
    },
    destroy() {
      cancelAnimationFrame(rafId);
      img.onload = null;
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
