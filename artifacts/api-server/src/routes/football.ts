import { Router, type IRouter, type Response } from "express";
import {
  GetFootballCompetitionsResponse,
  GetFootballFixturesQueryParams,
  GetFootballFixturesResponse,
  GetFootballMatchResponse,
  GetFootballMatchParams,
  GetFootballStandingsParams,
  GetFootballStandingsResponse,
} from "@workspace/api-zod";
import {
  FootballProviderError,
  getCompetitions,
  getFixtures,
  getMatch,
  getStandings,
} from "../lib/football-data";

const router: IRouter = Router();

function providerFailure(res: Response, error: unknown): void {
  if (error instanceof FootballProviderError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  throw error;
}

router.get("/football/fixtures", async (req, res): Promise<void> => {
  const parsed = GetFootballFixturesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid date is required." });
    return;
  }
  const date = parsed.data.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "A valid date is required." });
    return;
  }
  const calendarDate = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(calendarDate.getTime()) ||
    calendarDate.toISOString().slice(0, 10) !== date
  ) {
    res.status(400).json({ error: "A valid date is required." });
    return;
  }
  try {
    const data = await getFixtures(date, parsed.data.competition || undefined);
    res.json(GetFootballFixturesResponse.parse(data));
  } catch (error) {
    providerFailure(res, error);
  }
});

router.get("/football/competitions", async (_req, res): Promise<void> => {
  try {
    const data = await getCompetitions();
    res.json(GetFootballCompetitionsResponse.parse(data));
  } catch (error) {
    providerFailure(res, error);
  }
});

router.get("/football/competitions/:code/standings", async (req, res): Promise<void> => {
  const params = GetFootballStandingsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid competition code." });
    return;
  }
  try {
    const data = await getStandings(params.data.code);
    if (!data) {
      res.status(404).json({ error: "Standings are not available for this competition." });
      return;
    }
    res.json(GetFootballStandingsResponse.parse(data));
  } catch (error) {
    providerFailure(res, error);
  }
});

router.get("/football/matches/:id", async (req, res): Promise<void> => {
  const params = GetFootballMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid match ID." });
    return;
  }
  try {
    const match = await getMatch(params.data.id);
    if (!match) {
      res.status(404).json({ error: "Match not found." });
      return;
    }
    res.json(GetFootballMatchResponse.parse(match));
  } catch (error) {
    providerFailure(res, error);
  }
});

export default router;
