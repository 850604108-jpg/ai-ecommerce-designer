"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import {
  AlertCircle,
  Copy,
  Eye,
  FolderKanban,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { type Language } from "@/lib/i18n";
import {
  type GeneratedImageHistoryJob,
  type GeneratedImageType,
} from "@/lib/image-generation/types";
import type { DashboardProject } from "@/lib/projects";
import { cn } from "@/lib/utils";

type HistoryDashboardProps = {
  creditBalance: number | null;
  errorMessage?: string;
  imagePage: number;
  imagePageCount: number;
  imageTotalCount: number;
  jobs: GeneratedImageHistoryJob[];
  projectPage: number;
  projectPageCount: number;
  projectTotalCount: number;
  projects: DashboardProject[];
  language: Language;
  search: string;
};

type BusyJobAction = "regenerate" | null;

function getImageLabel(
  job: GeneratedImageHistoryJob,
  labels: Readonly<Record<GeneratedImageType, string>>,
) {
  const imageType = job.metadata.image_type;
  const moduleId = job.metadata.module_id;
  const base =
    typeof imageType === "string" && imageType in labels
      ? labels[imageType as GeneratedImageType]
      : labels.detail_page_module;

  return typeof moduleId === "string" && moduleId ? `${base} ${moduleId}` : base;
}

function formatDate(value: string | null, language: Language) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusBadge({
  labels,
  status,
}: {
  labels: Readonly<Record<string, string>>;
  status: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-md border px-2 py-1 text-xs",
        status === "active" || status === "completed"
          ? "border-green-600/30 text-green-700"
          : status === "failed"
            ? "border-destructive/30 text-destructive"
            : "text-muted-foreground",
      )}
    >
      {labels[status] || status}
    </span>
  );
}

