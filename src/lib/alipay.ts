import { createSign, createVerify } from "crypto";

export type CreditPackCode = "starter" | "growth" | "pro";

export type CreditPack = {
  amountEnvKey: string;
  code: CreditPackCode;
  credits: number;
  name: string;
};

type AlipayConfig = {
  alipayPublicKey: string;
  appId: string;
  gatewayUrl: string;
  privateKey: string;
};

type AlipayTradePagePayInput = {
  amount: string;
  notifyUrl: string;
  outTradeNo: string;
  returnUrl: string;
  subject: string;
};

export const creditPacks = [
  {
    amountEnvKey: "ALIPAY_STARTER_AMOUNT",
    code: "starter",
    credits: 50,
    name: "Starter",
  },
  {
    amountEnvKey: "ALIPAY_GROWTH_AMOUNT",
    code: "growth",
    credits: 200,
    name: "Growth",
  },
  {
    amountEnvKey: "ALIPAY_PRO_AMOUNT",
    code: "pro",
    credits: 1000,
    name: "Pro",
  },
] satisfies CreditPack[];

export function getCreditPack(code: string) {
  return creditPacks.find((pack) => pack.code === code);
}

export function getCreditPackAmount(pack: CreditPack) {
  return process.env[pack.amountEnvKey];
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

function normalizePem(value: string, type: "PRIVATE KEY" | "PUBLIC KEY") {
  const normalized = value.replace(/\\n/g, "\n").trim();

  if (normalized.includes("BEGIN")) {
    return normalized;
  }

  const lines = normalized.match(/.{1,64}/g)?.join("\n") || normalized;

  return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
}

export function getAlipayConfig(): AlipayConfig {
  const appId = process.env.ALIPAY_APP_ID;
  const privateKey = process.env.ALIPAY_PRIVATE_KEY;
  const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;
  const gatewayUrl =
    process.env.ALIPAY_GATEWAY_URL || "https://openapi.alipay.com/gateway.do";

  if (!appId || !privateKey || !alipayPublicKey) {
    throw new Error(
      "Missing ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, or ALIPAY_PUBLIC_KEY.",
    );
  }

  return {
    alipayPublicKey: normalizePem(alipayPublicKey, "PUBLIC KEY"),
    appId,
    gatewayUrl,
    privateKey: normalizePem(privateKey, "PRIVATE KEY"),
  };
}

function getTimestamp() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}`;
}

function stringifyParams(params: Record<string, string>) {
  return Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

function signParams(params: Record<string, string>, privateKey: string) {
  const signer = createSign("RSA-SHA256");
  signer.update(stringifyParams(params), "utf8");

  return signer.sign(privateKey, "base64");
}

export function createAlipayPagePayUrl(input: AlipayTradePagePayInput) {
  const config = getAlipayConfig();
  const params: Record<string, string> = {
    app_id: config.appId,
    biz_content: JSON.stringify({
      out_trade_no: input.outTradeNo,
      product_code: "FAST_INSTANT_TRADE_PAY",
      subject: input.subject,
      total_amount: input.amount,
    }),
    charset: "utf-8",
    format: "JSON",
    method: "alipay.trade.page.pay",
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    sign_type: "RSA2",
    timestamp: getTimestamp(),
    version: "1.0",
  };

  params.sign = signParams(params, config.privateKey);

  const url = new URL(config.gatewayUrl);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

export function verifyAlipayNotification(params: Record<string, string>) {
  const config = getAlipayConfig();
  const verifier = createVerify("RSA-SHA256");
  verifier.update(stringifyParams(params), "utf8");

  return verifier.verify(config.alipayPublicKey, params.sign || "", "base64");
}

export function alipayAmountToCents(amount: string) {
  const [yuan = "0", fraction = ""] = amount.split(".");
  const paddedFraction = `${fraction}00`.slice(0, 2);

  return Number.parseInt(yuan, 10) * 100 + Number.parseInt(paddedFraction, 10);
}
