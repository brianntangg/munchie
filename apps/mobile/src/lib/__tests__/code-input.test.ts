import { describe, expect, it } from '@jest/globals';
import { backspace, CODE_LENGTH, codeOf, emptyCode, isComplete, typeInto } from '../code-input';

const code = (text: string) => text.padEnd(CODE_LENGTH, ' ').split('').map((char) => (char === ' ' ? '' : char));

describe('typeInto', () => {
  it('puts a typed digit in the box and moves to the next one', () => {
    expect(typeInto(emptyCode(), 0, '4')).toEqual({ digits: code('4'), focus: 1 });
    expect(typeInto(code('48'), 2, '1')).toEqual({ digits: code('481'), focus: 3 });
  });

  it('stays on the last box once it is filled', () => {
    expect(typeInto(code('48291'), 5, '3')).toEqual({ digits: code('482913'), focus: 5 });
  });

  it('ignores letters and symbols', () => {
    expect(typeInto(emptyCode(), 0, 'a')).toEqual({ digits: emptyCode(), focus: 0 });
    expect(typeInto(emptyCode(), 0, '-7')).toEqual({ digits: code('7'), focus: 1 });
  });

  it('replaces a digit when typing over a filled box', () => {
    expect(typeInto(code('481'), 1, '89')).toEqual({ digits: code('491'), focus: 2 });
    expect(typeInto(code('481'), 1, '98')).toEqual({ digits: code('491'), focus: 2 });
  });

  it('clears the box when its digit is deleted, and stays there', () => {
    expect(typeInto(code('481'), 2, '')).toEqual({ digits: code('48'), focus: 2 });
  });

  it('spreads a whole pasted or autofilled code from the first box, wherever it lands', () => {
    expect(typeInto(emptyCode(), 3, '482913')).toEqual({ digits: code('482913'), focus: 5 });
    expect(typeInto(code('111111'), 0, '482 913')).toEqual({ digits: code('482913'), focus: 5 });
  });

  it('keeps only the first six digits of a longer paste', () => {
    expect(codeOf(typeInto(emptyCode(), 0, '4829137').digits)).toBe('482913');
  });

  it('fills a partial paste from the box it was pasted into', () => {
    expect(typeInto(code('48'), 2, '291')).toEqual({ digits: code('48291'), focus: 5 });
    expect(typeInto(code('48'), 4, '2913')).toEqual({ digits: code('48  29'), focus: 5 });
  });
});

describe('backspace', () => {
  it('in an empty box clears the previous box and moves there', () => {
    expect(backspace(code('481'), 3)).toEqual({ digits: code('48'), focus: 2 });
  });

  it('does nothing extra in a filled box, since its own change clears it', () => {
    const digits = code('481');
    expect(backspace(digits, 2)).toEqual({ digits, focus: 2 });
  });

  it('stays on the first box', () => {
    expect(backspace(emptyCode(), 0)).toEqual({ digits: emptyCode(), focus: 0 });
  });

  it('wipes the code right to left when held down', () => {
    let state = { digits: code('482913'), focus: 5 };
    state = typeInto(state.digits, 5, '');
    for (let i = 0; i < CODE_LENGTH - 1; i++) state = backspace(state.digits, state.focus);
    expect(state).toEqual({ digits: emptyCode(), focus: 0 });
  });
});

describe('isComplete', () => {
  it('is true only when every box has a digit', () => {
    expect(isComplete(code('482913'))).toBe(true);
    expect(isComplete(code('48291'))).toBe(false);
    expect(isComplete(emptyCode())).toBe(false);
  });
});
