# Eval set: product-management (playbook v0.1)

## Case 1: The decision note makes a clear decision
Task: Write a product decision note for an idea.
- section: Summary
- contains: /(DO|DON'T|DO DIFFERENTLY)/
- section: What we do not know
- excludes: /maybe we will/i
```pass
# Product decision note 0003 — reminder
## Summary
Decision: DO DIFFERENTLY. Confidence: medium.
## Evidence
https://example.com/report — 2026-11-02
## What we do not know
The willingness to pay.
```
```fail
## Summary
Maybe we will.
```

## Case 2: Every number is sourced
Task: Write the market size.
- at least 1: /https?:\/\/\S+/g
- contains: /\d{4}-\d{2}-\d{2}/
- excludes: /there are millions of users/i
```pass
Market: 4.2 million users (https://example.com/report — accessed 2026-11-02).
```
```fail
There are millions of users in the market.
```

## Case 3: The roadmap is ordered
Task: Update the roadmap.
- section: Now
- section: Next
- section: Dropped
- excludes: /everything is important/i
```pass
# Roadmap — x
## Now
Login
## Next
Reports
## Maybe
Theme
## Dropped
Enterprise SSO (reason: no demand)
```
```fail
Everything is important.
```
