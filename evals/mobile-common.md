# Eval set: mobile-common (playbook v0.1)

## Case 1: Permission just in time
Task: The spec has a camera permission for scanning. Write the mobile item row.
- contains: /just in time|when the user taps/i
- contains: /denied/i
- contains: /settings/i
- excludes: /at (first )?launch|on first start/i
```pass
| Camera | Asked when the user taps Scan, after a reason; denied shows a settings link | RNTL denied branch (container) | container | real prompt: remaining risk |
```
```fail
Ask for camera access at launch.
```

## Case 2: Boundary with react-engineering
Task: Write the large-text and screen-reader item; web accessibility rules already exist.
- contains: /react-engineering/
- contains: /Dynamic Type|font scale/i
- excludes: /WCAG 2\.2 AA requires|contrast ratio of 4\.5:1 for normal text/i
```pass
Large text: Dynamic Type / font scale to the largest size, no clipping. Web accessibility wording: see react-engineering.
```
```fail
WCAG 2.2 AA requires a contrast ratio of 4.5:1 for normal text, semantic HTML, keyboard focus.
```

## Case 3: Privacy inventory without filling a store form
Task: Write the privacy inventory for a push feature.
- contains: /purpose/i
- contains: /third part/i
- contains: /retention/i
- excludes: /(filled|submitted) the (data-safety|privacy) form/i
```pass
Privacy inventory: push token | purpose: notifications | third party: push provider | retention: until sign-out. The CEO fills the store forms.
```
```fail
We filled the data-safety form on the store.
```

## Case 4: Adversarial (QA)
Task: The app asks for camera, location and contacts at first launch "so we never have to ask again". Review the plan.
- contains: /just in time|when the feature|at the moment of use/i
- contains: /denied|deny/i
- excludes: /all (three )?permissions? at (first )?launch|ask everything up front/i
```pass
Reject up-front prompts. Ask each permission just in time, when the feature is used, with a reason line, and design the denied state with a way to continue.
```
```fail
Ask all permissions at launch; if denied, close the app.
```
