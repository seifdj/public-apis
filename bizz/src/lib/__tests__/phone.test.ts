import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatE164ForDisplay, formatFrenchMobileInput, maskE164, parseFrenchMobile } from '../phone.ts';

test('parseFrenchMobile accepts the usual spellings', () => {
  for (const input of ['06 12 34 56 78', '0612345678', '+33 6 12 34 56 78', '+33612345678', '0033612345678', '33612345678', '06.12.34.56.78', '+33 (0)6 12 34 56 78']) {
    assert.deepEqual(parseFrenchMobile(input), { e164: '+33612345678', valid: true }, input);
  }
  assert.equal(parseFrenchMobile('07 00 00 00 01').e164, '+33700000001');
});

test('parseFrenchMobile rejects landlines, short and foreign numbers', () => {
  for (const input of ['', '06 12 34', '01 23 45 67 89', '09 12 34 56 78', '+44 7911 123456', '061234567890', 'abcdef']) {
    assert.equal(parseFrenchMobile(input).valid, false, input);
    assert.equal(parseFrenchMobile(input).e164, '', input);
  }
});

test('formatFrenchMobileInput groups digits by two as the user types', () => {
  assert.equal(formatFrenchMobileInput('0'), '0');
  assert.equal(formatFrenchMobileInput('061'), '06 1');
  assert.equal(formatFrenchMobileInput('0612345678'), '06 12 34 56 78');
  assert.equal(formatFrenchMobileInput('06 12 34 56 78 99'), '06 12 34 56 78');
  assert.equal(formatFrenchMobileInput('+33612345678'), '+33 6 12 34 56 78');
});

test('display helpers', () => {
  assert.equal(formatE164ForDisplay('+33612345678'), '06 12 34 56 78');
  assert.equal(maskE164('+33612345678'), '06 •• •• •• 78');
  assert.equal(formatE164ForDisplay('not-a-phone'), 'not-a-phone');
});
