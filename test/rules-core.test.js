import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRules, parseBulk, normalizeRules } from '../public/js/rules-core.js';

const r = (from, to, enabled = true) => ({ id: from, from, to, enabled });

test('applyRules: 基本の置換と件数', () => {
  const { text, hits } = applyRules('さまざまな意見とさまざまな立場', [r('さまざまな', 'いろいろな')]);
  assert.equal(text, 'いろいろな意見といろいろな立場');
  assert.deepEqual(hits, [{ from: 'さまざまな', to: 'いろいろな', count: 2 }]);
});

test('applyRules: 長い語句を優先する', () => {
  const { text } = applyRules('重要である。重要な点。', [r('重要', '大事'), r('重要である', '重要だ')]);
  assert.equal(text, '重要だ。大事な点。');
});

test('applyRules: 置換結果を再置換しない', () => {
  const { text } = applyRules('AB', [r('A', 'B'), r('B', 'C')]);
  assert.equal(text, 'BC');
});

test('applyRules: 無効ルールと正規表現記号', () => {
  const { text } = applyRules('a.b (x) y', [r('.', '・'), r('(x)', '[x]'), r('y', 'z', false)]);
  assert.equal(text, 'a・b [x] y');
});

test('parseBulk: 区切り記号とエラー行', () => {
  const { rules, errors } = parseBulk('全て→全\nさまざまな,いろいろな\n\n# コメント\n推進する->進める\n区切りなし\n→空');
  assert.deepEqual(rules, [
    { from: '全て', to: '全' },
    { from: 'さまざまな', to: 'いろいろな' },
    { from: '推進する', to: '進める' },
  ]);
  assert.equal(errors.length, 2);
});

test('normalizeRules: 不正データを除外', () => {
  const out = normalizeRules([{ from: ' a ', to: 'b' }, { from: '' }, null, { from: 'c', enabled: false }]);
  assert.equal(out.length, 2);
  assert.equal(out[0].from, 'a');
  assert.equal(out[1].to, '');
  assert.equal(out[1].enabled, false);
});
