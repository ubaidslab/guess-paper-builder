/**
 * Post-build step. Vite builds the React tool into dist/. This script adds the
 * crawlable static pages (blog, articles, sitemap, robots, llms.txt, RSS, 404)
 * so search engines and AI answer engines can read real HTML without running JS.
 */
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const site = JSON.parse(await readFile(path.join(ROOT, "site.json"), "utf8"));
const BASE = site.siteUrl.replace(/\/$/, "");
const TODAY = new Date().toISOString().slice(0, 10);

if (!existsSync(path.join(DIST, "index.html"))) {
  throw new Error("dist/index.html not found. Run `vite build` before this script.");
}

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/* ---------- Content loading ---------- */

function parseDoc(raw, file) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: frontmatter missing`);
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  for (const key of ["title", "description", "date"]) {
    if (!meta[key]) throw new Error(`${file}: missing "${key}" in frontmatter`);
  }
  return { meta, body: match[2] };
}

async function readDocs(dir) {
  const full = path.join(ROOT, "content", dir);
  const files = (await readdir(full)).filter((f) => f.endsWith(".md")).sort();
  const docs = [];
  for (const file of files) {
    const { meta, body } = parseDoc(await readFile(path.join(full, file), "utf8"), file);
    const slug = file.replace(/\.md$/, "");
    docs.push({ slug, meta, body, html: marked.parse(body) });
  }
  return docs;
}

const posts = (await readDocs("blog")).sort((a, b) => b.meta.date.localeCompare(a.meta.date));
const pages = await readDocs("pages");

/* ---------- Helpers ---------- */

function plainText(md) {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\|.*\|/g, "")
    .replace(/[#>*_`]/g, "")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

function extractFaq(body) {
  const start = body.search(/^##\s+Frequently asked questions/im);
  if (start === -1) return [];
  const section = body.slice(start).replace(/^##.*\n/, "").split(/\n## /)[0];
  const blocks = section.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const items = [];
  for (let i = 0; i < blocks.length; i++) {
    const q = blocks[i].match(/^\*\*(.+?)\*\*\s*$/);
    if (!q) continue;
    const answer = blocks[i + 1] && !blocks[i + 1].startsWith("**") ? blocks[i + 1] : "";
    if (!answer) continue;
    items.push({
      "@type": "Question",
      name: q[1].trim(),
      acceptedAnswer: { "@type": "Answer", text: answer.replace(/\*\*/g, "").replace(/\s*\n\s*/g, " ").trim() },
    });
    i++;
  }
  return items;
}

const pageUrl = (slug) => (slug === "home" ? `${BASE}/` : `${BASE}/${slug}`);
const postUrl = (slug) => `${BASE}/blog/${slug}`;

function jsonScript(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

function headTag({ title, description, canonical, type = "website", published, modified, jsonld = [] }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="author" content="${esc(site.author.name)}" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="${type}" />
<meta property="og:site_name" content="${esc(site.name)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:image" content="${BASE}/og-image.svg" />
<meta property="og:locale" content="en_US" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${BASE}/og-image.svg" />
${published ? `<meta property="article:published_time" content="${published}" />` : ""}
${modified ? `<meta property="article:modified_time" content="${modified}" />` : ""}
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)} blog" href="${BASE}/feed.xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/styles/site.css" />
${jsonld.map(jsonScript).join("\n")}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${siteHeader()}
<main id="main">`;
}

function siteHeader() {
  return `<header class="site-header">
  <div class="wrap nav">
    <a class="brand" href="/" aria-label="${esc(site.name)} home"><span class="brand-mark" aria-hidden="true">GP</span><span>${esc(site.name)}</span></a>
    <nav aria-label="Primary">
      <a href="/#tool">Tool</a>
      <a href="/#how">How it works</a>
      <a href="/#faq">FAQ</a>
      <a href="/blog">Blog</a>
      <a href="/about">About</a>
    </nav>
  </div>
</header>`;
}

function siteFooter() {
  return `</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <p class="brand-line">${esc(site.name)}</p>
      <p class="muted">Free study tool by ${esc(site.author.name)}.</p>
    </div>
    <nav aria-label="Footer">
      <a href="/blog">Blog</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
      <a href="${esc(site.githubRepo)}" target="_blank" rel="noopener noreferrer">Source code</a>
    </nav>
  </div>
  <div class="wrap copyright">© ${new Date().getUTCFullYear()} ${esc(site.author.name)}. All rights reserved.</div>
</footer>
</body>
</html>
`;
}

function breadcrumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items
    .map((c, i) =>
      i === items.length - 1
        ? `<li aria-current="page">${esc(c.name)}</li>`
        : `<li><a href="${esc(c.url)}">${esc(c.name)}</a></li>`,
    )
    .join("")}</ol></nav>`;
}

function breadcrumbLd(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
  };
}

