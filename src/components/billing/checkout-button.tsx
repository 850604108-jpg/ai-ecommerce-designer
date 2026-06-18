"use client";

import { Gift } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function CheckoutButton() {
  return (
    <div className="space-y-2">
      <Button asChild className="w-full" type="button">
        <Link href="/account">
          <Gift aria-hidden="true" />
          Go to daily check-in
        </Link>
      </Button>
    </div>
  );
}
