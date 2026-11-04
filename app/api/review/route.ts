import { NextResponse } from "next/server";
import { getPublicProblem } from "@/lib/problems";
import { publicLab } from "@/lib/labs/data";
import { askMuseReview, museConfigured } from "@/lib/muse";

export const maxDuration = 60;

// Tiny per-IP limiter: AI review costs real model calls.
const hits = new Map<string, { count: number; reset: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || cur.reset < now) {
    hits.set(ip, { count: 1, reset: now + 10 * 60 * 1000 });
    return false;
  }
  cur.count += 1;
  return cur.count > 12;
}

const SYSTEM = [
  "You are the BugGym Fix Reviewer, a strict but encouraging debugging coach",
  "for people learning to fix buggy code. You are given the public task, the",
  "buggy starting code, the student's attempted fix, and the grading outcome",
  "(which publicly named checks failed and the first error, if any).",
  "You have NOT seen the hidden test inputs or the reference solution.",
  "Never claim to know what the hidden tests contain, and never claim you ran",
  "or compiled the code - this is a static review.",
  "Reply in exactly this format:",
  "ISSUES:",
  "- one line per concrete reason the fix still fails, tied to actual code",
  "VERDICT: on the right track | off track",
  "TAKEAWAY:",
  "one sentence of advice for the next attempt.",
].join("\n");

interface GradeSummary {
  verdict?: string;
  passed?: number;
  total?: number;
  failed?: string[];
  firstError?: string | null;
}

export async function POST(req: Request) {
  if (!museConfigured()) {
    return NextResponse.json({ error: "AI review is not configured yet" }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) {
    return NextResponse.json({ error: "too many reviews, slow down" }, { status: 429 });
  }
  let body: {
    kind?: string;
    slug?: string;
    code?: string;
    edits?: Record<string, string>;
    grade?: GradeSummary;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const grade = body.grade ?? {};
  if (grade.verdict === "accepted") {
    return NextResponse.json({ error: "nothing to review - it passed" }, { status: 400 });
  }
  const gradeText = [
    `Verdict: ${grade.verdict ?? "wrong_answer"}`,
    `Checks passing: ${grade.passed ?? 0}/${grade.total ?? "?"}`,
    `Failed checks: ${(grade.failed ?? []).join(", ") || "unknown"}`,
    grade.firstError ? `First error: ${String(grade.firstError).slice(0, 600)}` : null,
  ].filter(Boolean).join("\n");

  let user = "";
  if (body.kind === "problem" && typeof body.code === "string") {
    const p = getPublicProblem(body.slug ?? "");
    if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
    user = [
      `TASK (${p.title}, ${p.level}):\n${p.description}`,
      `BUGGY STARTING CODE:\n${p.buggyCode}`,
      `STUDENT'S ATTEMPTED FIX:\n${body.code.slice(0, 12000)}`,
      `GRADING OUTCOME:\n${gradeText}`,
    ].join("\n\n");
  } else if (body.kind === "lab" && body.edits && typeof body.edits === "object") {
    const lab = publicLab(body.slug ?? "");
    if (!lab) return NextResponse.json({ error: "not found" }, { status: 404 });
    const edited = lab.files
      .filter((f) => f.editable && typeof body.edits?.[f.path] === "string")
      .map((f) => `--- ${f.path} (student version) ---\n${String(body.edits?.[f.path]).slice(0, 8000)}`)
      .join("\n\n");
    user = [
      `QA BUG REPORT (${lab.title}, ${lab.stack}):\n${lab.bugReport}`,
      `STUDENT'S EDITED FILES:\n${edited || "(no edits)"}`,
      `GRADING OUTCOME:\n${gradeText}`,
    ].join("\n\n");
  } else {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const review = await askMuseReview(SYSTEM, user);
    return NextResponse.json(review);
  } catch (e) {
    console.error("muse review failed", e);
    return NextResponse.json({ error: "AI review unavailable, try again in a moment" }, { status: 502 });
  }
}
