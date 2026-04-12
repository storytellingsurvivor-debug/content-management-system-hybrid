# Hooks Scaffolding

This folder contains optional automation scaffolding to operationalize the ruleset.

## Files

- `hooks.example.json`: sample hook mapping to local scripts.
- `scripts/run-lint.sh`: runs lint checks.
- `scripts/run-tests.sh`: runs test checks.
- `scripts/verify-commit-msg.sh`: enforces commit message quality.

## Usage

1. Copy `hooks.example.json` to your active hook config file if needed.
2. Adapt script commands to your stack (`npm`, `pnpm`, `yarn`, etc).
3. Keep scripts fast and deterministic to avoid noisy failures.

## Notes

- These are starter templates, not hard-wired project automation.
- Favor non-destructive checks in automated hooks.
