# AGENTS.md

## Project

Eliware maintains the NBFM receiver audio bridge to Zello channels.

## Scope and boundaries

Keep this repository focused on local NFM reception and private Zello channel feeds.

## Layout

Keep implementation in `src/`, launchers in `bin/`, tests in `tests/`, fixtures in
`test-fixtures/`, documentation in `docs/`, and specifications in `specs/`. Mirror each source
`.mjs` file with one same-path `.test.mjs` file under `tests/`.

## Development

Use Node.js 26 or later, npm, and native ESM.

## Validation

Run `npm test` for aggregate validation. Run `npm run lint`, `npm run audit`, `npm run format`, and
`npm run format:check` as focused checks.

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
