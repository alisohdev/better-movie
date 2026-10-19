import { copy, genreName, movieTitle, type Locale, type Movie } from '../lib/model';

export function MovieCard({ movie, locale, priority = false }: { movie: Movie; locale: Locale; priority?: boolean }) {
  const title = movieTitle(movie, locale);
  return <article className="movie-card" data-testid="movie-card" data-movie-id={movie.id}>
    <a className="movie-link" data-movie-link href={`/${locale}/movies/${movie.id}/`}>
      <div className="poster-wrap">
        <img src={movie.poster} alt="" width={300} height={450} sizes="(max-width: 599px) calc((100vw - 52px) / 2), (max-width: 900px) 28vw, 18vw" loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" />
        {movie.rating !== null ? <span className="score"><span className="sr-only">{movie.synthetic ? copy(locale, 'Synthetic score ', 'امتیاز نمایشی ') : copy(locale, 'TMDB community score ', 'امتیاز کاربران TMDB ')}</span><span aria-hidden="true">★</span> {movie.rating.toFixed(1)}<span className="sr-only">{copy(locale, ' out of 10', ' از ۱۰')}</span></span> : <span className="score score-unknown">{copy(locale, 'Unscored', 'بدون امتیاز')}</span>}
        <span className="poster-open" aria-hidden="true">↗</span>
      </div>
      <h3 dir="auto">{title}</h3>
    </a>
    <p className="movie-meta"><span>{movie.year ?? copy(locale, 'Year unknown', 'سال نامشخص')}</span><span aria-hidden="true">·</span><span>{movie.runtime === null ? copy(locale, 'Runtime unknown', 'زمان نامشخص') : copy(locale, `${movie.runtime} min`, `${movie.runtime} دقیقه`)}</span></p>
    <p className="movie-genres">{movie.genres.length ? movie.genres.map((genre) => genreName(genre, locale)).join(copy(locale, ' / ', ' / ')) : copy(locale, 'Genres unrecorded', 'ژانر ثبت نشده')}</p>
  </article>;
}
