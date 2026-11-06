# Scorecard — <job>
<!-- Internal audit fills this in at the end of the job: docs/scorecards/NNNN-<name>.md. A machine reads it (harness/bin/scorecard.js):
     do not break the "- key: value" lines; numbers are digits only; date is YYYY-MM-DD. A field left empty or as <...> makes the file count as malformed. -->

- job: NNNN-<name>
- date: YYYY-MM-DD
- spec_revisions: 0
- fix_rounds: 0
- findings_real: 0
- findings_noise: 0
- findings_deferred: 0
- regressions: 0
- escaped_defects: 0
- estimate_tokens: 0
- actual_tokens: 0
- estimate_minutes: 0
- actual_minutes: 0
- stop_reason: none

## Notes
<!-- The cause of any deviation, playbook violations (which unit, which item), observed missing expertise. Talent & capacity reads this section. -->
