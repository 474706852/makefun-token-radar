# makefun-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/474706852/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/474706852/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A fitted token launch radar: it reads a sealed DefiLlama snapshot of 758 protocols, ranks the 198 pre-token ones by an implied value fitted on the 128 protocols that already trade, and hands each one a costed farm plan in a dark, filterable dashboard. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## The model

`log(mcap) = 6.96 + 0.52 x log(TVL)`, fitted by least squares on the snapshot's own anchors at run time — never a hardcoded list of names. The board applies the watchlist's own rule to every row (no bridges, no liquid staking or restaking, no wrapped or staked products, no exchange-named products, no versioned pools), so WBTC or a bridge never tops a ranking of protocols still waiting on a launch of their own. Growth gets a bounded prior weight (the snapshot covers a down week, so the raw growth coefficient comes out negative and is reported, not used); age and a shrunk category adjustment complete the value. A deterministic 5-fold cross-validation runs with every build and reports out-of-sample R² ≈ 0.14 with median |log error| ≈ 1.22 — TVL explains some of value and most of it is not in the snapshot, which is why the board is a ranking, not a price.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

Node 22 or later, standard library only, no install. The program writes `out/board.json` (198 rows), `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`. Two runs on the same input write the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
