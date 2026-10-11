import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, CircleDot, Clock3, Search, Trophy, Radio, ArrowLeft, MapPin, RefreshCw, Info } from 'lucide-react';
import { Link, Route, Switch, useLocation, useRoute } from 'wouter';
import {
  useGetFootballFixtures, getGetFootballFixturesQueryKey, useGetFootballCompetitions,
  getGetFootballCompetitionsQueryKey, useGetFootballStandings, getGetFootballStandingsQueryKey,
  useGetFootballMatch, getGetFootballMatchQueryKey,
} from '@workspace/api-client-react';
import type { FootballMatch, FootballMatchStatus } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 45_000, refetchOnWindowFocus: true } } });
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dateOffset = (date: string, offset: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const formatDay = (date: string) => {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : new Date(date);
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(parsed);
};
const formatTime = (date: string) => new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).format(new Date(date));
const isLive = (s: FootballMatchStatus) => ['LIVE', 'IN_PLAY', 'PAUSED'].includes(s);
const statusLabel = (match: FootballMatch) => {
  if (isLive(match.status)) return match.status === 'PAUSED' ? 'Half-time' : `${match.minute ?? 'LIVE'}${match.minute ? '′' : ''}`;
  if (match.status === 'FINISHED') return 'FT';
  if (match.status === 'POSTPONED') return 'Postponed';
  if (match.status === 'CANCELLED') return 'Cancelled';
  return formatTime(match.utcDate);
};
function Crest({ src, name, size = 30 }: { src?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return src && !failed
    ? <img src={src} alt={`${name} crest`} width={size} height={size} loading="lazy" onError={() => setFailed(true)} className="object-contain shrink-0" />
    : <span aria-label={`${name} crest unavailable`} className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#e9e3d5] text-[#315c48] font-bold text-[10px]" style={{ width: size, height: size }}>{name.slice(0, 2).toUpperCase()}</span>;
}
function SourcePill({ source, updatedAt }: { source?: string; updatedAt?: string }) {
  const demo = source === 'demo';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.09em] ${demo ? 'bg-[#f7e8d8] text-[#995329]' : 'bg-[#e0eee5] text-[#276442]'}`} title={updatedAt ? `Updated ${new Date(updatedAt).toLocaleString()}` : undefined}>
    <span className={`h-1.5 w-1.5 rounded-full ${demo ? 'bg-[#d77a3b]' : 'bg-[#318352] live-pulse'}`} />{demo ? 'Demo data' : 'Provider data'}
  </span>;
}
function Header() {
  const [location] = useLocation();
  return <header className="topbar">
    <div className="shell flex h-[72px] items-center justify-between gap-5">
      <Link href="/" className="flex items-center gap-3 text-inherit no-underline" data-testid="link-home">
        <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#ed8750] text-[#183b30]"><span className="display text-[26px] font-bold leading-none">P</span></span>
        <span><span className="display block text-[25px] font-bold leading-none tracking-tight">PrimeGoal</span><span className="mt-1 block text-[9px] font-semibold uppercase tracking-[.22em] text-[#b4c7ba]">Football, in focus</span></span>
      </Link>
      <nav aria-label="Main navigation" className="flex items-center gap-1 text-sm font-semibold">
        <Link href="/" data-testid="link-fixtures" className={`flex items-center gap-2 rounded-lg px-3 py-2 no-underline transition-colors ${location === '/' ? 'bg-white/10 text-white' : 'text-[#c0d0c6] hover:bg-white/5 hover:text-white'}`}><CalendarDays size={16}/>Fixtures</Link>
        <Link href="/#competitions" className="hidden rounded-lg px-3 py-2 text-[#c0d0c6] no-underline transition-colors hover:bg-white/5 hover:text-white sm:block">Competitions</Link>
      </nav>
      <div className="hidden items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-[#d3ddd6] md:flex"><CircleDot size={12} className="text-[#ed8750]"/><span>Every match. One place.</span></div>
    </div>
  </header>;
}
function MatchCard({ match }: { match: FootballMatch }) {
  const live = isLive(match.status);
  return <Link href={`/match/${match.id}`} className="match-row grid grid-cols-[54px_minmax(0,1fr)_76px] items-center gap-3 px-4 py-3.5 text-inherit no-underline sm:grid-cols-[62px_minmax(0,1fr)_118px] sm:px-5" data-testid={`link-match-${match.id}`}>
    <div className="text-center">
      <span className={`display text-[13px] font-semibold ${live ? 'text-[#ce6841]' : 'text-[#777f75]'}`}>{statusLabel(match)}</span>
      {live && <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[.12em] text-[#cf7044]">Live</span>}
    </div>
    <div className="min-w-0">
      <div className="flex items-center gap-2.5">
        <Crest src={match.homeTeam.crest} name={match.homeTeam.shortName || match.homeTeam.name} size={25}/>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold sm:text-[14px]">{match.homeTeam.shortName || match.homeTeam.name}</span>
        <b className="display min-w-[19px] text-center text-[16px] font-bold tabular-nums">{match.score.home ?? '–'}</b>
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        <Crest src={match.awayTeam.crest} name={match.awayTeam.shortName || match.awayTeam.name} size={25}/>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold sm:text-[14px]">{match.awayTeam.shortName || match.awayTeam.name}</span>
        <b className="display min-w-[19px] text-center text-[16px] font-bold tabular-nums">{match.score.away ?? '–'}</b>
      </div>
    </div>
    <div className="hidden text-right sm:block"><span className="rounded bg-[#f0ede5] px-2 py-1 text-[10px] font-semibold text-[#70786e]">{match.matchday ? `Matchday ${match.matchday}` : live ? 'In progress' : 'Match centre'}</span></div>
    <div className="text-right text-[10px] font-medium text-[#8a8c82] sm:hidden">{live ? 'LIVE' : match.status === 'FINISHED' ? 'FT' : ''}</div>
  </Link>;
}
function SkeletonList() {
  return <div className="space-y-3 p-4" aria-label="Loading fixtures">{[1,2,3,4].map(x => <div key={x} className="flex animate-pulse items-center gap-4 py-3"><div className="h-8 w-10 rounded bg-[#ebe6da]"/><div className="h-12 flex-1 rounded bg-[#ebe6da]"/><div className="h-8 w-10 rounded bg-[#ebe6da]"/></div>)}</div>;
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="px-5 py-14 text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#edf0e8] text-[#4c7459]"><Trophy size={21}/></div><h3 className="display text-[23px] font-bold">{title}</h3><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#737b71]">{detail}</p></div>;
}
function Failure({ retry }: { retry: () => void }) {
  return <div className="p-10 text-center"><p className="display text-xl font-bold">Fixtures could not load</p><p className="mt-1 text-sm text-[#747c72]">The match feed is having a moment. Try again shortly.</p><button onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#245b40] px-4 py-2 text-sm font-semibold text-white"><RefreshCw size={14}/>Try again</button></div>;
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
    const matchStatus = isLive(m.status) ? 'live' : m.status === 'FINISHED' ? 'finished' : 'upcoming';
    const text = `${m.homeTeam.name} ${m.awayTeam.name} ${m.competition.name}`.toLowerCase();
    return (status === 'all' || status === matchStatus) && text.includes(search.trim().toLowerCase());
  });
  const groups = matches.reduce<Record<string, FootballMatch[]>>((acc, match) => { (acc[match.competition.code] ??= []).push(match); return acc; }, {});
  const dateChoices = [{ label: 'Yesterday', value: dateOffset(todayIso(), -1) }, { label: 'Today', value: todayIso() }, { label: 'Tomorrow', value: dateOffset(todayIso(), 1) }];
  const liveCount = allMatches.filter(m => isLive(m.status)).length;
  useMeta('Football Fixtures & Live Scores', 'Follow today’s football fixtures, live scores and competition schedules in one clear daily view on PrimeGoal.');
  return <><Header/><main className="shell pb-16 pt-8">
    <section className="relative mb-7 overflow-hidden rounded-[20px] bg-[#1e4939] px-6 py-7 text-[#f7f2e8] sm:px-9 sm:py-9">
      <div className="pitch-mark pointer-events-none absolute inset-0 opacity-75"/>
      <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div><div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#b6cdbd]"><span className="h-px w-6 bg-[#ed8750]"/>The daily fixture list</div>
          <h1 className="display text-[42px] font-bold leading-[.93] sm:text-[54px]">{date === todayIso() ? 'Matchday,' : 'Football,'}<br/><span className="text-[#f09460]">{date === todayIso() ? 'at a glance.' : formatDay(date).split(',')[0] + '.'}</span></h1>
          <p className="mt-3 text-sm text-[#c8d7cc]">{formatDay(date)} <span className="mx-2 text-[#74917f]">/</span> Scores, kick-offs and match context.</p>
        </div>
        <div className="flex items-center gap-3 self-start rounded-xl border border-white/15 bg-white/[.07] px-4 py-3 sm:self-auto"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#ed8750] text-[#1e4939]"><Radio size={18}/></span><div><div className="display text-2xl font-bold leading-none">{liveCount.toString().padStart(2, '0')}</div><div className="mt-1 text-[9px] font-bold uppercase tracking-[.16em] text-[#bbcec0]">Live right now</div></div></div>
      </div>
    </section>
    {fixtures.data?.source === 'demo' && <div role="status" className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#ead2b7] bg-[#fff4e8] px-4 py-3 text-[12px] leading-5 text-[#824e2d]" data-testid="status-demo-data"><Info size={16} className="mt-0.5 shrink-0"/><span><strong>Demo data.</strong> These example fixtures and scores are not live results.</span></div>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_264px]">
      <section className="min-w-0">
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#e2ded3] bg-[#fbfaf6] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
          <div className="flex items-center gap-1" role="group" aria-label="Choose fixture date">
            {dateChoices.map(choice => <button key={choice.label} onClick={() => setDate(choice.value)} aria-pressed={date === choice.value} data-testid={`button-date-${choice.label.toLowerCase()}`} className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${date === choice.value ? 'bg-[#255940] text-white' : 'text-[#687369] hover:bg-[#efeee6]'}`}>{choice.label}</button>)}
            <label className="ml-1 grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-[#677368] hover:bg-[#efeee6]" aria-label="Choose a date"><CalendarDays size={16}/><input aria-label="Choose fixture date" type="date" value={date} onChange={e => setDate(e.target.value)} className="absolute h-9 w-9 cursor-pointer opacity-0" data-testid="input-date-picker"/></label>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#e5e1d7] bg-[#fffefa] px-3 text-[#85877f] sm:w-[230px]"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a team or league" className="w-full bg-transparent text-[12px] text-[#273d31] outline-none placeholder:text-[#9a9b93]" data-testid="input-search"/></label>
        </div>
        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter match status">
          {(['all','live','upcoming','finished'] as FilterStatus[]).map(v => <button key={v} onClick={() => setStatus(v)} aria-pressed={status === v} className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${status === v ? 'border-[#285c42] bg-[#285c42] text-white' : 'border-[#e1ddd2] bg-[#fbfaf6] text-[#6b756a] hover:border-[#9aaf9c]'}`} data-testid={`button-status-${v}`}>{v === 'live' && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#df8050]"/>}{v} <span className="ml-1 opacity-70">{v === 'all' ? allMatches.length : allMatches.filter(m => v === 'live' ? isLive(m.status) : v === 'finished' ? m.status === 'FINISHED' : !isLive(m.status) && m.status !== 'FINISHED').length}</span></button>)}
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#e2ded3] bg-[#fbfaf6]">
          {fixtures.isLoading ? <SkeletonList/> : fixtures.isError ? <Failure retry={() => fixtures.refetch()}/> : matches.length === 0
            ? <Empty title={allMatches.length ? 'No matches in this view' : 'A quiet day on the pitch'} detail={allMatches.length ? 'Try another status, competition or search term.' : 'There are no listed fixtures for this date. Check yesterday or tomorrow for more action.'}/>
            : Object.entries(groups).map(([code, group]) => <div key={code} className="fade-up">
              <Link href={`/league/${code}`} className="flex items-center justify-between border-b border-[#e6e1d7] bg-[#f2f0e8] px-4 py-3 text-inherit no-underline transition-colors hover:bg-[#ece9df] sm:px-5" data-testid={`link-league-${code}`}>
                <div className="flex min-w-0 items-center gap-2.5">{group[0].competition.emblem ? <Crest src={group[0].competition.emblem} name={group[0].competition.name} size={23}/> : <span className="grid h-6 w-6 place-items-center rounded-md bg-[#e2e8dd] text-[#376148]"><Trophy size={13}/></span>}
                  <div className="min-w-0"><div className="truncate text-[12px] font-bold">{group[0].competition.name}</div><div className="text-[9px] text-[#85877c]">{group[0].competition.areaName || 'Competition'}{group[0].matchday ? ` · Matchday ${group[0].matchday}` : ''}</div></div>
                </div><span className="ml-2 text-[10px] font-semibold text-[#798176]">{group.length} {group.length === 1 ? 'match' : 'matches'} <ChevronRight size={13} className="ml-1 inline"/></span>
              </Link>
              {group.map(match => <div key={match.id} className="border-b border-[#ece8df] last:border-b-0"><MatchCard match={match}/></div>)}
            </div>)}
          <div className="flex items-center justify-between border-t border-[#e8e4da] px-4 py-3 text-[10px] text-[#81847b] sm:px-5"><span>{fixtures.data?.updatedAt ? `Updated ${new Date(fixtures.data.updatedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}` : 'Fixture feed'}</span><SourcePill source={fixtures.data?.source} updatedAt={fixtures.data?.updatedAt}/></div>
        </div>
      </section>
      <aside id="competitions" className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-[#e2ded3] bg-[#fbfaf6]">
          <div className="flex items-center justify-between border-b border-[#e8e4da] px-4 py-4"><div><span className="text-[9px] font-bold uppercase tracking-[.16em] text-[#8b8d83]">Make it yours</span><h2 className="display mt-0.5 text-[21px] font-bold leading-none">Competitions</h2></div><Trophy size={17} className="text-[#c96d45]"/></div>
          <button onClick={() => setCompetition('')} aria-pressed={!competition} className={`flex w-full items-center justify-between px-4 py-3 text-left text-[12px] font-semibold transition-colors ${!competition ? 'bg-[#eaf0e8] text-[#285c42]' : 'text-[#556157] hover:bg-[#f3f1e9]'}`} data-testid="button-all-competitions"><span>All competitions</span><span>{allMatches.length}</span></button>
          {competitionsQuery.isLoading && <div className="space-y-3 p-4"><div className="h-4 animate-pulse rounded bg-[#ebe6da]"/><div className="h-4 animate-pulse rounded bg-[#ebe6da]"/></div>}
          {competitionsQuery.isError && <button className="p-4 text-left text-xs text-[#9b5c3d] underline" onClick={() => competitionsQuery.refetch()}>Couldn’t load competitions — retry</button>}
          {(competitionsQuery.data?.competitions ?? []).map(c => <button key={c.code} onClick={() => setCompetition(competition === c.code ? '' : c.code)} aria-pressed={competition === c.code} className={`flex w-full items-center gap-2.5 border-t border-[#efede6] px-4 py-3 text-left text-[12px] transition-colors hover:bg-[#f3f1e9] ${competition === c.code ? 'font-bold text-[#285c42]' : 'text-[#596359]'}`} data-testid={`button-competition-${c.code}`}><Crest src={c.emblem} name={c.name} size={20}/><span className="min-w-0 flex-1 truncate">{c.name}</span><span className="h-1.5 w-1.5 rounded-full bg-[#d7d5cc]"/></button>)}
        </section>
        <div className="rounded-2xl bg-[#eae9dd] p-4"><div className="flex items-center gap-2 text-[#315a42]"><Clock3 size={15}/><h2 className="text-[11px] font-bold uppercase tracking-[.1em]">A cleaner matchday</h2></div><p className="mt-2 text-[11px] leading-[1.7] text-[#697166]">Pick a date, narrow the field, and get straight to the score. Match pages hold the extra context.</p></div>
      </aside>
    </div>
    <footer className="mt-10 flex flex-col justify-between gap-2 border-t border-[#e2ded3] pt-4 text-[10px] text-[#85887f] sm:flex-row"><span>PrimeGoal — the game, without the noise.</span><span>Scores and schedules may update as competitions confirm.</span></footer>
  </main></>;
}
function StandingsPage() {
  const [, params] = useRoute('/league/:code');
  const code = params?.code ?? '';
  const query = useGetFootballStandings(code, { query: { enabled: Boolean(code), queryKey: getGetFootballStandingsQueryKey(code) } });
  const rows = query.data?.table ?? [];
  useMeta(query.data?.competition.name ? `${query.data.competition.name} Table & Standings` : 'League Standings', 'View football league standings, points, goal difference and team positions on PrimeGoal.');
  return <><Header/><main className="shell min-h-[75vh] py-8">
    <Link href="/" className="mb-6 inline-flex items-center gap-2 text-[12px] font-semibold text-[#607264] no-underline hover:text-[#285c42]"><ArrowLeft size={15}/>Back to fixtures</Link>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#888b80]">Competition table</div><h1 className="display mt-1 text-[42px] font-bold leading-none sm:text-[52px]">{query.data?.competition.name || code}</h1><p className="mt-2 text-sm text-[#70796e]">The standings, from first whistle to final day.</p></div>{query.data && <SourcePill source={query.data.source} updatedAt={query.data.updatedAt}/>}</div>
    <div className="overflow-x-auto rounded-2xl border border-[#e2ded3] bg-[#fbfaf6]">
      <table className="w-full min-w-[690px] text-left text-sm">
        <thead className="bg-[#f0eee6] text-[9px] font-bold uppercase tracking-[.1em] text-[#81847a]"><tr><th className="px-4 py-3">Pos</th><th className="px-4 py-3">Club</th><th className="px-3 py-3 text-center">P</th><th className="px-3 py-3 text-center">W</th><th className="px-3 py-3 text-center">D</th><th className="px-3 py-3 text-center">L</th><th className="px-3 py-3 text-center">GF</th><th className="px-3 py-3 text-center">GA</th><th className="px-3 py-3 text-center">GD</th><th className="px-4 py-3 text-right">Pts</th></tr></thead>
        <tbody>{query.isLoading ? [1,2,3,4,5].map(i => <tr key={i}><td colSpan={10} className="px-4 py-3"><div className="h-5 animate-pulse rounded bg-[#ebe6da]"/></td></tr>) : query.isError ? <tr><td colSpan={10} className="p-8 text-center"><p className="font-semibold">Standings unavailable</p><button onClick={() => query.refetch()} className="mt-2 text-sm text-[#285c42] underline">Retry</button></td></tr> : rows.length ? rows.map(row => <tr key={`${row.position}-${row.teamName}`} className="border-t border-[#eeebe2] hover:bg-[#f5f3ec]" data-testid={`row-standing-${row.position}`}><td className="px-4 py-3 font-semibold text-[#778075]">{String(row.position).padStart(2,'0')}</td><td className="px-4 py-3"><div className="flex items-center gap-3 font-semibold"><Crest src={row.crest} name={row.teamName} size={24}/>{row.teamName}</div></td><td className="px-3 py-3 text-center text-[#687267]">{row.playedGames}</td><td className="px-3 py-3 text-center text-[#687267]">{row.won}</td><td className="px-3 py-3 text-center text-[#687267]">{row.draw}</td><td className="px-3 py-3 text-center text-[#687267]">{row.lost}</td><td className="px-3 py-3 text-center text-[#687267]">{row.goalsFor}</td><td className="px-3 py-3 text-center text-[#687267]">{row.goalsAgainst}</td><td className="px-3 py-3 text-center text-[#687267]">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td><td className="px-4 py-3 text-right font-bold text-[#275a40]">{row.points}</td></tr>) : <tr><td colSpan={10}><Empty title="No table yet" detail="Standings will appear when this competition has table data available."/></td></tr>}</tbody>
      </table>
    </div><p className="mt-3 text-right text-[10px] text-[#85887f]">P played · GF goals for · GD goal difference · Pts points</p>
  </main></>;
}
function MatchPage() {
  const [, params] = useRoute('/match/:id');
  const id = Number(params?.id);
  const query = useGetFootballMatch(id, { query: { enabled: Number.isFinite(id) && id > 0, queryKey: getGetFootballMatchQueryKey(id), refetchInterval: 60_000 } });
  const match = query.data;
  useMeta(match ? `${match.homeTeam.name} vs ${match.awayTeam.name} — Match Centre` : 'Match Centre', 'Football match centre with score, kick-off time, competition, venue and match status on PrimeGoal.');
  return <><Header/><main className="shell min-h-[75vh] py-8"><Link href="/" className="mb-6 inline-flex items-center gap-2 text-[12px] font-semibold text-[#607264] no-underline hover:text-[#285c42]"><ArrowLeft size={15}/>All fixtures</Link>
    {query.isLoading ? <div className="animate-pulse rounded-3xl bg-[#e9e5da] p-16"><div className="mx-auto h-5 w-1/3 rounded bg-[#dcd7ca]"/><div className="mx-auto mt-10 h-20 w-2/3 rounded bg-[#dcd7ca]"/></div> : query.isError || !match ? <div className="rounded-2xl border border-[#e2ded3] bg-[#fbfaf6]"><Empty title="Match unavailable" detail="We couldn’t find this match right now. Return to the fixture list and choose another match."/><div className="pb-7 text-center"><button onClick={() => query.refetch()} className="rounded-lg bg-[#285c42] px-4 py-2 text-sm font-semibold text-white">Try again</button></div></div> :
    <><div className="mb-6 flex items-center justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#888b80]">Match centre</div><h1 className="display mt-1 text-[35px] font-bold leading-none sm:text-[44px]">{match.competition.name}</h1></div><span className="rounded-full bg-[#eeece4] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.09em] text-[#687267]">Match details</span></div>
      <section className="overflow-hidden rounded-[24px] border border-[#e2ded3] bg-[#fbfaf6]">
        <div className="bg-[#1e4939] px-5 py-4 text-center text-[11px] font-semibold text-[#c6d6ca]">{formatDay(match.utcDate)}{match.matchday ? ` · Matchday ${match.matchday}` : ''}</div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-10 sm:px-12 sm:py-14">
          <div className="flex flex-col items-center text-center"><Crest src={match.homeTeam.crest} name={match.homeTeam.name} size={62}/><h2 className="display mt-4 max-w-full text-[22px] font-bold sm:text-[30px]">{match.homeTeam.name}</h2><span className="mt-1 text-[10px] uppercase tracking-[.12em] text-[#86887f]">Home</span></div>
          <div className="min-w-[118px] text-center sm:min-w-[180px]"><div className="display flex items-center justify-center gap-3 text-[42px] font-bold leading-none tabular-nums sm:gap-5 sm:text-[64px]"><span>{match.score.home ?? '–'}</span><span className="text-[#c0bbae]">:</span><span>{match.score.away ?? '–'}</span></div><span className={`mt-4 inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[.1em] ${isLive(match.status) ? 'bg-[#f7e6db] text-[#a34e2f]' : 'bg-[#eeece4] text-[#6c7368]'}`}>{statusLabel(match)}</span></div>
          <div className="flex flex-col items-center text-center"><Crest src={match.awayTeam.crest} name={match.awayTeam.name} size={62}/><h2 className="display mt-4 max-w-full text-[22px] font-bold sm:text-[30px]">{match.awayTeam.name}</h2><span className="mt-1 text-[10px] uppercase tracking-[.12em] text-[#86887f]">Away</span></div>
        </div>
        <div className="grid gap-3 border-t border-[#e9e5db] bg-[#f5f3ec] px-5 py-5 sm:grid-cols-2 sm:px-10">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e7e9df] text-[#4d7157]"><Clock3 size={16}/></span><div><div className="text-[9px] font-bold uppercase tracking-[.12em] text-[#929388]">Kick-off</div><div className="mt-0.5 text-[12px] font-semibold">{formatTime(match.utcDate)} · {new Date(match.utcDate).toLocaleDateString()}</div></div></div>
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e7e9df] text-[#4d7157]"><MapPin size={16}/></span><div><div className="text-[9px] font-bold uppercase tracking-[.12em] text-[#929388]">Venue</div><div className="mt-0.5 text-[12px] font-semibold">{match.venue || 'Venue details not listed'}</div></div></div>
        </div>
      </section>
      <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#e2ded3] bg-[#fbfaf6] p-4"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#edf0e8] text-[#315a42]"><Trophy size={15}/></span><div><p className="text-[12px] font-bold">{match.competition.name}</p><p className="mt-0.5 text-[10px] text-[#81857a]">{match.competition.areaName || 'Competition'} · {match.status === 'FINISHED' ? 'Full time' : isLive(match.status) ? 'Match in progress' : 'Scheduled fixture'}</p></div><Link href={`/league/${match.competition.code}`} className="ml-auto text-[11px] font-bold text-[#285c42] no-underline hover:underline">Standings <ChevronRight size={14} className="inline"/></Link></div>
    </>}
  </main></>;
}
function useMeta(title: string, description: string) {
  useEffect(() => { document.title = `${title} | PrimeGoal`; const meta = document.querySelector('meta[name="description"]'); if (meta) meta.setAttribute('content', description); const og = document.querySelector('meta[property="og:title"]'); if (og) og.setAttribute('content', `${title} | PrimeGoal`); }, [title, description]);
}
function Router() {
  return <Switch><Route path="/" component={FixturesPage}/><Route path="/league/:code" component={StandingsPage}/><Route path="/match/:id" component={MatchPage}/><Route component={NotFound}/></Switch>;
}
function App() { return <QueryClientProvider client={client}><Router/></QueryClientProvider>; }
export default App;
