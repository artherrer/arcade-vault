#!/usr/bin/env bash
# PostToolUse hook (Write|Edit): format with Prettier, then lint with ESLint.
# Exit 2 sends remaining ESLint errors back to Claude so it can fix them.
set -uo pipefail

project_dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
file=$(jq -r '.tool_input.file_path // empty')

[[ -z "$file" || ! -f "$file" ]] && exit 0
case "$file" in
  "$project_dir"/*) ;;
  *) exit 0 ;;
esac
case "$file" in
  "$project_dir"/node_modules/* | "$project_dir"/.next/*) exit 0 ;;
esac

cd "$project_dir" || exit 0
bin="$project_dir/node_modules/.bin"

"$bin/prettier" --write --ignore-unknown --log-level warn "$file" >&2

case "$file" in
  *.js | *.jsx | *.ts | *.tsx | *.mjs | *.cjs)
    if ! output=$("$bin/eslint" --fix --max-warnings 0 "$file" 2>&1); then
      echo "ESLint reportó problemas en $file:" >&2
      echo "$output" >&2
      exit 2
    fi
    ;;
esac

exit 0
