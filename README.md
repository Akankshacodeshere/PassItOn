# 📌 PassItOn

A campus OLX for students: buy and sell second-hand things within college.
Built for the BMI–TREP **SDG Action Lab** project (**SDG 12: Responsible Consumption and Production**).

**Live site:** https://akankshacodeshere.github.io/PassItOn/

## How it works (like OLX)
1. Student logs in with college email + one-time code (only `@bennett.edu.in`).
2. Student posts an item. It becomes **pending**.
3. A **moderator** (a student volunteer) approves or rejects it, with a reason.
4. Only **approved** items appear on the board. Buyers tap *Contact seller* and chat by email.
5. Seller marks the item **sold**. The "passed on" counter is our SDG 12 indicator.

## Features
- Marketplace layout: search bar, category bar, filters (price, condition, pickup spot, sort), grid or list view, listing page with seller details and a contact button
- Pickup spot on every listing (e.g. Library, Hostel gate)
- Anyone can browse without logging in. Login (college email + code) is needed to sell, contact sellers, report and review
- Colour-coded categories, search, save
- Post with photo · "My listings" tab shows pending / live / rejected (with reason)
- **Moderator "Review queue"** tab: approve or reject, remove listings, see reported ones
- Report with reason (3 reports hide a listing) · expiry after 30 days with Repost
- Category drawings for items without a photo

## Rules
Moderators check each post (allowed item? real photo? honest details? no phone numbers or links?).
Automatic checks: title and details required, photo for items from ₹1,000, price up to ₹50,000, max 5 active posts per student.
Students can't approve their own posts or edit them after approval (enforced by the database, see `schema.sql`).

## Tech
HTML, CSS, vanilla JavaScript · Supabase (database, login, photo storage) · GitHub Pages

## Prototype mode
If `config.js` still has the placeholder Supabase values, everything runs in your browser (the login code appears in an email-style card instead of being emailed). Log in as **admin@bennett.edu.in** to see the moderator side.

## Files
| File | What it does |
|---|---|
| index.html | page structure |
| style.css | looks (change colours in `:root`) |
| app.js | all the logic, with comments |
| config.js | Supabase keys, college domain, prototype moderators |
| schema.sql | database tables, security and approval rules |

## Known limitations
- Moderators are people, so approval can be slow. Add 2–3 moderators.
- The "passed on" count is reported by sellers, not verified.
- Free email sending is limited per hour. Prototype mode data stays in one browser.

## Team
Add names and roles here.

License: MIT
