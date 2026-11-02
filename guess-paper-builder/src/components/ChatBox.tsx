import { useState } from "react";
import { chat, type ChatMessage, type ProviderId } from "../lib/llm/providers";

interface Props {
  provider: ProviderId;
  apiKey: string;
  context: string;
}

/** User apni language mein sawal pooch sakta hai. Model ko book ka context diya jata hai. */
export function ChatBox({ provider, apiKey, context }: Props) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    const text = input.trim();
    if (!text) return;
    setError("");
    setBusy(true);

    const system: ChatMessage = {
      role: "system",
      content:
        "You are a study assistant. Answer in the same language the user writes in. Base answers on the provided book excerpt when relevant. If the excerpt does not cover the question, say so.\n\nBook excerpt:\n" +
        context.slice(0, 10000),
    };
    const next: ChatMessage[] = [...history, { role: "user", content: text }];

    try {
      const reply = await chat(provider, apiKey, [system, ...next]);
      setHistory([...next, { role: "assistant", content: reply }]);
      setInput("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tool-card">
      <h3 className="tool-title">Ask about your material</h3>
      <div className="chat" aria-live="polite">
        {history.length === 0 && <p className="muted small">Koi bhi sawal apni language mein poochein.</p>}
        {history.map((m, i) => (
          <div key={i} className={m.role === "user" ? "bubble bubble-user" : "bubble bubble-bot"}>
            {m.content}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Apna sawal likhein..."
          rows={2}
        />
        <button type="button" className="btn btn-primary" onClick={send} disabled={busy || !input.trim()}>
          {busy ? "Thinking..." : "Send"}
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
