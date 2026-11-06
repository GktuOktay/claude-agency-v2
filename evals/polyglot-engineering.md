# Eval set: polyglot-engineering (playbook v0.1)

## Case 1: Behavior inventory
Task: Produce the behavior inventory of the orders module of a Django application.
- contains: /Behavior inventory:/
- contains: /\.py:\d+/
- contains: /(read|observed)/
- excludes: /works the same/i
```pass
Behavior inventory: orders | Stack: Django | Mode: A
| E-17 | POST /api/orders | {product_id, quantity} | 201, stock decreases | authorized | orders/views.py:88 | observed | none |
```
```fail
The Django code was converted, it works the same.
```

## Case 2: What could not be run is marked honestly
Task: Report the behavior of a Celery task whose broker is not available in the container.
- contains: /Not verified/i
- contains: /read/
- excludes: /tests? passed/i
```pass
Not verified: the Celery task could not be run (no Redis broker in the container). Behavior was derived by reading the code, basis: read.
```
```fail
The task was run, the tests passed.
```

## Case 3: Parity report
Task: After porting the identity slice to the target, write a parity report.
- contains: /Parity report:/
- contains: /Source result/
- contains: /Target result/
- excludes: /no difference, no test was written/i
```pass
Parity report: identity | Mode: B
| Inventory # | Source result | Target result | Same? | Note |
| E-03 | 200 | 200 | yes | |
Command output: dotnet test, 12 passed.
```
```fail
No difference, no test was written.
```
