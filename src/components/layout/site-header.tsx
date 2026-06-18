import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { getUserCreditBalance } from "@/lib/credits";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabaseClient";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/generate", label: "Generate" },
  { href: "/templates", label: "Templates" },
];

export async function SiteHeader() {
  const supabase = isSupabaseConfigured() ? await supabaseServer() : null;
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const profile =
    supabase && user
      ? await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle()
      : null;
  const isAdmin = profile?.data?.role === "admin";
  const creditBalance =
    supabase && user
      ? await getUserCreditBalance(supabase, user.id).catch(() => null)
      : null;

  return (
    <header className="border-b bg-background/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link className="text-sm font-semibold tracking-wide" href="/">
          AI Ecommerce Designer
        </Link>
        <nav className="flex items-center gap-1">
          {navigation.map((item) => (
            <Button asChild key={item.href} size="sm" variant="ghost">
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
          {user ? (
            <>
              <span className="hidden rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
                Credits: {creditBalance === null ? "--" : creditBalance}
              </span>
              <Button asChild size="sm" variant="ghost">
                <Link href="/account">Account</Link>
              </Button>
              {isAdmin ? (
                <Button asChild size="sm" variant="ghost">
                  <Link href="/admin">Admin</Link>
                </Button>
              ) : null}
              <form action={signOut}>
                <Button size="sm" type="submit" variant="ghost">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
