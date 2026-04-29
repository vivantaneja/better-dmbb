import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import {
  type Competition,
  type DmbbPayload,
  type Fixture,
  type NewsItem,
  type StandingsRow,
  dmbbPayloadSchema,
} from "@/lib/schemas/dmbb";

const BASE_URL = "https://dmbb.ie";
const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedPayload: DmbbPayload | null = null;
let cachedAt = 0;
let inFlightPayload: Promise<DmbbPayload> | null = null;

const fallbackPayload: DmbbPayload = {
  lastSyncedAt: new Date().toISOString(),
  fixtures: [
    {
      id: "fix-1",
      division: "Division 1",
      homeTeam: "Rathmines BC",
      awayTeam: "Swords BC",
      venue: "Rathmines College",
      tipOff: "2026-04-26T20:15:00.000Z",
      status: "upcoming",
    },
  ],
  results: [
    {
      id: "res-1",
      division: "Division 1",
      homeTeam: "Rathmines BC",
      awayTeam: "Eanna BC",
      venue: "Rathmines College",
      tipOff: "2026-04-20T20:15:00.000Z",
      status: "final",
      homeScore: 78,
      awayScore: 94,
    },
  ],
  news: [
    {
      id: "news-1",
      title: "U20 Top 4: Eanna host Declans",
      excerpt: "Eanna BC welcome Declans to the National Basketball Arena in the opening U20 Top 4 semi-final.",
      category: "match_report",
      publishedAt: "2026-04-24T10:00:00.000Z",
      href: `${BASE_URL}/news`,
    },
  ],
  competitions: [
    {
      id: "premier",
      name: "Premier Division",
      tier: "Senior",
      teamCount: 12,
      description: "Top-flight men's competition played home and away across the season.",
    },
    {
      id: "div2",
      name: "Division 2",
      tier: "Senior",
      teamCount: 12,
      description: "Second-tier competition with promotion opportunities.",
    },
  ],
  standings: [
    { competitionId: "premier", team: "Rathmines BC", played: 16, won: 13, lost: 3, points: 29 },
    { competitionId: "premier", team: "Eanna BC", played: 16, won: 12, lost: 4, points: 28 },
    { competitionId: "div2", team: "Trinity College BC", played: 14, won: 11, lost: 3, points: 25 },
  ],
};

async function fetchHtml(path: string): Promise<string | null> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, { next: { revalidate: 900 } });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toIsoFromDayMonth(dayMonth: string): string {
  const now = new Date();
  const [dayRaw, monthRaw] = dayMonth.split("/");
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  if (!day || !month) return now.toISOString();
  return new Date(Date.UTC(now.getUTCFullYear(), month - 1, day, 19, 0, 0)).toISOString();
}

function parseDmbbDateTime(value: string): string {
  const cleaned = normalizeWhitespace(value).toLowerCase();
  const match = cleaned.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/,
  );
  if (!match) return new Date().toISOString();

  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearRaw = Number(match[3]);
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  let hour = Number(match[4] ?? 19);
  const minute = Number(match[5] ?? 0);
  const ampm = match[6];

  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0)).toISOString();
}

function extractCompetitionIdFromBlock(block: cheerio.Cheerio<Element>): string | null {
  const imageSrc = block.find("img[src*='tiny-']").first().attr("src");
  const imageMatch = imageSrc?.match(/tiny-(\d+)\./);
  if (imageMatch) return imageMatch[1];

  const href = block.find("a[href*='compId=']").first().attr("href");
  const hrefMatch = href?.match(/compId=(\d+)/);
  return hrefMatch ? hrefMatch[1] : null;
}

function parseFixtureLine(line: string): { homeTeam: string; awayTeam: string; status: "upcoming" | "final"; homeScore?: number; awayScore?: number; dayMonth?: string } | null {
  const cleaned = normalizeWhitespace(line);

  const resultMatch = cleaned.match(/(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+?)\s+(\d{1,2}\/\d{1,2})$/);
  if (resultMatch) {
    return {
      homeTeam: normalizeWhitespace(resultMatch[1]),
      homeScore: Number(resultMatch[2]),
      awayScore: Number(resultMatch[3]),
      awayTeam: normalizeWhitespace(resultMatch[4]),
      dayMonth: resultMatch[5],
      status: "final",
    };
  }

  const fixtureMatch = cleaned.match(/(.+?)\s+v\s+(.+?)\s+(\d{1,2}\/\d{1,2})$/i);
  if (fixtureMatch) {
    return {
      homeTeam: normalizeWhitespace(fixtureMatch[1]),
      awayTeam: normalizeWhitespace(fixtureMatch[2]),
      dayMonth: fixtureMatch[3],
      status: "upcoming",
    };
  }

  return null;
}

