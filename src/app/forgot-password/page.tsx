import Link from "next/link";

import { requestPasswordReset } from "@/app/auth/actions";
import { AuthMessage, getAuthMessage } from "@/app/auth/auth-message";
import { Button } from "@/components/ui/button";

type ForgotPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const { error, message } = await getAuthMessage(searchParams);

  return (
    <section className="mx-auto grid max-w-md gap-6 py-8">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Account recovery
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Enter your email and we will send a password reset link.
        </p>
      </div>

      <form action={requestPasswordReset} className="space-y-4 rounded-lg border bg-card p-6">
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
        <Button className="w-full" type="submit">
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link className="font-medium text-foreground" href="/login">
          Back to login
        </Link>
      </p>
    </section>
  );
}
