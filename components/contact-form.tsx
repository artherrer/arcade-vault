"use client";

import { useActionState, useState, type FormEvent } from "react";
import { sendContact, type ContactState } from "@/app/about/actions";

type Fields = { name: string; email: string; msg: string };

const INITIAL: ContactState = { status: "idle" };

const EMPTY: Fields = { name: "", email: "", msg: "" };

export function ContactForm() {
  const [form, setForm] = useState<Fields>(EMPTY);
  const [state, formAction, pending] = useActionState(sendContact, INITIAL);
  // Cada respuesta de la acción es un objeto nuevo: guardar la última "cerrada"
  // permite volver a Edición sin perder el estado de useActionState.
  const [dismissed, setDismissed] = useState<ContactState>(INITIAL);
  const [clientShake, setClientShake] = useState(false);

  const result = state !== dismissed && (state.status === "sent" || state.status === "error") ? state : null;
  const shake = clientShake || (state.status === "invalid" && state !== dismissed);

  // Validación instantánea en el cliente; cancelar el submit evita llamar a la acción.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!form.name.trim() || !form.email.trim() || !form.msg.trim()) {
      e.preventDefault();
      setClientShake(true);
    }
  };

  const endShake = () => {
    setClientShake(false);
    if (state.status === "invalid") setDismissed(state);
  };

  const sendAnother = () => {
    setForm(EMPTY);
    setDismissed(state);
  };

  return (
    <form
      className={"contact-form" + (shake ? " shake" : "")}
      action={formAction}
      onSubmit={onSubmit}
      onAnimationEnd={endShake}
      noValidate
    >
      {!result ? (
        <>
          <div className="field">
            <label htmlFor="contact-name">NOMBRE</label>
            <input
              id="contact-name"
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="px_kai"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-msg">MENSAJE</label>
            <textarea
              id="contact-msg"
              name="msg"
              rows={5}
              value={form.msg}
              onChange={(e) => setForm({ ...form, msg: e.target.value })}
              placeholder="Cuéntanos qué tienes en mente…"
            ></textarea>
          </div>
          {/* Honeypot: invisible para personas; los bots que lo rellenan se descartan en el servidor. */}
          <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="contact-website">WEBSITE</label>
            <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>
          <button className="btn xl press w-full" type="submit" disabled={pending} aria-busy={pending}>
            {pending ? "▶  TRANSMITIENDO…" : "▶  ENVIAR MENSAJE"}
          </button>
        </>
      ) : (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body" role="status">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
            </div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            {result.status === "sent" ? (
              <div className="line success">
                &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {result.name.toUpperCase()}.
                <span className="caret">_</span>
              </div>
            ) : (
              <div className="line error">
                [ERR] TRANSMISIÓN FALLIDA. INTÉNTALO DE NUEVO EN UNOS MINUTOS.
                <span className="caret">_</span>
              </div>
            )}
            <div className="mt-[18px]">
              {result.status === "sent" ? (
                <button className="btn ghost" type="button" onClick={sendAnother}>
                  ENVIAR OTRO MENSAJE
                </button>
              ) : (
                <button className="btn ghost" type="button" onClick={() => setDismissed(state)}>
                  REINTENTAR
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
