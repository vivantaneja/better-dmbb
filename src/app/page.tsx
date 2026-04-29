import {
  FixtureCard,
  Hero,
  NewsCard,
  ResultCard,
  SectionTitle,
} from "@/components/site-shell";
import { getHeroContent } from "@/lib/cms/sanity";
import { getOfficialDmbbData } from "@/lib/data/official-dmbb";

export default async function Home() {
  const [data, heroContent] = await Promise.all([getOfficialDmbbData(), getHeroContent()]);
  return (
    <>
      <Hero
        title={heroContent?.title ?? "Dublin Men's Basketball Board"}
        subtitle={
          heroContent?.subtitle ??
          "League, cup and representative basketball for affiliated clubs across the Dublin region."
        }
      />
      <section className="py-14">
        <div className="dmbb-container grid gap-10 lg:grid-cols-2">
          <div>
            <SectionTitle eyebrow="Upcoming Fixtures" title="This Week" />
            <div className="space-y-3">
              {data.fixtures.slice(0, 4).map((fixture) => (
                <FixtureCard key={fixture.id} fixture={fixture} />
              ))}
            </div>
          </div>
          <div>
            <SectionTitle eyebrow="Recent Results" title="Latest" />
            <div className="space-y-3">
              {data.results.slice(0, 4).map((result) => (
                <ResultCard key={result.id} result={result} />
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="pb-14">
        <div className="dmbb-container">
          <SectionTitle eyebrow="From The Board" title="News & Announcements" />
          <div className="grid gap-4 md:grid-cols-2">
            {data.news.slice(0, 2).map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
