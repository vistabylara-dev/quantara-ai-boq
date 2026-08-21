# QUANTARA AI UI LOCK

Preserve the current dashboard, app shell, navigation, BOQ workspace, verification page, and working Light/Dark/System theme system.

Do not redesign.
Do not replace data-theme.
Do not add a second theme system.
Do not introduce gradients, neon effects, oversized cards, or generic SaaS templates.
Do not change working layouts during backend work.

For every UI change:
- test Light
- test Dark
- test System
- test desktop
- test tablet
- test mobile
- run lint
- run build
- report affected routes

Backend work may change data, loading, permissions, status, and actions, but must not change the established visual design without explicit approval.

See [UI-GOVERNANCE-MASTER-INSTRUCTION.md](UI-GOVERNANCE-MASTER-INSTRUCTION.md) for the full permanent visual constitution.
