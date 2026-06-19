import type { MetadataRoute } from "next";

import { getAppUrl } from "@/lib/app-url";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#ffffff",
    description:
      "Generate marketplace-ready ecommerce prompts, product images, and detail page assets from one product photo.",
    display: "standalone",
    icons: [
      {
        sizes: "192x192",
        src: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    name: "AI Ecommerce Designer",
    short_name: "AI Designer",
    start_url: getAppUrl(),
    theme_color: "#111827",
  };
}
