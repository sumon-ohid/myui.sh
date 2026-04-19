# Project Blueprint: myui.sh — AI UI Design CLI on Claude Agent SDK

## 1. Vision

Terminal-driven AI design engineer. Generates production-ready UI components with enforced design system, validation gates, and safe AST integration. Sits on top of **Claude Agent SDK** — Claude does the generation, myui orchestrates: structured output, multi-variant, design constraints, validation, integration, cleanup.

Differentiator vs v0/Lovable/bolt:
- Lives in terminal, integrates into existing repo (not new project)
- Hard design-system enforcement (AST + token validation, not prompt-only)
- Figma URL → component via MCP
- Eval harness for prompt regression
- Reuses existing project components (shadcn registry, project primitives)

---

## 1a. Engineering Principles (apply to every feature)

Non-negotiable. Every PR, every function, every review checks these.

- **Security first.** Treat model output as untrusted input. Sandbox code execution. Validate/escape all paths, shell args, imports. No `eval`, no unescaped `exec`, no shell-string interpolation — use `spawn` with arg arrays. Allowlist deps, lockfile-aware installs, path traversal checks on all `fs` writes (no writes outside project root or `.myui/`). Secrets never logged. Respect user's API key — read once, never persist.
- **Edge cases considered up front.** For every function: empty input, oversized input, unicode, concurrent calls, missing files, permission errors, network failure, SDK rate limit, SIGINT mid-operation, partial writes, symlinks, Windows path separators, monorepo roots, Tailwind v3 vs v4, TS vs JS, existing-file collisions. Document edge cases in code comments only when non-obvious; handle them in code always.
- **Clean, maintainable code.** Single responsibility per function. Pure where possible. Explicit types (no `any`). Narrow interfaces at layer boundaries (`core` ↔ `cli` ↔ `preview`). No dead code, no commented-out blocks, no speculative abstractions. Prefer composition over inheritance. Name things for what they are, not how they're used. Max ~50 lines per function — split when it grows. No circular deps between packages.
- **Tested.** Every `core` function has unit tests. Validation gate + AST integration get integration tests with fixture projects. Eval harness covers end-to-end. No merge without green tests.
- **Fail loud, recover gracefully.** Errors surface to user with actionable messages, not stack traces. Repair loop on SDK failure, not silent retry. Always cleanup `.myui/` scratch on crash.

---

## 2. Architecture

Three layers. Split early. Core testable without TTY.

```
myui/
├── packages/
│   ├── core/          SDK orchestration, schema, validation, AST, session
│   ├── cli/           Commander commands, prompts (Clack), TTY rendering
│   └── preview/       Vite daemon OR Playwright screenshot fallback
├── apps/
│   └── eval/          Golden prompt set + visual diff harness
└── pnpm-workspace.yaml
```

**Stack:**
- Runtime: Node 20+, TypeScript, ESM
- Package manager: pnpm workspaces
- AI: `@anthropic-ai/claude-agent-sdk` — Sonnet 4.6 default, Opus 4.7 opt-in. **Auth:** inherits Claude Code local credentials automatically (subscription users); falls back to `ANTHROPIC_API_KEY` if set. No key required when Claude Code is installed.
- CLI: Commander + `@clack/prompts`
- Schema: Zod (single source of truth, derive JSON schema for SDK tool)
- AST: `ts-morph`
- Format: Prettier API (resolve project config)
- Preview: Vite daemon (persistent) + Playwright (screenshot fallback)
- MCP: Figma server for `--figma <url>`

---

## 3. CLI Surface

Canonical commands (alias in parens):

- `myui init` — scaffold `myui.config.json`, detect framework/Tailwind/shadcn, write base rules
- `myui generate <prompt>` (`gen`) — generate component(s)
  - `--variants <n>` default 1, max 3
  - `--figma <url>` ingest Figma node as design source
  - `--model sonnet|opus` default sonnet
  - `--auto-install` opt-in dep install (default: print command)
  - `--out <path>` override destination
- `myui refine <session-id> <prompt>` — resume session, iterate on selected variant
- `myui daemon start|stop|status` — manage persistent Vite preview
- `myui eval` — run golden prompt set, diff screenshots vs baseline
- `myui doctor` — diagnose project setup (Tailwind version, shadcn, formatter, TS)

