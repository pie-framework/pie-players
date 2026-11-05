# Chinese, Traditional — Taiwan register (zh-Hant) brief

Registered under the regional tag `zh-Hant` on purpose, like `nl-NL`,
`en-GB` and `en-AU`: bare `zh` stays Simplified (it already carries the PRC
catalog), while `zh-TW` and `zh-HK` widen onto this one. Content flavour is
**Traditional Chinese in Taiwan register** — the vocabulary Taiwan edtech and
Taiwan-made assessment software actually uses.

## Deliberate authoring, not a conversion

This catalog is authored from `en-US` in Taiwan-register Traditional. It is
**not** a character-by-character conversion of `src/messages/zh.ts`: that
catalog is PRC register, and a naive conversion would publish mainland words
that read as translated software to a Taiwan teacher. Where the two diverge,
this catalog keeps the Taiwan term and this brief documents the divergence.
The most consequential divergences:

| English | zh (PRC, naive conversion) | zh-Hant (Taiwan, pinned here) |
| --- | --- | --- |
| save | 保存 | **儲存** |
| settings | 设置 | **設定**（配置错误 → 設定錯誤，不是 設置錯誤） |
| section | 部分 | **題組** — Taiwan assessment chunks items into 題組, never 部分 |
| passage | 文章 | **閱讀測驗** — the Taiwan reading-test panel label |
| submit | 提交 | **繳交** — the Taiwan exam-room verb |
| assessment (delivered test) | 测试 | **測驗** |
| calculator | 计算器 | **計算機** — the Taiwan calculator word |
| centimeters | 厘米 | **公分** |
| inches | 英寸 | **英吋**（吋, not 寸） |
| window | 窗口 | **視窗** |
| scroll | 滚动 | **捲動** |
| click / drag | 点击 / 拖动 | **點選 / 拖曳** |
| default | 默认 | **預設**（浏览器默认 → 瀏覽器預設） |
| current | 当前 | **目前** |
| network / information | 网络 / 信息 | 網路 / 資訊 (register; arise in style only) |
| interface | 界面 | **介面**（主機介面, not 宿主界面） |
| support (a browser supports) | 支持 | **支援** |
| browser voices — “voice” | 音色 | **語音**（音色 is a music register; TTS voices are 語音 in Taiwan） |
| highlight | 高亮 | **醒目提示** — the Taiwan Office verb; 螢光筆 stays the tool |
| annotate | 批注 | **標註** — text markup; 註解 stays reserved for comment-notes |
| server | 服务器 | **伺服器** |
| database / data | 数据库 / 数据 | **資料庫 / 資料** |
| session | 会话 | **工作階段** |
| real-time | 实时 | **即時** |
| apply (settings) | 应用 | **套用** |
| disabled | 禁用 | **停用** |
| read-only | 只读 | **唯讀** |
| neural | 神经网络 | **神經網路** |
| menu | 菜单 | **選單** |
| instrumentation (dev panels) | 埋点 | **遙測** — 埋點 is PRC telemetry jargon |
| post-transition metal | 过渡后金属 | **後過渡金屬** |
| noble gas | 稀有气体 | **鈍氣** — the Taiwan chemistry-textbook word |
| atomic number | 原子序数 | **原子序** |
| electron configuration | 电子排布 | **電子組態** |
| grid | 网格 | **格線** |
| coordinate plane | 坐标系 | **座標平面** — 座標, and the plane, not the system |
| filter by | 按…筛选 | **依…篩選** |
| words (units) — 词 | 词 | **字詞**（speech-marks scope; TW uses 字詞 for lexical units） |
| sample (TTS) | 示例 | **範例**（示例文本 → 範例文字） |
| engineering: call (an API) | 调用 | **呼叫** |
| field label “semantic repeats” | 语义重复 | **語意重複**（語意, Taiwan orthography） |
| rewind / fast-forward | 快退 / 快进 | **倒轉 / 快轉** |

Deliberately *not* diverged (kept identical after conversion because the
term is already the Taiwan standard): 量角器 (protractor), 直尺 (ruler),
元素週期表 (periodic table — 週 is the Traditional form), 放大鏡
(magnifier), 選項 (choices), 快轉-family media verbs.

Also deliberate: `common.author` stays 作者 (a person), matching zh; the
authoring-backend error title uses **命題** (Taiwan exam-authoring register):
命題後端設定錯誤. The settings panel and browser statuses say 朗讀 (read
aloud), not a TTS acronym — same learner-language rule as the zh, ja and
th-TH briefs. 佈景主題 was considered for `theme` and rejected: toolbar
labels stay compact, and Chrome zh-TW itself says 主題.

## Register

- Controls carry the two- and three-character verb/noun labels standard in
  Taiwan UI: 關閉 (close), 取消 (cancel), 儲存 (save), 繳交 (submit),
  完成 (finish), 套用 (apply), 重設 (reset).
- Sentences use plain formal written Chinese with Taiwan phrasing; no
  politeness particle, no 你/您 unless English forces a possessive
  (restoreFailed keeps 您).
