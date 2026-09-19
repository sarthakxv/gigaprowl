<!-- Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4 -->

# V1 visual tokens

This contract records the updated visual system established by `app/prototype/v1/prototype.module.css`. The prototype is the visual source for palette, typography, density, shape, elevation, and motion. Product behavior, accessibility, trust, and workflow still follow the principles, components, screens, flows, and UX audit.

Use these tokens when remediating the prototype and later migrating approved patterns into production. Do not substitute the retired mint/Inter-only direction. Do not copy prototype fixtures, in-memory state, or component architecture merely because the visual tokens originate there.

## Typography

### Families

| Token | Stack | Use |
|---|---|---|
| `font-display` | `"Greed", sans-serif` | Screen titles, onboarding display headings, fit scores, credit totals, and other deliberate numeric emphasis |
| `font-body` | `"Inter", system-ui, sans-serif` | Product UI, body copy, controls, labels, forms, and dense information |
| `font-brand` | `"Space Grotesk", sans-serif` | Gigaprowl wordmark only; not a general product heading face |
| `font-code` | `ui-monospace, SFMono-Regular, Menlo, monospace` | Prototype state inspector and genuine code/data output only |

Greed is the product display face; Inter remains the workhorse. Do not replace either family during audit remediation. Headings are roman, not italic.

### Product type roles

| Role | Family | Weight | Size / line height | Use |
|---|---|---:|---:|---|
| `display-xl` | Greed | 500 | `clamp(30px, 4vw, 44px)` / `1.05–1.10` | Primary screen and detail titles |
| `display-lg` | Greed | 500 | `30–34px` / `1.08–1.15` | Onboarding and focused workflow headings |
| `heading-2` | Inter | 600–700 | `24–30px` / `1.2–1.3` | Major regions, editors, and dialogs |
| `heading-3` | Inter | 600–700 | `16–22px` / `1.3–1.4` | Cards and subsection titles |
| `body-lg` | Inter | 400 | `15px` / `22px` | Page descriptions and prominent supporting copy |
| `body` | Inter | 400 | `13–14px` / `20px` | Standard product copy |
| `control` | Inter | 600–700 | `14px` / `20px` | Buttons, navigation, tabs, and primary field labels |
| `compact-label` | Inter | 600–700 | `11–12px` / `16px` | Short status, provenance, and metadata labels only |
| `micro` | Inter | 500–700 | `10–11px` / `14px` | Nonessential prototype/debug metadata only; never instructions, errors, or primary controls |

Uppercase plus tracking is reserved for short status, provenance, or genuine ordered-step labels. It is not a default heading treatment. Numeric clusters use `font-variant-numeric: tabular-nums` even when Greed supplies the face.

The current 9px mobile-navigation label is not an approved token. M10 in the [prototype visual audit](../no-slop-ui-report.md) tracks its replacement with a deliberate compact-navigation role that still fits five visible destinations at 320px.

## Core color roles

Use semantic names in components. Raw values live only in a theme token block. The light and dark values below are the current approved prototype palette.

| Role | Light | Dark | Use |
|---|---:|---:|---|
| `canvas` | `#F4F7FA` | `#08111A` | Application background |
| `surface` | `#FFFFFF` | `#101C27` | Cards, panels, dialogs, and primary navigation surfaces |
| `raised` | `#E8F0F6` | `#172735` | Selected, inset, hover, and secondary surfaces |
| `nav` | `#EDF3F8` | `#0C1721` | Persistent navigation background |
| `text` | `#14212B` | `#F3F7FA` | Primary text |
| `muted` | `#536674` | `#AABAC6` | Secondary text and metadata |
| `border` | `#8DA1AF` | `#587184` | Controls and strong boundaries |
| `soft-border` | `#D5E0E8` | `rgba(88, 113, 132, 0.34)` | Dividers and low-emphasis grouping |
| `brand` | `#1D63A9` | `#62B4FF` | Primary action, focus, selection, and informative accent |
| `brand-hover` | `#154D85` | `#8AC7FF` | Primary-action hover fill |
| `brand-on` | `#FFFFFF` | `#071824` | Text and icons on `brand` |
| `success` | `#187A55` | `#56D89C` | Confirmed completion and healthy state |
| `warning` | `#946000` | `#FFCA55` | Caution, uncertainty, and blocked progress |
| `warning-on` | `#FFFFFF` | `#2A1B00` | Text and icons on `warning` |
| `danger` | `#B43A3A` | `#FF8585` | Failure and destructive action |
| `info` | `#6552B8` | `#B4A2FF` | Neutral informational status distinct from the brand action colour |
| `overlay` | `rgba(6, 15, 24, 0.58)` | `rgba(2, 8, 14, 0.76)` | Modal backdrop |

Never communicate state through hue alone. Pair semantic colour with text, an icon, or both.

### Purpose-specific color roles

Provider marks, recipient previews, and the prototype inspector are legitimate distinct surfaces. They still consume named roles rather than local raw values.

| Role | Value | Use |
|---|---:|---|
| `provider-linear` / `provider-linear-surface` | `#9CA6FF` / `#242743` | Linear company mark |
| `provider-vercel` / `provider-vercel-surface` | `#FFFFFF` / `#222222` | Vercel company mark |
| `provider-posthog` / `provider-posthog-surface` | `#FFDF78` / `#362C17` | PostHog company mark |
| `provider-stripe` / `provider-stripe-surface` | `#AEB5FF` / `#28284C` | Stripe company mark |
| `preview-canvas` | `#07111B` | Recipient-facing pitch preview background |
| `preview-surface` | `#132433` | Optional raised preview region |
| `preview-border` | `#294A63` | Pitch preview boundary |
| `preview-text` | `#F3F7FA` | Primary pitch preview text |
| `preview-muted` | `#AABAC6` | Secondary pitch preview text |
| `preview-accent` | `#62B4FF` | Pitch preview action and provenance accent |
| `debug-canvas` | `#0B1621` | Prototype state inspector only |
| `debug-text` | `#F3F7FA` | State inspector text |
| `debug-code` | `#A7D5FF` | State inspector code/data |

