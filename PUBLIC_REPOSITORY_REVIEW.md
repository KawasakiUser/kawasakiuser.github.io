# G6-B public repository review

This repository and every branch, ref, object, PR diff and Actions log can expose material as soon as it is sent to GitHub. Keep private authoring, credentials, real unapproved content, private evidence and asset originals in a separate private workspace. A failed status check or a later deletion cannot retract a public push. Do not upload local draft history.

## Before committing or pushing

1. Work in a synthetic-only checkout. Run `npm ci`, then enable the checked-in hooks with `git config --local core.hooksPath .githooks`. Use only an authorized G6-B branch. Keep credentials and application write permissions restricted to designated integrators.
2. Stage named files. Review `git diff --cached --name-status` and `git diff --cached --check`, then read the entire staged diff including documentation, JSON and the patch or assets themselves. A second designated reviewer should read novel content and changes to the reviewed path/hash inventories before the first public transfer. Exchange the proposed patch in an approved private review channel when needed. File contents that resemble code may still contain confidential information.
3. `npm run validate` scans the working checkout, including ignored files outside exact generated roots and the Git index. `bash scripts/verify-public-tree.sh <SHA>` verifies the exact committed tree in isolation. The hooks run the second gate against the staged tree and outgoing commit. Keep both checks in the workflow when using an API or UI that does not run local hooks.
4. Push one reviewed direct child of the pinned remote head to the existing G6-B branch and verify the Draft PR head. For a new G6-B branch only, set `G6B_REVIEWED_BASE_SHA` to the actual PCS-reviewed parent. A multi-commit or merge update requires reviewing every outgoing tree and arranging a controlled candidate with PCS.
5. The source fixture manifest and asset catalog require independent provenance and exact hashes. The repository inventory additionally pins reference/test data outside those roots. A new engineering path or changed reference hash requires review of both the file and the inventory entry. Never add a path or refresh a hash simply to silence the gate.

## Repository permissions

PCS/RELEASE and the Owner retain the repository settings gate. Restrict write access to the minimum required actors. Where supported, protect main against direct pushes and require review and passing checks. Limit controlled branch updates to authorized integrators, and keep workflow permissions read-only by default. Main protections alone do not stop someone with repository write access from exposing a draft on another branch. Local hooks are opt-in and can be bypassed, so pre-transfer review and access restriction are essential. GitHub CI is the second line of defense. This candidate changes no remote settings.
