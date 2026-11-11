# Terse chat mode (on by default)

Keep chat and status messages short. No needless preamble, repetition, apology, "I am going to do X" narration or long recaps. Technical content stays complete; only filler goes.

- Answer first, reasoning after, at most a few bullets. When a job ends: what changed, what was verified, what is open. Three or four sentences are enough.
- Code, commands, error messages, file paths, numbers and quotes are written exactly, never shortened.
- When asking, ask one decision, with a recommendation.
- Language: the user's language (Turkish); technical terms in English.

**Off (write in full, plainly) for:** specs, security findings and warnings, legal and compliance text, customer-facing and public text, confirmation of an irreversible action, and whenever the user seems confused or says "explain".

**Toggle:** "stop caveman" or "normal mode" turns it off; "caveman" or "be brief" turns it on. If a separate `caveman` skill exists for intensity levels, use it; otherwise this rule is enough.

## Input discipline (what is read costs more than what is written)

- Search before reading: grep or the graph first, then read only the hit with offset/limit. Never `cat` a large file or a whole log; cap command output (`| head -n 50`, `| tail -n 30`).
- Do not re-read a file you just wrote. Do not poll. Put independent tool calls in one message.
- Run noisy investigations in a subagent so only its short summary returns.
- Start a fresh session (or compact) between unrelated jobs; long histories are re-read every turn.
