import { TemplateMarketplace } from "@/components/templates/template-marketplace";

export default function TemplatesPage() {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Template Marketplace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            模板市场
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            按电子产品、服饰、家居、美妆、宠物分类浏览模板，预览效果后收藏或直接用于生成流程。
          </p>
        </div>
      </div>
      <TemplateMarketplace />
    </section>
  );
}
