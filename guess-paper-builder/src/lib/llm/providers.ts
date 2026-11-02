export type ProviderId = "openai" | "gemini" | "groq" | "anthropic";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  model: string;
  keyHint: string;
}

export const PROVIDERS: ProviderConfig[] = [
  { id: "openai", label: "OpenAI", model: "gpt-4o-mini", keyHint: "sk-..." },
  { id: "gemini", label: "Google Gemini", model: "gemini-1.5-flash", keyHint: "AIza..." },
  { id: "groq", label: "Groq (free tier)", model: "llama-3.1-8b-instant", keyHint: "gsk_..." },
  { id: "anthropic", label: "Anthropic Claude", model: "claude-3-5-haiku-latest", keyHint: "sk-ant-..." },
];

/** Har provider ke liye chat call. Browser se seedha provider ko jaati hai, koi server beech mein nahi. */
export async function chat(
  provider: ProviderId,
  apiKey: string,
  messages: ChatMessage[],
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const config = PROVIDERS.find((p) => p.id === provider);
  if (!config) throw new Error(`Unknown provider: ${provider}`);
  if (!apiKey.trim()) throw new Error("API key missing hai.");

  try {
    switch (provider) {
      case "openai":
      case "groq":
        return await openAiCompatible(provider, config.model, apiKey, messages, fetchImpl);
      case "gemini":
        return await gemini(config.model, apiKey, messages, fetchImpl);
      case "anthropic":
        return await anthropic(config.model, apiKey, messages, fetchImpl);
    }
  } catch (err) {
    // fetch() sirf network / CORS failure par TypeError deta hai.
    if (err instanceof TypeError) {
      throw new Error(
        `${config.label} tak pahunch nahi ho saka. Internet connection, provider ki service, ya API key check karein.`,
      );
    }
    throw err;
  }
}

const OPENAI_URLS: Record<"openai" | "groq", string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
};

async function openAiCompatible(
  provider: "openai" | "groq",
  model: string,
  apiKey: string,
  messages: ChatMessage[],
  fetchImpl: typeof fetch,
): Promise<string> {
  const res = await fetchImpl(OPENAI_URLS[provider], {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.4 }),
  });
  await assertOk(res, provider);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function gemini(
  model: string,
  apiKey: string,
  messages: ChatMessage[],
  fetchImpl: typeof fetch,
): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
    }),
  });
  await assertOk(res, "gemini");
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function anthropic(
  model: string,
  apiKey: string,
  messages: ChatMessage[],
  fetchImpl: typeof fetch,
): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const rest = messages.filter((m) => m.role !== "system");

  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages: rest }),
  });
  await assertOk(res, "anthropic");
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function assertOk(res: Response, provider: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => "");
  throw new Error(`${provider} request failed (${res.status}): ${body.slice(0, 300)}`);
}
