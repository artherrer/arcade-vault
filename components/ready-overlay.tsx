// Overlay de la fase "ready" común a las arenas (SPEC 07).

import type { CSSProperties } from "react";

type ReadyOverlayProps = {
  controls: { keys: string[]; action: string }[];
};

export function ReadyOverlay({ controls }: ReadyOverlayProps) {
  return (
    <div className="ready-overlay">
      <p className="ready-cta">PULSA ESPACIO PARA EMPEZAR</p>
      <ul
        className="ready-keys"
        aria-label="Controles"
        style={{ "--ready-cols": controls.length } as CSSProperties}
      >
        {controls.map(({ keys, action }) => (
          <li key={action}>
            <span className="ready-caps">
              {keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </span>
            <span className="ready-action">{action}</span>
          </li>
        ))}
      </ul>
      <p className="ready-touch">NECESITAS UN TECLADO PARA JUGAR</p>
    </div>
  );
}
