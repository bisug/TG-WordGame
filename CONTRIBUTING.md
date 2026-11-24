# Contributing to WordSeek

## Setup

Fork the repository and clone your fork. Then:

```bash
bun install
cp .env.example .env
bun run db:migrate
```

Set `BOT_TOKEN` and `DATABASE_URL` in `.env` before running `bun run dev`.

## Changes

- Put command handlers in `src/commands/` and register them in
  `src/commands/index.ts`.
- Add tests for shared logic under `src/`.
- Run the checks CI runs:

```bash
bun lint
bun check
bun test
bun run build
```

CI also checks formatting with `bun fmt --check`. The database-backed tests in
`src/util/db-integration.test.ts` need Postgres, Valkey, and `INTEGRATION_DB`;
see the Testing section of README.md.

## Pull requests

Use a descriptive branch name and Conventional Commit messages, matching the
repository history (`fix:`, `feat:`, `chore:`, `ci:`). Push to your fork and open
a pull request against `main`. Describe the change and the checks you ran.
