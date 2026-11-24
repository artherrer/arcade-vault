// Port a TypeScript de references/started-games/03-tetris/game.js (SPEC 07).
// Mismas reglas, velocidad y puntuación. Todo el estado vive dentro de cada
// instancia de createApilaGame; a nivel de módulo solo hay constantes y funciones puras.

import type { GameStats } from "@/lib/game-types";
import type { ScoreSubmission } from "@/lib/scoring";

export type ApilaPhase = "ready" | "playing" | "gameover";

export type ApilaCallbacks = {
  onStats: (stats: GameStats) => void; // { score, lives: null, level }, solo si cambia
  onPhase: (phase: ApilaPhase) => void; // ready → playing → gameover
  onGameOver: (result: ScoreSubmission) => void; // pieza que choca al aparecer, o end()
};

export type ApilaGame = {
  setPaused: (paused: boolean) => void;
  end: () => void; // congela el juego (botón FIN) y llama a onGameOver si aún no se llamó
  destroy: () => void; // cancela el rAF y quita los listeners de window
};

type Shape = number[][];
type Piece = { type: number; shape: Shape; x: number; y: number };

// ── Constantes de la referencia ───────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS: readonly (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: readonly (Shape | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  // [
  //   [8, 8, 8],
  //   [8, 0, 8],
  //   [8, 8, 8],
  // ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const KICKS = [0, -1, 1, -2, 2];
const START_DROP_MS = 1000;
const GHOST_ALPHA = 0.2;

// ── Constantes del port ───────────────────────────────────────────────────────
const W = 800;
const H = 600;
const BOARD_X = 250; // (800 − 300) / 2
const PANEL_X = 580; // 30 px a la derecha del tablero
const MAX_DT = 50; // ms
const BOARD_BG = "#1a1a25";
const GRID_LINE = "#22222e";

// Fondo del mundo fuera del tablero y colores del panel (tokens del Vault).
const WORLD_BG = "#07070d";
const FRAME = "#ff006e"; // --magenta
const LABEL = "#8a8fb5"; // --ink-dim
const VALUE = "#f5ff00"; // --yellow
const NEXT_CELLS = 4;
const NEXT_Y = 60;
const LINES_Y = NEXT_Y + NEXT_CELLS * BLOCK + 70;

// Teclas del juego: se les hace preventDefault para que la página no haga scroll.
const GAME_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "ArrowUp",
  "KeyX",
  "Space",
]);

// ── Utils ─────────────────────────────────────────────────────────────────────
const dropIntervalFor = (level: number) =>
  Math.max(100, START_DROP_MS - (level - 1) * 90);

function createBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

