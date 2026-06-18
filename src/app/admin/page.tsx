import Link from "next/link";
import {
  BadgeDollarSign,
  CreditCard,
  Database,
  FolderKanban,
  LayoutTemplate,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAdminDashboardData } from "@/lib/admin";
import { cn } from "@/lib/utils";

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCurrency(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(amountCents / 100);
}

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-md bg-secondary p-3 text-muted-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-1 text-xs font-medium",
        tone === "success" && "bg-green-50 text-green-700",
        tone === "warning" && "bg-yellow-50 text-yellow-800",
        tone === "neutral" && "bg-secondary text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function Section({
  action,
  children,
  description,
  id,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description: string;
  id: string;
  title: string;
}) {
  return (
    <section className="rounded-md border bg-card" id={id}>
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default async function AdminPage() {
  const { credits, payments, projects, stats, templates, userEmails, users } =
    await getAdminDashboardData();

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" id="stats">
        <StatCard
          icon={Users}
          label="用户总数"
          value={String(stats.totalUsers)}
          helper={`${stats.adminUsers} 个管理员账户`}
        />
        <StatCard
          icon={FolderKanban}
          label="项目总数"
          value={String(stats.totalProjects)}
          helper={`${stats.activeProjects} 个活跃项目`}
        />
        <StatCard
          icon={BadgeDollarSign}
          label="成功收入"
          value={formatCurrency(stats.totalRevenueCents, "CNY")}
          helper={`${stats.succeededPayments}/${stats.totalPayments} 笔支付成功`}
        />
        <StatCard
          icon={Database}
          label="积分发放"
          value={String(stats.creditsGranted)}
          helper={`${stats.creditsSpent} 积分已消耗或扣减`}
        />
        <StatCard
          icon={LayoutTemplate}
          label="模板总数"
          value={String(stats.totalTemplates)}
          helper={`${stats.activeTemplates} 个模板启用中`}
        />
        <StatCard
          icon={CreditCard}
          label="支付记录"
          value={String(stats.totalPayments)}
          helper="包含支付宝、手动和其他支付来源"
        />
      </section>

      <Section
        description="查看最近注册用户、角色和资料更新时间。"
        id="users"
        title="用户管理"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">用户</th>
                <th className="py-2 pr-4 font-medium">角色</th>
                <th className="py-2 pr-4 font-medium">姓名</th>
                <th className="py-2 pr-4 font-medium">注册时间</th>
                <th className="py-2 pr-4 font-medium">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{user.email}</div>
                    <div className="mt-1 max-w-[260px] truncate text-xs text-muted-foreground">
                      {user.id}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge tone={user.role === "admin" ? "success" : "neutral"}>
                      {user.role}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {user.full_name || "-"}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(user.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        description="跟踪最近创建的项目、所属用户和当前状态。"
        id="projects"
        title="项目管理"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">项目</th>
                <th className="py-2 pr-4 font-medium">用户</th>
                <th className="py-2 pr-4 font-medium">状态</th>
                <th className="py-2 pr-4 font-medium">创建时间</th>
                <th className="py-2 pr-4 font-medium">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {projects.map((project) => (
                <tr key={project.id}>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{project.name}</div>
                    <div className="mt-1 max-w-[260px] truncate text-xs text-muted-foreground">
                      {project.id}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {userEmails[project.user_id] || project.user_id}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge
                      tone={project.status === "active" ? "success" : "neutral"}
                    >
                      {project.status}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(project.created_at)}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(project.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        description="查看最近支付、购买积分数量和支付状态。"
        id="payments"
        title="支付管理"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">支付</th>
                <th className="py-2 pr-4 font-medium">用户</th>
                <th className="py-2 pr-4 font-medium">状态</th>
                <th className="py-2 pr-4 font-medium">金额</th>
                <th className="py-2 pr-4 font-medium">积分</th>
                <th className="py-2 pr-4 font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{payment.provider}</div>
                    <div className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">
                      {payment.id}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {userEmails[payment.user_id] || payment.user_id}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge
                      tone={
                        payment.status === "succeeded" ? "success" : "warning"
                      }
                    >
                      {payment.status}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4">
                    {formatCurrency(payment.amount_cents, payment.currency)}
                  </td>
                  <td className="py-3 pr-4">{payment.credits_purchased}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(payment.paid_at || payment.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        description="审计最近积分发放、消费、退款和调整记录。"
        id="credits"
        title="积分管理"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">用户</th>
                <th className="py-2 pr-4 font-medium">类型</th>
                <th className="py-2 pr-4 font-medium">变动</th>
                <th className="py-2 pr-4 font-medium">变动后余额</th>
                <th className="py-2 pr-4 font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {credits.map((credit) => (
                <tr key={credit.id}>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {userEmails[credit.user_id] || credit.user_id}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge
                      tone={credit.amount > 0 ? "success" : "warning"}
                    >
                      {credit.transaction_type}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4 font-medium">
                    {credit.amount > 0 ? "+" : ""}
                    {credit.amount}
                  </td>
                  <td className="py-3 pr-4">{credit.balance_after}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(credit.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/templates">打开模板编辑</Link>
          </Button>
        }
        description="查看数据库模板状态，并进入模板编辑器维护前台模板。"
        id="templates"
        title="模板管理"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">模板</th>
                <th className="py-2 pr-4 font-medium">分类</th>
                <th className="py-2 pr-4 font-medium">可见性</th>
                <th className="py-2 pr-4 font-medium">积分成本</th>
                <th className="py-2 pr-4 font-medium">状态</th>
                <th className="py-2 pr-4 font-medium">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {templates.map((template) => (
                <tr key={template.id}>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{template.name}</div>
                    <div className="mt-1 max-w-[240px] truncate text-xs text-muted-foreground">
                      {template.slug}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {template.category || "-"}
                  </td>
                  <td className="py-3 pr-4">{template.visibility}</td>
                  <td className="py-3 pr-4">{template.credit_cost}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge tone={template.is_active ? "success" : "neutral"}>
                      {template.is_active ? "active" : "inactive"}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(template.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
