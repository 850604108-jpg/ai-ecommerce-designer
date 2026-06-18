import Link from "next/link";

import { DailyCheckInButton } from "@/components/account/daily-check-in-button";
import { Button } from "@/components/ui/button";
import {
  dailyCheckInCredits,
  getDailyCheckInStatus,
  getUserCreditBalance,
} from "@/lib/credits";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabaseClient";

export default async function AccountPage() {
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
          Settings
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Account</h1>
      </div>

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
          <div className="rounded-lg border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-medium">每日签到</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  每天可领取 {dailyCheckInCredits} 积分，用于生成图片。
                </p>
              </div>
              <DailyCheckInButton
                checkedIn={Boolean(checkInStatus?.checkedIn)}
                credits={dailyCheckInCredits}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-base font-medium">积分流水</h2>
            {credits?.data?.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">类型</th>
                      <th className="py-2 pr-4 font-medium">变动</th>
                      <th className="py-2 pr-4 font-medium">余额</th>
                      <th className="py-2 pr-4 font-medium">说明</th>
                      <th className="py-2 pr-4 font-medium">时间</th>
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
                          ? "每日签到"
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
                          {new Date(credit.created_at).toLocaleString()}
                        </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                暂无积分流水，完成首次签到后会显示在这里。
              </p>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
