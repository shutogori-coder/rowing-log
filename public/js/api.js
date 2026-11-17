// =============================================================
// サーバー API の呼び出し（APIキーはサーバー側にあり、ここには書かない）
// =============================================================

export async function fetchHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('サーバーの状態を取得できませんでした。');
  return res.json();
}

/**
 * AI 自然化を依頼する。
 * @returns {Promise<{text:string, changes:{before,after,source,reason}[], model:string}>}
 */
export async function requestNaturalize({ text, rules, style, ending }) {
  let res;
  try {
    res = await fetch('/api/naturalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, rules, style, ending }),
    });
  } catch {
    throw new Error('サーバーに接続できませんでした。サーバーが起動しているか確認してください。');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // JSON 以外が返ってきた場合
  }
  if (!res.ok) {
    const err = new Error(data?.error || `サーバーエラー（${res.status}）`);
    err.detail = data?.detail;
    throw err;
  }
  return data;
}
