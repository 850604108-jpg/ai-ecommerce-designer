import { Suspense } from "react";
import type { Metadata } from "next";
import { ImagePlus, Layers3, WandSparkles } from "lucide-react";

import { ImageUploader } from "@/components/image-uploader";
import { SelectedTemplateBanner } from "@/components/templates/selected-template-banner";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";
import { isSupabaseConfigured, supabaseServer } from "@/lib/supabaseClient";

export const metadata: Metadata = {
  description:
    "Generate marketplace-ready ecommerce product images, prompts, and detail page modules from a product photo.",
  title: "Generate Ecommerce Images",
};

export default async function GeneratePage() {
  const dictionary = getDictionary(await getCurrentLanguage());
  const supabase = isSupabaseConfigured() ? await supabaseServer() : null;
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  return (
    <section className="space-y-6 pb-12">
      <div className="animate-fade-slide-up overflow-hidden rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <WandSparkles
                aria-hidden="true"
                className="size-3.5 text-[var(--signal-cyan)]"
              />
              {dictionary.generate.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {dictionary.generate.title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              {dictionary.generate.description}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[26rem]">
            {[
              { icon: ImagePlus, label: dictionary.imageUploader.upload },
              { icon: WandSparkles, label: dictionary.imageUploader.promptEngine },
              { icon: Layers3, label: dictionary.dashboard.generatedImages },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  className="rounded-xl border border-border/70 bg-background/70 px-3 py-3 text-sm font-semibold shadow-sm"
                  key={item.label}
                >
                  <Icon
                    aria-hidden="true"
                    className="mb-2 size-4 text-primary"
                  />
                  {item.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <Suspense fallback={null}>
        <SelectedTemplateBanner />
      </Suspense>
      <ImageUploader isAuthenticated={Boolean(user)} />
    </section>
  );
}
