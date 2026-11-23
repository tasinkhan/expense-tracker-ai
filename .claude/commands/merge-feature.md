---
description: Merge a feature branch built by /parallel-agents into main and check it
argument-hint: <feature-name>   (for example: top-vendors)
allowed-tools: Read, Grep, Edit, Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git merge:*), Bash(git add:*), Bash(git commit:*), Bash(npm install:*), Bash(npm run typecheck:*), Bash(npm run lint:*), Bash(npm run build:*)
---

Merge `feature/$ARGUMENTS` into `main`. If no name is given, list unmerged branches (`git branch --no-merged main`) and ask which one.

1. On `main` with a clean `git status`. If there are uncommitted changes, stop and ask what to do with them.
2. Read `$ARGUMENTS.work.txt` and `git diff --stat main...feature/$ARGUMENTS`, then summarise what is coming in.
3. `git merge --no-ff feature/$ARGUMENTS`. Resolve conflicts by keeping both sides (for example, every Navbar link). For `package-lock.json`, take main's version and rerun `npm install`. Ask the user if a conflict is about how the product should behave.
4. Run typecheck, lint and build. Report the merge SHA, the conflicts you resolved, and the results. Do not push or delete the worktree or branch.
