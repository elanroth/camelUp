# 🐪 Camel Up 2.0 Analyzer

An interactive probability calculator and game simulator for the board game **Camel Up (Second Edition)**, featuring crazy camels, desert tiles, and comprehensive statistical analysis.

## Features

### 🎲 Interactive Board Editor
- **Visual track editor** with drag-and-drop camel positioning
- **Stack management** - move camels up/down within stacks
- **Dice pool control** - toggle which dice have been rolled
- **Desert tile placement** - add oasis (+1) and mirage (-1) tiles
- **Quick roll simulator** - test individual die outcomes instantly

### 📊 Real-Time Probability Analysis

#### Leg Winner Probabilities (Exact)
The analyzer uses a **complete enumeration algorithm** to calculate exact probabilities for the current leg winner:
- Explores **every possible sequence** of die rolls from the current state
- Typical performance: **~20ms** for full dice pool (6 dice remaining)
- Uses **mutable in-place operations** to minimize memory allocation (100× faster than naive approach)
- Accounts for:
  - Random die order (uniform selection from pyramid)
  - Die faces showing 1, 2, or 3 with equal probability
  - **Crazy die** with 6 equally likely outcomes: {black, white} × {1, 2, 3}
  - Forward camels only (crazy camels excluded from leg bets)

#### Race Winner/Loser Probabilities (Monte Carlo)
Uses **Monte Carlo simulation** to estimate overall race outcomes:
- Default: **10,000 simulations** in ~50-150ms
- **Seeded PRNG** (Mulberry32) for reproducible results
- Simulates complete games from current state:
  1. Finishes current leg with remaining dice
  2. Starts new legs with full dice pool
  3. Stops when any camel crosses finish line (space 16)
  4. Records race winner (1st place) and loser (last place)
- Includes all 7 camels (5 forward + 2 crazy)

#### Expected Value (EV) Calculator
Calculates the **expected coin value** of each action:
- **Leg bets**: EV for betting on each camel to win the current leg
- **Race bets**: EV for betting on overall race winner/loser
- **Desert tiles**: EV for placing oasis/mirage on each space
- Shows **optimal strategy** ranked by expected value

### 🎮 Play Mode
- Full game implementation with turn-by-turn play
- Roll dice and watch camel movement animations
- Place leg bets and race bets
- Position desert tiles and earn coins
- Per-player tracking of:
  - Coins earned
  - Race bets placed
  - Desert tiles owned
  - Leg bets taken

### 🧪 Comprehensive Test Suite
- **300 passing tests** covering:
  - Movement mechanics (forward and backward)
  - Probability calculations
  - EV calculations
  - Bot strategies
  - Integration scenarios
  - Crazy camel interactions
  - Desert tile effects
- Run tests: `npm test`
- Watch mode: `npm run test:watch`

## Technical Architecture

### Model Layer (`src/model/`)

#### Core Game State
- **types.ts** - TypeScript type definitions for game state
- **constants.ts** - Game constants and initial state builder
- **movement.ts** - Immutable camel movement logic
  - Forward camel movement (stacking on top)
  - Crazy camel movement (backward, under-stacking)
  - Trap tile application (oasis/mirage effects)

#### Probability Engine
- **probability.ts** - Exact leg winner calculation
  - Complete state space enumeration
  - Mutable in-place track operations for performance
  - ~175,000 leaf nodes evaluated in <20ms
- **simulator.ts** - Monte Carlo race simulation
  - Fast PRNG (Mulberry32)
  - 10k+ simulations per analysis
  - Winner/loser probability estimation

#### Strategy Analysis
- **ev.ts** - Expected value calculations
  - Leg bet EV using exact probabilities
  - Race bet EV using simulation results
  - Desert tile placement EV
- **bots.ts** - AI player implementations
  - `alwaysRoll` - baseline strategy
  - `greedyEVBot` - EV-maximizing strategy

### View Layer (`src/view/`)
- **Board.tsx** - SVG race track visualization
- **BoardEditor.tsx** - Interactive editor + play mode
- **AnalysisPanel.tsx** - Probability and EV display
- **TurnPanel.tsx** - Game controls and player state

