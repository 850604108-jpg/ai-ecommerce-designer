"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { supabaseServer, isSupabaseConfigured } from "@/lib/supabaseClient";

function encodedMessage(type: "error" | "message", message: string) {
  return `${type}=${encodeURIComponent(message)}`;
}

async function getOrigin() {
  const headerStore = await headers();
  return headerStore.get("origin") ?? "http://localhost:3000";
}

export async function signUp(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(
      `/register?${encodedMessage(
        "error",
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      )}`,
    );
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await supabaseServer();
  const origin = await getOrigin();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    redirect(`/register?${encodedMessage("error", error.message)}`);
  }

  redirect(
    `/login?${encodedMessage(
      "message",
      "Registration received. Check your email to confirm your account.",
    )}`,
  );
}

export async function signInWithEmail(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(
      `/login?${encodedMessage(
        "error",
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      )}`,
    );
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await supabaseServer();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?${encodedMessage("error", error.message)}`);
  }

  redirect("/dashboard");
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured()) {
    redirect(
      `/login?${encodedMessage(
        "error",
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      )}`,
    );
  }

  const supabase = await supabaseServer();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    redirect(`/login?${encodedMessage("error", error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }

  redirect(`/login?${encodedMessage("error", "Could not start Google login.")}`);
}

export async function requestPasswordReset(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(
      `/forgot-password?${encodedMessage(
        "error",
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      )}`,
    );
  }

  const email = String(formData.get("email") ?? "").trim();
  const supabase = await supabaseServer();
  const origin = await getOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    redirect(`/forgot-password?${encodedMessage("error", error.message)}`);
  }

  redirect(
    `/forgot-password?${encodedMessage(
      "message",
      "Password reset email sent. Check your inbox for the recovery link.",
    )}`,
  );
}

export async function updatePassword(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(
      `/reset-password?${encodedMessage(
        "error",
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      )}`,
    );
  }

  const password = String(formData.get("password") ?? "");
  const supabase = await supabaseServer();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?${encodedMessage("error", error.message)}`);
  }

  redirect(
    `/login?${encodedMessage(
      "message",
      "Password updated. You can now sign in with your new password.",
    )}`,
  );
}

export async function signOut() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = await supabaseServer();

  await supabase.auth.signOut();
  redirect("/login");
}
