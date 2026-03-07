# Avatar Infrastructure Cost Model
### Salesforce Agentforce Edition · Blacksteed

An interactive pricing and infrastructure cost breakdown page for AI avatar deployments integrated with Salesforce Agentforce.

**Live page → [nouman11033.github.io/Salesforce-Pricing-PageCalculator](https://nouman11033.github.io/Salesforce-Pricing-PageCalculator/)**

---

## What's in this page

### Deployment Plans
Four deployment tiers — Pilot, Team, Business, Enterprise — showing estimated infrastructure cost per deployment, avatar minutes, concurrency, and feature availability.

### Internal Cost Architecture
A transparent breakdown of how infrastructure costs scale as usage grows, including:
- **Capacity per infrastructure tier** — pool size, concurrency limits, and per-plan allocation for Tiers 1–4
- **Compute tier estimator** — interactive calculator: input your user count per plan and get real-time upgrade recommendations based on usage vs. overage cost
- **Upgrade trigger ladder** — visual guide showing when overage cost exceeds the next tier's base cost
- **Revenue milestone table** — minimum revenue targets needed to justify each infrastructure tier at a 50% margin

### Feature Comparison Table
Full side-by-side feature matrix across all four plans covering Core Avatar, Usage & Capacity, Automation Triggers, Analytics & Coaching, and Perception & Intelligence.

---

## Cost sources

| Source | What it covers |
|---|---|
| Avatar Conversation API | Per-minute avatar render and streaming cost |
| OpenAI API Inference | GPT model inference per session |
| Session Concurrency Model | Expected simultaneous sessions based on user distribution |

---

## Features

- **USD / INR toggle** — switch all prices between currencies
- **Monthly / Annual billing toggle** — 20% discount on annual
- **Dark / Light mode** — warm grey editorial palette
- **Interactive calculator** — tier upgrade recommendation engine with overage vs. next-tier cost comparison

---

## Stack

Pure HTML · CSS · Vanilla JS — zero dependencies, single file.
