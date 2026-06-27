import Link from "next/link";
import { Coins, Sparkles } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { Button } from "@/components/ui/button";
import { getUserCreditBalance } from "@/lib/credits";
import { getDictionary, type Language } from "@/lib/i18n";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabaseClient";

export async function SiteHeader({ language }: { language: Language }) {
  const dictionary = getDictionary(language);
  const navigation = [
    { href: "/", label: dictionary.header.navigation.home },
    { href: "/dashboard", label: dictionary.header.navigation.dashboard },
    { href: "/generate", label: dictionary.header.navigation.generate },
    { href: "/templates", label: dictionary.header.navigation.templates },
  ];
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
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/82 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <Link
          className="group inline-flex items-center gap-2 text-sm font-semibold tracking-wide"
          href="/"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-rotate-3 group-hover:scale-105">
            <Sparkles aria-hidden="true" className="size-4" />
          </span>
          <span>AI Ecommerce Designer</span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto pb-1 lg:overflow-visible lg:pb-0">
          {navigation.map((item) => (
            <Button asChild key={item.href} size="sm" variant="ghost">
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
          {user ? (
            <>
              <span className="hidden h-9 items-center gap-1.5 rounded-md border border-border/80 bg-card/80 px-3 text-xs font-semibold text-muted-foreground shadow-sm sm:inline-flex">
                <Coins aria-hidden="true" className="size-3.5 text-[var(--signal-cyan)]" />
                {dictionary.header.credits}: {creditBalance === null ? "--" : creditBalance}
              </span>
              <Button asChild size="sm" variant="ghost">
                <Link href="/account">{dictionary.header.account}</Link>
              </Button>
              {isAdmin ? (
                <Button asChild size="sm" variant="ghost">
                  <Link href="/admin">{dictionary.account.admin}</Link>
                </Button>
              ) : null}
              <form action={signOut}>
                <Button size="sm" type="submit" variant="ghost">
                  {dictionary.account.signOut}
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href="/login">{dictionary.account.login}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{dictionary.account.register}</Link>
              </Button>
            </>
          )}
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}
