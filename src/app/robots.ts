import type { MetadataRoute } from "next";

import { getAppUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const appUrl = getAppUrl();

  return {
    rules: {
      allow: ["/", "/generate", "/templates"],
      disallow: ["/account", "/admin", "/api", "/dashboard"],
      userAgent: "*",
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
