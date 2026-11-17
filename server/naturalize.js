// =============================================================
// Claude API を呼び出して文章を自然化する処理
// =============================================================
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, OUTPUT_SCHEMA, STYLES, ENDINGS, buildUserMessage } from './prompt.js';

// 画面に表示できる日本語メッセージ付きのエラー
export class AppError extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

// 拒否時に自動で別モデルに切り替える「サーバー側フォールバック」に対応したモデル
const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1'];

/** リクエスト内容をチェックし、整えた値を返す */
export function validateInput(body, maxChars) {
  const text = typeof body?.text === 'string' ? body.text : '';
  if (!text.trim()) throw new AppError(400, '文章が入力されていません。');
  if (text.length > maxChars) {
    throw new AppError(400, `文章が長すぎます（${text.length}文字）。${maxChars}文字以内に分けて変換してください。`);
  }
  const style = body.style in STYLES ? body.style : null;
  const ending = body.ending in ENDINGS ? body.ending : null;
  if (!style) throw new AppError(400, '文体の指定が正しくありません。');
  if (!ending) throw new AppError(400, '文末表現の指定が正しくありません。');

  const rules = Array.isArray(body.rules) ? body.rules : [];
  const cleanRules = rules
    .filter((r) => r && typeof r.from === 'string' && typeof r.to === 'string' && r.from.trim())
    .slice(0, 500)
    .map((r) => ({ from: r.from.trim(), to: r.to.trim() }));

  return { text, style, ending, rules: cleanRules };
}

/**
 * 文章を自然化する。
 * @param {Anthropic} client Anthropic クライアント（テストでは偽物を渡せる）
 * @param {{text, style, ending, rules}} input validateInput 済みの値
 * @param {{model:string, effort:string}} options
 * @returns {Promise<{text:string, changes:Array, model:string, usage:object}>}
 */
export async function naturalize(client, input, { model, effort }) {
  const params = {
    model,
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(input) }],
    output_config: {
      effort,
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
    },
  };
  if (FALLBACK_MODELS.includes(model)) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }

  let message;
  try {
    // 長文でもタイムアウトしないようストリーミングで受け取り、最後にまとめて取得する
    message = await client.beta.messages.stream(params).finalMessage();
  } catch (err) {
    throw toAppError(err);
  }

  if (message.stop_reason === 'refusal') {
    throw new AppError(422, 'AIがこの文章の処理を断りました。内容を確認してください。', message.stop_details?.explanation);
  }
  if (message.stop_reason === 'max_tokens') {
    throw new AppError(422, '出力が長すぎて途中で切れました。文章を短く分けて変換してください。');
  }

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock) throw new AppError(502, 'AIから文章が返ってきませんでした。もう一度お試しください。');

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new AppError(502, 'AIの応答を読み取れませんでした。もう一度お試しください。', textBlock.text.slice(0, 200));
  }
  if (typeof parsed.text !== 'string') {
    throw new AppError(502, 'AIの応答の形式が正しくありません。もう一度お試しください。');
  }

  return {
    text: parsed.text,
    changes: Array.isArray(parsed.changes) ? parsed.changes : [],
    model: message.model,
    usage: { input_tokens: message.usage?.input_tokens, output_tokens: message.usage?.output_tokens },
  };
}

/** SDK のエラーを、原因が分かる日本語メッセージに変換する */
function toAppError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return new AppError(500, 'APIキーが正しくありません。サーバーの .env の ANTHROPIC_API_KEY を確認してください。');
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new AppError(500, 'このAPIキーでは指定モデルを利用できません。CLAUDE_MODEL を確認してください。', err.message);
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new AppError(500, 'モデルが見つかりません。.env の CLAUDE_MODEL の値を確認してください。', err.message);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AppError(429, '利用回数の上限に達しました。少し時間をおいてから再度お試しください。');
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new AppError(400, 'AIへのリクエストが受け付けられませんでした。', err.message);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AppError(503, 'AIサーバーに接続できませんでした。ネットワークを確認してください。');
  }
  if (err instanceof Anthropic.APIError) {
    return new AppError(502, `AIサーバーでエラーが発生しました（${err.status ?? '不明'}）。時間をおいて再度お試しください。`, err.message);
  }
  return new AppError(500, '予期しないエラーが発生しました。', String(err?.message ?? err));
}
