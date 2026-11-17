// =============================================================
// 画面全体のまとめ役（入力・設定・変換・結果表示）
// =============================================================
import { applyRules } from './rules-core.js';
import { loadSettings, saveSettings } from './storage.js';
import { initRulesUI, getRules } from './rules-ui.js';
import { renderDiff } from './diff-view.js';
import { fetchHealth, requestNaturalize } from './api.js';

const $ = (id) => document.getElementById(id);

const state = {
  settings: loadSettings(),
  aiAvailable: false,
  maxInputChars: 20000,
  original: '', // 変換したときの元の文章
  converted: '', // 変換後の文章
};

// ---------- メッセージ表示 ----------
function notify(text, type = 'info') {
  const el = $('message');
  el.textContent = text;
  el.className = `message ${type}`;
}
function clearMessage() {
  $('message').className = 'message hidden';
}

// ---------- 入力 ----------
function updateCharCount() {
  const len = $('inputText').value.length;
  const el = $('charCount');
  el.textContent = `${len.toLocaleString()} 文字`;
  el.classList.toggle('over', state.aiAvailable && $('useAI').checked && len > state.maxInputChars);
}

// ---------- 設定 ----------
function applySettingsToForm() {
  $('styleSelect').value = state.settings.style;
  for (const r of document.querySelectorAll('input[name="ending"]')) r.checked = r.value === state.settings.ending;
  $('useAI').checked = state.aiAvailable && state.settings.useAI;
  updateModeUI();
}

function readSettingsFromForm() {
  state.settings = {
    style: $('styleSelect').value,
    ending: document.querySelector('input[name="ending"]:checked')?.value || 'dearu',
    useAI: $('useAI').checked,
  };
  saveSettings(state.settings);
  updateModeUI();
}

function updateModeUI() {
  const ai = $('useAI').checked;
  // 文体・文末の指定は AI 自然化でのみ使われるため、OFF のときは操作できないようにする
  $('styleSelect').disabled = !ai;
  for (const r of document.querySelectorAll('input[name="ending"]')) r.disabled = !ai;

  let status;
  if (!state.aiAvailable) {
    status = 'AI機能はサーバーで未設定のため使えません（置換ルールの機械的な適用のみ行います）。設定方法は README を参照してください。';
  } else if (ai) {
    status = '置換ルールを文脈に合わせて適用し、文体を整えます。';
  } else {
    status = 'AIを使わず、置換ルールをそのまま機械的に適用します（文体設定は使われません）。';
  }
  $('aiStatus').textContent = status;
  updateCharCount();
}

