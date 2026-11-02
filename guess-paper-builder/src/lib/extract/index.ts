export type SourceKind = "past-paper" | "book";

export const MAX_FILES = 20;

export function ensureFileCount(count: number): void {
  if (count > MAX_FILES) {
    throw new Error(`Aap ${count} files upload kar rahe hain. Maximum ${MAX_FILES} allowed hain.`);
  }
}

/**
 * Heavy libraries (pdf.js, xlsx, mammoth) sirf zaroorat par load hoti hain,
 * taake homepage ka initial load chhota rahe.
 */
export async function extractText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf") return extractPdf(file);
  if (ext === "docx") return extractDocx(file);
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return extractSheet(file);
  if (ext === "txt" || ext === "md") return file.text();

  throw new Error(`Unsupported file type: ${file.name}`);
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Browser mein worker Vite se bundle hota hai. Node (tests) mein pdf.js khud handle karta hai.
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(rebuildLines(content.items as PdfTextItem[]));
  }

  return pages.join("\n\n").replace(/[ \t]+/g, " ").trim();
}

/**
 * pdf.js items ko line-by-line jodta hai. Y position badlay ya EOL aaye to newline lagata hai,
 * taake "1. Question" jaisi numbering apni line par rahe.
 */
interface PdfTextItem {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
}

function rebuildLines(items: PdfTextItem[]): string {
  let text = "";
  let lastY: number | null = null;
  for (const item of items) {
    if (typeof item.str !== "string") continue;
    const y: number | null = item.transform?.[5] ?? lastY;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !text.endsWith("\n")) {
      text += "\n";
    } else if (text && !text.endsWith("\n") && item.str && !text.endsWith(" ")) {
      text += " ";
    }
    text += item.str;
    if (item.hasEOL && !text.endsWith("\n")) text += "\n";
    lastY = y;
  }
  return text.replace(/[ \t]+/g, " ").trim();
}

async function extractDocx(file: File): Promise<string> {
  // Browser build arrayBuffer leta hai; Node build sirf Buffer leta hai.
  const mammoth = (await import("mammoth/mammoth.browser.js")).default;
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value.trim();
}

async function extractSheet(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false });
    parts.push(`Sheet: ${sheetName}\n${csv}`);
  }

  return parts.join("\n\n").trim();
}
