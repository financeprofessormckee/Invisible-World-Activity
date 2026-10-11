# The Invisible World — browser specification (v1)

- **Status:** decided and implemented 2026-09-30. Decisions made by Eric McKee (economist; development lead) standing in for the open "questions for David." **David Friedman's review is invited but not blocking**; any change he asks for is a spec revision.
- **Source:** Friedman's detailed description of Proposal 5 on the [program descriptions page](http://daviddfriedman.com/Living_Paper/Program_Descriptions/program_descriptions.htm), re-read 2026-09-30. Fresh code; no legacy program inspected.
- **Code:** `js/model.js` (economics, no DOM), `js/graph.js` (SVG), `js/app.js` (page controller), `index.html`, `styles.css`. Tests: `tests/model-tests.cjs`.

## Learning objective

Observed prices and quantities are intersections, not curves. A curve is identified only by points generated while it stays fixed and the *other* curve moves: a supply-only shifter traces demand, a demand-only shifter traces supply. This is the logic of instrumental variables, and the game also teaches the exclusion restriction: the third condition may shift one curve, both, or neither, and the student must test it rather than assume it.

## Kept from the source

- Choose a commodity and set three conditions: one shifts supply only, one shifts demand only, and the third shifts one, both, or neither. Point A is the starting equilibrium. The student requests more labeled points (B, C, …); the curves stay hidden and a list records each point's conditions, price, and quantity.
- The student gives a supply and a demand line, each attached to the conditions of one listed observation, and is told only right or wrong. They may go back and take more points.
- Score starts at 100: −5 per observation after A, −10 per wrong curve. The score is 0 if neither curve is found.
- The replay reveals the true curves for any selected observation.
- Linear model Qs = As + Bs·P and Qd = Ad − Bd·P on Friedman's 0–200 grid, with his conditions 1–3 (1 < B < 5; each curve stays inside the box for 0 ≤ Q ≤ 200; the curves cross inside the box). Parameters are randomized for every world.

## Decisions (answers to the DESIGN.md questions)

