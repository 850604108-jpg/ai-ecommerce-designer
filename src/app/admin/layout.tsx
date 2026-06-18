import Link from "next/link";
import { BarChart3, CreditCard, Database, FolderKanban, LayoutTemplate, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const adminNavigation = [
  { href: "/admin#stats", icon: BarChart3, label: "统计面板" },
  { href: "/admin#users", icon: Users, label: "用户管理" },
  { href: "/admin#projects", icon: FolderKanban, label: "项目管理" },
  { href: "/admin#payments", icon: CreditCard, label: "支付管理" },
  { href: "/admin#credits", icon: Database, label: "积分管理" },
  { href: "/admin/templates", icon: LayoutTemplate, label: "模板管理" },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Admin Panel
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            管理后台
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            当前管理员：{admin.email || admin.id}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {adminNavigation.map((item) => {
            const Icon = item.icon;

            return (
              <Button asChild key={item.href} size="sm" variant="outline">
                <Link href={item.href}>
                  <Icon aria-hidden="true" />
                  {item.label}
                </Link>
              </Button>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
