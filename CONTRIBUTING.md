# Contributing to SpliceForge

Thanks for your interest in helping out! SpliceForge is an open-source fiber-optic network mapping tool, and contributions of every size are welcome — bug reports, documentation, translations, features, and review.

## Table of contents

- [Code of Conduct](#code-of-conduct)
- [License & AGPL implications](#license--agpl-implications)
- [Getting the project running locally](#getting-the-project-running-locally)
- [Making a change](#making-a-change)
- [Pull request checklist](#pull-request-checklist)
- [Reporting bugs](#reporting-bugs)
- [Proposing features](#proposing-features)
- [Translations](#translations)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to uphold it.

## License & AGPL implications

SpliceForge is licensed under **AGPL-3.0**. Before you fork, please understand what that means:

- You can use, modify, and redistribute the code freely.
- If you **run a modified version as a network service** (e.g. self-host it for others over HTTP), you must publish the modified source code to those users.
- Any contribution you submit is licensed to the project under the same AGPL-3.0 terms. You retain copyright on your work.

If those terms don't fit your use case, please open a discussion before investing time in a contribution.

## Getting the project running locally

**Prerequisites:** Node.js 18+ (20 recommended), a Supabase project (free tier works).

```bash
git clone https://github.com/wascal191/SpliceForge.git
cd SpliceForge
npm install
cp .env.local.example .env.local   # then fill in your Supabase keys
npm run dev
```

The app runs on http://localhost:7000.

For local development you can disable email confirmation in `supabase/config.toml` (set `enable_confirmations = false`) so signup is one-click. Or skip signup entirely by visiting `/demo` — no account required.

**Database schema:** see [docs/sql-schema.sql](docs/sql-schema.sql). Migration files live in [docs/migrations/](docs/migrations/).

**Architecture overview:** [docs/architecture.md](docs/architecture.md).

## Making a change

1. **Open an issue first** for anything non-trivial. This avoids duplicate work and gives maintainers a chance to weigh in on the approach.
2. Fork the repo and create a branch from `main`: `git checkout -b feat/short-description`.
3. Write your change. Keep PRs focused — one logical change per PR.
4. Add or update tests when you change behavior. Run `npm test` locally.
5. Run `npm run typecheck` and `npm run lint` and fix any errors.
6. Commit with a clear message. Conventional Commits prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) are appreciated but not required.

## Pull request checklist

Before opening a PR, verify:

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] New behavior has tests (when practical)
- [ ] User-facing strings are in `messages/en.json` and translated to `es.json` and `pt-br.json` (or marked TODO so a translator can pick them up)
- [ ] Documentation in `docs/` is updated if behavior changed
- [ ] PR description explains the *why*, not just the *what*

## Reporting bugs

Use the **Bug report** issue template. Include:

- What you did and what you expected
- What actually happened (screenshots if UI)
- Browser, OS, Node version
- Console errors or network errors
- A minimal reproduction if possible

## Proposing features

Use the **Feature request** issue template. Describe the problem you're trying to solve, not just the solution. Maintainers will discuss before anyone starts coding to keep the project's scope coherent.

## Translations

SpliceForge ships with English, Spanish, and Portuguese (Brazil). To improve a translation or add a new language:

- Edit/add the relevant file in `messages/` (e.g. `messages/fr.json`)
- Register the locale in `src/i18n/routing.ts`
- Test by switching the locale in the URL prefix (`/fr/`, `/de/`, etc.)

Native-speaker review for terminology (especially fiber-network jargon) is highly valued.
