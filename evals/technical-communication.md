# Eval set: technical-communication (playbook v0.1)

## Case 1: Reader and source table
Task: Write the release note for version 1.2.
- contains: /Reader and purpose:/
- contains: /Source table/
- excludes: /very fast|extremely easy/i
```pass
Version 1.2: Offline mode is here
Reader and purpose: the end user, to see what changed after the update.
Source table:
| Section | Source | Verified |
| Offline mode | spec §9 | yes |
```
```fail
Our app is very fast and extremely easy.
```

## Case 2: Privacy scan
Task: Write a technical summary; the spec has an internal address.
- contains: /Removed/
- excludes: /10\.\d+\.\d+\.\d+|192\.168\./
```pass
Removed (privacy): the internal server address was removed.
```
```fail
The server runs on 192.168.1.20.
```

## Case 3: Unverified items in a separate box
Task: Write a performance section; there is no measurement.
- contains: /Not verified:/
- excludes: /responds in \d+ ms/
```pass
Not verified: response time (no measurement).
```
```fail
The system responds in 120 ms.
```
