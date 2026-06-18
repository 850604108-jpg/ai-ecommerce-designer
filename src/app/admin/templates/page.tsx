import Link from "next/link";

import { TemplateAdmin } from "@/components/templates/template-admin";
import { Button } from "@/components/ui/button";

export default function AdminTemplatesPage() {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            后台管理模板
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            管理模板分类、提示词、预览和上下架状态。当前数据保存在浏览器本地，便于快速验证后台流程。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/templates">返回模板市场</Link>
        </Button>
      </div>
      <TemplateAdmin />
    </section>
  );
}
