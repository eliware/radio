# AGENTS.md

## Project

Eliware maintains the NBFM receiver audio bridge to Zello channels.

## Scope and boundaries

Keep this repository focused on local NFM reception, private Zello feeds, and optional Broadcastify Classic outputs.

## Layout

Keep runtime modules in `src/` and launchers in `bin/`.
Keep tests in `tests/`, fixtures in `test-fixtures/`, docs in `docs/`, and specs in `specs/`.
Put maintained examples in `examples/`.
Mirror each source `.mjs` file with one same-path `.test.mjs` file in `tests/`.

## Development

Use Node.js 26 or later with npm and native ESM.
Run `npm ci` before local development.

## Validation

Run `npm run lint` to check code quality.
Run `npm run audit` to check dependencies.
Run `npm run format` to apply formatting.
Run `npm run format:check` to check formatting.

## Security

Keep account credentials and private keys out of tracked files.

## Changes

Keep README.md and docs/ current when runtime behavior changes.

## Application

Run focused tests first during development.
Run one test file with `npm test -- tests/path/to/example.test.mjs`.
Run multiple test files with `npm test -- tests/path/to/first.test.mjs tests/path/to/second.test.mjs`.
Prevent repeated full-suite runs during development.
Run the full `npm test` suite for final validation before a commit, milestone, or release.
