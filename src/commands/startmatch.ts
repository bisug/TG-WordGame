import { Composer } from "grammy";

const composer = new Composer();

composer.command("startmatch", async (ctx) => {
  return ctx.reply(
    "To start a new game, please use /new or /new5 (or /daily for WordSeek of the Day).",
  );
});

// CommandsHelper.addNewCommand("startmatch", "Start a new game.");

export const startMatchCommand = composer;
