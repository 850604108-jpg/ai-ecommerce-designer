import Link from "next/link";

import { TemplateAdmin } from "@/components/templates/template-admin";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";

export default async function AdminTemplatesPage() {
  const dictionary = getDictionary(await getCurrentLanguage());

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {dictionary.admin.templatesTitle}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {dictionary.admin.templatesDescription}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/templates">{dictionary.admin.templatesBack}</Link>
        </Button>
      </div>
      <TemplateAdmin />
    </section>
  );
}
