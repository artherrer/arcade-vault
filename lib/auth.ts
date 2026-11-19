import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = { id: string; username: string };

// Una sola lectura por petición, aunque varios componentes la pidan.
export const getCurrentProfile = cache(
  async (): Promise<CurrentProfile | null> => {
    // La sesión es siempre de la petición: nunca se prerenderiza (getClaims usa
    // Date.now() para comprobar la caducidad del JWT).
    await connection();
    const supabase = await createClient();

    // getClaims() verifica el JWT; no se confía en la cookie tal cual.
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims.sub;
    if (!userId) return null;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[auth] getCurrentProfile:", error);
      return null;
    }
    return profile;
  },
);
