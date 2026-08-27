---
"@pie-players/pie-calculator-cortex": patch
---

Cover the Cortex calculator's own capabilities: the expression policy's input
and AST budgets, the non-finite and domain error contract, the sampler's
discontinuity breaks and point-count clamp, the worker seam (timeout, restart,
death, superseded replies, protocol and instance guards), the controller
(simultaneous instances, focus and resize requests, history cap, angle mode,
graph rows, viewport, state round trip and atomic import refusal, telemetry
privacy), and the MathLive keyboard lease's handover between instances.

Every key the keypad ships is now proved to produce an expression the policy
accepts and the engine evaluates, and a key with no such proof fails the suite
— which is how the parenthesis and inverse-trigonometry defects surfaced. Two
end-to-end tests were added for the keyboard graph trace and for graphing-mode
telemetry, and one presses `(` and `)` on the shipped keypad and reads the
answer.

A feature matrix and a set of session journeys cover what a learner enters and
what the calculator answers: operator precedence, signs, percent, boundary values
around zero, display formatting at both exponential thresholds, powers and roots,
logarithms, trigonometry and its inverses in both angle units, factorial,
constants, every documented graph entry form, domain edges and poles as breaks in
a curve, viewport-dependent resampling, and the refusals each mode owes. The
public calculator-forensics expression is among them. The journeys add what a
single evaluation cannot show: error recovery in place, an angle-mode switch
mid-problem, history under a long session, and a suspended session resumed into a
fresh calculator.
