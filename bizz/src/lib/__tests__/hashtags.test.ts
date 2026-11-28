import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hashtagsToInput, parseHashtags } from '../hashtags.ts';

test('parseHashtags cleans, deduplicates and caps', () => {
  assert.deepEqual(parseHashtags('#LayerCake anniv, lyon'), ['layercake', 'anniv', 'lyon']);
  assert.deepEqual(parseHashtags('#pâtisserie #Pâtisserie #patisserie'), ['patisserie']);
  assert.deepEqual(parseHashtags('  '), []);
  assert.deepEqual(parseHashtags('#fait-main #sur_mesure'), ['faitmain', 'sur_mesure']);
  assert.equal(parseHashtags(Array.from({ length: 15 }, (_, i) => `tag${i}`).join(' ')).length, 10);
  assert.equal(parseHashtags('a'.repeat(50))[0]?.length, 30);
});

test('hashtagsToInput', () => {
  assert.equal(hashtagsToInput(['layercake', 'anniv']), '#layercake #anniv');
  assert.deepEqual(parseHashtags(hashtagsToInput(['layercake', 'anniv'])), ['layercake', 'anniv']);
});
