import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SupabaseDebugPanel } from "@/components/supabase-debug-panel";

export default function HomePage() {
  return (
    <section className="grid gap-8 py-16">
      <div className="max-w-2xl space-y-5">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          AI Ecommerce Creative Suite
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Turn one product photo into marketplace-ready ecommerce assets.
        </h1>
        <p className="text-lg leading-8 text-muted-foreground">
          Upload a product image, recognize selling points, generate platform
          prompts, create AI product visuals, and manage credits in one focused
          workflow.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard">
            Open Dashboard
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/generate">Go to Generate</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/templates">Explore Templates</Link>
        </Button>
      </div>
      <SupabaseDebugPanel />
    </section>
  );
}
