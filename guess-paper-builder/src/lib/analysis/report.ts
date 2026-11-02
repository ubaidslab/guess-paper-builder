import { jaccard, tokenize } from "./similarity";
import type { Question } from "./segment";

export interface QuestionCluster {
  representative: Question;
  occurrences: Question[];
  repeatCount: number;
  years: number[];
  keywords: string[];
  sources: string[];
}

export interface AnalysisReport {
  totalQuestions: number;
  uniqueClusters: number;
  clusters: QuestionCluster[];
  topicDistribution: Array<{ topic: string; count: number }>;
}

/**
 * Greedy clustering: har question ko pehle wale cluster se compare karta hai.
 * Threshold se zyada similar ho to usi cluster mein dal deta hai.
 */
export function clusterQuestions(questions: Question[], threshold = 0.35): QuestionCluster[] {
  const clusters: QuestionCluster[] = [];

  for (const q of questions) {
    let best: QuestionCluster | undefined;
    let bestScore = 0;

    for (const cluster of clusters) {
      const score = jaccard(q.text, cluster.representative.text);
      if (score > bestScore) {
        bestScore = score;
        best = cluster;
      }
    }

    if (best && bestScore >= threshold) {
      best.occurrences.push(q);
    } else {
      clusters.push({
        representative: q,
        occurrences: [q],
        repeatCount: 1,
        years: [],
        keywords: [],
        sources: [],
      });
    }
  }

  for (const cluster of clusters) {
    cluster.repeatCount = cluster.occurrences.length;
    cluster.years = [...new Set(cluster.occurrences.map((o) => o.year).filter((y): y is number => y !== undefined))].sort();
    cluster.sources = [...new Set(cluster.occurrences.map((o) => o.sourceName))];
    cluster.keywords = topKeywords(cluster.occurrences.map((o) => o.text), 5);
  }

  return clusters.sort((a, b) => b.repeatCount - a.repeatCount);
}

function topKeywords(texts: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const token of new Set(tokenize(text))) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

export function buildReport(questions: Question[], threshold?: number): AnalysisReport {
  const clusters = clusterQuestions(questions, threshold);

  const topicCounts = new Map<string, number>();
  for (const cluster of clusters) {
    const topic = cluster.keywords[0] ?? "general";
    topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + cluster.repeatCount);
  }

  return {
    totalQuestions: questions.length,
    uniqueClusters: clusters.length,
    clusters,
    topicDistribution: [...topicCounts.entries()]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function reportToMarkdown(report: AnalysisReport): string {
  const lines: string[] = [
    "# Question Repetition Report",
    "",
    `Total questions analysed: ${report.totalQuestions}`,
    `Unique question groups: ${report.uniqueClusters}`,
    "",
    "## Repeated questions",
    "",
    "| # | Times seen | Years | Sources | Question (preview) |",
    "|---|---|---|---|---|",
  ];

  report.clusters.forEach((c, i) => {
    const preview = c.representative.text.slice(0, 90).replace(/\|/g, "/").replace(/\n/g, " ");
    lines.push(
      `| ${i + 1} | ${c.repeatCount} | ${c.years.join(", ") || "-"} | ${c.sources.length} | ${preview}... |`,
    );
  });

  lines.push("", "## Topic distribution", "");
  for (const t of report.topicDistribution) {
    lines.push(`- **${t.topic}**: ${t.count} appearances`);
  }

  return lines.join("\n");
}
