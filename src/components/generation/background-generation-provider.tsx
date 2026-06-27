"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { useLanguage } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";

type BackgroundGenerationStatus =
  | "idle"
  | "queueing"
  | "processing"
  | "success"
  | "error";

export type BackgroundGenerationProgress = {
  activeLabel: string;
  completed: number;
  failed: number;
  href: string;
  isMinimized: boolean;
  label: string;
  status: BackgroundGenerationStatus;
  total: number;
};

export type GenerationDraft = Record<string, unknown> | null;

type BackgroundGenerationContextValue = {
  clearProgress: () => void;
  clearGenerationDraft: () => void;
  generationDraft: GenerationDraft;
  minimize: () => void;
  progress: BackgroundGenerationProgress;
  restore: () => void;
  updateGenerationDraft: (draft: GenerationDraft) => void;
  updateProgress: (progress: Partial<BackgroundGenerationProgress>) => void;
};

const defaultProgress: BackgroundGenerationProgress = {
  activeLabel: "",
  completed: 0,
  failed: 0,
  href: "/generate#generation-workspace",
  isMinimized: false,
  label: "",
  status: "idle",
  total: 0,
};

const BackgroundGenerationContext =
  createContext<BackgroundGenerationContextValue | null>(null);

export function BackgroundGenerationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { dictionary } = useLanguage();
  const router = useRouter();
  const [progress, setProgress] =
    useState<BackgroundGenerationProgress>(defaultProgress);
  const [generationDraft, setGenerationDraft] =
    useState<GenerationDraft>(null);
  const clearProgress = useCallback(() => setProgress(defaultProgress), []);
  const clearGenerationDraft = useCallback(() => setGenerationDraft(null), []);
  const minimize = useCallback(
    () =>
      setProgress((currentProgress) => ({
        ...currentProgress,
        isMinimized: true,
      })),
    [],
  );
  const restore = useCallback(
    () =>
      setProgress((currentProgress) => ({
        ...currentProgress,
        isMinimized: false,
      })),
    [],
  );
  const updateProgress = useCallback(
    (nextProgress: Partial<BackgroundGenerationProgress>) =>
      setProgress((currentProgress) => ({
        ...currentProgress,
        ...nextProgress,
      })),
    [],
  );
  const updateGenerationDraft = useCallback(
    (draft: GenerationDraft) => setGenerationDraft(draft),
    [],
  );

  const value = useMemo<BackgroundGenerationContextValue>(
    () => ({
      clearProgress,
      clearGenerationDraft,
      generationDraft,
      minimize,
      progress,
      restore,
      updateGenerationDraft,
      updateProgress,
    }),
    [
      clearGenerationDraft,
      clearProgress,
      generationDraft,
      minimize,
      progress,
      restore,
      updateGenerationDraft,
      updateProgress,
    ],
  );

  const shouldShowBar =
    progress.total > 0 &&
    (progress.isMinimized ||
      progress.status === "queueing" ||
      progress.status === "processing" ||
      progress.status === "error");
  const done = Math.min(progress.completed + progress.failed, progress.total);
  const percent = progress.total ? Math.round((done / progress.total) * 100) : 0;
  const statusLabel =
    progress.status === "error"
      ? dictionary.backgroundGeneration.failed(progress.failed)
      : progress.status === "success"
        ? dictionary.backgroundGeneration.completed
        : dictionary.backgroundGeneration.processing(done, progress.total);
  const progressLabel =
    progress.label || dictionary.backgroundGeneration.defaultLabel;

  function handleReturn() {
    setProgress((currentProgress) => ({
      ...currentProgress,
      isMinimized: false,
    }));
    router.push(progress.href);
  }

  return (
    <BackgroundGenerationContext.Provider value={value}>
      {children}
      {shouldShowBar ? (
        <button
          className="btn-motion interactive-card fixed bottom-4 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 overflow-hidden rounded-lg border bg-background p-3 text-left shadow-lg"
          onClick={handleReturn}
          type="button"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{progressLabel}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {progress.activeLabel || statusLabel}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {progress.status === "error" ? (
                <XCircle aria-hidden="true" className="size-4 text-destructive" />
              ) : progress.status === "success" ? (
                <CheckCircle2 aria-hidden="true" className="size-4 text-green-600" />
              ) : (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              )}
              <span>{statusLabel}</span>
            </div>
          </div>
          <div
            className={cn(
              "mt-3 h-2 overflow-hidden rounded-full bg-secondary",
              progress.status !== "success" &&
                progress.status !== "error" &&
                "waiting-surface",
            )}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[background-color,width] duration-300 ease-out",
                progress.status === "error" ? "bg-destructive" : "bg-primary",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </button>
      ) : null}
    </BackgroundGenerationContext.Provider>
  );
}

export function useBackgroundGeneration() {
  const context = useContext(BackgroundGenerationContext);

  if (!context) {
    throw new Error(
      "useBackgroundGeneration must be used inside BackgroundGenerationProvider.",
    );
  }

  return context;
}
