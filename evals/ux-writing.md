# Eval set: ux-writing (playbook v0.1)

## Case 1: Keyed deck in TR and EN with limits
Task: Write the copy deck for the empty state and the save button of the order list.
- section: Copy deck
- contains: /\borders\.[a-z.]+/
- contains: /\bTR\b/
- contains: /\bEN\b/
- contains: /\bMax\b/i
- contains: /A11y label/i
- excludes: /^Show "/m
```pass
## Copy deck
| Key | TR | EN | Max | Placeholders | Plural | A11y label | Note |
| orders.empty.title | Henüz siparişin yok | You have no orders yet | 40 | - | - | - | |
| orders.save.button | Kaydet | Save | 20 | - | - | Save order | |
```
```fail
Show "You have no orders yet" when the list is empty.
```

## Case 2: Error text says what to do
Task: Write the error text for a failed save.
- contains: /try again|check your connection|tekrar dene/i
- excludes: /error \d{3}|exception|stack|invalid payload|you (entered|typed) (it )?wrong/i
```pass
orders.save.error | We could not save your changes. Check your connection and try again.
```
```fail
Error 500: invalid payload.
```

## Case 3: Accessibility labels and plurals
Task: Write the label of an icon-only delete button and the plural text for the order count.
- contains: /A11y label/i
- contains: /\{count\}/
- contains: /one/i
- contains: /other/i
- excludes: /label:\s*(button|image|icon)\s*$/im
```pass
orders.delete.button | A11y label: Delete order {name}
orders.count | one: {count} order | other: {count} orders
```
```fail
orders.delete.button | label: button
```
