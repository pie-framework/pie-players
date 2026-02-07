# QTI 3.0 Paired Passages - Grade 6-8 ELA Example

## Overview

This document provides a complete, realistic example of paired passages for a Grade 6-8 English Language Arts assessment using the PIE item format. The example demonstrates two different approaches for implementing paired passages in QTI 3.0:

- **Option 1**: Embedded content (recommended for adaptive assessments like Star)
- **Option 2**: Single-section assessment with stimulus references (for traditional assessments with reusable content)

**Note**: This document uses the **PIE-native structure** where rubricBlocks contain `passage` objects (PassageEntity) with `config.markup`, not plain HTML strings in a `content` property. This aligns with the PIE ecosystem and allows passages to be rendered using the same PIE player infrastructure as items.

A working implementation of this example can be found in `packages/section-player/demos/paired-passages-urban-gardens.html`.

## Assessment Context

**Subject**: English Language Arts
**Grade Level**: 6-8
**Standard**: CCSS.ELA-LITERACY.RI.7.6 (Determine an author's point of view or purpose in a text)
**Topic**: Perspectives on Urban Gardens
**Format**: Paired passages with comprehension questions

## Content Overview

### Passage 1: "The Benefits of Urban Gardening"
An informational article from a community gardening advocate discussing the positive impacts of urban gardens on neighborhoods, including fresh produce access, community building, and environmental benefits.

**Word Count**: ~280 words
**Reading Level**: Lexile 950L (Grade 6-7)
**Perspective**: Supportive/Promotional

### Passage 2: "Urban Gardens: Challenges and Limitations"
An editorial from a city planner examining the practical challenges of urban gardening, including space constraints, maintenance costs, and questions about long-term sustainability.

**Word Count**: ~270 words
**Reading Level**: Lexile 980L (Grade 7-8)
**Perspective**: Skeptical/Analytical

### Assessment Items

Four multiple-choice questions that require students to:
1. Identify the main idea of Passage 1
2. Determine the author's purpose in Passage 2
3. Compare the perspectives of both authors
4. Synthesize information from both passages

---

# Option 1: Embedded Content (Recommended for Star)

This approach embeds all content directly in the section, making it self-contained and ideal for adaptive assessments.

```json
{
  "identifier": "paired-passages-urban-gardens",
  "title": "Urban Gardens: Different Perspectives",
  "keepTogether": true,
  "visible": true,
  "required": false,

  "rubricBlocks": [
    {
      "id": "instructions",
      "view": "candidate",
      "use": "instructions",
      "passage": {
        "id": "inst-001",
        "name": "Directions",
        "baseId": "inst-001",
        "version": { "major": 1, "minor": 0, "patch": 0 },
        "config": {
          "markup": "<div class=\"instructions\"><h3>Directions</h3><p>Read both passages carefully. Then answer the questions that follow. You may look back at the passages as often as you need.</p></div>",
          "elements": {},
          "models": []
        }
      }
    },
    {
      "id": "passage-benefits",
      "view": "candidate",
      "use": "passage",
      "passage": {
        "id": "passage-benefits-urban-gardening",
        "name": "The Benefits of Urban Gardening",
        "baseId": "passage-benefits",
        "version": { "major": 1, "minor": 0, "patch": 0 },
        "config": {
          "markup": "<div class=\"paired-passage\" data-group=\"urban-gardens-pair\" data-order=\"1\" data-display=\"tabs\"><h2>The Benefits of Urban Gardening</h2><p class=\"byline\">By Maria Santos, Community Garden Coordinator</p><p>When empty lots transform into thriving gardens, entire neighborhoods change for the better. Urban gardens are sprouting up in cities across America, and they're bringing more than just fresh vegetables to our communities.</p><p>First, urban gardens provide access to healthy, affordable food in neighborhoods that often lack grocery stores. Families can grow tomatoes, lettuce, and herbs right in their own backyards or shared community spaces. This fresh produce is not only nutritious but also costs far less than store-bought alternatives.</p><p>Second, these gardens bring people together. Neighbors who might never have spoken now work side-by-side, sharing gardening tips and recipes. Children learn where food comes from and develop an appreciation for nature. One community garden in Chicago even started a weekly harvest potluck, creating friendships that extend far beyond the garden gates.</p><p>Urban gardens also benefit the environment. They reduce urban heat by providing green spaces in concrete-heavy neighborhoods. Plants absorb rainwater, preventing flooding and reducing pollution runoff. Gardens even attract beneficial insects like bees and butterflies, supporting urban biodiversity.</p><p>Perhaps most importantly, urban gardens give residents ownership of their neighborhoods. When people invest time in creating something beautiful and productive, they develop pride in their community. Empty lots that once collected trash become sources of food, friendship, and hope.</p><p>The benefits of urban gardening extend far beyond the garden plot. They represent a grassroots movement toward healthier, more connected, and more sustainable cities.</p></div>",
          "elements": {},
          "models": []
        }
      }
    },
    {
      "id": "passage-challenges",
      "view": "candidate",
      "use": "passage",
      "passage": {
        "id": "passage-challenges-urban-gardening",
        "name": "Urban Gardens: Challenges and Limitations",
        "baseId": "passage-challenges",
        "version": { "major": 1, "minor": 0, "patch": 0 },
        "config": {
          "markup": "<div class=\"paired-passage\" data-group=\"urban-gardens-pair\" data-order=\"2\" data-display=\"tabs\"><h2>Urban Gardens: Challenges and Limitations</h2><p class=\"byline\">By David Chen, Urban Planning Consultant</p><p>While urban gardens have gained popularity in recent years, we must carefully examine whether they represent a practical solution to food access and community development challenges in our cities.</p><p>The first concern is space. Cities face intense competition for land. Every plot used for a garden could instead house affordable apartments, serve as a playground, or provide parking. In densely populated areas, dedicating valuable real estate to gardens may not be the most efficient use of limited space. A single community garden might produce enough vegetables for twenty families, but that same land could provide housing for two hundred people.</p><p>Maintenance presents another significant challenge. Gardens require consistent care: watering, weeding, pest control, and seasonal planting. When initial enthusiasm fades, gardens often fall into neglect. Abandoned plots become eyesores and can even pose safety concerns. Cities must consider who will maintain these spaces long-term and who will fund the water, tools, and infrastructure needed to sustain them.</p><p>Economic viability is also questionable. While advocates celebrate fresh produce, urban gardens typically produce far less food than traditional farms. The cost per pound of vegetables, when factoring in land value, water, materials, and labor, often exceeds supermarket prices. For addressing food insecurity, investing in transportation to existing grocery stores or supporting rural farmers might prove more cost-effective.</p><p>Finally, we must ask whether urban gardens truly build lasting community connections or simply attract people who are already environmentally conscious and socially engaged. Without intentional outreach and inclusive programming, gardens may primarily serve those with time, resources, and gardening knowledge.</p><p>Urban gardens may offer value, but city planners must weigh their benefits against limitations and consider whether other interventions might better serve community needs.</p></div>",
          "elements": {},
          "models": []
        }
      }
    }
  ],

  "assessmentItemRefs": [
    {
      "identifier": "q1-main-idea-passage1",
      "itemVId": "item-urban-gardens-001",
      "title": "Question 1",
      "required": true,
      "item": {
        "id": "item-urban-gardens-001",
        "config": {
          "markup": "<multiple-choice id=\"q1\"></multiple-choice>",
          "elements": {
            "multiple-choice": "@pie-element/multiple-choice@latest"
          },
          "models": [
            {
              "id": "q1",
              "element": "multiple-choice",
              "prompt": "<p><strong>Question 1:</strong> What is the main idea of Passage 1, \"The Benefits of Urban Gardening\"?</p>",
              "choiceMode": "radio",
              "keyMode": "none",
              "lockChoiceOrder": false,
              "choices": [
                {
                  "label": "A",
                  "value": "choice-a",
                  "content": "<p>Urban gardens help reduce flooding in cities.</p>",
                  "correct": false,
                  "rationale": "<p>While the passage mentions that plants absorb rainwater and prevent flooding, this is only one benefit among many, not the main idea.</p>"
                },
                {
                  "label": "B",
                  "value": "choice-b",
                  "content": "<p>Urban gardens improve neighborhoods in multiple important ways.</p>",
                  "correct": true,
                  "rationale": "<p>The passage describes several ways urban gardens benefit communities: providing food access, bringing people together, helping the environment, and giving residents ownership of their neighborhoods. This is the main idea.</p>"
                },
                {
                  "label": "C",
                  "value": "choice-c",
                  "content": "<p>Community gardens are more popular in Chicago than other cities.</p>",
                  "correct": false,
                  "rationale": "<p>Chicago is mentioned as one example, but the passage is about urban gardens across America, not specifically about Chicago's popularity.</p>"
                },
                {
                  "label": "D",
                  "value": "choice-d",
                  "content": "<p>Growing vegetables at home costs less than buying them at stores.</p>",
                  "correct": false,
                  "rationale": "<p>This is mentioned as one benefit, but it's a supporting detail, not the main idea of the entire passage.</p>"
                }
              ]
            }
          ]
        }
      }
    },
    {
      "identifier": "q2-author-purpose-passage2",
      "itemVId": "item-urban-gardens-002",
      "title": "Question 2",
      "required": true,
      "item": {
        "id": "item-urban-gardens-002",
        "config": {
          "markup": "<multiple-choice id=\"q2\"></multiple-choice>",
          "elements": {
            "multiple-choice": "@pie-element/multiple-choice@latest"
          },
          "models": [
            {
              "id": "q2",
              "element": "multiple-choice",
              "prompt": "<p><strong>Question 2:</strong> What is the author's main purpose in Passage 2, \"Urban Gardens: Challenges and Limitations\"?</p>",
              "choiceMode": "radio",
              "keyMode": "none",
              "lockChoiceOrder": false,
              "choices": [
                {
                  "label": "A",
                  "value": "choice-a",
                  "content": "<p>To argue that urban gardens should be completely banned in cities.</p>",
                  "correct": false,
                  "rationale": "<p>The author raises questions and concerns but doesn't argue for banning urban gardens. The conclusion states that gardens \"may offer value.\"</p>"
                },
                {
                  "label": "B",
                  "value": "choice-b",
                  "content": "<p>To explain how to maintain a successful community garden.</p>",
                  "correct": false,
                  "rationale": "<p>The passage discusses maintenance challenges but doesn't provide instructions or advice on how to maintain gardens successfully.</p>"
                },
                {
                  "label": "C",
                  "value": "choice-c",
                  "content": "<p>To raise questions about whether urban gardens are the best solution for cities.</p>",
                  "correct": true,
                  "rationale": "<p>Throughout the passage, the author presents concerns about space, maintenance, economic viability, and community impact, encouraging readers to \"carefully examine\" whether urban gardens are practical solutions. This questioning approach is the main purpose.</p>"
                },
                {
                  "label": "D",
                  "value": "choice-d",
                  "content": "<p>To persuade readers to volunteer at their local community garden.</p>",
                  "correct": false,
                  "rationale": "<p>The passage takes a skeptical analytical tone and doesn't encourage volunteering or participation in urban gardens.</p>"
                }
              ]
            }
          ]
        }
      }
    },
    {
      "identifier": "q3-compare-perspectives",
      "itemVId": "item-urban-gardens-003",
      "title": "Question 3",
      "required": true,
      "item": {
        "id": "item-urban-gardens-003",
        "config": {
          "markup": "<multiple-choice id=\"q3\"></multiple-choice>",
          "elements": {
            "multiple-choice": "@pie-element/multiple-choice@latest"
          },
          "models": [
            {
              "id": "q3",
              "element": "multiple-choice",
              "prompt": "<p><strong>Question 3:</strong> How do the authors' perspectives on urban gardens differ?</p>",
              "choiceMode": "radio",
              "keyMode": "none",
              "lockChoiceOrder": false,
              "choices": [
                {
                  "label": "A",
                  "value": "choice-a",
                  "content": "<p>The author of Passage 1 focuses on benefits while the author of Passage 2 examines potential drawbacks.</p>",
                  "correct": true,
                  "rationale": "<p>Passage 1 presents urban gardens positively, highlighting benefits like food access, community building, and environmental impact. Passage 2 takes a more critical view, examining challenges like space constraints, maintenance costs, and economic viability. This contrast in perspective is the key difference.</p>"
                },
                {
                  "label": "B",
                  "value": "choice-b",
                  "content": "<p>The author of Passage 1 writes about Chicago while the author of Passage 2 writes about rural areas.</p>",
                  "correct": false,
                  "rationale": "<p>Both passages are about urban gardens in cities. Chicago is mentioned briefly in Passage 1 as one example, and Passage 2 mentions rural farms for comparison but focuses on urban contexts.</p>"
                },
                {
                  "label": "C",
                  "value": "choice-c",
                  "content": "<p>The author of Passage 1 opposes urban gardens while the author of Passage 2 supports them.</p>",
                  "correct": false,
                  "rationale": "<p>This is backwards. Passage 1 supports urban gardens while Passage 2 raises questions about them.</p>"
                },
                {
                  "label": "D",
                  "value": "choice-d",
                  "content": "<p>Both authors agree that urban gardens are too expensive to maintain.</p>",
                  "correct": false,
                  "rationale": "<p>Only Passage 2 raises concerns about cost. Passage 1 doesn't discuss expense or agree with this viewpoint.</p>"
                }
              ]
            }
          ]
        }
      }
    },
    {
      "identifier": "q4-synthesize-both",
      "itemVId": "item-urban-gardens-004",
      "title": "Question 4",
      "required": true,
      "item": {
        "id": "item-urban-gardens-004",
        "config": {
          "markup": "<multiple-choice id=\"q4\"></multiple-choice>",
          "elements": {
            "multiple-choice": "@pie-element/multiple-choice@latest"
          },
          "models": [
            {
              "id": "q4",
              "element": "multiple-choice",
              "prompt": "<p><strong>Question 4:</strong> Based on both passages, which statement would <em>both</em> authors most likely agree with?</p>",
              "choiceMode": "radio",
              "keyMode": "none",
              "lockChoiceOrder": false,
              "choices": [
                {
                  "label": "A",
                  "value": "choice-a",
                  "content": "<p>Urban gardens always fail because people lose interest in maintaining them.</p>",
                  "correct": false,
                  "rationale": "<p>Passage 1 describes successful gardens with ongoing community involvement. While Passage 2 mentions maintenance challenges, it doesn't say gardens always fail. The word \"always\" makes this too extreme for either author.</p>"
                },
                {
                  "label": "B",
                  "value": "choice-b",
                  "content": "<p>Urban gardens have no impact on community relationships or neighborhood pride.</p>",
                  "correct": false,
                  "rationale": "<p>Passage 1 strongly emphasizes community building and neighborhood pride. Passage 2 questions the extent of this impact but doesn't claim there's no impact at all.</p>"
                },
                {
                  "label": "C",
                  "value": "choice-c",
                  "content": "<p>Urban gardens require ongoing resources and community involvement to succeed.</p>",
                  "correct": true,
                  "rationale": "<p>Passage 1 describes people working together and investing time, implying ongoing involvement. Passage 2 explicitly discusses the need for \"consistent care,\" funding, and \"who will maintain these spaces long-term.\" Both authors would agree that gardens need sustained resources and participation.</p>"
                },
                {
                  "label": "D",
                  "value": "choice-d",
                  "content": "<p>Urban gardens produce more food per acre than traditional farms.</p>",
                  "correct": false,
                  "rationale": "<p>Passage 2 explicitly states that \"urban gardens typically produce far less food than traditional farms.\" Neither passage supports this claim.</p>"
                }
              ]
            }
          ]
        }
      }
    }
  ],

  "settings": {
    "layout": {
      "stimulusDisplay": "tabs",
      "resizable": true
    },
    "navigation": {
      "allowPrevious": true,
      "allowNext": true,
      "requireAllAnswered": false
    }
  }
}
```

---

# Option 2: Single-Section Assessment with Stimulus References

This approach defines stimuli at the assessment level and references them from the section. Useful when the same passages might be reused across multiple sections or assessments.

```json
{
  "qtiVersion": "3.0",
  "identifier": "assessment-urban-gardens-paired",
  "title": "Urban Gardens: Different Perspectives",
  "description": "Grade 6-8 ELA paired passages assessment on urban gardening perspectives",

  "stimulusRefs": [
    {
      "identifier": "passage-benefits-urban-gardening",
      "href": "/stimuli/ela-grade7-urban-gardens-benefits.html"
    },
    {
      "identifier": "passage-challenges-urban-gardening",
      "href": "/stimuli/ela-grade7-urban-gardens-challenges.html"
    }
  ],

  "testParts": [
    {
      "identifier": "part-1",
      "navigationMode": "nonlinear",
      "submissionMode": "individual",
      "sections": [
        {
          "identifier": "section-paired-passages",
          "title": "Urban Gardens: Different Perspectives",
          "keepTogether": true,
          "visible": true,
          "required": false,

          "rubricBlocks": [
            {
              "id": "instructions",
              "view": "candidate",
              "use": "instructions",
              "content": "<div class=\"instructions\"><h3>Directions</h3><p>Read both passages carefully. Then answer the questions that follow. You may look back at the passages as often as you need.</p></div>"
            },
            {
              "id": "passage-1-ref",
              "view": "candidate",
              "use": "passage",
              "stimulusRef": {
                "identifier": "passage-benefits-urban-gardening",
                "href": "/stimuli/ela-grade7-urban-gardens-benefits.html"
              }
            },
            {
              "id": "passage-2-ref",
              "view": "candidate",
              "use": "passage",
              "stimulusRef": {
                "identifier": "passage-challenges-urban-gardening",
                "href": "/stimuli/ela-grade7-urban-gardens-challenges.html"
              }
            }
          ],

          "assessmentItemRefs": [
            {
              "identifier": "q1-main-idea-passage1",
              "itemVId": "item-urban-gardens-001",
              "title": "Question 1",
              "required": true,
              "item": {
                "id": "item-urban-gardens-001",
                "config": {
                  "markup": "<multiple-choice id=\"q1\"></multiple-choice>",
                  "elements": {
                    "multiple-choice": "@pie-element/multiple-choice@latest"
                  },
                  "models": [
                    {
                      "id": "q1",
                      "element": "multiple-choice",
                      "prompt": "<p><strong>Question 1:</strong> What is the main idea of Passage 1, \"The Benefits of Urban Gardening\"?</p>",
                      "choiceMode": "radio",
                      "keyMode": "none",
                      "lockChoiceOrder": false,
                      "choices": [
                        {
                          "label": "A",
                          "value": "choice-a",
                          "content": "<p>Urban gardens help reduce flooding in cities.</p>",
                          "correct": false,
                          "rationale": "<p>While the passage mentions that plants absorb rainwater and prevent flooding, this is only one benefit among many, not the main idea.</p>"
                        },
                        {
                          "label": "B",
                          "value": "choice-b",
                          "content": "<p>Urban gardens improve neighborhoods in multiple important ways.</p>",
                          "correct": true,
                          "rationale": "<p>The passage describes several ways urban gardens benefit communities: providing food access, bringing people together, helping the environment, and giving residents ownership of their neighborhoods. This is the main idea.</p>"
                        },
                        {
                          "label": "C",
                          "value": "choice-c",
                          "content": "<p>Community gardens are more popular in Chicago than other cities.</p>",
                          "correct": false,
                          "rationale": "<p>Chicago is mentioned as one example, but the passage is about urban gardens across America, not specifically about Chicago's popularity.</p>"
                        },
                        {
                          "label": "D",
                          "value": "choice-d",
                          "content": "<p>Growing vegetables at home costs less than buying them at stores.</p>",
                          "correct": false,
                          "rationale": "<p>This is mentioned as one benefit, but it's a supporting detail, not the main idea of the entire passage.</p>"
                        }
                      ]
                    }
                  ]
                }
              }
            },
            {
              "identifier": "q2-author-purpose-passage2",
              "itemVId": "item-urban-gardens-002",
              "title": "Question 2",
              "required": true,
              "item": {
                "id": "item-urban-gardens-002",
                "config": {
                  "markup": "<multiple-choice id=\"q2\"></multiple-choice>",
                  "elements": {
                    "multiple-choice": "@pie-element/multiple-choice@latest"
                  },
                  "models": [
                    {
                      "id": "q2",
                      "element": "multiple-choice",
                      "prompt": "<p><strong>Question 2:</strong> What is the author's main purpose in Passage 2, \"Urban Gardens: Challenges and Limitations\"?</p>",
                      "choiceMode": "radio",
                      "keyMode": "none",
                      "lockChoiceOrder": false,
                      "choices": [
                        {
                          "label": "A",
                          "value": "choice-a",
                          "content": "<p>To argue that urban gardens should be completely banned in cities.</p>",
                          "correct": false,
                          "rationale": "<p>The author raises questions and concerns but doesn't argue for banning urban gardens. The conclusion states that gardens \"may offer value.\"</p>"
                        },
                        {
                          "label": "B",
                          "value": "choice-b",
                          "content": "<p>To explain how to maintain a successful community garden.</p>",
                          "correct": false,
                          "rationale": "<p>The passage discusses maintenance challenges but doesn't provide instructions or advice on how to maintain gardens successfully.</p>"
                        },
                        {
                          "label": "C",
                          "value": "choice-c",
                          "content": "<p>To raise questions about whether urban gardens are the best solution for cities.</p>",
                          "correct": true,
                          "rationale": "<p>Throughout the passage, the author presents concerns about space, maintenance, economic viability, and community impact, encouraging readers to \"carefully examine\" whether urban gardens are practical solutions. This questioning approach is the main purpose.</p>"
                        },
                        {
                          "label": "D",
                          "value": "choice-d",
                          "content": "<p>To persuade readers to volunteer at their local community garden.</p>",
                          "correct": false,
                          "rationale": "<p>The passage takes a skeptical analytical tone and doesn't encourage volunteering or participation in urban gardens.</p>"
                        }
                      ]
                    }
                  ]
                }
              }
            },
            {
              "identifier": "q3-compare-perspectives",
              "itemVId": "item-urban-gardens-003",
              "title": "Question 3",
              "required": true,
              "item": {
                "id": "item-urban-gardens-003",
                "config": {
                  "markup": "<multiple-choice id=\"q3\"></multiple-choice>",
                  "elements": {
                    "multiple-choice": "@pie-element/multiple-choice@latest"
                  },
                  "models": [
                    {
                      "id": "q3",
                      "element": "multiple-choice",
                      "prompt": "<p><strong>Question 3:</strong> How do the authors' perspectives on urban gardens differ?</p>",
                      "choiceMode": "radio",
                      "keyMode": "none",
                      "lockChoiceOrder": false,
                      "choices": [
                        {
                          "label": "A",
                          "value": "choice-a",
                          "content": "<p>The author of Passage 1 focuses on benefits while the author of Passage 2 examines potential drawbacks.</p>",
                          "correct": true,
                          "rationale": "<p>Passage 1 presents urban gardens positively, highlighting benefits like food access, community building, and environmental impact. Passage 2 takes a more critical view, examining challenges like space constraints, maintenance costs, and economic viability. This contrast in perspective is the key difference.</p>"
                        },
                        {
                          "label": "B",
                          "value": "choice-b",
                          "content": "<p>The author of Passage 1 writes about Chicago while the author of Passage 2 writes about rural areas.</p>",
                          "correct": false,
                          "rationale": "<p>Both passages are about urban gardens in cities. Chicago is mentioned briefly in Passage 1 as one example, and Passage 2 mentions rural farms for comparison but focuses on urban contexts.</p>"
                        },
                        {
                          "label": "C",
                          "value": "choice-c",
                          "content": "<p>The author of Passage 1 opposes urban gardens while the author of Passage 2 supports them.</p>",
                          "correct": false,
                          "rationale": "<p>This is backwards. Passage 1 supports urban gardens while Passage 2 raises questions about them.</p>"
                        },
                        {
                          "label": "D",
                          "value": "choice-d",
                          "content": "<p>Both authors agree that urban gardens are too expensive to maintain.</p>",
                          "correct": false,
                          "rationale": "<p>Only Passage 2 raises concerns about cost. Passage 1 doesn't discuss expense or agree with this viewpoint.</p>"
                        }
                      ]
                    }
                  ]
                }
              }
            },
            {
              "identifier": "q4-synthesize-both",
              "itemVId": "item-urban-gardens-004",
              "title": "Question 4",
              "required": true,
              "item": {
                "id": "item-urban-gardens-004",
                "config": {
                  "markup": "<multiple-choice id=\"q4\"></multiple-choice>",
                  "elements": {
                    "multiple-choice": "@pie-element/multiple-choice@latest"
                  },
                  "models": [
                    {
                      "id": "q4",
                      "element": "multiple-choice",
                      "prompt": "<p><strong>Question 4:</strong> Based on both passages, which statement would <em>both</em> authors most likely agree with?</p>",
                      "choiceMode": "radio",
                      "keyMode": "none",
                      "lockChoiceOrder": false,
                      "choices": [
                        {
                          "label": "A",
                          "value": "choice-a",
                          "content": "<p>Urban gardens always fail because people lose interest in maintaining them.</p>",
                          "correct": false,
                          "rationale": "<p>Passage 1 describes successful gardens with ongoing community involvement. While Passage 2 mentions maintenance challenges, it doesn't say gardens always fail. The word \"always\" makes this too extreme for either author.</p>"
                        },
                        {
                          "label": "B",
                          "value": "choice-b",
                          "content": "<p>Urban gardens have no impact on community relationships or neighborhood pride.</p>",
                          "correct": false,
                          "rationale": "<p>Passage 1 strongly emphasizes community building and neighborhood pride. Passage 2 questions the extent of this impact but doesn't claim there's no impact at all.</p>"
                        },
                        {
                          "label": "C",
                          "value": "choice-c",
                          "content": "<p>Urban gardens require ongoing resources and community involvement to succeed.</p>",
                          "correct": true,
                          "rationale": "<p>Passage 1 describes people working together and investing time, implying ongoing involvement. Passage 2 explicitly discusses the need for \"consistent care,\" funding, and \"who will maintain these spaces long-term.\" Both authors would agree that gardens need sustained resources and participation.</p>"
                        },
                        {
                          "label": "D",
                          "value": "choice-d",
                          "content": "<p>Urban gardens produce more food per acre than traditional farms.</p>",
                          "correct": false,
                          "rationale": "<p>Passage 2 explicitly states that \"urban gardens typically produce far less food than traditional farms.\" Neither passage supports this claim.</p>"
                        }
                      ]
                    }
                  ]
                }
              }
            }
          ],

          "settings": {
            "layout": {
              "stimulusDisplay": "tabs",
              "resizable": true
            },
            "navigation": {
              "allowPrevious": true,
              "allowNext": true,
              "requireAllAnswered": false
            }
          }
        }
      ]
    }
  ],

  "settings": {
    "testAdministration": {
      "mode": "test"
    }
  }
}
```

## Stimulus Files (for Option 2)

### File: `/stimuli/ela-grade7-urban-gardens-benefits.html`

```html
<div class="paired-passage" data-group="urban-gardens-pair" data-order="1" data-display="tabs">
  <h2>The Benefits of Urban Gardening</h2>
  <p class="byline">By Maria Santos, Community Garden Coordinator</p>

  <p>When empty lots transform into thriving gardens, entire neighborhoods change for the better. Urban gardens are sprouting up in cities across America, and they're bringing more than just fresh vegetables to our communities.</p>

  <p>First, urban gardens provide access to healthy, affordable food in neighborhoods that often lack grocery stores. Families can grow tomatoes, lettuce, and herbs right in their own backyards or shared community spaces. This fresh produce is not only nutritious but also costs far less than store-bought alternatives.</p>

  <p>Second, these gardens bring people together. Neighbors who might never have spoken now work side-by-side, sharing gardening tips and recipes. Children learn where food comes from and develop an appreciation for nature. One community garden in Chicago even started a weekly harvest potluck, creating friendships that extend far beyond the garden gates.</p>

  <p>Urban gardens also benefit the environment. They reduce urban heat by providing green spaces in concrete-heavy neighborhoods. Plants absorb rainwater, preventing flooding and reducing pollution runoff. Gardens even attract beneficial insects like bees and butterflies, supporting urban biodiversity.</p>

  <p>Perhaps most importantly, urban gardens give residents ownership of their neighborhoods. When people invest time in creating something beautiful and productive, they develop pride in their community. Empty lots that once collected trash become sources of food, friendship, and hope.</p>

  <p>The benefits of urban gardening extend far beyond the garden plot. They represent a grassroots movement toward healthier, more connected, and more sustainable cities.</p>
</div>
```

### File: `/stimuli/ela-grade7-urban-gardens-challenges.html`

```html
<div class="paired-passage" data-group="urban-gardens-pair" data-order="2" data-display="tabs">
  <h2>Urban Gardens: Challenges and Limitations</h2>
  <p class="byline">By David Chen, Urban Planning Consultant</p>

  <p>While urban gardens have gained popularity in recent years, we must carefully examine whether they represent a practical solution to food access and community development challenges in our cities.</p>

  <p>The first concern is space. Cities face intense competition for land. Every plot used for a garden could instead house affordable apartments, serve as a playground, or provide parking. In densely populated areas, dedicating valuable real estate to gardens may not be the most efficient use of limited space. A single community garden might produce enough vegetables for twenty families, but that same land could provide housing for two hundred people.</p>

  <p>Maintenance presents another significant challenge. Gardens require consistent care: watering, weeding, pest control, and seasonal planting. When initial enthusiasm fades, gardens often fall into neglect. Abandoned plots become eyesores and can even pose safety concerns. Cities must consider who will maintain these spaces long-term and who will fund the water, tools, and infrastructure needed to sustain them.</p>

  <p>Economic viability is also questionable. While advocates celebrate fresh produce, urban gardens typically produce far less food than traditional farms. The cost per pound of vegetables, when factoring in land value, water, materials, and labor, often exceeds supermarket prices. For addressing food insecurity, investing in transportation to existing grocery stores or supporting rural farmers might prove more cost-effective.</p>

  <p>Finally, we must ask whether urban gardens truly build lasting community connections or simply attract people who are already environmentally conscious and socially engaged. Without intentional outreach and inclusive programming, gardens may primarily serve those with time, resources, and gardening knowledge.</p>

  <p>Urban gardens may offer value, but city planners must weigh their benefits against limitations and consider whether other interventions might better serve community needs.</p>
</div>
```

---

## Comparison of Options

| Aspect | Option 1: Embedded | Option 2: Stimulus References |
|--------|-------------------|------------------------------|
| **Structure** | Content in `rubricBlocks[].content` | Content in external files, referenced via `stimulusRef` |
| **Self-contained** | ✅ Yes - everything in one section | ❌ No - requires external file resolution |
| **Reusability** | ❌ Must duplicate if used elsewhere | ✅ Define once, reference many times |
| **Best for** | Adaptive assessments (Star) | Fixed assessments with reusable content |
| **Backend complexity** | Simple - just send resolved content | More complex - manage stimulus library |
| **Frontend complexity** | Simple - just render HTML | More complex - resolve references, cache content |
| **File size** | Larger - content duplicated if reused | Smaller - references instead of full content |
| **QTI 3.0 compliant** | ✅ Yes | ✅ Yes |
| **PIE format** | ✅ Uses PIE config/models structure | ✅ Uses PIE config/models structure |

## PIE Item Structure

All items follow the PIE format with:

- **`markup`**: HTML defining which PIE elements are used
- **`elements`**: Map of element names to PIE packages (e.g., `@pie-element/multiple-choice@latest`)
- **`models`**: Array of PIE element configurations containing:
  - `id`: Element identifier (matches markup)
  - `element`: Element type (e.g., "multiple-choice")
  - `prompt`: Question text (HTML)
  - `choiceMode`: "radio" for single-select, "checkbox" for multi-select
  - `choices`: Array of answer choices with:
    - `label`: Display label (A, B, C, D)
    - `value`: Unique identifier for the choice
    - `content`: Choice text (HTML)
    - `correct`: Boolean indicating correct answer
    - `rationale`: Explanation for why choice is correct/incorrect

## Passages in Sections, Not Items

**Important**: Unlike the legacy format where items referenced passages, the QTI 3.0 approach places passages in section-level `rubricBlocks`, not at the item level. This allows:

- Multiple items to share the same passage(s)
- Paired passages to be displayed together
- Cleaner separation of stimulus from assessment items
- Better support for adaptive assessments

## Rendering Guidance

### Paired Passage Detection

The Reference Layout should detect paired passages by:

1. Scanning `rubricBlocks` for items with `use: "passage"`
2. Checking for `data-group` attribute in content HTML
3. Grouping passages with the same `data-group` value
4. Sorting by `data-order` attribute

### Display Modes

Based on `data-display` attribute or `settings.layout.stimulusDisplay`:

- **`tabs`**: Show one passage at a time with tab navigation (default)
- **`side-by-side`**: Display passages in adjacent columns (desktop only)
- **`stacked`**: Display passages vertically, one above the other
- **`collapsible`**: Accordion-style for mobile devices

### Responsive Behavior

- **Desktop (≥1024px)**: Use tabs or side-by-side layout
- **Tablet (768-1023px)**: Use tabs or stacked layout
- **Mobile (<768px)**: Use collapsible accordion layout

---

## Assessment Metadata

**Assessment ID**: `assessment-urban-gardens-paired`
**Content Standard**: CCSS.ELA-LITERACY.RI.7.6
**Difficulty**: Medium
**Time Estimate**: 15-20 minutes
**Passage 1 Lexile**: 950L
**Passage 2 Lexile**: 980L
**Question Types**: Multiple choice (4 items)
**Scoring**: 1 point per question (4 points total)

## Usage Notes

- Both options are 100% QTI 3.0 compliant
- Option 1 is recommended for Star Assessments (page-by-page delivery)
- Option 2 is recommended for traditional fixed assessments with reusable content
- All items use PIE element format with config/models structure
- HTML data attributes provide passage grouping and display hints
- All content uses semantic HTML5 markup for accessibility
- Passages are at section level in rubricBlocks, NOT at item level
