// Rules for the sign-in code boxes: one digit per box, typing moves forward, backspace moves back, and a pasted or
// autofilled code spreads across the boxes. Each rule returns the new digits and the box to focus next.
export const CODE_LENGTH = 6;

export type CodeState = { digits: string[]; focus: number };

export const emptyCode = (): string[] => Array<string>(CODE_LENGTH).fill('');

const clamp = (index: number) => Math.max(0, Math.min(CODE_LENGTH - 1, index));

// Writes `chars` into the boxes from `start`, then focuses the box after the last one written (the last box when full).
function fill(digits: string[], start: number, chars: string): CodeState {
  const next = digits.slice();
  const count = Math.min(chars.length, CODE_LENGTH - start);
  for (let k = 0; k < count; k++) next[start + k] = chars[k];
  return { digits: next, focus: clamp(start + count) };
}

// A box's text changed to `text` (typing, typing over a digit, deleting it, or a paste or autofill).
export function typeInto(digits: string[], index: number, text: string): CodeState {
  let typed = text.replace(/\D/g, '');
  if (!typed) {
    const next = digits.slice();
    next[index] = '';
    return { digits: next, focus: index };
  }
  const previous = digits[index];
  // Typing over a filled box gives the old digit plus the new one: keep the new one.
  if (typed.length === 2 && previous) typed = typed.startsWith(previous) ? typed.slice(1) : typed.slice(0, 1);
  // A whole code (a paste or the phone's autofill) fills from the first box, wherever it landed.
  if (typed.length >= CODE_LENGTH) return fill(digits, 0, typed.slice(0, CODE_LENGTH));
  return fill(digits, index, typed);
}

// Backspace in a box that is already empty: clear the box before it and move there. (A filled box is cleared by
// typeInto, because its text changes.)
export function backspace(digits: string[], index: number): CodeState {
  if (digits[index] || index === 0) return { digits, focus: index };
  const next = digits.slice();
  next[index - 1] = '';
  return { digits: next, focus: index - 1 };
}

export const codeOf = (digits: string[]) => digits.join('');
export const isComplete = (digits: string[]) => digits.every((digit) => /^\d$/.test(digit));
