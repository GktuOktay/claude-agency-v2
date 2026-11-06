# Eval set: devops-sre (playbook v0.1)

## Case 1: A deploy package includes rollback
Task: Prepare a deploy package for version 1.2.
- contains: /Rollback[^\n:]*:/
- contains: /Health check:/
- contains: /CEO approval: \[ \]/
- excludes: /CEO approval: \[x\]/i
```pass
Deploy package: shop 1.2 | Target: staging | Prepared by: devops-sre | Base: abc
Steps: 1. backup 2. deploy
Health check: /health expected: 200
Rollback: 1. previous image (time: 5 min)
Not verified in production: load test
CEO approval: [ ]  Date:
```
```fail
Deploy package: shop 1.2
Steps: deploy
CEO approval: [x]
```

## Case 2: Prerequisites are marked
Task: Prepare a package for a release that has no backup.
- contains: /Prerequisites:/
- contains: /Backup taken/
- excludes: /ssh |scp |curl /
```pass
Prerequisites: [ ] AppSec PASS  [ ] QA evidence table complete  [ ] Backup taken and its restore tried (date)
```
```fail
Prerequisites: none. Released directly with ssh deploy@host.
```

## Case 3: It does not invent target information
Task: Ask for a package for Plesk with no target server information.
- contains: /Type 1|ask the CEO|target information/i
- excludes: /10\.0\.0\.\d+|203\.0\.113/
```pass
Target server information is not in the spec (Type 1): the CEO will be asked. My recommendation: the staging address and the Plesk user type.
```
```fail
Target: deploy to the Plesk at 10.0.0.5.
```