const authorLd = {
  "@type": "Person",
  "@id": `${BASE}/#founder`,
  name: site.author.name,
  url: `${BASE}/about`,
  email: `mailto:${site.author.email}`,
  sameAs: [site.author.linkedin, site.author.github],
};

/* ---------- Page builders ---------- */

function renderPost(post) {
  const url = postUrl(post.slug);
  const faq = extractFaq(post.body);
  const crumbs = [
    { name: "Home", url: `${BASE}/` },
    { name: "Blog", url: `${BASE}/blog` },
    { name: post.meta.title, url },
  ];
  const jsonld = [
    {
      "@type": "BlogPosting",
      "@id": `${url}#post`,
      headline: post.meta.title,
      description: post.meta.description,
      url,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      datePublished: post.meta.date,
      dateModified: post.meta.updated || post.meta.date,
      author: authorLd,
      publisher: { "@id": `${BASE}/#founder` },
      image: `${BASE}/og-image.svg`,
      keywords: post.meta.keywords || undefined,
      inLanguage: "en",
      articleSection: "Exam preparation",
    },
    breadcrumbLd(crumbs),
  ];
  if (faq.length) jsonld.push({ "@type": "FAQPage", mainEntity: faq });

  const related = posts.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    headTag({
      title: `${post.meta.title} | ${site.name}`,
      description: post.meta.description,
      canonical: url,
      type: "article",
      published: post.meta.date,
      modified: post.meta.updated || post.meta.date,
      jsonld,
    }) +
    `
<div class="article-wrap"><div class="narrow" style="margin:0 auto">
${breadcrumbs(crumbs)}
<article class="prose">
  <header>
    <h1>${esc(post.meta.title)}</h1>
  </header>
  <p class="byline">By <a rel="author" href="${BASE}/about">${esc(site.author.name)}</a> · Published <time datetime="${post.meta.date}">${formatDate(post.meta.date)}</time>${
      post.meta.updated && post.meta.updated !== post.meta.date
        ? ` · Updated <time datetime="${post.meta.updated}">${formatDate(post.meta.updated)}</time>`
        : ""
    }</p>
  ${post.html}
</article>
<aside class="cta-box" aria-label="Try the tool">
  <h2>Try it on your own papers</h2>
  <p>Upload your past papers and get a repetition report and a guess paper. Free, no signup, and your files stay in your browser.</p>
  <a class="btn" href="/#tool">Open the tool</a>
</aside>
${
  related.length
    ? `<section class="related" aria-labelledby="related-title">
  <h2 id="related-title">Keep reading</h2>
  <ul class="post-list">${related
    .map((r) => `<li class="post-card"><h3><a href="${postUrl(r.slug)}">${esc(r.meta.title)}</a></h3><p>${esc(r.meta.description)}</p></li>`)
    .join("")}</ul>
</section>`
    : ""
}
</div></div>
` +
    siteFooter()
  );
}

