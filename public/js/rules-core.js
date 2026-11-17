// =============================================================
// 置換ルールの「計算」部分（画面操作とは分離。テストしやすいように純粋な関数だけ）
// ルール1件の形: { id: string, from: string, to: string, enabled: boolean }
// =============================================================

export const DEFAULT_RULES = [
  { from: '全て', to: '全' },
  { from: 'さまざまな', to: 'いろいろな' },
  { from: '重要である', to: '重要だ' },
  { from: '推進する', to: '進める' },
];

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function makeRule(from, to, enabled = true) {
  return { id: newId(), from: String(from).trim(), to: String(to).trim(), enabled };
}

// 一括登録で使える区切り記号（左から順に探す）
const SEPARATORS = ['→', '->', '=>', '\t', ',', '，'];

/**
 * 一括登録のテキストを解析する。1行1ルール。
 * 例: 「全て→全」「さまざまな,いろいろな」
 * @returns {{rules: {from,to}[], errors: string[]}}
 */
export function parseBulk(text) {
  const rules = [];
  const errors = [];
  text.split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return; // 空行と # で始まる行は無視
    const sep = SEPARATORS.find((s) => line.includes(s));
    if (!sep) {
      errors.push(`${i + 1}行目「${line}」: 区切り記号（→ または ,）が見つかりません`);
      return;
    }
    const idx = line.indexOf(sep);
    const from = line.slice(0, idx).trim();
    const to = line.slice(idx + sep.length).trim();
    if (!from) {
      errors.push(`${i + 1}行目「${line}」: 置換前の語句が空です`);
      return;
    }
    rules.push({ from, to });
  });
  return { rules, errors };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ルールを機械的に適用する（AIを使わない置換）。
 * - 長い語句を優先（「重要である」と「重要」があれば「重要である」を先に）
 * - 1回の走査で置換するので、置換後の文字がさらに置換されることはない
 * @returns {{text: string, hits: {from,to,count}[]}}
 */
export function applyRules(text, rules) {
  const active = rules.filter((r) => r.enabled !== false && r.from);
  if (!active.length) return { text, hits: [] };

  // 同じ置換前が複数あれば先に登録した方を使う
  const map = new Map();
  for (const r of active) if (!map.has(r.from)) map.set(r.from, r.to);

  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(keys.map(escapeRegExp).join('|'), 'g');
  const counts = new Map();

  const result = text.replace(pattern, (m) => {
    counts.set(m, (counts.get(m) || 0) + 1);
    return map.get(m);
  });

  const hits = [...counts].map(([from, count]) => ({ from, to: map.get(from), count }));
  return { text: result, hits };
}

/** 保存データなどから読んだルール配列を正しい形にそろえる */
export function normalizeRules(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => r && typeof r.from === 'string' && r.from.trim())
    .map((r) => ({
      id: typeof r.id === 'string' ? r.id : newId(),
      from: r.from.trim(),
      to: typeof r.to === 'string' ? r.to.trim() : '',
      enabled: r.enabled !== false,
    }));
}
