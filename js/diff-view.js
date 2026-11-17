// =============================================================
// 変換前後の差分（変更箇所の色分け）を表示する
// 日本語は単語の間に空白がないため、ブラウザの単語分割機能(Intl.Segmenter)で
// 単語ごとに区切ってから比較します。差分計算は vendor/diff.min.js（jsdiff）を利用。
// =============================================================
(function (App) {

function tokenize(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter('ja', { granularity: 'word' });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text); // 古いブラウザでは1文字ずつ比較
}

function diffParts(before, after) {
  return window.Diff.diffArrays(tokenize(before), tokenize(after)).map((p) => ({
    added: p.added,
    removed: p.removed,
    text: p.value.join(''),
  }));
}

function span(text, className) {
  const el = document.createElement('span');
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

/**
 * 差分を2つの枠に描画する。
 * @returns {boolean} 変更があれば true
 */
function renderDiff(before, after, beforeEl, afterEl) {
  beforeEl.replaceChildren();
  afterEl.replaceChildren();
  let changed = false;
  for (const part of diffParts(before, after)) {
    if (part.added) {
      afterEl.append(span(part.text, 'diff-add'));
      changed = true;
    } else if (part.removed) {
      beforeEl.append(span(part.text, 'diff-del'));
      changed = true;
    } else {
      beforeEl.append(span(part.text));
      afterEl.append(span(part.text));
    }
  }
  return changed;
}

/**
 * 差分から「どこがどう変わったか」の一覧を作る（AIの結果を貼り付けたとき用）。
 * 続けて出てくる「削除」と「追加」を1組の変更としてまとめる。
 * @returns {{before:string, after:string}[]}
 */
function listChanges(before, after) {
  const changes = [];
  let current = null;
  for (const part of diffParts(before, after)) {
    if (part.added || part.removed) {
      current = current || { before: '', after: '' };
      if (part.removed) current.before += part.text;
      else current.after += part.text;
    } else if (current) {
      changes.push(current);
      current = null;
    }
  }
  if (current) changes.push(current);
  return changes.filter((c) => (c.before + c.after).trim());
}

App.DiffView = { renderDiff, listChanges };
})(window.App);
