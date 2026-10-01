/** Loose Arabic normalization so searches ignore hamza/taa-marbuta/diacritic variants. */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** "حلب / منبج" -> "حلب" */
export function governorate(city: string | null): string {
  return (city ?? "").split("/")[0].trim();
}