// ---------- 変換 ----------
async function convert() {
  const text = $('inputText').value;
  if (!text.trim()) {
    notify('変換したい文章を入力してください。', 'error');
    $('inputText').focus();
    return;
  }
  const rules = getRules().filter((r) => r.enabled);
  const useAI = $('useAI').checked;

  if (!useAI) {
    if (!rules.length) {
      notify('有効な置換ルールがありません。ルールを追加するか、AI自然化をONにしてください。', 'error');
      return;
    }
    const { text: result, hits } = applyRules(text, rules);
    const changes = hits.map((h) => ({ before: h.from, after: h.to, source: 'rule', reason: `${h.count}か所を置換` }));
    showResult(text, result, changes, '置換ルールのみ');
    notify(hits.length ? '置換ルールを適用しました。' : '一致するルールがなかったため、変更はありません。', 'ok');
    return;
  }

  if (text.length > state.maxInputChars) {
    notify(`文章が長すぎます（${text.length}文字）。${state.maxInputChars}文字以内に分けてください。`, 'error');
    return;
  }

  const btn = $('convertBtn');
  btn.disabled = true;
  btn.textContent = '変換中…';
  notify('AIが文章を確認しています。長い文章では1分ほどかかることがあります。', 'info');
  try {
    const data = await requestNaturalize({
      text,
      rules: rules.map(({ from, to }) => ({ from, to })),
      style: state.settings.style,
      ending: state.settings.ending,
    });
    showResult(text, data.text, data.changes, `AI自然化（${data.model}）`);
    notify('変換が完了しました。変更箇所を確認してください。', 'ok');
  } catch (err) {
    notify(`変換に失敗しました: ${err.message}${err.detail ? `\n詳細: ${err.detail}` : ''}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '変換する';
  }
}

function showResult(before, after, changes, meta) {
  state.original = before;
  state.converted = after;
  $('resultSection').classList.remove('hidden');
  const { added, removed } = renderDiff(before, after, $('beforeView'), $('afterView'));
  $('resultMeta').textContent = `${meta}・${after.length.toLocaleString()} 文字${added + removed ? '' : '・変更なし'}`;
  renderChanges(changes);
  $('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderChanges(changes) {
  const tbody = $('changeList');
  tbody.replaceChildren();
  for (const c of changes) {
    const tr = document.createElement('tr');
    const tag = c.source === 'rule' ? '<span class="tag tag-rule">ルール</span>' : '<span class="tag tag-ai">AI</span>';
    tr.innerHTML = `<td class="diff-del"></td><td>→</td><td class="diff-add"></td><td>${tag} <span class="reason"></span></td>`;
    tr.children[0].textContent = c.before;
    tr.children[2].textContent = c.after;
    tr.querySelector('.reason').textContent = c.reason || '';
    tbody.append(tr);
  }
  $('noChanges').classList.toggle('hidden', changes.length > 0);
  document.querySelector('.changes').classList.toggle('hidden', changes.length === 0);
}

// ---------- 結果の操作 ----------
async function copyResult() {
  try {
    await navigator.clipboard.writeText(state.converted);
    notify('変換後の文章をコピーしました。', 'ok');
  } catch {
    // クリップボードAPIが使えない環境向けの代替手段
    const ta = document.createElement('textarea');
    ta.value = state.converted;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    notify(ok ? '変換後の文章をコピーしました。' : 'コピーできませんでした。変換後の文章を手動で選択してコピーしてください。', ok ? 'ok' : 'error');
  }
}

function applyToInput() {
  $('inputText').value = state.converted;
  updateCharCount();
  notify('変換後の文章を入力欄に反映しました。「元の文章に戻す」で戻せます。', 'ok');
}

function restoreOriginal() {
  $('inputText').value = state.original;
  updateCharCount();
  $('resultSection').classList.add('hidden');
  notify('入力欄を元の文章に戻しました。', 'ok');
  $('inputText').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- 初期化 ----------
async function init() {
  initRulesUI({
    notify,
    getSettings: () => state.settings,
    onImportSettings: (s) => {
      state.settings = s;
      saveSettings(s);
      applySettingsToForm();
    },
  });

  try {
    const health = await fetchHealth();
    state.aiAvailable = health.aiAvailable;
    state.maxInputChars = health.maxInputChars;
  } catch (err) {
    notify(err.message, 'error');
  }
  $('useAI').disabled = !state.aiAvailable;
  applySettingsToForm();

  $('inputText').addEventListener('input', () => {
    updateCharCount();
    clearMessage();
  });
  $('clearInputBtn').addEventListener('click', () => {
    $('inputText').value = '';
    updateCharCount();
    $('inputText').focus();
  });
  $('styleSelect').addEventListener('change', readSettingsFromForm);
  for (const r of document.querySelectorAll('input[name="ending"]')) r.addEventListener('change', readSettingsFromForm);
  $('useAI').addEventListener('change', readSettingsFromForm);
  $('convertBtn').addEventListener('click', convert);
  $('copyBtn').addEventListener('click', copyResult);
  $('applyBtn').addEventListener('click', applyToInput);
  $('restoreBtn').addEventListener('click', restoreOriginal);
}

init();
