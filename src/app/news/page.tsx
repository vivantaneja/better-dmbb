import { NewsCard, SectionTitle } from "@/components/site-shell";
import { getOfficialDmbbData } from "@/lib/data/official-dmbb";

export const metadata = {
  title: "News | Dublin Men's Basketball Board",
};

export default async function NewsPage() {
  const data = await getOfficialDmbbData();
  return (
    <section className="py-14">
      <div className="dmbb-container">
        <SectionTitle eyebrow="From The Board" title="News & Announcements" />
        <div className="mb-6 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">
          {["Match Report", "Season Update", "Coaching", "Cup Draw", "Board Notice"].map((tag) => (
            <span key={tag} className="rounded-full border border-border bg-surface px-3 py-1">
              {tag}
            </span>
          ))}
        </div>
        <div className="space-y-4">
          {data.news.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
