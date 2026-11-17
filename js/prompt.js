// =============================================================
// Claude.ai などのチャットAIに貼り付ける「依頼文」を作る
// 文体の説明やAIへの指示を変えたいときは、このファイルだけ直せばOKです。
// ブラウザでは App.Prompt として使える（テストでは require で読み込む）
// =============================================================
(function (root) {

// 文体の選択肢。キーは index.html の <select id="styleSelect"> の value と一致させる。
const STYLES = {
  report: {
    label: '大学生のレポート風',
    guide:
      '大学の授業で提出するレポートとして自然な文章。学術的すぎる硬い言い回しは避け、' +
      '大学生が自分の言葉で書いたように読める、論理的で分かりやすい文章にする。',
  },
  thesis: {
    label: '卒業論文風',
    guide:
      '卒業論文として違和感のない、やや改まった文章。主張と根拠の関係を明確にし、' +
      '口語的な表現は避ける。ただし不必要に難解な漢語は使わない。',
  },
  business: {
    label: 'ビジネス文章風',
    guide: '社内外のビジネス文書として自然な文章。結論を先に示し、簡潔で誤解のない表現にする。',
  },
  plain: {
    label: '一般的で読みやすい文章',
    guide: '専門知識のない人でもすっと読める、平易で自然な文章にする。',
  },
};

const ENDINGS = {
  dearu: { label: 'である調', guide: '文末は「である調（だ・である）」に統一する。' },
  desumasu: { label: 'です・ます調', guide: '文末は「です・ます調」に統一する。' },
};

const INSTRUCTIONS = `次の文章を、本人が普段書くような自然で読みやすい文章に直してください。

# 必ず守ること
- 元の文章の意味を変えない。主張・結論・論理の流れを保つ。
- 事実、数値、固有名詞、日付、引用、出典は一切変更しない。
- 内容を足さない・削らない（重複表現の整理は可）。
- 不必要に難しい言葉を使わない。
- 「〜と言えるでしょう」「非常に重要です」「さまざまな観点から」のような、整いすぎた定型表現や過剰な強調を避ける。
- 同じ語尾・接続詞・言い回しが続く場合は、意味を変えない範囲で適度に言い換える。ただし変えすぎない。
- 指定された文体・文末表現に合わせる。
- 段落や改行の構成はできるだけ保つ。

# 置換ルールの扱い
- 下の置換ルール（「置換前」→「置換後」）は、私の好みの表現です。
- 文脈上自然になる箇所ではルールに従って置換してください。
- 置換すると不自然・誤り・意味の変化が生じる箇所では置換しないでください。
  例: ルール「全て→全」でも「全ての学生」を「全の学生」にはしない（「全学生」のように自然に直せる場合のみ直す）。
- ルールの置換後の表現が文体指定と矛盾する場合は、文体指定を優先してください。

# 出力
修正後の文章だけを出力してください。前置き・説明・変更点の一覧は書かないでください。`;

/**
 * チャットAIに貼り付ける依頼文を作る。
 * @param {{text:string, rules:{from:string,to:string}[], style:string, ending:string}} input
 */
function buildPrompt({ text, rules, style, ending }) {
  const styleInfo = STYLES[style] || STYLES.report;
  const endingInfo = ENDINGS[ending] || ENDINGS.dearu;
  const ruleLines = rules.length ? rules.map((r) => `- 「${r.from}」→「${r.to}」`).join('\n') : '（なし）';

  return `${INSTRUCTIONS}

# 文体
${styleInfo.label}: ${styleInfo.guide}
${endingInfo.label}: ${endingInfo.guide}

# 置換ルール
${ruleLines}

# 修正する文章
<document>
${text}
</document>`;
}

/** AIの返答を貼り付けたとき、よく混ざる余分な部分（```の囲み、<document>タグ）を取り除く */
function cleanPastedResult(raw) {
  let s = raw.trim();
  s = s.replace(/^```[^\n]*\n([\s\S]*?)\n```$/, '$1');
  s = s.replace(/^<document>\s*([\s\S]*?)\s*<\/document>$/, '$1');
  return s;
}

const api = { STYLES, ENDINGS, buildPrompt, cleanPastedResult };
root.App = root.App || {};
root.App.Prompt = api;
if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
