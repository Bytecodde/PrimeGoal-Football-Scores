import type {
  FootballCompetition,
  FootballMatch,
  FootballSource,
  FootballStandingRow,
} from "@workspace/api-zod";

const API_ROOT = "https://api.football-data.org/v4";

type JsonObject = Record<string, unknown>;

const DEMO_COMPETITIONS: FootballCompetition[] = [
  { code: "PL", name: "Premier League", emblem: null, areaName: "England" },
  { code: "PD", name: "La Liga", emblem: null, areaName: "Spain" },
  { code: "SA", name: "Serie A", emblem: null, areaName: "Italy" },
  { code: "BL1", name: "Bundesliga", emblem: null, areaName: "Germany" },
  { code: "FL1", name: "Ligue 1", emblem: null, areaName: "France" },
  { code: "CL", name: "UEFA Champions League", emblem: null, areaName: "Europe" },
];

const DEMO_GAMES: Array<{
  competitionCode: string;
  home: string;
  away: string;
  hour: number;
  minute: number;
  status: FootballMatch["status"];
  homeGoals: number | null;
  awayGoals: number | null;
  matchMinute: number | null;
}> = [
  {
    competitionCode: "PL",
    home: "Northbridge FC",
    away: "London Athletic",
    hour: 15,
    minute: 0,
    status: "FINISHED",
    homeGoals: 2,
    awayGoals: 1,
    matchMinute: null,
  },
  {
    competitionCode: "PD",
    home: "Catalunya FC",
    away: "Madrid Real",
    hour: 17,
    minute: 30,
    status: "LIVE",
    homeGoals: 1,
    awayGoals: 0,
    matchMinute: 67,
  },
  {
    competitionCode: "SA",
    home: "Milan Rossoneri",
    away: "Turin United",
    hour: 19,
    minute: 45,
    status: "SCHEDULED",
    homeGoals: null,
    awayGoals: null,
    matchMinute: null,
  },
  {
    competitionCode: "BL1",
    home: "Bavaria 04",
    away: "Dortmund City",
    hour: 20,
    minute: 0,
    status: "SCHEDULED",
    homeGoals: null,
    awayGoals: null,
    matchMinute: null,
  },
  {
    competitionCode: "FL1",
    home: "Paris Union",
    away: "Marseille Olympique",
    hour: 21,
    minute: 0,
    status: "SCHEDULED",
    homeGoals: null,
    awayGoals: null,
    matchMinute: null,
  },
];

const DEMO_TABLES: Record<string, Array<[string, number, number, number, number, number, number, number]>> = {
  PL: [
    ["Northbridge FC", 8, 6, 1, 1, 19, 7, 12],
    ["London Athletic", 8, 5, 2, 1, 17, 9, 8],
    ["Harbour Town", 8, 5, 1, 2, 15, 10, 5],
    ["West County", 8, 4, 2, 2, 13, 9, 4],
  ],
  PD: [
    ["Catalunya FC", 8, 6, 1, 1, 20, 8, 12],
    ["Madrid Real", 8, 6, 0, 2, 18, 10, 8],
    ["Seville Athletic", 8, 4, 2, 2, 14, 10, 4],
    ["Valencia Club", 8, 4, 1, 3, 13, 11, 2],
  ],
  SA: [
    ["Milan Rossoneri", 8, 6, 1, 1, 16, 7, 9],
    ["Turin United", 8, 5, 2, 1, 14, 8, 6],
    ["Rome Athletic", 8, 5, 1, 2, 15, 10, 5],
    ["Napoli Coast", 8, 4, 2, 2, 12, 8, 4],
  ],
  BL1: [
    ["Bavaria 04", 8, 7, 1, 0, 24, 6, 18],
    ["Dortmund City", 8, 6, 0, 2, 20, 11, 9],
    ["Rheinland FC", 8, 5, 1, 2, 16, 10, 6],
    ["Berlin Union", 8, 4, 1, 3, 13, 12, 1],
  ],
};

function object(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapCompetition(value: unknown): FootballCompetition {
  const item = object(value);
  const area = object(item.area);
  return {
    code: text(item.code) ?? String(item.id ?? "UNK"),
    name: text(item.name) ?? "Football competition",
    emblem: text(item.emblem),
    areaName: text(area.name),
  };
}

function mapTeam(value: unknown): FootballMatch["homeTeam"] {
  const item = object(value);
  return {
    id: numberOrNull(item.id),
    name: text(item.name) ?? "Unknown team",
    shortName: text(item.shortName),
    crest: text(item.crest),
  };
}

function mapMatch(value: unknown): FootballMatch {
  const item = object(value);
  const score = object(item.score);
  const fullTime = object(score.fullTime);
  const utcDate = text(item.utcDate);
  if (!utcDate || !Number.isInteger(item.id)) {
    throw new Error("Football data provider returned an invalid match.");
  }
  return {
    id: item.id as number,
    utcDate: new Date(utcDate),
    status: normalizeStatus(text(item.status)),
    minute: numberOrNull(item.minute),
    competition: mapCompetition(item.competition),
    homeTeam: mapTeam(item.homeTeam),
    awayTeam: mapTeam(item.awayTeam),
    score: {
      home: numberOrNull(fullTime.home),
      away: numberOrNull(fullTime.away),
    },
    matchday: numberOrNull(item.matchday),
    venue: text(item.venue),
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
  constructor(message: string) {
    super(message);
    this.name = "FootballProviderError";
  }
}

async function requestFootballData<T>(path: string): Promise<T> {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) {
    throw new FootballProviderError("Football data provider is not configured.");
  }
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      headers: { "X-Auth-Token": token },
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new FootballProviderError("Football data provider is unavailable.");
  }
  if (!response.ok) {
    throw new FootballProviderError(
      `Football data provider returned HTTP ${response.status}.`,
    );
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new FootballProviderError("Football data provider returned invalid data.");
  }
}

