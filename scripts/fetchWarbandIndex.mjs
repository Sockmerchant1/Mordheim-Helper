import fs from "node:fs/promises";

const baseUrl = "https://broheim.net/";
const indexUrl = new URL("warbands.html", baseUrl).toString();

const response = await fetch(indexUrl);
if (!response.ok) {
  throw new Error(`Failed to fetch ${indexUrl}: ${response.status} ${response.statusText}`);
}

const html = await response.text();
const sections = [];
const sectionPattern = /<h2>\s*-\s*Grade\s*([^<]+?)\s*-\s*<\/h2>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/gi;
let sectionMatch;

while ((sectionMatch = sectionPattern.exec(html))) {
  const gradeLabel = `Grade ${cleanText(sectionMatch[1])}`;
  const gradeCode = gradeLabel.match(/Grade\s+([^\s(]+)/i)?.[1] ?? "unknown";
  const isOfficial = /official/i.test(gradeLabel);
  const tableBody = sectionMatch[2];
  const rowPattern = /<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(tableBody))) {
    const name = cleanText(rowMatch[1]);
    const race = cleanText(rowMatch[2]);
    const sourceCell = rowMatch[3];
    const sourceCode = cleanText(sourceCell.split("|")[0] ?? "");
    const href = sourceCell.match(/href="([^"]+)"/i)?.[1] ?? "";
    const sourceUrl = href ? new URL(href, baseUrl).toString().replace(/ /g, "%20") : "";

    sections.push({
      id: slug(name),
      name,
      race,
      broheimGrade: gradeCode,
      broheimGradeLabel: gradeLabel,
      isOfficial,
      sourceCode,
      sourceUrl,
      implementationStatus: name === "Witch Hunters" ? "implemented" : "not_started"
    });
  }
}

sections.sort((a, b) => a.broheimGrade.localeCompare(b.broheimGrade) || a.name.localeCompare(b.name));

await fs.mkdir("src/data", { recursive: true });
await fs.writeFile(
  "src/data/warbandIndex.json",
  `${JSON.stringify({ sourceUrl: indexUrl, extractedAt: new Date().toISOString(), warbands: sections }, null, 2)}\n`
);

console.log(`Wrote ${sections.length} warbands to src/data/warbandIndex.json`);

function cleanText(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
