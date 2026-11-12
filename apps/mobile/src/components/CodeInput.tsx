import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { backspace, CODE_LENGTH, typeInto, type CodeState } from '@/lib/code-input';
import { colors } from '@/theme';

// Six one-digit boxes for the emailed sign-in code. Typing moves forward, backspace moves back, and a pasted or
// autofilled code fills every box; the rules live in lib/code-input.
export function CodeInput({ digits, onChange, editable = true }: { digits: string[]; onChange: (digits: string[]) => void; editable?: boolean }) {
  const boxes = useRef<(TextInput | null)[]>([]);
  const [active, setActive] = useState(-1);
  function apply({ digits: next, focus }: CodeState) {
    onChange(next);
    boxes.current[focus]?.focus();
  }
  return <View style={{ flexDirection: 'row', gap: 8 }}>
    {digits.map((digit, index) => <TextInput key={index} ref={(box) => { boxes.current[index] = box; }} value={digit} editable={editable}
      accessibilityLabel={`Digit ${index + 1} of ${CODE_LENGTH}`} keyboardType="number-pad" inputMode="numeric" selectTextOnFocus
      // Only the first box offers the code from the email; typeInto spreads it across the rest.
      autoComplete={index === 0 ? 'one-time-code' : 'off'} textContentType={index === 0 ? 'oneTimeCode' : 'none'}
      onChangeText={(text) => apply(typeInto(digits, index, text))}
      onKeyPress={({ nativeEvent: { key } }) => {
        // A filled box is cleared by onChangeText; only an empty box needs Backspace to step back.
        if (key === 'Backspace' && !digit) apply(backspace(digits, index));
        else if (key === 'ArrowLeft' && index > 0) boxes.current[index - 1]?.focus();
        else if (key === 'ArrowRight' && index < CODE_LENGTH - 1) boxes.current[index + 1]?.focus();
      }}
      onFocus={() => setActive(index)} onBlur={() => setActive((current) => (current === index ? -1 : current))}
      style={{ flex: 1, minWidth: 0, height: 56, borderRadius: 12, borderWidth: active === index ? 2 : 1, borderColor: active === index ? colors.text : colors.border, backgroundColor: colors.surface, textAlign: 'center', fontSize: 22, fontWeight: '700', color: colors.text }} />)}
  </View>;
}
