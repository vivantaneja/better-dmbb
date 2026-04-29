import { z } from "zod";

export const fixtureSchema = z.object({
  id: z.string(),
  division: z.string(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  venue: z.string().default("TBC"),
  tipOff: z.string(),
  status: z.enum(["upcoming", "final"]),
  homeScore: z.number().nullable().optional(),
  awayScore: z.number().nullable().optional(),
});

export const newsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  excerpt: z.string(),
  category: z.string().default("board_notice"),
  publishedAt: z.string(),
  href: z.string().url().optional(),
});

export const competitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.string().default("Senior"),
  teamCount: z.number(),
  description: z.string(),
});

export const standingsRowSchema = z.object({
  competitionId: z.string(),
  team: z.string(),
  played: z.number(),
  won: z.number(),
  lost: z.number(),
  points: z.number(),
});

export const dmbbPayloadSchema = z.object({
  lastSyncedAt: z.string(),
  fixtures: z.array(fixtureSchema),
  results: z.array(fixtureSchema),
  news: z.array(newsItemSchema),
  competitions: z.array(competitionSchema),
  standings: z.array(standingsRowSchema),
});

export type Fixture = z.infer<typeof fixtureSchema>;
export type NewsItem = z.infer<typeof newsItemSchema>;
export type Competition = z.infer<typeof competitionSchema>;
export type StandingsRow = z.infer<typeof standingsRowSchema>;
export type DmbbPayload = z.infer<typeof dmbbPayloadSchema>;
