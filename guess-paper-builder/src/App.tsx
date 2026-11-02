import { useMemo, useState } from "react";
import { extractText, ensureFileCount, type SourceKind } from "./lib/extract";
import { segmentQuestions, yearFromName, type Question } from "./lib/analysis/segment";
import { buildReport, reportToMarkdown, type AnalysisReport } from "./lib/analysis/report";
import { PROVIDERS, type ProviderId } from "./lib/llm/providers";
import { generateGuessPaper } from "./lib/guess";
import { AdSlot } from "./components/AdSlot";
import { ChatBox } from "./components/ChatBox";

export default function App() {
  const [files, setFiles] = useState<Array<{ file: File; kind: SourceKind }>>([]);
  const [provider, setProvider] = useState<ProviderId>("groq");
  const [apiKey, setApiKey] = useState("");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState("");
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [guess, setGuess] = useState("");
  const [bookText, setBookText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const providerConfig = useMemo(() => PROVIDERS.find((p) => p.id === provider), [provider]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>, kind: SourceKind) {
    const picked = Array.from(e.target.files ?? []);
    setError("");
    try {
      ensureFileCount(files.length + picked.length);
      setFiles((prev) => [...prev, ...picked.map((file) => ({ file, kind }))]);
    } catch (err) {
      setError((err as Error).message);
    }
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function run() {
    setError("");
    setGuess("");
    setBusy(true);
    try {
      setStatus("Files padh raha hoon...");
      const allQuestions: Question[] = [];
      let book = "";

      for (const { file, kind } of files) {
        const text = await extractText(file);
        if (kind === "book") {
          book += `\n\n${text}`;
        } else {
          allQuestions.push(...segmentQuestions(text, file.name, yearFromName(file.name)));
        }
      }

      if (allQuestions.length === 0) {
        throw new Error("Past papers se koi question nahi mila. Files aur format check karein.");
      }

      setStatus("Repeated questions dhoond raha hoon...");
      const rep = buildReport(allQuestions);
      setReport(rep);
      setBookText(book);

      if (!apiKey.trim()) {
        setStatus("Report tayar hai. Guess paper ke liye API key daalein.");
        return;
      }

      setStatus("Guess paper bana raha hoon...");
      const paper = await generateGuessPaper(provider, apiKey, {
        report: rep,
        bookText: book,
        subject: subject || undefined,
      });
      setGuess(paper);
      setStatus("Ho gaya.");
    } catch (err) {
      setError((err as Error).message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function downloadText(name: string, content: string) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="tool">
      <div className="tool-card">
        <h3 className="tool-title">1. Upload your files</h3>
        <div className="upload-grid">
          <label className="drop">
            <span className="drop-title">Past papers</span>
            <span className="drop-hint">PDF, DOCX, XLSX, XLS, CSV, TXT</span>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
              onChange={(e) => onPick(e, "past-paper")}
            />
          </label>
          <label className="drop">
            <span className="drop-title">Book or notes</span>
            <span className="drop-hint">PDF, DOCX, TXT, MD</span>
            <input type="file" multiple accept=".pdf,.docx,.txt,.md" onChange={(e) => onPick(e, "book")} />
          </label>
        </div>
        <p className="muted small">{files.length} of 20 files added</p>
        {files.length > 0 && (
          <ul className="file-list">
            {files.map(({ file, kind }, i) => (
              <li key={`${file.name}-${i}`}>
                <span className="file-name">{file.name}</span>
                <span className={`tag tag-${kind}`}>{kind === "book" ? "Book" : "Past paper"}</span>
                <button type="button" className="link-btn" onClick={() => removeFile(i)} aria-label={`Remove ${file.name}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="tool-card">
        <h3 className="tool-title">2. Choose your AI provider</h3>
        <div className="form-grid">
          <label>
            <span>Provider</span>
            <select value={provider} onChange={(e) => setProvider(e.target.value as ProviderId)}>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Subject (optional)</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Physics" />
          </label>
          <label className="span-2">
            <span>Your API key</span>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              placeholder={providerConfig?.keyHint}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <small className="muted">Kept only in this browser tab. Never saved or sent to us.</small>
          </label>
        </div>
      </div>

      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={busy || files.length === 0} onClick={run}>
          {busy ? "Working..." : apiKey.trim() ? "Analyse and generate" : "Analyse papers"}
        </button>
        {status && <p className="muted" role="status">{status}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>

      <AdSlot id="tool-top" />

      {report && (
        <div className="tool-card">
          <div className="result-head">
            <div>
              <h3 className="tool-title">Repetition report</h3>
              <p className="muted small">
                {report.totalQuestions} questions analysed, grouped into {report.uniqueClusters} unique groups.
              </p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => downloadText("repetition-report.md", reportToMarkdown(report))}>
              Download report
            </button>
          </div>
          <ol className="report-list">
            {report.clusters.slice(0, 25).map((c, i) => (
              <li key={i}>
                <span className="count-badge">{c.repeatCount}x</span>
                <div>
                  <p>{c.representative.text.slice(0, 180)}{c.representative.text.length > 180 ? "..." : ""}</p>
                  {c.years.length > 0 && <small className="muted">Years: {c.years.join(", ")}</small>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {guess && (
        <div className="tool-card">
          <div className="result-head">
            <h3 className="tool-title">Your guess paper</h3>
            <button type="button" className="btn btn-ghost" onClick={() => downloadText("guess-paper.md", guess)}>
              Download paper
            </button>
          </div>
          <pre className="output">{guess}</pre>
        </div>
      )}

      {report && apiKey.trim() && <ChatBox provider={provider} apiKey={apiKey} context={bookText} />}

      <AdSlot id="tool-bottom" />
    </div>
  );
}
