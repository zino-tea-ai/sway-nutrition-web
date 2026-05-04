# Product Thread Archive - 2026-05-03

This archive captures the product/design context from the long Codex thread before moving future work into the repo workspace. It is intentionally more detailed than `CODEX_HANDOFF.md`.

## How To Use This File

Read this after `CODEX_HANDOFF.md` when a new agent needs the product logic, user preferences, and rejected directions behind the current repo state.

Suggested startup prompt:

```text
Read CODEX_HANDOFF.md and docs/context/2026-05-03-product-thread.md. Continue from the repo state, not from memory. First inspect git status.
```

## Collaboration Preferences Learned In This Thread

The user wants a product/design partner, not just an implementer.

Important working rules:

- Tell the user before making edits.
- Do not make broad visual changes without explaining the intent first.
- Do not hide behind high-level product talk; make concepts executable.
- Do not produce "AI prototype" UI. The user is highly sensitive to spacing, alignment, motion quality, and mismatched styles.
- Use available frontend/design skills and references when doing UI work.
- Verify with screenshots, QA scripts, and actual browser behavior.
- If something is uncertain, research it or inspect docs instead of guessing.
- Avoid generic dashboards unless the product logic truly needs a data panel.
- Prefer a fixed repo workspace and written handoffs over relying on chat memory.

The user pushed back repeatedly on:

- Vague semantic labels.
- Overly literary product copy.
- Pure numbers without user-understandable meaning.
- Conservative design that does not use strong visual/motion capabilities.
- Agent output that feels random or hard to iterate.
- Treating frontend polish as secondary to backend/architecture.

## Product Pivot

Original direction:

- AI calorie tracker / nutrition tracker.
- Dashboard-like metrics and meal logs.

Problem:

- Too similar to existing calorie trackers.
- Lacked a strong differentiated hook.
- Early UI felt surprising in places but not usable enough.
- Product structure felt hard to start using.

New direction:

- Food sticker first.
- User takes a food photo.
- The app turns the food into a sticker through high-quality subject lift / cutout.
- The sticker becomes the emotional and interaction unit of the app.
- Nutrition/goal feedback is built around stickers, not around a table or dashboard.

Important framing:

```text
Food is captured as a visual memory.
The sticker carries structured nutrition/goal impact.
The board makes today's eating legible.
The next action helps the user recover or continue.
```

## Visual Reference Direction

The user referenced:

- Apple VisionKit / subject lift style.
- A SwiftUI + Metal dissolve shader where the background disperses away and the subject remains.
- CapWords-like sticker/capture flow.
- A video reference where capture leads into a detail card.

Critical requirement:

- The desired effect is not "show a loading spinner, then replace with cutout."
- The desired effect is: captured photo freezes, background dissolves/disappears, the subject remains visually continuous in position and size.
- The subject should not jump upward or resize when the reveal completes.
- The loading time should be hidden inside the transition choreography as much as possible.

The user explicitly rejected:

- Black screen or frozen dead screen after photo capture.
- A result that appears after a pause with no loading/reveal bridge.
- A cutout that is visually smaller/larger than the original subject.
- A flow where the background does not actually disappear.
- Random glow/freeze effects that do not match the subject-lift experience.

## Current Sticker Lab Implementation Context

Current route:

`/sticker-lab`

Current flow:

- Camera or upload.
- Background removal/cutout through backend/API path.
- Visual reveal and detail card.
- Public deployment path has been tested.

Current deployment shape:

- Vercel frontend.
- Hugging Face Space cutout backend.
- OpenRouter used for image/food analysis path.

Known issue that was fixed but not committed at archive time:

- Bottom capture controls were getting strange colors because global `.ghost-button` styles overrode sticker lab styles.
- Dirty file: `src/sticker-lab.css`.

## Product Problem Still Unsolved

The core unresolved problem is the multi-goal attribute system.

The user asked whether "multi goal attribute system" was finished. Answer: no.

Only these principles are currently agreed:

1. Goals cannot be nutrition jargon.
2. Goals should map to user life needs.
3. Internal food attributes can be structured.
4. The user-facing output must combine simple numbers with clear meaning.
5. The system should feel like a game attribute system, but not like random badges.

Still unresolved:

- Goal taxonomy.
- Whether goals are one-level or two-level.
- How goals map to micro/macro food attributes.
- How to avoid semantic bugs.
- How to make each goal executable by food choice.
- How much playful / weird / "curious" goal content to include without becoming unserious.
- How to expose numbers without turning into a dashboard.

## Rejected Metric Language

The user explicitly found this unclear:

- `Energy Stability 78`
- `Protein Anchor 84`
- `Carb Speed 52`
- `Dinner Weight 41`
- `Fresh Volume 68`
- `Sweet Load 22`

Reason:

- These labels sound designed but not understood.
- They are neither everyday language nor established nutrition terms.
- A user cannot infer what to do next from them.

Better direction:

- User-facing goals should be things people already care about.
- Food-level explanations can mention the underlying reason in plain language.

Example:

```text
Afternoon energy +3
Enough protein, slower carbs.
```

Better than:

```text
Protein Anchor 84
Carb Speed 52
```

## Emerging Goal System Direction

The system likely needs three layers.

