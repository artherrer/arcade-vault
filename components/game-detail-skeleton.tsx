// Esqueleto de /games/[id]: replica la rejilla de la página de detalle
// (portada, info, stat-strip, leaderboard) para que no haya salto de layout
// cuando llega el contenido real.

const LB_ROWS = 10;

export function GameDetailSkeleton() {
  return (
    <div className="av-detail" role="status" aria-busy="true">
      <span className="sr-only">Cargando juego…</span>

      <div aria-hidden="true">
        <div className="detail-cover skel-cover">
          <span className="skel-scan" />
          <span className="skel-cover-label">CARGANDO CARTUCHO</span>
        </div>

        <div className="detail-info mt-5">
          <div className="detail-tags">
            {[64, 84, 120, 92].map((w) => (
              <span key={w} className="skel-tag" style={{ width: w }} />
            ))}
          </div>
          <div className="skel-bone h-8 w-3/5" />
          <div className="flex flex-col gap-2">
            <div className="skel-bone h-3.5 w-full" />
            <div className="skel-bone h-3.5 w-11/12" />
            <div className="skel-bone h-3.5 w-2/3" />
          </div>
          <div className="stat-strip">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <div className="skel-bone h-2.5 w-1/2" />
                <div className="skel-bone mt-2.5 h-4 w-3/4" />
              </div>
            ))}
          </div>
          <div className="detail-actions">
            <div className="skel-bone h-14 w-60" />
            <div className="skel-bone h-12 w-48" />
          </div>
        </div>
      </div>

      <aside aria-hidden="true">
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {Array.from({ length: LB_ROWS }, (_, i) => (
            <div key={i} className="lb-row">
              <div className="skel-bone h-3 w-6" />
              <div className="flex flex-col gap-1.5">
                <div className="skel-bone h-3 w-24" />
                <div className="skel-bone h-2 w-14" />
              </div>
              <div className="skel-bone ml-auto h-3 w-16" />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
