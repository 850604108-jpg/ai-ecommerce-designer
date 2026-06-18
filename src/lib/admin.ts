import { notFound, redirect } from "next/navigation";

import {
  supabaseServer,
  supabaseServiceRole,
  isSupabaseConfigured,
} from "@/lib/supabaseClient";

type AdminUser = {
  id: string;
  email: string | null;
};

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
};

type ProjectRow = {
  id: string;
  user_id: string;
  template_id: string | null;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type PaymentRow = {
  id: string;
  user_id: string;
  provider: string;
  status: string;
  amount_cents: number;
  currency: string;
  credits_purchased: number;
  paid_at: string | null;
  created_at: string;
};

type CreditRow = {
  id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  created_at: string;
};

type TemplateRow = {
  id: string;
  creator_id: string | null;
  slug: string;
  name: string;
  visibility: string;
  category: string | null;
  credit_cost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

export type AdminDashboardData = {
  users: UserRow[];
  projects: ProjectRow[];
  payments: PaymentRow[];
  credits: CreditRow[];
  templates: TemplateRow[];
  userEmails: Record<string, string>;
  stats: {
    totalUsers: number;
    adminUsers: number;
    totalProjects: number;
    activeProjects: number;
    totalPayments: number;
    succeededPayments: number;
    totalRevenueCents: number;
    creditsGranted: number;
    creditsSpent: number;
    totalTemplates: number;
    activeTemplates: number;
  };
};

async function getCount(result: PromiseLike<CountResult>) {
  const { count, error } = await result;

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

export async function requireAdmin(): Promise<AdminUser> {
  if (!isSupabaseConfigured()) {
    notFound();
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || profile?.role !== "admin") {
    notFound();
  }

  return {
    id: user.id,
    email: user.email || null,
  };
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  await requireAdmin();

  const adminSupabase = supabaseServiceRole();

  const [
    totalUsers,
    adminUsers,
    totalProjects,
    activeProjects,
    totalPayments,
    succeededPayments,
    totalTemplates,
    activeTemplates,
    usersResult,
    projectsResult,
    paymentsResult,
    creditsResult,
    templatesResult,
    revenueResult,
    creditTotalsResult,
  ] = await Promise.all([
    getCount(adminSupabase.from("users").select("*", { count: "exact", head: true })),
    getCount(
      adminSupabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin"),
    ),
    getCount(adminSupabase.from("projects").select("*", { count: "exact", head: true })),
    getCount(
      adminSupabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
    ),
    getCount(adminSupabase.from("payments").select("*", { count: "exact", head: true })),
    getCount(
      adminSupabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("status", "succeeded"),
    ),
    getCount(adminSupabase.from("templates").select("*", { count: "exact", head: true })),
    getCount(
      adminSupabase
        .from("templates")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
    ),
    adminSupabase
      .from("users")
      .select("id,email,full_name,role,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(8),
    adminSupabase
      .from("projects")
      .select("id,user_id,template_id,name,status,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(8),
    adminSupabase
      .from("payments")
      .select("id,user_id,provider,status,amount_cents,currency,credits_purchased,paid_at,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    adminSupabase
      .from("credits")
      .select("id,user_id,transaction_type,amount,balance_after,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    adminSupabase
      .from("templates")
      .select("id,creator_id,slug,name,visibility,category,credit_cost,is_active,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(8),
    adminSupabase
      .from("payments")
      .select("amount_cents")
      .eq("status", "succeeded")
      .limit(1000),
    adminSupabase
      .from("credits")
      .select("transaction_type,amount")
      .limit(1000),
  ]);

  const queryResults = [
    usersResult,
    projectsResult,
    paymentsResult,
    creditsResult,
    templatesResult,
    revenueResult,
    creditTotalsResult,
  ];
  const firstError = queryResults.find((result) => result.error)?.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  const users = (usersResult.data || []) as UserRow[];
  const userEmails = Object.fromEntries(
    users.map((user) => [user.id, user.email || "Unknown user"]),
  );
  const totalRevenueCents = (revenueResult.data || []).reduce(
    (sum, payment) => sum + Number(payment.amount_cents || 0),
    0,
  );
  const creditTotals = (creditTotalsResult.data || []).reduce(
    (totals, credit) => {
      const amount = Number(credit.amount || 0);

      if (amount > 0) {
        totals.creditsGranted += amount;
      } else {
        totals.creditsSpent += Math.abs(amount);
      }

      return totals;
    },
    { creditsGranted: 0, creditsSpent: 0 },
  );

  return {
    users,
    projects: (projectsResult.data || []) as ProjectRow[],
    payments: (paymentsResult.data || []) as PaymentRow[],
    credits: (creditsResult.data || []) as CreditRow[],
    templates: (templatesResult.data || []) as TemplateRow[],
    userEmails,
    stats: {
      totalUsers,
      adminUsers,
      totalProjects,
      activeProjects,
      totalPayments,
      succeededPayments,
      totalRevenueCents,
      creditsGranted: creditTotals.creditsGranted,
      creditsSpent: creditTotals.creditsSpent,
      totalTemplates,
      activeTemplates,
    },
  };
}
