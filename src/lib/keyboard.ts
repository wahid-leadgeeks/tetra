/**
 * Shared keyboard-shortcut guards.
 *
 * Both the global screen shortcuts (`KeyboardNav`) and the Today-screen
 * shortcuts (`useTodayShortcuts`) must ignore keys under the same
 * conditions. These helpers encode that contract once.
 */

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * True when the key event originated in a form field or editable region —
 * the user is typing, so shortcut keys must pass through untouched.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (TYPING_TAGS.has(target.tagName) || target.isContentEditable)
  );
}

/**
 * True when a dialog is genuinely open and shortcut keys must yield.
 *
 * Radix keeps a closing dialog mounted with `data-state="closed"` for its
 * exit animation (~150ms). A closing dialog is not an open one: right after
 * "Start task" the user may immediately press Space to pause, and that
 * shortcut must fire instead of being swallowed by the animating remnant.
 * A dialog without an explicit state still counts as open (conservative).
 */
export function hasOpenDialog(): boolean {
  return Array.from(document.querySelectorAll('[role="dialog"]')).some(
    (dialog) => dialog.getAttribute("data-state") !== "closed",
  );
}
