/**
 * Format button text to show active state
 */
export function formatActiveButton(label: string, active: boolean): string {
  return active ? `« ${label} »` : label;
}
