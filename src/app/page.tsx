import {
  ArrowRight,
  CheckCircle2,
  ImageIcon,
  Layers3,
  PackageSearch,
  Sparkles,
  WandSparkles,
} from "lucide-react";
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
  const capabilityIcons = [PackageSearch, WandSparkles, Layers3];

  return (
    <section className="space-y-14 pb-16 pt-6">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="max-w-3xl space-y-7">
          <p className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles aria-hidden="true" className="size-3.5 text-[var(--signal-cyan)]" />
            {dictionary.home.eyebrow}
          </p>
          <div className="space-y-5">
            <h1 className="max-w-4xl text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
              {dictionary.home.title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              {dictionary.home.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/generate">
                {dictionary.home.generate}
                <ArrowRight
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/templates">{dictionary.home.templates}</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/dashboard">{dictionary.home.dashboard}</Link>
            </Button>
          </div>
          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            {dictionary.home.metrics.map((metric) => (
              <div
                className="rounded-lg border border-border/80 bg-card/70 px-4 py-3 shadow-sm backdrop-blur"
                key={metric.label}
              >
                <div className="text-xl font-semibold tracking-tight">
                  {metric.value}
                </div>
                <div className="mt-1 text-xs font-medium text-muted-foreground">
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card overflow-hidden rounded-2xl p-4">
          <div className="signal-gradient rounded-xl p-4 text-primary-foreground">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-white/70">
                  {dictionary.home.preview.cardTitle}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  {dictionary.home.preview.title}
                </h2>
              </div>
              <div className="grid size-10 place-items-center rounded-full bg-white/12 ring-1 ring-white/20">
                <ImageIcon aria-hidden="true" className="size-5" />
              </div>
            </div>

            <div className="mt-8 grid gap-3">
              {[
                dictionary.home.preview.recognition,
                dictionary.home.preview.prompt,
                dictionary.home.preview.detail,
              ].map((item, index) => (
                <div
                  className="flex items-center justify-between rounded-lg border border-white/12 bg-white/[0.08] px-3 py-3 shadow-sm backdrop-blur"
                  key={item}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2
                      aria-hidden="true"
                      className="size-4 text-[var(--signal-cyan)]"
                    />
                    {item}
                  </span>
                  <span className="rounded-full bg-white/12 px-2 py-1 text-xs text-white/75">
                    0{index + 1}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl bg-white p-3 text-foreground shadow-2xl shadow-black/20">
              <div className="grid grid-cols-[5rem_1fr] gap-3">
                <div className="grid aspect-square place-items-center rounded-lg bg-secondary">
                  <PackageSearch
                    aria-hidden="true"
                    className="size-8 text-primary"
                  />
                </div>
                <div className="space-y-2 py-1">
                  <div className="h-2.5 w-3/4 rounded-full bg-foreground/80" />
                  <div className="h-2 w-full rounded-full bg-muted" />
                  <div className="h-2 w-4/5 rounded-full bg-muted" />
                  <div className="flex gap-2 pt-2">
                    <span className="h-6 w-16 rounded-full bg-[var(--signal-cyan)]/20" />
                    <span className="h-6 w-20 rounded-full bg-[var(--signal-violet)]/20" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {dictionary.home.flow.map((step, index) => (
          <div
            className="group rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-ring/40 hover:shadow-[var(--shadow-soft)]"
            key={step}
          >
            <div className="mb-4 inline-flex size-8 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              {index + 1}
            </div>
            <p className="text-sm font-semibold leading-6">{step}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {dictionary.home.capabilities.map((capability, index) => {
          const Icon = capabilityIcons[index] ?? Sparkles;

          return (
            <article
              className="rounded-xl border border-border/80 bg-card p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-ring/40 hover:shadow-[var(--shadow-soft)]"
              key={capability.title}
            >
              <div className="mb-5 grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                <Icon aria-hidden="true" className="size-5" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight">
                {capability.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {capability.description}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
