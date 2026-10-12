---
name: football-data.org date filters
description: Different single-day filter behavior for global and competition-scoped match-list endpoints.
---

For a single-day fixture request, football-data.org's global `/matches` endpoint uses `date=YYYY-MM-DD`. The competition-scoped `/competitions/{code}/matches` endpoint ignores `date` and needs `dateFrom` and `dateTo`; equal dates returned that day's competition fixtures in verification.

**Why:** Live API tests showed the global endpoint returned no matches with identical `dateFrom`/`dateTo` but returned eight fixtures with `date`. The competition endpoint returned an entire 380-match season when given `date`, while the date-range filters returned one matching fixture.

**How to apply:** Keep separate query construction for global and competition-scoped fixture requests. When changing date filters, verify both endpoints return only matches for the requested day.
