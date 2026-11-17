// =============================================================
// Web サーバー本体
//   - public/ フォルダの画面（HTML/CSS/JS）を配信する
//   - /api/naturalize で AI 自然化を行う（APIキーはサーバー側だけで使う）
// 起動: npm start  →  http://localhost:3000
// =============================================================
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { naturalize, validateInput, AppError } from './naturalize.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.CLAUDE_EFFORT || 'medium';
const MAX_INPUT_CHARS = Number(process.env.MAX_INPUT_CHARS) || 20000;
const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY);

const client = HAS_KEY ? new Anthropic() : null;
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(root, 'public')));
// 差分表示ライブラリ（jsdiff）をブラウザに配信
app.get('/vendor/diff.js', (_req, res) => res.sendFile(path.join(root, 'node_modules/diff/dist/diff.min.js')));

// 画面が「AIが使えるか」を確認するための API
app.get('/api/health', (_req, res) => {
  res.json({ aiAvailable: HAS_KEY, model: MODEL, maxInputChars: MAX_INPUT_CHARS });
});

app.post('/api/naturalize', async (req, res, next) => {
  try {
    if (!client) {
      throw new AppError(503, 'AI機能が設定されていません。サーバーの .env に ANTHROPIC_API_KEY を設定して再起動してください。');
    }
    const input = validateInput(req.body, MAX_INPUT_CHARS);
    const result = await naturalize(client, input, { model: MODEL, effort: EFFORT });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// エラーをまとめて JSON で返す（画面に原因を表示するため）
app.use((err, _req, res, _next) => {
  if (err instanceof AppError) {
    console.error(`[${err.status}] ${err.message}`, err.detail ?? '');
    return res.status(err.status).json({ error: err.message, detail: err.detail });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: '送信データが大きすぎます。文章を分けてください。' });
  }
  console.error(err);
  res.status(500).json({ error: 'サーバー内部でエラーが発生しました。', detail: String(err?.message ?? err) });
});

app.listen(PORT, () => {
  console.log(`起動しました: http://localhost:${PORT}`);
  console.log(HAS_KEY ? `AI機能: 有効（モデル ${MODEL}）` : 'AI機能: 無効（.env に ANTHROPIC_API_KEY を設定すると有効になります）');
});
