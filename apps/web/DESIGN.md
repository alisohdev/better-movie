---
name: "Frame (working name)"
description: "Quiet film discovery with readable preferences and original geometric artwork."
colors:
  ink: "#101c2b"
  surface: "#172535"
  surface-raised: "#203143"
  paper: "#eeeade"
  muted: "#abb7c5"
  subtle: "#96a7ba"
  line: "#354558"
  coral: "#e8aa96"
  accent-ink: "#271e1d"
  score-gold: "#e8c988"
typography:
  display: { fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif', fontSize: "clamp(43px, 4.5vw, 67px)", fontWeight: 560, lineHeight: 1.12, letterSpacing: "-.035em" }
  headline: { fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif', fontSize: "23px", fontWeight: 560, lineHeight: 1.4, letterSpacing: "-.015em" }
  body: { fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif' }
rounded:
  tag: "4px"
  control: "5px"
  poster: "6px"
  panel: "8px"
spacing:
  compact: "8px"
  inline: "12px"
  group: "20px"
components:
  button-primary: { backgroundColor: "{colors.coral}", textColor: "{colors.accent-ink}", rounded: "{rounded.control}", padding: "10px 14px" }
  button-secondary: { textColor: "{colors.paper}", rounded: "{rounded.control}", padding: "10px 13px" }
  button-text: { textColor: "{colors.coral}", padding: "4px 0" }
  input-range: { backgroundColor: "{colors.surface}", textColor: "{colors.paper}", rounded: "{rounded.control}", padding: "8px 10px", height: "44px" }
  chip-genre: { textColor: "{colors.muted}", rounded: "{rounded.control}", padding: "6px 10px" }
  chip-genre-selected: { backgroundColor: "{colors.coral}", textColor: "{colors.accent-ink}", rounded: "{rounded.control}", padding: "6px 10px" }
  chip-active: { backgroundColor: "{colors.surface-raised}", textColor: "{colors.coral}", rounded: "{rounded.tag}", padding: "4px 10px" }
  movie-poster: { backgroundColor: "{colors.surface-raised}", rounded: "{rounded.poster}" }
---

# Design System: Frame

## Overview

**Creative North Star: "Turn constraints into a film choice."**

A quiet cinematic interface gives preferences, film choices, and their evidence clear places to live. Ink navy and warm paper form the reading surface; muted coral marks actions and selection. Original geometric posters supply the strongest variation in color and composition.

Frame remains a reversible working name. This app-scoped record reflects the shared stylesheet, shell, discovery controls, film cards, and local poster generator. Accessible controls, readable evidence, and honest unknown states constrain future screens.

**Key Characteristics:**

- Dark reading surfaces with warm text and restrained coral emphasis.
- Flat tonal layers, thin dividers, and compact softened corners.
- Original portrait artwork and controls that respect English LTR and Persian RTL.

## Colors

Frontmatter owns the reusable color values. Artwork retains its own varied palettes.

### Primary

Muted Coral marks primary actions, included genres, links, focus, and small accents. Accent Ink supplies dark text on coral fills.

**The Selection Coral Rule.** Use coral for actionable emphasis, included selection, and focus. Preserve a separate visible treatment for exclusions.

### Secondary

Score Gold identifies rating stars in cards and film detail evidence.

### Neutral

Ink Navy is the page background. Surface fills fields, feedback, and evidence containers; Raised Surface supports active-filter chips and reserved poster space. Warm Paper carries primary text, Muted Slate carries descriptions and metadata, Subtle Slate carries supporting notes, and Divider Slate separates regions and fields.

## Typography

Display, body, and controls share the local system font stack. Hierarchy uses scale and moderate weight; no downloaded font is required. Display serves the discovery headline; Headline serves results. Secondary headings are smaller. Prose has generous leading, and detail synopsis text is bounded to (66ch). No fixed scale ratio is established.

**The Script Room Rule.** Persian headings remove letter spacing and use expanded line height (1.6). Preserve automatic direction for mixed film titles and LTR direction for numeric ranges.

The current compact utility sizes remain observations rather than a reusable body-text scale.

## Layout

The centered container is capped at (1416px). Its total horizontal inset and result grid adapt together:

| Viewport | Total inset | Discovery results |
| --- | --- | --- |
| Above 1180px | 96px | Four columns beside the preferences rail |
| 901–1180px | 64px | Three columns beside the rail |
| 681–900px | 48px | Two columns beside the rail |
| Up to 680px | 40px | Two columns below a preferences disclosure |

Desktop preferences stick at a top offset (24px). The rail narrows from (238px) to (215px), then (190px); very wide screens use (250px). Mobile returns it to document flow and places range groups in a two-column form. Film details stack below the same mobile breakpoint. Posters reserve an aspect ratio (2:3). Repeated small gaps and group spacing are recorded in frontmatter; larger spacing remains contextual.

## Elevation & Depth

The interface has no box-shadow vocabulary. Tones, one-pixel dividers, and space establish depth.

**The Flat Surface Rule.** Separate interface regions with tone, thin borders, and space. Reserve bright compositional contrast for the artwork and meaningful control states.

## Shapes

Controls use compact softened corners, posters use the next corner step, and feedback panels use the largest. Active-filter chips and score badges use the smallest. Circles serve indicators, counts, and the decorative poster affordance. Arches, circles, diagonals, and silhouettes belong naturally to the original geometric artwork.

## Components

### Buttons

Primary actions use coral with dark text; secondary actions use a thin border; text actions use an underline. Minimum hit height is (44px). Hover lightens primary fills or emphasizes secondary borders and text. Keyboard focus uses a coral outline (2px) with an offset (5px). Disabled buttons reduce opacity while retaining shape.

### Chips

Genre choices wrap and retain native checkboxes. Unselected chips use muted text and a thin border; included selections use coral; exclusions use a separate rose treatment and explicit wording. Compact labels retain interactive height (44px). Active-filter chips use the raised tone and an accessible remove action.

### Cards / Containers

Film cards rest directly on the page. Clipped posters hold a score or explicit unscored label. Titles, year/runtime, and genres stay outside the artwork. Hover brightens the image and emphasizes the title. The decorative open affordance also appears on keyboard focus. Feedback and empty-result containers use the surface tone and panel corner.

### Inputs / Fields

Range fields and the native sort control use a surface fill, thin border, warm text, and control corners. Preserve visible labels, adjacent units, numeric input behavior, and LTR values in both locales. Errors remain beside the range group. An empty field and an unknown catalog value keep distinct meanings.

### Navigation

A quiet masthead pairs the provisional wordmark with discovery and locale navigation. A coral bottom rule marks discovery; locale hover brightens muted text. Mobile shortens the header, and narrower screens drop its optional supporting phrase. Starting recipes remain literal text rows with thin separators and a coral direction mark.

## Do's and Don'ts

### Do:

- **Do** reserve portrait space for original geometric posters.
- **Do** preserve visible labels, coral keyboard focus, and minimum hit heights.
- **Do** use logical start/end spacing and script-specific heading treatment.
- **Do** keep synthetic labels and unknown values visible alongside film information.
- **Do** honor reduced motion by removing animation and transitions.

### Don't:

- **Don't** communicate inclusion or exclusion through color alone.
- **Don't** place essential film information behind a hover-only affordance.
- **Don't** replace uncertain film values with fabricated scores, dates, or runtimes.
- **Don't** promote compact utility text into the default size for new prose.
