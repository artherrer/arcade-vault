"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthErrorCode =
  | "missing" // falta algún campo tras trim()
  | "bad_username" // no cumple ^[a-z0-9_]{3,16}$ (tras pasarlo a minúsculas)
  | "bad_email" // no cumple /^[^\s@]+@[^\s@]+\.[^\s@]+$/ o supera 254 caracteres
  | "short_password" // menos de 8 caracteres o más de 72
  | "username_taken" // ya existe en profiles
  | "email_taken" // Supabase devuelve user_already_exists
  | "invalid_credentials" // Supabase devuelve invalid_credentials
  | "unknown"; // cualquier otro error (se registra con console.error)

export type AuthState =
  { status: "idle" } | { status: "error"; code: AuthErrorCode };

const USERNAME_RE = /^[a-z0-9_]{3,16}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function raw(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function field(formData: FormData, name: string): string {
  return raw(formData, name).trim();
}

function fail(code: AuthErrorCode): AuthState {
  return { status: "error", code };
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = field(formData, "email");
  // La contraseña no se recorta: los espacios forman parte de ella.
  const password = raw(formData, "password");
  if (!email || !password.trim()) return fail("missing");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "invalid_credentials")
      return fail("invalid_credentials");
    console.error("[auth] signIn:", error);
    return fail("unknown");
  }

  revalidatePath("/", "layout");
  redirect("/games");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = field(formData, "username").toLowerCase();
  const email = field(formData, "email");
  // La contraseña no se recorta: los espacios forman parte de ella.
  const password = raw(formData, "password");

  if (!username || !email || !password.trim()) return fail("missing");
  if (!USERNAME_RE.test(username)) return fail("bad_username");
  if (email.length > 254 || !EMAIL_RE.test(email)) return fail("bad_email");
  if (password.length < 8 || password.length > 72)
    return fail("short_password");

  const supabase = await createClient();

  // Error claro si el username ya existe. La constraint unique sigue siendo
  // la autoridad si dos registros compiten (ese caso acaba en "unknown").
  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (lookupError) {
    console.error("[auth] signUp lookup:", lookupError);
    return fail("unknown");
  }
  if (existing) return fail("username_taken");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return fail("email_taken");
    }
    console.error("[auth] signUp:", error);
    return fail("unknown");
  }

  revalidatePath("/", "layout");
  redirect("/games");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) console.error("[auth] signOut:", error);

  revalidatePath("/", "layout");
  redirect("/");
}
