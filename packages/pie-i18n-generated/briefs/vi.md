# Vietnamese (vi) terminology brief

Serves every Vietnamese host: the catalog is registered under the bare `vi`
tag, so `vi`, `vi-VN` and `vi-VN`'s uncanonicalized spellings all widen to it.
Register is the neutral-formal written Vietnamese of Vietnamese assessment and
e-learning software.

## Register

- Neutral-formal written Vietnamese with **full standard diacritics**, always.
- No pronouns: Vietnamese UI omits `bạn`/`anh`/`chị`/`em` entirely and phrases
  impersonally (`Không thể tải…`, `Đã ghi nhận…`). Where English carries a
  possessive (`your saved answers`), drop it rather than translate it.
- `Vui lòng` is permitted in full error/retry sentences — it is register-neutral
  and ubiquitous in Vietnamese software; do not use it in short labels.
- Whole sentences authored whole; no fragment assembly.
- Capitalization follows Vietnamese orthography: sentence-initial only. A short
  label keeps its initial capital; never capitalize nouns mid-string.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any single
string's fidelity: the learner must see one word for one concept everywhere.

| English | Vietnamese | Note |
| --- | --- | --- |
| question | câu hỏi | a delivered question |
| items | câu hỏi | learner-facing regions show câu hỏi; "item" is psychometric jargon, like audited Dutch and the Spanish brief |
| passage | bài đọc | a reading passage |
| section | phần | |
| answer (learner's) | câu trả lời | |
| answer key / correct answer | đáp án | reserve for the correct answer (`correctA11y` = câu trả lời đúng) |
| submit | Nộp | assessment register, not `Gửi` |
| finish | Hoàn thành | |
| check answer | Kiểm tra câu trả lời | |
| try | lượt thử | `Còn {count} lượt thử.` |
| settings | Cài đặt | |
| tool(s) | công cụ | |
| toolbar | thanh công cụ | |
| panel | bảng | resizable panes; `bảng điều khiển` is reserved for "control panel" |
| loading… | Đang tải… | |
| assessment | bài đánh giá | a delivered assessment; `kỳ thi` stays out of chrome |
| overlay | lớp phủ | |
| calculator | máy tính | cơ bản, khoa học, đồ thị |
| graph | đồ thị | |
| coordinate plane | mặt phẳng tọa độ | |
| grid | lưới | |
| point | điểm | |
| line (mode) | Đường thẳng | the straight-line drawing mode |
| delete | Xóa | |
| periodic table | bảng tuần hoàn | |
| element (chemistry) | nguyên tố | |
| category (element) | phân loại | `nhóm` means periodic-table group, which this is not |
| atomic number / atomic mass | số nguyên tử / khối lượng nguyên tử | spelled out for screen readers |
| electron configuration | cấu hình electron | |
| phase (solid/liquid/gas) | trạng thái | Rắn / Lỏng / Khí |
| ruler | thước kẻ | |
| inches / centimeters | inch / xentimét | `inch` borrowed as-is; `xentimét` one word |
| protractor | thước đo góc | the school instrument, not `ê-ke` |
| degrees | độ | keep the `°` glyph |
| dictionary | từ điển | |
| picture dictionary | từ điển tranh | |
| entry (dictionary) | mục từ | `{count} mục từ` |
| Spanish (language name) | tiếng Tây Ban Nha | `Từ điển tiếng Tây Ban Nha` |
| line reader | đọc theo dòng | the reading-guide tool; full form `công cụ đọc theo dòng` in a11y prose |
| reading window | cửa sổ đọc | |
| frame | khung | the obscuring frame |
| magnifier | kính lúp | the school word, as Microsoft names the tool |
| zoom in / zoom out | Phóng to / Thu nhỏ | |
| highlight(er) | tô sáng / công cụ tô sáng | |
| underline | gạch chân | |
| annotate / annotation | chú thích | |
| strike through | gạch ngang | the answer-eliminator action |
| choice (answer option) | phương án | multiple-choice option |
| eliminate | loại bỏ | |
| theme | giao diện | UI theme, not `chủ đề` |
| text to speech | đọc văn bản thành tiếng | the tool name; read-aloud verb = `đọc to` |
| playback speed | tốc độ đọc | for reading controls |
| rewind / fast-forward | quay lại / tua nhanh | inline reading controls |
| sign language | ngôn ngữ ký hiệu | |
| audio transcript | bản ghi âm | |
| pixels | điểm ảnh | |
| voice (TTS) | giọng đọc | |
| snapshot | ảnh chụp nhanh | debugger tables |
| session | phiên | |
| event | sự kiện | |
| controller | bộ điều khiển | |
| coordinator | bộ điều phối | |
| provider | nhà cung cấp | |
| instrumentation | đo lường | telemetry records |
| engine (TTS) | bộ máy | neural = `nơ-ron` |
| resize | đổi kích thước | `điều chỉnh kích thước` for the plain `resizePanels` noun |

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz, SSML tags named in prose
(`emphasis`).

## Numbers, plurals, direction

- Arabic numerals everywhere (`{count}`, `{position}`, `{percent}` render as
  digits, never Vietnamese chữ Nôm or support-script numerals).
- Vietnamese has one CLDR plural category, `other`. Plural groups carry
  `other` only.
- Vietnamese is LTR; nothing here overrides direction.

## A11y strings

Keys ending `A11y` are screen-reader operating instructions. Translate them as
complete, self-sufficient sentences — the learner hears them without seeing the
layout — and keep every keyboard instruction concrete. Latin key names stay in
Latin where that is how Vietnamese keyboards label them: Shift, PageUp,
PageDown, Escape, +/-, U.
