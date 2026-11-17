// Claude API を実際には呼ばず、偽のクライアントでサーバー処理を確認するテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { naturalize, validateInput, AppError } from '../server/naturalize.js';

function fakeClient(message, capture = {}) {
  return {
    beta: {
      messages: {
        stream(params) {
          capture.params = params;
          return { finalMessage: async () => message };
        },
      },
    },
  };
}

const input = { text: '全ての学生がさまざまな意見を持つ。', style: 'report', ending: 'dearu', rules: [{ from: 'さまざまな', to: 'いろいろな' }] };

test('naturalize: 正常な応答を解析し、リクエストにルールと文体を含める', async () => {
  const capture = {};
  const msg = {
    model: 'claude-opus-5-5',
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5 },
    content: [
      { type: 'thinking', thinking: '' },
      { type: 'text', text: JSON.stringify({ text: '全学生がいろいろな意見を持つ。', changes: [{ before: 'さまざまな', after: 'いろいろな', source: 'rule', reason: 'ルール' }] }) },
    ],
  };
  const out = await naturalize(fakeClient(msg, capture), input, { model: 'claude-opus-5-5', effort: 'medium' });
  assert.equal(out.text, '全学生がいろいろな意見を持つ。');
  assert.equal(out.changes.length, 1);
  const userMsg = capture.params.messages[0].content;
  assert.match(userMsg, /「さまざまな」→「いろいろな」/);
  assert.match(userMsg, /大学生のレポート風/);
  assert.match(userMsg, /である調/);
  assert.equal(capture.params.output_config.format.type, 'json_schema');
  assert.equal(capture.params.fallbacks, 'default');
});

test('naturalize: フォールバック非対応モデルでは fallbacks を送らない', async () => {
  const capture = {};
  const msg = { model: 'm', stop_reason: 'end_turn', content: [{ type: 'text', text: '{"text":"a","changes":[]}' }] };
  await naturalize(fakeClient(msg, capture), input, { model: 'claude-haiku-5-5', effort: 'low' });
  assert.equal(capture.params.fallbacks, undefined);
  assert.equal(capture.params.betas, undefined);
});

test('naturalize: 拒否・途中切れ・不正JSON はわかりやすいエラーになる', async () => {
  const cases = [
    { stop_reason: 'refusal', content: [] },
    { stop_reason: 'max_tokens', content: [] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] },
  ];
  for (const m of cases) {
    await assert.rejects(naturalize(fakeClient(m), input, { model: 'x', effort: 'low' }), AppError);
  }
});

test('validateInput: 入力チェック', () => {
  assert.throws(() => validateInput({ text: '  ' }, 100), /入力されていません/);
  assert.throws(() => validateInput({ text: 'abc', style: 'report', ending: 'dearu' }, 2), /長すぎます/);
  assert.throws(() => validateInput({ text: 'a', style: 'xxx', ending: 'dearu' }, 100), /文体/);
  const ok = validateInput({ text: 'a', style: 'plain', ending: 'desumasu', rules: [{ from: ' x ', to: 'y' }, { from: '' }] }, 100);
  assert.deepEqual(ok.rules, [{ from: 'x', to: 'y' }]);
});
