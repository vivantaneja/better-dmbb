import { CompetitionCard, SectionTitle } from "@/components/site-shell";
import { getOfficialDmbbData } from "@/lib/data/official-dmbb";

export const metadata = {
  title: "Competitions | Dublin Men's Basketball Board",
};

type CompetitionGroup = "division" | "over" | "under" | "other";

function classifyLeagueName(name: string): {
  group: CompetitionGroup;
  bucketLabel: string;
  primary: number;
  subgroup: number;
  variant: number;
  normalizedName: string;
} {
  const normalizedName = name.trim();
  const lower = normalizedName.toLowerCase();
  const top4 = /top\s*4|final/i.test(normalizedName) ? 1 : 0;
  const bracketMatch = normalizedName.match(/\((\d+)\)/);
  const bracket = bracketMatch ? Number(bracketMatch[1]) : 0;

  const divisionMatch = normalizedName.match(/division\s*(\d+)/i);
  if (divisionMatch) {
    const divisionNumber = Number(divisionMatch[1]);
    return {
      group: "division",
      bucketLabel: `Division ${divisionNumber}`,
      primary: divisionNumber,
      subgroup: bracket,
      variant: top4,
      normalizedName: lower,
    };
  }

  const overMatch = normalizedName.match(/over\s*(\d+)/i);
  if (overMatch) {
    const overNumber = Number(overMatch[1]);
    return {
      group: "over",
      bucketLabel: `Over ${overNumber}`,
      primary: overNumber,
      subgroup: bracket,
      variant: top4,
      normalizedName: lower,
    };
  }

  const underMatch = normalizedName.match(/(?:under|u)\s*(\d+)/i);
  if (underMatch) {
    const underNumber = Number(underMatch[1]);
    const colorWeight = /\bblue\b/i.test(normalizedName)
      ? 1
      : /\bgreen\b/i.test(normalizedName)
        ? 2
        : /\bred\b/i.test(normalizedName)
          ? 3
          : 0;
    return {
      group: "under",
      bucketLabel: `Under ${underNumber}`,
      primary: underNumber,
      subgroup: bracket || colorWeight,
      variant: top4,
      normalizedName: lower,
    };
  }

  return {
    group: "other",
    bucketLabel: "Other",
    primary: Number.MAX_SAFE_INTEGER,
    subgroup: bracket,
    variant: top4,
    normalizedName: lower,
  };
}

function leagueSort(aName: string, bName: string): number {
  const groupOrder: Record<CompetitionGroup, number> = {
    division: 0,
    over: 1,
    under: 2,
    other: 3,
  };
  const a = classifyLeagueName(aName);
  const b = classifyLeagueName(bName);

  return (
    groupOrder[a.group] - groupOrder[b.group] ||
    a.primary - b.primary ||
    a.subgroup - b.subgroup ||
    a.variant - b.variant ||
    a.normalizedName.localeCompare(b.normalizedName)
  );
}

export default async function CompetitionsPage() {
  const data = await getOfficialDmbbData();
  const sortedCompetitions = [...data.competitions].sort((a, b) => leagueSort(a.name, b.name));
  const isCup = (name: string) => /\bcup\b/i.test(name);
  const isShield = (name: string) => /\bshield\b/i.test(name);

  const grouped = {
    leagues: sortedCompetitions.filter((competition) => !isCup(competition.name) && !isShield(competition.name)),
    cupsAndShields: sortedCompetitions.filter(
      (competition) => isCup(competition.name) || isShield(competition.name),
    ),
  };
  const leagueBuckets = grouped.leagues.reduce<
    Array<{ label: string; competitions: (typeof grouped.leagues)[number][]; sortKey: number }>
  >((acc, competition) => {
    const meta = classifyLeagueName(competition.name);
    const existing = acc.find((bucket) => bucket.label === meta.bucketLabel);
    if (existing) {
      existing.competitions.push(competition);
      return acc;
    }
    acc.push({
      label: meta.bucketLabel,
      competitions: [competition],
      sortKey:
        (meta.group === "division" ? 0 : meta.group === "over" ? 1 : meta.group === "under" ? 2 : 3) *
          1000 +
        meta.primary,
    });
    return acc;
  }, []);
  leagueBuckets.sort((a, b) => a.sortKey - b.sortKey || a.label.localeCompare(b.label));

  return (
    <section className="py-10">
      <div className="dmbb-container space-y-7">
        <SectionTitle
          eyebrow={`${sortedCompetitions.length} Official Competitions`}
          title="Competitions, Cups & Standings"
        />
        <p className="text-xs text-brand-muted">
          Last synced: {new Date(data.lastSyncedAt).toLocaleString()}
        </p>

        {grouped.leagues.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xl font-black uppercase text-brand-navy">
              Leagues ({grouped.leagues.length})
            </h3>
            <div className="space-y-5">
              {leagueBuckets.map((bucket) => (
                <section key={bucket.label} className="space-y-2">
                  <h4 className="text-sm font-black uppercase tracking-wide text-brand-navy">
                    {bucket.label} ({bucket.competitions.length})
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {bucket.competitions.map((competition) => (
                      <CompetitionCard key={competition.id} competition={competition} compact />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {grouped.cupsAndShields.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xl font-black uppercase text-brand-navy">
              Cups & Shields ({grouped.cupsAndShields.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {grouped.cupsAndShields.map((competition) => (
                <CompetitionCard key={competition.id} competition={competition} compact />
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
