#!/bin/sh
# harness/test/lint-rules.sh: tests for the lint rules of spec 0004 (AC-6, AC-11, AC-13 lint parts; rule ids in spec §9).
# A fixture is a copy, in a temp dir, of the tracked repository tree (the working-tree files `git ls-files` lists) plus
# only the change under test, so every other lint rule passes on it. lint.js reads the fixture through COMPANY_LINT_ROOT.
# Every negative case asserts exit 1, the FAIL line of its own rule id, and that no other rule fails.
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
REPO=$(dirname "$HERE")
LINT="$HERE/bin/lint.js"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
pass=0; fail=0
BASE="$T/base"; C="$T/c"

t() { # t <name> <expected> <actual>
  if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok    $1"; else fail=$((fail+1)); echo "FAIL  $1 (expected $2, got $3)"; fi
}

# --- fixture base: the tracked tree, copied file by file ------------------------------------
mkdir -p "$BASE"
node -e '
const fs = require("fs"), path = require("path"), cp = require("child_process");
const [repo, dst] = process.argv.slice(1);
const names = cp.execFileSync("git", ["-C", repo, "ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean);
let n = 0;
for (const f of names) {
  const from = path.join(repo, f), to = path.join(dst, f);
  let st; try { st = fs.lstatSync(from); } catch { continue; }           // tracked, deleted in the working tree
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (st.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(from), to); else if (st.isFile()) fs.copyFileSync(from, to); else continue;
  n++;
}
console.log(n);
' "$REPO" "$BASE" > "$T/base.count" 2> "$T/base.err"
n=$(cat "$T/base.count")
if [ "${n:-0}" -ge 50 ] 2>/dev/null; then pass=$((pass+1)); echo "ok    fixture base: $n tracked files copied"; else fail=$((fail+1)); echo "FAIL  fixture base not built: $(head -n 2 "$T/base.err")"; fi

fresh() { rm -rf "$C"; cp -R "$BASE" "$C"; }
lint() { # lint <root|->: runs lint.js, output in $T/out, exit code in $rc
  if [ "$1" = "-" ]; then ( unset COMPANY_LINT_ROOT; node "$LINT" ) > "$T/out" 2>&1; rc=$?
  else COMPANY_LINT_ROOT="$1" node "$LINT" > "$T/out" 2>&1; rc=$?; fi
}
has()  { if grep -Eq "$1" "$T/out"; then echo yes; else echo no; fi; }
fails() { grep -c '^FAIL ' "$T/out"; }
others() { grep '^FAIL ' "$T/out" | grep -Evc "^FAIL  $1( |:|\$)"; }
neg() { # neg <name> <rule id>: the fixture in $C must fail with that rule and no other
  lint "$C"
  t "$1: exit 1" 1 "$rc"
  t "$1: FAIL  $2" yes "$(has "^FAIL  $2( |:|\$)")"
  t "$1: no other rule fails" 0 "$(others "$2")"
}
ACTIVE=$(cd "$BASE" 2>/dev/null && ls specs/active/*.md 2>/dev/null | head -n 1)
unlocks() { # unlocks <value>: replaces the Unlocks: line of the active spec in $C
  sed "s|^- Unlocks: .*\$|- Unlocks: $1|" "$C/$ACTIVE" > "$T/spec.tmp" && cp "$T/spec.tmp" "$C/$ACTIVE"
}
draft() { # draft <value>: adds one draft spec with that Unlocks: line to $C
  mkdir -p "$C/specs/draft"
  printf '%s\n' '# Spec 9999: lint case' '- Status: Draft' "- Unlocks: $1" '' '## 1. Intent' 'x' > "$C/specs/draft/9999-lint-case.md"
}
jedit() { # jedit <file> <js statements on `j`>: edits a JSON file in $C
  node -e 'const fs=require("fs");const f=process.argv[1];const j=JSON.parse(fs.readFileSync(f,"utf8"));new Function("j",process.argv[2])(j);fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n");' "$C/$1" "$2"
}
HOSTSET=".claude/settings.json"; CONTSET="harness/container-settings.json"; FX="harness/test/fixtures"

t "fixture base has one active spec with an Unlocks: line" 1 "$(grep -c '^- Unlocks: ' "$BASE/$ACTIVE" 2>/dev/null)"

# --- AC-6: COMPANY_LINT_ROOT, baseline, real repository --------------------------------------
fresh; lint "$C"
t "AC-6 baseline fixture: exit 0" 0 "$rc"
t "AC-6 baseline fixture: no FAIL line" 0 "$(fails)"
t "AC-6 override: first line is LINT ROOT OVERRIDDEN: <path>" "LINT ROOT OVERRIDDEN: $C" "$(head -n 1 "$T/out")"
t "AC-6 baseline fixture: header rule reports ok" yes "$(has '^ok    unlocks-header')"
t "AC-6 baseline fixture: row-2 rule reports ok" yes "$(has '^ok    unlocks-row2')"
t "AC-11 baseline fixture: wrapper rule reports ok" yes "$(has '^ok    hook-wrapper')"
t "AC-13 baseline fixture: fixture rule reports ok" yes "$(has '^ok    fixture-sanitized')"
lint -
t "AC-6 real repository: exit 0" 0 "$rc"
t "AC-6 real repository: no override line" no "$(has '^LINT ROOT OVERRIDDEN')"
t "AC-6 real repository: no FAIL line" 0 "$(fails)"
# the override really moves the root: an empty directory cannot pass
mkdir -p "$T/empty"; lint "$T/empty"
t "AC-6 override to an empty directory does not lint the real repository" no "$(if [ "$rc" -eq 0 ]; then echo yes; else echo no; fi)"

# check unsets the override before lint runs (asserted on the file text)
CHK="$HERE/bin/check"
u=$(grep -n '^unset COMPANY_LINT_ROOT' "$CHK" | head -n 1 | cut -d: -f1)
l=$(grep -n 'bin/lint\.js"' "$CHK" | grep -n 'step ' | head -n 1 | cut -d: -f2)
t "AC-6 check unsets COMPANY_LINT_ROOT" yes "$(if [ -n "$u" ]; then echo yes; else echo no; fi)"
t "AC-6 check unsets it before the lint step" yes "$(if [ -n "$u" ] && [ -n "$l" ] && [ "$u" -lt "$l" ]; then echo yes; else echo no; fi)"
t "check runs lint-rules.sh" yes "$(if grep -q 'test/lint-rules\.sh' "$CHK"; then echo yes; else echo no; fi)"

# --- AC-6: Unlocks: header rule (active FAIL) ------------------------------------------------
for v in '`harness/test/{a,b}.sh`' '`templates/[ab].md`' '`!templates/x.md`' '`../x`' '`/abs/x`' '`~/x`' '`$X/y`' '`templates/a**`' '`./templates/x.md`' '`templates/x.md`, , `evals/y.md`'; do
  fresh; unlocks "$v"; neg "AC-6 active spec, invalid header $v" unlocks-header
done
fresh; printf '%s\n' '# Spec' '- Unlocks: `templates/x.md`' '- Unlocks: `evals/y.md`' '' '## 1. Intent' 'x' > "$C/specs/active/9998-twice.md"
neg "AC-6 active spec, Unlocks: twice" unlocks-header
fresh; unlocks '`templates/x.md`, `evals/**`'; lint "$C"
t "AC-6 active spec, valid product-config globs: exit 0" 0 "$rc"

# --- AC-6: row-2 overlap rule (active FAIL) --------------------------------------------------
for v in '`harness/**`' '`.claude/**`' '`**/CLAUDE.md`' '`harness/*.js`' '`harness/bin/*.sh`' '`**`' '`.github/**`' '`harness/keys/*`' 'HARNESS/GATE.JS'; do
  fresh; unlocks "$v"; neg "AC-6 active spec, glob reaches enforcement $v" unlocks-row2
done
# a sample-list path that is no file of the tree still counts
fresh; unlocks '`.claude/commands/*.md`'; neg "AC-6 active spec, glob reaches a sample-list path" unlocks-row2
fresh; unlocks '`harness/x.js`'; lint "$C"; t "AC-17 active spec, exact path of a future harness script is valid: exit 0" 0 "$rc"
# --- AC-17 (delta 2026-11-22): an exact path may open an enforcement file, a glob never does --
# The three literal items that left the two lines above are valid now; each has a glob twin that still fails.
t "AC-17 exact harness/x.js: no FAIL line" 0 "$(fails)"
t "AC-17 exact harness/x.js: row-2 rule reports ok" yes "$(has '^ok    unlocks-row2')"
fresh; unlocks '`.mcp.json`'; lint "$C"
t "AC-17 exact .mcp.json: exit 0" 0 "$rc"
t "AC-17 exact .mcp.json: no FAIL line" 0 "$(fails)"
fresh; unlocks '`templates/**`, `harness/container-settings.json`'; lint "$C"
t "AC-17 exact harness/container-settings.json next to a product-config glob: exit 0" 0 "$rc"
t "AC-17 exact harness/container-settings.json: no FAIL line" 0 "$(fails)"
fresh; unlocks '`CLAUDE.md`, `harness/gate.js`, `harness/x.js`, `.mcp.json`, `harness/container-settings.json`, `templates/**`'; lint "$C"
t "AC-17 six entries, five exact enforcement paths: exit 0" 0 "$rc"
t "AC-17 six entries: no FAIL line" 0 "$(fails)"
t "AC-17 six entries: row-2 rule reports ok" yes "$(has '^ok    unlocks-row2')"
for v in '`CLAUDE.m?`' '`harness/gate.j*`' '`harness/?.js`' '`.mcp.jso?`' '`templates/**`, `harness/container-settings.jso?`'; do
  fresh; unlocks "$v"; neg "AC-17 active spec, glob twin reaches enforcement $v" unlocks-row2
done
for v in '`approvals/x.json`' '`.git/config`' '`harness/keys/ceo.pub.pem`' '`src/approvals/x.json`' '`.claude/settings.local.json`' '`harness/bin/ceo-keygen.sh`' '`CLAUDE.md`, `harness/keys/k.pem`'; do
  fresh; unlocks "$v"; neg "AC-17 active spec, locked literal $v" unlocks-row2
  t "AC-17 locked literal $v: the message says no header opens it" yes "$(has '^FAIL  unlocks-row2 .*no header opens signatures, keys or git metadata')"
done
for v in '`claude.md`' '`Harness/Gate.js`' '`.MCP.json`' '`CLAUDE.md`, `harness/GUARD.js`'; do
  fresh; unlocks "$v"; neg "AC-17 active spec, wrongly cased literal $v" unlocks-row2
done
fresh; draft '`harness/keys/ceo.pub.pem`'; lint "$C"
t "AC-17 draft, locked literal: exit 0" 0 "$rc"
t "AC-17 draft, locked literal: WARN  unlocks-row2" yes "$(has '^WARN  unlocks-row2( |:)')"
t "AC-17 draft, locked literal: the WARN line names the draft" yes "$(has '^WARN  unlocks-[a-z0-9]* "specs/draft/9999')"
t "AC-17 draft, locked literal: no FAIL line" 0 "$(fails)"
fresh; draft '`CLAUDE.md`'; lint "$C"
t "AC-17 draft, exact CLAUDE.md: exit 0" 0 "$rc"
t "AC-17 draft, exact CLAUDE.md: no WARN line for it" no "$(has '^WARN  unlocks-[a-z0-9]* "specs/draft/9999')"
t "AC-17 draft, exact CLAUDE.md: no FAIL line" 0 "$(fails)"
fresh; draft '`CLAUDE.m?`'; lint "$C"
t "AC-17 draft, glob twin: WARN  unlocks-row2 names the draft" yes "$(has '^WARN  unlocks-row2 "specs/draft/9999')"
# carve-outs stay unlockable: no false alarm
fresh; unlocks '`.claude/agents/**`, `.claude/skills/**`, `.claude/rules/**`, `harness/test/**`, `harness/bin/check`, `harness/bin/lint.js`'; lint "$C"
t "AC-6 active spec, product-config globs under .claude/ and harness/: exit 0" 0 "$rc"
t "AC-6 active spec, product-config globs: no FAIL line" 0 "$(fails)"

# --- AC-6 / Ruling R-10: drafts get WARN -----------------------------------------------------
fresh; draft '`harness/test/{a,b}.sh`'; lint "$C"
t "R-10 draft, invalid header: exit 0" 0 "$rc"
t "R-10 draft, invalid header: WARN  unlocks-header" yes "$(has '^WARN  unlocks-header( |:)')"
t "R-10 draft, invalid header: no FAIL line" 0 "$(fails)"
fresh; draft '`harness/**`'; lint "$C"
t "R-10 draft, glob reaches enforcement: exit 0" 0 "$rc"
t "R-10 draft, glob reaches enforcement: WARN  unlocks-row2" yes "$(has '^WARN  unlocks-row2( |:)')"
t "R-10 draft, glob reaches enforcement: no FAIL line" 0 "$(fails)"
fresh; draft '`templates/x.md`'; lint "$C"
t "R-10 draft, valid header: no WARN for it" no "$(has '^WARN  unlocks-[a-z0-9]* "specs/draft/9999')"

# --- AC-11: hook-wrapper rule ----------------------------------------------------------------
W='|| exit 2'
fresh; jedit "$HOSTSET" 'for (const e of j.hooks.PreToolUse) for (const h of e.hooks) if (e.matcher === "Bash") h.command = h.command.replace(" || exit 2", "");'
neg "AC-11 host guard command for Bash without the wrapper" hook-wrapper
fresh; jedit "$HOSTSET" 'for (const e of j.hooks.PreToolUse) for (const h of e.hooks) if (/Write/.test(e.matcher || "")) h.command = h.command.replace(" || exit 2", "");'
neg "AC-11 host guard command for file tools without the wrapper" hook-wrapper
fresh; jedit "$HOSTSET" 'for (const e of j.hooks.PreToolUse) for (const h of e.hooks) h.command = h.command.replace("|| exit 2", "|| exit 1");'
neg "AC-11 host guard command with exit 1 instead of exit 2" hook-wrapper
fresh; jedit "$HOSTSET" 'for (const e of j.hooks.PreToolUse) for (const h of e.hooks) h.command = h.command.replace(" || exit 2", " || exit 2; true");'
neg "AC-11 host guard command where the wrapper is not the suffix" hook-wrapper
fresh; jedit "$HOSTSET" 'j.hooks.PreToolUse.push({ matcher: "NotebookEdit", hooks: [{ type: "command", command: "node \"$CLAUDE_PROJECT_DIR/harness/gate.js\" --host" }] });'
neg "AC-11 host gate command without the wrapper" hook-wrapper
fresh; jedit "$HOSTSET" 'j.hooks.PreToolUse.push({ matcher: "NotebookEdit", hooks: [{ type: "command", command: "node \"$CLAUDE_PROJECT_DIR/harness/gate.js\" --host || exit 2" }] });'; lint "$C"
t "AC-11 host gate command with the wrapper: hook-wrapper does not fail" no "$(has '^FAIL  hook-wrapper')"
fresh; jedit "$HOSTSET" 'for (const e of j.hooks.Stop) for (const h of e.hooks) h.command += " || exit 2";'
neg "AC-11 host stop command with the wrapper" hook-wrapper
fresh; jedit "$CONTSET" 'for (const e of j.hooks.PreToolUse) for (const h of e.hooks) h.command = h.command.replace(" || exit 2", "");'
neg "AC-11 container gate command without the wrapper" hook-wrapper
t "AC-11 the wrapper text is present in the tracked settings" yes "$(if grep -qF "$W" "$BASE/$HOSTSET" && grep -qF "$W" "$BASE/$CONTSET"; then echo yes; else echo no; fi)"

# --- AC-13: fixture-sanitized rule -----------------------------------------------------------
FIRST=$(cd "$BASE/$FX" 2>/dev/null && ls *.json 2>/dev/null | head -n 1)
t "AC-13 the tracked tree has a fixture to test with" yes "$(if [ -n "$FIRST" ]; then echo yes; else echo no; fi)"
fresh; jedit "$FX/$FIRST" 'j.cwd = "/Users/" + "someone/project";'
neg "AC-13 fixture with a /Users/ path" fixture-sanitized
fresh; jedit "$FX/$FIRST" 'j.cwd = "/home/" + "someone/project";'
neg "AC-13 fixture with a /home/<name> path" fixture-sanitized
fresh; jedit "$FX/$FIRST" 'j.session_id = ["0f8fad5b", "d9cb", "469f", "a165", "70867728950e"].join("-");'
neg "AC-13 fixture with a UUID" fixture-sanitized
fresh; jedit "$FX/$FIRST" 'j.session_id = ["0F8FAD5B", "D9CB", "469F", "A165", "70867728950E"].join("-");'
neg "AC-13 fixture with an upper-case UUID" fixture-sanitized
fresh; printf '%s\n' '{ "cwd": "/work/agency", ' > "$C/$FX/broken.json"
neg "AC-13 fixture that does not parse" fixture-sanitized
fresh; printf '%s\n' '{ "transcript_path": "/Users/'"x"'/t.jsonl" }' > "$C/$FX/extra.json"
neg "AC-13 a new fixture file with a home path" fixture-sanitized
fresh; rm -f "$C/$FX"/*.json
neg "AC-13 no fixture left" fixture-sanitized
fresh; jedit "$FX/$FIRST" 'j.cwd = "/home-dir/project"; j.note = "abcdef12-34";'; lint "$C"
t "AC-13 sanitized placeholders pass" no "$(has '^FAIL  fixture-sanitized')"

# --- AC-14: texts-0004 rule (README and template parts) --------------------------------------
# redit <file> <js expression on the text `s`>: rewrites a text file in $C; prints yes when the text changed (a case
# whose edit changes nothing would test nothing).
redit() {
  node -e 'const fs=require("fs");const f=process.argv[1];const s=fs.readFileSync(f,"utf8");const o=new Function("s","return ("+process.argv[2]+");")(s);fs.writeFileSync(f,o);process.stdout.write(o!==s?"yes":"no");' "$C/$1" "$2" 2>/dev/null || printf error
}
tneg() { # tneg <name> <file> <edit> <message pattern>: the edited fixture fails texts-0004 alone, with that message
  fresh; t "$1: the edit changed the file" yes "$(redit "$2" "$3")"
  neg "$1" texts-0004
  t "$1: the message" yes "$(has "^FAIL  texts-0004 .*$4")"
}
RD="harness/README.md"; TT="templates/spec-tam.md"; TQ="templates/spec-hizli.md"
fresh; lint "$C"
t "AC-14 baseline fixture: texts rule reports ok" yes "$(has '^ok    texts-0004')"
# Ruling P-5: the cases T-8 ran by hand, now permanent (checks written in T-8)
tneg "AC-14 README without the section Bilinen boşluklar" "$RD" 's.replace("\n## Bilinen boşluklar\n", "\n## Bilinen eksikler\n")' "section '## Bilinen boşluklar' missing"
tneg "AC-14 README gap table without the row G-7" "$RD" 's.split("\n").filter((l) => !l.startsWith("| G-7 |")).join("\n")' "lacks G-7(;|\$)"
tneg "AC-14 README gap table without the row G-22 (the mention G-1..G-22 is no row)" "$RD" 's.split("\n").filter((l) => !l.startsWith("| G-22 |")).join("\n")' "lacks G-22(;|\$)"
tneg "AC-14 README row G-2 moved out of the section" "$RD" '((l) => l.filter((x) => !x.startsWith("| G-2 |")).join("\n") + "\n## Ek\n\n" + l.find((x) => x.startsWith("| G-2 |")) + "\n")(s.split("\n"))' "lacks G-2(;|\$)"
tneg "AC-14 README without the section Yol sınıfları" "$RD" 's.replace("\n## Yol sınıfları\n", "\n## Yollar\n")' "section '## Yol sınıfları' missing"
tneg "AC-14 README without the strength order" "$RD" 's.split("hard-deny > enforcement > product-config").join("hard-deny > product-config > enforcement")' "lacks the strength order"
tneg "AC-14 README without the two-path rule name" "$RD" 's.split("stronger class wins").join("the stronger one wins")' "lacks the rule 'classify both"
tneg "AC-14 spec-tam template without the Unlocks: line" "$TT" 's.split("\n").filter((l) => !l.startsWith("- Unlocks: ")).join("\n")' "templates/spec-tam.md: the header must carry .* found 0"
tneg "AC-14 spec-hizli template with the Unlocks: line twice" "$TQ" 's.replace(/^(- Unlocks: .*)$/m, "$1\n$1")' "templates/spec-hizli.md: the header must carry .* found 2"
tneg "AC-14 spec-hizli template with the Unlocks: line below the first section" "$TQ" '((l) => l.filter((x) => !x.startsWith("- Unlocks: ")).join("\n") + "\n" + l.find((x) => x.startsWith("- Unlocks: ")) + "\n")(s.split("\n"))' "templates/spec-hizli.md: the header must carry .* found 0"
# delta 2026-11-22 (T-8b): the three README sections of the delta and the G-1 row
EXACT='an exact path may open an enforcement file, a glob never does'
BLOCKHEAD='ENFORCEMENT FILES THIS SIGNATURE OPENS'
tneg "AC-14 README Yol sınıfları without the rule name of 7.3" "$RD" 's.split("an exact path may open an enforcement file").join("an exact path opens an enforcement file")' "'## Yol sınıfları' lacks the rule '$EXACT'"
tneg "AC-14 README rule name of 7.3 only in another section" "$RD" 's.split("an exact path may open an enforcement file").join("an exact path opens an enforcement file") + "\n## Ek\n\nan exact path may open an enforcement file, a glob never does\n"' "'## Yol sınıfları' lacks the rule '$EXACT'"
tneg "AC-14 README without the section CEO nerede ve nasıl imzalar" "$RD" 's.replace("\n## CEO nerede ve nasıl imzalar\n", "\n## İmza\n")' "section '## CEO nerede ve nasıl imzalar' missing"
tneg "AC-14 README signing section without the block heading" "$RD" 's.split("ENFORCEMENT FILES THIS SIGNATURE OPENS").join("ENFORCEMENT FILES")' "'## CEO nerede ve nasıl imzalar' lacks '$BLOCKHEAD'"
tneg "AC-14 README block heading only in another section" "$RD" 's.split("ENFORCEMENT FILES THIS SIGNATURE OPENS").join("ENFORCEMENT FILES") + "\n## Ek\n\nENFORCEMENT FILES THIS SIGNATURE OPENS\n"' "'## CEO nerede ve nasıl imzalar' lacks '$BLOCKHEAD'"
tneg "AC-14 README without the section İzin kipi ve onay penceresi" "$RD" 's.replace("\n## İzin kipi ve onay penceresi\n", "\n## Kipler\n")' "section '## İzin kipi ve onay penceresi' missing"
tneg "AC-14 README section İzin kipi as a level-3 heading" "$RD" 's.replace("\n## İzin kipi ve onay penceresi\n", "\n### İzin kipi ve onay penceresi\n")' "section '## İzin kipi ve onay penceresi' missing"
tneg "AC-14 README G-1 row without Unlocks:" "$RD" 's.split("\n").map((l) => (l.startsWith("| G-1 |") ? l.split("Unlocks:").join("başlık") : l)).join("\n")' "G-1 row .* lacks 'Unlocks:'"

echo; if [ "$fail" -eq 0 ]; then echo "LINT RULE TESTS GREEN: $pass passed, 0 failed"; else echo "LINT RULE TESTS FAILED: $pass passed, $fail failed"; fi
[ "$fail" -eq 0 ]
