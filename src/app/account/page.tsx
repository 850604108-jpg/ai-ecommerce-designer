import Link from "next/link";

import { CheckoutButton } from "@/components/billing/checkout-button";
import { Button } from "@/components/ui/button";
import { getUserCreditBalance } from "@/lib/credits";
import { creditPacks } from "@/lib/alipay";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabaseClient";

type AccountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getCheckoutStatus(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const value = searchParams.checkout;

  return Array.isArray(value) ? value[0] : value;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = (await searchParams) || {};
  const checkoutStatus = getCheckoutStatus(params);
  const supabase = isSupabaseConfigured() ? await supabaseServer() : null;
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const creditBalance =
    supabase && user ? await getUserCreditBalance(supabase, user.id) : null;
  const payments =
    supabase && user
      ? await supabase
          .from("payments")
          .select(
            "id,status,amount_cents,currency,credits_purchased,paid_at,created_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8)
      : null;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Account</h1>
      </div>

      {checkoutStatus === "success" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Payment submitted. Credits will update after Alipay confirms payment.
        </div>
      ) : null}

      {checkoutStatus === "cancelled" ? (
        <div className="rounded-lg border bg-muted p-4 text-sm text-muted-foreground">
          Checkout cancelled.
        </div>
      ) : null}

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-base font-medium">Account details</h2>
        {user ? (
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="font-medium">Email</dt>
              <dd className="mt-1 text-muted-foreground">{user.email}</dd>
            </div>
            <div>
              <dt className="font-medium">User ID</dt>
              <dd className="mt-1 break-all text-muted-foreground">
                {user.id}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Credits</dt>
              <dd className="mt-1 text-muted-foreground">
                {creditBalance ?? 0}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Log in to view your account details.
            </p>
            <Button asChild>
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        )}
      </div>

      {user ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {creditPacks.map((pack) => (
              <div className="rounded-lg border bg-card p-6" key={pack.code}>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">{pack.name}</h2>
                  <p className="text-3xl font-semibold">{pack.credits}</p>
                  <p className="text-sm text-muted-foreground">Credits</p>
                </div>
                <div className="mt-6">
                  <CheckoutButton pack={pack.code} />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-base font-medium">Payment records</h2>
            {payments?.data?.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Credits</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 pr-4 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payments.data.map((payment) => (
                      <tr key={payment.id}>
                        <td className="py-3 pr-4 capitalize">
                          {payment.status}
                        </td>
                        <td className="py-3 pr-4">
                          {payment.credits_purchased}
                        </td>
                        <td className="py-3 pr-4">
                          {(payment.amount_cents / 100).toFixed(2)}{" "}
                          {payment.currency}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {new Date(
                            payment.paid_at || payment.created_at,
                          ).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No payment records yet.
              </p>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
