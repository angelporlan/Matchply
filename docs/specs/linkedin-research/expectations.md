# Expectations and invariants

1. A pairing code cannot be claimed twice or after expiry.
2. A revoked or expired extension session cannot ingest.
3. An extension session cannot list CVs, candidatures, or mutate Kanban state.
4. A duplicate capture cannot create a second `job_offer` or active research run.
5. Every run belongs to the authenticated `userId`; offer and research reads enforce the same tenant boundary.
6. A research run has at most one agent row per role and at most three persisted sources per role.
7. A people run with no visible recruiter/poster is `not_applicable`, not an infrastructure failure.
8. A synthesis with at least three useful specialists is `completed` or `partial`; otherwise the worker retries/marks `failed`.
9. Factual claims without evidence remain unknown rather than being invented.
10. The monthly counter never exceeds the configured PRO quota.