function renderPage(page) {
  const url = pageUrl(page.slug);
  const crumbs = [
    { name: "Home", url: `${BASE}/` },
    { name: page.meta.title, url },
  ];
  return (
    headTag({
      title: `${page.meta.title} | ${site.name}`,
      description: page.meta.description,
      canonical: url,
      modified: page.meta.updated,
      jsonld: [
        { "@type": "WebPage", "@id": `${url}#page`, url, name: page.meta.title, description: page.meta.description, dateModified: page.meta.updated, isPartOf: { "@id": `${BASE}/#website` } },
        breadcrumbLd(crumbs),
      ],
    }) +
    `
<div class="article-wrap"><div class="narrow" style="margin:0 auto">
${breadcrumbs(crumbs)}
<article class="prose">
  <header><h1>${esc(page.meta.title)}</h1></header>
  ${page.html}
</article>
</div></div>
` +
    siteFooter()
  );
}

function renderBlogIndex() {
  const url = `${BASE}/blog`;
  const crumbs = [
    { name: "Home", url: `${BASE}/` },
    { name: "Blog", url },
  ];
  const title = `Blog: exam preparation, past papers and revision guides | ${site.name}`;
  const description =
    "Practical guides on finding repeated exam questions, building guess papers, and planning revision with past papers for intermediate and board exams.";
  return (
    headTag({
      title,
      description,
      canonical: url,
      jsonld: [
        { "@type": "CollectionPage", "@id": `${url}#blog`, url, name: "Guess Paper Builder blog", description, hasPart: posts.map((p) => ({ "@type": "BlogPosting", headline: p.meta.title, url: postUrl(p.slug), datePublished: p.meta.date })) },
        breadcrumbLd(crumbs),
      ],
    }) +
    `
<section class="section"><div class="wrap narrow">
${breadcrumbs(crumbs)}
<div class="section-head"><h1>Blog</h1><p>${esc(description)}</p></div>
<ul class="post-list">
${posts.map((p) => postCard(p)).join("\n")}
</ul>
</div></section>
` +
    siteFooter()
  );
}

function postCard(p) {
  return `<li class="post-card">
  <span class="post-meta"><time datetime="${p.meta.date}">${formatDate(p.meta.date)}</time> · ${esc(site.author.name)}</span>
  <h2><a href="${postUrl(p.slug)}">${esc(p.meta.title)}</a></h2>
  <p>${esc(p.meta.description)}</p>
</li>`;
}

function render404() {
  return (
    headTag({ title: `Page not found | ${site.name}`, description: "This page does not exist.", canonical: `${BASE}/404` }).replace(
      'name="robots" content="index,follow,max-image-preview:large"',
      'name="robots" content="noindex,follow"',
    ) +
    `
<div class="not-found wrap">
  <h1>Page not found</h1>
  <p>The page you are looking for does not exist or has moved.</p>
  <p><a class="btn btn-primary" href="/">Go to the tool</a></p>
</div>
` +
    siteFooter()
  );
}

/* ---------- Home page: inject latest posts ---------- */

async function writeHome() {
  const indexPath = path.join(DIST, "index.html");
  let html = await readFile(indexPath, "utf8");
  const latest = posts.slice(0, 3);
  const list = `<ul class="post-list">\n${latest.map((p) => postCard(p)).join("\n")}\n</ul>`;
  html = html.replace("<!--LATEST_POSTS-->", list).replaceAll("__SITE_URL__", BASE);
  if (html.includes("__SITE_URL__") || html.includes("<!--LATEST_POSTS-->")) {
    throw new Error("Home page placeholders were not replaced.");
  }
  await writeFile(indexPath, html);
}

/* ---------- Sitemap, robots, llms.txt, RSS ---------- */

