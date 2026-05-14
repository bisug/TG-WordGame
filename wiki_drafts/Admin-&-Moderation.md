# Admin & Moderation

WordSeek provides tools for group administrators and bot owners to manage games and ensure fair play.

## Group Administration

### Authorized Users (/seekauth)
In group chats, the `/end` command requires a majority vote by default. Admins can authorize trusted users to end games instantly.
- To authorize: Reply to a user with `/seekauth` or use `/seekauth @username`.
- To remove: `/seekauth remove @username`.
- To view list: `/seekauth list`.

### Topic Management (Forums)
For groups using Telegram Topics:
- Use `/setgametopic` to restrict games to the current topic.
- Use `/allowonlylen 4 5 6` to filter allowed word lengths.
- Use `/recreatetopic` to auto-recreate the topic if it expires.

## Bot Ownership

### Global Moderation
Bot owners (listed in `ADMIN_USERS`) can manage users across all chats.
- **Banning**: Use `/ban <user_id>` to prevent interaction. Use `/unban` to revert.
- **Captcha**: Use `/captcha <chat_id> <user_id>` to force visual verification if you suspect a user is a bot.

### System Health
- **Stats**: Use `/stats` to monitor users, active games, and database performance.
- **Broadcast**: Send updates to all bot users via `/broadcast`.

### User Support
- **Score Transfer**: Use `/transfer <old_id> <new_id>` to merge stats or move them to a new account.

---
*For more advanced configuration, refer to the [[Developer Guide]].*
