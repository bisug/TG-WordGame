# Getting Started

Follow these steps to set up and run your own instance of WordSeek.

## Requirements
Ensure you have the following installed:
- **Bun.js** (v1.1 or higher)
- **PostgreSQL**
- **Redis** or Valkey
- **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/bisug/TG-WordGame
   cd TG-WordGame
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

## Configuration

1. **Environment Variables**:
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. **Key Settings**:
   - `BOT_TOKEN`: Your Telegram Bot token.
   - `DATABASE_URL`: PostgreSQL connection string.
   - `REDIS_URI`: Redis connection string.
   - `DAILY_WORDLE_SECRET`: Random string for generation.
   - `ADMIN_USERS`: Telegram User IDs (space separated).

## Database Setup

1. **Run Migrations**:
   ```bash
   bun run db:migrate
   ```

2. **Seed Database (Optional)**:
   ```bash
   bun run db:seed
   ```

## Running the Bot

- **Development Mode**: `bun run dev`
- **Production Mode**: `bun run start`

## Troubleshooting
- Verify `.env` values.
- Ensure services (Postgres/Redis) are running.
- Check console logs for error messages.

Next: Learn how to play in the [[Gameplay Guide]].
