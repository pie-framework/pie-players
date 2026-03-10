# Official WCAG Sources

This document lists the verified W3C/WAI sources that anchor this library.

Use it as the first stop whenever you need to decide whether something is:

- required by the standard
- official explanatory guidance
- project-specific interpretation

## Normative Standard

| Source | Type | Use it for |
| --- | --- | --- |
| [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/wcag22/) | Normative standard | The authoritative source for success criteria, conformance language, and scope. |

## Official Supporting Guidance

| Source | Type | Use it for |
| --- | --- | --- |
| [How to Meet WCAG 2.2 (Quick Reference)](https://www.w3.org/WAI/WCAG22/quickref/) | Official supporting guidance | Fast criterion lookup, filtering by level, and links to techniques. |
| [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/) | Official supporting guidance | Plain-language explanations of each success criterion and its intent. |
| [Techniques for WCAG 2.2](https://www.w3.org/WAI/WCAG22/Techniques) | Official supporting guidance | Example ways to satisfy criteria. Techniques are helpful, but they are not the standard itself. |

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
| [ARIA Authoring Practices Guide (APG)](https://www.w3.org/TR/wai-aria-practices-1.2/) | Official supporting guidance | Pattern and practice guidance for accessible widgets and interaction models. |
| [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/) | Official supporting guidance | Modal dialog focus behavior, keyboard expectations, labeling, and `aria-modal` cautions. |
| [Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) | Official supporting guidance | Grouped-control semantics, arrow-key navigation, and toolbar labeling. |
| [Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) | Official supporting guidance | Semantics and keyboard behavior for adjustable split panes. |
| [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/) | Official supporting guidance | How to use landmarks and labels so assistive technology can navigate page structure. |
| [Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/) | Official supporting guidance | How to provide accessible names and descriptions for controls and regions. |
| [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Official supporting guidance | Shared keyboard interaction principles across widgets. |

## How To Choose The Right Source

### Use WCAG itself when you need to answer

- Is this required for conformance?
- What is the exact success criterion language?
- Is this criterion Level A or AA?

### Use Quick Reference when you need to answer

- Which criteria apply to this issue?
- What is the fastest official lookup page for a criterion?
- Which techniques and failures should I inspect next?

### Use Understanding WCAG when you need to answer

- What problem is this criterion trying to prevent?
- How broad is the criterion?
- What kinds of examples and edge cases matter?

### Use APG when you need to answer

- How should this widget behave for keyboard users?
- What ARIA role or labeling pattern is appropriate?
- What should focus do inside a dialog, toolbar, or splitter?

### Use WAI evaluation resources when you need to answer

- What does a credible accessibility review process look like?
- How should I combine automated and manual checks?
- How should I scope and report a conformance-style review?

## Project Rule

When this repo creates its own guidance, use these official sources first and then add an explicit `In this project` interpretation rather than rewriting the standards from memory.
