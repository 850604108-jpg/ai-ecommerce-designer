import { Mail } from "lucide-react";
import Link from "next/link";

import { signInWithGoogle, signUp } from "@/app/auth/actions";
import { AuthMessage, getAuthMessage } from "@/app/auth/auth-message";
import { Button } from "@/components/ui/button";

type RegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const { error, message } = await getAuthMessage(searchParams);

  return (
    <section className="mx-auto grid max-w-md gap-6 py-8">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Get started
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Create account</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Register with email or use your Google account.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <form action={signInWithGoogle}>
          <Button className="w-full" type="submit" variant="outline">
            <Mail aria-hidden="true" />
            Continue with Google
          </Button>
        </form>

        <div className="my-6 h-px bg-border" />

        <form action={signUp} className="space-y-4">
          <AuthMessage error={error} message={message} />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
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
              Password
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
            Create account
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="font-medium text-foreground" href="/login">
          Log in
        </Link>
      </p>
    </section>
  );
}
