import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Activity, ArrowLeft, CalendarDays, Check, ChevronRight, CircleDot, Clock3, MapPin, Radio, RefreshCw, Search, ShieldCheck, Trophy, Tv, VideoOff, WifiOff } from 'lucide-react';
import { Link, Route, Switch, useLocation, useRoute } from 'wouter';
import {
  getGetFootballCompetitionsQueryKey, getGetFootballFixturesQueryKey, getGetFootballMatchQueryKey, getGetFootballStandingsQueryKey,
  useGetFootballCompetitions, useGetFootballFixtures, useGetFootballMatch, useGetFootballStandings,
} from '@workspace/api-client-react';
import type { FootballMatch, FootballMatchStatus } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';

const client = new QueryClient({ defaultOptions: { queries: {
  staleTime: 45_000,
  refetchOnWindowFocus: true,
  retry: (failureCount, error) => {
    const status = error instanceof Error && 'status' in error ? Number(error.status) : undefined;
    if (status === 503 || (status !== undefined && status < 500)) return false;
    return failureCount < 1;
  },
} } });
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dateOffset = (date: string, offset: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const formatDay = (date: string) => new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(/^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : new Date(date));
const formatTime = (date: string) => new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).format(new Date(date));
const isLive = (s: FootballMatchStatus) => s === 'LIVE' || s === 'IN_PLAY';
const isOngoing = (s: FootballMatchStatus) => isLive(s) || s === 'PAUSED';
const isScheduled = (s: FootballMatchStatus) => s === 'SCHEDULED' || s === 'TIMED';
const providerStatus = (s: FootballMatchStatus) => ({ SCHEDULED: 'Scheduled', TIMED: 'Timed', LIVE: 'Live', IN_PLAY: 'In play', PAUSED: 'Paused', FINISHED: 'Full time', POSTPONED: 'Postponed', SUSPENDED: 'Suspended', CANCELLED: 'Cancelled', AWARDED: 'Awarded' })[s];
const statusText = (m: FootballMatch) => {
  if (m.status === 'PAUSED') return 'Half-time';
  if (m.status === 'LIVE' || m.status === 'IN_PLAY') return m.minute === null ? 'Live' : `${m.minute}′`;
  if (m.status === 'FINISHED') return 'Full time';
  if (m.status === 'POSTPONED') return 'Postponed';
  if (m.status === 'CANCELLED') return 'Cancelled';
  if (m.status === 'SUSPENDED') return 'Suspended';
  if (m.status === 'AWARDED') return 'Awarded';
  return formatTime(m.utcDate);
};
function Crest({ src, name, size = 28 }: { src?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase();
  const hue = Array.from(name).reduce((sum, letter) => (sum * 31 + letter.charCodeAt(0)) % 360, 19);
  const safeInitials = initials.replace(/[<>&"']/g, '');
  const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="hsl(${hue} 24% 19%)" stroke="hsl(${hue} 28% 38%)" stroke-width="2"/><text x="32" y="36" dominant-baseline="middle" text-anchor="middle" fill="hsl(${hue} 48% 78%)" font-family="Arial,sans-serif" font-size="20" font-weight="700">${safeInitials || 'FC'}</text></svg>`;
  const fallbackSrc = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(fallbackSvg)}`;
  return <img src={src && !failed ? src : fallbackSrc} alt={`${name} crest`} width={size} height={size} loading="lazy" decoding="async" onError={() => { if (!failed) setFailed(true); }} className="shrink-0 object-contain" data-testid={`${src && !failed ? 'img' : 'fallback-img'}-crest-${initials || 'club'}`}/>;
}
function Header() {
  const [location] = useLocation();
  return <header className="topbar">
    <div className="shell flex h-[68px] items-center justify-between gap-4">
      <Link href="/" className="flex items-center gap-3 text-inherit no-underline" data-testid="link-home">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#78d49a] text-[#111713]"><span className="display text-[20px] font-extrabold">PG</span></span>
        <span><span className="display block text-[18px] font-extrabold leading-tight tracking-[-.055em]">PrimeGoal</span><span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[.17em] text-[#89928e]">The match, in focus</span></span>
      </Link>
      <nav aria-label="Main navigation" className="flex items-center gap-1">
        <Link href="/" data-testid="link-fixtures" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold no-underline transition-colors ${location === '/' ? 'bg-white/[.08] text-white' : 'text-[#aab1b4] hover:bg-white/[.06] hover:text-white'}`}><CalendarDays size={15}/>Fixtures</Link>
        <Link href="/#competitions" data-testid="link-competitions" className="rounded-lg px-3 py-2 text-[12px] font-semibold text-[#aab1b4] no-underline transition-colors hover:bg-white/[.06] hover:text-white">Competitions</Link>
      </nav>
      <div className="hidden items-center gap-2 text-[10px] font-medium text-[#929a9c] md:flex"><ShieldCheck size={14} className="text-[#79ca96]"/>Verified match data</div>
    </div>
  </header>;
}
function LiveChip({ match }: { match: FootballMatch }) {
  const live = isLive(match.status);
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${live ? 'bg-[#163d29] text-[#8ee1a8]' : 'bg-white/[.055] text-[#a2aaad]'}`} data-testid={`status-match-${match.id}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${live ? 'live-pulse bg-[#7ade98]' : 'bg-[#667075]'}`}/>{statusText(match)}
  </span>;
}
function CoverageTag() {
  return <span className="inline-flex items-center gap-1 text-[9px] text-[#858e92]" title="No licensed stream information is available"><Tv size={11}/>Coverage unavailable</span>;
}
function MatchCard({ match }: { match: FootballMatch }) {
  return <Link href={`/match/${match.id}`} aria-label={`${match.homeTeam.name} versus ${match.awayTeam.name}, ${statusText(match)}. Open match centre.`} className="match-row grid grid-cols-[68px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-inherit no-underline sm:grid-cols-[84px_minmax(0,1fr)_minmax(120px,auto)] sm:px-5" data-testid={`link-match-${match.id}`}>
    <div className="flex flex-col items-start gap-1.5"><LiveChip match={match}/>{isLive(match.status) && <span className="ml-1 text-[9px] font-semibold text-[#7ade98]">LIVE NOW</span>}</div>
    <div className="min-w-0 space-y-2">
      <div className="flex items-center gap-2.5"><Crest src={match.homeTeam.crest} name={match.homeTeam.name} size={24}/><span className="min-w-0 flex-1 truncate text-[12px] font-semibold sm:text-[13px]">{match.homeTeam.shortName || match.homeTeam.name}</span><b className="mono min-w-[22px] text-right text-[13px] font-semibold tabular-nums text-[#e5e9e9]">{match.score.home ?? '–'}</b></div>
      <div className="flex items-center gap-2.5"><Crest src={match.awayTeam.crest} name={match.awayTeam.name} size={24}/><span className="min-w-0 flex-1 truncate text-[12px] font-semibold sm:text-[13px]">{match.awayTeam.shortName || match.awayTeam.name}</span><b className="mono min-w-[22px] text-right text-[13px] font-semibold tabular-nums text-[#e5e9e9]">{match.score.away ?? '–'}</b></div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[34px] sm:hidden">{match.stream ? <span className="inline-flex items-center gap-1 text-[9px] text-[#8ee1a8]"><Radio size={11}/>{match.stream.providerName}</span> : <CoverageTag/>}{match.matchday && <span className="text-[9px] text-[#7e888b]">Matchday {match.matchday}</span>}</div>
    </div>
    <div className="hidden min-w-[120px] flex-col items-end gap-1.5 sm:flex"><span className="text-[10px] text-[#939b9e]">{match.matchday ? `Matchday ${match.matchday}` : 'Match centre'}</span>{match.stream ? <span className="inline-flex items-center gap-1 text-[9px] text-[#8ee1a8]"><Radio size={11}/>{match.stream.providerName}</span> : <CoverageTag/>}</div>
    <ChevronRight size={15} className="text-[#626c70] sm:hidden"/>
  </Link>;
}
function LoadingRows() { return <div className="space-y-1 p-4" aria-label="Loading fixtures" data-testid="loading-fixtures">{[0,1,2,3].map(i => <div key={i} className="flex animate-pulse items-center gap-4 border-b border-white/[.05] py-4"><div className="h-5 w-14 rounded-full bg-white/[.07]"/><div className="h-12 flex-1 rounded-lg bg-white/[.055]"/></div>)}</div>; }
function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="px-5 py-14 text-center" data-testid="empty-state"><div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl border border-white/[.08] bg-white/[.035] text-[#8fa69a]"><Trophy size={18}/></div><h3 className="display text-[18px] font-bold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-[#929b9f]">{detail}</p></div>;
}
function Failure({ retry, title = 'The match feed is unavailable', detail = 'We could not reach the football data provider. Your filters and navigation are still available.' }: { retry: () => void; title?: string; detail?: string }) {
  return <div className="px-5 py-12 text-center" role="alert" data-testid="status-fixtures-error"><div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#352c24] text-[#e2b07f]"><WifiOff size={18}/></div><h3 className="display text-[18px] font-bold">{title}</h3><p className="mx-auto mt-2 max-w-md text-[12px] leading-5 text-[#9da5a8]">{detail}</p><p className="mx-auto mt-3 max-w-md text-[11px] leading-5 text-[#7f898e]">If the provider is not configured, an administrator must add <span className="mono text-[#b7c2c1]">FOOTBALL_DATA_API_KEY</span> as a server-side secret. Never put provider keys in browser code.</p><button onClick={retry} data-testid="button-retry-fixtures" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#78d49a] px-4 py-2.5 text-[12px] font-bold text-[#122016] transition-colors hover:bg-[#93e3ad]"><RefreshCw size={14}/>Retry feed</button></div>;
}
type FilterStatus = 'all' | 'live' | 'upcoming' | 'finished';
function FixturesPage() {
  const [date, setDate] = useState(todayIso);
  const [competition, setCompetition] = useState('');
  const [status, setStatus] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const params = useMemo(() => ({ date, ...(competition ? { competition } : {}) }), [date, competition]);
  const fixtures = useGetFootballFixtures(params, { query: { queryKey: getGetFootballFixturesQueryKey(params), refetchInterval: 60_000 } });
  const competitionsQuery = useGetFootballCompetitions({ query: { queryKey: getGetFootballCompetitionsQueryKey() } });
  const allMatches = fixtures.data?.matches ?? [];
  const matches = allMatches.filter(m => {
const state = isOngoing(m.status) ? 'live' : m.status === 'FINISHED' ? 'finished' : isScheduled(m.status) ? 'upcoming' : 'other';
    return (status === 'all' || status === state) && `${m.homeTeam.name} ${m.awayTeam.name} ${m.competition.name}`.toLowerCase().includes(search.trim().toLowerCase());
  });
  const sections = [
    { id: 'live', title: 'Live Now', matches: matches.filter(match => isOngoing(match.status)) },
    { id: 'upcoming', title: date === todayIso() ? "Today's Matches" : 'Upcoming Matches', matches: matches.filter(match => isScheduled(match.status)) },
    { id: 'finished', title: 'Finished Matches', matches: matches.filter(match => match.status === 'FINISHED') },
    { id: 'other', title: 'Other Match Status', matches: matches.filter(match => !isOngoing(match.status) && !isScheduled(match.status) && match.status !== 'FINISHED') },
  ].filter(section => section.matches.length > 0).map(section => ({
    ...section,
    groups: section.matches.reduce<Record<string, FootballMatch[]>>((acc, match) => { (acc[match.competition.code] ??= []).push(match); return acc; }, {}),
  }));
  const choices = [{ label: 'Yesterday', value: dateOffset(todayIso(), -1) }, { label: 'Today', value: todayIso() }, { label: 'Tomorrow', value: dateOffset(todayIso(), 1) }];
  useMeta('Football Fixtures & Live Scores', 'Follow verified football fixtures, live scores and competition schedules on PrimeGoal.');
  return <><Header/><main className="shell pb-16 pt-8">
    <section className="relative mb-7 overflow-hidden rounded-2xl border border-white/[.08] bg-[#171b1e] px-5 py-6 sm:px-8 sm:py-7">
      <div className="pitch-mark pointer-events-none absolute inset-0 opacity-50"/>
      <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><div className="mb-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.18em] text-[#9ba6a8]"><span className="h-px w-5 bg-[#79d49a]"/>Daily fixtures <span className="text-[#687477]">/</span> {formatDay(date)}</div>
          <h1 className="display text-[28px] font-bold leading-tight sm:text-[34px]">{date === todayIso() ? 'Football, in focus.' : formatDay(date)}</h1>
          <p className="mt-2 text-[12px] text-[#9ca6a8]">Scores, kick-offs and match context. No noise.</p>
        </div>
        <div className="flex items-center gap-3 self-start rounded-xl border border-white/[.09] bg-black/20 px-4 py-3 sm:self-auto"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#173b29] text-[#82dfa0]"><Activity size={17}/></span><div><div className="mono text-[20px] font-semibold leading-none">{allMatches.filter(m => isLive(m.status)).length.toString().padStart(2, '0')}</div><div className="mt-1 text-[9px] font-semibold uppercase tracking-[.13em] text-[#969fa1]">Live now</div></div></div>
      </div>
    </section>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_258px]">
      <section className="min-w-0">
        <div className="mb-3 flex flex-col gap-3 rounded-xl border border-white/[.08] bg-[#14171a] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1" role="group" aria-label="Choose fixture date">
            {choices.map(c => <button key={c.label} onClick={() => setDate(c.value)} aria-pressed={date === c.value} data-testid={`button-date-${c.label.toLowerCase()}`} className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${date === c.value ? 'bg-[#78d49a] text-[#142019]' : 'text-[#a7b0b2] hover:bg-white/[.06] hover:text-white'}`}>{c.label}</button>)}
            <label className="relative ml-1 grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-[#aab3b4] hover:bg-white/[.06]" aria-label="Choose a date"><CalendarDays size={16}/><input aria-label="Choose fixture date" type="date" value={date} onChange={e => setDate(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" data-testid="input-date-picker"/></label>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-white/[.09] bg-[#101215] px-3 text-[#8e999b] sm:w-[240px]"><Search size={14}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search team or league" className="w-full min-w-0 bg-transparent text-[11px] text-[#e4e8e8] outline-none placeholder:text-[#737d80]" data-testid="input-search"/></label>
        </div>
        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter match status">
          {(['all','live','upcoming','finished'] as FilterStatus[]).map(v => <button key={v} onClick={() => setStatus(v)} aria-pressed={status === v} className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold capitalize transition-colors ${status === v ? 'border-[#78d49a]/40 bg-[#163321] text-[#8de2a7]' : 'border-white/[.09] bg-[#14171a] text-[#9da7a9] hover:border-white/20'}`} data-testid={`button-status-${v}`}>{v}<span className="mono ml-1.5 opacity-65">{v === 'all' ? allMatches.length : allMatches.filter(m => v === 'live' ? isOngoing(m.status) : v === 'finished' ? m.status === 'FINISHED' : isScheduled(m.status)).length}</span></button>)}
        </div>
        <div className="overflow-hidden rounded-xl border border-white/[.08] bg-[#14171a]" data-testid="list-fixtures">
          {fixtures.isLoading ? <LoadingRows/> : fixtures.isError ? <Failure retry={() => fixtures.refetch()}/> : matches.length === 0
            ? <Empty title={allMatches.length ? 'No matches in this view' : 'No fixtures listed'} detail={allMatches.length ? 'Try another status, competition or search.' : 'There are no provider-listed fixtures for this date. Try yesterday or tomorrow.'}/>
            : sections.map(section => <section key={section.id} className="fade-up" data-testid={`section-matches-${section.id}`}>
              <div className="flex items-center justify-between border-b border-white/[.055] bg-[#121518] px-4 py-2.5 sm:px-5"><h2 className="text-[10px] font-bold uppercase tracking-[.1em] text-[#b7c1c1]">{section.title}</h2><span className="mono text-[9px] text-[#768184]">{section.matches.length}</span></div>
              {Object.entries(section.groups).map(([code, group]) => <div key={`${section.id}-${code}`}>
                <Link href={`/league/${code}`} className="flex items-center justify-between border-b border-white/[.07] bg-[#191d20] px-4 py-3 text-inherit no-underline transition-colors hover:bg-[#1d2325] sm:px-5" data-testid={`link-league-${code}`}>
                  <div className="flex min-w-0 items-center gap-2.5">{group[0].competition.emblem ? <Crest src={group[0].competition.emblem} name={group[0].competition.name} size={22}/> : <span className="grid h-6 w-6 place-items-center rounded-md border border-white/[.09] text-[#a8b4ab]"><Trophy size={12}/></span>}
                    <div className="min-w-0"><div className="truncate text-[11px] font-bold">{group[0].competition.name}</div><div className="text-[9px] text-[#818b8e]">{group[0].competition.areaName || 'Competition'}{group[0].matchday ? ` · Matchday ${group[0].matchday}` : ''}</div></div>
                  </div><span className="ml-2 whitespace-nowrap text-[9px] font-semibold text-[#8e999b]">{group.length} {group.length === 1 ? 'match' : 'matches'} <ChevronRight size={12} className="ml-1 inline"/></span>
                </Link>
                {group.map(match => <div key={match.id} className="border-b border-white/[.055] last:border-0"><MatchCard match={match}/></div>)}
              </div>)}
            </section>)}
          {fixtures.data && !fixtures.isError && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[.07] px-4 py-3 text-[9px] text-[#798386] sm:px-5"><span data-testid="text-fixtures-updated">{fixtures.data.updatedAt ? `Updated ${new Date(fixtures.data.updatedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}` : 'Provider fixture feed'}</span><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#79d49a]"/>Live provider data</span></div>}
        </div>
      </section>
      <aside id="competitions" className="space-y-4">
        <section className="overflow-hidden rounded-xl border border-white/[.08] bg-[#14171a]">
          <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-4"><div><span className="text-[9px] font-bold uppercase tracking-[.14em] text-[#879194]">Browse by league</span><h2 className="display mt-1 text-[17px] font-bold leading-none">Competitions</h2></div><Trophy size={16} className="text-[#8db79a]"/></div>
          <button onClick={() => setCompetition('')} aria-pressed={!competition} className={`flex w-full items-center justify-between px-4 py-3 text-left text-[11px] font-semibold transition-colors ${!competition ? 'bg-[#193322] text-[#8fe0a7]' : 'text-[#aeb6b7] hover:bg-white/[.035]'}`} data-testid="button-all-competitions"><span>All competitions</span><span className="mono">{allMatches.length}</span></button>
          {competitionsQuery.isLoading && <div className="space-y-3 p-4" aria-label="Loading competitions">{[1,2,3].map(i => <div key={i} className="h-4 animate-pulse rounded bg-white/[.06]"/>)}</div>}
          {competitionsQuery.isError && <div className="p-4 text-[10px] leading-5 text-[#c5a181]">Competition list unavailable. <button className="underline" data-testid="button-retry-competitions" onClick={() => competitionsQuery.refetch()}>Retry</button></div>}
          {(competitionsQuery.data?.competitions ?? []).map(c => <button key={c.code} onClick={() => setCompetition(competition === c.code ? '' : c.code)} aria-pressed={competition === c.code} className={`flex w-full items-center gap-2.5 border-t border-white/[.055] px-4 py-3 text-left text-[10px] transition-colors hover:bg-white/[.035] ${competition === c.code ? 'font-bold text-[#8fe0a7]' : 'text-[#aeb6b7]'}`} data-testid={`button-competition-${c.code}`}><Crest src={c.emblem} name={c.name} size={19}/><span className="min-w-0 flex-1 truncate">{c.name}</span>{competition === c.code && <Check size={13}/>}</button>)}
          {!competitionsQuery.isLoading && !competitionsQuery.isError && competitionsQuery.data?.competitions.length === 0 && <p className="px-4 py-3 text-[10px] text-[#858f92]">No competitions available.</p>}
        </section>
        <div className="rounded-xl border border-white/[.07] bg-[#15191b] p-4"><div className="flex items-center gap-2 text-[#9dc7a8]"><ShieldCheck size={14}/><h2 className="text-[10px] font-bold uppercase tracking-[.1em]">A trusted matchday</h2></div><p className="mt-2 text-[10px] leading-[1.7] text-[#909a9c]">Provider-sourced scores and schedules, linked directly to each match centre.</p></div>
      </aside>
    </div>
    <footer className="mt-9 flex flex-col justify-between gap-2 border-t border-white/[.08] pt-4 text-[9px] text-[#737e81] sm:flex-row"><span>PrimeGoal · Football, in focus.</span><span>Fixtures and results supplied by the listed data provider.</span></footer>
  </main></>;
}
function SourceStamp({ updatedAt }: { updatedAt?: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[.09] px-2.5 py-1 text-[9px] font-semibold text-[#9ba5a7]" title={updatedAt ? `Updated ${new Date(updatedAt).toLocaleString()}` : undefined}><span className="h-1.5 w-1.5 rounded-full bg-[#79d49a]"/>Provider data</span>;
}
function StandingsPage() {
  const [, params] = useRoute('/league/:code');
  const code = params?.code ?? '';
  const query = useGetFootballStandings(code, { query: { enabled: !!code, queryKey: getGetFootballStandingsQueryKey(code) } });
  const rows = query.data?.table ?? [];
  useMeta(query.data?.competition.name ? `${query.data.competition.name} Table & Standings` : 'League Standings', 'View provider-sourced football standings on PrimeGoal.');
  return <><Header/><main className="shell min-h-[75vh] py-8">
    <Link href="/" className="mb-6 inline-flex items-center gap-2 text-[11px] font-semibold text-[#9ba7a2] no-underline hover:text-[#8fe0a7]" data-testid="link-back-fixtures"><ArrowLeft size={14}/>Back to fixtures</Link>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="text-[9px] font-bold uppercase tracking-[.16em] text-[#8b9598]">Competition table</div><h1 className="display mt-1 text-[30px] font-bold leading-tight sm:text-[34px]" data-testid="text-competition-name">{query.data?.competition.name || code}</h1><p className="mt-2 text-[11px] text-[#909a9d]">Standings supplied by the competition data provider.</p></div>{query.data && <SourceStamp updatedAt={query.data.updatedAt}/>}</div>
    {query.isLoading ? <div className="space-y-2 rounded-xl border border-white/[.08] bg-[#14171a] p-4" aria-label="Loading standings">{[1,2,3,4,5,6].map(i => <div key={i} className="h-10 animate-pulse rounded bg-white/[.05]"/>)}</div>
    : query.isError ? <section className="rounded-xl border border-white/[.08] bg-[#14171a]"><Failure retry={() => query.refetch()} title="Standings unavailable" detail="The provider could not return standings for this competition. You can retry without losing your place."/></section>
    : rows.length === 0 ? <section className="rounded-xl border border-white/[.08] bg-[#14171a]"><Empty title="No table available" detail="The provider has not supplied standings for this competition."/></section>
    : <div className="overflow-x-auto rounded-xl border border-white/[.08] bg-[#14171a]" data-testid="table-standings"><table className="w-full min-w-[690px] text-left text-[11px]">
      <thead className="bg-[#191d20] text-[9px] font-bold uppercase tracking-[.1em] text-[#8f999c]"><tr><th className="px-4 py-3">Pos</th><th className="px-4 py-3">Club</th><th className="px-3 py-3 text-center">P</th><th className="px-3 py-3 text-center">W</th><th className="px-3 py-3 text-center">D</th><th className="px-3 py-3 text-center">L</th><th className="px-3 py-3 text-center">GF</th><th className="px-3 py-3 text-center">GA</th><th className="px-3 py-3 text-center">GD</th><th className="px-4 py-3 text-right">Pts</th></tr></thead>
      <tbody>{rows.map(row => <tr key={`${row.position}-${row.teamName}`} className="border-t border-white/[.055] hover:bg-white/[.025]" data-testid={`row-standing-${row.position}`}><td className="mono px-4 py-3 text-[#8b9698]">{String(row.position).padStart(2,'0')}</td><td className="px-4 py-3"><div className="flex items-center gap-3 font-semibold"><Crest src={row.crest} name={row.teamName} size={23}/>{row.teamName}</div></td><td className="px-3 py-3 text-center text-[#aab2b4]">{row.playedGames}</td><td className="px-3 py-3 text-center text-[#aab2b4]">{row.won}</td><td className="px-3 py-3 text-center text-[#aab2b4]">{row.draw}</td><td className="px-3 py-3 text-center text-[#aab2b4]">{row.lost}</td><td className="px-3 py-3 text-center text-[#aab2b4]">{row.goalsFor}</td><td className="px-3 py-3 text-center text-[#aab2b4]">{row.goalsAgainst}</td><td className="px-3 py-3 text-center text-[#aab2b4]">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td><td className="mono px-4 py-3 text-right font-semibold text-[#91dfa8]">{row.points}</td></tr>)}</tbody>
    </table></div>}
    {rows.length > 0 && <p className="mt-3 text-right text-[9px] text-[#778184]">P played · GF goals for · GD goal difference · Pts points</p>}
  </main></>;
}
function safeHttps(url: string) { try { return new URL(url).protocol === 'https:'; } catch { return false; } }
function CoveragePanel({ match }: { match: FootballMatch }) {
  const [retryKey, setRetryKey] = useState(0);
  const stream = match.stream;
  const embedUrl = stream && safeHttps(stream.embedUrl) ? stream.embedUrl : null;
  return <section className="overflow-hidden rounded-xl border border-white/[.08] bg-[#14171a]" data-testid="panel-coverage">
    <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3"><div className="flex items-center gap-2"><Tv size={15} className="text-[#a5b2ac]"/><h2 className="text-[11px] font-bold">Video coverage</h2></div><span className={`rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[.08em] ${embedUrl ? 'bg-[#173823] text-[#8fe0a7]' : 'bg-white/[.06] text-[#9aa3a5]'}`}>{embedUrl ? 'Authorized provider' : 'Not connected'}</span></div>
    {embedUrl ? <><div className="aspect-video bg-[#090b0c]"><iframe key={retryKey} src={embedUrl} title={`${stream?.providerName || 'Authorized'} match stream`} className="h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" data-testid="iframe-match-stream"/></div><div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><p className="text-[10px] text-[#a1aaac]">Official coverage via {stream?.providerName}.</p><div className="flex items-center gap-3"><button onClick={() => setRetryKey(key => key + 1)} data-testid="button-reload-stream" className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#aab4b5] hover:text-white"><RefreshCw size={12}/>Reload player</button>{stream?.watchUrl && safeHttps(stream.watchUrl) && <a href={stream.watchUrl} target="_blank" rel="noopener noreferrer" data-testid="link-watch-official" className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8fe0a7] no-underline hover:underline">Official watch page<ChevronRight size={12}/></a>}</div></div></>
      : <div className="flex items-start gap-3 px-4 py-5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[.045] text-[#909b9e]"><VideoOff size={17}/></span><div><p className="text-[11px] font-semibold text-[#d4d9d9]">No licensed stream connected</p><p className="mt-1 max-w-xl text-[10px] leading-5 text-[#899396]">PrimeGoal has no licensed streaming provider connected for this match. We will only show viewing options supplied by an authorized provider.</p></div></div>}
  </section>;
}
function EventList({ match }: { match: FootballMatch }) {
  if (!match.events.length) return <Empty title="No events supplied" detail="The provider has not supplied match events for this fixture." />;
  return <ol className="divide-y divide-white/[.055]" data-testid="list-match-events">{match.events.map((event, index) => <li key={`${event.minute}-${event.type}-${index}`} className="flex items-start gap-3 px-4 py-3" data-testid={`event-match-${match.id}-${index}`}><span className="mono w-9 shrink-0 pt-0.5 text-[10px] text-[#91dca6]">{event.minute === null ? '—' : `${event.minute}′`}</span><span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold text-[#d8dddd]">{event.playerName || event.type}</span><span className="mt-0.5 block text-[9px] text-[#879194]">{[event.detail, event.teamName, event.playerName && event.type].filter(Boolean).join(' · ')}</span></span>{event.score && <span className="mono text-[10px] text-[#aab3b5]">{event.score.home ?? '–'}–{event.score.away ?? '–'}</span>}</li>)}</ol>;
}
function LineupPanel({ match }: { match: FootballMatch }) {
  if (!match.lineups.length) return <Empty title="Lineups not available" detail="The provider has not supplied team lineups for this match." />;
  return <div className="grid gap-px bg-white/[.06] sm:grid-cols-2" data-testid="list-match-lineups">{match.lineups.map((lineup, index) => <section key={`${lineup.teamId}-${lineup.teamName}`} className="bg-[#14171a] px-4 py-4" data-testid={`lineup-team-${lineup.teamId ?? index}`}><div className="flex items-start justify-between gap-3"><div><h3 className="text-[11px] font-bold">{lineup.teamName}</h3><p className="mt-1 text-[9px] text-[#879194]">{[lineup.formation, lineup.coach && `Coach ${lineup.coach}`].filter(Boolean).join(' · ') || 'Team lineup'}</p></div><span className="mono text-[9px] text-[#a6b1b2]">{lineup.starters.length} starters</span></div><ul className="mt-4 space-y-2">{lineup.starters.map((player, i) => <li key={`${player.id}-${player.name}-${i}`} className="flex items-center gap-2 text-[10px]"><span className="mono w-5 text-right text-[#87d79e]">{player.shirtNumber ?? '·'}</span><span className="min-w-0 flex-1 truncate text-[#d0d6d6]">{player.name}</span><span className="text-[9px] text-[#7e898c]">{player.position}</span></li>)}</ul>{lineup.substitutes.length > 0 && <details className="mt-4 border-t border-white/[.07] pt-3"><summary className="cursor-pointer text-[9px] font-semibold text-[#aab3b5]" data-testid={`summary-subs-${lineup.teamId ?? index}`}>Substitutes ({lineup.substitutes.length})</summary><ul className="mt-3 space-y-2">{lineup.substitutes.map((player, i) => <li key={`${player.id}-${player.name}-${i}`} className="flex items-center gap-2 text-[10px]"><span className="mono w-5 text-right text-[#8a9698]">{player.shirtNumber ?? '·'}</span><span className="min-w-0 flex-1 truncate">{player.name}</span><span className="text-[9px] text-[#7e898c]">{player.position}</span></li>)}</ul></details>}</section>)}</div>;
}
function MatchPage() {
  const [, params] = useRoute('/match/:id');
  const id = Number(params?.id);
  const enabled = Number.isFinite(id) && id > 0;
  const query = useGetFootballMatch(id, { query: { enabled, queryKey: getGetFootballMatchQueryKey(id), refetchInterval: 60_000 } });
  const match = query.data;
  const relatedDate = match?.utcDate.slice(0, 10) ?? todayIso();
  const relatedParams = useMemo(() => ({ date: relatedDate }), [relatedDate]);
  const relatedQuery = useGetFootballFixtures(relatedParams, { query: { enabled: !!match, queryKey: getGetFootballFixturesQueryKey(relatedParams) } });
  const related = (relatedQuery.data?.matches ?? []).filter(item => item.competition.code === match?.competition.code && item.id !== match?.id).slice(0, 4);
  useMeta(match ? `${match.homeTeam.name} vs ${match.awayTeam.name} — Match Centre` : 'Match Centre', 'Provider-sourced football match details, events, lineups and authorized coverage on PrimeGoal.');
  return <><Header/><main className="shell min-h-[75vh] py-7">
    <Link href="/" className="mb-5 inline-flex items-center gap-2 text-[11px] font-semibold text-[#9ba7a2] no-underline hover:text-[#8fe0a7]" data-testid="link-back-fixtures"><ArrowLeft size={14}/>All fixtures</Link>
    {query.isLoading ? <div className="animate-pulse rounded-xl border border-white/[.07] bg-[#14171a] p-8" aria-label="Loading match centre" data-testid="loading-match"><div className="mx-auto h-4 w-32 rounded bg-white/[.07]"/><div className="mx-auto mt-8 h-16 max-w-lg rounded bg-white/[.06]"/><div className="mx-auto mt-5 h-4 w-48 rounded bg-white/[.05]"/></div>
    : query.isError || !match ? <section className="rounded-xl border border-white/[.08] bg-[#14171a]"><Failure retry={() => query.refetch()} title="Match centre unavailable" detail="We could not load verified details for this match. Use the fixtures page to return, or retry this provider request."/></section>
     : <div className="space-y-5">
        <section className="overflow-hidden rounded-xl border border-white/[.08] bg-[#14171a]" data-testid="card-match-centre">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.07] bg-[#191d20] px-4 py-3"><Link href={`/league/${match.competition.code}`} className="flex min-w-0 items-center gap-2 text-inherit no-underline hover:text-[#93dda7]" data-testid="link-match-competition">{match.competition.emblem && <Crest src={match.competition.emblem} name={match.competition.name} size={20}/>}<span className="truncate text-[10px] font-semibold">{match.competition.name}</span><ChevronRight size={12} className="shrink-0 text-[#7f898c]"/></Link><SourceStamp/></div>
          <div className="flex justify-center border-b border-white/[.055] px-3 py-2 text-[9px] text-[#949ea0]" data-testid="text-kickoff">{formatDay(match.utcDate)} · {formatTime(match.utcDate)}{match.matchday ? ` · Matchday ${match.matchday}` : ''}</div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-9 sm:px-8 sm:py-11">
            <div className="flex min-w-0 flex-col items-center text-center"><Crest src={match.homeTeam.crest} name={match.homeTeam.name} size={56}/><h1 className="display mt-3 max-w-full break-words text-[16px] font-bold leading-tight sm:text-[20px]" data-testid="text-home-team">{match.homeTeam.name}</h1><span className="mt-1 text-[8px] font-semibold uppercase tracking-[.12em] text-[#7f898c]">Home</span></div>
            <div className="min-w-[96px] text-center sm:min-w-[150px]"><div className="mono flex items-center justify-center gap-2 text-[35px] font-medium leading-none tabular-nums sm:gap-4 sm:text-[48px]" data-testid="text-match-score"><span>{match.score.home ?? '–'}</span><span className="text-[#626d70]">:</span><span>{match.score.away ?? '–'}</span></div><div className="mt-3 flex justify-center"><LiveChip match={match}/></div><p className="mt-2 text-[8px] font-medium uppercase tracking-[.1em] text-[#758083]" data-testid="text-provider-status">Provider status · {providerStatus(match.status)}</p></div>
            <div className="flex min-w-0 flex-col items-center text-center"><Crest src={match.awayTeam.crest} name={match.awayTeam.name} size={56}/><h2 className="display mt-3 max-w-full break-words text-[16px] font-bold leading-tight sm:text-[20px]" data-testid="text-away-team">{match.awayTeam.name}</h2><span className="mt-1 text-[8px] font-semibold uppercase tracking-[.12em] text-[#7f898c]">Away</span></div>
          </div>
          <div className="grid gap-3 border-t border-white/[.06] bg-[#171a1d] px-4 py-4 sm:grid-cols-2 sm:px-6">
            <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.045] text-[#9faeaa]"><Clock3 size={14}/></span><div><div className="text-[8px] font-bold uppercase tracking-[.11em] text-[#7d888b]">Kick-off</div><div className="mt-1 text-[10px] font-semibold">{formatTime(match.utcDate)} · {new Date(match.utcDate).toLocaleDateString()}</div></div></div>
            <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.045] text-[#9faeaa]"><MapPin size={14}/></span><div><div className="text-[8px] font-bold uppercase tracking-[.11em] text-[#7d888b]">Venue</div><div className="mt-1 text-[10px] font-semibold">{match.venue || 'Venue details not listed'}</div></div></div>
          </div>
        </section>
        <CoveragePanel match={match}/>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
        <section className="overflow-hidden rounded-xl border border-white/[.08] bg-[#14171a]"><div className="flex items-center gap-2 border-b border-white/[.07] px-4 py-3"><CircleDot size={14} className="text-[#92dba7]"/><h2 className="text-[11px] font-bold">Match events</h2><span className="ml-auto text-[9px] text-[#7f898c]">{match.events.length ? `${match.events.length} updates` : 'Provider feed'}</span></div><EventList match={match}/></section>
        <section className="overflow-hidden rounded-xl border border-white/[.08] bg-[#14171a]"><div className="flex items-center gap-2 border-b border-white/[.07] px-4 py-3"><Activity size={14} className="text-[#92dba7]"/><h2 className="text-[11px] font-bold">Lineups</h2></div><LineupPanel match={match}/></section>
          </div>
          <aside className="space-y-4">
        <section className="overflow-hidden rounded-xl border border-white/[.08] bg-[#14171a]"><div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3"><div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#818c8f]">{match.competition.areaName || 'Competition'}</p><h2 className="mt-1 text-[11px] font-bold">More from this competition</h2></div><Trophy size={14} className="text-[#a7b9ac]"/></div>
          {relatedQuery.isLoading ? <div className="space-y-3 p-4" aria-label="Loading related fixtures">{[1,2].map(i => <div key={i} className="h-12 animate-pulse rounded bg-white/[.05]"/>)}</div>
          : relatedQuery.isError ? <div className="px-4 py-4 text-[10px] leading-5 text-[#929b9e]">Related fixtures are unavailable right now. <button onClick={() => relatedQuery.refetch()} data-testid="button-retry-related" className="text-[#8fe0a7] underline">Retry</button></div>
          : related.length ? related.map(item => <div key={item.id} className="border-b border-white/[.055] last:border-0"><MatchCard match={item}/></div>)
          : <p className="px-4 py-5 text-[10px] leading-5 text-[#899396]" data-testid="empty-related">No other fixtures from this competition are listed for this match date.</p>}
        </section>
          </aside>
        </div>
      </div>}
  </main></>;
}
function useMeta(title: string, description: string) {
  useEffect(() => {
    document.title = `${title} | PrimeGoal`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', description);
    const og = document.querySelector('meta[property="og:title"]');
    if (og) og.setAttribute('content', `${title} | PrimeGoal`);
  }, [title, description]);
}
function Router() {
  return <Switch><Route path="/" component={FixturesPage}/><Route path="/league/:code" component={StandingsPage}/><Route path="/match/:id" component={MatchPage}/><Route component={NotFound}/></Switch>;
}
function App() { return <QueryClientProvider client={client}><Router/></QueryClientProvider>; }
export default App;