---

## 4. Generation Flow

```
1. Parse cmd → load myui.config.json + detect project context
2. Build SDK query:
   - system prompt (design-system rules, accessibility, component policy)
   - tool: emit_variants (Zod schema, strict)
   - context: tailwind tokens, shadcn registry, project component index, optional Figma
3. SDK call → Sonnet 4.6 with tool-use forced
4. Parse tool result → Zod validate → repair loop on fail (max 2 retries)
5. Validation gate per variant:
   - AST scan: no forbidden imports, no raw <button> if Button exists, no inline styles
   - Token check: only allowed Tailwind classes (parse + match against config)
   - A11y check: aria-label presence on interactive elements, semantic tags
   - Failed variants → SDK repair turn with diagnostic
6. Render preview:
   - daemon running → HMR variants into running Vite
   - else → Playwright screenshot per variant, show inline (iTerm/Kitty) or save PNG
7. Prompt user: select 1..N, refine, or cancel
8. Integration (AST):
   - infer component name from prompt
   - collision: append numeric suffix
   - ts-morph: write file, add imports to barrel, update exports
   - Prettier format
9. Dependency resolution:
   - allowlist check
   - default: print install cmd; --auto-install: confirm + run with lockfile
10. Cleanup: remove .myui/ scratch, persist session for refine, kill daemon if ephemeral
11. Report: tokens used, cost (SDK usage), files written
```

---

## 5. Schema (Zod, strict)

```ts
const Variant = z.object({
  id: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  description: z.string().min(1).max(200),
  code: z.string().min(1),
}).strict();

const GenerationResult = z.object({
  variants: z.array(Variant).min(1).max(3),
  dependencies: z.array(z.string()).default([]),
  componentName: z.string().regex(/^[A-Z][A-Za-z0-9]*$/),
}).strict();
```

Used as SDK tool input schema. Validation failure → repair turn with Zod error fed back.

---

## 6. Design System Enforcement

Three layers, in order:

1. **Prompt** — system prompt declares allowed tokens, forbidden patterns, component library
2. **Schema** — structured output, no free-text code blocks
3. **AST gate** — post-gen validation, hard reject + repair

AST rules (configurable in `myui.config.json`):
- `forbiddenImports`: e.g. `["styled-components", "@emotion/*"]`
- `requirePrimitives`: `{ "button": "Button", "input": "Input" }` — raw HTML banned if primitive exists
- `allowedTailwindTokens`: derived from `tailwind.config.{js,ts}` or Tailwind v4 CSS tokens
- `requireA11y`: `{ button: ["aria-label|children-text"], img: ["alt"] }`

---

## 7. Context Discovery

Detection order (run in `init` and cached, refreshed on demand):

1. Package manager: lockfile check (pnpm/npm/yarn/bun)
2. Framework: `package.json` deps (next, vite+react, remix, astro, vue, svelte)
3. TS vs JS: `tsconfig.json`
4. Tailwind: v3 (`tailwind.config.{js,ts}`) vs v4 (CSS `@theme`); extract tokens
5. Component registry: shadcn `components.json`, custom primitives in `src/components/ui/`
6. Formatter: `.prettierrc`, `eslint.config.*`
7. Path alias: `tsconfig.json` `paths` (`@/components` etc.)

Cached in `.myui/context.json`. `myui doctor` validates.

---

## 8. Session & Refine

Each generation creates session:
```
.myui/sessions/<session-id>/
  ├── meta.json        prompt, model, timestamp, selected variant
  ├── thread.json      SDK message history for resume
  └── variants/*.tsx   all generated variants (selected + rejected)
```

`myui refine <session-id> "make buttons larger"` → resume SDK thread, single new variant, replace selected file via AST.

Sessions GC after 7 days unless pinned.

---

## 9. Preview

**Daemon mode (default if `myui daemon start` run):**
- Persistent Vite on `localhost:9999`
- New variants HMR'd in via file write to `.myui/preview/`
- Cold start eliminated

**Ephemeral mode:**
- Spawn Vite per gen, kill on selection
- Use `spawn` not `exec`, capture stderr, wait for "ready" line before prompting
- Cleanup hooks: `SIGINT`, `SIGTERM`, `uncaughtException`, `finally`

