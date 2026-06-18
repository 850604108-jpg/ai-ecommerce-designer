type AuthMessageProps = {
  error?: string;
  message?: string;
};

export function AuthMessage({ error, message }: AuthMessageProps) {
  const text = error ?? message;

  if (!text) {
    return null;
  }

  return (
    <p
      className={
        error
          ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground"
      }
    >
      {text}
    </p>
  );
}

export async function getAuthMessage(
  searchParams?: Promise<Record<string, string | string[] | undefined>>,
) {
  const params = searchParams ? await searchParams : {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const message = Array.isArray(params.message)
    ? params.message[0]
    : params.message;

  return { error, message };
}
