import { InlineKeyboard } from "grammy";
import { BACK_BUTTONS, NAV_EMOJIS } from "./button-actions";

/**
 * Format button text to show active state
 */
export function formatActiveButton(label: string, active: boolean): string {
  return active ? `« ${label} »` : label;
}

/**
 * Create a back button with consistent styling
 */
export function createBackButton(
  callback: string,
  type: keyof typeof BACK_BUTTONS = "MAIN_HELP",
): InlineKeyboard {
  return new InlineKeyboard().text(BACK_BUTTONS[type], callback);
}

/**
 * Create a row of back buttons
 */
export function createBackButtonRow(
  callbacks: Array<{ text: string; callback: string }>,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  callbacks.forEach((btn, index) => {
    keyboard.text(btn.text, btn.callback);
    if (index < callbacks.length - 1) {
      keyboard.row();
    }
  });
  return keyboard;
}

/**
 * Style a button as primary (active/selected)
 */
export function stylePrimary(
  builder: ReturnType<InlineKeyboard["text"]>,
): ReturnType<InlineKeyboard["text"]> {
  return builder.style("primary");
}

/**
 * Create a refresh button
 */
export function createRefreshButton(
  callback: string,
  emoji: string = NAV_EMOJIS.REFRESH,
): InlineKeyboard {
  return new InlineKeyboard().text(emoji, callback);
}

/**
 * Build a grid of toggle buttons with consistent styling
 */
export function buildToggleGrid<T extends string>(
  options: readonly T[],
  currentValue: T,
  callbackPrefix: string,
  labels: Record<T, string>,
  columnsPerRow: number = 2,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  options.forEach((option, index) => {
    const isActive = option === currentValue;
    keyboard
      .text(formatActiveButton(labels[option], isActive), `${callbackPrefix} ${option}`)
      .style(isActive ? "primary" : undefined);

    if ((index + 1) % columnsPerRow === 0) {
      keyboard.row();
    }
  });

  return keyboard;
}

/**
 * Add footer links (updates, donate, discussion) to a keyboard
 */
export function addFooterLinks(
  keyboard: InlineKeyboard,
  links: {
    updates?: string;
    donate?: string;
    discussion?: string;
  },
): InlineKeyboard {
  if (links.updates) {
    keyboard.url("📢 Updates", links.updates);
  }
  if (links.donate) {
    keyboard.url("💓 Donate", links.donate);
  }
  if (links.discussion) {
    keyboard.url("💬 Discussion", links.discussion);
  }
  return keyboard;
}