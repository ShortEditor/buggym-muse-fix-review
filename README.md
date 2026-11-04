# BugGym - Muse Fix Review (Meta Global AI Developer Hackathon 2026)

New feature built during the hackathon building period (Oct 27 - Nov 4, 2026) for
[BugGym](https://buggym.vercel.app), an existing product (Startups track).

BugGym is a live debugging-practice app: 74 server-graded problems in 4 languages
plus real-project Labs, graded by hidden tests on the server. The full product
codebase stays private; this repo contains the complete new work built during
the hackathon window.

## What was newly developed during the hackathon (Nov 4, 2026)

**Muse Fix Review** - when a student's fix fails the deterministic grading, they
can ask "Why did this fail?". Meta's open-weight **Muse Spark Open** model (served
via Baseten) reviews the attempt and returns a coach-style explanation:

- `lib/muse.ts` - server-only client for the Muse model on Baseten
- `app/api/review/route.ts` - POST `/api/review` route
- `components/FixReview.tsx` - shared UI (button + review card)
- `patches/ui-wiring.patch` - the two small diffs wiring the component into the
  existing problem Solver and Lab Workspace screens

## Integrity boundaries (by design)

- Deterministic grading (Judge0 + hidden test suites) stays the source of truth;
  the model never grades.
- Hidden tests and reference solutions are **never** sent to the model - the
  route reads only the public task, the buggy starting code the student already
  sees, the student's own code, and the grading outcome.
- The model does not run or compile code; the UI presents the result as an AI
  static review and says so.
- Per-IP rate limit; returns 503 when `BASETEN_API_KEY` is not configured.


## Known model behavior

Muse is a language model and is not perfect: in testing it occasionally echoed
its answer-format template instead of reviewing the code, and its explanations
can be wrong. The deterministic grader stays the source of truth; treat the
review as helpful guidance, not verdict.

## Running it

These files drop into the BugGym Next.js 16 app (private repo). Set
`BASETEN_API_KEY` (Baseten, model `meta-models/muse-spark-open`) and the route
is live. Without the key, the feature degrades gracefully to a 503 the UI shows
as "AI review is not configured yet".

Live product: https://buggym.vercel.app
Built by ShortEditor with AI coding tools.
