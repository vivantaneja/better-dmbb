import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FixtureCard,
  ResultCard,
  SectionTitle,
  StandingsTable,
  TournamentBracket,
} from "@/components/site-shell";
import type { Fixture } from "@/lib/schemas/dmbb";
import { getOfficialDmbbData } from "@/lib/data/official-dmbb";

type CompetitionPageProps = {
  params: Promise<{ competitionId: string }>;
};

function isTournamentCompetition(name: string): boolean {
  return /cup|shield|top\s*4|final/i.test(name);
}

function dedupeMatches(matches: Fixture[]): Fixture[] {
  const deduped = new Map<string, Fixture>();
  for (const match of matches) {
    const key = `${match.division}|${match.homeTeam}|${match.awayTeam}|${match.tipOff}`;
    const existing = deduped.get(key);
    if (
      !existing ||
      (existing.status !== "final" && match.status === "final") ||
      ((existing.homeScore == null || existing.awayScore == null) &&
        match.homeScore != null &&
        match.awayScore != null)
    ) {
      deduped.set(key, match);
    }
  }
  return [...deduped.values()];
}

function buildBracketRounds(matches: Fixture[], competitionName: string) {
  const ordered = dedupeMatches(matches).sort(
    (a, b) => new Date(a.tipOff).getTime() - new Date(b.tipOff).getTime(),
  );

  if (ordered.length === 0) return [];
  if (ordered.length === 1) return [{ label: "Final", matches: ordered }];

  const isTopFour = /top\s*4|top\s*four/i.test(competitionName);
  if (isTopFour) {
    const finalMatch = ordered.at(-1)!;
    const remaining = ordered.slice(0, -1);
    const nonFinalPairMatches = remaining.filter((match) => {
      const pair = new Set([match.homeTeam, match.awayTeam]);
      return !(pair.has(finalMatch.homeTeam) && pair.has(finalMatch.awayTeam));
    });
    const semisSource =
      nonFinalPairMatches.length >= 2 ? nonFinalPairMatches : remaining;
    const semis = semisSource.slice(-2);
    const rounds: { label: string; matches: Fixture[] }[] = [];
    if (semis.length > 0) rounds.push({ label: "Semi-Finals", matches: semis });
    rounds.push({ label: "Final", matches: [finalMatch] });
    return rounds;
  }

  // Knockout assumption: exactly one final (latest match), then 2 semis, 4 quarters, etc.
  const finalMatch = ordered.at(-1)!;
  const remaining = ordered.slice(0, -1);

  const rounds: { label: string; matches: Fixture[] }[] = [{ label: "Final", matches: [finalMatch] }];

  if (remaining.length === 0) return rounds;

  const semiCount = Math.min(2, remaining.length);
  const semiFinals = remaining.slice(-semiCount);
  const beforeSemis = remaining.slice(0, -semiCount);
  rounds.unshift({ label: "Semi-Finals", matches: semiFinals });

  if (beforeSemis.length === 0) return rounds;

  const quarterCount = Math.min(4, beforeSemis.length);
  const quarterFinals = beforeSemis.slice(-quarterCount);
  const prelims = beforeSemis.slice(0, -quarterCount);

  if (quarterFinals.length > 0) {
    rounds.unshift({ label: "Quarter-Finals", matches: quarterFinals });
  }
  if (prelims.length > 0) {
    rounds.unshift({ label: "Preliminary", matches: prelims });
  }

  return rounds;
}

export default async function CompetitionDetailPage({ params }: CompetitionPageProps) {
  const { competitionId } = await params;
  const data = await getOfficialDmbbData();
  const competition = data.competitions.find((entry) => entry.id === competitionId);

  if (!competition) notFound();

  const standings = data.standings.filter((row) => row.competitionId === competitionId);
  const fixtures = dedupeMatches(
    data.fixtures.filter((fixture) => fixture.division === competition.name),
  ).slice(0, 8);
  const results = dedupeMatches(
    data.results.filter((result) => result.division === competition.name),
  ).slice(0, 8);
  const isTournament = isTournamentCompetition(competition.name);
  const bracketRounds = buildBracketRounds([...results, ...fixtures], competition.name);

  return (
    <section className="py-14">
      <div className="dmbb-container space-y-10">
        <Link href="/competitions" className="text-xs font-bold uppercase tracking-wider text-brand-cyan">
          Back To Competitions
        </Link>
        <SectionTitle eyebrow={competition.tier} title={competition.name} />
        <p className="text-brand-muted">{competition.description}</p>

        {isTournament ? (
          <div>
            <SectionTitle eyebrow="Tournament View" title="Bracket" />
            {bracketRounds.length > 0 ? (
              <TournamentBracket rounds={bracketRounds} />
            ) : (
              <p className="dmbb-card p-5 text-sm text-brand-muted">
                Bracket data is not currently published for this competition.
              </p>
            )}
          </div>
        ) : (
          <div>
            <SectionTitle eyebrow="Official Table" title="Standings" />
            {standings.length > 0 ? (
              <StandingsTable rows={standings} />
            ) : (
              <p className="dmbb-card p-5 text-sm text-brand-muted">
                Table data is not currently published for this competition by the source feed.
              </p>
            )}
          </div>
        )}

        {fixtures.length > 0 && (
          <div>
            <SectionTitle eyebrow="Upcoming" title="Fixtures" />
            <div className="grid gap-3 md:grid-cols-2">
              {fixtures.map((fixture) => (
                <FixtureCard key={fixture.id} fixture={fixture} />
              ))}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div>
            <SectionTitle eyebrow="Recent" title="Results" />
            <div className="grid gap-3 md:grid-cols-2">
              {results.map((result) => (
                <ResultCard key={result.id} result={result} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
