import type {
  FootballCompetition,
  FootballLineup,
  FootballMatch,
  FootballMatchEvent,
  FootballPlayer,
  FootballStream,
  FootballStandingRow,
} from "@workspace/api-zod";
import { logger } from "./logger";

const API_ROOT = "https://api.football-data.org/v4";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type CacheEntry = { expiresAt: number; value: unknown };
const responseCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = responseCache.get(key);
  if (entry && entry.expiresAt > now) return entry.value as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const request = load()
    .then((value) => {
      responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      if (responseCache.size > 400) {
        const time = Date.now();
        for (const [cacheKey, cachedValue] of responseCache) {
          if (cachedValue.expiresAt <= time) responseCache.delete(cacheKey);
        }
      }
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

function mapCompetition(value: unknown): FootballCompetition {
  const item = object(value);
  const area = object(item.area);
  const code = text(item.code) ?? (numberOrNull(item.id) === null ? null : String(item.id));
  const name = text(item.name);
  if (!code || !name) throw new FootballProviderError("Football data provider returned an invalid competition.");
  return {
    code,
    name,
    emblem: text(item.emblem),
    areaName: text(area.name),
  };
}

function mapTeam(value: unknown): FootballMatch["homeTeam"] {
  const item = object(value);
  const name = text(item.name);
  if (!name) throw new FootballProviderError("Football data provider returned a match without a team name.");
  return {
    id: numberOrNull(item.id),
    name,
    shortName: text(item.shortName),
    crest: text(item.crest),
  };
}

function mapPlayer(value: unknown): FootballPlayer | null {
  const item = object(value);
  const name = text(item.name);
  if (!name) return null;
  return {
    id: numberOrNull(item.id),
    name,
    position: text(item.position),
    shirtNumber: numberOrNull(item.shirtNumber),
  };
}

function mapPlayers(value: unknown): FootballPlayer[] {
  return Array.isArray(value)
    ? value.map(mapPlayer).filter((player): player is FootballPlayer => player !== null)
    : [];
}

function mapLineup(value: unknown, fallbackTeam?: JsonObject): FootballLineup | null {
  const item = object(value);
  const hasLineupData = ["lineup", "players", "formation", "coach", "bench", "substitutes"]
    .some((key) => item[key] != null);
  if (!hasLineupData) return null;
  const team = object(item.team);
  const teamName = text(team.name) ?? text(item.teamName) ?? text(fallbackTeam?.name);
  if (!teamName) return null;
  const bench = item.bench ?? item.substitutes;
  return {
    teamId: numberOrNull(team.id) ?? numberOrNull(fallbackTeam?.id),
    teamName,
    formation: text(item.formation),
    coach: text(object(item.coach).name) ?? text(item.coach),
    starters: mapPlayers(item.lineup ?? item.players),
    substitutes: mapPlayers(bench),
  };
}

function mapLineups(item: JsonObject): FootballLineup[] {
  const raw = item.lineups;
  if (Array.isArray(raw)) {
    return raw.map((lineup) => mapLineup(lineup)).filter((lineup): lineup is FootballLineup => lineup !== null);
  }
  const home = object(item.homeTeam);
  const away = object(item.awayTeam);
  const paired = object(raw);
  const explicit = [
    mapLineup(paired.home, home),
    mapLineup(paired.away, away),
  ].filter((lineup): lineup is FootballLineup => lineup !== null);
  if (explicit.length) return explicit;
  return [
    mapLineup(home, home),
    mapLineup(away, away),
  ].filter((lineup): lineup is FootballLineup => lineup !== null);
}

function eventScore(value: unknown): FootballMatchEvent["score"] {
  if (!value || typeof value !== "object") return null;
  const score = object(value);
  return {
    home: numberOrNull(score.home),
    away: numberOrNull(score.away),
  };
}

function mapEvents(item: JsonObject): FootballMatchEvent[] {
  const events: FootballMatchEvent[] = [];
  const goals = Array.isArray(item.goals) ? item.goals : [];
  for (const value of goals) {
    const event = object(value);
    const team = object(event.team);
    const scorer = object(event.scorer);
    const assist = object(event.assist);
    events.push({
      minute: numberOrNull(event.minute),
      type: text(event.type) ?? "Goal",
      teamName: text(team.name),
      playerName: text(scorer.name),
      detail: text(assist.name) ? `Assist: ${text(assist.name)}` : null,
      score: eventScore(event.score),
    });
  }

  const bookings = Array.isArray(item.bookings) ? item.bookings : [];
  for (const value of bookings) {
    const event = object(value);
    events.push({
      minute: numberOrNull(event.minute),
      type: text(event.type) ?? "Booking",
      teamName: text(object(event.team).name),
      playerName: text(object(event.player).name),
      detail: null,
      score: null,
    });
  }

  const substitutions = Array.isArray(item.substitutions) ? item.substitutions : [];
  for (const value of substitutions) {
    const event = object(value);
    const playerIn = text(object(event.playerIn).name);
    const playerOut = text(object(event.playerOut).name);
    events.push({
      minute: numberOrNull(event.minute),
      type: "Substitution",
      teamName: text(object(event.team).name),
      playerName: playerIn,
      detail: playerOut ? `For ${playerOut}` : null,
      score: null,
    });
  }
  return events.sort((a, b) => (a.minute ?? Number.MAX_SAFE_INTEGER) - (b.minute ?? Number.MAX_SAFE_INTEGER));
}

function mapMatch(value: unknown): FootballMatch {
  const item = object(value);
  const score = object(item.score);
  const fullTime = object(score.fullTime);
  const utcDate = text(item.utcDate);
  if (!utcDate || !Number.isInteger(item.id)) {
    throw new FootballProviderError("Football data provider returned an invalid match.");
  }
  const homeTeam = mapTeam(item.homeTeam);
  const awayTeam = mapTeam(item.awayTeam);
  return {
    id: item.id as number,
    utcDate: new Date(utcDate),
    status: normalizeStatus(text(item.status)),
    minute: numberOrNull(item.minute),
    competition: mapCompetition(item.competition),
    homeTeam,
    awayTeam,
    score: {
      home: numberOrNull(fullTime.home) ?? numberOrNull(object(score.halfTime).home),
      away: numberOrNull(fullTime.away) ?? numberOrNull(object(score.halfTime).away),
    },
    matchday: numberOrNull(item.matchday),
    venue: text(item.venue),
    events: mapEvents(item),
    lineups: mapLineups(item),
    // A score provider does not grant or expose broadcast rights. Only a licensed
    // server-side streaming adapter may populate this field.
    stream: null as FootballStream | null,
  };
}

function normalizeStatus(
  status: string | null,
): FootballMatch["status"] {
  switch (status) {
    case "TIMED":
    case "LIVE":
    case "IN_PLAY":
    case "PAUSED":
    case "FINISHED":
    case "POSTPONED":
    case "SUSPENDED":
    case "CANCELLED":
    case "AWARDED":
      return status;
    case "SCHEDULED":
    default:
      return "SCHEDULED";
  }
}

export class FootballProviderError extends Error {
  constructor(message: string, readonly statusCode: 502 | 503 = 502) {
    super(message);
    this.name = "FootballProviderError";
  }
}

function safeProviderText(value: unknown, token: string): string | undefined {
  if (typeof value !== "string") return undefined;
  const safe = value
    .split(token)
    .join("[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  return safe || undefined;
}

function summarizeProviderError(body: string, token: string): {
  providerErrorCode?: string;
  providerMessage?: string;
} {
  if (!body) return {};
  try {
    const parsed = object(JSON.parse(body));
    const errorCode = parsed.errorCode;
    const providerErrorCode =
      typeof errorCode === "string" || typeof errorCode === "number"
        ? safeProviderText(String(errorCode), token)?.slice(0, 80)
        : undefined;
    return {
      ...(providerErrorCode ? { providerErrorCode } : {}),
      providerMessage: safeProviderText(parsed.message ?? parsed.error, token),
    };
  } catch {
    return { providerMessage: safeProviderText(body, token) };
  }
}

async function requestFootballData<T>(path: string): Promise<T> {
  const token = process.env.FOOTBALL_DATA_API_KEY?.trim();
  if (!token) {
    throw new FootballProviderError(
      "Live football data is not configured. Add FOOTBALL_DATA_API_KEY in Replit Secrets.",
      503,
    );
  }
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      headers: { "X-Auth-Token": token },
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    logger.error(
      {
        provider: "football-data.org",
        endpoint: path,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Football data request failed before receiving a response",
    );
    throw new FootballProviderError("Football data provider is unavailable.");
  }
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    const details = summarizeProviderError(errorBody, token);
    logger.error(
      {
        provider: "football-data.org",
        endpoint: path,
        providerStatus: response.status,
        ...details,
      },
      "Football data provider rejected the request",
    );
    throw new FootballProviderError(
      `Football data provider returned HTTP ${response.status}.`,
    );
  }
  try {
    return (await response.json()) as T;
  } catch {
    logger.error(
      {
        provider: "football-data.org",
        endpoint: path,
        providerStatus: response.status,
      },
      "Football data provider returned invalid JSON",
    );
    throw new FootballProviderError("Football data provider returned invalid data.");
  }
}

export async function getCompetitions() {
  return cached("competitions", 30 * 60_000, async () => {
    const body = await requestFootballData<{ competitions?: unknown[] }>("/competitions");
    const competitions = (Array.isArray(body.competitions) ? body.competitions : [])
      .map(mapCompetition)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { source: "live" as const, updatedAt: new Date().toISOString(), competitions };
  });
}

export async function getFixtures(date: string, competition?: string) {
  const key = `fixtures:${date}:${competition ?? "all"}`;
  return cached(key, 45_000, async () => {
    // The global list accepts `date`; competition-scoped lists ignore it and use the range filters.
    const query = competition
      ? new URLSearchParams({ dateFrom: date, dateTo: date })
      : new URLSearchParams({ date });
    const endpoint = competition
      ? `/competitions/${encodeURIComponent(competition)}/matches?${query}`
      : `/matches?${query}`;
    const body = await requestFootballData<{ matches?: unknown[] }>(endpoint);
    const matches = (Array.isArray(body.matches) ? body.matches : []).map(mapMatch);
    return { source: "live" as const, updatedAt: new Date().toISOString(), matches };
  });
}

export async function getMatch(id: number) {
  return cached(`match:${id}`, 30_000, async () => {
    const body = await requestFootballData<unknown>(`/matches/${id}`);
    return mapMatch(body);
  });
}

export async function getStandings(code: string) {
  return cached(`standings:${code}`, 5 * 60_000, async () => {
    const body = await requestFootballData<JsonObject>(
      `/competitions/${encodeURIComponent(code)}/standings`,
    );
    const upstreamCompetition = mapCompetition(body.competition);
    const standings = Array.isArray(body.standings) ? body.standings : [];
    const totalTable = standings
      .map(object)
      .find((standing) => standing.type === "TOTAL");
    const selected = totalTable ?? object(standings[0]);
    const tableData = Array.isArray(selected.table) ? selected.table : [];
    if (!tableData.length) return null;
    const table: FootballStandingRow[] = tableData.map((value) => {
      const row = object(value);
      const team = object(row.team);
      const goals = object(row.goals);
      const teamName = text(team.name);
      if (!teamName) {
        throw new FootballProviderError("Football data provider returned a table row without a team name.");
      }
      return {
        position: numberOrNull(row.position) ?? 0,
        teamId: numberOrNull(team.id),
        teamName,
        crest: text(team.crest),
        playedGames: numberOrNull(row.playedGames) ?? 0,
        won: numberOrNull(row.won) ?? 0,
        draw: numberOrNull(row.draw) ?? 0,
        lost: numberOrNull(row.lost) ?? 0,
        points: numberOrNull(row.points) ?? 0,
        goalsFor: numberOrNull(goals.for) ?? 0,
        goalsAgainst: numberOrNull(goals.against) ?? 0,
        goalDifference: numberOrNull(row.goalDifference) ?? 0,
      };
    });
    return { source: "live" as const, updatedAt: new Date().toISOString(), competition: upstreamCompetition, table };
  });
}