| Topic | Decision | Rationale |
|---|---|---|
| Commodities | Wool (default), Ice cream, New homes. Data-driven library in `model.js`. | Wool is Friedman's own example. The other two give students a food market and a housing market with textbook-plausible shifters. |
| Wool | Supply: price of lamb (joint product, +). Demand: fashion for wool (+). Third: winter weather (hard winters shrink flocks −S; cold raises demand +D). | Friedman's example. |
| Ice cream | Supply: price of milk (input, −). Demand: price of frozen yogurt (substitute, +). Third: summer heat (heat-stressed cows −S; heat +D). | |
| New homes | Supply: price of lumber (input, −). Demand: local job growth (+). Third: mortgage rate (builder finance −S; buyer cost −D). | |
| Third-variable role | Hidden and drawn at random each world: supply / demand / both / neither, with equal odds. The direction of an effect always follows the story. Revealed with an explanation at the end. | Friedman's "one, both, or neither" is the exclusion-restriction lesson. |
| Condition levels | 5 discrete levels per condition (sliders), numeric or verbal labels. Level 2 is the centre. | Makes "hold X fixed" exact and keyboard-friendly. |
| Shifts | Each level step shifts the intercept by 12–26 quantity units (random per world). Slopes are fixed within a world, so shifts are parallel. | Keeps inference deductive. Rotations are deferred as a variant. |
| Parameter bounds | Bs, Bd drawn from (1.1, 4.9). A world is accepted only if, for **all 125 combinations**: Friedman's conditions 1–3 hold; the equilibrium lies in [15, 185] on both axes; each active step moves the point ≥ 9 grid units; and each step moves every curve it affects ≥ 6 price units. | Every reachable point is visible and every step is legible. Wrong adjacent curves always fall outside the tolerance. Feasibility was measured: larger minimum moves make Friedman's in-box conditions fail. |
| Units | The grid never appears in the interface. Wool $0–$4.00/lb × 0–200 million lb/yr; ice cream $0–$10.00/gal × 0–1,000 million gal/yr; homes $0–$600k × 0–2,000 homes/yr. | Friedman: pixels are not economic units. |
| Observation limit | 12 (A–L). Repeated conditions are allowed (the point lands on top of the earlier one and still costs 5), with an inline caution. | Friedman's "dozen or so" crowding limit. |
| Curve entry | Straight lines only. Three equivalent methods: (1) **through two observations** (two selects); (2) **typed endpoints** (quantity and price for each end, in economic units); (3) **click two spots on the graph** (single pointer, no drag required), which snaps to an observation within 6 grid units. Endpoint handles can also be dragged. The line is always shown extended across the whole graph. | (1) is the deductive route. (2) is the keyboard/screen-reader route. (3) is the direct-manipulation route and meets WCAG 2.5.7. |
| Attaching | "Applies under the conditions of observation ___" (a select, or the "Use B" button on a log row). A curve is correct for every observation that shares it. | Friedman's click-the-row design. |
| Acceptance | The line's price must be within **±3 price units (1.5% of the axis)** of the true curve at both ends of the grading window. The window is the observed quantity range padded by 10 units, clipped to 0–200. Vertical lines and incomplete lines are refused without a penalty. | Exact deduction always passes. Lines typed from the table's rounded values pass (tested). Every adjacent wrong curve is at least 6 units away. The judgment covers where there is evidence. |
| Checking | Allowed once there are at least 2 observations. A correct curve locks in and stays drawn. A wrong one costs 10 and gets only "Not the supply curve under B's conditions." Checking stays open after the 12 observations are used up. | Friedman gives no hints. |
| Scoring | Running score = 100 − 5·(observations − 1) − 10·(wrong tries), floor 0. Final score: both curves → running score; **one curve → half the running score (rounded)**; neither → 0. The breakdown is shown. | **Departure:** the source leaves one-curve scoring unspecified. Halving keeps "both curves" as the goal while still rewarding partial success. |
| Ending | Finishes automatically when both curves are found. "Finish" is available at any time, with a confirmation if a curve is missing. | |
| Replay | Previous/Next buttons, or "Replay B" on a log row. Each step draws the true S and D under that observation's conditions, dims the other points, and overlays the student's accepted curves (dotted). The text names the conditions changed from the previous point, which curves actually shifted, and what the pair therefore traces ("same demand curve" / "same supply curve" / "neither curve" / "neither curve moved"). It also lists every observation sharing this point's supply curve and its demand curve, and states the third condition's true role. | Friedman's replay, plus explanation text so the lesson doesn't depend on the picture. |
| World code | Six-character code; `?good=wool&seed=CODE` reproduces the world exactly, including the third variable's role and point A. "Link to this world" and "New world" controls. | Lets an instructor give a class the same world and discuss it. |
| Persistence | None. Reloading the page restarts the same world. | No storage or services in v1. |

## Failure cases handled

Checking before a second observation; a curve kind already found; an incomplete line; a vertical line or two identical points (refused with an explanation and no penalty); observations exhausted (Observe disabled, checking still open); switching market or world mid-game (confirmation); a score that would go below 0 (floored).

## Accessibility design (audit still required before release)

- Every action works by keyboard: native range sliders with `aria-valuetext`, selects, number inputs and buttons. Drawing never depends on a pointer, and pointer drawing never depends on dragging.
- The graph is an SVG `role="img"` whose `<desc>` is regenerated after every change to list each point, each accepted or drafted line's endpoints, and the revealed curves. The observation table is its full text equivalent.
- A polite live region announces new observations, check results, endpoint placement and replay steps. Focus moves to the results heading on finish.
- Curves differ by line pattern as well as color: supply is solid, demand dashed, student lines dotted, the draft dash-dot in maroon. The legend is text.
- Primary buttons are ≥ 44 px, other controls ≥ 32 px, and pointer handles have an 11-unit hit radius. The layout reflows to one column below 900 px with no horizontal page scroll at 320 px; the observation table scrolls inside its own container.

