# WordSeek
<img width="1173" alt="WordSeek Banner" src="https://github.com/user-attachments/assets/bf444d36-2eea-4ad5-83e7-4a99acda2bfe" />

[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)

> [!NOTE]
> This project is a refined fork of the original [WordSeek](https://github.com/binamralamsal/WordSeek).

WordSeek is a high-performance Telegram Word Game bot inspired by Wordle. Engineered for speed and scale, it supports competitive multiplayer gameplay, daily global challenges, and deep integration with Telegram Forum topics.

---

### ◈ Try the Bot
▸ **[WordSeek I](https://t.me/WordSeekBot)** — Main Instance  
▸ **[WordSeek II](https://t.me/WordSeek2Bot)** — Backup Instance  

---

### ◈ Key Features
▪ **Multiplayer Synergy**: Real-time competition in group chats. The first correct guess wins.  
▪ **Daily WordSeek**: Global unique word challenges refreshed every 24 hours (Private Chat).  
▪ **Adaptive Lengths**: Play with 4, 5, or 6-letter words seamlessly.  
▪ **Forum Optimization**: Dedicated support for Telegram Forum topics with auto-recreation features.  
▪ **Comprehensive Analytics**: Global and group-specific leaderboards with detailed user stats.  
▪ **Advanced Moderation**: Built-in captcha, user authorization, and global banning systems.  

---

### ◈ Tech Stack
WordSeek is built with a modern, type-safe, and performant stack:
- **Runtime**: [Bun](https://bun.sh) (High-speed JS/TS runtime)
- **Framework**: [grammY](https://grammy.dev/) (The ultimate Telegram Bot framework)
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Kysely](https://kysely.dev/) (Type-safe SQL query builder)
- **Caching & Queues**: [Redis](https://redis.io/) & [BullMQ](https://docs.bullmq.io/)
- **Validation**: [Zod](https://zod.dev/)

---

### ◈ Deployment

#### One-Click Deployment
Deploy your own instance instantly on these platforms:
- [Railway](https://railway.com/new/template?template=https://github.com/bisug/TG-WordGame)
- [Heroku](https://heroku.com/deploy?template=https://github.com/bisug/TG-WordGame)
- [Render](https://render.com/deploy?repo=https://github.com/bisug/TG-WordGame)

#### Local Development
1. **Clone the repository**:
   ```bash
   git clone https://github.com/bisug/TG-WordGame
   cd TG-WordGame
   ```
2. **Install dependencies**:
   ```bash
   bun install
   ```
3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```
4. **Run migrations**:
   ```bash
   bun run db:migrate
   ```
5. **Start the bot**:
   ```bash
   bun run start
   ```

---

### ◈ Configuration
| Variable | Description | Default |
| :--- | :--- | :--- |
| `BOT_TOKEN` | Your Telegram Bot Token from @BotFather | Required |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URI` | Redis connection URI | Required |
| `ADMIN_USERS` | Comma-separated list of Admin User IDs | Required |
| `TIME_ZONE` | Timezone for daily resets (e.g., `UTC`) | `Asia/Kathmandu` |

---

### ◈ Documentation
For detailed guides, command references, and developer documentation, visit the **[Project Wiki](https://github.com/bisug/TG-WordGame/wiki)**.

▸ [Gameplay Guide](https://github.com/bisug/TG-WordGame/wiki/Gameplay-Guide)  
▸ [Deployment Guide](https://github.com/bisug/TG-WordGame/wiki/Deployment-Guide)  
▸ [Developer Guide](https://github.com/bisug/TG-WordGame/wiki/Developer-Guide)  

---

### ◈ Credits
Developed with passion by **[Binamra Lamsal](https://github.com/binamralamsal)**.
- Original Repository: [binamralamsal/WordSeek](https://github.com/binamralamsal/WordSeek)
- Support the creator: [buymemomo.com/binamra](https://buymemomo.com/binamra)

---

### ◈ License
This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.
