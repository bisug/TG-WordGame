import { bot } from "../config/bot";

type Command = {
  command: string;
  description: string;
};

const commands: Array<Command> = [];

export const CommandsHelper = {
  commands,

  async addNewCommand(command: string, description: string) {
    commands.push({ command, description });
  },

  async setCommands() {
    await bot.api.setMyCommands(commands);
  },
};
