---
tags: [decision]
date: 2026-07-10
---

# Custom User-Agent for data.gov.in (the silent-502 incident)

**Problem.** Every scheduled refresh reported
`[skip] data.gov.in unreachable … HTTP 502` after 8 retries — for days —
while the same URLs worked in a browser.

**Root cause.** The NIC/Citrix WAF in front of `api.data.gov.in` answers
**HTTP 502 to python-requests' / urllib3's default User-Agent** (started
~Jul 2026). Proven by A/B: same IP, same URL — curl UA → 200, python UA → 502.
Not a rate limit, not an IP block, not a time window (a cron-move "fix" was
built on that theory and reverted when a live dispatch disproved it).

**Decision.** Identify honestly with a project UA
(`india-village-finder/1.0 (+repo URL)`) on every data.gov.in session; reuse
the same plumbing for all OGD fetchers.

**Lesson.** When a government API 502s only from CI/scripts, suspect the WAF's
UA fingerprinting **first** and A/B it from the same host before theorizing.

Two stacked bugs hid behind this one (pathspec `add-paths` matching zero
files; `git diff` blind to untracked outputs) — fixed alongside; see
CHANGELOG v1.2.9.
