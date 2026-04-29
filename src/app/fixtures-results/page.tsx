import { FixtureCard, ResultCard, SectionTitle } from "@/components/site-shell";
import { getOfficialDmbbData } from "@/lib/data/official-dmbb";

export const metadata = {
  title: "Fixtures & Results | Dublin Men's Basketball Board",
};

export default async function FixturesResultsPage() {
  const data = await getOfficialDmbbData();
  return (
    <section className="py-14">
      <div className="dmbb-container grid gap-10 lg:grid-cols-2">
        <div>
          <SectionTitle eyebrow="Upcoming Fixtures" title="This Week" />
          <div className="space-y-3">
            {data.fixtures.map((fixture) => (
              <FixtureCard key={fixture.id} fixture={fixture} />
            ))}
          </div>
        </div>
        <div>
          <SectionTitle eyebrow="Recent Results" title="Latest" />
          <div className="space-y-3">
            {data.results.map((result) => (
              <ResultCard key={result.id} result={result} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
