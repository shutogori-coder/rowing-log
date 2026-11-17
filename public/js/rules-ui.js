// =============================================================
// 置換ルールの画面操作（追加・編集・削除・一括登録・書き出し・読み込み）
// =============================================================
import { DEFAULT_RULES, makeRule, parseBulk } from './rules-core.js';
import { loadRules, saveRules, exportToFile, importFromFile } from './storage.js';

const $ = (id) => document.getElementById(id);

let rules = [];
let notify = () => {};
let onImportSettings = () => {};
let getSettings = () => ({});

/** 現在のルール一覧を返す */
export const getRules = () => rules;

function commit() {
  if (!saveRules(rules)) notify('ルールを保存できませんでした（ブラウザの保存機能が無効の可能性があります）。', 'error');
  render();
}

function render() {
  const list = $('ruleList');
  list.replaceChildren();
  for (const rule of rules) list.append(renderRow(rule));
  const active = rules.filter((r) => r.enabled).length;
  $('ruleCount').textContent = `${rules.length} 件（有効 ${active} 件）`;
  $('ruleEmpty').classList.toggle('hidden', rules.length > 0);
}

function renderRow(rule) {
  const li = document.createElement('li');
  li.className = 'rule' + (rule.enabled ? '' : ' disabled');

  const enabled = document.createElement('input');
  enabled.type = 'checkbox';
  enabled.checked = rule.enabled;
  enabled.title = 'このルールを使う';
  enabled.addEventListener('change', () => {
    rule.enabled = enabled.checked;
    commit();
  });

  const from = textInput(rule.from, '置換前');
  const to = textInput(rule.to, '置換後');
  from.classList.add('rule-from');
  to.classList.add('rule-to');
  from.addEventListener('change', () => {
    if (!from.value.trim()) {
      from.value = rule.from; // 空にはできない
      notify('置換前の語句は空にできません。不要な場合は削除してください。', 'error');
      return;
    }
    rule.from = from.value.trim();
    commit();
  });
  to.addEventListener('change', () => {
    rule.to = to.value.trim();
    commit();
  });

  const arrow = document.createElement('span');
  arrow.className = 'arrow';
  arrow.textContent = '→';

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'btn btn-ghost btn-small rule-del';
  del.textContent = '削除';
  del.addEventListener('click', () => {
    rules = rules.filter((r) => r.id !== rule.id);
    commit();
  });

  li.append(enabled, from, arrow, to, del);
  return li;
}

function textInput(value, label) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.setAttribute('aria-label', label);
  return input;
}

/** 同じ「置換前」のルールがあれば上書き、なければ追加。追加数と更新数を返す */
function upsert(list) {
  let added = 0;
  let updated = 0;
  for (const { from, to } of list) {
    const existing = rules.find((r) => r.from === from);
    if (existing) {
      existing.to = to;
      existing.enabled = true;
      updated++;
    } else {
      rules.push(makeRule(from, to));
      added++;
    }
  }
  return { added, updated };
}

export function initRulesUI(options) {
  notify = options.notify;
  onImportSettings = options.onImportSettings;
  getSettings = options.getSettings;
  rules = loadRules();
  render();

  $('addRuleForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const from = $('newFrom').value.trim();
    if (!from) return;
    const { updated } = upsert([{ from, to: $('newTo').value.trim() }]);
    commit();
    notify(updated ? `「${from}」のルールを更新しました。` : `「${from}」のルールを追加しました。`, 'ok');
    $('newFrom').value = '';
    $('newTo').value = '';
    $('newFrom').focus();
  });

  $('bulkAddBtn').addEventListener('click', () => {
    const { rules: parsed, errors } = parseBulk($('bulkText').value);
    if (!parsed.length && !errors.length) {
      notify('一括登録する内容を入力してください。', 'error');
      return;
    }
    const { added, updated } = upsert(parsed);
    commit();
    let msg = `${added} 件追加、${updated} 件更新しました。`;
    if (errors.length) msg += `\n読み込めなかった行があります:\n${errors.join('\n')}`;
    notify(msg, errors.length ? 'error' : 'ok');
    if (!errors.length) $('bulkText').value = '';
  });

  $('exportBtn').addEventListener('click', () => exportToFile(rules, getSettings()));

  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // 同じファイルを再度選べるように
    if (!file) return;
    try {
      const data = await importFromFile(file);
      if (!confirm(`${data.rules.length} 件のルールを読み込みます。現在のルールは置き換えられます。よろしいですか？`)) return;
      rules = data.rules;
      commit();
      if (data.settings) onImportSettings(data.settings);
      notify(`${data.rules.length} 件のルールを読み込みました。`, 'ok');
    } catch (err) {
      notify(`読み込みに失敗しました: ${err.message}`, 'error');
    }
  });

  $('resetRulesBtn').addEventListener('click', () => {
    if (!confirm('現在のルールをすべて削除し、初期ルールに戻します。よろしいですか？')) return;
    rules = DEFAULT_RULES.map((r) => makeRule(r.from, r.to));
    commit();
    notify('初期ルールに戻しました。', 'ok');
  });
}
