# WordSeek
<img width="1173" alt="WordSeek Banner" src="https://github.com/user-attachments/assets/bf444d36-2eea-4ad5-83e7-4a99acda2bfe" />

> [!NOTE]
> This project is a fork of the original [WordSeek](https://github.com/binamralamsal/WordSeek).

WordSeek is a high-performance Telegram Word Game bot inspired by Wordle. It supports multiplayer gameplay in groups, daily challenges in private chats, and specialized features for forum topics.

### Try the Bot
• [WordSeek I](https://t.me/WordSeekBot) — Main instance
• [WordSeek II](https://t.me/WordSeek2Bot) — Backup instance

## Tech Stack
<p align="left">
  <a href="https://bun.sh"><img src="https://skillicons.dev/icons?i=bun" height="40" alt="bun logo"  /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://skillicons.dev/icons?i=ts" height="40" alt="typescript logo"  /></a>
  <a href="https://grammy.dev/"><img src="https://raw.githubusercontent.com/grammyjs/website/main/logos/grammY.png" height="40" alt="grammy logo"  /></a>
  <a href="https://www.postgresql.org/"><img src="https://skillicons.dev/icons?i=postgres" height="40" alt="postgresql logo"  /></a>
  <a href="https://redis.io/"><img src="https://skillicons.dev/icons?i=redis" height="40" alt="redis logo"  /></a>
  <a href="https://zod.dev/"><img src="https://skillicons.dev/icons?i=zod" height="40" alt="zod logo"  /></a>
</p>

## Key Features
• **Multiplayer Gameplay**: Compete with friends in group chats.
• **Daily Mode**: Unique word challenges refreshed every 24 hours.
• **Flexible Lengths**: Support for 4, 5, and 6-letter words.
• **Forum Support**: Integration with Telegram Forum topics.
• **Leaderboards**: Global and group-specific rankings.
• **Moderation Tools**: Built-in captcha and authorization systems.

## Deployment
For detailed hosting guides, visit the **[Deployment Guide](https://github.com/bisug/TG-WordGame/wiki/Deployment-Guide)** on our Wiki.

### One-Click
• [Railway](https://railway.com/new/template?template=https://github.com/bisug/TG-WordGame)
• [Heroku](https://heroku.com/deploy?template=https://github.com/bisug/TG-WordGame)
• [Render](https://render.com/deploy?repo=https://github.com/bisug/TG-WordGame)

### Local
```bash
git clone https://github.com/bisug/TG-WordGame
cd TG-WordGame
bun install
cp .env.example .env
bun run db:migrate
bun run start
```

## Documentation
Complete guides and command references are available on the **[Project Wiki](https://github.com/bisug/TG-WordGame/wiki)**.

## Credits
This project was originally created by **[Binamra Lamsal](https://github.com/binamralamsal)**.
• Original Repository: [binamralamsal/WordSeek](https://github.com/binamralamsal/WordSeek)
• Support the creator: [buymemomo.com/binamra](https://buymemomo.com/binamra)

## License
MIT License. See [LICENSE](LICENSE) for details.
