/**
 * Past paper ke text ko individual questions mein todta hai.
 * Common patterns: "1.", "Q1", "Question 1", "1)", "(a)" ke saath.
 */

export interface Question {
  id: string;
  number: string;
  text: string;
  sourceName: string;
  year?: number;
}

// "1. text", "1) text", "Q1 text", "Question 1 text", and tabular "1,text" / "1<TAB>text" rows.
const QUESTION_START =
  /(?:^|\n)\s*(?:Q(?:uestion)?\s*)?(\d{1,2})(?:[.)]\s+|[,\t]\s*"?)(?=\S)/gi;

export function segmentQuestions(text: string, sourceName: string, year?: number): Question[] {
  const matches = [...text.matchAll(QUESTION_START)];
  if (matches.length === 0) {
    return text.trim()
      ? [{ id: `${sourceName}#1`, number: "1", text: text.trim(), sourceName, year }]
      : [];
  }

  const questions: Question[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const body = text.slice(start, end).trim();
    const number = matches[i][1];
    if (body.length < 10) continue;
    questions.push({
      id: `${sourceName}#${number}-${i}`,
      number,
      text: body,
      sourceName,
      year,
    });
  }
  return questions;
}

/** Filename se year nikalta hai, jaise "2021_physics.pdf" ya "Physics-2019.docx". */
export function yearFromName(name: string): number | undefined {
  const match = name.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
}
