import { updatePassword } from "@/app/auth/actions";
import { AuthMessage, getAuthMessage } from "@/app/auth/auth-message";
import { Button } from "@/components/ui/button";

type ResetPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { error, message } = await getAuthMessage(searchParams);

  return (
    <section className="mx-auto grid max-w-md gap-6 py-8">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Choose new password
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Update password</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Set a new password for your account.
        </p>
      </div>

      <form action={updatePassword} className="space-y-4 rounded-lg border bg-card p-6">
        <AuthMessage error={error} message={message} />
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            New password
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
          Update password
        </Button>
      </form>
    </section>
  );
}
