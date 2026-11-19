"use server";

import { Resend } from "resend";

export type ContactState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "sent"; name: string }
  | { status: "error" };

const LIMITS = { name: 60, email: 254, msg: 2000 } as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const field = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

// Endpoint público: todo lo que llega en formData es entrada no confiable.
export async function sendContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const name = field(formData, "name");
  const email = field(formData, "email");
  const msg = field(formData, "msg");
  const website = field(formData, "website");

  if (
    !name || name.length > LIMITS.name ||
    !email || email.length > LIMITS.email || !EMAIL_RE.test(email) ||
    !msg || msg.length > LIMITS.msg
  ) {
    return { status: "invalid" };
  }

  // Honeypot relleno: éxito falso para no dar señal al bot.
  if (website) return { status: "sent", name };

  const { RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !CONTACT_TO_EMAIL || !CONTACT_FROM_EMAIL) {
    console.error("[contact] Faltan variables de entorno: RESEND_API_KEY, CONTACT_TO_EMAIL o CONTACT_FROM_EMAIL.");
    return { status: "error" };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: CONTACT_FROM_EMAIL,
      to: CONTACT_TO_EMAIL,
      replyTo: email,
      subject: `[ARCADE VAULT] Mensaje de ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${msg}\n`,
    });
    if (error) {
      console.error("[contact] Resend devolvió un error:", error);
      return { status: "error" };
    }
  } catch (err) {
    console.error("[contact] Fallo al llamar a Resend:", err);
    return { status: "error" };
  }

  return { status: "sent", name };
}
