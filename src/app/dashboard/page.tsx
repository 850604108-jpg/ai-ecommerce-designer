import Link from "next/link";
import type { Metadata } from "next";

import { HistoryDashboard } from "@/components/dashboard/history-dashboard";
import { Button } from "@/components/ui/button";
import { getUserCreditBalance } from "@/lib/credits";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { listImageGenerationHistory } from "@/lib/image-generation/jobs";
import { listDashboardProjects } from "@/lib/projects";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabaseClient";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  description:
    "Review generated ecommerce images, projects, credits, prompts, and regeneration history.",
  robots: {
    follow: false,
    index: false,
  },
  title: "Dashboard",
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = (await searchParams) || {};
  const language = await getCurrentLanguage();
  const dictionary = getDictionary(language);
  const search = getParam(params, "q").trim();
  const imagePage = Math.max(
    Number.parseInt(getParam(params, "imagePage"), 10) || 1,
    1,
  );
  const projectPage = Math.max(
    Number.parseInt(getParam(params, "projectPage"), 10) || 1,
    1,
  );
  const supabase = isSupabaseConfigured() ? await supabaseServer() : null;
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  let dashboardData:
    | {
        creditBalance: number | null;
        history: Awaited<ReturnType<typeof listImageGenerationHistory>>;
        projects: Awaited<ReturnType<typeof listDashboardProjects>>;
      }
    | null = null;
  let dashboardError = "";

  if (supabase && user) {
    try {
      const [projects, history, creditBalance] = await Promise.all([
        listDashboardProjects({
          supabase,
          userId: user.id,
          search,
          page: projectPage,
          pageSize: 6,
        }),
        listImageGenerationHistory({
          supabase,
          userId: user.id,
          search,
          page: imagePage,
          pageSize: 8,
        }),
        getUserCreditBalance(supabase, user.id),
      ]);

      dashboardData = { creditBalance, history, projects };
    } catch (error) {
      dashboardError =
        error instanceof Error ? error.message : dictionary.dashboard.loadFailedMessage;
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          History
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {dictionary.dashboard.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {dictionary.dashboard.description}
        </p>
      </div>

      {dashboardData ? (
        <HistoryDashboard
          creditBalance={dashboardData.creditBalance}
          errorMessage={dashboardError}
          imagePage={dashboardData.history.page}
          imagePageCount={dashboardData.history.pageCount}
          imageTotalCount={dashboardData.history.totalCount}
          jobs={dashboardData.history.jobs}
          projectPage={dashboardData.projects.page}
          projectPageCount={dashboardData.projects.pageCount}
          projectTotalCount={dashboardData.projects.totalCount}
          projects={dashboardData.projects.projects}
          language={language}
          search={search}
        />
      ) : dashboardError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6">
          <h2 className="text-base font-medium text-destructive">
            {dictionary.dashboard.loadFailed}
          </h2>
          <p className="mt-2 text-sm text-destructive">{dashboardError}</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-base font-medium">
            {dictionary.dashboard.loginRequired}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {dictionary.dashboard.loginRequiredDescription}
          </p>
          <Button asChild className="mt-4">
            <Link href="/login">{dictionary.dashboard.login}</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
