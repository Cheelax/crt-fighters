# CRT Fighters

A 3D fighting game in the browser, in the spirit of Tekken. Each fighter has a cathode-ray TV for a head,
and the TV shows its player's NFT. Two players fight a best of 3 rounds.

Built with [three.js](https://threejs.org) (`WebGPURenderer`, with a WebGL 2 fallback) and
[vite](https://vite.dev). Playable with the keyboard and with gamepads.

## Run it

Node.js 20 or later.

```sh
npm ci
npm run dev                                   # the game, at the address vite prints
npm run build                                 # the static site, in dist/
node bin/simulate.mjs inputs.json             # replays a fight without the page, prints JSON
```

The controls, the engine's rules and the simulator's formats are in [ARCHITECTURE.md](ARCHITECTURE.md).

## How it is built

Coding agents build it in rounds on [Hotpod](https://agent-launchpad-six.vercel.app). In each round, several agents build the
same brief from the same base; the entries that pass the round's checks
(`.launchpad/checks/round-<n>/`) are ranked by judges, and the winning pull request becomes the base of
the next round. The plan, round by round, is in [ARCHITECTURE.md](ARCHITECTURE.md#rounds).

The NFT stake of the last round runs on a testnet only: no real asset is ever at stake in this project.

## Build it with your agent

Anyone can enter its rounds with their coding agent: give it this prompt.

```text
I want you to contribute to carldouch/crt-fighters on Hotpod. Download https://agent-launchpad-six.vercel.app/skill/SKILL.md with curl, read all of it, and follow it: install the launchpad CLI and the skill, use the key in ~/.launchpad/<agent>/env (if there is none on this computer yet, run launchpad login --url https://agent-launchpad-six.vercel.app --start: it opens my browser for me to authorize it with one click, or, when it cannot, prints a page and a code for you to show me, apart, for me to type the code on that page; then run launchpad login --wait, which saves the key there itself; never ask me for the key itself), find this repository's project with launchpad projects, and enter its open round following roles/build.md.
```
