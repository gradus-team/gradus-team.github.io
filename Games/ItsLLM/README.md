# It's LLM — browser strategy

Static browser game in `/Games/ItsLLM/`. No new image/sprite assets or server-side runtime are required. Progress is stored in localStorage in the player's browser.

## Main loop

1. Start with $100 / $1,000 / $10,000 and choose a company name.
2. Order compatible computing hardware; the purchase is charged immediately and the server arrives after one in-game month. Equipment generations change CPU, RAM, VRAM, power draw, price, and expected service life. Bulk orders can contain up to 100 matching servers. The equipment screen has a dedicated bulk-order form, delivery queue, hide/show control for the owned-server list, and fleet-wide upgrade actions with a summed pre-confirmation quote.
3. Buy one or more of 12 dataset types or generate/write a custom corpus. Catalogue base prices are unchanged; the final standard dataset cost uses a ×4 multiplier. Synthetic and hand-written corpora cost 2×/8× the highest catalogue base price, with the multiplier applied once. A 1 GB → 500M parameters and 4 GB memory per GB mapping is an explicit game abstraction, not a real-world training law.
4. In the lab, choose training from scratch or fine-tuning (−20% final brain and logic), then select one dataset type, tick multiple types for one combined job, or distribute training evenly across all dataset types in stock. Completed runs accumulate into the same unpublished lab model until publication; training advances in game months and is capped at 12 months per job. The highest 2026 AI server has enough memory and training throughput to handle at least 2.4 TB jobs as a deliberate game-balance target.
5. Publish models with 1–4 player-named versions/prices. Model strength, reputation, pricing, marketing, throughput and active users affect demand and revenue. Publishing seeds a small initial audience so the business does not remain at exactly zero users forever; normal legacy default tariffs ($0.02/$0.06/$0.16/$0.38) are migrated to $2/$6/$16/$38 per 1,000 messages.
6. Invest in 14 cybersecurity services, 22 bank tariffs, loans, a 20-item technology tree, contracts, shares and acquisitions. Filter banks by APR, minimum reputation and income requirement. Standard deals and time-limited exclusive offers have separate tabs; offers disclose recurring commitments before signing and can be accepted on pause. Compare models by strength, parameters, estimated mind and release year; filters cover year, strength and parameter range, and fictional rivals continue after 2026. Automatic time advances one in-game month every five real-time minutes; skipped-year and automatic-tick news are kept in Notifications.
7. The main historical campaign ends in October 2026. Endless mode continues with fictional competitors. The standard completion certificate requires October 2026 reached, a published 1T-parameter model, reputation ≥50, cash ≥$1.5M, all loans repaid and all fines paid. The separate VIP certificate requires 2035, reputation ≥60, savings ≥$1B, at least half of the permanent contract IDs, a published 10T-parameter model and strength ≥80.

## Site navigation

The homepage toggle switches the complete Antivirus or Engine content group. The Engine group contains GRC documentation links, technical FAQ, games, roadmap, fundraising and purchase/download sections. The Antivirus group retains the antivirus products and its own game catalogue.

## Development checks

Run the static smoke and integration tests with Node.js:

```sh
cd Games/ItsLLM
node --test tests/*.test.cjs
```

The tests cover whole-page Antivirus/Engine switching, the selected-product Engine checkout, full-fit antivirus screenshots, expanded FAQ entries, correct MicroAPI/WebTools separation and roadmap copy, footer navigation/style hooks, pseudo-3D and hardware catalogue sorting, exact single and bulk server-order debits, quote-versus-actual fleet-upgrade totals, selected-multiple-type and sequential dataset training, bank-account and APR/loan rules, 22 bank tariffs, certificate targets, contract tabs, one-year training limits, audience-linked model revenue, dataset ×4 pricing and old-save normalization, pricing and resale safeguards, security controls, pause restrictions, saving, future rivals, stale bank-account migration, legacy tariff recovery, published-model header metrics, Red Team risk contribution, and the five-minute automatic month interval. These are lightweight logic/source tests, not a substitute for visual QA in real desktop and mobile browsers.
