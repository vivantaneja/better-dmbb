import Link from "next/link";
import { CompetitionCard, SectionTitle } from "@/components/site-shell";
import { getOfficialDmbbData } from "@/lib/data/official-dmbb";

export const metadata = {
  title: "Competitions | Dublin Men's Basketball Board",
};

type TabKey = "leagues-seasons" | "cups" | "shields";

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

export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const data = await getOfficialDmbbData();
  const sortedCompetitions = [...data.competitions].sort((a, b) => leagueSort(a.name, b.name));
  const isCup = (name: string) => /\bcup\b/i.test(name);
  const isShield = (name: string) => /\bshield\b/i.test(name);
  const isTop4 = (name: string) => /top\s*4|final\s*4/i.test(name);

  const activeTab = ((): TabKey => {
    const tab = resolvedSearchParams?.tab;
    if (tab === "cups" || tab === "shields" || tab === "leagues-seasons") return tab;
    return "leagues-seasons";
  })();

  const grouped = {
    leaguesAndSeasons: sortedCompetitions.filter(
      (competition) =>
        isTop4(competition.name) || (!isCup(competition.name) && !isShield(competition.name)),
    ),
    cups: sortedCompetitions.filter(
      (competition) => !isTop4(competition.name) && isCup(competition.name) && !isShield(competition.name),
    ),
    shields: sortedCompetitions.filter(
      (competition) => !isTop4(competition.name) && isShield(competition.name),
    ),
  };
  const leagueBuckets = grouped.leaguesAndSeasons.reduce<
    Array<{ label: string; competitions: (typeof grouped.leaguesAndSeasons)[number][]; sortKey: number }>
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
        <nav className="flex flex-wrap gap-2">
          {([
            { key: "leagues-seasons", label: `Leagues/Seasons (${grouped.leaguesAndSeasons.length})` },
            { key: "cups", label: `Cups (${grouped.cups.length})` },
            { key: "shields", label: `Shields (${grouped.shields.length})` },
          ] as const).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/competitions?tab=${tab.key}`}
                aria-current={isActive ? "page" : undefined}
                style={isActive ? { color: "#ffffff" } : undefined}
                className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide transition-colors ${
                  isActive
                    ? "border-brand-navy bg-brand-navy text-white"
                    : "border-border bg-white text-brand-navy hover:border-brand-cyan"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {activeTab === "leagues-seasons" && grouped.leaguesAndSeasons.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xl font-black uppercase text-brand-navy">
              Leagues & Seasons ({grouped.leaguesAndSeasons.length})
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

        {activeTab === "cups" && grouped.cups.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xl font-black uppercase text-brand-navy">
              Cups ({grouped.cups.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {grouped.cups.map((competition) => (
                <CompetitionCard key={competition.id} competition={competition} compact />
              ))}
            </div>
          </div>
        )}

        {activeTab === "shields" && grouped.shields.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xl font-black uppercase text-brand-navy">
              Shields ({grouped.shields.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {grouped.shields.map((competition) => (
                <CompetitionCard key={competition.id} competition={competition} compact />
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
