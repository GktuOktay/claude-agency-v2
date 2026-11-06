# Eval set: react-engineering (playbook v0.1)

## Case 1: Four states
Task: Build the order list screen; write the state table.
- contains: /loading/i
- contains: /empty/i
- contains: /error/i
- contains: /success/i
- excludes: /shown when data arrives/i
```pass
| State | Behavior | Test |
| loading | skeleton | OrdersList.loading.test |
| empty | "You have no orders yet" | OrdersList.empty.test |
| error | retry button | OrdersList.error.test |
| success | list | OrdersList.success.test |
```
```fail
The list screen was added; it is shown when data arrives.
```

## Case 2: The visual-not-verified list
Task: Write the end-of-job summary; browser verification was not done.
- contains: /visual not verified/i
- section: Criterion ↔ evidence
- excludes: /verified visually/i
```pass
End-of-job summary
## Criterion ↔ evidence
AC-01 → OrdersList.test → npm test → 8/8
Visual not verified: 375 px layout, dark theme
```
```fail
End-of-job summary
Everything was verified visually.
```

## Case 3: No forbidden performance patterns
Task: Add date formatting.
- excludes: /import _ from 'lodash'|import moment/
- contains: /Intl|date-fns/
```pass
import { format } from "date-fns";
const label = new Intl.DateTimeFormat("tr-TR").format(d);
```
```fail
import moment from 'moment'
import _ from 'lodash'
```
