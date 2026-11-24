# WordSeek

<img width="1173" alt="WordSeek Banner" src="src/data/banner.png" />

WordSeek is a Telegram word game bot inspired by Wordle. It supports private
games, group multiplayer rounds, daily global challenges, Telegram Forum topic
controls, leaderboards, moderation tools, and production deployment on Bun,
PostgreSQL, and a Redis-protocol cache such as Valkey or Redis.

This repository is a maintained fork of
[binamralamsal/WordSeek](https://github.com/binamralamsal/WordSeek).

## Contents

- [Features](#features)
- [Gameplay](#gameplay)
- [Commands](#commands)
- [Administration](#administration)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Credits](#credits)

## Features

- Multiplayer word rounds in Telegram groups.
- Private chat daily challenge with one shared puzzle per day.
- 4-letter, 5-letter, and 6-letter game modes.
- Telegram Forum topic support, including topic-specific game settings.
- Global, group, and time-period leaderboards.
- PostgreSQL-backed durable state with Valkey/Redis-backed cache and queues.
- Local dictionary data for daily word meanings, pronunciations, and examples
  when available.
- Admin authorization, global bans, captcha checks, broadcasts, and tracking.
- Docker, Heroku, Render, Railway, and direct VPS deployment support.

## Tech Stack

- Runtime: [Bun](https://bun.sh) (v1.4.5+)
- Language: [TypeScript 7](https://www.typescriptlang.org/)
- Tooling: [Bun](https://bun.sh/) (Formatting & Type Checking) and [Oxlint](https://oxc.rs/) (Linting)
- Bot framework: [grammY](https://grammy.dev/)
- Rich messages: Telegram Bot API 10.5 (button rows, compact tables, expandable quotations). Custom `CUSTOM_API_ROOT` values fall back to classic HTML
- Database: [PostgreSQL](https://www.postgresql.org/) with [Kysely](https://kysely.dev/)
- Cache and queues: [Valkey](https://valkey.io/) / [Redis](https://redis.io/) with [BullMQ](https://docs.bullmq.io/)
- Validation: [Zod](https://zod.dev/)

## Gameplay

### Basic Rules

1. Start a game with `/new`, `/new4`, `/new5`, or `/new6`.
2. Send a word guess directly in the chat.
3. Use the colored feedback to narrow down the answer:
   - Green means the letter is correct and in the correct position.
   - Yellow means the letter is present but in the wrong position.
   - Red or gray means the letter is not in the answer.
4. A normal game ends when someone solves the word or the attempt limit is
   reached.
5. Daily WordSeek has a 6-attempt limit and is available in private chat only.

### Game Modes

| Mode               | Command examples        | Description                                                  |
| :----------------- | :---------------------- | :----------------------------------------------------------- |
| Normal 5-letter    | `/new`, `/new5`         | Default WordSeek mode for private chats and groups.          |
| Short 4-letter     | `/new4`, `/new 4`       | Faster rounds with shorter words.                            |
| Long 6-letter      | `/new6`, `/new 6`       | Harder rounds with longer words.                             |
| Daily WordSeek     | `/daily`, `/pausedaily` | One globally shared private-chat puzzle per day.             |
| Group multiplayer  | `/new` in a group       | First correct guess wins; everyone can participate.          |
| Forum topic rounds | `/setgametopic`         | Restrict games to a selected Telegram Forum topic if needed. |

### Scoring

- `/score` shows personal statistics and supports lookup arguments.
- `/leaderboard` shows rankings by scope and period.
- Supported leaderboard scopes include group and global views.
- Supported periods include today, week, month, year, and all time.
- Daily mode tracks streaks independently from regular group rounds.
- Daily word details are loaded from the bundled local dictionary. No AI or
  external dictionary API is required at runtime.

## Commands

### Player Commands

| Command        | Description                                | Notes                                                                          |
| :------------- | :----------------------------------------- | :----------------------------------------------------------------------------- |
| `/start`       | Initialize the bot.                        | Opens the main bot menu.                                                       |
| `/help`        | Show the interactive help menu.            | Includes player and admin guidance.                                            |
| `/id`          | Show chat, user, and message identifiers.  | Useful for admin setup and debugging.                                          |
| `/new`         | Start a default 5-letter game.             | Also accepts `/new 4`, `/new 5`, etc.                                          |
| `/new4`        | Start a 4-letter game.                     | Available in private and group chats.                                          |
| `/new5`        | Start a 5-letter game.                     | Available in private and group chats.                                          |
| `/new6`        | Start a 6-letter game.                     | Available in private and group chats.                                          |
| `/daily`       | Start Daily WordSeek.                      | Private chat only.                                                             |
| `/pausedaily`  | Pause Daily WordSeek and return to normal. | Previous daily attempts still count.                                           |
| `/end`         | End the current game.                      | Admins, the game starter, and users in private chat end directly; others vote. |
| `/score`       | Show user statistics.                      | Supports optional user lookup.                                                 |
| `/myscore`     | Legacy score command.                      | Redirects users to `/score`.                                                   |
| `/leaderboard` | Show rankings.                             | Supports scope and period filters.                                             |
| `/startmatch`  | Redirect-only command hook.                | Points users to `/new`, `/new5`, or `/daily`.                                  |

### Group Admin Commands

These commands require Telegram group admin rights or authorization through the
bot.

| Command            | Description                                  | Example                      |
| :----------------- | :------------------------------------------- | :--------------------------- |
| `/seekauth`        | Authorize users to end games without voting. | `/seekauth @username`        |
| `/seekauth list`   | List authorized users in the group.          | `/seekauth list`             |
| `/seekauth remove` | Remove an authorized user.                   | `/seekauth remove @username` |
| `/setgametopic`    | Restrict games to the current topic.         | Run inside the target topic. |
| `/unsetgametopic`  | Remove the topic restriction.                | Run in the group or topic.   |
| `/allowonlylen`    | Restrict allowed word lengths by topic.      | `/allowonlylen 4 5`          |
| `/recreatetopic`   | Recreate expired or deleted game topics.     | `/recreatetopic on` or `off` |

### Bot Owner Commands

These commands are restricted to Telegram user IDs listed in `ADMIN_USERS`.

| Command             | Description                                 | Example                        |
| :------------------ | :------------------------------------------ | :----------------------------- |
| `/stats`            | Show bot and system statistics.             | `/stats`                       |
| `/ban`              | Globally ban a user.                        | `/ban 123456789`               |
| `/unban`            | Remove a global ban.                        | `/unban 123456789`             |
| `/broadcast`        | Broadcast a replied message to known chats. | Reply to a message.            |
| `/broadcast_status` | Show current broadcast progress.            | `/broadcast_status`            |
| `/broadcast_cancel` | Cancel an active broadcast.                 | `/broadcast_cancel`            |
| `/captcha`          | Force a captcha challenge for a user.       | `/captcha <chat_id> <user_id>` |
| `/transfer`         | Move leaderboard rows to another user ID.   | `/transfer <old_id> <new_id>`  |
| `/track`            | Track messages in a chat for diagnostics.   | `/track <chat_id>`             |
| `/untrack`          | Stop tracking a chat.                       | `/untrack <chat_id>`           |
| `/tracklist`        | List tracked chats.                         | `/tracklist`                   |

## Administration

### Telegram Setup

1. Create a bot through [@BotFather](https://t.me/BotFather).
2. Add the bot to your group.
3. Promote it to administrator if you need message management, forum topic
   management, captcha, or moderation features.
4. In Forum groups, run `/setgametopic` inside the topic where games should be
   allowed.
5. Use `/allowonlylen` to tune the available word lengths per topic.

### Authorization Model

- Group admins can manage games in their own groups.
- Users authorized with `/seekauth` can end games without voting.
- Bot owners are configured through `ADMIN_USERS` and can use global commands
  such as bans, broadcasts, captcha, tracking, and transfers.

### Security Practices

- Keep `BOT_TOKEN`, database URLs, Valkey/Redis credentials, and API keys out
  of Git.
- Keep `ADMIN_USERS` limited to trusted Telegram user IDs.
- Use a private Valkey/Redis instance; do not expose it directly to the public
  internet.
- Use `DATABASE_SSL=true` for managed databases that require TLS.
- Keep `DATABASE_SSL_REJECT_UNAUTHORIZED=false` only when your provider does not
  support trusted CA verification.
- Configure `LOGS_CHANNEL` if you want operational alerts from tracking and
  moderation flows.

## Deployment

### Prerequisites

- Bun 1.4.5+
- PostgreSQL
- Valkey or Redis
- A Telegram bot token
- A configured `.env` file

### Local Development

```bash
git clone https://github.com/bisug/TG-WordGame
cd TG-WordGame
bun install
cp .env.example .env
bun run db:migrate
bun run dev
```

Use `bun run start` instead of `bun run dev` when you do not need hot reload.

### Docker / VPS

The Compose setup is intended for self-hosted VPS deployments. It includes the
bot, PostgreSQL, a Valkey/Redis-compatible cache, persistent volumes, health
checks, and a one-shot migration service.

Default Docker images are pinned to stable releases. Keep the pins here in
sync with `docker-compose.yml`, `.env.docker.example`, and
`.github/workflows/ci.yml`:

- PostgreSQL `18.7` via `postgres:18.7-alpine3.24`.
- Valkey `9.2.0` via `valkey/valkey:9.2.0-alpine3.24`.
- Redis Open Source `8.8.4` is also supported by setting
  `CACHE_IMAGE=redis:8.8.4-alpine3.23`.

```bash
cp .env.docker.example .env
# Edit BOT_TOKEN, DAILY_WORDLE_SECRET, ADMIN_USERS, and POSTGRES_PASSWORD.
docker compose up -d --build
docker compose logs -f wordseek-bot
```

For Docker deployments using managed PostgreSQL or Redis, set
`WORDSEEK_DATABASE_URL` or `WORDSEEK_REDIS_URI` in `.env`. Keep
`DATABASE_SSL=false` for the bundled Compose PostgreSQL service. Set
`DATABASE_SSL=true` for managed databases that require TLS.

PostgreSQL 18 uses the official image's versioned data directory
`/var/lib/postgresql/18/docker` and mounts the parent directory
`/var/lib/postgresql`. If you already have a Compose volume from PostgreSQL 16
or 17, do not switch the image directly on production data. Take a `pg_dump`
backup, start a fresh PostgreSQL 18 volume, run migrations, and restore the
backup.

### Railway

`railway.toml` selects the Railpack builder, watches `src/`, `package.json`, and
`bun.lock`, and runs `bun run db:migrate` before each deploy.

### Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/bisug/TG-WordGame)

`render.yaml` deploys the bot as a Background Worker.

1. Connect the repository to Render.
2. Create PostgreSQL and Redis instances.
3. Set the required environment variables.
4. Deploy. Render runs `bun run db:migrate` as the pre-deploy command.

### Heroku

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://www.heroku.com/deploy?template=https://github.com/bisug/TG-WordGame)

Heroku deploys this app on the `heroku-26` stack with the classic
[`heroku-buildpack-bun`](https://github.com/bisug/heroku-buildpack-bun)
buildpack. `app.json` sets both for apps created from the manifest. For an
existing app, set them once:

```bash
heroku stack:set heroku-26
heroku buildpacks:clear
heroku buildpacks:add https://github.com/bisug/heroku-buildpack-bun
```

The buildpack reads `.bun-version`, installs from `bun.lock`, and takes process
types from `Procfile`. The `release` process runs `bun run db:migrate` on every
deploy. `.slugignore` keeps tests, docs, and other platforms' config out of the
slug.

1. Create the Heroku app from `app.json`, or set the stack and buildpack above.
2. Add Heroku Postgres and Heroku Data for Redis or set external service URLs.
3. Set `BOT_TOKEN`, `ADMIN_USERS`, `DATABASE_URL`, and `REDIS_URI`.
4. Push with `git push heroku main`, then run `heroku ps:scale worker=1`.

### Direct VPS Without Docker

```bash
bun install --frozen-lockfile
bun run db:migrate
bun run start
```

Run the bot under a process supervisor so it restarts after a failure.

## Configuration

| Variable                           | Required | Default                          | Description                                                                                                                              |
| :--------------------------------- | :------- | :------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `BOT_TOKEN`                        | Yes      | None                             | Telegram bot token from BotFather.                                                                                                       |
| `DATABASE_URL`                     | Yes      | None                             | PostgreSQL connection string.                                                                                                            |
| `REDIS_URI`                        | No       | `redis://127.0.0.1:6379`         | Valkey/Redis URI. Falls back to `REDIS_URL`.                                                                                             |
| `ADMIN_USERS`                      | No       | Empty                            | Comma-separated Telegram user IDs with owner access.                                                                                     |
| `NODE_ENV`                         | No       | `development`                    | One of `development`, `test`, `production`. Use `production` in hosted environments.                                                     |
| `WEB_SERVICE`                      | No       | `false`                          | Starts a `/healthz` and `/metrics` HTTP server when `true`. Set `true` for Docker Compose healthchecks.                                  |
| `BAN_APPEAL_URL`                   | No       | `https://t.me/WordGuesser`       | Full URL shown to banned users for appeals.                                                                                              |
| `PORT`                             | No       | `3000`                           | Port for the `/healthz` and `/metrics` server.                                                                                           |
| `LOG_LEVEL`                        | No       | `info`                           | Pino level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`.                                                                          |
| `TIME_ZONE`                        | No       | `UTC`                            | Timezone for daily reset logic and scheduled jobs.                                                                                       |
| `DAILY_WORDLE_START_DATE`          | No       | `2025-01-01`                     | Start date for the daily word rotation.                                                                                                  |
| `DAILY_WORDLE_SECRET`              | No       | Empty                            | Per-instance salt for the daily word rotation. Set a unique random value so future words can't be precomputed from the public word list. |
| `DATABASE_SSL`                     | No       | Auto                             | Overrides PostgreSQL SSL usage.                                                                                                          |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | No       | `false`                          | Enables strict PostgreSQL TLS certificate verification.                                                                                  |
| `CUSTOM_API_ROOT`                  | No       | `https://api.telegram.org`       | Telegram Bot API endpoint.                                                                                                               |
| `LOGS_CHANNEL`                     | No       | None                             | Telegram channel ID for selected operational logs.                                                                                       |
| `UPDATES_CHANNEL`                  | No       | `https://t.me/WordSeek`          | Link shown in bot keyboards.                                                                                                             |
| `DISCUSSION_GROUP`                 | No       | `https://t.me/WordGuesser`       | Link shown in bot keyboards.                                                                                                             |
| `POSTGRES_IMAGE`                   | Docker   | `postgres:18.7-alpine3.24`       | Compose PostgreSQL image.                                                                                                                |
| `POSTGRES_DB`                      | Docker   | `wordseek`                       | Compose PostgreSQL database name.                                                                                                        |
| `POSTGRES_USER`                    | Docker   | `wordseek`                       | Compose PostgreSQL user.                                                                                                                 |
| `POSTGRES_PASSWORD`                | Docker   | `wordseek_change_me`             | Compose PostgreSQL password. Set a real value in `.env`.                                                                                 |
| `POSTGRES_PGDATA`                  | Docker   | `/var/lib/postgresql/18/docker`  | Compose PostgreSQL data directory.                                                                                                       |
| `CACHE_IMAGE`                      | Docker   | `valkey/valkey:9.2.0-alpine3.24` | Compose cache image; Redis `8.8.4` is supported.                                                                                         |
| `WORDSEEK_DATABASE_URL`            | Docker   | Internal Compose PostgreSQL      | Compose-only override mapped to `DATABASE_URL`.                                                                                          |
| `WORDSEEK_REDIS_URI`               | Docker   | Internal Compose Valkey          | Compose-only override mapped to `REDIS_URI`.                                                                                             |

## Development

### Project Structure

```text
src/
  commands/      Telegram command handlers
  config/        Environment, bot, database, and logger configuration
  handlers/      Message, callback query, sync, tracking, and moderation handlers
  queues/        BullMQ-backed background work
  services/      Daily WordSeek and domain services
  util/          Shared helpers, caches, keyboards, and formatters
  data/          Word lists, daily word data, and banner
  fonts/         Font used for generated word images
migrations/      Kysely database migrations
.github/         CI workflows and Dependabot config
```

### Scripts

| Command              | Purpose                                            |
| :------------------- | :------------------------------------------------- |
| `bun run dev`        | Start the bot with Bun watch mode.                 |
| `bun run start`      | Start the bot normally.                            |
| `bun run lint`       | Check linting with Oxlint and formatting with Bun. |
| `bun run test`       | Run Bun tests.                                     |
| `bun run typecheck`  | Run TypeScript type checking.                      |
| `bun run build`      | Bundle the app to `dist/`.                         |
| `bun run db:migrate` | Apply Kysely migrations.                           |
| `bun run db:codegen` | Regenerate Kysely database types.                  |

### Testing

`bun run test` runs the unit suite. The Postgres/Redis-backed tests in
`src/util/db-integration.test.ts` are skipped unless `INTEGRATION_DB` is set
to any non-empty value, so a plain `bun test` never needs a database. Run them
locally against the Compose services. The database ports are not published, so
run the suite inside the container:

```bash
docker compose build
docker compose up -d postgres redis
docker compose run --rm wordseek-migrate
docker compose run --rm -e INTEGRATION_DB=1 wordseek-migrate bun test
```

CI (`.github/workflows/ci.yml`) runs two jobs: `build` (lint, format check,
typecheck, tests, bundle, Docker image build) and `integration` (Postgres +
Valkey services on the same pinned images as `docker-compose.yml`, migrations,
DB integration tests).

Workflow actions are pinned to full commit SHAs with a trailing `# vX.Y.Z`
version comment. Dependabot watches the `github-actions` ecosystem and raises
PRs that bump the SHA and the comment together, so upgrades arrive as reviewable
diffs rather than silently via a moved tag.

CI installs the Bun toolchain from the repository's `.bun-version` file. Bump
all four pins together: `package.json` `packageManager`, `package.json`
`engines.bun`, `.bun-version`, and both `FROM oven/bun` lines in `Dockerfile`.
`src/toolchain-pins.test.ts` fails if any of them drift.

### Database Migrations

Migrations live in `migrations/` and are executed with:

```bash
bun run db:migrate
```

When adding schema changes, add a new migration and update generated database
types with:

```bash
bun run db:codegen
```

### Adding a Command

1. Create a new command module in `src/commands/`.
2. Implement the handler with `Composer`.
3. Register it in `src/commands/index.ts`.
4. Add it to the Bot API command menu via `CommandsHelper.addNewCommand` in the
   module.
5. Add or update tests for shared logic.
6. Run `bun run lint`, `bun run test`, `bun run typecheck`, and
   `bun run build`.

## Troubleshooting

### Bot Does Not Respond

- Confirm `BOT_TOKEN` is valid.
- Make sure the bot is not blocked by privacy mode for the group behavior you
  expect.
- Promote the bot to group admin if it needs moderation or Forum topic
  permissions.
- Check application logs for Telegram API errors.

### Database Connection Errors

- Confirm PostgreSQL is running and reachable from the app.
- Check `DATABASE_URL`.
- For Docker Compose, keep `DATABASE_SSL=false` with the bundled Postgres
  service.
- For managed Postgres, set `DATABASE_SSL=true` if the provider requires TLS.

### Valkey / Redis Connection Errors

- Confirm Valkey or Redis is running and reachable from the app.
- Check `REDIS_URI`.
- Do not expose Valkey or Redis publicly on a VPS; keep it on a private
  network.

### Migration Failures

- Confirm the database exists.
- Confirm the configured database user can create and alter tables.
- Run migrations before starting the worker if you deploy without the provided
  cloud or Compose migration hooks.

## Community

- Updates: [WordSeek](https://t.me/WordSeek)
- Discussion: [WordGuesser](https://t.me/WordGuesser)
- Issues: [GitHub Issues](https://github.com/bisug/TG-WordGame/issues)

## Credits

- Maintained fork: [bisug/TG-WordGame](https://github.com/bisug/TG-WordGame)
- Original project: [binamralamsal/WordSeek](https://github.com/binamralamsal/WordSeek)
- Creator support: [buymemomo.com/binamra](https://buymemomo.com/binamra)

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for
details.
