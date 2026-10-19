import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const groups = ['recent-mainstream', 'older-mainstream', 'international', 'iranian', 'independent-documentary'];
export const fieldNames = ['titleEn', 'titleOriginal', 'year', 'runtime', 'genres', 'originalLanguage', 'productionCountries', 'rating', 'voteCount', 'titleFa', 'synopsisEn', 'synopsisFa', 'poster'];
const states = ['unknown', 'usable', 'missing', 'unusable'];
const allowedTypes = ['feature', 'documentary', 'animation'];
const DAY = 86_400_000;
const demand = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const oneOf = (value, choices, label) => demand(choices.includes(value), `${label}: unsupported value`);
const date = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const timestamp = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && date(value.slice(0, 10));
const normalize = (title) => title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function url(value, label) {
  if (value === null) return;
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${label}: expected public HTTPS evidence URL or null`); }
  demand(parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash, `${label}: use HTTPS without credentials, query parameters or fragment`);
}

export function validateSample(sample) {
  demand(sample.version === 1 && date(sample.frozenAt), 'Invalid sample version or freeze date');
  demand(Array.isArray(sample.films) && sample.films.length === 40, 'Sample must contain exactly 40 films');
  const ids = new Set(), identities = new Set();
  for (const film of sample.films) {
    demand(text(film.id) && !ids.has(film.id), 'Duplicate or missing sample ID'); ids.add(film.id);
    demand(text(film.title) && Number.isInteger(film.year) && film.year >= 1888 && film.year <= 2100, `${film.id}: invalid title/year`);
    const key = `${normalize(film.title)}:${film.year}`;
    demand(!identities.has(key), `${film.id}: duplicate title/year`); identities.add(key);
    oneOf(film.group, groups, `${film.id}.group`);
    demand(typeof film.releaseCheck === 'boolean' && text(film.rationale) && text(film.ambiguity), `${film.id}: document selection and ambiguity`);
    url(film.referenceUrl, `${film.id}.referenceUrl`);
    demand(text(film.referenceUrl), `${film.id}: public identity reference required`);
  }
  for (const group of groups) demand(sample.films.filter((film) => film.group === group).length === 8, `${group}: expected eight disjoint films`);
  const releases = sample.films.filter((film) => film.releaseCheck);
  demand(releases.length === 12 && releases.filter((film) => film.group === 'recent-mainstream').length === 8 && releases.filter((film) => ['international', 'iranian'].includes(film.group)).length === 4, 'Release subset must be eight recent plus four international/Iranian films');
  return sample;
}

export const sample = validateSample(JSON.parse(readFileSync(new URL('../docs/audit/sample.json', import.meta.url), 'utf8')));
export const sampleHash = createHash('sha256').update(JSON.stringify(sample)).digest('hex');
const blankEvent = () => ({ country: null, type: null, date: null, status: 'unknown', sourceUrl: null, checkedAt: null });

export function template() {
  return { version: 1, sampleHash, provider: null, permissionRecord: null, rows: sample.films.map((film) => ({
    sampleId: film.id, group: film.group, releaseCheck: film.releaseCheck,
    sourceId: null, sourceUrl: null, checkedAt: null, retentionDeadline: null,
    identity: 'unknown', identityNote: '', movieType: 'unknown',
    titleAlternatives: [], fields: Object.fromEntries(fieldNames.map((field) => [field, 'unknown'])),
    originalLanguage: null, productionCountries: null, rating: null, voteCount: null,
    persianTitleReview: 'unknown', posterRights: 'unknown', posterRightsRecord: null,
    release: film.releaseCheck ? { provider: blankEvent(), official: blankEvent() } : null,
    uncertainty: '', correctionMinutes: null, unsupportedFileClaim: 'unknown',
  })) };
}

function validateEvent(event, label) {
  demand(event && typeof event === 'object', `${label}: event object required`);
  oneOf(event.status, ['unknown', 'missing', 'scheduled', 'observed'], `${label}.status`);
  demand(event.country === null || /^[A-Z]{2}$/.test(event.country), `${label}.country: two-letter code required`);
  demand(event.type === null || ['digital', 'physical'].includes(event.type), `${label}.type: only digital or physical`);
  demand(event.date === null || date(event.date), `${label}.date: invalid calendar date`);
  demand(event.checkedAt === null || timestamp(event.checkedAt), `${label}.checkedAt: UTC timestamp required`);
  url(event.sourceUrl, `${label}.sourceUrl`);
  if (event.status === 'unknown') demand(['country', 'type', 'date', 'sourceUrl', 'checkedAt'].every((field) => event[field] === null), `${label}: unknown event must remain blank`);
  if (['observed', 'scheduled'].includes(event.status)) {
    demand(event.country && event.type && event.date && event.sourceUrl && event.checkedAt, `${label}: dated event needs country, type and provenance`);
    demand((event.date > event.checkedAt.slice(0, 10)) === (event.status === 'scheduled'), `${label}: future dates must be scheduled, past dates do not prove observed offers`);
  }
  if (event.status === 'missing') demand(event.sourceUrl && event.checkedAt && event.country === null && event.type === null && event.date === null, `${label}: missing event needs provenance and empty country/type/date`);
}

export function validateAudit(audit) {
  demand(audit.version === 1 && audit.sampleHash === sampleHash, 'Audit must use the frozen sample hash/version');
  demand(Array.isArray(audit.rows) && audit.rows.length === 40, 'Audit must contain exactly 40 rows');
  demand(audit.provider === null || text(audit.provider), 'Provider must be a name or null');
  demand(audit.permissionRecord === null || text(audit.permissionRecord), 'Permission record must be a private evidence reference or null');
  const ids = new Set(), sourceIds = new Set();
  for (const row of audit.rows) {
    const film = sample.films.find((film) => film.id === row.sampleId);
    const label = row.sampleId ?? 'row';
    demand(film && !ids.has(row.sampleId), 'Duplicate or unknown sample row'); ids.add(row.sampleId);
    demand(row.group === film.group && row.releaseCheck === film.releaseCheck, `${label}: group/release subset cannot change`);
    demand(row.fields && fieldNames.every((field) => Object.hasOwn(row.fields, field)) && Object.keys(row.fields).length === fieldNames.length, `${label}: all field states required`);
    for (const field of fieldNames) oneOf(row.fields[field], states, `${label}.${field}`);
    oneOf(row.identity, ['unknown', 'matched', 'mismatch', 'ambiguous'], `${label}.identity`);
    oneOf(row.movieType, ['unknown', ...allowedTypes, 'series', 'short', 'adult', 'other'], `${label}.movieType`);
    oneOf(row.persianTitleReview, ['unknown', 'accepted', 'rejected'], `${label}.persianTitleReview`);
    oneOf(row.posterRights, ['unknown', 'cleared', 'denied'], `${label}.posterRights`);
    oneOf(row.unsupportedFileClaim, ['unknown', 'none', 'present'], `${label}.unsupportedFileClaim`);
    demand(typeof row.identityNote === 'string' && typeof row.uncertainty === 'string', `${label}: notes must be strings`);
    demand(Array.isArray(row.titleAlternatives) && row.titleAlternatives.every(text), `${label}: title alternatives must be strings (empty means none recorded)`);
    demand(row.sourceId === null || text(row.sourceId), `${label}: source ID required or null`);
    if (row.sourceId !== null) {
      demand(!sourceIds.has(row.sourceId), `${label}: duplicate source ID; resolve identity/remake mapping`); sourceIds.add(row.sourceId);
    }
    url(row.sourceUrl, `${label}.sourceUrl`);
    demand(row.checkedAt === null || timestamp(row.checkedAt), `${label}: checkedAt must be UTC timestamp or null`);
    demand(row.retentionDeadline === null || date(row.retentionDeadline), `${label}: retention deadline must be date or null`);
    if (row.checkedAt && row.retentionDeadline) demand(row.retentionDeadline >= row.checkedAt.slice(0, 10), `${label}: retention expires before check`);
    if (row.identity === 'matched') demand(row.sourceId && text(row.identityNote) && allowedTypes.includes(row.movieType), `${label}: matched needs source ID, title/year disambiguation note and eligible movie type`);
    demand(row.persianTitleReview !== 'accepted' || row.fields.titleFa === 'usable', `${label}: accepted Persian title must be usable`);
    demand(row.posterRightsRecord === null || text(row.posterRightsRecord), `${label}: poster rights evidence reference or null required`);
    demand(row.posterRights !== 'cleared' || (row.fields.poster === 'usable' && text(row.posterRightsRecord)), `${label}: poster clearance needs evidence and a usable poster`);
    demand(row.originalLanguage === null || /^[a-z]{2,3}$/.test(row.originalLanguage), `${label}: invalid original-language code`);
    demand(row.productionCountries === null || (Array.isArray(row.productionCountries) && row.productionCountries.length > 0 && row.productionCountries.every((code) => /^[A-Z]{2}$/.test(code)) && new Set(row.productionCountries).size === row.productionCountries.length), `${label}: invalid production-country codes`);
    demand(row.rating === null || (typeof row.rating === 'number' && Number.isFinite(row.rating) && row.rating >= 0 && row.rating <= 10), `${label}: rating must be 0–10 or null`);
    demand(row.voteCount === null || (Number.isSafeInteger(row.voteCount) && row.voteCount >= 0), `${label}: votes must be nonnegative integer or null`);
    for (const field of ['originalLanguage', 'productionCountries', 'rating', 'voteCount']) demand((row.fields[field] === 'usable') === (row[field] !== null), `${label}.${field}: usable state and recorded value must agree`);
    demand(row.correctionMinutes === null || (typeof row.correctionMinutes === 'number' && Number.isFinite(row.correctionMinutes) && row.correctionMinutes >= 0), `${label}: correction minutes must be nonnegative or null`);
    if (film.releaseCheck) { validateEvent(row.release?.provider, `${label}.release.provider`); validateEvent(row.release?.official, `${label}.release.official`); }
    else demand(row.release === null, `${label}: not in frozen release subset`);
    const observed = row.identity !== 'unknown' || row.movieType !== 'unknown' || Object.values(row.fields).some((state) => state !== 'unknown') || row.sourceId !== null || row.persianTitleReview !== 'unknown' || row.posterRights !== 'unknown' || row.titleAlternatives.length > 0 || row.unsupportedFileClaim !== 'unknown' || (row.release && [row.release.provider, row.release.official].some((event) => event.status !== 'unknown'));
    if (observed) demand(text(audit.provider) && text(audit.permissionRecord) && row.sourceUrl && row.checkedAt && row.retentionDeadline, `${label}: observations require provider, private permission reference, source, check time and retention deadline`);
  }
  return audit;
}

const eligible = (row) => row.identity === 'matched' && allowedTypes.includes(row.movieType);
const core = (row) => eligible(row) && (row.fields.titleEn === 'usable' || row.fields.titleOriginal === 'usable') && ['year', 'runtime', 'genres'].every((field) => row.fields[field] === 'usable');
const languageCountry = (row) => eligible(row) && row.fields.originalLanguage === 'usable' && row.fields.productionCountries === 'usable';
const releaseAgreement = (row) => eligible(row) && row.release && ['provider', 'official'].every((source) => row.release[source].status === 'observed') && ['country', 'type', 'date'].every((field) => row.release.provider[field] === row.release.official[field]);
const criterion = (count, total, threshold, unknown, extra = true) => ({ count, total, threshold, status: count >= threshold && extra ? 'PASS' : unknown > 0 ? 'NOT VERIFIED' : 'FAIL' });

export function summarize(audit, previous = null, asOf = new Date().toISOString().slice(0, 10)) {
  validateAudit(audit); demand(date(asOf), 'Invalid report date');
  const rows = audit.rows, unknown = rows.filter((row) => row.identity === 'unknown').length;
  for (const row of rows) {
    demand(!row.checkedAt || row.checkedAt.slice(0, 10) <= asOf, `${row.sampleId}: observation is after report date`);
    if (row.release) for (const source of ['provider', 'official']) demand(!row.release[source].checkedAt || row.release[source].checkedAt.slice(0, 10) <= asOf, `${row.sampleId}: release check is after report date`);
  }
  const ambiguous = rows.filter((row) => row.identity === 'ambiguous').map((row) => row.sampleId);
  const groupCounts = Object.fromEntries(groups.map((group) => {
    const subset = rows.filter((row) => row.group === group);
    return [group, { total: 8, core: subset.filter(core).length, languageCountry: subset.filter(languageCountry).length }];
  }));
  const releases = rows.filter((row) => row.releaseCheck);
  const fieldStates = Object.fromEntries(fieldNames.map((field) => [field, Object.fromEntries(states.map((state) => [state, rows.filter((row) => row.fields[field] === state).length]))]));
  const criteria = {
    identity: criterion(rows.filter(eligible).length, 40, 38, unknown, ambiguous.length === 0),
    core: criterion(rows.filter(core).length, 40, 36, rows.filter((row) => row.identity === 'unknown' || (eligible(row) && ['titleEn', 'titleOriginal', 'year', 'runtime', 'genres'].some((field) => row.fields[field] === 'unknown'))).length, Object.values(groupCounts).every((group) => group.core >= 6)),
    languageCountry: criterion(rows.filter(languageCountry).length, 40, 36, rows.filter((row) => row.identity === 'unknown' || (eligible(row) && ['originalLanguage', 'productionCountries'].some((field) => row.fields[field] === 'unknown'))).length, Object.values(groupCounts).every((group) => group.languageCountry >= 6)),
    persianTitle: criterion(rows.filter((row) => eligible(row) && row.persianTitleReview === 'accepted').length, 40, 32, rows.filter((row) => row.persianTitleReview === 'unknown').length),
    release: criterion(releases.filter(releaseAgreement).length, 12, 10, releases.filter((row) => [row.release.provider, row.release.official].some((event) => ['unknown', 'scheduled'].includes(event.status))).length),
  };
  const releaseDisagreements = releases.filter((row) => ['provider', 'official'].every((source) => row.release[source].status === 'observed') && !releaseAgreement(row)).map((row) => row.sampleId);
  const expiredRows = rows.filter((row) => row.retentionDeadline && row.retentionDeadline < asOf).map((row) => row.sampleId);
  let recheck = { status: 'NOT VERIFIED', checkedAfterSevenDays: 0, total: 40, changedRows: [], changedReleaseDates: [], disappearingOffers: [], correctionMinutes: null };
  if (previous) {
    validateAudit(previous);
    demand(previous.provider === audit.provider && text(audit.provider), 'Recheck must use the same provider');
    let minutes = 0, minutesKnown = true;
    for (const row of rows) {
      const before = previous.rows.find((item) => item.sampleId === row.sampleId);
      if (row.checkedAt && before.checkedAt) demand(Date.parse(row.checkedAt) >= Date.parse(before.checkedAt), `${row.sampleId}: recheck precedes baseline`);
      const complete = (item) => item.identity !== 'unknown' && Object.values(item.fields).every((state) => state !== 'unknown') && item.persianTitleReview !== 'unknown' && item.posterRights !== 'unknown' && item.unsupportedFileClaim !== 'unknown' && (!item.release || ['provider', 'official'].every((source) => item.release[source].status !== 'unknown'));
      const releaseRechecked = !row.release || ['provider', 'official'].every((source) => row.release[source].checkedAt && before.release[source].checkedAt && Date.parse(row.release[source].checkedAt) - Date.parse(before.release[source].checkedAt) >= 7 * DAY);
      if (row.checkedAt && before.checkedAt && Date.parse(row.checkedAt) - Date.parse(before.checkedAt) >= 7 * DAY && complete(row) && complete(before) && releaseRechecked) recheck.checkedAfterSevenDays++;
      const relevant = (item) => [item.sourceId, item.identity, item.movieType, fieldNames.map((field) => item.fields[field]), item.persianTitleReview,
        [...item.titleAlternatives].sort(), item.originalLanguage, item.productionCountries ? [...item.productionCountries].sort() : null,
        item.rating, item.voteCount, item.posterRights, item.posterRightsRecord,
        item.release ? ['provider', 'official'].map((source) => ['country', 'type', 'date', 'status', 'sourceUrl'].map((field) => item.release[source][field])) : null];
      if (JSON.stringify(relevant(row)) !== JSON.stringify(relevant(before))) recheck.changedRows.push(row.sampleId);
      if (row.release) {
        if (['provider', 'official'].some((source) => row.release[source].date !== before.release[source].date)) recheck.changedReleaseDates.push(row.sampleId);
        if (before.release.official.status === 'observed' && row.release.official.status === 'missing') recheck.disappearingOffers.push(row.sampleId);
      }
      if (row.correctionMinutes === null) minutesKnown = false; else minutes += row.correctionMinutes;
    }
    recheck.correctionMinutes = minutesKnown ? minutes : null;
    recheck.status = recheck.checkedAfterSevenDays === 40 && minutesKnown ? 'PASS' : 'NOT VERIFIED';
  }
  return {
    sampleHash, provider: audit.provider, asOf, evaluatedRows: rows.filter((row) => row.checkedAt !== null).length, total: 40,
    ingestionAuthorization: 'NOT GRANTED BY THIS TOOL', permissionRecorded: text(audit.permissionRecord),
    criteria, groupCounts, fieldStates, ambiguous, releaseDisagreements, expiredRows,
    posterRights: Object.fromEntries(['unknown', 'cleared', 'denied'].map((state) => [state, rows.filter((row) => row.posterRights === state).length])),
    unsupportedFileClaims: rows.filter((row) => row.unsupportedFileClaim === 'present').map((row) => row.sampleId),
    fileClaimChecksUnknown: rows.filter((row) => row.unsupportedFileClaim === 'unknown').length,
    recheck,
  };
}

export function run(args) {
  const [command, input, prior, ...extra] = args;
  demand(!extra.length, 'Too many arguments');
  if (command === 'init' && !input && !prior) return template();
  if (command === 'report' && input) return summarize(JSON.parse(readFileSync(input, 'utf8')), prior ? JSON.parse(readFileSync(prior, 'utf8')) : null);
  throw new Error('Usage: node scripts/catalog-audit.mjs init | report AUDIT.json [BASELINE.json]');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${JSON.stringify(run(process.argv.slice(2)), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Audit invalid: ${error.message}\n`); process.exitCode = 1;
  }
}