export function dataSource(): FootballSource {
  return process.env.FOOTBALL_DATA_API_KEY ? "live" : "demo";
}

export async function getCompetitions() {
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    return { source: "demo" as const, updatedAt: new Date().toISOString(), competitions: DEMO_COMPETITIONS };
  }

  const body = await requestFootballData<{ competitions?: unknown[] }>("/competitions");
  const competitions = (body.competitions ?? [])
    .map(mapCompetition)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { source: "live" as const, updatedAt: new Date().toISOString(), competitions };
}

export async function getFixtures(date: string, competition?: string) {
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    const competitions = new Map(DEMO_COMPETITIONS.map((item) => [item.code, item]));
    const compactDate = date.replaceAll("-", "");
    const matches = DEMO_GAMES.map((game, index): FootballMatch => {
      const fixtureDate = new Date(`${date}T00:00:00.000Z`);
      fixtureDate.setUTCHours(game.hour, game.minute, 0, 0);
      const id = Number(compactDate) * 10 + index + 1;
      const homeInitials = game.home
        .split(" ")
        .map((part) => part[0])
        .slice(0, 3)
        .join("");
      const awayInitials = game.away
        .split(" ")
        .map((part) => part[0])
        .slice(0, 3)
        .join("");
      return {
        id,
        utcDate: fixtureDate,
        status: game.status,
        minute: game.matchMinute,
        competition: competitions.get(game.competitionCode) ?? DEMO_COMPETITIONS[0],
        homeTeam: { id: null, name: game.home, shortName: homeInitials, crest: null },
        awayTeam: { id: null, name: game.away, shortName: awayInitials, crest: null },
        score: { home: game.homeGoals, away: game.awayGoals },
        matchday: 8,
        venue: null,
      };
    }).filter((match) => !competition || match.competition.code === competition);
    return { source: "demo" as const, updatedAt: new Date().toISOString(), matches };
  }

  const query = new URLSearchParams({ dateFrom: date, dateTo: date });
  const endpoint = competition
    ? `/competitions/${encodeURIComponent(competition)}/matches?${query}`
    : `/matches?${query}`;
  const body = await requestFootballData<{ matches?: unknown[] }>(endpoint);
  const matches = (body.matches ?? []).map(mapMatch);
  return { source: "live" as const, updatedAt: new Date().toISOString(), matches };
}

export async function getMatch(id: number) {
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    const compactDate = String(Math.floor(id / 10)).padStart(8, "0");
    const date = `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;
    const index = id % 10 - 1;
    const game = DEMO_GAMES[index];
    if (!game || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const fixtures = await getFixtures(date, game.competitionCode);
    return fixtures.matches.find((match) => match.id === id) ?? null;
  }
  const body = await requestFootballData<unknown>(`/matches/${id}`);
  return mapMatch(body);
}

export async function getStandings(code: string) {
  const competition = DEMO_COMPETITIONS.find((item) => item.code === code);
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    if (!competition) return null;
    const rows = DEMO_TABLES[code] ?? [
      ["Sample Team A", 8, 5, 2, 1, 15, 8, 7],
      ["Sample Team B", 8, 5, 1, 2, 13, 9, 4],
      ["Sample Team C", 8, 4, 2, 2, 12, 10, 2],
      ["Sample Team D", 8, 3, 2, 3, 10, 10, 0],
    ];
    const table: FootballStandingRow[] = rows.map(
      ([teamName, playedGames, won, draw, lost, goalsFor, goalsAgainst, goalDifference], index) => ({
        position: index + 1,
        teamId: null,
        teamName,
        crest: null,
        playedGames,
        won,
        draw,
        lost,
        points: won * 3 + draw,
        goalsFor,
        goalsAgainst,
        goalDifference,
      }),
    );
    return { source: "demo" as const, updatedAt: new Date().toISOString(), competition, table };
  }

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
    return {
      position: numberOrNull(row.position) ?? 0,
      teamId: numberOrNull(team.id),
      teamName: text(team.name) ?? "Unknown team",
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
}
