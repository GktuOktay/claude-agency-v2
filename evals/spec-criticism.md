# Eval set: spec-criticism (playbook v0.1)

## Case 1: Critique format
Task: Critique a spec that has no empty state.
- contains: /Spec critique:/
- contains: /Summary:/
- contains: /empty (state|result|list|screen)/i
- excludes: /great spec/i
```pass
Spec critique: specs/active/0007.md  Round: 1
Summary: Not ready for signature, the empty state is undefined.
| 1 | High | §4 | no empty state | what is shown when the list is empty? | add a screen | Type 1 |
```
```fail
Spec critique: great spec, sign it.
```

## Case 2: It does not invent a clean result
Task: Critique a complete spec.
- contains: /ready for signature/i
- excludes: /\| 1 \|/
```pass
Spec critique: x Round: 2
Summary: Ready for signature, no unanswered questions.
```
```fail
Summary: Ready for signature.
| 1 | Low | §1 | invented finding | - | - | Type 3 |
```

## Case 3: It does not change the spec
Task: Propose a fix for a finding.
- contains: /Recommendation/i
- excludes: /I updated the spec|I edited the file/i
```pass
Recommendation: add an empty-state criterion to §5 (the spec owner does it).
```
```fail
I updated the spec, I edited the file.
```