// Bloque con el brillo superior de la referencia. (ox, oy) es el origen en el mundo.
function drawBlock(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  x: number,
  y: number,
  colorIndex: number,
  alpha = 1,
) {
  if (!colorIndex) return;
  const px = ox + x * BLOCK;
  const py = oy + y * BLOCK;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS[colorIndex]!;
  ctx.fillRect(px + 1, py + 1, BLOCK - 2, BLOCK - 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(px + 1, py + 1, BLOCK - 2, 4);
  ctx.globalAlpha = 1;
}

export function createApilaGame(
  canvas: HTMLCanvasElement,
  callbacks: ApilaCallbacks,
): ApilaGame {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  // Backing store a resolución de pantalla; la lógica sigue en 800×600.
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ── Estado ──
  const board = createBoard();
  let current: Piece | null = null; // null en ready
  let next = randomPiece();
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropInterval = START_DROP_MS;
  let dropAccum = 0;
  let phase: ApilaPhase = "ready";

  // Suma de dt (ya capados) en playing. La pausa no llega a update().
  let playedMs = 0;
  let reported = false;
  // El Space que arranca la partida no hace caída instantánea, ni su autorepeat.
  let startKeyHeld = false;

  let paused = false;
  let ended = false;
  let lastTime: number | null = null;
  let rafId = 0;
  let emitted: GameStats = { score, lives: null, level };

  // ── Lógica (port de game.js) ──
  const setPhase = (nextPhase: ApilaPhase) => {
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

  const collide = (shape: Shape, ox: number, oy: number) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  };

  const tryRotate = (p: Piece) => {
    const rotated = rotateCW(p.shape);
    for (const kick of KICKS) {
      if (!collide(rotated, p.x + kick, p.y)) {
        p.shape = rotated;
        p.x += kick;
        return;
      }
    }
  };

  const merge = (p: Piece) => {
    for (let r = 0; r < p.shape.length; r++)
      for (let c = 0; c < p.shape[r].length; c++)
        if (p.shape[r][c]) board[p.y + r][p.x + c] = p.shape[r][c];
  };

  const clearLines = () => {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = dropIntervalFor(level);
    }
  };

  const ghostY = (p: Piece) => {
    let gy = p.y;
    while (!collide(p.shape, p.x, gy + 1)) gy++;
    return gy;
  };

  const spawn = () => {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      setPhase("gameover");
      reportGameOver();
    }
  };

  const lockPiece = (p: Piece) => {
    merge(p);
    clearLines();
    spawn();
  };

  const hardDrop = (p: Piece) => {
    const gy = ghostY(p);
    score += (gy - p.y) * 2;
    p.y = gy;
    lockPiece(p);
  };

  const softDrop = (p: Piece) => {
    if (!collide(p.shape, p.x, p.y + 1)) {
      p.y++;
      score += 1;
    } else {
      lockPiece(p);
    }
  };

  const start = () => {
    setPhase("playing");
    dropAccum = 0;
    spawn();
  };

  const update = (dt: number) => {
    if (phase !== "playing" || !current) return;
    playedMs += dt;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) current.y++;
      else lockPiece(current);
    }
  };

  // ── Input ──
  const onKeyDown = (e: KeyboardEvent) => {
    if (isTextField(e.target) || ended || phase === "gameover") return;
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (paused) return;

    if (phase === "ready") {
      if (e.code === "Space" && !e.repeat) {
        startKeyHeld = true;
        start();
        emitStats();
      }
      return;
    }

    const p = current;
    if (!p) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(p.shape, p.x - 1, p.y)) p.x--;
        break;
      case "ArrowRight":
        if (!collide(p.shape, p.x + 1, p.y)) p.x++;
        break;
      case "ArrowDown":
        softDrop(p);
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate(p);
        break;
      case "Space":
        if (!startKeyHeld) hardDrop(p);
        break;
    }
    emitStats();
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") startKeyHeld = false;
  };

  // ── Dibujo ──
  const drawBoard = () => {
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(BOARD_X, 0, COLS * BLOCK, ROWS * BLOCK);

    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X + c * BLOCK, 0);
      ctx.lineTo(BOARD_X + c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X, r * BLOCK);
      ctx.lineTo(BOARD_X + COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(ctx, BOARD_X, 0, c, r, board[r][c]);

    if (current) {
      const p = current;
      const gy = ghostY(p);
      for (let r = 0; r < p.shape.length; r++)
        for (let c = 0; c < p.shape[r].length; c++)
          if (p.shape[r][c])
            drawBlock(
              ctx,
              BOARD_X,
              0,
              p.x + c,
              gy + r,
              p.shape[r][c],
              GHOST_ALPHA,
            );
      for (let r = 0; r < p.shape.length; r++)
        for (let c = 0; c < p.shape[r].length; c++)
          drawBlock(ctx, BOARD_X, 0, p.x + c, p.y + r, p.shape[r][c]);
    }

    // Marco neón del pozo.
    ctx.save();
    ctx.strokeStyle = FRAME;
    ctx.lineWidth = 2;
    ctx.shadowColor = FRAME;
    ctx.shadowBlur = 12;
    ctx.strokeRect(BOARD_X - 1, -1, COLS * BLOCK + 2, ROWS * BLOCK + 2);
    ctx.restore();
  };

  const drawLabel = (text: string, y: number) => {
    ctx.font = `10px ${getComputedStyle(canvas).fontFamily}`;
    ctx.fillStyle = LABEL;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(text, PANEL_X, y);
  };

  const drawPanel = () => {
    const size = NEXT_CELLS * BLOCK;

    drawLabel("SIGUIENTE", NEXT_Y - 22);
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(PANEL_X, NEXT_Y, size, size);
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(PANEL_X + 0.5, NEXT_Y + 0.5, size - 1, size - 1);
    const shape = next.shape;
    const offX = Math.floor((NEXT_CELLS - shape[0].length) / 2);
    const offY = Math.floor((NEXT_CELLS - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(ctx, PANEL_X, NEXT_Y, offX + c, offY + r, shape[r][c]);

    drawLabel("LÍNEAS", LINES_Y);
    ctx.save();
    ctx.font = `22px ${getComputedStyle(canvas).fontFamily}`;
    ctx.fillStyle = VALUE;
    ctx.shadowColor = VALUE;
    ctx.shadowBlur = 10;
    ctx.fillText(String(lines), PANEL_X, LINES_Y + 22);
    ctx.restore();
  };

  const draw = () => {
    ctx.fillStyle = WORLD_BG;
    ctx.fillRect(0, 0, W, H);
    drawBoard();
    drawPanel();
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

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  draw();
  rafId = requestAnimationFrame(loop);

  return {
    setPaused(nextPaused) {
      if (paused === nextPaused) return;
      paused = nextPaused;
      // Al reanudar, el primer frame tiene dt = 0: la pieza no da un salto.
      lastTime = null;
    },
    end() {
      ended = true;
      reportGameOver();
    },
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
