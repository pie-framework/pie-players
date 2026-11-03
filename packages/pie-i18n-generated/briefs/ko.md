# Korean (ko) brief

Serves every Korean host under the bare `ko` tag. Renaissance runs a Korean
subsidiary; the register follows Korean edtech UI.

## Register

- Controls carry the noun-form labels standard in Korean UI: `닫기` (close),
  `취소` (cancel), `저장` (save), `제출` (submit), `마침` (finish).
- Sentences use the formal polite 합니다체 (`~했습니다`, `~해 주세요`).
- Whole sentences authored whole; no fragment assembly.

## Terminology

| English | Korean | Note |
| --- | --- | --- |
| question | 문항 | the assessment item, not conversational 질문 |
| items | 문항 | learner-facing regions show 문항 |
| passage | 지문 | the exam reading passage |
| section | 섹션 | |
| submit | 제출 | |
| finish | 마침 | |
| check answer | 정답 확인 | |
| tries left | 남은 시도 | `{count}번의 시도가 남았습니다.` |
| settings | 설정 | |
| tools / toolbar | 도구 / 도구 모음 | |
| calculator | 계산기 | 기본, 공학용 (scientific), 그래프 (graphing) |
| graph | 그래프 | |
| coordinate plane | 좌표평면 | Korean math register |
| grid | 격자 | |
| line (mode) | 선 | |
| periodic table | 주기율표 | |
| atomic number | 원자번호 | one word, no space — the compound form Korean chemistry uses; 원자 번호 splits it |
| ruler | 자 | |
| inches / centimeters | 인치 / 센티미터 | |
| protractor | 각도기 | the school instrument |
| dictionary | 사전 | |
| picture dictionary | 그림 사전 | |
| entry (dictionary) | 항목 | also the miss: `"{term}"에 대한 항목이 없습니다`, not 결과 |
| Spanish (language name) | 스페인어 | `스페인어 사전` |
| line reader | 읽기 보조 | the reading-guide tool |
| magnifier | 돋보기 | |
| zoom in / out | 확대 / 축소 | zoom announcement reads as an event: `배율이 {zoom}배로 변경되었습니다` |
| highlight(er) | 형광펜 / 형광펜 표시 | annotation toolbar purpose clause: `텍스트에 형광펜 표시 및 주석 달기`, no loanword 마킹 |
| underline | 밑줄 | |
| annotate | 주석 | |
| theme | 테마 | |
| text to speech | 소리 내어 읽기 | read-aloud phrasing; also the settings-panel title (소리 내어 읽기 설정) and browser statuses (브라우저 음성 읽기…) — the TTS acronym stays out of learner-facing titles |
| playback speed | 읽기 속도 | |
| sign language | 수화 | |
| audio transcript | 녹취록 | one word — no 텍스트 녹취록 variant |
| accommodation | 편의 제공 | the Korean testing-accommodation term, in the PNP debugger prose |
| host surface | 호스트 화면 | 표면 is a physical-word calque |
| reserved row | 예약 행 | matches 예약 in the header-row-reservation label |
| strike through | 취소선 | the answer-eliminator action |
| pixels | 픽셀 | counter-attached: `{pixels}픽셀` |
| degrees | 도 | keep the `°` glyph |
| voice (TTS) | 음성 | |

## Plurals, punctuation, digits

- Korean has a single CLDR plural category: every plural group carries
  `other` only.
- Keep `…`, curly quotes and the `°` glyph. Spaces follow Korean orthography
  (between clauses and around Latin-script terms and numerals).
- Interpolated identifiers quote with the curly double quotes `“{id}”`, the
  catalog's established quote glyphs, never straight `'{id}'`.
- Parentheses stay half-width `(…)` as the catalog already renders them
  (`(서버)`, `(읽기 전용)`, `(미배치)`).
- Question-position announcements avoid the bracketed-josa hack `이(가)`: attach
  the counter 번 (`문항 {position}번이 표시되었습니다`) so the particle is
  deterministic.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API.
