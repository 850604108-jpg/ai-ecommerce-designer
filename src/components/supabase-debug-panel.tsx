"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type SupabaseBucketStatus = {
  created: boolean;
  error: string | null;
  exists: boolean;
  name: string;
};

type SupabaseStatusPayload = {
  connected: boolean;
  status: {
    anonKeyConfigured: boolean;
    buckets: SupabaseBucketStatus[];
    checkedAt: string;
    database: {
      error: string | null;
      ok: boolean;
    };
    serviceRoleConfigured: boolean;
    supabaseUrl: string | null;
    supabaseUrlValid: boolean;
  };
};

type PanelState =
  | { error: string; loading: false; payload: null }
  | { error: ""; loading: false; payload: SupabaseStatusPayload }
  | { error: ""; loading: true; payload: null };

export function SupabaseDebugPanel() {
  const [state, setState] = useState<PanelState>({
    error: "",
    loading: true,
    payload: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      try {
        const response = await fetch("/api/supabase/status", {
          cache: "no-store",
        });
        const payload = (await response.json()) as SupabaseStatusPayload;

        if (isMounted) {
          setState({ error: "", loading: false, payload });
        }
      } catch (error) {
        if (isMounted) {
          setState({
            error:
              error instanceof Error
                ? error.message
                : "Failed to load Supabase status.",
            loading: false,
            payload: null,
          });
        }
      }
    }

    void loadStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const connected = state.payload?.connected ?? false;

  return (
    <section className="rounded-md border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Supabase Debug Panel</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Runtime connection, credentials, and storage bucket status.
          </p>
        </div>
        <div
          className={
            connected
              ? "inline-flex items-center gap-2 rounded-md border border-green-600/30 bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
              : "inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive"
          }
        >
          {state.loading ? (
            <Loader2 aria-hidden="true" className="size-3 animate-spin" />
          ) : connected ? (
            <CheckCircle2 aria-hidden="true" className="size-3" />
          ) : (
            <XCircle aria-hidden="true" className="size-3" />
          )}
          {state.loading ? "Checking" : connected ? "Connected" : "Not connected"}
        </div>
      </div>

      {state.error ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {state.payload ? (
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <StatusRow
            label="Supabase URL"
            ok={state.payload.status.supabaseUrlValid}
            value={state.payload.status.supabaseUrl || "Missing"}
          />
          <StatusRow
            label="Anon key"
            ok={state.payload.status.anonKeyConfigured}
            value={state.payload.status.anonKeyConfigured ? "Configured" : "Missing"}
          />
          <StatusRow
            label="Service role"
            ok={state.payload.status.serviceRoleConfigured}
            value={
              state.payload.status.serviceRoleConfigured ? "Configured" : "Missing"
            }
          />
          <StatusRow
            label="Database"
            ok={state.payload.status.database.ok}
            value={state.payload.status.database.error || "Reachable"}
          />
          {state.payload.status.buckets.map((bucket) => (
            <StatusRow
              key={bucket.name}
              label={`Bucket: ${bucket.name}`}
              ok={bucket.exists && !bucket.error}
              value={
                bucket.error
                  ? bucket.error
                  : bucket.created
                    ? "Created"
                    : "Exists"
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StatusRow({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 rounded-md bg-secondary p-3">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span
        className={
          ok
            ? "min-w-0 break-words text-right text-xs text-green-700"
            : "min-w-0 break-words text-right text-xs text-destructive"
        }
      >
        {value}
      </span>
    </div>
  );
}