function parseCompetitionBlocks($: cheerio.CheerioAPI): { competitions: Competition[]; fixtures: Fixture[]; results: Fixture[]; standings: StandingsRow[] } {
  const blocks = $("div.homeItem.coSection.ui-corner-all.ui-widget-content.coControl");
  const competitionMap = new Map<string, Competition>();
  const fixtures: Fixture[] = [];
  const results: Fixture[] = [];
  const teamsPerCompetition = new Map<string, Set<string>>();

  blocks.each((index, element) => {
    const block = $(element);
    const competitionName = normalizeWhitespace(block.find(".news-header").first().text());
    if (!competitionName || competitionName.toLowerCase().includes("new season")) return;

    const competitionId = extractCompetitionIdFromBlock(block) ?? `derived-${index + 1}`;
    const competitionKey = `comp-${competitionId}`;

    if (!competitionMap.has(competitionKey)) {
      const description =
        normalizeWhitespace(block.find("h6 + div").first().text()) ||
        "Official DMBB competition data sourced from dmbb.ie.";
      competitionMap.set(competitionKey, {
        id: competitionKey,
        name: competitionName,
        tier: /(under\s*\d+)/i.test(competitionName) ? "Underage" : /cup/i.test(competitionName) ? "Cup" : "Senior",
        teamCount: 0,
        description,
      });
    }

    const fixtureHeaderLine = normalizeWhitespace(
      block.find(".ui-widget-header.news-header").last().clone().children().remove().end().text(),
    );
    const parsedFixture = parseFixtureLine(fixtureHeaderLine);
    if (!parsedFixture) return;

    const rawBody = normalizeWhitespace(block.find("h6 + div").first().text());
    const venueMatch = rawBody.match(/at\s+(.+?)\s+at\s+\d{1,2}:\d{2}/i);
    const venue = normalizeWhitespace(venueMatch?.[1] ?? "TBC");
    const tipOff = toIsoFromDayMonth(parsedFixture.dayMonth ?? "");

    const entry: Fixture = {
      id: `${competitionKey}-${index + 1}`,
      division: competitionName,
      homeTeam: parsedFixture.homeTeam,
      awayTeam: parsedFixture.awayTeam,
      venue,
      tipOff,
      status: parsedFixture.status,
      homeScore: parsedFixture.homeScore,
      awayScore: parsedFixture.awayScore,
    };

    if (!teamsPerCompetition.has(competitionKey)) teamsPerCompetition.set(competitionKey, new Set());
    const teamSet = teamsPerCompetition.get(competitionKey)!;
    teamSet.add(parsedFixture.homeTeam);
    teamSet.add(parsedFixture.awayTeam);

    if (entry.status === "upcoming") fixtures.push(entry);
    else results.push(entry);
  });

  const standingsMap = new Map<string, StandingsRow>();
  for (const result of results) {
    if (result.homeScore == null || result.awayScore == null) continue;
    const competition = [...competitionMap.values()].find((comp) => comp.name === result.division);
    if (!competition) continue;

    const homeKey = `${competition.id}:${result.homeTeam}`;
    const awayKey = `${competition.id}:${result.awayTeam}`;

    if (!standingsMap.has(homeKey)) {
      standingsMap.set(homeKey, { competitionId: competition.id, team: result.homeTeam, played: 0, won: 0, lost: 0, points: 0 });
    }
    if (!standingsMap.has(awayKey)) {
      standingsMap.set(awayKey, { competitionId: competition.id, team: result.awayTeam, played: 0, won: 0, lost: 0, points: 0 });
    }

    const homeRow = standingsMap.get(homeKey)!;
    const awayRow = standingsMap.get(awayKey)!;
    homeRow.played += 1;
    awayRow.played += 1;

    if (result.homeScore > result.awayScore) {
      homeRow.won += 1;
      homeRow.points += 2;
      awayRow.lost += 1;
    } else {
      awayRow.won += 1;
      awayRow.points += 2;
      homeRow.lost += 1;
    }
  }

  const competitions = [...competitionMap.values()].map((competition) => ({
    ...competition,
    teamCount: Math.max(competition.teamCount, teamsPerCompetition.get(competition.id)?.size ?? 0),
  }));

  const standings = [...standingsMap.values()].sort((a, b) => b.points - a.points || a.team.localeCompare(b.team));

  return { competitions, fixtures, results, standings };
}

