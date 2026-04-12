# Premium Cursor Operating System

This `.cursor` folder is designed as a high-level AI engineering control plane: concise standards, delivery discipline, and automation scaffolding.

## Structure

- `rules/`: layered behavior standards from core principles to domain-specific execution.
- `templates/`: reusable planning, debugging, and PR communication templates.
- `hooks/`: optional automation scaffolding to enforce quality gates.

## Rule Layers

- `00` Core principles
- `10` Planning and scoping
- `20` Implementation standards
- `30` Testing and verification
- `40` Security and secrets
- `50` Performance and observability
- `60` Git and PR discipline
- `70` Frontend and UI excellence
- `80` Backend and API contracts
- `90` Final response and communication

## Precedence Model

1. Follow global safety and correctness constraints first.
2. Apply lower-numbered rules before higher-numbered rules.
3. Use domain rules (`70`, `80`) only when files/contexts match.
4. If rules conflict, prioritize explicit user intent unless it violates safety.

## Legacy Compatibility

Existing CMS-specific rules are preserved as legacy-compatible files:

- `rules/cms-supabase-safety.mdc`
- `rules/cms-section-architecture.mdc`
- `rules/cms-schema-driven-editor.mdc`

Use them for project-specific CMS flows; use the new numbered ruleset as the default premium baseline.

## Operating Guidance

- Keep rules short, actionable, and non-overlapping.
- Prefer adding a focused new rule over bloating an existing one.
- Periodically prune stale standards and duplicate guidance.
- Treat hooks and templates as starter scaffolding; adapt to team workflow.
