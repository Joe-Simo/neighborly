/** Census ACS table C16001 groups languages into 12 buckets. Each bucket maps to the languages a church could publish in. */
export type CensusGroupId =
  | "spanish"
  | "french-haitian-cajun"
  | "german-west-germanic"
  | "slavic"
  | "other-indo-european"
  | "korean"
  | "chinese"
  | "vietnamese"
  | "tagalog"
  | "other-asian-pacific"
  | "arabic"
  | "other";

export type TargetLanguage = {
  code: string;
  name: string;
  native: string;
  dir: "ltr" | "rtl";
  group: CensusGroupId;
};

export const TARGET_LANGUAGES: TargetLanguage[] = [
  { code: "es", name: "Spanish", native: "Español", dir: "ltr", group: "spanish" },
  { code: "ht", name: "Haitian Creole", native: "Kreyòl ayisyen", dir: "ltr", group: "french-haitian-cajun" },
  { code: "fr", name: "French", native: "Français", dir: "ltr", group: "french-haitian-cajun" },
  { code: "de", name: "German", native: "Deutsch", dir: "ltr", group: "german-west-germanic" },
  { code: "ru", name: "Russian", native: "Русский", dir: "ltr", group: "slavic" },
  { code: "uk", name: "Ukrainian", native: "Українська", dir: "ltr", group: "slavic" },
  { code: "pl", name: "Polish", native: "Polski", dir: "ltr", group: "slavic" },
  { code: "pt", name: "Portuguese", native: "Português", dir: "ltr", group: "other-indo-european" },
  { code: "hi", name: "Hindi", native: "हिन्दी", dir: "ltr", group: "other-indo-european" },
  { code: "ko", name: "Korean", native: "한국어", dir: "ltr", group: "korean" },
  { code: "zh-Hans", name: "Chinese (Simplified)", native: "简体中文", dir: "ltr", group: "chinese" },
  { code: "zh-Hant", name: "Chinese (Traditional)", native: "繁體中文", dir: "ltr", group: "chinese" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt", dir: "ltr", group: "vietnamese" },
  { code: "tl", name: "Tagalog", native: "Tagalog", dir: "ltr", group: "tagalog" },
  { code: "ar", name: "Arabic", native: "العربية", dir: "rtl", group: "arabic" },
];

export const LANGUAGE_CODES = TARGET_LANGUAGES.map((l) => l.code) as [string, ...string[]];

export function languageByCode(code: string): TargetLanguage | undefined {
  return TARGET_LANGUAGES.find((l) => l.code === code);
}

export function languagesForGroup(group: CensusGroupId): TargetLanguage[] {
  return TARGET_LANGUAGES.filter((l) => l.group === group);
}

/** What a reader should know about a bucket that is not one language. */
export const GROUP_NOTES: Partial<Record<CensusGroupId, string>> = {
  "french-haitian-cajun": "Census counts French, Haitian Creole and Cajun together. Ask your neighbors which one they read.",
  "german-west-germanic": "Includes German, Yiddish, Dutch and Pennsylvania Dutch.",
  slavic: "Includes Russian, Ukrainian, Polish and other Slavic languages.",
  "other-indo-european": "A mix: Portuguese, Hindi, Gujarati, Persian, Italian and more. Ask before you pick one.",
  chinese: "Includes Mandarin and Cantonese. Written Chinese comes in Simplified and Traditional characters.",
  "other-asian-pacific": "A mix of many languages, such as Japanese, Hmong, Khmer and Thai. No single language to suggest.",
  other: "Many languages, including Amharic, Somali, Navajo and others. No single language to suggest.",
};