- State-change announcements read as events with the 已… resultative:
  已開啟基本計算機, 已旋轉至 {degrees} 度, 已放大至 {zoom} 倍 — never a
  bare label restating a control.
- Empty states use 尚無, not the conversational 沒有….
- Whole sentences authored whole; no fragment assembly.

## Terminology

Beyond the divergence table above, the pins reused for every occurrence:

| English | zh-Hant | Note |
| --- | --- | --- |
| question | 題目 | numbered 第 {position} 題 |
| items | 題目 | learner-facing regions show 題目 |
| section | 題組 | a delivered section of the assessment |
| assessment tools (toolbar) | 測驗工具 | the toolbar's accessible name |
| toolkit (in dev prose) | 工具集 | |
| try left | 作答機會 | 剩餘 {count} 次作答機會。 — exam register |
| coordinate plane | 座標平面 | Taiwan math register |
| grid | 格線 | |
| line (mode) | 直線 | the math object |
| periodic table | 元素週期表 | |
| dictionary | 辭典 | 辭典 for word dictionaries; 字典 is characters |
| entry (dictionary) | 筆 | {count} 筆 — Taiwan counter for records/entries |
| strike through | 劃記 / 劃掉 | the answer-eliminator action and its state; Taiwan exam-register 劃記 (cf. 刪去法) |
| annotation | 標註 | text markup (highlight, underline, remove) |
| highlight(er) | 醒目提示 / 螢光筆 | |
| underline | 底線 | |
| theme | 主題 | compact label; contrast = 對比 |
| text to speech | 朗讀 | read-aloud phrasing; settings title 朗讀設定, no TTS acronym |
| playback speed | 朗讀速度 | |
| rewind / fast-forward | 倒轉 / 快轉 | |
| audio transcript | 語音逐字稿 | region label 逐字稿 |
| sign language | 手語 | |
| pixels | 像素 | |
| degrees | 度 | keep the `°` glyph |
| voice (TTS) | 語音 | gender rows 男聲/女聲/中性 under 性別 |
| voice (browser default) | 瀏覽器預設 | local/remote = 本機/遠端 |
| snapshot | 快照 | |
| filter | 篩選 | search matches = 搜尋符合項目 |
| placement | 放置位置 | |
| host surface | 主機介面 | 介面, not 界面 |
| provenance | 溯源 | |
| policy | 政策 | Taiwan usage; 策略 is strategy |
| accommodation | 調整措施 | Taiwan special-education register |
| district (PNP) | 學區 | |
| profile (PNP) | 設定檔 | |
| instrumentation | 遙測 | the dev-panel telemetry records |
| server | 伺服器 | |
| payload | 承載 | |

## Script and punctuation

- Traditional characters throughout, Taiwan glyph conventions (衛, 線,
  為, 著 — not the Hong Kong variants 衞, 綫 etc.).
- Taiwan punctuation: corner brackets 「」 for quoted terms — including the
  interpolated `{term}`/`{id}` quotes the dictionary panels and provider
  notices carry, and the `{text}` of the annotation toolbar's live-region
  announcements. This is a deliberate divergence from `zh`, which keeps the
  curly “” glyphs.
- Full-width punctuation in Chinese contexts: ：，（）、「。；！？
- No spaces between CJK characters; Latin product names and code
  identifiers keep ASCII form with surrounding conventions unchanged
  (`HTTP {status}: {message}` keeps its ASCII colon).
- Western digits as the placeholders interpolate; the `°` glyph and `×`
  are kept.

## Annotation live-region phrases (2026-11-04 keys)

The annotation toolbar's result announcements (`selectionAvailableA11y`,
`highlightedYellowA11y`…`highlightedGreenA11y`, `underlinedA11y`,
`removedA11y`, `clearedA11y`) follow the catalog's existing pins:

- Event form with the 已… resultative, colour first:
  已以黃色醒目提示「{text}」 — the colour adjective takes 醒目提示, the
  same verb `highlighter`/`highlightYellowA11y` use, and `{text}` keeps
  its 「」 brackets.
- `selectionAvailableA11y` is a complete two-sentence instruction:
  「{text}」已可使用標註工具列。按 Shift+F10 使用標註工具。
- `clearedA11y` carries `other` only (Chinese's single CLDR category):
  已清除 {count} 條標註 — 條 is the counter for annotation records,
  matching 筆 for dictionary entries in register.

## Plurals

- Chinese has a single CLDR plural category: every plural group carries
  `other` only.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz, and the code
identifiers that appear inside dev prose (`assessment`, `requiredTools`,
`updateAssessment(...)`, `assessmentId:`, `sectionId:`, `attemptId:`,
`mode:`, the instrumentation record kinds `all`/`event`/`error`/
`metric`/`user-context`/`global-attributes`).

## A11y strings

Keys ending `A11y` are screen-reader operating instructions. Translate them
as complete, self-sufficient sentences — the learner hears them without
seeing the layout — and keep every keyboard instruction concrete. Latin key
names stay Latin where that is how Taiwan keyboards label them: Shift,
PageUp, PageDown, Escape, +/-, U; arrow keys are 方向鍵.
