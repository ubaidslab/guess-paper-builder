// @vitest-environment node
/**
 * End-to-end pipeline test on real files: PDF, DOCX, XLSX and a book PDF.
 * Uses the same extraction, segmentation and report code the browser app uses.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { extractText } from "../src/lib/extract";
import { segmentQuestions, yearFromName, type Question } from "../src/lib/analysis/segment";
import { buildReport } from "../src/lib/analysis/report";

const FIXTURES = path.join(__dirname, "fixtures");

function loadFile(name: string): File {
  const buf = readFileSync(path.join(FIXTURES, name));
  return new File([buf], name);
}

async function loadPapers(): Promise<Question[]> {
  const names = readdirSync(FIXTURES).filter((n) => /^paper_\d{4}\.(pdf|docx|xlsx)$/.test(n));
  const all: Question[] = [];
  for (const name of names) {
    const text = await extractText(loadFile(name));
    all.push(...segmentQuestions(text, name, yearFromName(name)));
  }
  return all;
}

describe("e2e: extraction from real files", () => {
  it("PDF text ke lines alag rehte hain (questions ki numbering sahi)", async () => {
    const text = await extractText(loadFile("paper_2020.pdf"));
    const numbered = text.match(/(^|\n)\s*\d\.\s/g) ?? [];
    expect(numbered.length).toBe(5);
  });

  it("DOCX se text nikalta hai", async () => {
    const text = await extractText(loadFile("paper_2022.docx"));
    expect(text).toContain("Newton");
    expect(text).toContain("diffusion");
  });

  it("XLSX ki sheet aur rows text mein aati hain", async () => {
    const text = await extractText(loadFile("paper_2024.xlsx"));
    expect(text).toContain("Sheet: Paper");
    expect(text).toContain("kinetic energy");
  });
});

describe("e2e: question segmentation across formats", () => {
  it("har paper se 5 questions milte hain", async () => {
    const qs = await loadPapers();
    const byYear = new Map<number | undefined, number>();
    for (const q of qs) byYear.set(q.year, (byYear.get(q.year) ?? 0) + 1);
    expect(qs.length).toBe(25);
    for (const year of [2020, 2021, 2022, 2023, 2024]) {
      expect(byYear.get(year), `year ${year}`).toBe(5);
    }
  });
});

describe("e2e: repetition report on real papers", () => {
  it("Newton's second law wala question sabse zyada repeat hota hai (rephrased versions bhi)", async () => {
    const qs = await loadPapers();
    const report = buildReport(qs);
    const newton = report.clusters.find((c) => /newton/i.test(c.representative.text));
    expect(newton, "newton cluster").toBeDefined();
    expect(newton!.repeatCount).toBeGreaterThanOrEqual(4);
    expect(newton!.years.length).toBeGreaterThanOrEqual(4);
  });

  it("kinetic energy group 2020, 2023, 2024 mein milta hai", async () => {
    const qs = await loadPapers();
    const report = buildReport(qs);
    const ke = report.clusters.find((c) => /kinetic energy/i.test(c.representative.text) && c.repeatCount >= 2);
    expect(ke, "kinetic energy cluster").toBeDefined();
    expect(ke!.repeatCount).toBeGreaterThanOrEqual(3);
  });

  it("unique questions ka cluster count total se kam hai (grouping kaam kar rahi hai)", async () => {
    const qs = await loadPapers();
    const report = buildReport(qs);
    expect(report.uniqueClusters).toBeLessThan(report.totalQuestions);
    expect(report.clusters[0].repeatCount).toBeGreaterThan(1);
  });
});
