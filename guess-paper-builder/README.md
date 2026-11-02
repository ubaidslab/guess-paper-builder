# Guess Paper Builder

A free study tool for students. Upload past exam papers and your textbook, and get:

- a **repetition report** showing which questions keep coming back, and in which years
- a **guess paper** with sections and an answer key
- a **chat** to ask about your material in any language

No login. No subscription. Bring your own AI API key (OpenAI, Google Gemini, Groq or Anthropic Claude). Your files are processed in your browser.

Live site: https://guess-paper-builder.vercel.app (update `siteUrl` in `site.json` after you deploy)
Source: https://github.com/ubaidslab/guess-paper-builder

## Stack

- React + TypeScript + Vite for the tool
- pdf.js, SheetJS and mammoth for reading files in the browser
- A post-build script (`scripts/build-site.mjs`) that generates static, crawlable pages: blog, articles, sitemap, robots.txt, llms.txt, llms-full.txt, RSS feed and 404
- Vercel for hosting

## Run locally

```bash
npm install
npm run dev        # tool at http://localhost:5173
npm test           # unit + end-to-end tests (see below)
npm run build      # type-check, build the app, then generate the static site into dist/
```

## Testing

- `tests/analysis.test.ts`: unit tests for segmentation, clustering, report, prompt building and LLM adapters (fake `fetch`).
- `tests/e2e.test.ts`: runs the real extraction and analysis code on real files in `tests/fixtures/` (PDF, DOCX, XLSX and a book PDF).
- Regenerate fixtures with `python3 tests/fixtures/make_fixtures.py` (needs `reportlab`, `python-docx`, `openpyxl`).

Known limitation: question grouping is keyword-based. On the fixtures, exact and near-exact rephrasings group well, while questions that share a concept but use different key terms (for example two "osmosis" questions with different wording) can end up in separate groups. Review the groups before relying on the counts.

## Project layout

```
guess-paper-builder/
├── index.html               Home page: SEO head, JSON-LD, static content, tool mount point
├── src/                     React app (tool)
│   ├── App.tsx              Upload, provider, analysis, report, guess paper
│   ├── components/          ChatBox, AdSlot
│   └── lib/                 extract/, analysis/, llm/, guess.ts
├── content/
│   ├── blog/*.md            Blog posts (frontmatter: title, description, date, updated, keywords)
│   └── pages/*.md           About, privacy, terms, contact
├── scripts/build-site.mjs   Generates static pages, sitemap, robots, llms.txt, RSS
├── scripts/verify-dist.mjs  Fails the build if required files, canonicals or JSON-LD are wrong
├── public/                  styles/site.css, favicon, og-image, ads.txt
├── site.json                Site name, URL, author details (single source of truth)
├── vercel.json              Vercel build settings and security headers
└── tests/                   Vitest tests
```

## Deploy on Vercel

1. Push this folder to `github.com/ubaidslab/guess-paper-builder`.
2. In Vercel, click **Add New > Project**, import the repo, and keep the defaults (`vercel.json` already sets the build command and output directory).
3. After the first deploy, copy the live URL and set `siteUrl` in `site.json` (and in `index.html` the `__SITE_URL__` placeholders are replaced automatically at build time). Use your custom domain here if you buy one.
4. Commit and redeploy.

## After deploying: SEO and AEO/GEO checklist

- **Google Search Console:** add the property (domain or URL prefix), verify it, and submit `https://your-domain/sitemap.xml`.
- **Bing Webmaster Tools:** import from Search Console, which also covers Copilot and ChatGPT search results.
- **Rich results test:** check the home page and a blog post at search.google.com/test/rich-results.
- **Social preview:** check the OG image at opengraph.xyz. Replace `public/og-image.svg` with a PNG (1200×630) if a platform does not render SVG.
- **Core Web Vitals:** run PageSpeed Insights on the home page after each big change.
- **Backlinks:** share the blog posts on LinkedIn, relevant student groups and forums with real answers, not spam.
- **Refresh content:** update the `updated` field in a post's frontmatter when you revise it. The sitemap and article metadata follow automatically.

## AdSense

1. Apply at adsense.google.com with your deployed site. Approval usually needs a custom domain, original content (the blog helps), and the privacy, terms and contact pages (already included).
2. After approval, add your publisher ID to a `.env` file or the Vercel Environment Variables: `VITE_ADSENSE_PUBLISHER_ID=ca-pub-XXXXXXXXXXXXXXXX`.
3. Replace the placeholder line in `public/ads.txt` with the line AdSense gives you.
4. Redeploy. The ad slots appear only when the ID is set, so the layout is unchanged until then.

## Adding a blog post

Create `content/blog/your-slug.md` with this frontmatter, then run `npm run build`:

```yaml
---
title: "Your title"
description: "One or two sentences that answer the query. This appears in search results."
date: 2026-11-10
updated: 2026-11-10
keywords: comma, separated, keywords
---
```

For FAQ rich data, add a `## Frequently asked questions` section with each question on its own line in bold (`**Question?**`), a blank line, then the answer paragraph.

## Privacy

Files and API keys stay in the browser tab. The only outside request is to the AI provider you select. See `content/pages/privacy.md` for the full policy.

## Limitations

- Question grouping is keyword-based. Check the repetition groups yourself.
- Scanned PDFs without a text layer will not extract well.
- Guess papers are AI-generated study aids, not predictions of the exam.

## License

MIT. See `LICENSE`.

## Author

Ubaid Ali · [LinkedIn](https://linkedin.com/in/m-ubaid-ali) · [GitHub](https://github.com/ubaidslab) · contact.ubaidmalik@gmail.com
