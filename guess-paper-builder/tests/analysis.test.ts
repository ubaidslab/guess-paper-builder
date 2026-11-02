import { describe, it, expect } from "vitest";
import { segmentQuestions, yearFromName } from "../src/lib/analysis/segment";
import { buildReport } from "../src/lib/analysis/report";
import { jaccard } from "../src/lib/analysis/similarity";
import { buildGuessMessages } from "../src/lib/guess";
import { chat } from "../src/lib/llm/providers";

const PAPER_2021 = `
1. Define Newton's second law of motion and explain its significance in daily life.
2. Calculate the kinetic energy of a 5 kg object moving at 10 m/s.
3. Describe the process of photosynthesis in plants.
`;

const PAPER_2022 = `
1. Define Newton's second law of motion and explain its significance in everyday life.
2. Describe the structure of a plant cell with a labelled diagram.
3. Calculate the kinetic energy of an object of mass 5 kg moving at 10 m/s.
`;

describe("yearFromName", () => {
  it("filename se year nikalta hai", () => {
    expect(yearFromName("physics_2021.pdf")).toBe(2021);
    expect(yearFromName("Chemistry-2019-paper.docx")).toBe(2019);
    expect(yearFromName("notes.txt")).toBeUndefined();
  });
});

describe("segmentQuestions", () => {
  it("numbered questions ko alag karta hai", () => {
    const qs = segmentQuestions(PAPER_2021, "p2021.pdf", 2021);
    expect(qs).toHaveLength(3);
    expect(qs[0].number).toBe("1");
    expect(qs[0].text).toContain("Newton");
    expect(qs[0].year).toBe(2021);
  });

  it("empty text par koi question nahi", () => {
    expect(segmentQuestions("   ", "x.txt")).toEqual([]);
  });
});

describe("jaccard", () => {
  it("identical text ka score 1 hai", () => {
    expect(jaccard("kinetic energy of a moving object", "kinetic energy of a moving object")).toBe(1);
  });
  it("bilkul alag text ka score 0 hai", () => {
    expect(jaccard("photosynthesis plants", "newton motion")).toBe(0);
  });
});

describe("buildReport", () => {
  it("repeated questions ko cluster karta hai aur count sahi dikhata hai", () => {
    const qs = [
      ...segmentQuestions(PAPER_2021, "p2021.pdf", 2021),
      ...segmentQuestions(PAPER_2022, "p2022.pdf", 2022),
    ];
    const report = buildReport(qs);

    expect(report.totalQuestions).toBe(6);
    const newton = report.clusters.find((c) => c.representative.text.includes("Newton"));
    const energy = report.clusters.find((c) => c.repeatCount === 2 && c.representative.text.includes("kinetic"));
    expect(newton?.repeatCount).toBe(2);
    expect(energy?.repeatCount).toBe(2);
    expect(newton?.years).toEqual([2021, 2022]);
    expect(report.clusters[0].repeatCount).toBeGreaterThanOrEqual(report.clusters[report.clusters.length - 1].repeatCount);
  });
});

describe("buildGuessMessages", () => {
  it("system aur user messages banata hai, book text shamil karta hai", () => {
    const report = buildReport(segmentQuestions(PAPER_2021, "p.pdf", 2021));
    const msgs = buildGuessMessages({ report, bookText: "Newton laws book text", subject: "Physics" });
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].content).toContain("Physics");
    expect(msgs[1].content).toContain("Newton laws book text");
  });
});

describe("chat adapters", () => {
  it("API key khali ho to error", async () => {
    await expect(chat("openai", "  ", [{ role: "user", content: "hi" }])).rejects.toThrow("API key");
  });

  it("OpenAI-compatible response se text nikalta hai", async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 })) as typeof fetch;
    const out = await chat("groq", "gsk_test", [{ role: "user", content: "hi" }], fakeFetch);
    expect(out).toBe("ok");
  });

  it("non-ok response par error throw karta hai", async () => {
    const fakeFetch = (async () => new Response("bad key", { status: 401 })) as typeof fetch;
    await expect(
      chat("anthropic", "sk-ant-bad", [{ role: "user", content: "hi" }], fakeFetch),
    ).rejects.toThrow("401");
  });
});
