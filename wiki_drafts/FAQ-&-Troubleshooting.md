# FAQ & Troubleshooting

Common questions and issues.

## Frequently Asked Questions

### Is the bot free to use?
Yes. WordSeek is open-source and free to host.

### Can I change the word list?
Yes. Words are stored in the database. You can modify the seeds or manually update the `words` table.

### Does it support other languages?
The bot is optimized for English, but you can update the word list and localization strings.

## Troubleshooting

### Bot is not responding
1. Check if the process is running (`pm2 status` or `docker ps`).
2. Verify the `BOT_TOKEN` in `.env`.
3. Check internet connectivity on your server.

### Database connection failed
1. Ensure PostgreSQL is running.
2. Verify `DATABASE_URL` matches your settings.
3. Check firewall rules for port 5432.

### Redis connection error
1. Ensure Redis server is started (`redis-cli ping`).
2. Verify `REDIS_URI` in `.env`.

### "My daily progress was lost"
Daily progress is saved in the database. If you migrate or clear your database without a backup, this data will be lost.

---
*Still need help? Join the [Support Group](https://t.me/wordguesser).*
