// =============================================================
// 保存処理（ブラウザの localStorage に保存）
// 同じブラウザなら、閉じても次回開いたときに残ります。
// 別のPC・ブラウザへ移すときは「書き出し」「読み込み」を使ってください。
// =============================================================
(function (App) {
const { DEFAULT_RULES, makeRule, normalizeRules } = App.RulesCore;

const RULES_KEY = 'naturalizer.rules.v1';
const SETTINGS_KEY = 'naturalizer.settings.v1';

const DEFAULT_SETTINGS = { style: 'report', ending: 'dearu' };

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // 保存機能が使えない環境
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function loadRules() {
  const saved = read(RULES_KEY);
  if (saved === null) return DEFAULT_RULES.map((r) => makeRule(r.from, r.to));
  return normalizeRules(saved);
}

const saveRules = (rules) => write(RULES_KEY, rules);

function loadSettings() {
  const saved = read(SETTINGS_KEY) || {};
  return { style: saved.style || DEFAULT_SETTINGS.style, ending: saved.ending || DEFAULT_SETTINGS.ending };
}

const saveSettings = (settings) => write(SETTINGS_KEY, settings);

/** ルールと設定を JSON ファイルとしてダウンロードさせる */
function exportToFile(rules, settings) {
  const data = { app: 'text-naturalizer', version: 1, exportedAt: new Date().toISOString(), rules, settings };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `置換ルール_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 書き出した JSON ファイルを読み込む */
async function importFromFile(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSONファイルとして読み込めませんでした。');
  }
  const rules = normalizeRules(Array.isArray(data) ? data : data.rules);
  if (!rules.length) throw new Error('ファイルに置換ルールが含まれていません。');
  const settings = data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : null;
  return { rules, settings };
}

App.Storage = { loadRules, saveRules, loadSettings, saveSettings, exportToFile, importFromFile };
})(window.App);
