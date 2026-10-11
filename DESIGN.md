# The Invisible World — source-based design brief

Proposal 5. Source reviewed 2026-09-30: [Program Descriptions](http://daviddfriedman.com/Living_Paper/Program_Descriptions/program_descriptions.htm) and [Living Paper index](http://daviddfriedman.com/Living_Paper/living_paper.htm).

**Planning history.** The questions below were answered in [SPECIFICATION.md](SPECIFICATION.md) (2026-09-30), which governs the implemented game.

## Learning objective

Discover how controlled changes can identify hidden supply and demand curves from observed market equilibria.

## Confirmed mechanics in the source

- Choose a commodity and manipulate three observable variables. At least one variable affects supply alone and another demand alone; a third can affect one, both, or neither curve. Wool, fashion, weather, and meat prices are the source's illustrative setting.
- Begin with a labeled equilibrium observation A. Each requested observation records the input values and the resulting equilibrium price and quantity, while the underlying curves stay hidden.
- Infer both curves and select the observation whose input values each inferred curve describes. Incorrect attempts can be followed by further experiments until the observation limit is reached.
- The described score begins at 100; each observation after the first costs 5 points and each incorrect attempt costs 10. The source gives a score of zero when neither curve is correctly identified.
- Replay recorded observations after completion with the actual curves revealed, so students can explain which changes traced out which curve.
- The linear model uses Qs = As + Bs * P and Qd = Ad - Bd * P, with parameters randomized per run and affected by the selected variables. The equilibrium follows from Qs = Qd.

## Optional variants and adaptation notes

- Nonlinear curves; small random errors; an observable but uncontrollable variable; a larger commodity library; an extended observation list.
- The original plotting constraints use a 200-by-200 pixel coordinate system. Translate them into explicit economic units and valid visible intersections during specification; do not treat pixels as an economic unit.

## Questions for David and the browser specification

1. Which commodity and plausible supply-only and demand-only shifters should launch the first activity?
2. What observation limit, curve acceptance tolerance, score floor, and partial-completion scoring should the browser version use?
3. How should students enter and revise curve estimates with equivalent keyboard, touch, and pointer access?
4. Which parts of the original scoring and randomized scenarios should remain unchanged?

## Source and accessibility constraints

No dedicated Invisible World archive is linked on the Living Paper index.

Write fresh browser code by default; follow source-use notes (in the authoring collection) before any reuse. Keep keyboard and single-pointer alternatives for drawing/dragging, labeled numeric data and text/table equivalents for visual output, and verified focus/reflow behavior. These adaptation requirements do not imply that the original desktop UI meets current accessibility standards.

## Next task

See [SPECIFICATION.md](SPECIFICATION.md).
