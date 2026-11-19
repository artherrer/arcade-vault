import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { getCurrentProfile } from "@/lib/auth";
import { NavLink } from "@/components/nav";

type Variant = "desktop" | "mobile";

// Estado de sesión de la nav. Lee la sesión en tiempo de petición, así que
// siempre se renderiza dentro de <Suspense> (ver app/layout.tsx).
export async function NavAccount({ variant }: { variant: Variant }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return variant === "desktop" ? (
      <Link href="/login" className="btn auth-btn">
        Iniciar Sesión
      </Link>
    ) : (
      <NavLink href="/login">Iniciar Sesión</NavLink>
    );
  }

  return (
    <div className={`nav-player ${variant}`}>
      <span className="nav-player-chip">
        <span className="nav-player-caret">▸</span> {profile.username.toUpperCase()}
      </span>
      <form action={signOut}>
        <button type="submit" className="btn ghost nav-player-exit">
          SALIR
        </button>
      </form>
    </div>
  );
}

// Ocupa el mismo sitio que NavAccount mientras se resuelve la sesión, para no
// mostrar «Iniciar Sesión» un instante a quien ya tiene sesión.
export function NavAccountPlaceholder({ variant }: { variant: Variant }) {
  return variant === "desktop" ? (
    <span className="btn auth-btn nav-account-placeholder" aria-hidden="true">
      Iniciar Sesión
    </span>
  ) : (
    <div className="nav-account-placeholder mobile" aria-hidden="true" />
  );
}
