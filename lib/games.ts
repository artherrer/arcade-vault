// Catálogo visual de Arcade Vault. Solo juegos reales: cada id tiene arena en
// components/arenas.ts, regla en SCORE_RULES y fila en public.games.

export type Category = "ARCADE" | "PUZZLE" | "SHOOTER";
export type CategoryFilter = "TODOS" | Category;
export type AccentColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;
  color: AccentColor;
};

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
};

export const GAMES: Game[] = [
  {
    id: "bloque-buster",
    title: "BLOQUE BUSTER",
    short: "Rebota la pelota y destruye muros de neón.",
    long: "Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cinco niveles, cinco patrones, y la pelota acelera en cada uno. ¿Llegarás a limpiar el último muro?",
    cat: "ARCADE",
    cover: "cover-bricks",
    color: "cyan",
  },
  {
    id: "apila",
    title: "APILA",
    short: "Encaja las piezas y no dejes que la torre toque el techo.",
    long: "Siete piezas de neón caen sin pausa. Muévelas, gíralas y completa filas para borrarlas. Cada 10 líneas sube el nivel y la caída se acelera.",
    cat: "PUZZLE",
    cover: "cover-tetro",
    color: "magenta",
  },
  {
    id: "serpentina",
    title: "SERPENTINA",
    short: "Crece sin morder tu propia cola.",
    long: "Una serpiente de luz recorre la grilla devorando frutas pixeladas. Cada bocado la alarga, y cada cinco sube el nivel y la velocidad. Un choque contra el muro o contra tu propia cola y se acabó.",
    cat: "ARCADE",
    cover: "cover-snake",
    color: "green",
  },
  {
    id: "rocas",
    title: "ROCAS",
    short: "Pulveriza asteroides en gravedad cero.",
    long: "Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.",
    cat: "SHOOTER",
    cover: "cover-rocas",
    color: "yellow",
  },
];

export const CATEGORIES: CategoryFilter[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
];

export function getGame(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}
