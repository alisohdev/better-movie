import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { keepPreviousData, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { navigate, type TransitionBeforePreparationEvent, type TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { copy, genreName, type Locale, type MovieResults } from '../lib/model';
import { defaultFilters, isDefaultFilters, modeSchema, parseFilters, parseRangeDraft, serializeFilters, sortSchema, type FilterResult, type Filters } from '../lib/filters';
import { getQueryClient, movieQuery } from '../lib/query-client';
import { MovieCard } from './MovieCard';

interface Props { locale: Locale; genres: string[]; initialResults: MovieResults; }
type RangeDraft = { yearMin: string; yearMax: string; runtimeMin: string; runtimeMax: string };
const draftFrom = (filters: Filters): RangeDraft => ({ yearMin: String(filters.yearMin ?? ''), yearMax: String(filters.yearMax ?? ''), runtimeMin: String(filters.runtimeMin ?? ''), runtimeMax: String(filters.runtimeMax ?? '') });

export default function Discovery(props: Props) {
  const [client] = useState(getQueryClient);
  return <QueryClientProvider client={client}><DiscoveryBody {...props} /></QueryClientProvider>;
}

function DiscoveryBody({ locale, genres, initialResults }: Props) {
  const [route, setRoute] = useState<FilterResult>({ kind: 'valid', filters: defaultFilters() });
  const [hydrated, setHydrated] = useState(false);
  const [online, setOnline] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<RangeDraft>(() => draftFrom(defaultFilters()));
  const [rangeErrors, setRangeErrors] = useState<string[]>([]);
  const filters = route.kind === 'valid' ? route.filters : defaultFilters();
  const canonical = serializeFilters(filters);
  const lastResult = useRef({ data: initialResults, canonical: 'v=1' });
  const query = useQuery({ ...movieQuery(filters), enabled: hydrated && route.kind === 'valid', initialData: isDefaultFilters(filters) ? initialResults : undefined, placeholderData: keepPreviousData });
  const data = query.data ?? lastResult.current.data;
  const dataCanonical = query.data && !query.isPlaceholderData ? canonical : lastResult.current.canonical;
  const matches = hydrated && route.kind === 'valid' && dataCanonical === canonical;
  const pending = hydrated && route.kind === 'valid' && (query.isFetching || query.fetchStatus === 'paused');
  const activeCount = filters.genres.length + filters.excludeGenres.length + Number(filters.yearMin !== null || filters.yearMax !== null) + Number(filters.runtimeMin !== null || filters.runtimeMax !== null);

  useEffect(() => {
    if (query.data && !query.isPlaceholderData) lastResult.current = { data: query.data, canonical };
  }, [query.data, query.isPlaceholderData, canonical]);

  useEffect(() => {
    const read = (search = window.location.search) => {
      const next = parseFilters(search, genres);
      setRoute(next);
      setRangeErrors([]);
      if (next.kind === 'valid') setDraft(draftFrom(next.filters));
    };
    read(); setHydrated(true); setOnline(navigator.onLine);
    const isFilterNavigation = (event: Pick<TransitionBeforePreparationEvent, 'from' | 'to' | 'navigationType' | 'info'>) =>
      event.from.origin === event.to.origin && event.from.pathname === `/${locale}/discover/` && event.to.pathname === event.from.pathname &&
      (event.navigationType === 'traverse' || event.info === 'frame:filters');
    let preservedScroll: number | undefined;
    const prepare = (event: TransitionBeforePreparationEvent) => {
      preservedScroll = undefined;
      if (!isFilterNavigation(event)) return;
      // Astro owns history indices; the island already owns this route's document and data.
      event.loader = async () => {};
      if (event.navigationType === 'traverse') read(event.to.search);
      else preservedScroll = window.scrollY;
    };
    const swap = (event: TransitionBeforeSwapEvent) => {
      if (!isFilterNavigation(event)) return;
      event.swap = () => {};
      // Skipping native animation rejects ready; the document update still runs.
      void event.viewTransition.ready.catch(() => {});
      event.viewTransition.skipTransition();
    };
    const afterSwap = () => {
      if (preservedScroll === undefined) return;
      window.scrollTo({ top: preservedScroll, behavior: 'instant' });
      preservedScroll = undefined;
    };
    const updateOnline = () => setOnline(navigator.onLine);
    document.addEventListener('astro:before-preparation', prepare);
    document.addEventListener('astro:before-swap', swap);
    document.addEventListener('astro:after-swap', afterSwap);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    try {
      const marker = sessionStorage.getItem('frame:restore');
      const raw: unknown = JSON.parse(sessionStorage.getItem(`frame:selection:${locale}`) ?? 'null');
      if (marker === location.pathname + location.search && typeof raw === 'object' && raw !== null && 'scroll' in raw && typeof raw.scroll === 'number') {
        const top = raw.scroll;
        sessionStorage.removeItem('frame:restore');
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top, behavior: 'instant' })));
      }
    } catch { /* Session persistence is optional. */ }
    return () => {
      document.removeEventListener('astro:before-preparation', prepare);
      document.removeEventListener('astro:before-swap', swap);
      document.removeEventListener('astro:after-swap', afterSwap);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, [genres, locale]);

  function apply(next: Filters, resetDraft = false) {
    const serialized = serializeFilters(next);
    const valid = parseFilters(serialized, genres);
    if (valid.kind === 'invalid') { setRangeErrors(valid.errors); return; }
    if (serialized !== new URLSearchParams(location.search).toString()) void navigate(`${location.pathname}?${serialized}`, { info: 'frame:filters' });
    setRoute(valid);
    setRangeErrors([]);
    if (resetDraft) setDraft(draftFrom(next));
  }

  function toggleGenre(genre: string, group: 'genres' | 'excludeGenres') {
    const selected = filters[group];
    apply({ ...filters, [group]: selected.includes(genre) ? selected.filter((value) => value !== genre) : [...selected, genre].sort(), page: 1 });
  }

  function submitRanges(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = parseRangeDraft(draft, filters, genres);
    if (next.kind === 'invalid') {
      if (locale === 'en') setRangeErrors(next.errors);
      else {
        const fieldErrors = [...event.currentTarget.querySelectorAll('input')]
          .filter((input) => !input.validity.valid)
          .map((input) => `${input.getAttribute('aria-label')}: یک عدد صحیح بین ${input.min} و ${input.max} وارد کن.`);
        const orderErrors = next.errors.flatMap((error) => {
          if (error === 'The first year must not be after the last year.') return ['سال آغاز نباید از سال پایان بیشتر باشد.'];
          if (error === 'Minimum runtime must not exceed maximum runtime.') return ['حداقل زمان فیلم نباید از حداکثر زمان فیلم بیشتر باشد.'];
          return [];
        });
        setRangeErrors(fieldErrors.length || orderErrors.length ? [...fieldErrors, ...orderErrors] : ['بازهٔ زمان فیلم و سال انتشار را بررسی کن.']);
      }
      return;
    }
    apply(next.filters, true);
  }

  function reset() { apply(defaultFilters(), true); }

  return <div data-testid="discovery" className="discovery">
    <section className="discovery-intro" aria-labelledby="discovery-title">
      <div className="intro-copy">
        <p className="intro-kicker"><span className="tiny-spark" aria-hidden="true">✦</span> {copy(locale, 'For the love of a good film', 'برای عشق به یک فیلم خوب')}</p>
        <h1 id="discovery-title">{copy(locale, 'Less searching.', 'کمتر بگرد.')}<br /><span>{copy(locale, 'More cinema.', 'بیشتر سینما ببین.')}</span></h1>
        <p className="intro-description">{copy(locale, 'You don’t need a title in mind. Just a little idea of what you’re in the mood for.', 'لازم نیست اسم فیلمی را بدانی. از چند سلیقهٔ کوچک شروع کن و انتخابت را پیدا کن.')}</p>
      </div>
      <div className="starting-points">
        <p>{copy(locale, 'Not sure where to start?', 'نمی‌دانی از کجا شروع کنی؟')}</p>
        <button className="recipe" onClick={() => apply({ ...defaultFilters(), runtimeMax: 100 }, true)}><span>{copy(locale, '100 minutes or less', '۱۰۰ دقیقه یا کمتر')}</span><span aria-hidden="true">↗</span></button>
        <button className="recipe" onClick={() => apply({ ...defaultFilters(), genres: ['thriller'], excludeGenres: ['horror'] }, true)}><span>{copy(locale, 'Thrillers, without horror', 'هیجان‌انگیز، بدون ترسناک')}</span><span aria-hidden="true">↗</span></button>
        <button className="recipe" onClick={() => apply({ ...defaultFilters(), yearMin: 1990, yearMax: 1999 }, true)}><span>{copy(locale, 'A trip to the ’90s', 'سفری به دههٔ ۹۰ میلادی')}</span><span aria-hidden="true">↗</span></button>
      </div>
    </section>

    <div className="catalog-notice"><span className="notice-dot" aria-hidden="true" /><span>{copy(locale, 'A fictional film collection', 'مجموعه‌ای از فیلم‌های خیالی')}</span><span className="notice-explanation">{copy(locale, '32 original examples. All titles, scores and release notes are synthetic.', '۳۲ نمونهٔ اختصاصی؛ عنوان‌ها، امتیازها و تاریخ‌های انتشار، نمایشی هستند.')}</span></div>

    {route.kind === 'invalid' ? <div className="feedback error-feedback" role="alert"><h2>{copy(locale, 'This filter link needs a correction', 'این پیوند فیلتر نیاز به اصلاح دارد')}</h2><p>{copy(locale, 'No search was sent. The starting sample below does not match this invalid link.', 'جست‌وجویی ارسال نشد. نمونه‌های زیر نتیجهٔ این پیوند نامعتبر نیستند.')}</p><ul lang="en" dir="ltr">{route.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul><button className="text-button" onClick={reset}>{copy(locale, 'Reset invalid filters', 'پاک کردن فیلترهای نامعتبر')}</button></div> : null}

    <div className="catalog-layout">
      <aside className="filter-rail" aria-label={copy(locale, 'Movie filters', 'فیلترهای فیلم')}>
        <div className="filter-disclosure" data-open={filtersOpen}>
          <div className="filter-desktop-heading"><span className="filter-heading"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2 5h16M2 15h16M7 2v6M13 12v6" stroke="currentColor" strokeWidth="1.5"/></svg>{copy(locale, 'Your preferences', 'سلیقهٔ شما')} {activeCount ? <span className="filter-count">{activeCount}</span> : null}</span></div>
          <button className="filter-toggle" aria-expanded={filtersOpen} aria-controls="movie-filters" onClick={() => setFiltersOpen(!filtersOpen)}><span className="filter-heading">{copy(locale, 'Your preferences', 'سلیقهٔ شما')} {activeCount ? <span className="filter-count">{activeCount}</span> : null}</span><span className="disclosure-symbol" aria-hidden="true">{filtersOpen ? '−' : '+'}</span></button>
          <div className="filters-body" id="movie-filters">
            <div className="filter-section-heading"><span>{copy(locale, 'Make it your kind of film.', 'فیلم را به سلیقه‌ات نزدیک کن.')}</span><button className="text-button" onClick={reset}>{copy(locale, 'Clear filters', 'پاک کردن فیلترها')}</button></div>
            <fieldset className="filter-section"><legend>{copy(locale, 'Include genres', 'ژانرهای دلخواه')}</legend><div className="genre-options">{genres.map((genre) => <label className={`genre-option ${filters.genres.includes(genre) ? 'selected' : ''}`} key={genre}><input type="checkbox" aria-label={copy(locale, `Include ${genreName(genre, locale)}`, `افزودن ${genreName(genre, locale)}`)} checked={filters.genres.includes(genre)} disabled={filters.excludeGenres.includes(genre)} onChange={() => toggleGenre(genre, 'genres')} /><span>{genreName(genre, locale)}</span></label>)}</div>
              <div className="match-options" role="group" aria-label={copy(locale, 'Included genre matching', 'شیوهٔ تطبیق ژانرها')}>{(['any', 'all'] satisfies Filters['genreMode'][]).map((mode) => <label key={mode}><input type="radio" name="genreMode" aria-label={copy(locale, mode === 'any' ? 'Match any included genre' : 'Match all included genres', mode === 'any' ? 'تطبیق یکی از ژانرها' : 'تطبیق همهٔ ژانرها')} checked={filters.genreMode === mode} onChange={() => apply({ ...filters, genreMode: modeSchema.parse(mode), page: 1 })} /><span>{mode === 'any' ? copy(locale, 'Any selected', 'یکی از انتخاب‌ها') : copy(locale, 'All selected', 'همهٔ انتخاب‌ها')}</span></label>)}</div>
            </fieldset>
            <details className="exclude-section"><summary>{copy(locale, 'Leave something out', 'این ژانرها را نمی‌خواهم')}<span>{filters.excludeGenres.length || '+'}</span></summary><fieldset><legend className="sr-only">{copy(locale, 'Exclude genres', 'ژانرهای حذف‌شده')}</legend><p className="filter-hint">{copy(locale, 'Excludes known genre tags. Not a content-safety guarantee.', 'بر پایهٔ برچسب ژانر است؛ تضمینی دربارهٔ محتوای فیلم نیست.')}</p><div className="genre-options">{genres.map((genre) => <label key={genre} className={`genre-option excluded ${filters.excludeGenres.includes(genre) ? 'selected' : ''}`}><input type="checkbox" aria-label={copy(locale, `Exclude ${genreName(genre, locale)}`, `حذف ${genreName(genre, locale)}`)} checked={filters.excludeGenres.includes(genre)} disabled={filters.genres.includes(genre)} onChange={() => toggleGenre(genre, 'excludeGenres')} /><span>{genreName(genre, locale)}</span></label>)}</div></fieldset></details>
            <form className="range-form" onSubmit={submitRanges} noValidate>
              <fieldset className="filter-section"><legend>{copy(locale, 'Runtime', 'زمان فیلم')}</legend><div className="range-inputs"><label>{copy(locale, 'At least', 'حداقل')}<span className="input-with-unit"><input type="number" min={1} max={600} inputMode="numeric" placeholder="—" aria-label={copy(locale, 'Runtime minimum', 'حداقل زمان فیلم')} value={draft.runtimeMin} onChange={(event) => setDraft({ ...draft, runtimeMin: event.target.value })} /><span>{copy(locale, 'min', 'دقیقه')}</span></span></label><span className="range-dash" aria-hidden="true">–</span><label>{copy(locale, 'At most', 'حداکثر')}<span className="input-with-unit"><input type="number" min={1} max={600} inputMode="numeric" placeholder="—" aria-label={copy(locale, 'Runtime maximum', 'حداکثر زمان فیلم')} value={draft.runtimeMax} onChange={(event) => setDraft({ ...draft, runtimeMax: event.target.value })} /><span>{copy(locale, 'min', 'دقیقه')}</span></span></label></div></fieldset>
              <fieldset className="filter-section"><legend>{copy(locale, 'Release year', 'سال انتشار')}</legend><div className="range-inputs"><label>{copy(locale, 'From', 'از')}<input type="number" min={1888} max={2100} inputMode="numeric" placeholder="1888" aria-label={copy(locale, 'Year from', 'سال از')} value={draft.yearMin} onChange={(event) => setDraft({ ...draft, yearMin: event.target.value })} /></label><span className="range-dash" aria-hidden="true">–</span><label>{copy(locale, 'To', 'تا')}<input type="number" min={1888} max={2100} inputMode="numeric" placeholder="2100" aria-label={copy(locale, 'Year to', 'سال تا')} value={draft.yearMax} onChange={(event) => setDraft({ ...draft, yearMax: event.target.value })} /></label></div><p className="filter-hint">{copy(locale, 'Gregorian years in both languages.', 'سال‌های میلادی در هر دو زبان.')}</p><div className="decade-options">{[1990, 2000, 2010, 2020].map((year) => <button type="button" key={year} aria-pressed={filters.yearMin === year && filters.yearMax === year + 9} onClick={() => apply({ ...filters, yearMin: year, yearMax: year + 9, page: 1 }, true)}>{year}s</button>)}</div></fieldset>
              {rangeErrors.length ? <div className="range-errors" role="alert"><p>{copy(locale, 'Check the ranges before applying.', 'بازه‌ها را پیش از اعمال بررسی کن.')}</p><ul lang={locale}>{rangeErrors.map((error, index) => <li key={index}>{error}</li>)}</ul></div> : null}
              <button type="submit" className="apply-button">{copy(locale, 'Apply ranges', 'اعمال بازه‌ها')}<span aria-hidden="true">→</span></button>
            </form>
            <p className="missing-data-note">{copy(locale, 'Films with missing values won’t match an active range.', 'فیلم‌هایی با اطلاعات نامشخص، در بازهٔ فعال قرار نمی‌گیرند.')}</p>
          </div>
        </div>
      </aside>

      <section className="results-section" aria-label={copy(locale, 'Movie results', 'نتایج فیلم‌ها')} aria-busy={pending} data-testid="results">
        <div className="results-toolbar"><div><p className="section-label">{copy(locale, 'THE COLLECTION', 'مجموعهٔ فیلم‌ها')}</p><h2>{!hydrated ? copy(locale, 'A place to begin', 'جایی برای شروع') : matches ? copy(locale, `${data.total} films to explore`, `${data.total} فیلم برای کشف`) : copy(locale, 'Your previous selection', 'انتخاب قبلی شما')}</h2></div><label className="sort-control"><span>{copy(locale, 'Sort by', 'مرتب‌سازی')}</span><select aria-label={copy(locale, 'Sort movies', 'مرتب‌سازی فیلم‌ها')} value={filters.sort} onChange={(event) => apply({ ...filters, sort: sortSchema.parse(event.target.value), page: 1 })}><option value="popularity">{copy(locale, 'Popularity', 'محبوبیت')}</option><option value="rating">{copy(locale, 'Highest rated', 'بالاترین امتیاز')}</option><option value="newest">{copy(locale, 'Newest', 'جدیدترین')}</option><option value="runtime">{copy(locale, 'Shortest runtime', 'کوتاه‌ترین')}</option></select></label></div>
        {activeCount ? <div className="active-filters" aria-label={copy(locale, 'Active filters', 'فیلترهای فعال')}>{filters.genres.map((genre) => <button key={genre} onClick={() => toggleGenre(genre, 'genres')}>{genreName(genre, locale)}<span aria-hidden="true">×</span><span className="sr-only">{copy(locale, 'Remove included genre', 'حذف ژانر دلخواه')}</span></button>)}{filters.excludeGenres.map((genre) => <button className="exclude-chip" key={genre} onClick={() => toggleGenre(genre, 'excludeGenres')}>{copy(locale, 'No ', 'بدون ')}{genreName(genre, locale)}<span aria-hidden="true">×</span><span className="sr-only">{copy(locale, 'Remove exclusion', 'حذف محدودیت ژانر')}</span></button>)}{filters.runtimeMin !== null || filters.runtimeMax !== null ? <button onClick={() => apply({ ...filters, runtimeMin: null, runtimeMax: null, page: 1 }, true)}>{filters.runtimeMin ?? '…'}–{filters.runtimeMax ?? '…'} {copy(locale, 'min', 'دقیقه')}<span aria-hidden="true">×</span><span className="sr-only">{copy(locale, 'Remove runtime range', 'حذف بازهٔ زمان')}</span></button> : null}{filters.yearMin !== null || filters.yearMax !== null ? <button onClick={() => apply({ ...filters, yearMin: null, yearMax: null, page: 1 }, true)}>{filters.yearMin ?? '…'}–{filters.yearMax ?? '…'}<span aria-hidden="true">×</span><span className="sr-only">{copy(locale, 'Remove year range', 'حذف بازهٔ سال')}</span></button> : null}</div> : null}
        <div className="result-status" role="status" aria-live="polite">{!hydrated ? copy(locale, 'Starting sample · 12 of 32 fictional films. Filtered links update after loading.', 'نمونهٔ آغازین · ۱۲ فیلم از ۳۲ فیلم خیالی. پیوندهای فیلترشده پس از بارگذاری به‌روز می‌شوند.') : pending ? <><span className="loading-dot" />{copy(locale, 'Updating your selection. Earlier cards stay visible until results arrive.', 'در حال به‌روزرسانی انتخاب شما؛ کارت‌های قبلی تا دریافت نتیجه نمایش داده می‌شوند.')}</> : matches && !query.isError ? copy(locale, `Showing ${data.items.length ? (data.page - 1) * 12 + 1 : 0}–${Math.min(data.page * 12, data.total)} of ${data.total}`, `نمایش ${data.items.length ? (data.page - 1) * 12 + 1 : 0} تا ${Math.min(data.page * 12, data.total)} از ${data.total}`) : copy(locale, 'These cards are an earlier sample, not results for the current filters.', 'این کارت‌ها نمونهٔ قبلی هستند و نتیجهٔ فیلترهای کنونی نیستند.')}</div>
        {!online || query.isError ? <div className="feedback network-feedback" role="alert"><div><strong>{!online ? copy(locale, 'You’re offline', 'اتصال اینترنت قطع است') : copy(locale, 'The catalog is taking a break', 'دسترسی به فهرست ممکن نشد')}</strong><p>{copy(locale, 'Your earlier cards are still here. Reconnect and try the current filters again.', 'کارت‌های قبلی اینجا هستند. پس از اتصال، فیلترهای فعلی را دوباره امتحان کن.')}</p></div><button className="secondary-button" disabled={!online || query.isFetching} onClick={() => void query.refetch()}>{copy(locale, 'Try again', 'تلاش دوباره')}</button></div> : null}
        {matches && data.items.length === 0 && !query.isError ? <div className="empty-state"><span aria-hidden="true">↔</span><h3>{copy(locale, 'No films fit this combination.', 'فیلمی با این ترکیب پیدا نشد.')}</h3><p>{copy(locale, 'Every preference is still applied. Try removing a genre or widening a range.', 'همهٔ فیلترها حفظ شده‌اند. یک ژانر را بردار یا بازه‌ای را گسترده‌تر کن.')}</p><button className="secondary-button" onClick={reset}>{copy(locale, 'Clear filters', 'پاک کردن فیلترها')}</button></div> : <div className="movie-grid">{data.items.map((movie, index) => <MovieCard key={movie.id} movie={movie} locale={locale} priority={index === 0} />)}</div>}
        <nav className="pagination" aria-label={copy(locale, 'Results pages', 'صفحه‌های نتایج')}><button className="secondary-button" disabled={filters.page <= 1 || pending || !matches} onClick={() => apply({ ...filters, page: filters.page - 1 })}><span aria-hidden="true">←</span>{copy(locale, 'Previous page', 'صفحهٔ قبل')}</button><span>{copy(locale, 'Page', 'صفحهٔ')} {filters.page} {copy(locale, 'of', 'از')} {matches ? Math.max(1, Math.ceil(data.total / 12)) : '…'}</span><button className="secondary-button" disabled={!matches || pending || filters.page * 12 >= data.total} onClick={() => apply({ ...filters, page: filters.page + 1 })}>{copy(locale, 'Next page', 'صفحهٔ بعد')}<span aria-hidden="true">→</span></button></nav>
        <p className="scores-note">{copy(locale, 'Stars are fictional community scores from Synthetic studio, not personal recommendations.', 'ستاره‌ها امتیازهای خیالی از Synthetic studio هستند، نه پیشنهاد شخصی.')}</p>
      </section>
    </div>
  </div>;
}
