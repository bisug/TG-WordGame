# Commands Reference

Full list of available commands in WordSeek.

## Player Commands

### Game Management
- `/new` - Start a new game (default 5 letters).
- `/new4` - Start a 4-letter game.
- `/new5` - Start a 5-letter game.
- `/new6` - Start a 6-letter game.
- `/end` - Request to end the current game (triggers vote in groups).
- `/daily` - Play the Daily WordSeek (Private chat only).
- `/pausedaily` - Switch back to normal games from daily mode.

### Stats & Social
- `/score [target] [scope] [period] [length]` - View scores.
- `/leaderboard [scope] [period] [length]` - View rankings.
- `/help` - Show help menu.
- `/id` - Get Telegram User/Chat ID.

## Group Admin Commands
Restricted to group administrators.

- `/seekauth` - Manage users authorized to end games instantly.
  - `list`: Show authorized users.
  - `remove <user>`: Remove authorization.
- `/setgametopic` - Restrict games to the current forum topic.
- `/unsetgametopic` - Remove topic restrictions.
- `/allowonlylen <lengths>` - Restrict allowed word lengths (e.g., `/allowonlylen 5 6`).
- `/recreatetopic` - Auto-recreate topic on expiration.

## Bot Admin Commands
Restricted to users in `ADMIN_USERS`.

- `/stats` - View global bot usage statistics.
- `/broadcast <message>` - Send message to all users/groups.
- `/ban <user>` - Globally ban a user.
- `/unban <user>` - Lift a global ban.
- `/transfer <from> <to>` - Transfer scores between accounts.
- `/track <chat_id>` - Enable message tracking for a chat.
- `/untrack <chat_id>` - Disable message tracking.
- `/tracklist` - View all tracked chats.
- `/captcha <chat_id> <user_id>` - Manually trigger captcha for a user.

---
*Note: Parameters in brackets `[]` are optional, while `<>` are required.*
