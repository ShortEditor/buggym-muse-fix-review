"use client";

import { useState } from "react";

interface GradeSummary {
  verdict?: string;
  passed?: number;
  total?: number;
  failed?: string[];
  firstError?: string | null;
}

interface Review {
  issues?: string[];
  verdict?: string;
  takeaway?: string;
  error?: string;
}

// Muse Fix Review: after a failed grading, the student can ask Muse Spark
// Open (Meta open-weight model, via Baseten) for a coach-style review of
// why the fix still fails. Hidden tests and reference solutions are never
// sent - the model reviews only what the student can already see.
export default function FixReview({
  kind,
  slug,
  getPayload,
}: {
  kind: "problem" | "lab";
  slug: string;
  getPayload: () => { code?: string; edits?: Record<string, string>; grade: GradeSummary };
}) {
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<Review | null>(null);

  async function ask() {
    setLoading(true);
    setReview(null);
    try {
      const r = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, slug, ...getPayload() }),
      });
      setReview(await r.json());
    } catch {
      setReview({ error: "Network error. Try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 border-t border-zinc-800 pt-3">
      {!review && (
        <button
          onClick={ask}
          disabled={loading}
          className="rounded-md border border-[#00b8a3]/40 px-3 py-1.5 text-xs font-semibold text-[#00b8a3] transition hover:bg-[#00b8a3]/10 disabled:opacity-50"
        >
          {loading ? "Muse is reviewing..." : "Why did this fail? Ask Muse Review"}
        </button>
      )}
      {review?.error && <p className="text-xs text-[#ff375f]">{review.error}</p>}
      {review && !review.error && (
        <div className="rounded-md bg-[#00b8a3]/5 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#00b8a3]">
              Muse Fix Review{review.verdict ? " - " + review.verdict : ""}
            </span>
            <button
              onClick={() => setReview(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              close
            </button>
          </div>
          <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-300">
            {review.issues?.map((i, k) => <li key={k}>{i}</li>)}
          </ul>
          {review.takeaway && (
            <p className="mt-2 text-xs italic text-zinc-400">{review.takeaway}</p>
          )}
          <p className="mt-2 text-[10px] text-zinc-600">
            AI static review by Muse Spark Open - hidden tests are never shared with the model.
          </p>
        </div>
      )}
    </div>
  );
}
