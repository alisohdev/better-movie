import { useEffect, useState, type SubmitEvent } from 'react';
import { copy, type Locale } from '../lib/model';
import { countryCodes, languageCodes, optionName } from '../lib/discovery-options';
import { parseFilters, serializeFilters, type Filters } from '../lib/filters';

interface Props { filters: Filters; locale: Locale; genres: string[]; onApply: (next: Filters) => void; }

export function AdvancedFilters({ filters, locale, genres, onApply }: Props) {
  const [rating, setRating] = useState(String(filters.ratingMin ?? ''));
  const [votes, setVotes] = useState(String(filters.voteCountMin ?? ''));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setRating(String(filters.ratingMin ?? '')); setVotes(String(filters.voteCountMin ?? '')); setInvalid(false);
  }, [filters]);
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if ([...event.currentTarget.querySelectorAll('input')].some((input) => !input.validity.valid)) { setInvalid(true); return; }
    const params = new URLSearchParams(serializeFilters({ ...filters, page: 1 }));
    for (const [key, value] of [['ratingMin', rating], ['voteCountMin', votes]] as const) {
      if (value.trim()) params.set(key, value.trim()); else params.delete(key);
    }
    const parsed = parseFilters(params.toString(), genres);
    setInvalid(parsed.kind === 'invalid');
    if (parsed.kind === 'valid') onApply(parsed.filters);
  }
  const count = filters.languages.length + filters.countries.length + Number(filters.ratingMin !== null) + Number(filters.voteCountMin !== null);
  return <details data-filter-disclosure="advanced" className="advanced-filters exclude-section">
    <summary>{copy(locale, 'Advanced filters', 'فیلترهای پیشرفته')}<span>{count || '+'}</span></summary>
    {(['languages', 'countries'] as const).map((group) => <details key={group} data-filter-disclosure={group} className="advanced-options">
      <summary>{group === 'languages' ? copy(locale, 'Original language', 'زبان اصلی') : copy(locale, 'Production country', 'کشور تولیدکننده')}<span>{filters[group].length || '+'}</span></summary>
      <fieldset>
        <legend className="sr-only">{group === 'languages' ? copy(locale, 'Original languages', 'زبان‌های اصلی') : copy(locale, 'Production countries', 'کشورهای تولیدکننده')}</legend>
        <p className="filter-hint">{group === 'languages' ? copy(locale, 'Matches any selected original language. Not subtitles, dubbing or interface language.', 'تطبیق با یکی از زبان‌های اصلی انتخاب‌شده؛ نه زیرنویس، دوبله یا زبان رابط کاربری.') : copy(locale, 'Matches any selected production country. Not filming locations or streaming availability.', 'تطبیق با یکی از کشورهای تولیدکنندهٔ انتخاب‌شده؛ نه محل فیلم‌برداری یا دسترسی به پخش.')}</p>
        <div className="genre-options">{(group === 'languages' ? languageCodes : countryCodes).map((code) => <label key={code} className={`genre-option ${filters[group].includes(code) ? 'selected' : ''}`}>
          <input type="checkbox" checked={filters[group].includes(code)} onChange={() => onApply({ ...filters, [group]: filters[group].includes(code) ? filters[group].filter((value) => value !== code) : [...filters[group], code].sort(), page: 1 })} />
          <span>{optionName(group, code, locale)}</span>
        </label>)}</div>
        <button type="button" className="text-button" disabled={!filters[group].length} onClick={() => onApply({ ...filters, [group]: [], page: 1 })}>{group === 'languages' ? copy(locale, 'Clear languages', 'پاک کردن زبان‌ها') : copy(locale, 'Clear countries', 'پاک کردن کشورها')}</button>
      </fieldset>
    </details>)}
    <form className="range-form" noValidate onSubmit={submit}>
      <fieldset className="filter-section"><legend>{copy(locale, 'Fictional scores', 'امتیازهای خیالی')}</legend>
        <p className="filter-hint">{copy(locale, 'Synthetic fictional scores, not real TMDB or IMDb ratings. No minimum vote count is applied unless you set one.', 'امتیازها ساختگی و خیالی‌اند، نه امتیاز واقعی TMDB یا IMDb. حداقل تعداد رأی تنها با انتخاب شما اعمال می‌شود.')}</p>
        <label className="advanced-number">{copy(locale, 'Minimum score (0–10)', 'حداقل امتیاز (۰ تا ۱۰)')}<input type="number" dir="ltr" min="0" max="10" step="any" inputMode="decimal" placeholder="—" value={rating} onChange={(event) => setRating(event.target.value)} aria-invalid={invalid || undefined} aria-describedby={invalid ? 'score-error' : undefined} /></label>
        <label className="advanced-number">{copy(locale, 'Minimum vote count (optional)', 'حداقل تعداد رأی (اختیاری)')}<input type="number" dir="ltr" min="0" max="2147483647" step="1" inputMode="numeric" placeholder="—" value={votes} onChange={(event) => setVotes(event.target.value)} aria-invalid={invalid || undefined} aria-describedby={invalid ? 'score-error' : undefined} /></label>
      </fieldset>
      {invalid ? <p id="score-error" className="range-errors" role="alert">{copy(locale, 'Enter a score from 0 to 10 and a whole vote count from 0 to 2147483647, or leave either blank.', 'امتیازی از ۰ تا ۱۰ و تعداد رأی صحیح از ۰ تا ۲۱۴۷۴۸۳۶۴۷ وارد کن، یا هر کدام را خالی بگذار.')}</p> : null}
      <button className="apply-button" type="submit">{copy(locale, 'Apply scores', 'اعمال امتیازها')}</button>
      <button className="text-button" type="button" onClick={() => { setRating(''); setVotes(''); setInvalid(false); onApply({ ...filters, ratingMin: null, voteCountMin: null, page: 1 }); }}>{copy(locale, 'Clear scores', 'پاک کردن امتیازها')}</button>
    </form>
  </details>;
}

export function AdvancedChips({ filters, locale, onApply }: Omit<Props, 'genres'>) {
  return <>
    {(['languages', 'countries'] as const).flatMap((group) => filters[group].map((code) => <button key={`${group}-${code}`} onClick={() => onApply({ ...filters, [group]: filters[group].filter((value) => value !== code), page: 1 })}>
      {group === 'languages' ? copy(locale, 'Language: ', 'زبان: ') : copy(locale, 'Country: ', 'کشور: ')}{optionName(group, code, locale)}<span aria-hidden="true">×</span><span className="sr-only">{copy(locale, 'Remove filter', 'حذف فیلتر')}</span>
    </button>))}
    {(['ratingMin', 'voteCountMin'] as const).map((key) => filters[key] !== null ? <button key={key} onClick={() => onApply({ ...filters, [key]: null, page: 1 })}>
      {key === 'ratingMin' ? copy(locale, 'Fictional score ', 'امتیاز خیالی ') : copy(locale, 'Votes ', 'تعداد رأی ')}<bdi dir="ltr">≥ {filters[key]}</bdi><span aria-hidden="true">×</span><span className="sr-only">{copy(locale, 'Remove filter', 'حذف فیلتر')}</span>
    </button> : null)}
  </>;
}