export function HistoryDashboard({
  creditBalance,
  errorMessage,
  imagePage,
  imagePageCount,
  imageTotalCount,
  jobs,
  projectPage,
  projectPageCount,
  projectTotalCount,
  projects,
  language,
  search,
}: HistoryDashboardProps) {
  const { dictionary: d } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState(search);
  const [busyJob, setBusyJob] = useState<{
    action: BusyJobAction;
    id: string;
  } | null>(null);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(errorMessage || "");
  const [isPending, startTransition] = useTransition();

  const pageUrls = useMemo(() => {
    function makeUrl(next: {
      imagePage?: number;
      projectPage?: number;
      q?: string;
    }) {
      const params = new URLSearchParams();
      const nextSearch = next.q ?? search;
      const nextProjectPage = next.projectPage ?? projectPage;
      const nextImagePage = next.imagePage ?? imagePage;

      if (nextSearch) {
        params.set("q", nextSearch);
      }

      if (nextProjectPage > 1) {
        params.set("projectPage", String(nextProjectPage));
      }

      if (nextImagePage > 1) {
        params.set("imagePage", String(nextImagePage));
      }

      const nextQuery = params.toString();
      return nextQuery ? `${pathname}?${nextQuery}` : pathname;
    }

    return {
      imagesNext: makeUrl({ imagePage: Math.min(imagePage + 1, imagePageCount) }),
      imagesPrevious: makeUrl({ imagePage: Math.max(imagePage - 1, 1) }),
      projectsNext: makeUrl({
        projectPage: Math.min(projectPage + 1, projectPageCount),
      }),
      projectsPrevious: makeUrl({ projectPage: Math.max(projectPage - 1, 1) }),
      search: (nextSearch: string) =>
        makeUrl({ imagePage: 1, projectPage: 1, q: nextSearch }),
    };
  }, [imagePage, imagePageCount, pathname, projectPage, projectPageCount, search]);

  function navigate(url: string) {
    setError("");
    setNotice("");
    startTransition(() => {
      router.push(url);
    });
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(pageUrls.search(query.trim()));
  }

  async function copyPrompt(job: GeneratedImageHistoryJob) {
    setError("");
    await navigator.clipboard.writeText(job.prompt);
    setNotice(d.dashboard.copyNotice);
  }

  async function regenerate(job: GeneratedImageHistoryJob) {
    setError("");
    setNotice("");
    setBusyJob({ action: "regenerate", id: job.id });

    try {
      const response = await fetch(`/api/image-generation/${job.id}/regenerate`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        job?: { id: string };
      };

      if (!response.ok || !payload.job) {
        throw new Error(payload.error || d.dashboard.regenerateFailed);
      }

      const processResponse = await fetch(
        `/api/image-generation/${payload.job.id}/process`,
        { method: "POST" },
      );
      const processPayload = (await processResponse.json()) as {
        error?: string;
      };

      if (!processResponse.ok) {
        throw new Error(
          processPayload.error || d.dashboard.regenerateProcessingFailed,
        );
      }

      setNotice(d.dashboard.regenerateNotice);
      router.refresh();
    } catch (regenerateError) {
      setError(
        regenerateError instanceof Error
          ? regenerateError.message
          : d.dashboard.regenerateFailed,
      );
    } finally {
      setBusyJob(null);
    }
  }

  async function deleteProject(project: DashboardProject) {
    const confirmed = window.confirm(
      d.dashboard.confirmDelete(project.name, project.image_count),
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setNotice("");
    setBusyProjectId(project.id);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || d.dashboard.deleteProjectFailed);
      }

      setNotice(d.dashboard.deleteProjectNotice);
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : d.dashboard.deleteProjectFailed,
      );
    } finally {
      setBusyProjectId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {d.dashboard.totalProjects}
          </p>
          <p className="mt-2 text-2xl font-semibold">{projectTotalCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {d.dashboard.totalImages}
          </p>
          <p className="mt-2 text-2xl font-semibold">{imageTotalCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {d.imageUploader.remainingCredits}
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {creditBalance === null ? "--" : creditBalance}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {d.dashboard.loadState}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium">
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                {d.common.loading}
              </>
            ) : (
              d.common.ready
            )}
          </p>
        </div>
      </div>

      <form
        className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row"
        onSubmit={handleSearch}
      >
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={d.dashboard.searchPlaceholder}
            type="search"
            value={query}
          />
        </div>
        <Button disabled={isPending} type="submit">
          {isPending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Search aria-hidden="true" />
          )}
          {d.common.search}
        </Button>
      </form>

      {notice ? (
        <p className="rounded-md border border-green-600/30 bg-green-50 p-3 text-sm text-green-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle aria-hidden="true" className="size-4" />
          {error}
        </p>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <FolderKanban aria-hidden="true" className="size-5" />
              {d.dashboard.projects}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {d.dashboard.projectsDescription}
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {d.dashboard.pageOf(projectPage, projectPageCount)}
          </span>
        </div>

        {projects.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => {
              const isDeleting = busyProjectId === project.id;

              return (
                <article className="rounded-lg border bg-card p-4" key={project.id}>
                  <div className="flex gap-4">
                    <div className="flex size-20 shrink-0 items-center justify-center rounded-md bg-secondary">
                      {project.latest_image_url ? (
                        <Image
                          alt={`${project.name} preview`}
                          className="size-20 rounded-md object-cover"
                          height={80}
                          src={project.latest_image_url}
                          width={80}
                        />
                      ) : (
                        <FolderKanban
                          aria-hidden="true"
                          className="size-6 text-muted-foreground"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-medium">
                            {project.name}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {project.description || d.dashboard.noDescription}
                          </p>
                        </div>
                        <StatusBadge
                          labels={d.dashboard.status}
                          status={project.status}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>
                          {d.dashboard.projectImageCount(project.image_count)}
                        </span>
                        <span>
                          {d.dashboard.updatedAt(
                            formatDate(project.updated_at, language),
                          )}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          disabled={Boolean(busyProjectId)}
                          onClick={() => void deleteProject(project)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {isDeleting ? (
                            <Loader2
                              aria-hidden="true"
                              className="animate-spin"
                            />
                          ) : (
                            <Trash2 aria-hidden="true" />
                          )}
                          {d.dashboard.deleteProject}
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center">
            <h3 className="text-base font-medium">
              {d.dashboard.emptyProjects}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {d.dashboard.projectsCreatedByFlow}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button
            disabled={projectPage <= 1 || isPending}
            onClick={() => navigate(pageUrls.projectsPrevious)}
            type="button"
            variant="outline"
          >
            {d.common.previousPage}
          </Button>
          <Button
            disabled={projectPage >= projectPageCount || isPending}
            onClick={() => navigate(pageUrls.projectsNext)}
            type="button"
            variant="outline"
          >
            {d.common.nextPage}
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ImageIcon aria-hidden="true" className="size-5" />
              {d.dashboard.images}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {d.dashboard.imagesDescription}
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {d.dashboard.pageOf(imagePage, imagePageCount)}
          </span>
        </div>

        {jobs.length ? (
          <div className="grid gap-4">
            {jobs.map((job) => {
              const isRegenerating =
                busyJob?.id === job.id && busyJob.action === "regenerate";

              return (
                <article className="rounded-lg border bg-card p-4" key={job.id}>
                  <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
                    <div className="flex min-h-40 items-center justify-center rounded-md bg-secondary">
                      {job.public_url && job.status === "completed" ? (
                        <Image
                          alt={`${getImageLabel(
                            job,
                            d.common.imageTypes,
                          )} preview`}
                          className="max-h-40 w-full rounded-md object-contain"
                          height={160}
                          src={job.public_url}
                          width={180}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {d.dashboard.status[job.status] || job.status}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm text-muted-foreground">
                            {job.project?.name || d.dashboard.noDescription}
                          </p>
                          <h3 className="mt-1 text-base font-medium">
                            {getImageLabel(job, d.common.imageTypes)}
                          </h3>
                        </div>
                        <StatusBadge
                          labels={d.dashboard.status}
                          status={job.status}
                        />
                      </div>

                      <p className="max-h-[4.5rem] overflow-hidden text-sm leading-6 text-muted-foreground">
                        {job.prompt}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(job.created_at, language)}</span>
                        <span>
                          {job.width && job.height
                            ? `${job.width}x${job.height}`
                            : d.dashboard.dimensionsPending}
                        </span>
                        <span>{job.model}</span>
                        <span>{job.credits_spent} Credits</span>
                      </div>

                      {job.error_message ? (
                        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                          {job.error_message}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        {job.public_url ? (
                          <Button
                            asChild
                            size="sm"
                            title={d.dashboard.viewGeneratedImage}
                            variant="outline"
                          >
                            <Link
                              href={job.public_url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <Eye aria-hidden="true" />
                              {d.dashboard.view}
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            disabled
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Eye aria-hidden="true" />
                            {d.dashboard.view}
                          </Button>
                        )}
                        <Button
                          onClick={() => void copyPrompt(job)}
                          size="sm"
                          title={d.common.copy}
                          type="button"
                          variant="outline"
                        >
                          <Copy aria-hidden="true" />
                          {d.common.copy}
                        </Button>
                        <Button
                          disabled={Boolean(busyJob)}
                          onClick={() => void regenerate(job)}
                          size="sm"
                          title={d.dashboard.regenerateTitle}
                          type="button"
                          variant="outline"
                        >
                          {isRegenerating ? (
                            <Loader2
                              aria-hidden="true"
                              className="animate-spin"
                            />
                          ) : (
                            <RefreshCw aria-hidden="true" />
                          )}
                          {d.dashboard.regenerate}
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center">
            <h3 className="text-base font-medium">
              {d.dashboard.emptyImages}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {d.dashboard.createdImagesAppear}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button
            disabled={imagePage <= 1 || isPending}
            onClick={() => navigate(pageUrls.imagesPrevious)}
            type="button"
            variant="outline"
          >
            {d.common.previousPage}
          </Button>
          <Button
            disabled={imagePage >= imagePageCount || isPending}
            onClick={() => navigate(pageUrls.imagesNext)}
            type="button"
            variant="outline"
          >
            {d.common.nextPage}
          </Button>
        </div>
      </section>
    </div>
  );
}
