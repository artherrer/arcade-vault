"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  signIn,
  signUp,
  type AuthErrorCode,
  type AuthState,
} from "@/app/login/actions";

const IDLE: AuthState = { status: "idle" };

const ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  missing: "[ERR] COMPLETA TODOS LOS CAMPOS.",
  bad_username: "[ERR] USUARIO: 3–16 CARACTERES, SOLO a-z, 0-9 Y _.",
  bad_email: "[ERR] CORREO NO VÁLIDO.",
  short_password: "[ERR] LA CONTRASEÑA DEBE TENER AL MENOS 8 CARACTERES.",
  username_taken: "[ERR] ESE USUARIO YA ESTÁ EN USO.",
  email_taken: "[ERR] YA EXISTE UNA CUENTA CON ESE CORREO.",
  invalid_credentials: "[ERR] CORREO O CONTRASEÑA INCORRECTOS.",
  unknown: "[ERR] FALLO DEL SISTEMA. INTÉNTALO DE NUEVO.",
};

export function LoginForm() {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [inState, inAction, inPending] = useActionState(signIn, IDLE);
  const [upState, upAction, upPending] = useActionState(signUp, IDLE);

  const isUp = tab === "up";
  const state = isUp ? upState : inState;
  const pending = isUp ? upPending : inPending;

  // Cada respuesta de error es un objeto nuevo: se reinicia el shake en cada una.
  useEffect(() => {
    const card = cardRef.current;
    if (!card || state.status !== "error") return;
    card.classList.remove("shake");
    void card.offsetWidth; // fuerza reflow para que la animación vuelva a empezar
    card.classList.add("shake");
  }, [state]);

  return (
    <div
      ref={cardRef}
      className="auth-card"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName.startsWith("shake")) {
          e.currentTarget.classList.remove("shake");
        }
      }}
    >
      <div className="auth-header">
        <div className="mark"></div>
        <h2 className="neon-cyan">ARCADE VAULT</h2>
        <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-ink-faint">
          ACCESO AL SISTEMA · v2.6
        </div>
      </div>

      <div className="auth-tabs">
        <button
          type="button"
          className={!isUp ? "on" : ""}
          aria-pressed={!isUp}
          onClick={() => setTab("in")}
        >
          INICIAR SESIÓN
        </button>
        <button
          type="button"
          className={isUp ? "on" : ""}
          aria-pressed={isUp}
          onClick={() => setTab("up")}
        >
          CREAR CUENTA
        </button>
      </div>

      {/* noValidate: la validación la hace el servidor y responde con [ERR]. */}
      <form action={isUp ? upAction : inAction} noValidate>
        {isUp && (
          <div className="field slide-in">
            <label htmlFor="auth-user">Usuario</label>
            <input
              id="auth-user"
              name="username"
              autoComplete="username"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="px_kai"
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="auth-email">Correo electrónico</label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jugador@vault.gg"
          />
        </div>
        <div className="field">
          <label htmlFor="auth-pass">Contraseña</label>
          <input
            id="auth-pass"
            name="password"
            type="password"
            autoComplete={isUp ? "new-password" : "current-password"}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button className="btn lg mt-2 w-full" type="submit" disabled={pending}>
          {pending
            ? "▶  CONECTANDO…"
            : isUp
              ? "CREAR Y JUGAR"
              : "ENTRAR AL VAULT"}
        </button>

        <div aria-live="assertive">
          {state.status === "error" && !pending && (
            <p className="auth-error" role="alert">
              {ERROR_MESSAGES[state.code]}
            </p>
          )}
        </div>
      </form>

      <button
        type="button"
        className="btn ghost mt-2.5 w-full"
        onClick={() => router.push("/games")}
      >
        JUGAR COMO INVITADO
      </button>

      <div className="auth-divider">O CONTINÚA CON</div>
      <div className="social">
        <button className="btn ghost" type="button">
          ◆ GOOGLE
        </button>
        <button className="btn ghost" type="button">
          ▣ GITHUB
        </button>
      </div>

      <div className="mt-[18px] text-center text-[11px] tracking-[0.1em] text-ink-faint">
        AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
      </div>
    </div>
  );
}
