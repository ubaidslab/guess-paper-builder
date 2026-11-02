import type { AnalysisReport } from "./analysis/report";
import { chat, type ChatMessage, type ProviderId } from "./llm/providers";

export interface GuessInput {
  report: AnalysisReport;
  bookText: string;
  subject?: string;
  totalMarks?: number;
}

/** LLM ko analysis + book ka context dekar guess paper banwata hai. */
export function buildGuessMessages(input: GuessInput): ChatMessage[] {
  const top = input.report.clusters.slice(0, 40).map((c, i) => {
    return `${i + 1}. [seen ${c.repeatCount}x, years: ${c.years.join(",") || "unknown"}] ${c.representative.text.slice(0, 300)}`;
  });

  const system = [
    "You are an exam preparation assistant.",
    "Create a likely guess paper from past-paper analysis and the book content.",
    "Prefer topics and questions that repeat often across years.",
    "Cover the book content for topics that were never asked but are important.",
    "Use only the provided material. Do not invent facts.",
    "Output in clean Markdown with sections: Instructions, Section A (MCQs), Section B (Short), Section C (Long), and an Answer Key.",
  ].join(" ");

  const user = [
    `Subject: ${input.subject ?? "not specified"}`,
    `Target total marks: ${input.totalMarks ?? 100}`,
    "",
    "## Repeated questions from past papers",
    ...top,
    "",
    "## Book content (excerpt)",
    input.bookText.slice(0, 12000),
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export async function generateGuessPaper(
  provider: ProviderId,
  apiKey: string,
  input: GuessInput,
  fetchImpl?: typeof fetch,
): Promise<string> {
  return chat(provider, apiKey, buildGuessMessages(input), fetchImpl);
}
