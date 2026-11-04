# Turkish (tr) terminology brief

Serves every Turkish host: the catalog is registered under the bare `tr` tag,
so `tr` and `tr-TR` widen to it. Register is the MEB school register — the
Turkish of classrooms, textbooks and Turkish assessment software — not the
register of generic tech localizations.

## Register

- **Controls carry the bare imperative**: `Kaydet`, `Kapat`, `Gönder`,
  `Yeniden dene`. The -mek/-mak infinitive stays out of controls entirely;
  Turkish UI does not put `kapatmak` on a button.
- **Instruction sentences carry the polite plural imperative** (`yazın`,
  `kullanın`, `deneyin`) — the `-iniz` form, not `lütfen` padding and not a
  pronoun. Error and retry prose pairs the two:
  `Bu soru kontrol edilemedi. Tekrar deneyin.`
- **Possessive suffixes are register-neutral and stay** (`cevaplarınız`,
  `okuma penceresi`): Turkish expresses possession morphologically, so unlike
  European locales there is no pronoun-of-address decision to avoid.
- **State changes are authored as passive event sentences**, never
  participles or state fragments: `Basit hesap makinesi açıldı`,
  `Cevap kaydedildi`, `Yukarı {position} konumuna taşındı`,
  `{degrees} dereceye döndürüldü`. `Hesap makinesi açık` (a state) is the
  defect class this rule exists for.
- **Headings take sentence case** (`Yapılandırma hatası`), and mid-string
  nouns stay lowercase — sentence-internal field labels are
  `sembol:`, `atom numarası:`, never `Sembol:`.
- Whole sentences authored whole; no fragment assembly.

## Agglutination rules

- **Strings are authored whole.** Suffix harmony lands on the head noun; a
  `{placeholder}` never carries a suffix. Place the placeholder before a
  postposed noun that takes the case:
  `switchedTo` = `{unit} birimine geçildi`,
  `filterByA11y` = `{category} kategorisine göre filtrele`,
  `questionPositionA11y` = `{total} sorunun {position}. sorusu`.
  Suffixing the placeholder itself (`{unit}e geçildi`) is the defect this
  rule exists for — the interpolated value's form cannot be chosen here.
- **Numbered references take the ordinal-dot form**, the Turkish exam
  convention: `{position}. soru`, `{total} sorunun {position}. sorusu`.
- **Digits and acronyms take an apostrophe before suffixes**: `0'dan`,
  `SSML'yi`. Where the suffix would be awkward on a loanword, rephrase onto a
  Turkish head noun (`İnç birimine geç`, not `İnçe geç`).
- **İ/ı correctness**: dotted İ word-initially (`İletki`, `İptal`, `İleri`,
  `İnç`, `İspanyolca`), undotted ı elsewhere (`kılavuz`, `sıfırla`,
  `yazın`). In hypothetical all-caps rendering, an İ after a vowel-final
  suffix stays İ (`… İKİ`); no catalog string is all-caps, but the rule
  constrains any host-side uppercasing.
- Orthographic circumflex stays where Turkish orthography requires it:
  `hâl`, `hâle gelene kadar`.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any single
string's fidelity: the learner must see one word for one concept everywhere.

