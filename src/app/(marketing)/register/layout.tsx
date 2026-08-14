import { createPublicUtilityMetadata } from "@/lib/public-site/search-registry";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getServerLocale } from "@/lib/i18n/server-locale";
import { createTranslator } from "@/lib/i18n/translate";

export async function generateMetadata() {
  const locale = await getServerLocale();
  const t = createTranslator(getDictionary(locale));
  return createPublicUtilityMetadata(
    "/register",
    t("publicContent.accountSetup.metaTitle"),
    t("publicContent.accountSetup.metaDescription"),
  );
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
