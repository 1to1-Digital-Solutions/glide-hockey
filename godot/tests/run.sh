#!/usr/bin/env bash
#
# The Glide Hockey suite inside the engine, whole:
#
#   GODOT=… godot/tests/run.sh        (from the repo root; `npm run godot:test`)
#
# 1. The kit build with the tests (`npm run godot:build -- --tests`) and the import.
# 2. The domain tests: those of `src/lib` that go into the engine, the kit's (save,
#    interface, headset grammar) and the port's (`scene/**/*.engine.test.ts`: the match against
#    the web's store, the panels measured with the web's instrument, the menu with the mouse).
# 3. Each test scene of `games/glide-hockey/tests/` (the automatic match to the end and the
#    hall's challenge, the menu with the mouse in the real scene, the match with a simulated
#    headset), with `--fixed-fps 72`, like the automatic player.
#
# `--xr-mode off`: with no OpenXR runtime (any Mac) the engine would be left waiting.

set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "$PROJECT/.." && pwd)"
GODOT_BIN="${GODOT:-$(command -v godot || true)}"
if [ -z "$GODOT_BIN" ]; then
  echo "Cannot find Godot: export \$GODOT with the editor built with GodotJS." >&2
  exit 1
fi
# The cap on each run of the engine (a hung engine is a failure and not a round that does not end)
# and the search for script errors in its output (one at run time does not stop the engine, and the
# test came out green): common to every game, in the kit.
KIT="$REPO/../xrcade/godot-kit"
if [ ! -f "$KIT/runner/timeout.sh" ]; then
  echo "godot:test needs the xrcade repository checked out next to this one ($KIT): it is not part of this repository." >&2
  exit 1
fi
source "$KIT/runner/timeout.sh"

(cd "$REPO" && npm run --silent godot:build -- --tests)
con_tope "$TOPE_GODOT" "$GODOT_BIN" --headless --xr-mode off --path "$PROJECT" --import >/dev/null 2>&1 || true

failures=0
run_scene() {
  local scene="$1"
  local output status=0
  output="$(con_tope "$TOPE_GODOT" "$GODOT_BIN" --headless --xr-mode off --fixed-fps 72 --path "$PROJECT" "$scene" 2>&1)" || status=$?
  if [ "$status" -eq 0 ] && errores_de_script "$output"; then
    echo "$output" | grep -E '^[A-Z-]+ (ok|files=)|DOMAIN-TESTS' || echo "ok $scene"
  else
    # If it exited with 0, what failed are the script errors, which `errores_de_script` already showed.
    if [ "$status" -ne 0 ]; then echo "$output" | grep -E 'FAIL|CRASH|ERROR|DOMAIN-TESTS|✗' | head -40; fi
    echo "FAILS $scene" >&2
    failures=$((failures + 1))
  fi
}

run_scene res://games/glide-hockey/tests/domain_tests.tscn
for scene in "$PROJECT"/games/glide-hockey/tests/*.tscn; do
  name="$(basename "$scene")"
  [ "$name" = domain_tests.tscn ] && continue
  run_scene "res://games/glide-hockey/tests/$name"
done

exit $((failures > 0))
