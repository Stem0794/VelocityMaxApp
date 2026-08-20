import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeCSVCell, neutralizeSpreadsheetFormula } from '../src/utils/csv.js';

test('neutralizes spreadsheet formula prefixes', () => {
  for (const value of ['=1+1', '+cmd', '-2+3', '@SUM(A1:A2)']) assert.equal(neutralizeSpreadsheetFormula(value).startsWith("'"), true);
  assert.equal(neutralizeSpreadsheetFormula('normal'), 'normal');
  assert.equal(neutralizeSpreadsheetFormula(-42), '-42');
  assert.equal(neutralizeSpreadsheetFormula('  =1+1').startsWith("'"), true);
});

test('escapes quotes, commas and newlines', () => {
  assert.equal(escapeCSVCell('hello, world'), '"hello, world"');
  assert.equal(escapeCSVCell('a"b'), '"a""b"');
  assert.equal(escapeCSVCell('a\nb'), '"a\nb"');
});
