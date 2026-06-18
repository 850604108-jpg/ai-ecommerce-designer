import { Suspense } from "react";

import { ImageUploader } from "@/components/image-uploader";
import { SelectedTemplateBanner } from "@/components/templates/selected-template-banner";

export default function GeneratePage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Generate</h1>
      </div>
      <Suspense fallback={null}>
        <SelectedTemplateBanner />
      </Suspense>
      <ImageUploader />
    </section>
  );
}