Layer 1: user-visible life goals.

Candidate examples:

- Weight management.
- Skin state.
- Afternoon energy.
- Blood sugar steadiness.
- Gut comfort.
- Sleep burden.
- Workout support.
- Craving control.

Layer 2: internal food attributes.

Candidate examples:

- Protein density.
- Fiber / fresh volume.
- Sugar release speed.
- Added sugar.
- Fried/oil burden.
- Processing level.
- Sodium/saltiness.
- Spicy/irritant load.
- Caffeine/alcohol.
- Portion size.
- Meal timing.

Layer 3: output grammar.

The output should make a food sticker's impact legible:

```text
Goal delta: +2 / -3 / stable
Reason: one or two concrete causes
Next move: what to add, reduce, or balance later
```

Example:

```text
Sleep burden +3
Late and heavy. Keep the next meal lighter.
```

Example:

```text
Energy +2
Protein helps. Sweet sauce makes it less steady.
```

## Important Semantic Guardrails

Avoid medical overclaims.

For example:

- Do not say a single food "causes acne."
- Do not say a meal "controls blood sugar" unless there is user health data and appropriate medical framing.
- Do not imply diagnosis.

Use softer, behavior-level language:

- `may add skin burden`
- `likely to feel heavier tonight`
- `more steady than a sweet drink`
- `good anchor for this meal`

But do not become so vague that the product loses usefulness.

The rule is:

```text
Plain, actionable, bounded.
```

## Today Sticker Board Direction

Today Sticker Board is intended to become the main app surface.

It should not be:

- A meal history list.
- A generic photo grid.
- A calorie dashboard.
- A static sticker scrapbook with no functional feedback.

It should be:

- A place where today's food stickers accumulate.
- A readable view of how today's choices affect selected goals.
- A recovery/next-meal guide.

Expected loop:

```text
Sticker enters board
-> selected goals move
-> user sees why
-> user knows what next meal should do
```

Potential board primitives:

- Sticker timeline / board.
- Selected goal chips or goal rails.
- Per-sticker impact badges.
- Daily body/status card.
- Next move module.

Design tension:

- Needs enough data to be convincing.
- Must not become a dashboard.
- Should feel familiar but slightly novel.
- Should use sticker interaction as the core differentiator.

## Claude/Codex PK Result And Rejection

The user asked for a PK between Codex and Claude.

Claude's proposal:

- Collapse to one goal, probably skin.
- Build one very strong loop.
- Avoid broad goal system until the core loop proves itself.

Codex initially judged Claude's product sharpness strong.

User rejected this direction:

- "no, I don't want its solution, go back to our original route."

Decision:

- Do not switch to a single-goal skin app.
- Keep the original multi-goal structured route.
- Still learn from Claude's criticism: sticker must not become decoration; the feedback moment matters.

Current route:

```text
Food sticker first
multi-goal attribute system
Today Sticker Board
plain-language numeric impact
```

## Multi-Agent / Workflow Discussion

The user explored whether Claude Code and Codex should work together.

Recommendation given:

- Codex should remain primary owner/builder/integrator in this repo.
- Claude Code can be used as an external reviewer/critic.
- Avoid free-form autonomous agent chat.
- Use structured review loops with roles and stopping conditions.

Suggested roles:

```text
Codex = implementation owner
Claude = product/UX/code reviewer
User = final decision maker
```

The user also asked about Slack as an agent room.

Recommendation:

- Slack can work as a human-controlled orchestration layer.
- Use task threads, buttons, and structured agent turns.
- Do not let agents free-chat indefinitely.

## Tooling / Workspace Migration Context

The current thread started outside the repo workspace, so future work should migrate into the repo.

Actual repo:

`C:\Users\WIN\Documents\Codex\2026-05-02\new-chat-2\sway-nutrition-web`

This archive exists because `CODEX_HANDOFF.md` alone cannot preserve all conversation context.

The user correctly noted:

- Moving workspace does not migrate full chat context.

This file is intended to preserve the high-value product context, not every line of chat.

## What To Do Next

Before implementing more UI:

1. Inspect current git status and dirty diff.
2. Decide whether to commit `src/sticker-lab.css` and this context work.
3. Define the first version of the goal system:
   - user goals
   - internal food attributes
   - mapping rules
   - output grammar
4. Design `/sticker-board` around one scenario but with multi-goal architecture.
5. Only then implement the board route.

Recommended next product artifact:

`docs/product/goal-system-v0.md`

It should answer:

- What goals exist in v0?
- Which are default?
- Which are user-selected?
- What food attributes drive them?
- What does each output look like?
- What explanations are allowed or forbidden?
- What example meals prove the system works?

## Acceptance Standard For Future UI

Future UI should be judged by:

- Can a new user understand what to do without reading an explanation?
- Does the sticker feel like the primary object?
- Does every number have an immediately understandable meaning?
- Does each meal create a visible effect?
- Does the app tell the user what to do next?
- Does the design avoid generic dashboard tropes?
- Does the layout stay stable on mobile Safari and desktop?
- Are motion and timing smooth enough to feel intentional?

If a screen does not help the user understand:

```text
what I ate
what it changed
why it changed
what I should do next
```

then it is not yet product-ready.
