# Worked examples

Rewrite specifics for the actual deal - never reuse verbatim across deals.

## Table of Contents

- [Example 1 - B2B: AE discovery, 30 min, outbound](#example-1---b2b-ae-discovery-30-min-outbound)
- [Example 2 - B2C high-ticket: kitchen remodel consult, 60 min, couple (abbreviated)](#example-2---b2c-high-ticket-kitchen-remodel-consult-60-min-couple-abbreviated)
- [Example 3 - negative: the logistics-first sheet (do not build this)](#example-3---negative-the-logistics-first-sheet-do-not-build-this)

## Example 1 - B2B: AE discovery, 30 min, outbound

Context given:

- VP Operations at a 200-person logistics company.
- Replied to a cold email about shipping errors.
- Product is order-orchestration software.
- Mid-market, ~4 stakeholders expected.
- Success = a scoped demo with her ops lead present.

```
DISCOVERY CALL SHEET
Prospect   : VP Operations, NorthHaul Logistics (200p)   Call: AE discovery, 30 min
Origin     : outbound - replied to cold email on shipping errors
Known      : runs 3 warehouses; hiring a "fulfillment systems analyst" (job post);
             replied "this is a constant headache" - do not re-ask whether errors happen
Next step  : scoped demo with her ops lead, within 2 weeks

HYPOTHESES
H1: mis-ship rate is driven by manual re-keying between OMS and WMS
H2: peak-season temp staffing breaks their picking process
H3 (fallback): reporting lag hides errors until customers complain

FRAME
"You mentioned errors are a constant headache - fair if we spend 25 minutes on
where they actually come from, then decide together if a deeper look makes sense?"

QUESTION PATH
[Situation - 1 only; site + job post answered the rest]
Q: Walk me through what happens between an order landing and a label printing.
   listen for: manual handoffs, swivel-chair steps   exit: process in her words

[Pain - H1]
Q: You called errors a constant headache - when did one last really hurt?
   ladder: tell me more / can you give me a specific example / how long has it
   been like this
   listen for: a named incident with a customer attached
   exit: specific problem + recent example

[Root cause]
Q: Why do you think that one happened?
   ladder: what have you tried so far / did it work
   listen for: "we added a checking step" = symptom patch, go one rung deeper
   exit: cause ≠ symptom; prior attempts known

[Impact]
Q: What do mis-ships run you per month - reship cost, credits, anything else?
Q: What does it do to your team when a big one lands - who gets pulled in?
   listen for: her figure, not mine; names of other stakeholders
   exit: one quantified figure + who else is touched

[Urgency]
Q: What's changed that made you answer a cold email about this now?
Q: If nothing changes before peak season, what does November look like?
   exit: dated/triggered reason - or noted absence

[Decision context]
Q: If you decided to fix this properly, what would the path to a yes look like?
Q: Who else would want a say - and who could kill it?
   exit: process + voices sketched (feeds scorecard; no score)

CLOSE
Summary: "So - mis-ships from re-keying between systems, patched with a checking
step that didn't hold, costing about <her figure>/month and worst in peak. Miss
anything?"
Ask    : "Worth a 45-minute demo scoped to that flow, with your ops lead - week
after next?"

BRANCHES
- H1 dead → pivot to H2 via "where does peak season strain the process most?"
- She volunteers the cost figure early → bank it, return for root cause
- Her boss (COO) joins → drop situation entirely, open with H1 as a POV statement
- Asks pricing → range in one sentence, then "depends on the flow - can I ask two
  more questions about it?"

DO NOT ASK
- "What's your timeline?" / "Is there budget?" before impact
- "Would you use a tool that...?" - the product stays out until the close
- "Errors must be killing your margins, right?" - her number, not mine

AFTER THE CALL
Stages unmet: ______________________
```

## Example 2 - B2C high-ticket: kitchen remodel consult, 60 min, couple (abbreviated)

Context: in-home consultation; two decision makers; success = a paid design agreement.

- Frame: "Let's spend the hour on what you want this kitchen to do for you, and by the end decide together whether a design plan is the right next step - fair?"
- Pain, asked to each: "What finally made you book this visit - and was it the same thing for both of you?" Ladder: specific example ("when did the kitchen last really frustrate you?") / duration.
- Root cause / prior attempts: "What's kept you from doing it until now?" - listen for money vs disruption vs disagreement; each has a different close.
- Impact, personal leads: "What would a finished kitchen change about an ordinary Tuesday night?" Household-business: "What is waiting costing you - hosting, resale timing, workarounds you pay for?"
- Urgency: "Why now, after eight years?" - listen for a trigger (event, sale, milestone). No trigger found → note it honestly; don't invent a deadline.
- Close: summarize each person's answer in their own words, then: "The next step would be a design agreement so you can see it before you commit to a build - does <date> work to review it together?"
- Branch: partners disagree on pain → surface it as a question ("you two see this differently - which matters more this year?"), never pick a side.

## Example 3 - negative: the logistics-first sheet (do not build this)

```
1. What's your timeline for this project?
2. Is there budget allocated for this?
3. Who's the decision maker?
4. What tools are you using today?
5. Would you be open to a demo next week?
```

Why it fails, line by line:

- Lines 1-2: the two canonical logistics-first offenders (published GAP Selling negative examples). They harvest deal admin before establishing that a problem exists, and signal the rep sells to a quota, not a gap.
- Line 3: an authority question with no pain context reads as "are you worth my time". The same information falls out naturally from the decision-context stage after impact.
- Line 4: a situation question research should have answered.
- Line 5: a close with nothing to close on, no pain, no cause, no figure, no why-now - the demo, if accepted, is a tour, not a next step.

Every question here becomes legitimate late in the spine. The failure is sequence, not wording - which is why the quality gate checks order, not just phrasing.
