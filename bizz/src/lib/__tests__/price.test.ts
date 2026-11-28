import assert from 'node:assert/strict';
import { test } from 'node:test';

import { centsToInput, parsePriceInput, sanitizePriceInput } from '../price.ts';

test('parsePriceInput', () => {
  assert.equal(parsePriceInput('35'), 3500);
  assert.equal(parsePriceInput('35,5'), 3550);
  assert.equal(parsePriceInput('35.50 €'), 3550);
  assert.equal(parsePriceInput('1 200'), 120000);
  assert.equal(parsePriceInput('0'), 0);
  assert.equal(parsePriceInput('0,99'), 99);
  assert.equal(parsePriceInput('19,99'), 1999);
  assert.equal(parsePriceInput(''), null);
  assert.equal(parsePriceInput('abc'), null);
  assert.equal(parsePriceInput('12,345'), null);
  assert.equal(parsePriceInput('-5'), null);
  assert.equal(parsePriceInput('99999999'), null);
});

test('sanitizePriceInput', () => {
  assert.equal(sanitizePriceInput('35€'), '35');
  assert.equal(sanitizePriceInput('35.5'), '35,5');
  assert.equal(sanitizePriceInput('35,509'), '35,50');
  assert.equal(sanitizePriceInput('abc'), '');
  assert.equal(sanitizePriceInput('12345678'), '1234567');
});

test('centsToInput', () => {
  assert.equal(centsToInput(3500), '35');
  assert.equal(centsToInput(3550), '35,50');
  assert.equal(centsToInput(5), '0,05');
  assert.equal(centsToInput(null), '');
  assert.equal(parsePriceInput(centsToInput(1999)), 1999);
});
