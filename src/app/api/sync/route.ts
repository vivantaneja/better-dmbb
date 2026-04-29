import { NextResponse } from "next/server";
import { syncDmbbData } from "@/lib/data/official-dmbb";

export async function GET() {
  const payload = await syncDmbbData();
  return NextResponse.json({
    ok: true,
    lastSyncedAt: payload.lastSyncedAt,
    counts: {
      fixtures: payload.fixtures.length,
      results: payload.results.length,
      competitions: payload.competitions.length,
      news: payload.news.length,
      standings: payload.standings.length,
    },
  });
}
