# Official WCAG Sources

This document lists the W3C/WAI sources the library cites. A statement backed by
one of them is either a requirement of the standard or official explanatory
guidance; anything else is project interpretation.

## Normative Standard

| Source | Type | Use it for |
| --- | --- | --- |
| [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/wcag22/) | Normative standard | The authoritative source for success criteria, conformance language, and scope. |

## Official Supporting Guidance

| Source | Type | Use it for |
| --- | --- | --- |
| [How to Meet WCAG 2.2 (Quick Reference)](https://www.w3.org/WAI/WCAG22/quickref/) | Official supporting guidance | Fast criterion lookup, filtering by level, and links to techniques. |
| [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/) | Official supporting guidance | Plain-language explanations of each success criterion and its intent. |
| [Techniques for WCAG 2.2](https://www.w3.org/WAI/WCAG22/Techniques) | Official supporting guidance | Example ways to satisfy criteria. Techniques are informative: a sufficient technique is one way to meet a criterion, and no technique is required. |

## Evaluation Guidance

| Source | Type | Use it for |
| --- | --- | --- |
| [Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/) | Official supporting guidance | The WAI overview of evaluation resources and what evaluation tools can and cannot do. |
| [Easy Checks - A First Review of Web Accessibility](https://www.w3.org/WAI/test-evaluate/preliminary/) | Official supporting guidance | Quick first-pass checks before deeper review. |
| [WCAG-EM Overview: Website Accessibility Conformance Evaluation Methodology](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/) | Official supporting guidance | A structured methodology for scoping, sampling, evaluating, and reporting conformance work. |
| [About ACT Rules](https://www.w3.org/WAI/standards-guidelines/act/rules/about/) | Official supporting guidance | Consistency guidance for test rules and partial checks. Useful for tool builders and advanced evaluation workflows. |

## ARIA And Widget Guidance

| Source | Type | Use it for |
| --- | --- | --- |
| [ARIA Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/) | Official supporting guidance | Pattern and practice guidance for accessible widgets and interaction models. |
| [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/) | Official supporting guidance | Modal dialog focus behavior, keyboard expectations, labeling, and `aria-modal` cautions. |
| [Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) | Official supporting guidance | Grouped-control semantics, arrow-key navigation, and toolbar labeling. |
| [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) | Official supporting guidance | Semantics and keyboard behavior for adjustable split panes. |
| [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/) | Official supporting guidance | How to use landmarks and labels so assistive technology can navigate page structure. |
| [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) | Official supporting guidance | How to provide accessible names and descriptions for controls and regions. |
| [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Official supporting guidance | Shared keyboard interaction principles across widgets. |

## Source Selection

| Source | Answers |
| --- | --- |
| WCAG 2.2 | Whether something is required for conformance, the exact success criterion language, and its level (A or AA) |
| Quick Reference | Which criteria apply to an issue, the official lookup page for a criterion, and which techniques and failures to inspect next |
| Understanding WCAG | What problem a criterion prevents, how broad it is, and which examples and edge cases matter |
| APG | How a widget behaves for keyboard users, which ARIA role or labeling pattern fits, and where focus goes inside a dialog, toolbar or splitter |
| WAI evaluation resources | What a credible review process looks like, how automated and manual checks combine, and how to scope and report a conformance-style review |

## Project Rule

Project guidance cites these official sources first, then adds an explicit `In this project` interpretation. It never restates a standard from memory.
