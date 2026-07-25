# AmyPatch Studio

A web app for creating, visualizing, editing, simulating and deploying patches for the
[AMYboard](https://github.com/shorepine/tulipcc/tree/main/docs/amyboard) hardware synth and the
[AMY](https://github.com/shorepine/amy) synthesis engine.

**Three pillars:**

1. **Code Workspace** — generate runnable AMYboard patch code (Python sketches / AMY wire
   messages) from natural-language prompts via OpenRouter (user-supplied API key, user-selectable
   model), with automatic validation and a self-repair loop.
2. **Patch Workspace** — a Eurorack/VCV-Rack-style visual editor: modules, patch cables, knobs.
   Any patch (generated, pasted, or imported from a connected AMYboard) is automatically
   reconstructed as a module graph with cables following the signal flow. Edits compile back to
   code in the background. Includes a growing module library, pre-wired module groups
   (subtractive synth, FM synth, drum machine, …) and LLM-generated custom modules.
3. **Simulator & Board I/O** — AMY compiled to WebAssembly renders audio in the browser
   (AudioWorklet) so everything works without hardware, including simulated MIDI I/O, audio-in
   and CV inputs. With a board connected (WebMIDI/SysEx), patches transfer to the AMYboard and
   parameters update on the hardware in real time.

**UI:** clean dark-mode, DAW/VCV-Rack-inspired.

## Status

Planning complete; implementation is executed by coding agents.
**Agents: read [CLAUDE.md](CLAUDE.md) first**, then work the backlog in
[docs/07-BACKLOG.md](docs/07-BACKLOG.md).

## Document map

| Doc | Contents |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Agent briefing: rules, workflow, definition of done |
| [docs/00-PROJECT_PLAN.md](docs/00-PROJECT_PLAN.md) | Phases, milestones, model-tier strategy |
| [docs/01-ARCHITECTURE.md](docs/01-ARCHITECTURE.md) | Tech stack, module boundaries, data flow |
| [docs/02-AMY_AMYBOARD_REFERENCE.md](docs/02-AMY_AMYBOARD_REFERENCE.md) | Condensed AMY/AMYboard facts (wire protocol, SysEx API, CV) |
| [docs/03-PATCHDOC_SPEC.md](docs/03-PATCHDOC_SPEC.md) | The canonical patch data model & code↔graph round-trip |
| [docs/04-MODULE_DESIGN_SYSTEM.md](docs/04-MODULE_DESIGN_SYSTEM.md) | Visual + API design system for modules |
| [docs/05-LLM_CODEGEN_SPEC.md](docs/05-LLM_CODEGEN_SPEC.md) | Strict output contracts for user-facing LLM generation |
| [docs/06-TESTING_STRATEGY.md](docs/06-TESTING_STRATEGY.md) | Test layers, golden fixtures, CI gates |
| [docs/07-BACKLOG.md](docs/07-BACKLOG.md) | Granular, agent-sized tickets with acceptance criteria |
