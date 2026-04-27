# Git Workflow Rules

## Commit Message Format

```
<type>: <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

## Pull Request Workflow

When creating PRs:
1. Analyze full commit history (not just latest commit)
2. Use `git diff [base-branch]...HEAD` to see all changes
3. Draft comprehensive PR summary
4. Include test plan with TODOs
5. Push with `-u` flag if new branch

## Feature Implementation Workflow

1. **Plan First** - Use `planner` agent
2. **TDD Approach** - Use `tdd-guide` agent
3. **Code Review** - Use `code-reviewer` agent after writing code
4. **Commit** - Follow conventional commits format

## Branch Workflow (Portfolio_Tracker)

**Main-only by default.** Solo dev project — work directly on `main`.

- Default to `main` for all changes (commits, fixes, small features)
- Skill-forced feature branches (e.g. plan execution, worktrees) are OK but must stay **single-purpose** and short-lived
- Scope-lock docs, plan docs, spec docs always land on `main`
- Skill-created branches use prefixes when used: `feature/`, `fix/`, `refactor/`, `docs/`
- No required reviewers, no branch protection — solo accountability via commits

## CI / Deploy

- `.github/workflows/daily-quant-update.yml` — runs cron signal updates
- `.github/workflows/keep-alive.yml` — pings backend
- Render deploys backend on `main` push (see `render.yaml`)
- Vercel deploys frontend on `main` push (no repo-local config)
