import type { MetadataRoute } from "next";

import { getAppUrl } from "@/lib/alipay";

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = getAppUrl();
  const now = new Date();

  return [
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 1,
      url: appUrl,
    },
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 0.8,
      url: `${appUrl}/generate`,
    },
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 0.7,
      url: `${appUrl}/templates`,
    },
  ];
}
