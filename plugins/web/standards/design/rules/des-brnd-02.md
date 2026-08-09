# DES-BRND-02: Ethical Design

## Intent

No dark patterns. No confirmshaming, hidden costs, trick questions, pre-checked opt-outs, forced continuity, or disguised ads. Subscription cancellation must be as easy as signup. Opt-in (not opt-out) for marketing. Data collection transparent and minimal.

## Fix

- Cancellation flow: same number of steps as signup, clearly labeled
- Marketing consent: unchecked by default, clear opt-in language
- Pricing: all costs visible upfront, no hidden fees revealed at checkout
- Destructive actions: honest labels ("Delete account" not "Take a break")
- Data collection: explain what's collected and why; collect only what's needed
- Confirmations: neutral language ("Cancel subscription" / "Keep subscription"), no guilt ("Are you sure you want to miss out?")

## Code Superpowers

- Search for pre-checked checkboxes on marketing/consent forms
- Check cancellation flow step count vs signup flow
- Look for misleading button labels (positive action styled as primary when it's not in user's interest)
- Flag modal designs that make declining harder than accepting

## Common Mistakes

1. Confirmshaming: "No thanks, I don't want to save money" as decline option
2. Pre-checked marketing consent checkboxes
3. Hidden cancellation flow (3 clicks to subscribe, 15 to cancel)
4. Disguised ads or sponsored content without clear labeling

## Edge Cases

- Legal/compliance requirements may mandate certain consent patterns
- A/B testing growth experiments must still respect ethical boundaries

## Related

DES-BRND-01, DES-COPY-01, DES-STAT-01
