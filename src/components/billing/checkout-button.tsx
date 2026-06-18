"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CreditPackCode } from "@/lib/alipay";

type CheckoutButtonProps = {
  pack: CreditPackCode;
};

export function CheckoutButton({ pack }: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/alipay/checkout", {
        body: JSON.stringify({ pack }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Failed to start Alipay checkout.");
      }

      window.location.href = data.url;
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Failed to start Alipay checkout.",
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        disabled={isLoading}
        onClick={startCheckout}
        type="button"
      >
        {isLoading ? <Loader2 className="animate-spin" /> : <CreditCard />}
        Pay with Alipay
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
