---
name: self-healing
description: Automatically validate this project after code changes by running npm run lint, npm run build, and npm run typecheck in order, repairing failures, and repeating until all pass. Use after any code or configuration edit in JavaScript, TypeScript, React, Next.js, or related project files, and whenever the user asks for self-healing, automatic repair, or green lint/build/typecheck checks.
---

# Self Healing

## Required Validation Loop

After every code or configuration change, run the following commands from the project root in this exact order:

1. `npm run lint`
2. `npm run build`
3. `npm run typecheck`

If any command fails:

1. Read the full error output and identify the root cause.
2. Inspect the relevant files before editing.
3. Make the smallest project-consistent fix that preserves business behavior.
4. Rerun the complete validation sequence from the beginning: lint, build, typecheck.
5. Repeat until all three commands pass.

## Repair Rules

- Treat every failure as a repair target, not a reason to stop.
- Fix the underlying code, type, dependency, configuration, or lint issue instead of masking it.
- Do not remove or disable business features, routes, components, data flows, validations, integrations, or user-facing behavior to bypass an error.
- Do not weaken checks by removing scripts, relaxing TypeScript strictness, disabling lint rules, adding broad ignores, or replacing real code with placeholders unless the user explicitly requests that direction.
- Do not delete files or folders to resolve failures unless the user confirms the exact target first, and deletion is performed through the recycle bin when local instructions require it.
- Preserve unrelated user changes in the working tree.
- If a script is missing from `package.json`, report it clearly, validate the scripts that exist, and avoid inventing unrelated scripts unless the task requires adding them.
- If validation is blocked by missing credentials, unavailable external services, or environment-only failures, document the blocker and keep all runnable checks green.

## Reporting

In the final response, include:

- The validation commands that passed.
- The fixes made.
- Any command that could not be run and the exact reason.
