# The Invisible World

**[Click Here to Launch the Interactive Activity](https://financeprofessormckee.github.io/Invisible-World-Activity/)**

> **Status:** v1 prototype under review with David Friedman. Not yet accessibility-audited
> for teaching release.

Discover how controlled changes can identify hidden supply and demand curves from observed market equilibria. Students pick a commodity and set three market conditions: one shifts supply only, one shifts demand only, and the third shifts one, both, or neither. The true curves stay hidden; students see only the equilibrium price and quantity at each point they request, then name which observations trace the supply and demand curves.

## Educator Guide: Classroom Integration

This activity is a browser adaptation of Proposal 5 in David Friedman's
[Living Paper](http://daviddfriedman.com/Living_Paper/living_paper.htm) catalog of teaching programs
([original program descriptions](http://daviddfriedman.com/Living_Paper/Program_Descriptions/program_descriptions.htm)).

### The Economic Model

* **Hidden linear curves:** Qs = As + Bs·P and Qd = Ad − Bd·P on a 0–200 grid, randomized for every world.
* **Identification:** a supply-only shifter traces demand and a demand-only shifter traces supply. This is the logic of instrumental variables, including testing (not assuming) the exclusion restriction.
* **Scoring:** start at 100, −5 per extra observation, −10 per wrong curve; the replay reveals the true curves.

The full model, its adaptations from Friedman's description, and acceptance cases are in
[SPECIFICATION.md](SPECIFICATION.md). The recorded source brief is in [DESIGN.md](DESIGN.md).

### Running it locally

Open `index.html` in a browser. There's no build step, installation, or server, and
everything is local. Model tests run with Node: `node tests/model-tests.cjs`.

### License and Citation

The source code for this web application is licensed under the [MIT License](LICENSE). You
are free to use, modify, and distribute the software, consistent with the Living Paper's
request that code based on Friedman's proposals remain open source.

The economic concepts are David Friedman's. The West Texas A&M University name, seal, and
branding assets are not covered by the license and do not imply institutional endorsement
of derivative works. If you use or adapt this activity, please cite this repository.

---
*Economic concepts: [David Friedman](http://daviddfriedman.com/Living_Paper/living_paper.htm). Development: [Eric McKee](https://github.com/financeprofessormckee),
Paul and Virginia Engler College of Business, West Texas A&M University.*

### Review and regression checks

[REVIEW.md](REVIEW.md) records the findings behind this proposal. The model suite
includes the duplicate-equilibrium grading regression. An optional integration
suite exercises the actual page in Chromium:

```sh
npm install --no-save playwright@1.62.1
npx playwright install chromium
node tests/browser-tests.cjs
```

Set `CHROMIUM_EXECUTABLE_PATH` if using an existing Chromium installation.
The application itself still requires no dependencies or build step.