function parseClubIdsFromHome($: cheerio.CheerioAPI): string[] {
  const ids = new Set<string>();
  $("a[href*='cid=']").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    const match = href.match(/cid=(\d+)/);
    if (match) ids.add(match[1]);
  });
  // The legacy DMBB template also stores club IDs in a dropdown, not always linked in anchors.
  $("option").each((_, element) => {
    const value = normalizeWhitespace($(element).attr("value") ?? "");
    if (!/^\d+$/.test(value)) return;
    const numeric = Number(value);
    // Club IDs on this site are in a high numeric band; filter out UI/theme option values.
    if (numeric >= 10000) ids.add(value);
  });
  return [...ids];
}

function mergeCompetitionTierFromName(name: string): string {
  if (/cup|shield/i.test(name)) return "Cup";
  if (/under\s*\d+|u\d+/i.test(name)) return "Underage";
  return "Senior";
}

function parseCompetitionsFromClubPage($: cheerio.CheerioAPI): {
  competitions: Competition[];
  teamsByCompId: Map<string, Set<string>>;
  standingsRows: StandingsRow[];
} {
  const competitionMap = new Map<string, Competition>();
  const teamsByCompId = new Map<string, Set<string>>();
  const standingsRows: StandingsRow[] = [];

  $("option").each((_, element) => {
    const value = normalizeWhitespace($(element).attr("value") ?? "");
    const label = normalizeWhitespace($(element).text());
    if (!/^\d+$/.test(value) || Number(value) < 1000 || !label) return;
    if (/standard item|google map|facebook feed|home logo|black tie|ui darkness/i.test(label)) return;

    const competitionId = `comp-${value}`;
    if (!competitionMap.has(competitionId)) {
      competitionMap.set(competitionId, {
        id: competitionId,
        name: label,
        tier: mergeCompetitionTierFromName(label),
        teamCount: 0,
        description: "Competition sourced from official dmbb.ie club competition options.",
      });
    }
  });

  $("a[href*='fixtures.aspx'][href*='teamID='][href*='compId=']").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    const match = href.match(/compId=(\d+)/);
    if (!match) return;
    const competitionId = `comp-${match[1]}`;
    const team = normalizeWhitespace($(element).text());
    if (!team) return;
    if (!teamsByCompId.has(competitionId)) teamsByCompId.set(competitionId, new Set());
    teamsByCompId.get(competitionId)!.add(team);
  });

  $("table").each((_, tableElement) => {
    const table = $(tableElement);
    const rows = table.find("tbody tr");
    if (!rows.length) return;

    rows.each((__, rowElement) => {
      const row = $(rowElement);
      const teamLink = row.find("a[href*='fixtures.aspx'][href*='compId=']").first();
      const href = teamLink.attr("href") ?? "";
      const compMatch = href.match(/compId=(\d+)/);
      if (!compMatch) return;

      const competitionId = `comp-${compMatch[1]}`;
      const cells = row.find("td");
      if (cells.length < 4) return;

      const team = normalizeWhitespace(teamLink.text());
      const played = Number.parseInt(normalizeWhitespace($(cells.get(2)).text()), 10);
      const points = Number.parseInt(
        normalizeWhitespace($(cells.get(cells.length - 1)).text()),
        10,
      );

      if (!team || Number.isNaN(played) || Number.isNaN(points)) return;

      standingsRows.push({
        competitionId,
        team,
        played,
        won: 0,
        lost: 0,
        points,
      });
    });
  });

  return { competitions: [...competitionMap.values()], teamsByCompId, standingsRows };
}

