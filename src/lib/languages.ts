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
  /** "Welcome" as a church would write it on its door. */
  welcome: string;
  dir: "ltr" | "rtl";
  group: CensusGroupId;
};

export const TARGET_LANGUAGES: TargetLanguage[] = [
  { code: "es", welcome: "Bienvenidos", name: "Spanish", native: "Español", dir: "ltr", group: "spanish" },
  { code: "ht", welcome: "Byenveni", name: "Haitian Creole", native: "Kreyòl ayisyen", dir: "ltr", group: "french-haitian-cajun" },
  { code: "fr", welcome: "Bienvenue", name: "French", native: "Français", dir: "ltr", group: "french-haitian-cajun" },
  { code: "de", welcome: "Willkommen", name: "German", native: "Deutsch", dir: "ltr", group: "german-west-germanic" },
  { code: "ru", welcome: "Добро пожаловать", name: "Russian", native: "Русский", dir: "ltr", group: "slavic" },
  { code: "uk", welcome: "Ласкаво просимо", name: "Ukrainian", native: "Українська", dir: "ltr", group: "slavic" },
  { code: "pl", welcome: "Witamy", name: "Polish", native: "Polski", dir: "ltr", group: "slavic" },
  { code: "pt", welcome: "Bem-vindos", name: "Portuguese", native: "Português", dir: "ltr", group: "other-indo-european" },
  { code: "hi", welcome: "स्वागत है", name: "Hindi", native: "हिन्दी", dir: "ltr", group: "other-indo-european" },
  { code: "ko", welcome: "환영합니다", name: "Korean", native: "한국어", dir: "ltr", group: "korean" },
  { code: "zh-Hans", welcome: "欢迎", name: "Chinese (Simplified)", native: "简体中文", dir: "ltr", group: "chinese" },
  { code: "zh-Hant", welcome: "歡迎", name: "Chinese (Traditional)", native: "繁體中文", dir: "ltr", group: "chinese" },
  { code: "vi", welcome: "Chào mừng", name: "Vietnamese", native: "Tiếng Việt", dir: "ltr", group: "vietnamese" },
  { code: "tl", welcome: "Maligayang pagdating", name: "Tagalog", native: "Tagalog", dir: "ltr", group: "tagalog" },
  { code: "ar", welcome: "أهلاً وسهلاً", name: "Arabic", native: "العربية", dir: "rtl", group: "arabic" },
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
