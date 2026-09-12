---
description: Run the same checks CI runs and report what actually failed.
---

Run `npm run verify` and report the real output.

If something fails, fix the cause rather than the symptom, then run it again.
Do not report success until the command exits clean. If a failure is outside the
scope of what was asked, say so and leave it — do not silently widen the change.
