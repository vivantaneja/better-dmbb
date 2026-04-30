import Image from "next/image";
import Link from "next/link";
import type { Competition, Fixture, NewsItem, StandingsRow } from "@/lib/schemas/dmbb";
type BracketRound = {
  label: string;
  matches: Fixture[];
};

export function SiteHeader() {
  const nav = [
    { href: "/", label: "Home" },
    { href: "/news", label: "News" },
    { href: "/competitions", label: "Competitions" },
    { href: "/fixtures-results", label: "Fixtures & Results" },
  ];

  return (
    <header className="bg-brand-navy text-white">
      <div className="dmbb-container flex items-center justify-between gap-3 py-5">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Image
            src="/dmbb-logo.png"
            width={54}
            height={54}
            alt="Dublin Men's Basketball Board logo"
            className="h-11 w-11 rounded-full sm:h-[54px] sm:w-[54px]"
          />
          <div className="truncate text-[11px] uppercase tracking-[0.16em] text-brand-cyan sm:text-xs sm:tracking-[0.2em]">
            Dublin Men&apos;s Basketball Board
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm uppercase tracking-wider">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-brand-cyan transition-colors">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/fixtures-results"
          className="shrink-0 rounded-xl bg-brand-cyan px-3 py-2 text-xs font-semibold uppercase tracking-wide text-brand-navy sm:px-4"
        >
          This Week
        </Link>
      </div>
    </header>
  );
}

export function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="bg-[linear-gradient(180deg,#041f4b_0%,#052a63_100%)] text-white">
      <div className="dmbb-container py-20">
        <p className="mb-3 text-sm uppercase tracking-[0.2em] text-brand-cyan">Season 2025-26 Live</p>
        <h1 className="max-w-3xl text-5xl font-black uppercase leading-[0.95] md:text-7xl">{title}</h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-200">{subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/fixtures-results" className="rounded-xl bg-brand-cyan px-6 py-3 text-sm font-bold uppercase tracking-wide text-brand-navy">
            View Fixtures
          </Link>
          <Link href="/competitions" className="rounded-xl border border-white/25 px-6 py-3 text-sm font-bold uppercase tracking-wide">
            Standings & Competitions
          </Link>
        </div>
      </div>
    </section>
  );
}

export function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="text-xs uppercase tracking-[0.24em] text-brand-cyan">{eyebrow}</p>
      <h2 className="mt-1 text-4xl font-black uppercase text-brand-navy">{title}</h2>
    </div>
  );
}

export function FixtureCard({ fixture }: { fixture: Fixture }) {
  return (
    <article className="dmbb-card p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">{fixture.division}</p>
      <h3 className="mt-2 text-lg font-semibold text-brand-navy">
        {fixture.homeTeam} <span className="text-brand-muted">vs</span> {fixture.awayTeam}
      </h3>
      <p className="mt-1 text-sm text-brand-muted">{fixture.venue}</p>
      <p className="mt-2 text-sm font-medium text-brand-navy">{new Date(fixture.tipOff).toLocaleString()}</p>
    </article>
  );
}

export function ResultCard({ result }: { result: Fixture }) {
  return (
    <article className="dmbb-card p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">{result.division}</p>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <h3 className="min-w-0 text-base font-semibold text-brand-navy">
          {result.homeTeam} <span className="text-brand-muted">vs</span> {result.awayTeam}
        </h3>
        <p className="shrink-0 whitespace-nowrap text-right text-xl font-black leading-none text-brand-navy">
          {result.homeScore ?? "-"} : {result.awayScore ?? "-"}
        </p>
      </div>
    </article>
  );
}

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article className="dmbb-card p-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-cyan">{item.category.replace("_", " ")}</p>
      <h3 className="mt-3 text-3xl font-black uppercase leading-tight text-brand-navy">{item.title}</h3>
      <p className="mt-3 text-brand-muted">{item.excerpt}</p>
    </article>
  );
}

export function CompetitionCard({ competition, compact = false }: { competition: Competition; compact?: boolean }) {
  const isGenericDescription =
    /sourced from official dmbb\.ie|official dmbb competition data/i.test(
      competition.description,
    );

  return (
    <Link href={`/competitions/${competition.id}`} className="block">
      <article className={`dmbb-card transition-transform hover:-translate-y-0.5 ${compact ? "p-3.5" : "p-6"}`}>
        <p className={`font-bold uppercase text-brand-cyan ${compact ? "text-[10px] tracking-[0.18em]" : "text-xs tracking-[0.2em]"}`}>
          {competition.tier}
        </p>
        <h3 className={`font-black uppercase text-brand-navy ${compact ? "mt-2 text-lg leading-tight" : "mt-3 text-3xl"}`}>
          {competition.name}
        </h3>
        {!compact && !isGenericDescription && <p className="mt-3 text-brand-muted">{competition.description}</p>}
      </article>
    </Link>
  );
}

export function StandingsTable({ rows }: { rows: StandingsRow[] }) {
  return (
    <div className="dmbb-card overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-brand-navy text-white">
          <tr>
            <th className="px-4 py-3">Team</th>
            <th className="px-4 py-3">P</th>
            <th className="px-4 py-3">W</th>
            <th className="px-4 py-3">L</th>
            <th className="px-4 py-3">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.competitionId}-${row.team}`} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{row.team}</td>
              <td className="px-4 py-3">{row.played}</td>
              <td className="px-4 py-3">{row.won}</td>
              <td className="px-4 py-3">{row.lost}</td>
              <td className="px-4 py-3 font-semibold">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TournamentBracket({ rounds }: { rounds: BracketRound[] }) {
  const renderMatchCard = (match: Fixture) => (
    <article key={match.id} className="dmbb-card p-4">
      <p className="text-xs uppercase tracking-wider text-brand-muted">
        {new Date(match.tipOff).toLocaleDateString()}
      </p>
      <div className="mt-2 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-brand-navy">{match.homeTeam}</span>
          <span className="text-lg font-black text-brand-navy">
            {match.homeScore ?? "-"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-brand-navy">{match.awayTeam}</span>
          <span className="text-lg font-black text-brand-navy">
            {match.awayScore ?? "-"}
          </span>
        </div>
      </div>
      <p className="mt-3 text-xs text-brand-muted">{match.venue}</p>
    </article>
  );

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-max grid-flow-col auto-cols-[18rem] items-center gap-6">
        {rounds.map((round) => (
          <section key={round.label} className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-brand-cyan">
              {round.label}
            </h4>
            <div className="space-y-3">
              {round.matches.map((match) => renderMatchCard(match))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-brand-navy py-10 text-sm text-slate-200">
      <div className="dmbb-container flex flex-wrap items-center justify-between gap-3">
        <p>Official Dublin Men&apos;s Basketball Board</p>
        <p>Data source: dmbb.ie</p>
      </div>
    </footer>
  );
}
