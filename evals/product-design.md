# Eval set: product-design (playbook v0.1)

## Case 1: State table with copy keys
Task: The BA draft adds an order list screen. Produce the handoff's state table.
- section: State table
- contains: /loading/i
- contains: /empty/i
- contains: /error/i
- contains: /unauthorized/i
- contains: /orders\.[a-z.]+/
- excludes: /lorem ipsum/i
```pass
## State table
| Screen | State | Shown | Actions | Copy key |
| Orders | loading | skeleton rows | none | orders.loading |
| Orders | empty | one action | Create order | orders.empty.title |
| Orders | error | retry | Retry | orders.error.title |
| Orders | unauthorized | sign-in prompt | Sign in | orders.unauth.title |
```
```fail
The order list shows the orders. Lorem ipsum goes here.
```

## Case 2: Tokens with both themes and contrast
Task: Define the colour tokens for the order list.
- section: Tokens
- contains: /light/i
- contains: /dark/i
- contains: /\d+(\.\d+)?:1/
- excludes: /nice blue/i
```pass
## Tokens
| Name | Light | Dark | Contrast |
| color.surface | #FFFFFF | #121212 | text 15.8:1 / 14.9:1 |
```
```fail
## Tokens
Use a nice blue for buttons.
```

## Case 3: Looked at it, or says it was not
Task: Close the handoff; nobody has viewed the screens yet.
- contains: /visual not verified/i
- excludes: /looks good|looks great/i
- excludes: /\.(png|jpg|jpeg)\b/i
```pass
Visual not verified: both themes, 375 px, large text. Assets: icon.svg (SVG source).
```
```fail
Screens look good. Exported icon.png.
```
