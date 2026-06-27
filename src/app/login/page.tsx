import Link from "next/link";

import { signInWithEmail } from "@/app/auth/actions";
import { AuthMessage, getAuthMessage } from "@/app/auth/auth-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await getAuthMessage(searchParams);
  const dictionary = getDictionary(await getCurrentLanguage());

  return (
    <section className="mx-auto grid max-w-md gap-6 py-8">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {dictionary.auth.loginEyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {dictionary.auth.login}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {dictionary.auth.loginDescription}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <form action={signInWithEmail} className="space-y-4">
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
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium" htmlFor="password">
                {dictionary.auth.password}
              </label>
              <Link
                className="text-sm text-muted-foreground hover:text-foreground"
                href="/forgot-password"
              >
                {dictionary.auth.forgotPassword}
              </Link>
            </div>
            <input
              autoComplete="current-password"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              id="password"
              name="password"
              required
              type="password"
            />
          </div>
          <SubmitButton className="w-full" pendingLabel={dictionary.common.processing}>
            {dictionary.auth.login}
          </SubmitButton>
        </form>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {dictionary.auth.noAccount}{" "}
        <Link className="font-medium text-foreground" href="/register">
          {dictionary.auth.createAccount}
        </Link>
      </p>
    </section>
  );
}
