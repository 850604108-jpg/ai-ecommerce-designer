import Link from "next/link";

import { signUp } from "@/app/auth/actions";
import { AuthMessage, getAuthMessage } from "@/app/auth/auth-message";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";

type RegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const { error, message } = await getAuthMessage(searchParams);
  const dictionary = getDictionary(await getCurrentLanguage());

  return (
    <section className="mx-auto grid max-w-md gap-6 py-8">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {dictionary.auth.registerEyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {dictionary.auth.createAccount}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {dictionary.auth.registerDescription}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <form action={signUp} className="space-y-4">
          <AuthMessage error={error} message={message} />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              {dictionary.auth.email}
            </label>
            <input
              autoComplete="email"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              id="email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              {dictionary.auth.password}
            </label>
            <input
              autoComplete="new-password"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              id="password"
              minLength={6}
              name="password"
              required
              type="password"
            />
          </div>
          <Button className="w-full" type="submit">
            {dictionary.auth.createAccount}
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {dictionary.auth.alreadyHaveAccount}{" "}
        <Link className="font-medium text-foreground" href="/login">
          {dictionary.auth.login}
        </Link>
      </p>
    </section>
  );
}
