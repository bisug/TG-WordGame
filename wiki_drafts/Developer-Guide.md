# Developer Guide

Information for contributing to WordSeek or understanding its internal architecture.

## Project Structure
- `src/commands/`: Individual command logic.
- `src/handlers/`: Event handlers (messages, callbacks, errors).
- `src/config/`: Database, environment, and redis configuration.
- `src/util/`: Helper functions and utilities.
- `migrations/`: SQL migration files managed by Kysely.

## Database & Models
We use **Kysely** for type-safe SQL queries.
- **Generating Types**: If you modify the database schema, run:
  ```bash
  bun run db:codegen
  ```
  This updates `src/database-schemas.ts` based on your live database.

## Migrations
- **Create a new migration**: Add a new file in the `migrations/` folder.
- **Run migrations**: `bun run db:migrate`

## Concurrency & Jobs
We use **BullMQ** for background tasks (expiring games, daily resets, captcha timeouts).
- Ensure Redis is running for BullMQ.
- Workers are initialized in `src/index.ts`.

## Testing
- Test new commands in a private development bot before submitting a PR.
- Use `bun run dev` for hot reloading.

---
*Questions? Open an [Issue](https://github.com/bisug/TG-WordGame/issues) on GitHub.*
