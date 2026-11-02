/**
 * Build ke baad dist/ ko verify karta hai: zaroori files, placeholders, JSON-LD validity,
 * aur har HTML page ka canonical + single H1. Koi check fail ho to build fail hoga.
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const errors = [];

const REQUIRED = [
  "index.html", "404.html", "about.html", "privacy.html", "terms.html", "contact.html",
  "blog/index.html", "sitemap.xml", "robots.txt", "llms.txt", "llms-full.txt", "feed.xml",
  "styles/site.css", "favicon.svg", "og-image.svg", "ads.txt",
];

for (const rel of REQUIRED) {
  if (!existsSync(path.join(DIST, rel))) errors.push(`missing: ${rel}`);
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const files = await walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith(".html"));

for (const file of files.filter((f) => /\.(html|xml|txt)$/.test(f))) {
  const content = await readFile(file, "utf8");
  const rel = path.relative(DIST, file);
  if (content.includes("__SITE_URL__")) errors.push(`placeholder __SITE_URL__ left in ${rel}`);
  if (content.includes("<!--LATEST_POSTS-->")) errors.push(`placeholder LATEST_POSTS left in ${rel}`);
}

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const rel = path.relative(DIST, file);

  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch (e) {
      errors.push(`invalid JSON-LD in ${rel}: ${e.message}`);
    }
  }

  if (rel === "404.html") continue;
  if (!/<link rel="canonical" href="[^"]+"/.test(html)) errors.push(`no canonical in ${rel}`);
  if (!/<meta\s+name="description"\s+content="[^"]+"/.test(html)) errors.push(`no meta description in ${rel}`);

  const h1Count = (html.match(/<h1[\s>]/g) || []).length;
  if (h1Count !== 1) errors.push(`expected 1 <h1> in ${rel}, found ${h1Count}`);
}

if (errors.length) {
  console.error("dist verification failed:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`dist verified: ${htmlFiles.length} HTML pages, all required files present.`);
