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

import { Button } from "@/components/ui/button";
import {
  generatedImageTypeLabels,
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
  search: string;
};

type BusyJobAction = "regenerate" | null;

const statusLabels: Record<string, string> = {
  active: "进行中",
  archived: "已删除",
  completed: "已完成",
  draft: "草稿",
  failed: "失败",
  processing: "生成中",
  queued: "排队中",
};

function getImageLabel(job: GeneratedImageHistoryJob) {
  const imageType = job.metadata.image_type;
  const moduleId = job.metadata.module_id;
  const base =
    typeof imageType === "string" && imageType in generatedImageTypeLabels
      ? generatedImageTypeLabels[imageType as GeneratedImageType]
      : "生成图";

  return typeof moduleId === "string" && moduleId ? `${base} ${moduleId}` : base;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: string }) {
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
      {statusLabels[status] || status}
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
  search,
}: HistoryDashboardProps) {
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
    setNotice("Prompt 已复制。");
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
        throw new Error(payload.error || "重新生成失败。");
      }

      const processResponse = await fetch(
        `/api/image-generation/${payload.job.id}/process`,
        { method: "POST" },
      );
      const processPayload = (await processResponse.json()) as {
        error?: string;
      };

      if (!processResponse.ok) {
        throw new Error(processPayload.error || "生成处理失败。");
      }

      setNotice("已重新生成并保存到生成记录。");
      router.refresh();
    } catch (regenerateError) {
      setError(
        regenerateError instanceof Error ? regenerateError.message : "重新生成失败。",
      );
    } finally {
      setBusyJob(null);
    }
  }

  async function deleteProject(project: DashboardProject) {
    const confirmed = window.confirm(
      [
        "确认删除这个项目？",
        "",
        `项目：${project.name}`,
        `生成记录：${project.image_count} 条`,
        "",
        "这会将项目归档，并把项目下的生成记录标记为 deleted；不会直接删除文件。",
      ].join("\n"),
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
        throw new Error(payload.error || "删除项目失败。");
      }

      setNotice("项目已删除。");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "删除项目失败。",
      );
    } finally {
      setBusyProjectId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">项目总数</p>
          <p className="mt-2 text-2xl font-semibold">{projectTotalCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">生成记录</p>
          <p className="mt-2 text-2xl font-semibold">{imageTotalCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">剩余积分</p>
          <p className="mt-2 text-2xl font-semibold">
            {creditBalance === null ? "--" : creditBalance}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">加载状态</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium">
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                加载中
              </>
            ) : (
              "已就绪"
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
            placeholder="搜索项目名称或 prompt"
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
          搜索
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
              Projects
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              查看所有未归档项目，并可删除项目。
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            第 {projectPage} 页，共 {projectPageCount} 页
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
                          unoptimized
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
                            {project.description || "暂无描述"}
                          </p>
                        </div>
                        <StatusBadge status={project.status} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{project.image_count} 张图片</span>
                        <span>更新 {formatDate(project.updated_at)}</span>
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
                          删除项目
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
            <h3 className="text-base font-medium">暂无项目</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              完整生成流程创建的项目会显示在这里。
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
            上一页
          </Button>
          <Button
            disabled={projectPage >= projectPageCount || isPending}
            onClick={() => navigate(pageUrls.projectsNext)}
            type="button"
            variant="outline"
          >
            下一页
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ImageIcon aria-hidden="true" className="size-5" />
              Images
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              查看生成记录，并可复制 prompt 或重新生成。
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            第 {imagePage} 页，共 {imagePageCount} 页
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
                          alt={`${getImageLabel(job)} preview`}
                          className="max-h-40 w-full rounded-md object-contain"
                          height={160}
                          src={job.public_url}
                          unoptimized
                          width={180}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {statusLabels[job.status] || job.status}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm text-muted-foreground">
                            {job.project?.name || "未命名项目"}
                          </p>
                          <h3 className="mt-1 text-base font-medium">
                            {getImageLabel(job)}
                          </h3>
                        </div>
                        <StatusBadge status={job.status} />
                      </div>

                      <p className="max-h-[4.5rem] overflow-hidden text-sm leading-6 text-muted-foreground">
                        {job.prompt}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(job.created_at)}</span>
                        <span>
                          {job.width && job.height
                            ? `${job.width}x${job.height}`
                            : "尺寸未定"}
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
                            title="查看生成图"
                            variant="outline"
                          >
                            <Link
                              href={job.public_url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <Eye aria-hidden="true" />
                              查看
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
                            查看
                          </Button>
                        )}
                        <Button
                          onClick={() => void copyPrompt(job)}
                          size="sm"
                          title="复制 prompt"
                          type="button"
                          variant="outline"
                        >
                          <Copy aria-hidden="true" />
                          复制
                        </Button>
                        <Button
                          disabled={Boolean(busyJob)}
                          onClick={() => void regenerate(job)}
                          size="sm"
                          title="使用同一 prompt 重新生成"
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
                          重新生成
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
            <h3 className="text-base font-medium">暂无生成记录</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              生成完成的图片会显示在这里。
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
            上一页
          </Button>
          <Button
            disabled={imagePage >= imagePageCount || isPending}
            onClick={() => navigate(pageUrls.imagesNext)}
            type="button"
            variant="outline"
          >
            下一页
          </Button>
        </div>
      </section>
    </div>
  );
}
