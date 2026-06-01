# WordSeek

<img width="1173" alt="WordSeek Banner" src="https://github.com/user-attachments/assets/bf444d36-2eea-4ad5-83e7-4a99acda2bfe" />

[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)

WordSeek is a Telegram word game bot inspired by Wordle. It supports private
games, group multiplayer rounds, daily global challenges, Telegram Forum topic
controls, leaderboards, moderation tools, and production deployment on Bun,
PostgreSQL, and Redis.

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

## Public Bots

- [WordSeek I](https://t.me/WordSeekBot) - Main instance
- [WordSeek II](https://t.me/WordSeek2Bot) - Backup instance

## Features

- Multiplayer word rounds in Telegram groups.
- Private chat daily challenge with one shared puzzle per day.
- 4-letter, 5-letter, and 6-letter game modes.
- Telegram Forum topic support, including topic-specific game settings.
- Global, group, and time-period leaderboards.
- PostgreSQL-backed durable state with Redis-backed cache and queues.
- Local dictionary data for daily word meanings, pronunciations, and examples
  when available.
- Admin authorization, global bans, captcha checks, broadcasts, and tracking.
- Docker, Heroku, Render, Railway, and direct VPS deployment support.

## Tech Stack

- Runtime: [Bun](https://bun.sh)
- Language: [TypeScript](https://www.typescriptlang.org/)
- Bot framework: [grammY](https://grammy.dev/)
- Database: [PostgreSQL](https://www.postgresql.org/) with
  [Kysely](https://kysely.dev/)
- Cache and queues: [Redis](https://redis.io/) with
  [BullMQ](https://docs.bullmq.io/)
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

### Gameplay Tips

- Start with words that cover common vowels and consonants.
- Avoid repeating letters already marked absent.
- In groups, review previous guesses before submitting your own.
- Use topic restrictions in busy Forum groups to keep game traffic organized.

## Commands

### Player Commands

| Command        | Description                                | Notes                                  |
| :------------- | :----------------------------------------- | :------------------------------------- |
| `/start`       | Initialize the bot.                        | Opens the main bot menu.               |
| `/help`        | Show the interactive help menu.            | Includes player and admin guidance.    |
| `/id`          | Show chat, user, and message identifiers.  | Useful for admin setup and debugging.  |
| `/new`         | Start a default 5-letter game.             | Also accepts `/new 4`, `/new 5`, etc.  |
| `/new4`        | Start a 4-letter game.                     | Available in private and group chats.  |
| `/new5`        | Start a 5-letter game.                     | Available in private and group chats.  |
| `/new6`        | Start a 6-letter game.                     | Available in private and group chats.  |
| `/daily`       | Start Daily WordSeek.                      | Private chat only.                     |
| `/pausedaily`  | Pause Daily WordSeek and return to normal. | Previous daily attempts still count.   |
| `/end`         | End the current game.                      | Admins can end directly; others vote.  |
| `/score`       | Show user statistics.                      | Supports optional user lookup.         |
| `/myscore`     | Legacy score command.                      | Redirects users to `/score`.           |
| `/leaderboard` | Show rankings.                             | Supports scope and period filters.     |
| `/startmatch`  | Reserved command hook for match workflows. | Currently no-op in the command module. |

### Group Admin Commands

These commands require Telegram group admin rights or authorization through the
bot.

| Command            | Description                              | Example                      |
| :----------------- | :--------------------------------------- | :--------------------------- |
| `/seekauth`        | Authorize trusted users for game admin.  | `/seekauth @username`        |
| `/seekauth list`   | List authorized users in the group.      | `/seekauth list`             |
| `/seekauth remove` | Remove an authorized user.               | `/seekauth remove @username` |
| `/setgametopic`    | Restrict games to the current topic.     | Run inside the target topic. |
| `/unsetgametopic`  | Remove the topic restriction.            | Run in the group or topic.   |
| `/allowonlylen`    | Restrict allowed word lengths by topic.  | `/allowonlylen 4 5`          |
| `/recreatetopic`   | Recreate expired or deleted game topics. | `/recreatetopic on` or `off` |

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
| `/transfer`         | Transfer stats between Telegram user IDs.   | `/transfer <old_id> <new_id>`  |
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
- Users authorized with `/seekauth` can perform selected game-management
  actions.
- Bot owners are configured through `ADMIN_USERS` and can use global commands
  such as bans, broadcasts, captcha, tracking, and transfers.

### Security Practices

- Keep `BOT_TOKEN`, database URLs, Redis credentials, and API keys out of Git.
- Keep `ADMIN_USERS` limited to trusted Telegram user IDs.
- Use a private Redis instance; do not expose Redis directly to the public
  internet.
- Use `DATABASE_SSL=true` for managed databases that require TLS.
- Keep `DATABASE_SSL_REJECT_UNAUTHORIZED=false` only when your provider does not
  support trusted CA verification.
- Configure `LOGS_CHANNEL` if you want operational alerts from tracking and
  moderation flows.

## Deployment

### Prerequisites

- Bun 1.3.x
- PostgreSQL
- Redis
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
bot, PostgreSQL, Redis, persistent volumes, health checks, and a one-shot
migration service.

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

### Railway

Railway uses `railway.toml` and Nixpacks.

1. Create a Railway project from the repository.
2. Add PostgreSQL and Redis services.
3. Set the required environment variables.
4. Deploy. Railway runs `bun run db:migrate` before the start command.

### Render

Render uses `render.yaml` for a web service and `render-worker.yaml` for a worker
deployment.

1. Connect the repository to Render.
2. Create PostgreSQL and Redis instances.
3. Set `WEB_SERVICE=true` only for web-service deployments that need a health
   endpoint.
4. Set the required environment variables.
5. Deploy. Render runs `bun run db:migrate` as the pre-deploy command.

### Heroku

Heroku uses `heroku.yml` for Docker-based deployment.

1. Create the Heroku app.
2. Add Heroku Postgres and Heroku Data for Redis or set external service URLs.
3. Set the required environment variables.
4. Deploy. Heroku runs `bun run db:migrate` as the release command.

### Direct VPS Without Docker

```bash
bun install --frozen-lockfile
bun run db:migrate
bun run start
```

For process supervision, run the bot under systemd, Supervisor, PM2, or your
preferred service manager. If using PM2:

```bash
pm2 start src/index.ts --interpreter bun --name wordseek
```

### Latency Guidance

For South Asia users, keep the bot, PostgreSQL, and Redis in the same region
whenever possible. Code-level caching helps, but it cannot remove network
round-trip latency between India, Europe, and the United States. The lowest
latency setup is usually:

- App server in India, Singapore, or another nearby South Asia/Southeast Asia
  region.
- PostgreSQL in the same region as the app.
- Redis in the same region as the app.
- Telegram Bot API root left as `https://api.telegram.org` unless you operate a
  local Bot API server close to the app.

## Configuration

| Variable                           | Required | Default                     | Description                                             |
| :--------------------------------- | :------- | :-------------------------- | :------------------------------------------------------ |
| `BOT_TOKEN`                        | Yes      | None                        | Telegram bot token from BotFather.                      |
| `DAILY_WORDLE_SECRET`              | Yes      | None                        | Secret used for daily challenge verification.           |
| `DATABASE_URL`                     | Yes      | None                        | PostgreSQL connection string.                           |
| `REDIS_URI`                        | Yes      | `redis://127.0.0.1:6379`    | Redis connection URI. Falls back to `REDIS_URL`.        |
| `ADMIN_USERS`                      | Yes      | Empty                       | Comma-separated Telegram user IDs with owner access.    |
| `NODE_ENV`                         | No       | `development`               | Use `production` in hosted environments.                |
| `WEB_SERVICE`                      | No       | `false`                     | Starts a small health-check HTTP server when `true`.    |
| `TIME_ZONE`                        | No       | `UTC`                       | Timezone for daily reset logic and scheduled jobs.      |
| `DAILY_WORDLE_START_DATE`          | No       | `2025-01-01`                | Start date for the daily word rotation.                 |
| `DATABASE_SSL`                     | No       | Auto                        | Overrides PostgreSQL SSL usage.                         |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | No       | `false`                     | Enables strict PostgreSQL TLS certificate verification. |
| `CUSTOM_API_ROOT`                  | No       | `https://api.telegram.org`  | Telegram Bot API endpoint.                              |
| `LOGS_CHANNEL`                     | No       | None                        | Telegram channel ID for selected operational logs.      |
| `UPDATES_CHANNEL`                  | No       | `https://t.me/WordSeek`     | Link shown in bot keyboards.                            |
| `DISCUSSION_GROUP`                 | No       | `https://t.me/WordGuesser`  | Link shown in bot keyboards.                            |
| `WORDSEEK_DATABASE_URL`            | Docker   | Internal Compose PostgreSQL | Compose-only override mapped to `DATABASE_URL`.         |
| `WORDSEEK_REDIS_URI`               | Docker   | Internal Compose Redis      | Compose-only override mapped to `REDIS_URI`.            |

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
migrations/      Kysely database migrations
.github/         CI workflows
```

### Scripts

| Command              | Purpose                            |
| :------------------- | :--------------------------------- |
| `bun run dev`        | Start the bot with Bun watch mode. |
| `bun run start`      | Start the bot normally.            |
| `bun run lint`       | Check formatting with Prettier.    |
| `bun run test`       | Run Bun tests.                     |
| `bun run typecheck`  | Run TypeScript type checking.      |
| `bun run build`      | Bundle the app to `dist/`.         |
| `bun run db:migrate` | Apply Kysely migrations.           |
| `bun run db:seed`    | Run configured Kysely seeds.       |
| `bun run db:codegen` | Regenerate Kysely database types.  |

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
4. Add or update tests for shared logic.
5. Run `bun run lint`, `bun run test`, `bun run typecheck`, and
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

### Redis Connection Errors

- Confirm Redis is running and reachable from the app.
- Check `REDIS_URI`.
- Do not expose Redis publicly on a VPS; keep it on a private network.

### Migration Failures

- Confirm the database exists.
- Confirm the configured database user can create and alter tables.
- Run migrations before starting the worker if you deploy without the provided
  cloud or Compose migration hooks.

### High Latency

- Keep the app, Redis, and PostgreSQL in the same region.
- Avoid running the app in Europe or the United States while Redis/PostgreSQL or
  users are in South Asia.
- Use the Docker/VPS path in a nearby region if your platform does not offer
  South Asia infrastructure.

## Community

- Updates: [WordSeek](https://t.me/WordSeek)
- Discussion: [WordGuesser](https://t.me/wordguesser)
- Issues: [GitHub Issues](https://github.com/bisug/TG-WordGame/issues)

## Credits

- Maintained fork: [bisug/TG-WordGame](https://github.com/bisug/TG-WordGame)
- Original project: [binamralamsal/WordSeek](https://github.com/binamralamsal/WordSeek)
- Creator support: [buymemomo.com/binamra](https://buymemomo.com/binamra)

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for
details.
