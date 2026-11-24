"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";

// Slots de sesión: NavAccount (Server Component) envuelto en <Suspense> desde
// app/layout.tsx. La Nav es cliente por el estado del panel móvil.
export function Nav({
  desktopAccount,
  mobileAccount,
}: {
  desktopAccount: ReactNode;
  mobileAccount: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <NavLink href="/">Inicio</NavLink>
          <NavLink href="/games" prefix>
            Biblioteca
          </NavLink>
          <NavLink href="/hall-of-fame">Salón de la Fama</NavLink>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {desktopAccount}
        <button
          type="button"
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
          aria-expanded={open}
          aria-controls="av-mobile-panel"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
        aria-hidden="true"
      ></div>
      <aside
        id="av-mobile-panel"
        className={"av-mobile-panel" + (open ? " open" : "")}
        inert={!open}
      >
        <div className="pixel neon-cyan mb-4 text-[11px]">MENÚ</div>
        <NavLink href="/" onClick={close}>
          Inicio
        </NavLink>
        <NavLink href="/games" prefix onClick={close}>
          Biblioteca
        </NavLink>
        <NavLink href="/hall-of-fame" onClick={close}>
          Salón de la Fama
        </NavLink>
        {/* Cualquier clic dentro (enlace o SALIR) cierra el panel. */}
        <div className="av-mobile-account" onClick={close}>
          {mobileAccount}
        </div>
        <div className="flex-1"></div>
        <div className="pixel text-[9px] tracking-[0.16em] text-ink-faint">
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}

type NavLinkProps = {
  href: string;
  /** Activo también en las subrutas (p. ej. /games/apila para /games). */
  prefix?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

// Enlace de la nav que se marca activo según la ruta. Con Cache Components,
// usePathname() se suspende en rutas con params desconocidos al prerenderizar
// (p. ej. /games/[id]); el <Suspense> deja el enlace sin marcar en el shell
// estático y la marca llega en cuanto se conoce la ruta.
export function NavLink(props: NavLinkProps) {
  return (
    <Suspense fallback={<PlainLink {...props} />}>
      <ActiveLink {...props} />
    </Suspense>
  );
}

function ActiveLink(props: NavLinkProps) {
  const pathname = usePathname();
  const active =
    pathname === props.href ||
    (props.prefix && pathname.startsWith(props.href + "/"));
  return <PlainLink {...props} active={active} />;
}

function PlainLink({
  href,
  onClick,
  children,
  active = false,
}: NavLinkProps & { active?: boolean }) {
  return (
    <Link href={href} className={active ? "active" : ""} onClick={onClick}>
      {children}
    </Link>
  );
}
