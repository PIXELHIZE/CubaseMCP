import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

interface ChartEntry {
  rank: number;
  title: string;
  artist: string;
}

const args = process.argv.slice(2);
const option = (name: string, fallback: string): string => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const year = Number.parseInt(option("--year", "2025"), 10);
if (!Number.isInteger(year) || year < 2008 || year > 2100) {
  throw new Error(`Invalid Billboard Japan year: ${year}`);
}

const outputDirectory = resolve(option("--output", "research/jpop-reference/catalog"));
const sourceUrl = `https://www.billboard-japan.com/charts/detail?a=hot100_year&year=${year}`;

const decodeHtml = (value: string): string => value
  .replace(/<[^>]*>/g, "")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const response = await fetch(sourceUrl, {
  headers: { "user-agent": "CubaseMCP-JpopReferenceCollector/1.0 (+https://github.com/PIXELHIZE/CubaseMCP)" }
});
if (!response.ok) throw new Error(`Billboard Japan returned HTTP ${response.status}.`);
const html = await response.text();

const entries: ChartEntry[] = [];
const rowPattern = /<tr class="rank(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;
for (const match of html.matchAll(rowPattern)) {
  const rank = Number.parseInt(match[1]!, 10);
  const row = match[2]!;
  const title = row.match(/<p class="musuc_title">([\s\S]*?)<\/p>/)?.[1];
  const artist = row.match(/<p class="artist_name">([\s\S]*?)<\/p>/)?.[1];
  if (title && artist) entries.push({ rank, title: decodeHtml(title), artist: decodeHtml(artist) });
}

entries.sort((left, right) => left.rank - right.rank);
if (entries.length !== 100 || entries.some((entry, index) => entry.rank !== index + 1)) {
  throw new Error(`Expected ranks 1-100 from Billboard Japan, parsed ${entries.length}.`);
}

const collectedAt = new Date().toISOString();
const chart = {
  schemaVersion: 1,
  chart: "Billboard Japan Hot 100 Year End",
  year,
  sourceUrl,
  collectedAt,
  usePolicy: "Metadata/reference index only. Do not treat ranking data as a license to copy recordings, lyrics, MIDI, or complete transcriptions.",
  entries
};
const json = `${JSON.stringify(chart, null, 2)}\n`;
const fileName = `billboard-japan-hot-100-${year}.json`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, fileName), json, "utf8");
await writeFile(resolve(outputDirectory, `collection-manifest-${year}.json`), `${JSON.stringify({
  schemaVersion: 1,
  collectedAt,
  files: [{
    path: fileName,
    records: entries.length,
    sha256: createHash("sha256").update(json).digest("hex"),
    sourceUrl
  }]
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ ok: true, outputDirectory, year, records: entries.length }, null, 2));
