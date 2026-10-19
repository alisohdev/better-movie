import { IS_TMDB, type Locale } from './model';

// Bounded supported codes for the owned synthetic catalog; independent of UI locale.
export const languageNames: Record<string, { en: string; fa: string }> = {
  da: { en: 'Danish', fa: 'دانمارکی' }, mk: { en: 'Macedonian', fa: 'مقدونی' }, zh: { en: 'Chinese', fa: 'چینی' },
  de: { en: 'German', fa: 'آلمانی' }, en: { en: 'English', fa: 'انگلیسی' },
  es: { en: 'Spanish', fa: 'اسپانیایی' }, fa: { en: 'Persian', fa: 'فارسی' },
  fr: { en: 'French', fa: 'فرانسوی' }, it: { en: 'Italian', fa: 'ایتالیایی' },
  ja: { en: 'Japanese', fa: 'ژاپنی' }, ko: { en: 'Korean', fa: 'کره‌ای' },
  no: { en: 'Norwegian', fa: 'نروژی' }, sv: { en: 'Swedish', fa: 'سوئدی' },
  tr: { en: 'Turkish', fa: 'ترکی' },
};
export const countryNames: Record<string, { en: string; fa: string }> = {
  AT: { en: 'Austria', fa: 'اتریش' }, DK: { en: 'Denmark', fa: 'دانمارک' }, HU: { en: 'Hungary', fa: 'مجارستان' },
  MK: { en: 'North Macedonia', fa: 'مقدونیهٔ شمالی' }, NL: { en: 'Netherlands', fa: 'هلند' }, NZ: { en: 'New Zealand', fa: 'نیوزیلند' }, PL: { en: 'Poland', fa: 'لهستان' }, CN: { en: 'China', fa: 'چین' },
  AU: { en: 'Australia', fa: 'استرالیا' }, BE: { en: 'Belgium', fa: 'بلژیک' },
  CA: { en: 'Canada', fa: 'کانادا' }, DE: { en: 'Germany', fa: 'آلمان' },
  ES: { en: 'Spain', fa: 'اسپانیا' }, FR: { en: 'France', fa: 'فرانسه' },
  GB: { en: 'United Kingdom', fa: 'بریتانیا' }, IR: { en: 'Iran', fa: 'ایران' },
  IT: { en: 'Italy', fa: 'ایتالیا' }, JP: { en: 'Japan', fa: 'ژاپن' },
  KR: { en: 'South Korea', fa: 'کرهٔ جنوبی' }, MX: { en: 'Mexico', fa: 'مکزیک' },
  NO: { en: 'Norway', fa: 'نروژ' }, SE: { en: 'Sweden', fa: 'سوئد' },
  TR: { en: 'Türkiye', fa: 'ترکیه' }, US: { en: 'United States', fa: 'ایالات متحده' },
};
export const languageCodes = Object.keys(languageNames).filter((code) => IS_TMDB || !['da', 'mk', 'zh'].includes(code));
export const countryCodes = Object.keys(countryNames).filter((code) => IS_TMDB || !['AT', 'DK', 'HU', 'MK', 'NL', 'NZ', 'PL', 'CN'].includes(code));
export function optionName(group: 'languages' | 'countries', code: string, locale: Locale) {
  return (group === 'languages' ? languageNames : countryNames)[code]?.[locale] ?? code;
}
