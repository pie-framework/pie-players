# Thai (th-TH) terminology brief

The instructions the catalog is generated against. A regeneration must follow
the brief current at the generation date recorded in `catalog-manifest.json`;
change this file only together with a regeneration of the locale.

## Register

- Neutral-formal written Thai, as Thai assessment and e-learning software uses.
- **No polite particles.** Never ครับ, ค่ะ, คะ, นะ or ครับ/ค่ะ sentence endings:
  Thai UI text conventionally omits them, and picking a gendered form would
  speak for the learner.
- Full sentences rather than fragments wherever English uses a full sentence;
  short labels stay short. Thai has no capitalization, so the English
  distinction between sentence-case and label-case carries no signal — match
  length and register, not capitalization.
- No inter-word spaces: Thai does not write them. Spaces appear only where Thai
  orthography separates clauses or a Thai word from a Latin-script term or
  number.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any single
string's fidelity: the learner must see one word for one concept everywhere.

| English | Thai | Note |
| --- | --- | --- |
| question | คำถาม | a delivered question |
| passage | บทอ่าน | a reading passage |
| section | ตอน | a part of an exam (`ตอนที่ 1` = Part 1) |
| item(s) | ข้อสอบ | test items as delivered |
| answer | คำตอบ | |
| check answer | ตรวจคำตอบ | |
| submit | ส่ง | short form; `ส่งคำตอบ` only inside a whole phrase |
| finish | เสร็จสิ้น | |
| settings | การตั้งค่า | |
| tool(s) | เครื่องมือ | |
| toolbar | แถบเครื่องมือ | |
| panel | แผง | |
| loading… | กำลังโหลด… | |
| calculator | เครื่องคิดเลข | |
| graph | กราฟ | |
| grid | เส้นกริด | |
| periodic table | ตารางธาตุ | |
| ruler | ไม้บรรทัด | |
| protractor | ไม้วัดมุม | the measuring instrument, not a loanword |
| dictionary | พจนานุกรม | |
| picture dictionary | พจนานุกรมภาพ | |
| Spanish (language name) | สเปน | `พจนานุกรมภาษาสเปน` |
| line reader | เครื่องช่วยอ่าน | the reading-guide tool |
| reading window | หน้าต่างอ่าน | |
| frame | กรอบ | the obscuring frame |
| magnifier | แว่นขยาย | |
| zoom in / zoom out | ซูมเข้า / ซูมออก | loanword, standard in Thai UI |
| highlight(er) | เน้นข้อความ / ปากกาเน้นข้อความ | |
| underline | ขีดเส้นใต้ | |
| annotate | ใส่หมายเหตุ | |
| theme | ธีม | loanword, standard |
| text to speech | อ่านออกเสียงข้อความ | read-aloud phrasing, not a transliteration |
| sign language | ภาษามือ | |
| audio transcript | ถอดเสียง | |
| pixels | พิกเซล | |
| degrees | องศา | keep the `°` glyph where English has it |
| voice | เสียง | a TTS voice |
| playback speed | ความเร็วในการอ่าน | for reading controls |

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API. A Thai sentence may surround them with spaces
per orthography.

## Numbers, plurals, direction

- Arabic numerals everywhere (`{count}`, `{position}`, `{degrees}` render as
  digits, never Thai digits).
- Thai has one CLDR plural category, `other`. Plural groups carry `other` only.
- Thai is LTR; nothing here overrides direction.

## A11y strings

Keys ending `A11y` are screen-reader operating instructions. Translate them as
complete, self-sufficient sentences — the learner hears them without seeing the
layout — and keep every keyboard instruction concrete (`Shift+ปุ่มลูกศร` style
key names may keep Latin key names where that is how Thai keyboards label
them: Shift, PageUp, PageDown, Escape, +/-).