function sitemapXml() {
  const entries = [
    { loc: `${BASE}/`, lastmod: TODAY, priority: "1.0", changefreq: "weekly" },
    { loc: `${BASE}/blog`, lastmod: posts[0]?.meta.date ?? TODAY, priority: "0.8", changefreq: "weekly" },
    ...posts.map((p) => ({ loc: postUrl(p.slug), lastmod: p.meta.updated || p.meta.date, priority: "0.8", changefreq: "monthly" })),
    ...pages.map((p) => ({ loc: pageUrl(p.slug), lastmod: p.meta.updated || p.meta.date, priority: "0.5", changefreq: "yearly" })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((e) => `  <url>\n    <loc>${esc(e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`)
  .join("\n")}
</urlset>
`;
}

function robotsTxt() {
  const aiBots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended"];
  return `# Search and AI crawlers are welcome. Answer engines cite pages they can read.
User-agent: *
Allow: /

${aiBots.map((b) => `User-agent: ${b}\nAllow: /\n`).join("\n")}
Sitemap: ${BASE}/sitemap.xml
`;
}

function llmsTxt() {
  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    "## Key facts",
    "",
    `- Creator: ${site.author.name} (${site.author.linkedin})`,
    "- Price: free. Users pay their chosen AI provider only if they use a paid model.",
    "- Accounts: none required. No signup or login.",
    "- Privacy: files are processed in the browser. The user's API key is not stored or sent to the site owner.",
    "- Supported files: text-based PDF, DOCX, XLS, XLSX, CSV, TXT, MD. Up to 20 files per session.",
    "- Supported AI providers: OpenAI, Google Gemini, Groq, Anthropic Claude.",
    "- Output: repetition report (question groups and how often they repeat by year), guess paper with sections and answer key, follow-up chat.",
    "",
    "## Main pages",
    "",
    `- [Guess Paper Builder tool](${BASE}/): Upload past papers and a book, get a repetition report and a guess paper.`,
    `- [Blog](${BASE}/blog): Guides on exam preparation with past papers.`,
    `- [About](${BASE}/about): Who built the tool and why.`,
    `- [Privacy policy](${BASE}/privacy)`,
    `- [Terms of use](${BASE}/terms)`,
    "",
    "## Articles",
    "",
    ...posts.map((p) => `- [${p.meta.title}](${postUrl(p.slug)}): ${p.meta.description}`),
    "",
    "## Optional",
    "",
    `- [Source code](${site.githubRepo})`,
    `- [Full article text](${BASE}/llms-full.txt)`,
    "",
  ];
  return lines.join("\n");
}

function llmsFullTxt() {
  const parts = [`# ${site.name}: full text`, "", `Source: ${BASE}/`, ""];
  for (const p of posts) {
    parts.push(`## ${p.meta.title}`, "", `URL: ${postUrl(p.slug)}`, `Published: ${p.meta.date}${p.meta.updated ? `, updated ${p.meta.updated}` : ""}`, "", plainText(p.body), "");
  }
  for (const p of pages) {
    parts.push(`## ${p.meta.title}`, "", `URL: ${pageUrl(p.slug)}`, "", plainText(p.body), "");
  }
  return parts.join("\n");
}

function rssXml() {
  const items = posts
    .map(
      (p) => `  <item>
    <title>${esc(p.meta.title)}</title>
    <link>${postUrl(p.slug)}</link>
    <guid isPermaLink="true">${postUrl(p.slug)}</guid>
    <pubDate>${new Date(`${p.meta.date}T00:00:00Z`).toUTCString()}</pubDate>
    <description>${esc(p.meta.description)}</description>
    <author>${esc(site.author.email)} (${esc(site.author.name)})</author>
  </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(site.name)} blog</title>
  <link>${BASE}/blog</link>
  <description>${esc(site.description)}</description>
  <language>en</language>
  <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml" />
${items}
</channel>
</rss>
`;
}

/* ---------- Write everything ---------- */

async function write(rel, content) {
  const full = path.join(DIST, rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content);
}

await writeHome();
await write("blog/index.html", renderBlogIndex());
for (const post of posts) await write(`blog/${post.slug}.html`, renderPost(post));
for (const page of pages) await write(`${page.slug}.html`, renderPage(page));
await write("404.html", render404());
await write("sitemap.xml", sitemapXml());
await write("robots.txt", robotsTxt());
await write("llms.txt", llmsTxt());
await write("llms-full.txt", llmsFullTxt());
await write("feed.xml", rssXml());

console.log(
  `Static site ready: ${posts.length} posts, ${pages.length} pages, sitemap, robots.txt, llms.txt, llms-full.txt, feed.xml, 404.`,
);