Do not add provider or preview colours directly inside component selectors. Add or amend a named role here first.

## Contrast record

The following current pairs were measured with WCAG relative-luminance contrast:

| Pair | Light | Dark | Requirement |
|---|---:|---:|---|
| `text` on `canvas` | `15.23:1` | `17.64:1` | Passes body text |
| `muted` on `canvas` | `5.55:1` | `9.54:1` | Passes body text |
| `brand` on `canvas` | `5.73:1` | `8.59:1` | Passes text, icons, and focus |
| `brand-on` on `brand` | `6.16:1` | `8.15:1` | Passes filled actions |
| `warning-on` on `warning` | `5.34:1` | `11.02:1` | Passes filled warning actions |

These measurements do not certify every mixed or tinted surface. M11 remains open until borders, soft borders, status tints, hover states, disabled states, pitch-preview pairs, and every text-on-filled-action combination are recorded. Interactive boundaries and focus indicators require at least 3:1 against adjacent surfaces; body text requires 4.5:1.

## Spacing and density

The prototype uses compact application density. Preserve it; do not replace it with a spacious marketing-page scale.

Approved reusable spacing values:

```text
space-1     4px
space-1.5   6px
space-2     8px
space-2.5  10px
space-3    12px
space-3.5  14px
space-4    16px
space-4.5  18px
space-5    20px
space-6    24px
space-7    28px
space-8    32px
space-10   40px
space-12   48px
space-16   64px
```

Values such as 5, 7, 9, 11, 13, 22, 26, 30, 34, 36, and 42px remain in the prototype but are not automatically approved tokens. During M11 remediation, map them to the nearest named value or document a genuine optical/layout exception. Do not change the perceived compactness merely to make every number land on a coarser scale.

Layout constants:

- General content width: 1200px maximum.
- Onboarding canvas: 1180px maximum.
- Settings content: 820px maximum.
- Reading/editor content: approximately 650–800px before a supporting rail.
- Standard mobile gutter: 16px; adaptive/tablet gutter: 20–24px; wide product gutter: 40px.
- Dense surface padding: 16–20px; major card/editor padding: 20–28px; onboarding desktop padding: 34px.

## Shape and elevation

Approved radius roles:

```text
radius-xs       8px   document and compact inset surfaces
radius-control 10px   inputs, buttons, and icon controls
radius-sm      12px   alerts, menus, and compact cards
radius-md      14px   standard cards and grouped controls
radius-lg      16px   major product cards and workspace panels
radius-xl      18px   onboarding and dialogs
radius-pill    999px  compact status, count, and toggle shapes only
```

Current elevation roles:

| Role | Light | Dark | Use |
|---|---:|---:|---|
| `shadow` | `rgba(22, 41, 57, 0.12)` | `rgba(0, 0, 0, 0.24)` | Large onboarding surface and restrained floating regions |
| `shadow-strong` | `rgba(22, 41, 57, 0.24)` | `rgba(0, 0, 0, 0.52)` | Dialogs, menus, state inspector, and Undo/toast overlays |

Use borders and surface lightness for ordinary hierarchy. Shadows communicate overlay or genuine elevation. Do not create a coloured `brand` halo around primary actions; M4 tracks removal of the current prototype instance.

## Interaction tokens

- Minimum touch target: 44×44 CSS px.
- Focus ring: 2px `brand`, 2px offset, instant appearance.
- Standard state transition: 160ms ease-out.
- Complex panel/progress transition: 220ms ease-out.
- Transition properties must be named. Routine transitions are limited to `background-color`, `color`, `border-color`, `opacity`, and intentional `transform`.
- Do not animate width, height, margin, padding, top, or left.
- Views render in place. Hover uses colour or border rather than lift.
- Progress may spin or pulse only when accompanied by a textual running status.
- Under `prefers-reduced-motion: reduce`, remove spatial movement, continuous pulse, and spin; retain immediate state changes.
- Loading animation never replaces a textual progress label.

## Responsive layout

The prototype changes structure at content-driven thresholds:

```text
mobile          320–680px    16px gutters, single column, five-item bottom navigation
adaptive        681–900px    20–24px gutters, bottom navigation, stacked primary regions
compact desktop 901–1120px   left navigation, reduced multi-column layouts
wide desktop    1121px+      left navigation, 40px gutters, 1200px maximum content
```

Required outcomes at 320, 375, 414, and 768 CSS px:

- No horizontal page scrolling.
- Five navigation destinations remain visible; clickable labels remain on one line.
- Display headings use `min-width: 0` and `overflow-wrap: anywhere` where long words are possible.
- Full-height application regions use dynamic viewport units rather than `vh`.
- Layout widths use `100%`, never `100vw`.
- Image-bearing grid tracks use `minmax(0, 1fr)`.
- At 200% zoom, layouts collapse to their narrower pattern without losing content or controls.
- Editors, timelines, forms, and settings regions become single-column before their content becomes cramped.

The prototype visual audit remains the closure record for responsive, motion, state, and contrast findings. This file defines the intended system; it does not declare those implementation findings complete.