function parseNews($: cheerio.CheerioAPI): NewsItem[] {
  const items: NewsItem[] = [];
  $("div.homeItem.coSection .news-header, article, .news-item").each((index, element) => {
    const title = normalizeWhitespace($(element).text());
    if (!title) return;
    const parent = $(element).closest(".homeItem.coSection");
    const excerpt =
      normalizeWhitespace(parent.find("h6 + div p").first().text()) || "Official board update from DMBB.";
    const href = parent.find("a").first().attr("href") ?? $(element).find("a").first().attr("href");
    items.push({
      id: `news-${index + 1}`,
      title,
      excerpt,
      publishedAt: new Date().toISOString(),
      category: "board_notice",
      href: href?.startsWith("http") ? href : `${BASE_URL}${href ?? "/news"}`,
    });
  });
  return items.filter((item) => !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(item.title)).slice(0, 15);
}

function parseFixturesPageByCompetition(
  html: string,
  competitionId: string,
): { competition: Competition | null; fixtures: Fixture[]; results: Fixture[] } {
  const $ = cheerio.load(html);
  const title = normalizeWhitespace($("title").text()).replace(/^Games-/i, "");
  const competitionName = title || `Competition ${competitionId.replace("comp-", "")}`;

  const fixtures: Fixture[] = [];
  const results: Fixture[] = [];

  $("table")
    .first()
    .find("tbody tr")
    .each((index, rowElement) => {
      const row = $(rowElement);
      const cells = row.find("td");
      if (cells.length < 7) return;

      const dateText = normalizeWhitespace($(cells.get(2)).text());
      const homeTeam = normalizeWhitespace($(cells.get(3)).text());
      const homeScoreText = normalizeWhitespace($(cells.get(4)).text());
      const awayScoreText = normalizeWhitespace($(cells.get(5)).text());
      const awayTeam = normalizeWhitespace($(cells.get(6)).text());
      const venue = normalizeWhitespace($(cells.get(8)).text() || "TBC");

      if (!homeTeam || !awayTeam || !dateText) return;

      const homeScore = Number.parseInt(homeScoreText, 10);
      const awayScore = Number.parseInt(awayScoreText, 10);
      const isFinal = !Number.isNaN(homeScore) && !Number.isNaN(awayScore);
      const item: Fixture = {
        id: `${competitionId}-fx-${index + 1}-${homeTeam}-${awayTeam}`.replace(/\s+/g, "-"),
        division: competitionName,
        homeTeam,
        awayTeam,
        venue: venue || "TBC",
        tipOff: parseDmbbDateTime(dateText),
        status: isFinal ? "final" : "upcoming",
        homeScore: isFinal ? homeScore : undefined,
        awayScore: isFinal ? awayScore : undefined,
      };
      if (isFinal) results.push(item);
      else fixtures.push(item);
    });

  return {
    competition: {
      id: competitionId,
      name: competitionName,
      tier: mergeCompetitionTierFromName(competitionName),
      teamCount: 0,
      description: "Competition sourced from official dmbb.ie fixtures feed.",
    },
    fixtures,
    results,
  };
}

