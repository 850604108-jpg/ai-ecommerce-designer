export type CreditPackCode = "starter" | "growth" | "pro";

export type CreditPack = {
  code: CreditPackCode;
  name: string;
  credits: number;
};

export const creditPacks = [
  {
    code: "starter",
    name: "Starter",
    credits: 50,
  },
  {
    code: "growth",
    name: "Growth",
    credits: 200,
  },
  {
    code: "pro",
    name: "Pro",
    credits: 1000,
  },
] satisfies CreditPack[];

export function getCreditPack(code: string) {
  return creditPacks.find((pack) => pack.code === code);
}

export function getCreditPackPriceId(pack: CreditPack) {
  void pack;

  return undefined;
}

export function getStripe() {
  throw new Error("Stripe is disabled for this deployment.");
}

export function getAppUrl(requestUrl?: string) {
  void requestUrl;

  throw new Error("Stripe is disabled for this deployment.");
}
