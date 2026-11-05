# Chinese, Simplified (zh) brief

Registered under the bare `zh` tag, so `zh`, `zh-CN` and `zh-SG` all widen to
it. Content flavour is **Simplified Chinese**; a Traditional-Chinese host
(zh-Hant, zh-TW, zh-HK) supplies its own messages through `customMessages`.

## Register

- Controls carry the two-character verb/noun labels standard in Chinese UI:
  `关闭` (close), `取消` (cancel), `保存` (save), `提交` (submit), `完成`
  (finish).
- Sentences use plain formal written Chinese without a specific politeness
  particle.
- State-change announcements (a tool moving or rotating, a calculator opening,
  the zoom changing) read as events with the `已…` resultative: `已打开基本
  计算器`, `已旋转至 {degrees} 度`, `已放大至 {zoom} 倍` — never a bare label
  that restates a control (`放大 {zoom} 倍`).
- Empty states use `暂无`/`尚无`: `暂无部分`, `尚无题目会话数据` — not the
  conversational `没有…`.
- Whole sentences authored whole; no fragment assembly.

## Terminology

| English | Chinese | Note |
| --- | --- | --- |
| question | 题 | the assessment question; numbered as `第 {position} 题` |
| items | 题目 | learner-facing regions show 题目 |
| passage | 文章 | the reading passage |
| section | 部分 | |
| assessment (the delivered test) | 测试 | load/error strings (`无法加载测试`) |
| assessment tools (toolbar) | 测评工具 | the toolbar's accessible name; 测评, not 测试 — `测试工具` reads as software-testing tooling |
| submit | 提交 | |
| finish | 完成 | |
| check answer | 检查答案 | |
| tries left | 尝试机会 | `还剩 {count} 次尝试机会。` |
| settings | 设置 | |
| tools / toolbar | 工具 / 工具栏 | |
| calculator | 计算器 | 基本，科学，图形 |
| graph | 图形 | |
| coordinate plane | 坐标系 | Chinese math register |
| grid | 网格 | |
| line (mode) | 直线 | the math object |
| connected lines | 相连的线 | the graph's "associated lines"; matches the delete hint's 连接 |
| periodic table | 元素周期表 | the standard name |
| metalloid | 类金属 | the Chinese chemistry term |
| atomic number | 原子序数 | spelled out for screen readers |
| phase (periodic table) | 物态 | the chemistry word for the solid/liquid/gas column; generic 状态 alone under-specifies it |
| ruler | 直尺 | the school instrument |
| inches / centimeters | 英寸 / 厘米 | |
| protractor | 量角器 | the school instrument |
| dictionary | 词典 | |
| picture dictionary | 图片词典 | |
| entry (dictionary) | 条 | `{count} 条` |
| Spanish (language name) | 西班牙语 | `西班牙语词典` |
| line reader | 阅读辅助 | the reading-guide tool |
| magnifier | 放大镜 | |
| zoom in / out | 放大 / 缩小 | |
| highlight(er) | 荧光笔 / 高亮 | |
| underline | 下划线 | |
| annotate | 批注 | the Chinese Office convention |
| theme | 主题 | |
| text to speech | 语音朗读 | read-aloud phrasing; also the settings-panel title (语音朗读设置), no TTS acronym |
| playback speed | 朗读速度 | |
| sign language | 手语 | |
| audio transcript | 文字稿 | |
| strike through | 划掉 | the answer-eliminator action |
| eliminated-choice toggle | 切换{choice}的划除状态 | the possessive reading, not the verb pile-up 切换划除{choice} |
| placement | 放置位置 | a tool's placement, not 摆放位置 |
| host surface | 宿主界面 | UI Chinese; 表面 is a physical-word calque |
| provenance | 溯源 | the tech word for data/policy provenance, not 来源 |
| pixels | 像素 | |
| degrees | 度 | keep the `°` glyph |
| voice (TTS) | 音色 | a TTS voice (Baidu-register); the settings panel still says 音色, gender rows stay 男/女 under 性别 |

## Plurals, punctuation, digits

- Chinese has a single CLDR plural category: every plural group carries
  `other` only.
- Full-width punctuation in Chinese contexts (`：`，`（）`); no spaces between
  CJK characters; Latin product names keep ASCII form. Western digits as the
  placeholders interpolate.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API.
