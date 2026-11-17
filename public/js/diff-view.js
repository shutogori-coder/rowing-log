// =============================================================
// 変換前後の差分（変更箇所の色分け）を表示する
// 日本語は単語の間に空白がないため、ブラウザの単語分割機能(Intl.Segmenter)で
// 単語ごとに区切ってから比較します。差分計算は jsdiff（window.Diff）を利用。
// =============================================================

function tokenize(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter('ja', { granularity: 'word' });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text); // 古いブラウザでは1文字ずつ比較
}

function span(text, className) {
  const el = document.createElement('span');
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

/**
 * 差分を2つの枠に描画する。
 * @returns {{removed:number, added:number}} 変更された単語数
 */
export function renderDiff(before, after, beforeEl, afterEl) {
  beforeEl.replaceChildren();
  afterEl.replaceChildren();
  const parts = window.Diff.diffArrays(tokenize(before), tokenize(after));
  let removed = 0;
  let added = 0;

  for (const part of parts) {
    const text = part.value.join('');
    if (part.added) {
      afterEl.append(span(text, 'diff-add'));
      added += part.value.length;
    } else if (part.removed) {
      beforeEl.append(span(text, 'diff-del'));
      removed += part.value.length;
    } else {
      beforeEl.append(span(text));
      afterEl.append(span(text));
    }
  }
  return { removed, added };
}
