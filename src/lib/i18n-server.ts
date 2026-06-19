import { cookies } from "next/headers";

import {
  defaultLanguage,
  languageCookieName,
  resolveLanguage,
  type Language,
} from "@/lib/i18n";

export async function getCurrentLanguage(): Promise<Language> {
  try {
    const cookieStore = await cookies();
    return resolveLanguage(cookieStore.get(languageCookieName)?.value);
  } catch {
    return defaultLanguage;
  }
}
