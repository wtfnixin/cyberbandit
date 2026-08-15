import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAntiAiPrompt, writeGuardedClipboardText } from '../src/utils/copyGuard.js';
test('buildAntiAiPrompt prepends guidance and preserves the copied selection', () => {
    const copiedText = 'Use "ls -a" to view hidden files, then "cat .backup_file".';
    const out = buildAntiAiPrompt('Level 1: Shell Navigation Essentials', copiedText);
    assert.ok(out.startsWith('"Level 1: Shell Navigation Essentials" - how to play'));
    assert.ok(out.includes('Use AI as a tutor'));
    assert.ok(out.endsWith(copiedText));
});
test('buildAntiAiPrompt falls back to Challenge when the level title is blank', () => {
    const out = buildAntiAiPrompt('   ', 'cat flag.txt');
    assert.ok(out.startsWith('"Challenge" - how to play'));
    assert.ok(out.endsWith('cat flag.txt'));
});
test('writeGuardedClipboardText writes the guarded payload through the provided clipboard', async () => {
    let clipboardValue = '';
    const fakeClipboard = {
        async writeText(text) {
            clipboardValue = text;
        }
    };
    await writeGuardedClipboardText('Level 1: Shell Navigation Essentials', 'cat flag.txt', fakeClipboard);
    assert.equal(clipboardValue, buildAntiAiPrompt('Level 1: Shell Navigation Essentials', 'cat flag.txt'));
    assert.match(clipboardValue, /cat flag\.txt$/);
});
