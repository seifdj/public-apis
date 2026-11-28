import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isValidUsernameFormat, sanitizeUsernameInput, suggestUsername } from '../username.ts';

test('sanitizeUsernameInput keeps only [a-z0-9_]', () => {
  assert.equal(sanitizeUsernameInput('Sweet Cakes'), 'sweet_cakes');
  assert.equal(sanitizeUsernameInput('Pâtisserie.Élodie'), 'patisserie_elodie');
  assert.equal(sanitizeUsernameInput('nails-by-ken!'), 'nails_by_ken');
  assert.equal(sanitizeUsernameInput('@drip_vintage'), 'drip_vintage');
  assert.equal(sanitizeUsernameInput('a'.repeat(40)).length, 24);
});

test('isValidUsernameFormat', () => {
  assert.equal(isValidUsernameFormat('sweetcakes'), true);
  assert.equal(isValidUsernameFormat('ab'), false);
  assert.equal(isValidUsernameFormat('Sweet'), false);
  assert.equal(isValidUsernameFormat('sweet cakes'), false);
  assert.equal(isValidUsernameFormat('a'.repeat(25)), false);
});

test('suggestUsername', () => {
  assert.equal(suggestUsername('Sweet Cakes Lyon'), 'sweet_cakes_lyon');
  assert.equal(suggestUsername('  Mehdi  '), 'mehdi');
  assert.equal(suggestUsername('Jo'), '');
  assert.equal(suggestUsername('--'), '');
});
