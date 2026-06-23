"use client";

import { useState } from "react";
import { CheckCircle2, Gift, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { useLanguage } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";

type DailyCheckInButtonProps = {
  checkedIn: boolean;
  credits: number;
};

type CheckInResponse = {
  alreadyCheckedIn?: boolean;
  checkedIn?: boolean;
  creditBalance?: number | null;
  creditsGranted?: number;
  error?: string;
};

export function DailyCheckInButton({
  checkedIn,
  credits,
}: DailyCheckInButtonProps) {
  const { dictionary } = useLanguage();
  const router = useRouter();
  const [isCheckedIn, setIsCheckedIn] = useState(checkedIn);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleCheckIn() {
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/credits/check-in", {
        method: "POST",
      });
      const payload = (await response.json()) as CheckInResponse;

      if (!response.ok || !payload.checkedIn) {
        throw new Error(payload.error || dictionary.accountPage.checkInFailed);
      }

      setIsCheckedIn(true);
      setMessage(
        payload.alreadyCheckedIn
          ? dictionary.accountPage.checkInAlready
          : dictionary.accountPage.checkInSuccess(
              payload.creditsGranted || credits,
            ),
      );
      router.refresh();
    } catch (checkInError) {
      setError(
        checkInError instanceof Error
          ? checkInError.message
          : dictionary.accountPage.checkInFailed,
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        disabled={isLoading || isCheckedIn}
        onClick={handleCheckIn}
        type="button"
      >
        {isLoading ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : isCheckedIn ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <Gift aria-hidden="true" />
        )}
        {isCheckedIn
          ? dictionary.accountPage.checkInDone
          : dictionary.accountPage.checkInButton(credits)}
      </Button>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
