import { Composer } from "grammy";
import { allowOnlyLenCommand } from "./allowonlylen";
import { banCommand } from "./ban-user";
import { broadcastCommand } from "./broadcast";
import { captchaCommand } from "./captcha";
import { dailyWordleCommand } from "./daily";
import { endGameCommand } from "./end-game";
import { helpCommand } from "./help";
import { idCommand } from "./id";
import { leaderboardCommand } from "./leaderboard";
import { myScoreCommand } from "./my-score";
import { newGameCommand } from "./new-game";
import { recreateTopicCommand } from "./recreatetopic";
import { scoreCommand } from "./score";
import { seekAuthCommand } from "./seekauth";
import { setGameTopicCommand } from "./setgametopic";
import { startCommand } from "./start";
import { startMatchCommand } from "./startmatch";
import { statsCommand } from "./stats";
import { trackCommand } from "./track";
import { transferCommand } from "./transfer";
import { unbanCommand } from "./unban-user";
import { unsetGameTopicCommand } from "./unsetgametopic";

const composer = new Composer();

composer.use(
  startCommand,
  helpCommand,
  newGameCommand,
  endGameCommand,
  myScoreCommand,
  statsCommand,
  banCommand,
  unbanCommand,
  leaderboardCommand,
  scoreCommand,
  seekAuthCommand,
  startMatchCommand,
  setGameTopicCommand,
  unsetGameTopicCommand,
  trackCommand,
  transferCommand,
  broadcastCommand,
  dailyWordleCommand,
  idCommand,
  allowOnlyLenCommand,
  recreateTopicCommand,
  captchaCommand,
);

export const commands = composer;
