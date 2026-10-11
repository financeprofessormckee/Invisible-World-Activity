# Review of The Invisible World

Baseline: `e9e91960ad6ff5f5cce64fc65779d7653295095e` (v1 prototype).

The core economic construction is sound within its stated model: independent supply and demand shifters, parallel linear curves, deterministic equilibria, and a hidden third-variable role. The existing randomized suite passed all 1,155,675 checks before changes. The main weaknesses are at the boundary between grading, student input, and the experiment workflow.

## Findings and conservative resolution

| Priority | Finding | Reproduction / consequence | Resolution |
| --- | --- | --- | --- |
| High | A single repeated equilibrium can earn both curves | Wool world `AUDIT235`: observe B without changing anything; a horizontal line through A is within the price tolerance for both curves. The original grader accepts it as supply and demand. | Require evidence at two distinct quantities; enforce positive supply and negative demand slopes. Repeated evidence is rejected without a check penalty. |
| Medium | Typed values silently change meaning | An endpoint outside the axes is clamped in game state even while the form displays the entered value; `novalidate` bypasses the HTML limits. | Retain the entered value, mark it invalid, explain the allowed ranges, and refuse grading without a penalty. Out-of-range handles are not drawn. |
| Medium | Replay loses keyboard focus | Activating a table Replay button rebuilds the table and removes the focused button. | Give row actions stable IDs and restore focus after rendering. |
| Medium | Touch plot blocks page scrolling | `touch-action: none` covers the entire graph, which occupies much of a phone screen. | Allow vertical scrolling on the plot; reserve unrestricted drag handling for endpoint handles. Ignore secondary pointer presses. |
| Low | Endpoint units are not visible | New-home prices are entered in thousands of dollars; quantity units also vary by market. | Display current units next to the fields and associate them with each input. |
| Low | Share link restarts the current run | Following the link reloads the same world and discards observations. | Open the world link in a new tab with `noopener`. |
| Low | Old point choices carry into a new world | Point A may remain selected from the previous run. | Reset curve-entry selections and pointer state on world creation. |
| Low | Score breakdown appears arithmetically inconsistent at zero | Penalties can exceed 100, but the original text presents an equality to the floored score. | Explicitly name the running-score floor. |
| Low | Broken documentation link | `DESIGN.md` links to absent `HANDOFF.md`. | Remove the dead link. |

## Learning-design opportunities for the broader alternative

- Make baseline restoration a first-class action. “Use A” currently changes the curve's grading conditions, not the experiment sliders; these are different operations.
- Compare any pair of observations, including nonconsecutive A–C experiments. Sequential replay alone can make a good experimental design look like a confusing B–C comparison.
- Ask students to predict and explain, while keeping all hidden coefficients and the third-variable role concealed until completion.
- Provide a portable record of observations and reflections for classroom discussion, without an account or server.
- Make the graph, progress, and experiment controls easier to scan while retaining the maroon institutional identity and original curve-entry methods.

## Scope and limits

The conservative proposal keeps the markets, world generation, observation prices, score rules, 12-point cap, tolerance, and replay structure. Its explicit grading-policy correction is that repeated points cannot provide identification evidence and tolerance cannot reverse a curve's economic slope.

These are deterministic teaching worlds, not empirical estimates. The supply-only and demand-only restrictions are assumptions of this model. The activity illustrates identification logic; it does not establish the validity of an instrument in an actual market.

The browser integration suite covers the grading exploit, input validation, full three-market completion, rounded data entry, score, keyboard focus, cap behavior, world reset, touch-action CSS, and 320/390/768/1280-pixel reflow. It does not constitute a screen-reader audit or real-device touch audit.

## Implemented broader alternative

The workbench adds the opportunities above without changing the market generator
or the point/penalty budget. It is an alternative to the conservative branch,
including its corrections. Baseline restoration is free; predictions and
reflections are unscored; arbitrary-pair explanations are gated on completion.
CSV export contains only student-visible observations and student-entered text,
with a final score once the investigation is complete.

Validation: all 1,155,682 model checks, 34 notebook checks, 38 base browser checks,
and 25 additional workbench browser checks passed. Desktop and mobile screenshots
were visually inspected. Browser coverage includes real local CSV download, all
three markets, and page-width checks at 320, 390, 768, 1280 and 1440 pixels.

Changes to the specification are proposed in this branch; they do not claim David
Friedman's or the original developer's approval. The original MIT license and
attribution remain unchanged; college branding remains outside that license.
