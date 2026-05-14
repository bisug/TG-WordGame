# Deployment Guide

WordSeek is designed to be portable and can be deployed on any platform supporting Node.js or Docker.

## VPS (Recommended)
A Virtual Private Server provides the best stability.

### Method 1: PM2 (Fastest for Bun)
1. Install Bun: `curl -fsSL https://bun.sh/install | bash`
2. Clone and install: `git clone ... && bun install`
3. Setup `.env` and run migrations: `bun run db:migrate`
4. Start with PM2:
   ```bash
   npm install -g pm2
   pm2 start src/index.ts --name wordseek --interpreter bun
   ```

### Method 2: Docker Compose
1. Ensure Docker and Docker Compose are installed.
2. Start services:
   ```bash
   docker compose up -d --build
   ```

## Cloud Platforms

### Railway
1. Create a project on [Railway.app](https://railway.app).
2. Connect your GitHub repository.
3. Add **PostgreSQL** and **Redis** services.
4. Set environment variables (Railway auto-detects `DATABASE_URL` and `REDIS_URL`).

### Render
- **Free Tier**: Services sleep after 15m of inactivity. Use a pinger like [cron-job.org](https://cron-job.org) if needed.
- **Background Worker**: Recommended for 24/7 uptime.

### Heroku
- Use the "Deploy to Heroku" button in the README.
- Scale the `worker` dyno to `1`.

---
*For local development tips, see the [[Developer Guide]].*