## Acceptance scenarios (automated)

1. **Deduction (classroom path):** A; raise only the supply shifter → B; restore it and raise only the demand shifter → C. Demand through A and B, attached to A → correct. Supply through A and C (typed from the table), attached to A → correct. Final score 90. The replay says A→B traces demand.
2. **Trap:** in a world where the third condition shifts both curves, a line through two points that differ only in that condition is rejected as both supply and demand, and the replay says "neither curve."
3. **Wrong attachment:** a correct supply line attached to a point whose supply shifted is rejected.
4. **Model properties** over 1,000 seeds × 3 commodities × 125 combinations: conditions hold; Qs = Qd at every equilibrium; exclusion restrictions and effect directions hold; roles appear about equally often; identical codes reproduce worlds; the tolerance boundary sits at 2.9 accepted and 3.1 rejected.

## Deferred variants (from the source)

Nonlinear curves; small random error, turning inference statistical; an observable but uncontrollable condition that affects one curve only; a larger commodity library; unlimited, scrollable observations. Per Friedman, harder levels should start with more points so scores stay comparable.

## Proposed corrective revision

Grading now requires observations at two distinct quantities. Repeated equilibria
remain allowed and still cost five points, but cannot supply identification
evidence; checking with only repeated evidence has no penalty. A candidate supply
line must rise and a candidate demand line must fall. The existing ±3 tolerance
then applies. Incomplete, vertical, and out-of-axis endpoints are refused without
a penalty. Numeric entry is never silently clamped. These checks close the
`AUDIT235` duplicate-point loophole documented in `REVIEW.md`.

Endpoint units are visible; the table is a keyboard-focusable scroll region;
replay preserves row-button focus; touch users can scroll on the plot and drag
handles; world links open in a new tab to preserve the current run. No claim of a
completed accessibility audit is made.

## Proposed workbench revision (alternative to the conservative proposal)

The original learning objective, three markets, seeded worlds, linear model,
hidden third-variable role, curve-entry methods, scoring and observation cap are
preserved. The corrective grading rules above also apply.

- **Experiment baseline:** choose any recorded observation, restore its conditions
  without adding an observation, and see which controls differ from it. “Use” in
  the table continues to set only the grading attachment.
- **Predictions:** optional, unscored price and quantity directions plus a short
  rationale are captured with each observation and its baseline. They reset after
  observing. Directions are checked against the selected baseline after finishing,
  with no effect on the game score.
- **Pair comparison:** compare arbitrary observations, with condition changes and
  price/quantity differences. Differences use the unrounded model observations
  and are then formatted in market units; displayed endpoint rounding can therefore
  differ slightly from the displayed delta. The comparison does not disclose
  hidden curve movements during play. “Draw this pair” fills the existing line form
  without choosing the curve kind or grading attachment for the student.
- **Debrief:** after finishing, selecting the second comparison point reveals that
  observation's true curves and explains the selected pair, including nonconsecutive
  experiments. The sequential replay text remains explicitly labeled as sequential.
  The reflection asks for an explanation using observation labels.
- **Record:** CSV includes world code, commodity, conditions, observed price and
  quantity with units, prediction/baseline, reasoning, known found curves, phase,
  final score only after completion, and reflection. It contains no hidden
  coefficients or role. Text is CSV-escaped and spreadsheet formula prefixes are
  neutralized. Download is manual; no persistence, accounts, network service,
  analytics, or dependencies are added to the application.
- **Presentation:** retain the existing college masthead and maroon identity. An
  observe–identify–explain indicator, equilibrium readout, responsive comparison
  panel, and two-line quantity-axis label make the investigation easier to follow.
  Results replace the experiment controls beside the graph on wide screens.

Node tests cover notebook operations and export escaping. Browser tests cover
baseline restoration, predictions, pairwise inference, hidden-answer boundaries,
replay, CSV download, reflection, reset and mobile reflow, in addition to the
conservative regression suite. Screen-reader and physical-touch audits remain open.
