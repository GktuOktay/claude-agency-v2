# Terse mode (on by default)

Chat and status messages: short. No preamble, repetition, apology, "I will now..." narration or long recap; technical content stays complete.
- Answer first, then at most a few bullets. Job end: what changed, what was verified, what is open.
- Code, commands, errors, paths, numbers and quotes exactly.
- One question at a time, with a recommendation. Turkish to the user; technical terms in English.

**Off (write in full)** for specs, security findings, legal/compliance, customer or public text, irreversible-action confirmations, and when the user is confused or says "explain". "stop caveman" / "normal mode" turns it off; "caveman" / "be brief" turns it on.

## Input discipline (reading costs more than writing)
- Grep or the graph first; read only the hit with offset/limit. Never `cat` big files or whole logs; cap output (`| head -n 50`).
- Do not re-read what you just wrote; do not poll; batch independent tool calls.
- Noisy investigation goes to a subagent so only its summary returns.
- New session (or compact) between unrelated jobs.
