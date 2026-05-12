# WordSeek
<img width="1173" alt="Group 40 5" src="https://github.com/user-attachments/assets/bf444d36-2eea-4ad5-83e7-4a99acda2bfe" />

> [!NOTE]
> This project is a fork of the original [WordSeek](https://github.com/binamralamsal/WordSeek) by [Binamra Lamsal](https://github.com/binamralamsal).


## Tech Stack

<p align="left">
  <a href="https://bun.sh"><img src="https://skillicons.dev/icons?i=bun" height="40" alt="bun logo"  /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://skillicons.dev/icons?i=ts" height="40" alt="typescript logo"  /></a>
  <a href="https://grammy.dev/"><img src="https://raw.githubusercontent.com/grammyjs/website/main/logos/grammY.png" height="40" alt="grammy logo"  /></a>
  <a href="https://www.postgresql.org/"><img src="https://skillicons.dev/icons?i=postgres" height="40" alt="postgresql logo"  /></a>
  <a href="https://redis.io/"><img src="https://skillicons.dev/icons?i=redis" height="40" alt="redis logo"  /></a>
  <a href="https://zod.dev/"><img src="https://skillicons.dev/icons?i=zod" height="40" alt="zod logo"  /></a>
</p>

- **[grammY](https://grammy.dev/)** - Telegram Bot Framework
- **[Kysely](https://kysely.dev/)** - Type-safe SQL query builder
- **[PostgreSQL](https://www.postgresql.org/)** - Relational database
- **[Redis](https://redis.io/)** & **[BullMQ](https://docs.bullmq.io/)** - Caching and job queues
- **[Bun.js](https://bun.sh/)** - JavaScript runtime & package manager
- **[Zod](https://zod.dev/)** - Schema validation and type safety

## Features
- Play the Wordle-inspired word guessing game in private chats or group chats.
- Multiple word length modes (4, 5, or 6-letter words).
- Play the **Daily WordSeek** mode in private chats.
- Supports multiplayer gameplay in groups, with advanced admin tools for game management.
- Set up dedicated forum topics for games using Game Topic settings.
- Keep track of scores with group and global leaderboards.
- Commands to view personal scores and leaderboard rankings filtered by time (today, week, month, etc.).
- Flexible game settings: customizable limits for attempts and group admin permissions.

## How to Play
1. **Start a game**: Use the `/new` command in a group or private chat.
2. **Guess the word**: Players try to guess a random hidden word.
3. **Hints after each guess**:
   - 🟩 - Correct letter in the right spot.
   - 🟨 - Correct letter in the wrong spot.
   - 🟥 - Letter not in the word.
4. The game ends when:
   - The word is correctly guessed, or
   - Maximum number of guesses (30) is reached.
5. The first person to guess the word correctly wins!

## Commands

### Basic Commands
- **/new** - Start a new game (default 5 letters).
- **/new4** - Start a 4-letter game.
- **/new5** - Start a 5-letter game.
- **/new6** - Start a 6-letter game.
- **/end** - End the current game (voting or admin only).
- **/help** - Show the help menu.
- **/daily** - Play Daily WordSeek (private chat only).
- **/pausedaily** - Pause Daily mode and go back to normal games.

### Leaderboard & Scores
- **/leaderboard** - View leaderboards. Syntax: `/leaderboard [scope] [period] [length]`
  Example: `/leaderboard global week 6`
- **/score** - View your score or someone else's. Syntax: `/score [target] [scope] [period] [length]`
  Example: `/score @username global all 4`

### Group Settings (Admin Only)
- **/seekauth** - Manage users who can end games without a vote.
- **/setgametopic** - Restrict games to specific topics (in forum groups).
- **/unsetgametopic** - Remove topic restriction.
- **/allowonlylen** - Restrict allowed word lengths in a topic (e.g., `/allowonlylen 5 6`).
- **/recreatetopic** - Auto-recreate topic when it expires.

### Bot Admin Commands (Owner Only)
- **/ban** & **/unban** - Manage user bans globally.
- **/stats** - View bot usage statistics.
- **/transfer** - Transfer scores between users.
- **/broadcast** - Broadcast a message to all chats.
- **/track**, **/untrack**, **/tracklist** - Manage tracking for chats (to detect cheaters).

## Deployment

### Deploy to VPS (Recommended)

Deploying to a VPS provides the best performance and reliability.

#### Method 1: Using PM2 (Fastest for Bun)
1. **Install Bun**:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   source ~/.bashrc
   ```
2. **Setup the project**:
   ```bash
   git clone https://github.com/bisug/TG-WordGame
   cd TG-WordGame
   bun install
   cp .env.example .env && nano .env # Edit your .env file
   bun run db:migrate
   ```
3. **Start the bot with PM2**:
   ```bash
   npm install -g pm2
   pm2 start src/index.ts --name wordseek --interpreter bun
   ```

#### Method 2: Using Docker Compose (Standard)
1. **Build and Start**:
   ```bash
   docker compose up -d --build
   ```
2. **View Logs**:
   ```bash
   docker compose logs -f
   ```

### Deploy to Heroku

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/bisug/TG-WordGame)
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https://github.com/bisug/TG-WordGame)

If you prefer to deploy manually using the Heroku CLI:

1. Clone this repository and navigate to the directory:
   ```bash
   git clone https://github.com/bisug/TG-WordGame
   cd TG-WordGame
   ```
2. Login to Heroku and create a new container-based app:
   ```bash
   heroku login
   heroku create your-app-name --manifest
   ```
3. Provision the required PostgreSQL and Redis add-ons:
   ```bash
   heroku addons:create heroku-postgresql:mini
   heroku addons:create heroku-redis:mini
   ```
4. Set the necessary environment variables:
   ```bash
   heroku config:set BOT_TOKEN=your_bot_token
   heroku config:set DAILY_WORDLE_SECRET=your_random_secret_string
   heroku config:set NODE_ENV=production
   heroku config:set UPDATES_CHANNEL=https://t.me/YourChannel
   heroku config:set DISCUSSION_GROUP=https://t.me/YourGroup
   # Ensure REDIS_URI matches the provided REDIS_URL from the add-on
   heroku config:set REDIS_URI=$(heroku config:get REDIS_URL)
   ```
5. Deploy the application:
   ```bash
   git push heroku main
   ```
6. Scale the worker dyno to start the bot:
   ```bash
   heroku ps:scale worker=1
   ```


2.  **Stay Awake**: Render's free web services sleep after 15 minutes of inactivity. Since this is a Telegram bot (long-polling), you **MUST** use an external service like [cron-job.org](https://cron-job.org/) to ping your bot's URL every 10–14 minutes to keep it from sleeping.

**Monthly Free Usage Limits:**
- **Instance Hours**: 750 hours (shared across all free services).
- **Outbound Bandwidth**: 100 GB.
- **Build Pipeline**: 500 minutes.
- **Databases**: Free Postgres expires after 30 days.

---

### Deploy to Railway (Recommended - May 2026)

Railway is the best modern alternative for bots. **New in May 2026:** You can now manage your deployments and view logs on the go using the **Railway iOS App**.

1. **Create a Project**: Click the **Deploy on Railway** button above or go to [Railway.com](https://railway.com).
2. **Add Services**:
   - Add a **PostgreSQL** database.
   - Add a **Redis** database.
3. **Set Environment Variables**:
   - `BOT_TOKEN`: Your bot token.
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
   - `REDIS_URI`: `${{Redis.REDIS_URL}}`
   - `DAILY_WORDLE_SECRET`: A random secret.
   - `ADMIN_USERS`: Your Telegram ID.
4. **Deploy**: Railway detects the `railway.toml` and starts the bot.
5. **Template Updates**: If you publish this as a template, your users will now get **automatic update notifications** when you push to GitHub!

---

### Deployment Options on Render

| Web Service (Free Tier) | Background Worker (Paid/Always Online) |
| :--- | :--- |
| [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/bisug/TG-WordGame) | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/bisug/TG-WordGame&blueprint=render-worker.yaml) |
| *Best for testing. Sleeps after 15m idle.* | *Best for production. Never sleeps.* |

### Deploy using Docker

1. **Build the Docker image**:
   ```bash
   docker build -t wordseek-bot .
   ```

2. **Run the container**:
   Ensure you have PostgreSQL and Redis running, then run the container with your environment variables:
   ```bash
   docker run -d \
     --name wordseek \
     -e BOT_TOKEN=your_bot_token \
     -e DATABASE_URL=postgresql://user:pass@host:5432/db \
     -e REDIS_URI=redis://host:6379 \
     -e DAILY_WORDLE_SECRET=your_secret \
     -e ADMIN_USERS=your_id \
     wordseek-bot
   ```


### Deployment Comparison

| Feature | VPS (Self-Hosted) | Railway (Trial/Paid) | Heroku (Eco) | Render (Free) |
| :--- | :--- | :--- | :--- | :--- |
| **Cost** | Fixed ($4–$6/mo) | Usage-based | ~$5/mo + Add-ons | **Free** |
| **Availability** | 🟢 **Always Online** | 🟢 **Always Online** | 🟢 Always Online | 🔴 **Sleeps after 15m** |
| **Setup** | Moderate (Manual) | 🟢 Very Easy | Easy (Git push) | Easy (Auto-deploy) |
| **Maintenance** | Manual (OS Updates) | Fully Managed | Fully Managed | Fully Managed |
| **Mobile App** | 🔴 No (SSH Only) | 🟢 **Yes (iOS/TUI)** | 🔴 No | 🔴 No |
| **Performance** | 🟢 High (Dedicated) | 🟢 High | 🟡 Shared Resources | 🔴 Very Limited |
| **Updates** | Manual | 🟢 **Auto-Notified** | Easy | Easy |

> [!WARNING]
> **Performance Note:** While Heroku and Render are easier to set up, they are generally **slower than a VPS**. PaaS providers use shared resources and container virtualization which can introduce slight latency. For the absolute fastest response times and lowest latency, a **VPS** is always the superior choice.

> [!TIP]
> **Recommendation:** For a production-ready Telegram bot, we **highly recommend using a VPS**. It provides the most reliable performance, ensures the bot never "sleeps," and gives you full control over your database and security. Heroku is a great second choice for ease of use, while Render Free is best only for testing.

## Installation & Setup

### Requirements
- **Bun.js Runtime** (v1.1+) or Node.js
- **Telegram Bot Token** (from [BotFather](https://t.me/BotFather))
- **PostgreSQL** (Relational database)
- **Redis/Valkey** (Sessions, caching, and BullMQ)

### System Specifications

| Resource | Minimum | Recommended |
| :--- | :--- | :--- |
| **CPU** | 0.1 vCPU | 1.0 vCPU+ |
| **RAM** | 256 MB | 1 GB |
| **Storage** | 500 MB | 2 GB+ |
| **Network** | 10 Mbps | 100 Mbps+ |

> [!NOTE]
> The bot is highly optimized thanks to **Bun**. It can run comfortably on Render's free tier (512MB RAM) or a $4/mo VPS. Higher specs are only recommended if you expect thousands of concurrent players.

### Database & Redis Configuration

You can use either a locally hosted instance or a cloud provider like [Aiven](https://console.aiven.io/).

#### 1. Local Setup
If you have PostgreSQL and Redis installed locally, use the following connection strings in your `.env`:
- **PostgreSQL**: `postgresql://<user>:<password>@localhost:5432/<database_name>`
- **Redis**: `redis://localhost:6379`

**Pros & Cons of Local Setup:**
- ✅ **Pros**:
  - Maximum performance (lowest latency).
  - Total control over data and privacy.
  - No external service dependency.
- ❌ **Cons**:
  - Requires manual installation and configuration.
  - You are responsible for manual backups and maintenance.
  - Consumes local system resources.

#### 2. Cloud Setup (Aiven)
For a free or managed cloud solution, we recommend [Aiven Cloud](https://console.aiven.io/):
1. **PostgreSQL**: Create a PostgreSQL service and copy the **Service URI**.
2. **Valkey (Redis)**: Create a Valkey service (Aiven's open-source alternative to Redis) and copy the **Service URI**.
3. Paste these URIs into your `.env` file as `DATABASE_URL` and `REDIS_URI`.

**Pros & Cons of Aiven Free Tier:**
- ✅ **Pros**:
  - No credit card required to start.
  - Fully managed (no manual installation/maintenance).
  - Free forever for certain plans (PostgreSQL, Valkey).
- ❌ **Cons**:
  - Limited resources (suitable for small to medium usage).
  - No automated backups on the free tier.
  - Single node only (no high-availability failover).

### Steps
1. **Clone the repository**:
   ```bash
   git clone https://github.com/bisug/TG-WordGame
   cd TG-WordGame
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the root directory with the following variables:
   ```env
   BOT_TOKEN=your-telegram-bot-token
   DATABASE_URL=your-postgresql-database-url
   DAILY_WORDLE_SECRET=your-random-secret-string
   DAILY_WORDLE_START_DATE=2025-01-01
   NODE_ENV=development
   REDIS_URI=redis://127.0.0.1:6379
   ADMIN_USERS=your-telegram-user-id
   TIME_ZONE=UTC
   UPDATES_CHANNEL=https://t.me/WordSeek
   DISCUSSION_GROUP=https://t.me/WordGuesser
   WEB_SERVICE=false
   GEMINI_API_KEYS=your_gemini_key_1 your_gemini_key_2
   ```

4. **Set up the database**:
   Run the database migrations to set up the required tables:
   ```bash
   bun run db:migrate
   ```

5. **Start the bot**:
   - **Development mode** (with hot reload):
     ```bash
     bun run dev
     ```
   - **Production mode**:
     ```bash
     bun run start
     ```

### Additional Database Commands
- **Seed the database**:
  ```bash
  bun run db:seed
  ```
- **Generate types for database schemas**:
  ```bash
  bun run db:codegen
  ```


## Try the Bot
- **[WordSeek I](https://t.me/WordSeekBot)** *(Main bot)*
- **[WordSeek II](https://t.me/WordSeek2Bot)** *(Use this if the main bot is busy)*

## Community
- **Join the Official Group**: [Word Guesser Group](https://t.me/wordguesser) - Play the game, discuss strategies, and share feedback.
- **Support the Developer**: [Binamra Bots Channel](https://t.me/BinamraBots)
- **Contact the Developer**: Have suggestions or issues? Reach out on Telegram: [@binamralamsal](https://t.me/binamralamsal)

## Contributing
Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Troubleshooting

### Common Issues
- **Database connection errors**: Ensure PostgreSQL is running and the `DATABASE_URL` is correct.
- **Redis connection errors**: Make sure Redis server is running on the specified port.
- **Bot not responding**: Verify your `BOT_TOKEN` is valid and the bot is not already running elsewhere.
- **Migration errors**: Ensure you have proper database permissions and the database exists.

### Getting Help
If you encounter issues:
1. Check the [Issues](https://github.com/bisug/TG-WordGame/issues) page on GitHub.
2. Join the [Word Guesser Group](https://t.me/wordguesser) for community support.
3. Contact the developer directly: [@binamralamsal](https://t.me/binamralamsal)

## Credits

This project was originally created by **[Binamra Lamsal](https://github.com/binamralamsal)**. You can find the original bot at [@WordSeekBot](https://t.me/WordSeekBot) and the original repository at [binamralamsal/WordSeek](https://github.com/binamralamsal/WordSeek).

### Support the Original Creator

If you'd like to support the original creator of WordSeek, you can do so here:

<a href="https://buymemomo.com/binamra">
  <img src="https://buymemomo.com/logo.png" height="80" alt="Donate" />
  <br />
  <b>Click here to donate and support the original creator!</b>
</a>

## Contributors

A huge thanks to everyone who has contributed to this project!

<a href="https://github.com/bisug/TG-WordGame/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=bisug/TG-WordGame" />
</a>

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
