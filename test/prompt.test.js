const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPrompt, cleanPastedResult } = require('../js/prompt.js');

test('buildPrompt: 文体・ルール・文章を含む', () => {
  const p = buildPrompt({ text: '本文です。', rules: [{ from: '全て', to: '全' }], style: 'thesis', ending: 'desumasu' });
  assert.match(p, /卒業論文風/);
  assert.match(p, /です・ます調/);
  assert.match(p, /「全て」→「全」/);
  assert.match(p, /<document>\n本文です。\n<\/document>/);
});

test('buildPrompt: ルールなし・不明な文体でも作れる', () => {
  const p = buildPrompt({ text: 'a', rules: [], style: 'xxx', ending: 'yyy' });
  assert.match(p, /（なし）/);
  assert.match(p, /大学生のレポート風/);
});

test('cleanPastedResult: 余分な囲みを除く', () => {
  assert.equal(cleanPastedResult('  ```\n文章\n```  '), '文章');
  assert.equal(cleanPastedResult('<document>\n文章\n</document>'), '文章');
  assert.equal(cleanPastedResult('文章\n2行目'), '文章\n2行目');
});
