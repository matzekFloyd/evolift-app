# EvoLift Brand Guidelines

This document defines the product tone and UI consistency rules for EvoLift.

## Brand positioning

- Product: simple workout logging for fast execution during training.
- Core promise: low-friction logging, clear progress, mobile-first usability.
- Personality: focused, calm, practical, no fluff.

## Voice and tone

- Keep copy short and action-oriented.
- Prefer plain language over fitness jargon.
- Use supportive, neutral feedback (not overly excited).
- Error messages should be specific and corrective.

Examples:

- Prefer: `Please enter a valid target reps value for working sets.`
- Avoid: `Oops! Something went wrong.`

## Naming and terminology

- Use `Workout session` for a completed workout record.
- Use `Exercise` for a movement inside a session.
- Use `Set` for logged reps/weight entries.
- Use `Loaded (kg)` for external loaded weight.
- Use `Target weight (kg)` in target/default forms. Make clear that **target set counts and target reps** describe **working sets** only; warmups are extra and do not count toward those targets.
- Use `reps` format as `<number> reps` (e.g. `5 reps`).

## Visual style

- Layout: compact, card-and-table hybrid, optimized for quick scanning.
- Density: moderate; avoid excessive whitespace in core logging flows.
- Border-first hierarchy: subtle borders + soft backgrounds over heavy shadows.
- Rounded controls (`rounded-md`) and small radii for consistency.
- Global header uses a branded light-blue gradient to reinforce navigation hierarchy
  (`from-sky-200 via-sky-100 to-sky-50` with a matching sky border).

## Color intent

- Primary action: sky blue (`sky-*`) for forward/progressive actions.
- Destructive action: red (`red-*`) for delete/remove.
- Success state: emerald (`emerald-*`) for completed/saved feedback.
- Warning state: amber (`amber-*`) for cautionary feedback.
- Neutral controls: zinc (`zinc-*`) for secondary actions.

## Iconography

- Every high-frequency action should have an icon if space allows.
- Keep icon size compact (`h-3` to `h-4` depending on button size).
- Match icon color to intent:
  - primary/action: blue
  - destructive: red
  - success/save: green or white on filled primary buttons
  - neutral/cancel: zinc

## Button conventions

- Primary submit/save buttons use filled sky styling.
- Secondary buttons use neutral outline styling.
- Destructive actions remain outline/soft-red unless explicitly critical.
- On mobile, prioritize thumb-friendly hit targets and concise labels.

## Feedback and messaging

- Reuse shared status notice UI for consistency.
- Message types:
  - error
  - warning
  - success
- Messages should appear near the affected action block.
- Prefer section-local messages over one global page message.

## Responsive behavior

- Mobile-first default.
- Critical actions should remain visible in compact layouts (sticky bars allowed).
- Keep action ordering consistent across breakpoints where possible.
- Preserve consistent header-to-content spacing through shared layout wrappers.

## Accessibility baseline

- Keep button labels explicit (`Save`, `Delete`, `Set targets`, etc.).
- Preserve color contrast for text/icon combinations.
- Do not rely on color alone to communicate state; include text and/or icons.
- Keep form labels visible and adjacent to inputs.

## Content style checklist for new UI

- Is text short, clear, and action-first?
- Are terms consistent with this document?
- Are action colors and icons semantically correct?
- Is compact/mobile behavior still usable with one hand?
- Is success/error feedback shown near the triggering control?
