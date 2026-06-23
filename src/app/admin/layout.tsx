import Link from "next/link";
import { BarChart3, CreditCard, Database, FolderKanban, LayoutTemplate, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const dictionary = getDictionary(await getCurrentLanguage());
  const admin = await requireAdmin();
  const adminNavigation = [
    { href: "/admin#stats", icon: BarChart3, label: dictionary.admin.nav.stats },
    { href: "/admin#users", icon: Users, label: dictionary.admin.nav.users },
    {
      href: "/admin#projects",
      icon: FolderKanban,
      label: dictionary.admin.nav.projects,
    },
    {
      href: "/admin#payments",
      icon: CreditCard,
      label: dictionary.admin.nav.payments,
    },
    {
      href: "/admin#credits",
      icon: Database,
      label: dictionary.admin.nav.credits,
    },
    {
      href: "/admin/templates",
      icon: LayoutTemplate,
      label: dictionary.admin.nav.templates,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {dictionary.admin.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {dictionary.admin.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {dictionary.admin.currentAdmin(admin.email || admin.id)}
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