**Headless fallback (CI, SSH, no browser):**
- Playwright headless renders each variant → PNG to `.myui/screenshots/`
- Inline display via iTerm2/Kitty image protocol where supported
- Path printed otherwise

---

## 10. Dependency Safety

- Allowlist in `myui.config.json` (defaults: `react`, `react-dom`, `lucide-react`, `recharts`, `clsx`, `tailwind-merge`, `class-variance-authority`, shadcn primitives)
- AST scan generated code → diff against project deps
- Default: print exact install command, exit
- `--auto-install`: prompt confirm, run with lockfile flag (`pnpm add --save-exact`, `npm install --save-exact`)
- Optional: `npm audit --omit=dev` post-install
- Hard reject: any package not on allowlist (override per-project)

---

## 11. Eval Harness

`apps/eval/` — separate package.

- Golden prompts: `eval/prompts/*.json` (prompt + expected dependencies + a11y assertions)
- Run: `myui eval` generates against each, runs validation gate, captures Playwright screenshot
- Compare screenshot to `eval/baseline/*.png` via pixelmatch
- Fail if: validation gate fails, screenshot diff > threshold, dep allowlist violated
- Update baseline: `myui eval --update`
- CI: GitHub Action runs on PR

---

## 12. Telemetry

- SDK exposes token usage per request → show in CLI footer
- Per-gen cost calculated from current pricing table (cached, updated on release)
- `myui --usage` cumulative session totals
- No phone-home. All local.

---

## 13. Roadmap

### Phase 1 — Core SDK + Schema (Week 1-2)
- pnpm workspace scaffold
- `core`: SDK wrapper, Zod schema, repair loop
- `cli`: `init`, `generate` (single variant, no preview, write file)
- Project context detection (Tailwind v3/v4, framework, TS)
- **Deliverable:** `myui generate "button"` writes one validated component

### Phase 2 — Validation Gate + AST Integration (Week 3-4)
- AST rules engine (`ts-morph`)
- Token validator (Tailwind config parser)
- A11y checker
- AST integration (imports, barrel exports, collision)
- Prettier formatting
- **Deliverable:** generated code passes design-system rules or repairs

### Phase 3 — Multi-Variant + Preview (Week 5-6)
- `--variants` up to 3
- Vite daemon (`myui daemon`)
- Playwright headless fallback
- Clack interactive selection
- Process lifecycle hardening
- **Deliverable:** 3 variants previewed, selected, integrated

### Phase 4 — Refine + Figma + Sessions (Week 7-8)
- Session persistence
- `myui refine` with SDK resume
- MCP Figma integration `--figma <url>`
- Dependency allowlist + `--auto-install`
- **Deliverable:** Iterate on variants, ingest Figma designs

### Phase 5 — Eval + Polish + Release (Week 9-10)
- Eval harness with golden set
- `myui doctor`
- Telemetry/cost reporting
- Docs site
- npm publish `myui` (or `@myui-sh/cli`)
- **Deliverable:** v1.0.0

---

## 14. Definition of Done (v1.0)

`myui generate "pricing section"` ships when:

1. SDK call returns Zod-valid result, ≤2 repair turns
2. Every variant passes AST + token + a11y gate
3. Preview (daemon or screenshot) renders without manual intervention
4. Selected variant integrates via ts-morph, no broken imports
5. Missing deps: allowlisted, install command shown (or run with confirm)
6. Final files Prettier-formatted, lint-clean
7. Process teardown clean on success, cancel, SIGINT, crash
8. Session persisted, `refine` resumes correctly
9. Eval harness green on golden set
10. Cost + token usage reported

---

## 15. Out of Scope (v1)

- Vue/Svelte/Angular generation (React only)
- Backend code generation
- Full-page generation (component-level only)
- Hosted service / cloud sync
- Visual editor UI
- Non-Tailwind styling (CSS Modules, styled-components, etc.)

Revisit post-v1 based on demand.


# Improvements

--- before registering the slog in _index.ts should creat the variants
first create variants then add the slot in  _index.ts, like this we can skip the "Module not found: Can't resolve './Variant1'". error. 

-- Need to improve the floating tab ui/ux
-- Component ui/ux in the preview mode little weird, padding and spacings and others, but after applying it looks normal

-- Everytime claude add back the previous created variants thats applied. 

-- move the .myui dir inside project src