### Controller Layer (`src/controller/`)
- **useGameEditor.ts** - Board state management
- **useTurnController.ts** - Game turn logic
- **useAnalysis.ts** - Probability calculation coordinator

## Algorithm Details

### Leg Probability Calculation
```
State space: Up to 6 dice (5 forward + 1 crazy)
- Forward die: 3 outcomes (1, 2, 3)
- Crazy die: 6 outcomes (black/white × 1/2/3)
- Total sequences: 6! × 3^5 × 6 = ~175k

Optimization: Mutable operations reduce GC pressure 100×
Memory: O(track size × stack height) ≈ constant
Time complexity: O(n! × 3^n) where n = dice remaining
```

### Monte Carlo Simulation
```
For each simulation:
1. Clone current game state
2. Finish current leg:
   - Shuffle remaining dice
   - Roll each die (1-3 uniform)
   - Move camels, check for race end
3. If no race end, start new leg:
   - Reset dice pool (all 6)
   - Repeat until finish line crossed
4. Record winner (leading camel) and loser (last camel)

Accuracy: ±0.5% at 10k simulations (95% confidence)
```

### Desert Tile EV
```
For each possible tile placement:
1. Calculate leg win probabilities WITH tile at space X
2. For each outcome:
   - If camel lands on X: +1 coin to tile owner
   - Tile affects final ranking
3. EV = Σ(P(outcome) × value(outcome))
4. Compare to baseline (no tile) = opportunity cost
```

## Performance Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| Leg probability (6 dice) | ~20ms | Full enumeration |
| Leg probability (3 dice) | ~2ms | Reduced state space |
| Race simulation (10k) | ~100ms | Monte Carlo |
| EV calculation (full) | ~200ms | Includes simulation |
| Bot game (to completion) | ~500ms | ~20 turns average |

*Measured on Apple M1, Chrome 120+*

## Installation & Usage

### Development
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

### Production Build
```bash
npm run build
npm run preview
```

### Testing
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Game Rules (Camel Up 2.0)

### Objective
Bet on which camel will win (or lose) the race while earning coins throughout.

### Setup
- 5 forward camels (blue, green, yellow, purple, pink)
- 2 crazy camels (black, white) that move backward
- 16-space race track
- Dice pyramid with 6 dice (5 forward + 1 crazy)

### Gameplay
1. **Roll die**: Draw random die from pyramid, roll it (1/2/3)
   - Crazy die: pick black or white to move backward
2. **Place leg bet**: Bet on leg winner (5 coins → 2-1 payout)
3. **Place race bet**: Bet on race winner/loser (8 coins for 1st bet)
4. **Place desert tile**: Oasis (+1 space) or Mirage (-1 space)

### Leg End
- When dice pool empty, leg winner determined (leading forward camel)
- Leg bets pay out: 1st bet on winner = 5  coins, 2nd = 3 coins, 3rd = 2 coins
- Wrong bets = -1 coin
- Desert tiles persist between legs

### Race End
- First camel to reach/pass space 16 triggers race end
- Race bets pay out: Winner bets = 8/5/3/2/1 coins (order placed)
- Loser bets similar
- Wrong bets = -1 coin
- Most coins wins!

## Tech Stack

- **React 18** - UI framework
- **TypeScript 5** - Type safety
- **Vite 6** - Build tool & dev server
- **Vitest 2** - Testing framework
- **TailwindCSS 3** - Styling
- **SVG** - Track rendering

## Project Structure
```
src/
├── model/           # Game logic (pure functions)
│   ├── types.ts
│   ├── constants.ts
│   ├── movement.ts
│   ├── probability.ts
│   ├── simulator.ts
│   ├── ev.ts
│   └── bots.ts
├── controller/      # State management hooks
│   ├── useGameEditor.ts
│   ├── useTurnController.ts
│   └── useAnalysis.ts
├── view/            # React components
│   ├── Board.tsx
│   ├── BoardEditor.tsx
│   ├── AnalysisPanel.tsx
│   └── TurnPanel.tsx
└── App.tsx

tests: *.test.ts files alongside source
```

## Contributing

This is a personal project, but suggestions and improvements are welcome!

## License

MIT

## Acknowledgments

Based on the board game **Camel Up (Second Edition)** by Steffen Bogen, published by eggertspiele.
