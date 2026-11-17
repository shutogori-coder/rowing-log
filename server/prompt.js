// =============================================================
// AI に渡す指示文（プロンプト）をまとめたファイル
// 文体の説明や修正ルールを変えたいときは、このファイルだけ直せばOKです。
// =============================================================

// 文体の選択肢。キーはフロントエンドの <select> の value と一致させる。
export const STYLES = {
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
    guide:
      '社内外のビジネス文書として自然な文章。結論を先に示し、簡潔で誤解のない表現にする。',
  },
  plain: {
    label: '一般的で読みやすい文章',
    guide: '専門知識のない人でもすっと読める、平易で自然な文章にする。',
  },
};

export const ENDINGS = {
  dearu: { label: 'である調', guide: '文末は「である調（だ・である）」に統一する。' },
  desumasu: { label: 'です・ます調', guide: '文末は「です・ます調」に統一する。' },
};

// システムプロンプト（毎回同じ内容なので、変数を入れないこと）
export const SYSTEM_PROMPT = `あなたは日本語の文章を自然で読みやすく整える編集者です。
ユーザーが渡す文章（AIが書いた文章や硬すぎる文章）を、本人が普段書くような自然な文章に直してください。

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
- ユーザーが登録した置換ルール（「置換前」→「置換後」）は、本人の好みの表現を示す。
- 文脈上自然になる箇所ではルールに従って置換する。
- 置換すると不自然・誤り・意味の変化が生じる箇所では置換しない。
  例: ルール「全て→全」でも「全ての学生」を「全の学生」にはしない（「全学生」のように自然に直せる場合のみ直す）。
- ルールの置換後の表現が文体指定と矛盾する場合は、文体指定を優先する。

# 出力
- text: 修正後の文章全体。
- changes: 主な変更点の一覧。before には元の文章中の表現、after には修正後の表現、
  source には置換ルールに基づく変更なら "rule"、それ以外の自然化なら "ai"、
  reason にはなぜ変えたかを短く書く。変更がなければ空配列。`;

// AI が返す JSON の形（構造化出力のスキーマ）
export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          before: { type: 'string' },
          after: { type: 'string' },
          source: { type: 'string', enum: ['rule', 'ai'] },
          reason: { type: 'string' },
        },
        required: ['before', 'after', 'source', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['text', 'changes'],
  additionalProperties: false,
};

/**
 * ユーザーメッセージ（毎回変わる部分）を組み立てる。
 * @param {{text:string, rules:{from:string,to:string}[], style:string, ending:string}} input
 */
export function buildUserMessage({ text, rules, style, ending }) {
  const styleInfo = STYLES[style];
  const endingInfo = ENDINGS[ending];
  const ruleLines = rules.length
    ? rules.map((r) => `- 「${r.from}」→「${r.to}」`).join('\n')
    : '（登録なし）';

  return `# 文体
${styleInfo.label}: ${styleInfo.guide}
${endingInfo.label}: ${endingInfo.guide}

# 置換ルール
${ruleLines}

# 修正する文章
<document>
${text}
</document>`;
}
