// =============================================================
// 画面全体のまとめ役（入力・設定・変換・結果表示）
// =============================================================
(function (App) {
const { applyRules } = App.RulesCore;
const { buildPrompt, cleanPastedResult } = App.Prompt;
const { loadSettings, saveSettings } = App.Storage;
const { initRulesUI, getRules } = App.RulesUI;
const { renderDiff, listChanges } = App.DiffView;

const $ = (id) => document.getElementById(id);

const state = {
  settings: loadSettings(),
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
  $('charCount').textContent = `${$('inputText').value.length.toLocaleString()} 文字`;
}

function getInputText() {
  const text = $('inputText').value;
  if (!text.trim()) {
    notify('変換したい文章を入力してください。', 'error');
    $('inputText').focus();
    return null;
  }
  return text;
}

const activeRules = () => getRules().filter((r) => r.enabled);

// ---------- 設定 ----------
function applySettingsToForm() {
  $('styleSelect').value = state.settings.style;
  for (const r of document.querySelectorAll('input[name="ending"]')) r.checked = r.value === state.settings.ending;
}

function readSettingsFromForm() {
  state.settings = {
    style: $('styleSelect').value,
    ending: document.querySelector('input[name="ending"]:checked')?.value || 'dearu',
  };
  saveSettings(state.settings);
}

// ---------- A. 置換ルールだけ適用 ----------
function convertWithRules() {
  const text = getInputText();
  if (text === null) return;
  const rules = activeRules();
  if (!rules.length) {
    notify('有効な置換ルールがありません。ルールを追加してください。', 'error');
    return;
  }
  const { text: result, hits } = applyRules(text, rules);
  const changes = hits.map((h) => ({ before: h.from, after: h.to, label: 'ルール', reason: `${h.count}か所を置換` }));
  showResult(text, result, changes, '置換ルールのみ');
  notify(hits.length ? '置換ルールを適用しました。' : '一致するルールがなかったため、変更はありません。', 'ok');
}

// ---------- B. Claude.ai で自然化 ----------
async function copyPrompt() {
  const text = getInputText();
  if (text === null) return;
  const prompt = buildPrompt({
    text,
    rules: activeRules().map(({ from, to }) => ({ from, to })),
    style: state.settings.style,
    ending: state.settings.ending,
  });
  state.original = text; // 比較の基準にする
  const ok = await copyText(prompt);
  notify(
    ok
      ? '依頼文をコピーしました。Claude.ai のチャット欄に貼り付けて送信し、返ってきた文章を下の欄に貼り付けてください。'
      : 'コピーできませんでした。ブラウザの設定を確認してください。',
    ok ? 'ok' : 'error',
  );
}

function compareAIResult() {
  const pasted = cleanPastedResult($('aiResultText').value);
  if (!pasted) {
    notify('Claude.ai が返した文章を貼り付けてください。', 'error');
    $('aiResultText').focus();
    return;
  }
  // 依頼文をコピーした後に入力欄を編集していても、コピー時点の文章と比べる
  const original = state.original || $('inputText').value;
  if (!original.trim()) {
    notify('比較する元の文章がありません。先に「依頼文をコピー」を押してください。', 'error');
    return;
  }
  const changes = listChanges(original, pasted).map((c) => ({ ...c, label: 'AI', reason: '' }));
  showResult(original, pasted, changes, 'Claude.ai で自然化');
  notify('比較しました。変更箇所を確認してください。', 'ok');
}

// ---------- 結果表示 ----------
function showResult(before, after, changes, meta) {
  state.original = before;
  state.converted = after;
  $('resultSection').classList.remove('hidden');
  const changed = renderDiff(before, after, $('beforeView'), $('afterView'));
  $('resultMeta').textContent = `${meta}・${after.length.toLocaleString()} 文字${changed ? '' : '・変更なし'}`;
  renderChanges(changes);
  $('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderChanges(changes) {
  const tbody = $('changeList');
  tbody.replaceChildren();
  for (const c of changes) {
    const tr = document.createElement('tr');
    const tagClass = c.label === 'ルール' ? 'tag-rule' : 'tag-ai';
    tr.innerHTML = `<td class="diff-del"></td><td>→</td><td class="diff-add"></td><td><span class="tag ${tagClass}"></span> <span class="reason"></span></td>`;
    tr.children[0].textContent = c.before || '（なし）';
    tr.children[2].textContent = c.after || '（削除）';
    tr.querySelector('.tag').textContent = c.label;
    tr.querySelector('.reason').textContent = c.reason || '';
    tbody.append(tr);
  }
  $('noChanges').classList.toggle('hidden', changes.length > 0);
  document.querySelector('.changes').classList.toggle('hidden', changes.length === 0);
}

// ---------- コピー・元に戻す ----------
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // ファイルを直接開いた場合など、クリップボードAPIが使えないときの代替手段
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

async function copyResult() {
  const ok = await copyText(state.converted);
  notify(ok ? '変換後の文章をコピーしました。' : 'コピーできませんでした。変換後の文章を手動で選択してコピーしてください。', ok ? 'ok' : 'error');
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
function init() {
  initRulesUI({
    notify,
    getSettings: () => state.settings,
    onImportSettings: (s) => {
      state.settings = { style: s.style, ending: s.ending };
      saveSettings(state.settings);
      applySettingsToForm();
    },
  });
  applySettingsToForm();
  updateCharCount();

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
  $('convertBtn').addEventListener('click', convertWithRules);
  $('copyPromptBtn').addEventListener('click', copyPrompt);
  $('compareBtn').addEventListener('click', compareAIResult);
  $('copyBtn').addEventListener('click', copyResult);
  $('applyBtn').addEventListener('click', applyToInput);
  $('restoreBtn').addEventListener('click', restoreOriginal);
}

init();
})(window.App);
