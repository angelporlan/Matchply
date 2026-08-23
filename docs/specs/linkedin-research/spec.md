# Matchply LinkedIn research — specification

## Objective

Matchply.com is the system of record for capturing LinkedIn offers, pairing a Chrome extension, queuing deep research, and presenting a source-backed report. The local `teng` bridge remains only as a migration/compatibility tool.

## Security boundary

- The extension stores only a revocable `ext_sess_` token with scope `linkedin:ingest`.
- Pairing codes are single-use, hashed, expire after ten minutes, and create a 30-day installation session.
- Ingestion is tenant-scoped, PRO-gated, idempotent by LinkedIn job ID/URL, size-limited, and restricted to HTTPS LinkedIn job URLs.
- Research fetches block non-HTTP(S), credentials, localhost, private/link-local IPs and non-standard ports; redirects are rejected.
- Source pages are data, never instructions. Only limited excerpts and hashes are persisted.
- No automatic CV submission, messages, outreach, or contacts are performed.

## State and quota

Research states are `queued`, `running`, `completed`, `partial`, `failed`, and `quota_exceeded`. One quota reservation exists per user, UTC month, and offer. PRO users receive ten distinct offers per UTC month; technical retries reuse the run.

## Components

`extension_pairing_code`, `extension_installation`, `job_research_run`, `job_research_agent_run`, `job_research_source`, and `research_quota_period` are the persistence boundary. The `research_worker` service claims PostgreSQL jobs with a lease and processes five specialist roles plus a synthesizer.
