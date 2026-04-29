import { createClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const apiVersion = "2026-04-24";

export const sanityClient =
  projectId
    ? createClient({
        projectId,
        dataset,
        apiVersion,
        useCdn: true,
      })
    : null;

export type HeroContent = {
  seasonBadge: string;
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
};

export async function getHeroContent(): Promise<HeroContent | null> {
  if (!sanityClient) return null;
  const query = `*[_type == "heroContent"][0]{
    seasonBadge, title, subtitle, primaryCtaLabel, primaryCtaHref, secondaryCtaLabel, secondaryCtaHref
  }`;
  return sanityClient.fetch<HeroContent | null>(query);
}
