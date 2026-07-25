import { Composer } from "grammy";

const composer = new Composer();

composer.command("startmatch", async (_ctx) => {});

// CommandsHelper.addNewCommand("startmatch", "Start a new game.");

export const startMatchCommand = composer;
