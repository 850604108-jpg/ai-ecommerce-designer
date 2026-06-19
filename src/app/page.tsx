import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/i18n-server";

export const metadata: Metadata = {
  description:
    "Upload one product photo and generate ecommerce prompts, marketplace images, infographics, and detail page assets with AI.",
  title: "AI Ecommerce Creative Suite",
};

export default async function HomePage() {
  const dictionary = getDictionary(await getCurrentLanguage());

  return (
    <section className="grid gap-8 py-16">
      <div className="max-w-2xl space-y-5">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {dictionary.home.eyebrow}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {dictionary.home.title}
        </h1>
        <p className="text-lg leading-8 text-muted-foreground">
          {dictionary.home.subtitle}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard">
            {dictionary.home.dashboard}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/generate">{dictionary.home.generate}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/templates">{dictionary.home.templates}</Link>
        </Button>
      </div>
    </section>
  );
}
