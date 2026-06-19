import { Suspense } from "react";
import type { Metadata } from "next";

import { ImageUploader } from "@/components/image-uploader";
import { SelectedTemplateBanner } from "@/components/templates/selected-template-banner";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";

export const metadata: Metadata = {
  description:
    "Generate marketplace-ready ecommerce product images, prompts, and detail page modules from a product photo.",
  title: "Generate Ecommerce Images",
};

export default async function GeneratePage() {
  const dictionary = getDictionary(await getCurrentLanguage());

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {dictionary.generate.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {dictionary.generate.title}
        </h1>
      </div>
      <Suspense fallback={null}>
        <SelectedTemplateBanner />
      </Suspense>
      <ImageUploader />
    </section>
  );
}
