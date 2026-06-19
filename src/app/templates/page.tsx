import { TemplateMarketplace } from "@/components/templates/template-marketplace";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";

export default async function TemplatesPage() {
  const dictionary = getDictionary(await getCurrentLanguage());

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Template Marketplace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {dictionary.templates.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {dictionary.templates.description}
          </p>
        </div>
      </div>
      <TemplateMarketplace />
    </section>
  );
}