function dedupeFixtures(items: Fixture[]): Fixture[] {
  const map = new Map<string, Fixture>();
  for (const item of items) {
    const key = `${item.division}|${item.homeTeam}|${item.awayTeam}|${item.tipOff}|${item.status}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

async function getOfficialDmbbDataInternal(): Promise<DmbbPayload> {
  const [homeHtml, rulesHtml] = await Promise.all([fetchHtml("/homepage.aspx?oid=1006"), fetchHtml("/homepage.aspx?oid=1006&ct=rules")]);

  if (!homeHtml) {
    return dmbbPayloadSchema.parse({ ...fallbackPayload, lastSyncedAt: new Date().toISOString() });
  }

  const homeDoc = cheerio.load(homeHtml);
  const rulesDoc = rulesHtml ? cheerio.load(rulesHtml) : null;
  const blockData = parseCompetitionBlocks(homeDoc);
  const clubIds = parseClubIdsFromHome(homeDoc);
  const clubHtmlPages = await Promise.all(
    clubIds.map((clubId) => fetchHtml(`/homepage.aspx?oid=1006&cid=${clubId}`)),
  );

  const optionCompetitionsMap = new Map<string, Competition>();
  const optionTeamCounts = new Map<string, Set<string>>();
  const scrapedStandings = new Map<string, StandingsRow>();
  const discoveredCompIds = new Set<string>();
  for (const page of clubHtmlPages) {
    if (!page) continue;
    const clubDoc = cheerio.load(page);
    const parsed = parseCompetitionsFromClubPage(clubDoc);
    for (const competition of parsed.competitions) {
      if (!optionCompetitionsMap.has(competition.id)) {
        optionCompetitionsMap.set(competition.id, competition);
      }
      discoveredCompIds.add(competition.id);
    }
    for (const [competitionId, teams] of parsed.teamsByCompId.entries()) {
      if (!optionTeamCounts.has(competitionId)) optionTeamCounts.set(competitionId, new Set());
      const set = optionTeamCounts.get(competitionId)!;
      for (const team of teams) set.add(team);
    }
    for (const standingRow of parsed.standingsRows) {
      const key = `${standingRow.competitionId}:${standingRow.team}`;
      const existing = scrapedStandings.get(key);
      if (!existing || standingRow.played > existing.played) {
        scrapedStandings.set(key, standingRow);
      }
    }
  }

  const news = parseNews(homeDoc);
  const rulesNews = rulesDoc ? parseNews(rulesDoc) : [];

  const fixturesFromCompPages: Fixture[] = [];
  const resultsFromCompPages: Fixture[] = [];
  const compPageHtml = await Promise.all(
    [...discoveredCompIds].map((competitionId) =>
      fetchHtml(`/fixtures.aspx?compId=${competitionId.replace("comp-", "")}`),
    ),
  );

  compPageHtml.forEach((html, index) => {
    if (!html) return;
    const competitionId = [...discoveredCompIds][index];
    const parsed = parseFixturesPageByCompetition(html, competitionId);
    if (parsed.competition && !optionCompetitionsMap.has(parsed.competition.id)) {
      optionCompetitionsMap.set(parsed.competition.id, parsed.competition);
    }
    fixturesFromCompPages.push(...parsed.fixtures);
    resultsFromCompPages.push(...parsed.results);
  });

  const competitionsById = new Map<string, Competition>();
  for (const competition of optionCompetitionsMap.values()) {
    competitionsById.set(competition.id, {
      ...competition,
      teamCount: optionTeamCounts.get(competition.id)?.size ?? competition.teamCount,
    });
  }
  for (const competition of blockData.competitions) {
    const existing = competitionsById.get(competition.id);
    if (existing) {
      competitionsById.set(competition.id, {
        ...existing,
        description: existing.description || competition.description,
        teamCount: Math.max(existing.teamCount, competition.teamCount),
      });
    } else {
      competitionsById.set(competition.id, competition);
    }
  }

  const competitions =
    competitionsById.size > 0
      ? [...competitionsById.values()].sort((a, b) => a.name.localeCompare(b.name))
      : fallbackPayload.competitions;
  const fixtures = dedupeFixtures([...fixturesFromCompPages, ...blockData.fixtures]).length
    ? dedupeFixtures([...fixturesFromCompPages, ...blockData.fixtures])
    : fallbackPayload.fixtures;
  const results = dedupeFixtures([...resultsFromCompPages, ...blockData.results]).length
    ? dedupeFixtures([...resultsFromCompPages, ...blockData.results])
    : fallbackPayload.results;
  const standings =
    scrapedStandings.size > 0
      ? [...scrapedStandings.values()].sort(
          (a, b) => b.points - a.points || b.played - a.played || a.team.localeCompare(b.team),
        )
      : blockData.standings.length
        ? blockData.standings
        : fallbackPayload.standings;
  const mergedNews = [...news, ...rulesNews].slice(0, 20);

  const payload: DmbbPayload = {
    ...fallbackPayload,
    lastSyncedAt: new Date().toISOString(),
    news: mergedNews.length ? mergedNews : fallbackPayload.news,
    competitions,
    fixtures,
    results,
    standings,
  };

  return dmbbPayloadSchema.parse(payload);
}

export async function getOfficialDmbbData(): Promise<DmbbPayload> {
  const now = Date.now();
  if (cachedPayload && now - cachedAt < CACHE_TTL_MS) return cachedPayload;
  if (inFlightPayload) return inFlightPayload;

  inFlightPayload = getOfficialDmbbDataInternal()
    .then((payload) => {
      cachedPayload = payload;
      cachedAt = Date.now();
      return payload;
    })
    .finally(() => {
      inFlightPayload = null;
    });

  return inFlightPayload;
}

export async function syncDmbbData(): Promise<DmbbPayload> {
  cachedPayload = null;
  cachedAt = 0;
  return getOfficialDmbbData();
}
