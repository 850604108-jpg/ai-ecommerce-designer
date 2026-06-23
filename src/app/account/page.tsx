import Link from "next/link";

import { DailyCheckInButton } from "@/components/account/daily-check-in-button";
import { Button } from "@/components/ui/button";
import {
  dailyCheckInCredits,
  getDailyCheckInStatus,
  getUserCreditBalance,
} from "@/lib/credits";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabaseClient";

export default async function AccountPage() {
  const language = await getCurrentLanguage();
  const dictionary = getDictionary(language);
  const supabase = isSupabaseConfigured() ? await supabaseServer() : null;
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const creditBalance =
    supabase && user ? await getUserCreditBalance(supabase, user.id) : null;
  const checkInStatus = user ? await getDailyCheckInStatus(user.id) : null;
  const credits =
    supabase && user
      ? await supabase
          .from("credits")
          .select("id,transaction_type,amount,balance_after,metadata,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12)
      : null;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {dictionary.accountPage.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {dictionary.accountPage.title}
        </h1>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-base font-medium">
          {dictionary.accountPage.details}
        </h2>
        {user ? (
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="font-medium">{dictionary.accountPage.email}</dt>
              <dd className="mt-1 text-muted-foreground">{user.email}</dd>
            </div>
            <div>
              <dt className="font-medium">{dictionary.accountPage.userId}</dt>
              <dd className="mt-1 break-all text-muted-foreground">
                {user.id}
              </dd>
            </div>
            <div>
              <dt className="font-medium">{dictionary.common.credits}</dt>
              <dd className="mt-1 text-muted-foreground">
                {creditBalance ?? 0}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {dictionary.accountPage.loginDescription}
            </p>
            <Button asChild>
              <Link href="/login">{dictionary.auth.login}</Link>
            </Button>
          </div>
        )}
      </div>

      {user ? (
        <>
          <div className="rounded-lg border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-medium">
                  {dictionary.accountPage.checkIn}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {dictionary.accountPage.checkInDescription(
                    dailyCheckInCredits,
                  )}
                </p>
              </div>
              <DailyCheckInButton
                checkedIn={Boolean(checkInStatus?.checkedIn)}
                credits={dailyCheckInCredits}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-base font-medium">
              {dictionary.accountPage.creditHistory}
            </h2>
            {credits?.data?.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">
                        {dictionary.accountPage.transactionType}
                      </th>
                      <th className="py-2 pr-4 font-medium">
                        {dictionary.common.credits}
                      </th>
                      <th className="py-2 pr-4 font-medium">
                        {dictionary.accountPage.balance}
                      </th>
                      <th className="py-2 pr-4 font-medium">
                        {dictionary.accountPage.note}
                      </th>
                      <th className="py-2 pr-4 font-medium">
                        {dictionary.accountPage.time}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {credits.data.map((credit) => {
                      const metadata = (credit.metadata || {}) as Record<
                        string,
                        unknown
                      >;
                      const source =
                        metadata.source === "daily_check_in"
                          ? dictionary.accountPage.checkIn
                          : metadata.reason || metadata.image_type || "-";

                      return (
                        <tr key={credit.id}>
                          <td className="py-3 pr-4 capitalize">
                            {credit.transaction_type}
                          </td>
                          <td className="py-3 pr-4">
                            {credit.amount > 0 ? "+" : ""}
                            {credit.amount}
                          </td>
                          <td className="py-3 pr-4">
                            {credit.balance_after}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {String(source)}
                          </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {new Date(credit.created_at).toLocaleString(
                            language === "zh" ? "zh-CN" : "en-US",
                          )}
                        </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {dictionary.accountPage.creditHistoryEmpty}
              </p>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
