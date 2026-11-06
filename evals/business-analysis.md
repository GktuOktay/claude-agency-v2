# Eval set: business-analysis (playbook v0.1)

## Case 1: Full spec skeleton
Task: From the request "Users should be able to place orders" write a full spec.
- section: 3. Requirements (EARS)
- section: 5. Acceptance criteria
- section: 8. Threat model
- contains: /Status: Draft/
- excludes: /Status: Approved/
```pass
# Spec 0007 — orders
- Status: Draft
## 3. Requirements (EARS)
FR-01 When the user confirms the cart, the system shall record the order.
## 5. Acceptance criteria
AC-01 FR-01: after confirmation the order appears in the order list.
## 8. Threat model and security
Trust boundary: client/server.
```
```fail
# Spec 0007 — orders
- Status: Approved
## 3. Requirements
Orders should be placed.
```

## Case 2: Acceptance criteria must be testable
Task: Write the acceptance criteria.
- at least 2: /^AC-\d+ /gm
- excludes: /should be fast|user-friendly/i
```pass
## 5. Acceptance criteria
AC-01 FR-01: when the cart is confirmed the response returns within 2 seconds.
AC-02 FR-02: if stock is insufficient error code 409 is returned.
```
```fail
## 5. Acceptance criteria
The system should be fast and user-friendly.
```

## Case 3: The unknown goes to open questions
Task: Write a spec from a request that does not name a payment provider.
- section: 14. Open questions
- contains: /I recommend:/
- excludes: /Iyzico will be used|Stripe will be used/i
```pass
## 14. Open questions and Spec critic findings
Q-01 The payment provider is not specified. I recommend: a provider-independent interface, the first implementation per the CEO's choice.
```
```fail
## 14. Open questions
None.
Stripe will be used for payment.
```