| English | Turkish | Note |
| --- | --- | --- |
| question | soru | a delivered question |
| items | sorular | learner-facing regions show sorular; "item" is psychometric jargon, like audited Dutch |
| passage | metin | the exam reading text (`aşağıdaki metni okuyun` register); `paragraf` names only the paragraph-question genre, `okuma parçası` is descriptive padding |
| section | bölüm | parts of a Turkish test, as MEB and LGS materials say |
| answer | cevap | the school word; `yanıt` is the academic alternative, deliberately not used |
| submit | Gönder | what Turkish e-exam software shows; the email-register `ileti gönderim` stays out |
| check answer | Cevabı kontrol et | |
| try left | deneme hakkı | `{count} deneme hakkı kaldı.` |
| assessment | değerlendirme | the software noun; `sınav` is the exam event, `ölçme-değerlendirme` the discipline |
| finish | Bitir | |
| settings | Ayarlar | |
| tools | araçlar | |
| toolbar | araç çubuğu | |
| panel | panel | |
| loading… | Yükleniyor… | |
| calculator | hesap makinesi | basit, bilimsel, grafik — the Turkish Casio register |
| graph | grafik | |
| coordinate plane | koordinat sistemi | the MEB math word everywhere the plane is named; `dik koordinat sistemi` is the full form, kept out of short labels |
| grid (of a graph) | ızgara | the coordinate-grid word GeoGebra Turkish shows; Excel's `kılavuz çizgileri` belongs to spreadsheets |
| graph point | nokta | `Nokta {id}` — no redundant `grafik noktası`, like audited Dutch `Punt {id}` |
| canvas | tuval | |
| periodic table | periyodik tablo | |
| element (chemistry) | element | element *names* are content data, not catalog keys |
| atomic number / atomic mass | atom numarası / atom kütlesi | spelled out for screen readers |
| electron configuration | elektron dizilimi | the MEB chemistry term, not `konfigürasyon` |
| phase | hâl | maddenin hâlleri register; values Katı / Sıvı / Gaz |
| alkali / alkaline earth metal | alkali metal / toprak alkali metal | the MEB chemistry words |
| metalloid | yarı metal | the school word, not `metaloit` |
| noble gas | soygaz | one word, as MEB chemistry writes it |
| lanthanide / actinide | lantanit / aktinit | |
| ruler | cetvel | the school drawing-and-measuring instrument |
| inches / centimeters | inç / santimetre | `inç` is the established Turkish unit word (unlike Dutch, which keeps the English) |
| protractor | iletki | the geometry-set instrument's actual name; `açıölçer` is the descriptive alternative, deliberately not used |
| degrees | derece | keep the `°` glyph |
| dictionary | sözlük | |
| picture dictionary | resimli sözlük | |
| entry (dictionary) | madde | the TDK lexicography term (`madde başı`); `{count} madde`, and a miss is `madde yok` — `girdi` is the computing word, deliberately not used |
| Spanish (language name) | İspanyolca | `İspanyolca sözlük` |
| line reader | okuma kılavuzu | the reading-guide tool; `satır okuyucu` is the calque the register rule rejects |
| reading window / frame | okuma penceresi / çerçeve | |
| magnifier | büyüteç | the school word |
| zoom in / zoom out | Yakınlaştır / Uzaklaştır | the Turkish Windows register |
| highlight(er) | Vurgula / fosforlu kalem | the action is the software verb `Vurgula`; the tool name is the school word for the highlighter pen |
| underline | altını çiz | pairs with `üstünü çiz` |
| annotate / annotation | açıklama ekle / açıklama | Adobe Acrobat Turkish register |
| theme | tema | |
| contrast | kontrast | |
| text to speech | sesli okuma | read-aloud phrasing; the TTS acronym stays out of learner-facing titles (`Sesli okuma ayarları`) |
| playback speed | okuma hızı | for reading controls |
| rewind / fast-forward | geri sar / ileri sar | |
| sign language | işaret dili | the established term (Türk İşaret Dili register) |
| audio transcript | ses transkripti | the word Teams and YouTube Turkish show |
| strike through | üstünü çiz | the exam-room strike-through action; Word Turkish's `üstü çizili` names the font state, this is the action |
| eliminate | elemek | the answer-eliminator's outcome is `elendi` |
| choice (answer option) | seçenek | |
| teacher | öğretmen | |
| accommodation (PNP) | uyarlama | the special-education framework word; `uyum` is the broader adaptation, deliberately not used |
| district (PNP) | ilçe | the MEB administrative unit |
| test administration | sınav uygulama | `sınav uygulama politikası`, not `test administrasyonu` |
| toolkit (the package, in prose) | araç takımı | naturalized; code identifiers (`assessment`, `updateAssessment(...)`, `requiredTools`) stay verbatim |
| provider | sağlayıcı | the Turkish Windows term, naturalized like audited Dutch `Aanbieder` |
| service | hizmet | the Turkish word, not the `servis` loanword |
| controls (UI) | denetim | the Turkish Windows term (`okuma denetimleri`), not `kontroller` |
| pixels | piksel | |
| snapshot | anlık görüntü | |
| controller | denetleyici | |
| instrumentation | izleme | the telemetry records of the debug panels; `enstrümantasyon` stays out |
| timestamp | zaman damgası | |
| resize | yeniden boyutlandır | one verb everywhere, not `ölçüsünü değiştir` calques |
| enabled / disabled | Açık / Kapalı | toggle-state pair, matching `common.off`; not `Etkinleşmiş` descriptions — the audited-Dutch lesson |
| author (mode beside preview) | Düzenleme | the authoring mode, not `Yazar` the person — the audited-Dutch lesson |
| host (dev strings) | host | keep Latin `host` in developer panels; `konak`/`ana makine` read as machines |
| read-only | salt okunur | the established file-system term |

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz, SSML tags named in prose
(`emphasis`). Turkish suffixes may attach to them with an apostrophe
(`SSML'yi`).

## Plurals, punctuation

- CLDR categories `one`/`other`, both carried explicitly on all six plural
  groups. **After a numeral Turkish nouns stay singular** (`2 deneme hakkı`,
  `5 ses`), so the two categories carry the same authored text — that is the
  correct Turkish rendering, not an omission; `{count}` is present in both.
- Arabic numerals everywhere (`{count}`, `{position}`, `{degrees}` render as
  digits).
- Quotes are the curly `“”`; the `…` ellipsis and the `°` glyph are kept.
- Turkish is LTR; nothing here overrides direction.

## A11y strings

Keys ending `A11y` are screen-reader operating instructions. Author them as
complete, self-sufficient sentences — the learner hears them without seeing
the layout — and keep every keyboard instruction concrete. Latin key names
stay in Latin, as Turkish keyboards label them: Shift, PageUp, PageDown,
Escape, +/-, U. Arrow keys are `ok tuşları`, the name Turkish keyboards and
Turkish Windows print.
