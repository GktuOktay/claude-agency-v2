#!/bin/sh
# harness/test/tools.sh: tests for the small tools (scorecard.js, humanize-check.js, eval.js, notify.js). No network.
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
pass=0; fail=0
t() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok    $1"; else fail=$((fail+1)); echo "FAIL  $1 (expected $2, got $3)"; fi; }
rc() { "$@" >/dev/null 2>&1; echo $?; }

# --- scorecard.js
mkdir -p "$T/sc"
mk() { # mk <file> <dc> <real> <noise> <est-token> <real-token>
  cat > "$T/sc/$1.md" <<EOF
- job: $1
- date: 2026-11-02
- spec_revisions: 1
- fix_rounds: $2
- findings_real: $3
- findings_noise: $4
- findings_deferred: 0
- regressions: 0
- escaped_defects: 0
- estimate_tokens: $5
- actual_tokens: $6
- estimate_minutes: 100
- actual_minutes: 150
- stop_reason: none
EOF
}
mk 0001-a 1 3 1 100 120; mk 0002-b 0 1 1 100 200
out=$(node "$HERE/bin/scorecard.js" "$T/sc"); r=$?
t "scorecard: valid files summarize"          0 "$r"
t "scorecard: counts the jobs"                1 "$(printf '%s' "$out" | grep -c 'Scorecard summary: 2 jobs')"
t "scorecard: average token ratio is 1.60"    1 "$(printf '%s' "$out" | grep -c 'token 1.60')"
t "scorecard: noise rate is 33%"              1 "$(printf '%s' "$out" | grep -c 'noise rate 33%')"
t "scorecard: under 3 jobs says insufficient data" 1 "$(printf '%s' "$out" | grep -c 'insufficient data')"
printf -- '- job: 0003-c\n- date: tomorrow\n- fix_rounds: x\n' > "$T/sc/0003-c.md"
t "scorecard: a malformed file makes the exit non-zero" 1 "$(rc node "$HERE/bin/scorecard.js" "$T/sc")"
t "scorecard: malformed file is named"        1 "$(node "$HERE/bin/scorecard.js" "$T/sc" 2>&1 | grep -c 'MALFORMED  0003-c.md')"
t "scorecard: the template itself counts as unfilled" 1 "$(rc node -e 'const s=require(process.argv[1]);const v=s.validate(s.parse(require("fs").readFileSync(process.argv[2],"utf8")));process.exit(v.length?1:0)' "$HERE/bin/scorecard.js" "$HERE/../templates/scorecard.md")"
t "scorecard: empty dir is fine"              0 "$(rc node "$HERE/bin/scorecard.js" "$T/none")"

# --- humanize-check.js
printf 'Günümüzün hızla değişen dünyasında uygulamamız devrim niteliğinde.\n' > "$T/warn.md"
printf 'Türkiye'"'"'nin en hızlı ve %%100 güvenli uygulaması.\n' > "$T/err.md"
printf 'Uygulama, bağlantı koptuğunda yazdıklarını saklar ve bağlantı gelince gönderir.\n' > "$T/ok.md"
printf '```\nen iyi %%100 garantili\n```\nKod bloğu atlanır.\n' > "$T/code.md"
t "humanize: absolute claims are errors (exit 1)" 1 "$(rc node "$HERE/bin/humanize-check.js" "$T/err.md")"
t "humanize: filler patterns warn but exit 0"    0 "$(rc node "$HERE/bin/humanize-check.js" "$T/warn.md")"
t "humanize: filler is reported"                 1 "$(node "$HERE/bin/humanize-check.js" "$T/warn.md" | grep -q '^UYARI' && echo 1)"
t "humanize: plain text is clean"                1 "$(node "$HERE/bin/humanize-check.js" "$T/ok.md" | grep -c 'SONUÇ: TEMİZ')"
t "humanize: fenced code is skipped"             0 "$(rc node "$HERE/bin/humanize-check.js" "$T/code.md")"
t "humanize: Turkish dotted/dotless I is handled (EN İYİ)" 1 "$(rc node "$HERE/bin/humanize-check.js" "$(printf 'EN İYİ çözüm.\n' > "$T/up.md"; echo "$T/up.md")")"

# --- eval.js
all_sets() { for f in "$HERE"/../evals/*.md; do [ "$(basename "$f")" = README.md ] && continue; node "$HERE/bin/eval.js" self "$f" >/dev/null 2>&1 || return 1; done; return 0; }
t "eval: every shipped set checks itself"   0 "$(all_sets; echo $?)"
printf '# x\n\n## Case 1: a\nTask: g\n- contains: /abc/\n```pass\nabc\n```\n```fail\nxyz\n```\n' > "$T/short.md"
t "eval: a set with fewer than 3 cases is invalid"   1 "$(rc node "$HERE/bin/eval.js" self "$T/short.md")"
printf '# x\n\n## Case 1: a\nTask: g\n- contains: /a/\n- excludes: /zzz/\n```pass\nabc\n```\n```fail\nabc\n```\n' > "$T/vacuous.md"
t "eval: a criterion that cannot fail is caught"     1 "$(node "$HERE/bin/eval.js" self "$T/vacuous.md" | grep -c 'do not discriminate')"
printf 'AppSec report: x | Stop: B\nVerdict: FAIL\nS-01 [HIGH] x | A.cs:1 | Evidence: y\n' > "$T/out-good.md"
printf 'Verdict: PASS\n' > "$T/out-bad.md"
S="$HERE/../evals/application-security.md"
t "eval: grade passes a good output"   0 "$(rc node "$HERE/bin/eval.js" grade "$S" 1 "$T/out-good.md")"
t "eval: grade fails a bad output"     1 "$(rc node "$HERE/bin/eval.js" grade "$S" 1 "$T/out-bad.md")"

# --- notify.js (osascript / notify-send replaced by a recording stub)
mkdir -p "$T/bin"; : > "$T/log"
for b in osascript notify-send; do printf '#!/bin/sh\nfor a in "$@"; do printf "[%%s]" "$a" >> "%s/log"; done; echo >> "%s/log"\n' "$T" "$T" > "$T/bin/$b"; chmod +x "$T/bin/$b"; done
N() { PATH="$T/bin:$PATH" "$@"; }
printf '{"notification_type":"permission_prompt","message":"Claude needs your permission to use Bash"}' | N node "$HERE/notify.js"; r=$?
t "notify: hook mode exits 0"                    0 "$r"
t "notify: permission prompt reaches the OS notifier" 1 "$(grep -c 'permission to use Bash' "$T/log")"
t "notify: title says approval is needed"        1 "$(grep -c 'onayın gerekiyor' "$T/log")"
: > "$T/log"; N node "$HERE/notify.js" "Koşu bitti" 'tırnak " ve $(touch '"$T"'/pwned) denemesi'
t "notify: text is passed as an argument, never run" 0 "$([ -e "$T/pwned" ] && echo 1 || echo 0)"
: > "$T/log"; COMPANY_NOTIFY=off N node "$HERE/notify.js" "x" "y"
t "notify: COMPANY_NOTIFY=off is silent"         0 "$(wc -l < "$T/log" | tr -d ' ')"
t "notify: garbage input still exits 0 (fail open)" 0 "$(printf 'not json' | N node "$HERE/notify.js" >/dev/null 2>&1; echo $?)"

echo; if [ "$fail" -eq 0 ]; then echo "TOOLS TESTS GREEN: $pass passed, 0 failed"; else echo "TOOLS TESTS FAILED: $pass passed, $fail failed"; fi
[ "$fail" -eq 0 ]
