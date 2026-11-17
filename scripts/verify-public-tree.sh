#!/usr/bin/env bash
set -euo pipefail
root=$(git rev-parse --show-toplevel)
tree=$(git rev-parse --verify "${1:?Supply a commit or tree SHA}^{tree}")
temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT

# Git archive omits Git metadata and may omit entry types or export-ignored paths.
# Audit the original tree modes and make sure every tracked blob reaches the gate.
git ls-tree -rz "$tree" > "$temp/tree-index"
mkdir "$temp/source"
git archive "$tree" | tar -x -C "$temp/source"
while IFS= read -r -d '' entry; do
  mode=${entry%% *}
  path=${entry#*$'\t'}
  case "$mode" in 100644|100755) ;; *) echo "PUBLIC_REPO_GIT_MODE: $path" >&2; exit 1 ;; esac
  case "${path%%/*}" in
    .git|node_modules|dist|.astro|artifacts|validation-output.json)
      echo "PUBLIC_REPO_GENERATED: $path" >&2; exit 1 ;;
  esac
  if [[ ! -f "$temp/source/$path" ]]; then
    echo "PUBLIC_REPO_ARCHIVE_MISSING: $path" >&2; exit 1
  fi
done < "$temp/tree-index"
ln -s "$root/node_modules" "$temp/source/node_modules"
(cd "$temp/source" && npm run validate)
printf 'PASS exact public Git tree: %s\n' "$tree"
