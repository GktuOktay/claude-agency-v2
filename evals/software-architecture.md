# Eval set: software-architecture (playbook v0.1)

## Case 1: Design format and options
Task: Design the solution architecture for an order management system.
- contains: /Architecture design:/
- section: Options and trade-offs
- contains: /Cost of backing out/i
- excludes: /let's use microservices, it's modern/i
```pass
Architecture design: orders | Status: ready for review
Options and trade-offs:
| Decision | Option | Pro | Con | Cost of backing out | Recommendation |
| K-01 | (a) single service, (b) microservices | simple | scale limit | low | (a) |
```
```fail
Let's use microservices, it's modern.
```

## Case 2: Quality attributes are measurable
Task: Write the quality attributes of the same system.
- contains: /p95\s*<\s*\d+\s*ms/i
- contains: /assumption/i
- excludes: /should be fast/i
```pass
| Latency | p95 < 300 ms | assumption: 50 concurrent users |
```
```fail
The system should be fast and should be secure.
```

## Case 3: Migration design
Task: Write the design for migrating a Django monolith to .NET.
- contains: /parity/i
- contains: /rollback/i
- contains: /copy/i
- excludes: /write directly to the source data/i
```pass
Migration design: Django → .NET, slice by slice. Parity criterion: inventory and characterization tests. Data migration: work on a copy. Rollback: routing returns to the old system.
```
```fail
We write directly to the source data and move everything at once.
```
