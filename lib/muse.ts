import "server-only";

// Muse Spark Open (Meta open-weight coding model) via the Baseten
// OpenAI-compatible Model API. Server-only: the key lives in BASETEN_API_KEY
// and is never shipped to the browser.

const BASETEN_URL = "https://inference.baseten.co/v1/chat/completions";
const MODEL = "meta-models/muse-spark-open";

export interface MuseReview {
  issues: string[];
  verdict: string;
  takeaway: string;
}

export function museConfigured(): boolean {
  return Boolean(process.env.BASETEN_API_KEY);
}

export async function askMuseReview(systemPrompt: string, userPrompt: string): Promise<MuseReview> {
  const key = process.env.BASETEN_API_KEY;
  if (!key) throw new Error("not_configured");
  const res = await fetch(BASETEN_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1400,
    }),
  });
  if (!res.ok) throw new Error("model_http_" + res.status);
  const data = await res.json();
  const msg = data.choices?.[0]?.message ?? {};
  const text: string = msg.content || msg.reasoning_content || "";
  return parseReview(text);
}

function parseReview(text: string): MuseReview {
  const clean = text.replace(/\*\*/g, "");
  const issues: string[] = [];
  const im = /ISSUES:\s*\n([\s\S]*?)(?=\nVERDICT:|$)/.exec(clean);
  if (im) {
    for (const ln of im[1].split("\n")) {
      const t = ln.replace(/^\s*[-\u2022]\s*/, "").trim();
      if (t) issues.push(t);
      if (issues.length === 4) break;
    }
  }
  const vm = /VERDICT:\s*(.+)/.exec(clean);
  const tm = /TAKEAWAY:\s*\n?([\s\S]*?)$/.exec(clean);
  return {
    issues,
    verdict: (vm?.[1] ?? "").trim().slice(0, 80),
    takeaway: (tm?.[1] ?? "").trim().split("\n")[0].slice(0, 300),
  };
}
