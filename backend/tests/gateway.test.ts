import { describe, expect, it } from 'vitest';
import { getClientHintText } from '../src/gateway/socket';

describe('Socket gateway hint payloads', () => {
  it('emits plain task hints without anti-AI instruction text', () => {
    const hint = 'Type "cat flag.txt" to read the file.';

    expect(getClientHintText(hint)).toBe(hint);
    expect(getClientHintText(hint)).not.toContain('[AI-INSTRUCTION');
  });

  it('emits an empty string for nullable task hints', () => {
    expect(getClientHintText(null)).toBe('');
  });
});
