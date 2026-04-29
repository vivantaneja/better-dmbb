import * as cheerio from "cheerio";

const BASE_URL = "https://dmbb.ie";

async function fetchPage(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    return null;
  }
  return response.text();
}

async function run() {
  const [newsHtml, competitionsHtml, homeHtml] = await Promise.all([
    fetchPage("/news"),
    fetchPage("/competitions"),
    fetchPage("/"),
  ]);

  const news$ = cheerio.load(newsHtml ?? homeHtml ?? "");
  const comp$ = cheerio.load(competitionsHtml ?? homeHtml ?? "");

  const newsCount = news$("article, .news-item").length;
  const competitionCount = comp$(".competition-card, .card, .league").length;

  console.log(
    JSON.stringify(
      {
        ok: true,
        source: BASE_URL,
        syncedAt: new Date().toISOString(),
        usedFallback: !newsHtml || !competitionsHtml,
        newsCount,
        competitionCount,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
