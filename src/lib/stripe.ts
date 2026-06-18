import Stripe from "stripe";

export type CreditPackCode = "starter" | "growth" | "pro";

export type CreditPack = {
  code: CreditPackCode;
  name: string;
  credits: number;
  priceEnvKey: string;
};

export const creditPacks = [
  {
    code: "starter",
    name: "Starter",
    credits: 50,
    priceEnvKey: "STRIPE_STARTER_PRICE_ID",
  },
  {
    code: "growth",
    name: "Growth",
    credits: 200,
    priceEnvKey: "STRIPE_GROWTH_PRICE_ID",
  },
  {
    code: "pro",
    name: "Pro",
    credits: 1000,
    priceEnvKey: "STRIPE_PRO_PRICE_ID",
  },
] satisfies CreditPack[];

export function getCreditPack(code: string) {
  return creditPacks.find((pack) => pack.code === code);
}

export function getCreditPackPriceId(pack: CreditPack) {
  return process.env[pack.priceEnvKey];
}

export function getStripe() {
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  return new Stripe(apiKey);
}

export function getAppUrl(requestUrl?: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (requestUrl) {
    const url = new URL(requestUrl);
    return url.origin;
  }

  return "http://localhost:3000";
}
