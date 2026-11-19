"use client";

import { useState } from "react";
import { CATEGORIES, GAMES, type CategoryFilter } from "@/lib/games";
import { GameCard } from "@/components/game-card";

export function Library() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategoryFilter>("TODOS");

  const query = q.toLowerCase();
  const filtered = GAMES.filter((g) => (cat === "TODOS" || g.cat === cat) && g.title.toLowerCase().includes(query));

  return (
    <>
      <div className="av-filters">
        <div className="av-search">
          <span className="ico" aria-hidden="true">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar un juego por nombre…"
            aria-label="Buscar un juego por nombre"
          />
        </div>
        <div className="av-chips">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={"chip" + (cat === c ? " active" : "")}
              aria-pressed={cat === c}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full p-20 text-center text-ink-faint">
            <div className="pixel mb-3 text-sm text-magenta">NO HAY RESULTADOS</div>
            <div>Intenta otra búsqueda o categoría.</div>
          </div>
        )}
      </div>
    </>
  );
}
