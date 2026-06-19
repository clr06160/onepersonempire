# OnePerson Empire Tester Feedback Kit

Use this kit to run the first 5 tester sessions. The goal is not praise. The goal is to find the exact moments where a small-business owner gets confused, loses trust, or needs help.

Related files:

- `scores.csv` for recording the five tester scores.
- `synthesis.md` for choosing the next product fix after the sessions.

## 1. Recruit 5 Testers

Start with 5 people:

- 3 real or realistic tiny-business owners: cleaner, dog walker, baker, handyman, detailer, coach, tutor, landscaper, mobile service provider.
- 1 less technical friend or family member who can pretend they run a small local business.
- 1 skeptical practical person who will point out anything confusing, fake, or risky.

Avoid only testing with software people. They will understand too much and hide the product's real problems.

### Outreach Text

```text
Hey, I'm testing a simple website builder for solo/local businesses.

Could you give me 20-30 minutes of honest feedback? I'm not testing you. I'm testing whether the product is clear enough.

The task is simple: describe a small business, generate a site, edit one text/photo, set up payment, publish it, and tell me what feels confusing or trustworthy.

I mostly need you to say what you're thinking out loud while you use it.
```

### Tester Tracker

| Tester | Type | Business Example | Scheduled | Completed | Biggest Concern |
| --- | --- | --- | --- | --- | --- |
| 1 | Real owner |  |  |  |  |
| 2 | Real owner |  |  |  |  |
| 3 | Real owner/proxy |  |  |  |  |
| 4 | Less technical proxy |  |  |  |  |
| 5 | Skeptical reviewer |  |  |  |  |

## 2. Run Each Session

Keep sessions to 20-30 minutes. Screen share if possible.

### Opening Script

```text
I'm testing the product, not you.

Please say out loud what you think each step means. If something is confusing, annoying, risky, or untrustworthy, that is the most useful feedback.

Try to build a simple site for a real or imaginary small business, then get it ready to share.
```

### Rules For You

- Do not explain every button before they click.
- Do not rescue them immediately when they hesitate.
- Ask "What did you expect to happen?" before explaining.
- Write down exact phrases they say.
- Mark every hesitation, even if they eventually figure it out.

### Tasks To Give Them

```text
1. Describe a small business and build a site.
2. Edit one piece of text.
3. Replace or change one image.
4. Set up a customer payment option.
5. Publish the site.
6. Find what you would do if you wanted a real domain.
7. Tell me whether you would share this link with a real customer.
```

## 3. Session Notes Template

Copy this section once per tester.

```text
Tester:
Business type:
Date:

Starting prompt they wrote:

First reaction to generated site:

Where they hesitated:

Exact confusing words they said:

Text editing reaction:

Image editing reaction:

Payment setup reaction:

Domain setup reaction:

Publishing reaction:

Would they share it with a real customer? Why or why not?

What would stop them from using this?

What would they expect to pay later if this was done for them?

Biggest product lesson from this session:
```

## 4. Questions To Ask After

Ask these after they finish the tasks:

```text
1. What part felt easiest?
2. What part felt confusing or risky?
3. Did the generated site feel specific to the business or too generic?
4. Did you understand that you could click text and images to edit them?
5. Would you rather use a real photo or an AI-generated photo? Why?
6. Did the payment setup make sense: Venmo first, Stripe/PayPal link later?
7. Did publishing feel safe enough?
8. Did the domain instructions feel doable, or would you need help?
9. What would stop you from using this for a real business?
10. If this was done for you, what would you expect to pay later?
```

## 5. Score Each Session

Use 1-5 scores. A 5 means "clear enough without help." A 1 means "blocked or did not trust it."

| Category | Score | Notes |
| --- | ---: | --- |
| Prompt clarity |  | Could they start without help? |
| Site quality |  | Did the first site feel usable and specific? |
| Editing clarity |  | Did they discover text/image/payment editing? |
| Payment clarity |  | Did Venmo and checkout-link upgrade make sense? |
| Domain clarity |  | Did "share now, domain later" make sense? |
| Trust |  | Would they share it with a customer? |

Do not average blindly. A low trust, payment, publishing, or domain score matters more than a minor style complaint.

## 6. Synthesis After 5 Testers

Fill this out after all 5 sessions.

```text
How many testers successfully published?

How many understood payment setup?

How many understood domain setup?

How many would share the tester URL with a real customer?

Top repeated confusion:

Top repeated trust concern:

Top repeated feature request:

What did you explain manually more than once?

What exact UI copy or button would have prevented that explanation?

Next fix to build:
```

## 7. Decision Rule

After 5 testers:

- If 4 out of 5 can publish and understand payment/domain basics, keep shipping to testers.
- If 3 out of 5 hesitate on the same step, fix that step next.
- If people like the result but need your help, turn your explanation into UI copy or a copy button.
- If people do not trust the generated site, improve prompt cleanup and template quality before adding features.

Fix issues in this order:

1. Anything that makes the app feel broken or fake.
2. Anything that prevents publishing.
3. Anything that makes payment or domain setup scary.
4. Anything that makes editing undiscoverable.
5. Visual polish and nice-to-have features.

## 8. Signals To Listen For

The best feedback often sounds negative:

- "I don't know what this means."
- "I would not click that."
- "I need my real photos here."
- "I get Venmo, but how do cards work?"
- "I would send this to customers if the domain looked real."
- "I would pay if you did the setup for me."

Those statements are the path from tester MVP to 9.5.
