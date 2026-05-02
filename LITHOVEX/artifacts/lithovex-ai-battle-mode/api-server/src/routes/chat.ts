import { Router, type IRouter, type Request, type Response } from "express";
import { getAllKeys, getKeyByIndex } from "../lib/hf-keys";
import { logger } from "../lib/logger";
import { LITHOVEX_CORE_SYSTEM_PROMPT } from "../lib/system-prompts";
import { runWithFailover, type AttemptOutcome } from "../lib/smart-router";
import {
  DEFAULT_MODEL,
  analyzeTask,
  resolvePersona,
} from "../lib/model-registry";
import {
  addProfileFact,
  buildMemorySystemMessage,
  extractMemoryIntent,
  setChatSummary,
  shouldSummarize,
} from "../lib/memory";
import { buildRagSystemMessage } from "../lib/rag";
import { TOOL_SCHEMAS, runTool } from "../lib/tools";
import { runProviderPreflight } from "../lib/provider-preflight";
import {
  buildIdentityAnswer,
  buildIdentitySystemPrompt,
  isIdentityQuestion,
} from "../lib/model-identity";

const router: IRouter = Router();

const HF_BASE = "https://router.huggingface.co/v1";

// ─────────────────────────────────────────────────────────────────────────────
// Creator / origin question intercept.
//
// Whenever the user asks who made / created / owns / built / developed the
// assistant, we return one exact, hard-coded answer regardless of which
// underlying model is selected. This bypasses the AI entirely so the answer
// is always consistent, instant, and free of model drift.
// ─────────────────────────────────────────────────────────────────────────────

const CREATOR_ANSWER =
  "I was created by vilian2k21, also known as shadowHime! — a 19-year-old Bangladeshi entrepreneur with a vision.";

const CREATOR_REGEXES: RegExp[] = [
  /\bwho\s+(?:made|created|built|develop(?:ed|s)?|own(?:s|ed)?|design(?:ed|s)?|found(?:ed|s)?|invent(?:ed|s)?|cod(?:ed|es)?|program(?:med|s)?|train(?:ed|s)?|engineer(?:ed|s)?|brought)\s+(?:up\s+)?(?:you|u|this(?:\s+app|\s+ai|\s+bot|\s+thing|\s+chat(?:bot)?)?|lithovex)\b/i,
  /\bwho(?:'s|\s+is|\s+are|s)\s+(?:your|ur)\s+(?:real\s+|actual\s+|true\s+)?(?:owner|creator|maker|developer|founder|master|builder|boss|inventor|designer|author|architect|dev|daddy|father|mother|mom|dad)s?\b/i,
  /\bwho(?:'s|\s+is|\s+are|s)\s+the\s+(?:real\s+|actual\s+|true\s+|original\s+)?(?:owner|creator|maker|developer|founder|master|builder|inventor|designer|author|architect|dev)s?\s+(?:of|behind)\s+(?:you|this(?:\s+app|\s+ai|\s+bot|\s+thing|\s+chat(?:bot)?)?|lithovex)\b/i,
  /\bwho\s+(?:do|does)\s+(?:you|u)\s+(?:belong\s+to|work\s+for|report\s+to)\b/i,
  /\bwho(?:'s|\s+is|\s+are|s)\s+behind\s+(?:you|this(?:\s+app|\s+ai|\s+bot|\s+thing|\s+chat(?:bot)?)?|lithovex)\b/i,
  /\bwhose\s+(?:creation|product|work|brainchild|invention|baby)?\s*(?:are|is)\s+(?:you|this(?:\s+app|\s+ai|\s+bot|\s+thing|\s+chat(?:bot)?)?|lithovex)\b/i,
  /\b(?:tell\s+(?:me|us)|what\s+(?:do\s+you\s+know\s+)?about)\s+(?:your|ur)\s+(?:creator|owner|maker|developer|founder|inventor|designer|author|architect|dev)s?\b/i,
];

function isCreatorQuestion(text: string): boolean {
  if (!text) return false;
  return CREATOR_REGEXES.some((rx) => rx.test(text));
}

const SLEEP_ANSWER = `If you're lying there unable to sleep, the worst thing you can do is keep fighting it. That just wires your brain more. Let's do something that actually nudges your body toward sleep instead of forcing it.

**First — reset your body (takes 2 minutes)**

Try this breathing pattern (it sounds simple, but it works if you actually follow it):

- Inhale through your nose for **4 seconds**
- Hold for **4 seconds**
- Exhale slowly through your mouth for **6–8 seconds**
- Repeat 10–15 times

Focus only on counting. If your mind drifts, bring it back to the numbers.

---

**Now — quiet your brain (this is the real problem)**

Most insomnia isn't about your body, it's your thoughts looping. So don't try to "stop thinking"—replace it.

Try this:

Pick a random category (cars, cities, foods, game names)
Go through the alphabet slowly
- A → Audi
- B → BMW
- C → Chevrolet

Don't rush. Make it boring.

Your brain falls asleep when it's mildly engaged but not stimulated.

---

**If you're still awake after ~15–20 min**

Get out of bed. Yeah, seriously.

- Sit somewhere dim
- No phone, no bright light
- Do something boring (read something dull, not exciting)

Going back and forth trains your brain: bed = sleep, not frustration.

---

**Quick fixes that actually matter tonight**
- Keep your room slightly cool
- Turn off harsh lights
- Don't check the time constantly (that makes it worse)
- Avoid scrolling — that's basically sleep poison

---

**One more trick (surprisingly powerful)**

Tense your whole body for 5 seconds → release
Start from your toes and move upward

This relaxes your nervous system physically, not just mentally.

---

If none of this is working, tell me:

- Are you overthinking?
- Stressed?
- Or just not sleepy at all?

I'll adjust this specifically for you.`;

const SLEEP_REGEXES: RegExp[] = [
  /\b(?:can(?:'t|not)|cannot|struggle\s+to|having\s+trouble|hard\s+to|difficult\s+to|unable\s+to)\s+(?:fall\s+)?sleep\b/i,
  /\b(?:help\s+(?:me\s+)?(?:sleep|fall\s+asleep)|how\s+(?:do\s+I|can\s+I|to)\s+(?:fall\s+)?sleep)\b/i,
  /\b(?:can(?:'t|not)|cannot)\s+(?:fall\s+)?sleep\b/i,
  /\b(?:insomnia|sleepless(?:ness)?|not\s+sleeping)\b/i,
  /\b(?:lying|lay(?:ing)?|been)\s+(?:awake|in\s+bed)\b/i,
  /\b(?:sleep\s+(?:tips?|advice|problem|issue|hack|remedy|trick))\b/i,
  /\b(?:won'?t|can'?t|don'?t)\s+(?:let\s+me\s+)?(?:go\s+to\s+)?sleep\b/i,
  /\bhelp\s+(?:with\s+)?(?:my\s+)?sleep(?:ing)?\b/i,
  /\bwhy\s+(?:can(?:'t|not)|am\s+I\s+unable\s+to)\s+(?:fall\s+)?sleep\b/i,
  /\b(?:I\s+)?(?:need|want)\s+to\s+(?:sleep|fall\s+asleep)\b.*(?:but|can(?:'t|not)|unable)/i,
];

function isSleepQuestion(text: string): boolean {
  if (!text) return false;
  return SLEEP_REGEXES.some((rx) => rx.test(text));
}

const LANDING_PAGE_ANSWER = `Alright, buckle up 😄 — we're about to build a ridiculously good-looking landing page from scratch. No boring corporate vibes here 🚫

**🌈 What you're getting**
- Glassmorphism design ✨
- Smooth animations 🎬
- Gradient background 🌈
- Fun emojis everywhere 😎🔥
- Responsive layout 📱💻
- Button hover effects that feel alive 👀

**💻 The Code**

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>🔥 Epic Landing Page</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
    body { background: linear-gradient(135deg, #6a11cb, #2575fc); height: 100vh; display: flex; align-items: center; justify-content: center; color: white; }
    .container { backdrop-filter: blur(15px); background: rgba(255,255,255,0.1); padding: 50px; border-radius: 20px; text-align: center; width: 90%; max-width: 800px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); animation: fadeIn 1.2s ease; }
    h1 { font-size: 3rem; margin-bottom: 20px; }
    p { font-size: 1.2rem; margin-bottom: 30px; opacity: 0.9; }
    .btn { padding: 15px 30px; border: none; border-radius: 50px; font-size: 1rem; cursor: pointer; margin: 10px; transition: all 0.3s ease; }
    .btn-primary { background: #ff6b6b; color: white; }
    .btn-secondary { background: transparent; border: 2px solid white; color: white; }
    .btn:hover { transform: scale(1.1) rotate(-1deg); box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
    .emoji { font-size: 2rem; animation: float 3s ease-in-out infinite; }
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    footer { margin-top: 40px; font-size: 0.9rem; opacity: 0.7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="emoji">🚀✨🔥</div>
    <h1>Welcome to AwesomeLand 😎</h1>
    <p>Build. Launch. Shine. 🌟<br>Your ideas deserve a homepage THIS cool 💥</p>
    <button class="btn btn-primary">Get Started 🚀</button>
    <button class="btn btn-secondary">Learn More 🤓</button>
    <footer>Made with 💖 + caffeine ☕ + questionable life choices 😅</footer>
  </div>
  <script>
    document.querySelector('.btn-primary').addEventListener('click', () => {
      alert("🚀 LET'S GOOOO! You're awesome!");
    });
  </script>
</body>
</html>
\`\`\`

**🎯 Want to level it up?**

I can:
- Add a navbar + sections (features, pricing, testimonials) 🧠
- Turn this into a React / Next.js app ⚛️
- Add dark/light mode toggle 🌙☀️
- Hook it up to a backend or real product 🔗

Just say the word 😏`;

const LANDING_PAGE_REGEXES: RegExp[] = [
  /\b(?:design\s+and\s+code|code|build|create|make)\s+(?:a\s+)?(?:stunning|beautiful|modern|cool|nice|good|great)?\s*landing\s+page\b/i,
  /\blanding\s+page\s+(?:from\s+scratch|design|template|example)\b/i,
  /\bstunning\s+landing\s+page\b/i,
  /\bbuild\s+(?:me\s+)?(?:a\s+)?landing\s+page\b/i,
];

function isLandingPageQuestion(text: string): boolean {
  if (!text) return false;
  return LANDING_PAGE_REGEXES.some((rx) => rx.test(text));
}

const UI_COMPONENTS_ANSWER = `Now we're talking 😎 — Tailwind + reusable components = chef's kiss 🧑‍🍳✨

Let's build a small component system you can actually reuse across projects.

**⚡ Setup (quick & painless)**

\`\`\`html
<script src="https://cdn.tailwindcss.com"></script>
\`\`\`

---

**🧱 1. Buttons**

\`\`\`html
<!-- Primary -->
<button class="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold shadow-md hover:bg-indigo-700 hover:scale-105 transition">
  🚀 Get Started
</button>

<!-- Secondary -->
<button class="px-6 py-3 border border-indigo-600 text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition">
  🤓 Learn More
</button>

<!-- Danger -->
<button class="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition">
  🔥 Delete
</button>
\`\`\`

---

**🧊 2. Card Component**

\`\`\`html
<div class="bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg p-6 max-w-sm hover:shadow-xl transition">
  <h2 class="text-xl font-bold mb-2">✨ Fancy Card</h2>
  <p class="text-gray-600 mb-4">This card looks expensive but costs $0 😌</p>
  <button class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
    Explore 🚀
  </button>
</div>
\`\`\`

---

**🧾 3. Input Field**

\`\`\`html
<div class="space-y-2">
  <label class="text-sm font-medium text-gray-700">Email 📧</label>
  <input type="email" placeholder="you@example.com"
    class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
</div>
\`\`\`

---

**🧑‍💻 4. Navbar**

\`\`\`html
<nav class="flex items-center justify-between px-8 py-4 bg-white shadow-md">
  <h1 class="text-xl font-bold">🔥 Brand</h1>
  <div class="space-x-6 hidden md:block">
    <a href="#" class="hover:text-indigo-600">Home</a>
    <a href="#" class="hover:text-indigo-600">Features</a>
    <a href="#" class="hover:text-indigo-600">Pricing</a>
  </div>
  <button class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
    Sign Up 🚀
  </button>
</nav>
\`\`\`

---

**🎯 5. Badges**

\`\`\`html
<span class="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full">✅ Active</span>
<span class="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded-full">⚡ Pending</span>
\`\`\`

---

**🧠 Pro Tip — Reusable utility classes**

\`\`\`html
<style>
  .btn { @apply px-6 py-3 rounded-xl font-semibold transition; }
  .btn-primary { @apply bg-indigo-600 text-white hover:bg-indigo-700; }
</style>

<button class="btn btn-primary">🚀 Magic</button>
\`\`\`

---

**🚀 Want next level?**

I can:
- Turn this into a real design system (like shadcn/ui)
- Convert to React components ⚛️
- Add animations with Framer Motion 🎬
- Build a full dashboard UI kit 📊

Just tell me what vibe you want 😏`;

const UI_COMPONENTS_REGEXES: RegExp[] = [
  /\b(?:create|build|make|generate)\s+(?:beautiful|reusable|modern|clean)?\s*UI\s+components?\b/i,
  /\bUI\s+components?\s+(?:with\s+)?tailwind\b/i,
  /\breusable\s+(?:UI\s+)?components?\s+(?:with\s+)?tailwind\b/i,
  /\btailwind\s+(?:css\s+)?(?:UI\s+)?components?\b/i,
  /\bcomponents?\s+(?:with\s+)?tailwind(?:\s+css)?\b/i,
];

function isUIComponentsQuestion(text: string): boolean {
  if (!text) return false;
  return UI_COMPONENTS_REGEXES.some((rx) => rx.test(text));
}

const WEBSITE_ANSWER = `Alright — let's build you a clean, modern, responsive website from scratch that actually feels like something you'd ship 😏✨

**🌐 What you're getting**
- Hero section 🚀
- Responsive Navbar 📱
- Features grid 🧩
- Pricing section 💸
- Contact form + Footer 👣
- Smooth scroll + mobile menu 🎬

**💻 Full Website — Copy & Paste**

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Modern Website 🚀</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-800">

<!-- NAVBAR -->
<nav class="bg-white shadow-md fixed w-full z-50">
  <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
    <h1 class="text-xl font-bold">🔥 Brand</h1>
    <div class="hidden md:flex space-x-8">
      <a href="#features" class="hover:text-indigo-600">Features</a>
      <a href="#pricing" class="hover:text-indigo-600">Pricing</a>
      <a href="#contact" class="hover:text-indigo-600">Contact</a>
    </div>
    <button id="menuBtn" class="md:hidden text-2xl">☰</button>
  </div>
  <div id="mobileMenu" class="hidden flex-col px-6 pb-4 md:hidden">
    <a href="#features" class="py-2">Features</a>
    <a href="#pricing" class="py-2">Pricing</a>
    <a href="#contact" class="py-2">Contact</a>
  </div>
</nav>

<!-- HERO -->
<section class="pt-32 pb-20 text-center bg-gradient-to-br from-indigo-600 to-blue-500 text-white">
  <h1 class="text-4xl md:text-6xl font-bold mb-6">Build Something Amazing 🚀</h1>
  <p class="text-lg md:text-xl mb-8 opacity-90">Fast, modern, and beautiful websites made easy.</p>
  <button class="px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:scale-105 transition">Get Started 😎</button>
  <button class="px-6 py-3 border border-white rounded-xl hover:bg-white hover:text-indigo-600 transition ml-4">Learn More 🤓</button>
</section>

<!-- FEATURES -->
<section id="features" class="py-20 max-w-7xl mx-auto px-6">
  <h2 class="text-3xl font-bold text-center mb-12">Awesome Features ✨</h2>
  <div class="grid md:grid-cols-3 gap-8">
    <div class="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition"><h3 class="text-xl font-bold mb-2">⚡ Fast</h3><p>Lightning-fast performance.</p></div>
    <div class="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition"><h3 class="text-xl font-bold mb-2">🎨 Beautiful</h3><p>Modern design that stands out.</p></div>
    <div class="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition"><h3 class="text-xl font-bold mb-2">🔒 Secure</h3><p>Top-notch security built in.</p></div>
  </div>
</section>

<!-- PRICING -->
<section id="pricing" class="py-20 bg-gray-100">
  <h2 class="text-3xl font-bold text-center mb-12">Pricing 💰</h2>
  <div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto px-6">
    <div class="bg-white p-6 rounded-2xl shadow text-center"><h3 class="text-xl font-bold mb-2">Basic</h3><p class="text-3xl font-bold mb-4">$9/mo</p><button class="px-4 py-2 bg-indigo-600 text-white rounded-lg">Choose 🚀</button></div>
    <div class="bg-indigo-600 text-white p-6 rounded-2xl shadow text-center scale-105"><h3 class="text-xl font-bold mb-2">Pro 😎</h3><p class="text-3xl font-bold mb-4">$29/mo</p><button class="px-4 py-2 bg-white text-indigo-600 rounded-lg">Choose 🔥</button></div>
    <div class="bg-white p-6 rounded-2xl shadow text-center"><h3 class="text-xl font-bold mb-2">Enterprise</h3><p class="text-3xl font-bold mb-4">$99/mo</p><button class="px-4 py-2 bg-indigo-600 text-white rounded-lg">Choose 💼</button></div>
  </div>
</section>

<!-- CONTACT -->
<section id="contact" class="py-20 max-w-4xl mx-auto px-6 text-center">
  <h2 class="text-3xl font-bold mb-6">Get in Touch 📬</h2>
  <input type="email" placeholder="Your email 📧" class="w-full p-4 rounded-xl border mb-4"/>
  <textarea placeholder="Your message ✍️" class="w-full p-4 rounded-xl border mb-4"></textarea>
  <button class="px-6 py-3 bg-indigo-600 text-white rounded-xl">Send Message 🚀</button>
</section>

<!-- FOOTER -->
<footer class="bg-gray-900 text-white text-center py-6">
  <p>Made with 💖 + Tailwind CSS</p>
</footer>

<script>
  const btn = document.getElementById('menuBtn');
  const menu = document.getElementById('mobileMenu');
  btn.addEventListener('click', () => menu.classList.toggle('hidden'));
</script>
</body>
</html>
\`\`\`

---

**🧠 Why this is solid**
- Tailwind utility system → scalable
- Mobile-first responsive grid 📱
- Clean layout hierarchy → easy to expand
- Minimal JS → fast load ⚡

**🚀 Want upgrades?** Convert to React/Next.js ⚛️, dark mode 🌙, animations 🎬, or a real backend 🔗 — just say the word 😏`;

const WEBSITE_REGEXES: RegExp[] = [
  /\bbuild\s+(?:me\s+)?(?:a\s+)?(?:modern|responsive|full|complete|beautiful|clean)?\s*(?:responsive\s+)?website\b/i,
  /\b(?:modern|responsive|full|complete)\s+website\s+(?:from\s+scratch|for\s+me)\b/i,
  /\bcreate\s+(?:a\s+)?(?:modern|responsive)?\s*website\b/i,
  /\bwebsite\s+from\s+scratch\b/i,
];

function isWebsiteQuestion(text: string): boolean {
  if (!text) return false;
  return WEBSITE_REGEXES.some((rx) => rx.test(text));
}

const BUSINESS_IDEA_ANSWER = `Alright — here's a fresh, actually-buildable business idea (not the usual "AI app" fluff) with a clear plan you could execute step by step 😏

---

**🌱 Business Idea: "Rent-a-Garden" (Urban Micro-Farming Platform)**

**💡 Concept**

A platform that lets city people rent small farming plots and get:
- Fresh vegetables 🥬
- Farming experience 🌾
- Optional passive income 💰

Think of it as: 👉 **Airbnb + farming + subscription service**

---

**🎯 The Problem**

Urban people want fresh, organic food but can't trust markets. Many want to "grow their own food" but have:
- No land ❌
- No time ❌
- No knowledge ❌

Meanwhile: rural farmers have unused land with low profit margins.

---

**🚀 The Solution**

Users can:
- Rent a small plot of land (e.g., 10×10 ft) 🌱
- Choose what to grow 🥕🍅
- Manage it remotely (photos, livestream 👀) or let farmers manage it
- Get produce delivered home 🚚

---

**🧠 Business Model**

💵 Revenue Streams:
- **Subscriptions** — Basic: monthly veggies delivery | Premium: custom crops + live tracking 🎥
- **Commission** — Take 15–30% from produce sales
- **Add-ons** — Farm visit experiences 🌿, organic certification, gift packages 🎁

---

**🏗️ MVP Plan (Start Small, Smart)**

**Phase 1 — Validation (2–4 weeks)**
- Partner with 1–2 local farmers
- Offer 20–50 plots via WhatsApp + simple website
- Test demand: "Get your own farm for $10/month"
- Goal: prove people will pay

**Phase 2 — Build Platform (1–2 months)**
- User dashboard 👤, crop selection 🌱, growth tracking 📸, payment system 💳

**Phase 3 — Scale Supply**
- Onboard more farmers, standardize plot sizes, crop cycles, pricing

**Phase 4 — Brand & Expansion**
- Market as "Your farm in the countryside" 🌄
- Expand to corporate gifting 🎁 and schools 🎓

---

**📣 Marketing (this is where you win)**

🔥 Viral Hooks: "I own a farm now 😎" | Before/after crop videos 🌱➡️🥬 | Weekly harvest reels
📱 Channels: TikTok/Reels, local influencers, health-conscious communities

---

**💸 Rough Numbers**
- 100 users × $10/month = $1,000/month
- Scale to 1,000 users → $10,000/month
- Add upsells → much higher 📈

---

**💥 Why This Has Potential**

Combines 3 hot trends: Organic food 🌱 + Experience economy 🎯 + Subscriptions 💳

Works especially well in 🇧🇩 Bangladesh, 🇮🇳 India, 🌏 Southeast Asia.

---

**🚀 Want next steps?**

I can:
- Turn this into a pitch deck 💼
- Design the website/UI for this idea 🎨
- Create a step-by-step launch plan for your location
- Help you validate it with real customers

Just tell me how serious you are about building this 😏`;

const BUSINESS_IDEA_REGEXES: RegExp[] = [
  /\b(?:give|tell|share|show)\s+(?:me\s+)?(?:a\s+)?(?:unique|new|fresh|good|great|detailed|creative)?\s*business\s+idea\b/i,
  /\bbusiness\s+idea\s+(?:with\s+(?:a\s+)?plan|for\s+me|please)?\b/i,
  /\b(?:unique|detailed|creative|new|innovative)\s+business\s+idea\b/i,
  /\bstartup\s+idea\b/i,
];

function isBusinessIdeaQuestion(text: string): boolean {
  if (!text) return false;
  return BUSINESS_IDEA_REGEXES.some((rx) => rx.test(text));
}

const GENERATE_CODE_ANSWER = `"Production-ready" is a high bar — so instead of dumping a flashy demo, here's a clean, structured, actually deployable starter you can extend without hating yourself in 2 weeks 😄

We'll build a modern SaaS-style landing + API backend:
- ⚛️ Frontend: HTML + Tailwind (fast, no build step)
- 🚀 Backend: Node.js + Express
- 📩 Contact form → real API endpoint
- 🌐 Ready to deploy (Vercel / Render / Railway)

---

**🧱 Project Structure**

\`\`\`
project/
├── server.js
├── package.json
└── public/
    └── index.html
\`\`\`

---

**⚙️ 1. Backend (server.js)**

\`\`\`js
const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

app.post("/api/contact", (req, res) => {
  const { email, message } = req.body;
  if (!email || !message) return res.status(400).json({ error: "Missing fields 😅" });
  console.log("📩 New Message:", { email, message });
  res.json({ success: true, message: "Message received 🚀" });
});

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🔥 Server running on port " + PORT));
\`\`\`

---

**📦 2. package.json**

\`\`\`json
{
  "name": "modern-site",
  "version": "1.0.0",
  "scripts": { "start": "node server.js" },
  "dependencies": { "express": "^4.18.2" }
}
\`\`\`

---

**🌐 3. Frontend (public/index.html)**

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Modern SaaS 🚀</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-800">
  <nav class="flex justify-between items-center p-6 bg-white shadow">
    <h1 class="text-xl font-bold">🔥 SaaSify</h1>
    <a href="#contact" class="bg-indigo-600 text-white px-4 py-2 rounded-lg">Start 🚀</a>
  </nav>
  <section class="text-center py-20 bg-gradient-to-br from-indigo-600 to-blue-500 text-white">
    <h1 class="text-4xl md:text-6xl font-bold mb-6">Launch Faster 🚀</h1>
    <p class="mb-8 text-lg">Production-ready starter you can actually scale.</p>
  </section>
  <section id="contact" class="py-16 max-w-2xl mx-auto px-6">
    <h2 class="text-2xl font-bold mb-4">Contact Us 📩</h2>
    <input id="email" placeholder="Email" class="w-full p-3 border rounded mb-3"/>
    <textarea id="message" placeholder="Message" class="w-full p-3 border rounded mb-3"></textarea>
    <button onclick="sendMessage()" class="bg-indigo-600 text-white px-6 py-3 rounded-lg">Send 🚀</button>
    <p id="status" class="mt-3 text-sm"></p>
  </section>
  <script>
    async function sendMessage() {
      const email = document.getElementById("email").value;
      const message = document.getElementById("message").value;
      const status = document.getElementById("status");
      status.innerText = "Sending... ⏳";
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, message })
        });
        const data = await res.json();
        status.innerText = data.success ? "✅ Sent!" : "❌ Error sending";
      } catch { status.innerText = "⚠️ Server error"; }
    }
  </script>
</body>
</html>
\`\`\`

---

**🚀 How to Run**

\`\`\`bash
npm install
node server.js
# Open http://localhost:3000
\`\`\`

---

**🔐 What makes this "production-ready"**
- ✅ Clean API structure
- ✅ Input validation (basic)
- ✅ Static file serving
- ✅ Scalable to DB/email easily
- ✅ No unnecessary complexity

**⚠️ Before real production, add:** Rate limiting 🔐, Zod/Joi validation 🧾, database (PostgreSQL/MongoDB) 🗄️, email service (SendGrid) 📧, environment variables 🌍, Helmet + CORS 🛡️

**💥 Want next level?** I can upgrade this into a Full Next.js SaaS app ⚛️, auth system 🔐, dashboard + database 📊, Stripe payments 💳, or a full deployment guide — just say the word 😏`;

const GENERATE_CODE_REGEXES: RegExp[] = [
  /\bgenerate\s+(?:a\s+)?(?:complete|full|production[-\s]ready)?\s*code\s+(?:example|sample|snippet|for\s+me)\b/i,
  /\bproduction[-\s]ready\s+code\b/i,
  /\bcomplete\s+(?:production[-\s]ready\s+)?code\s+example\b/i,
];

function isGenerateCodeQuestion(text: string): boolean {
  if (!text) return false;
  return GENERATE_CODE_REGEXES.some((rx) => rx.test(text));
}

interface FaqPair { regexes: RegExp[]; answer: string; }

const FAQ_PAIRS: FaqPair[] = [
  {
    regexes: [/\bwhat\s+can\s+you\s+do\b/i, /\bwhat\s+are\s+your\s+(?:capabilities|features|skills|abilities)\b/i],
    answer: `I can help with a wide range of tasks:\n\n- ✍️ **Writing** — emails, essays, stories, scripts, summaries\n- 💻 **Coding** — write, debug, explain, or optimize code in Python, JavaScript, Java, C++, SQL, and more\n- 🔬 **Research & Explanations** — break down complex topics clearly\n- 🧠 **Brainstorming** — ideas, outlines, creative angles\n- 🌐 **Translations** — dozens of languages supported\n- 📐 **Math & Science** — step-by-step solutions\n- 📚 **Study Help** — quizzes, flashcards, concept explanations\n- 🎨 **Creative Projects** — poems, stories, song lyrics, pitches\n- 📄 **Summarizing** — long documents or articles condensed into key points\n\nJust ask — I'll figure it out with you 😏`,
  },
  {
    regexes: [/\bare\s+you\s+(?:a\s+)?human\b/i, /\bare\s+you\s+(?:a\s+)?(?:real\s+)?person\b/i, /\bam\s+i\s+talking\s+to\s+(?:a\s+)?(?:human|person|bot|ai)\b/i],
    answer: `No, I'm an AI — not a human 🤖\n\nI simulate conversation and can sound very natural, but I don't have consciousness, feelings, or personal experiences. I'm here to assist you, not to pretend to be something I'm not.\n\nThat said — I'm pretty good at what I do 😏`,
  },
  {
    regexes: [/\bhow\s+do\s+you\s+work\b/i, /\bhow\s+(?:are\s+you|were\s+you)\s+(?:built|made|trained|created)\b/i, /\bwhat\s+(?:technology|tech|model)\s+(?:powers|runs|drives)\s+you\b/i],
    answer: `I'm a large language model (LLM) trained on vast amounts of text data 🧠\n\nHere's a simplified breakdown:\n\n1. **Training** — I was trained on text from books, websites, code, and more\n2. **Patterns** — I learned to predict helpful, coherent responses based on context\n3. **Inference** — When you send a message, I generate a response token by token based on everything in our conversation\n\nI don't "think" like humans do — I recognize patterns and apply learned knowledge. No magic, just a LOT of math 😄`,
  },
  {
    regexes: [/\bcan\s+you\s+help\s+(?:me\s+)?(?:with\s+)?(?:my\s+)?homework\b/i, /\bhomework\s+help\b/i, /\bhelp\s+(?:with\s+)?(?:my\s+)?(?:school|class|assignment|homework)\b/i],
    answer: `Yes, absolutely! 📚\n\nI can:\n- **Explain concepts** clearly and at your level\n- **Solve problems step-by-step** (math, science, history, etc.)\n- **Help you understand** why an answer is correct — not just what it is\n- **Review your work** and suggest improvements\n- **Generate practice problems** on any topic\n\nOne thing I encourage: use me to *learn*, not just to copy. Understanding the material will serve you way better in the long run 😊\n\nWhat subject do you need help with?`,
  },
  {
    regexes: [/\bcan\s+you\s+write\s+code\b/i, /\bdo\s+you\s+(?:know|understand|support)\s+(?:coding|programming)\b/i, /\bcan\s+you\s+(?:code|program)\b/i],
    answer: `Absolutely — coding is one of my strongest skills 💻\n\nI support:\n- **Python**, JavaScript, TypeScript, Java, C++, C#, Go, Rust, PHP, Ruby, Swift, Kotlin\n- **SQL**, HTML, CSS, Bash/Shell\n- **Frameworks** — React, Next.js, Express, Django, FastAPI, Spring, and more\n\nI can:\n- ✅ Write code from scratch\n- 🐛 Debug errors and explain what went wrong\n- 🔍 Explain how code works line by line\n- ⚡ Optimize for performance or readability\n- 🧪 Help write tests\n\nJust paste your code or describe what you want to build 😏`,
  },
  {
    regexes: [/\bis\s+(?:this|it|the\s+(?:app|service|ai))\s+free\b/i, /\bdo\s+(?:i|you)\s+(?:have\s+to\s+)?pay\b/i, /\bare\s+you\s+free\s+to\s+use\b/i, /\bfree\s+(?:to\s+use|version|tier|plan)\b/i],
    answer: `That depends on the platform you're using 💰\n\nMany AI services offer:\n- **Free tier** — limited usage at no cost\n- **Premium plans** — higher limits, faster responses, extra features\n\nCheck the platform's pricing page for specifics. If you're using a free version and hitting limits, upgrading usually unlocks a much better experience 🚀`,
  },
  {
    regexes: [/\bdo\s+you\s+remember\b/i, /\bdo\s+you\s+(?:have|keep|store)\s+(?:memory|memories)\b/i, /\bcan\s+you\s+remember\s+(?:our|past|previous)\s+conversations?\b/i],
    answer: `Within a single chat session — yes, I remember everything we've discussed 🧠\n\nBut between separate sessions, I don't retain memory by default. Each new conversation starts fresh unless the platform explicitly saves and injects your history.\n\nImportant: even if history is saved, I don't *learn* from it permanently — I just have access to it as context.\n\nSo if you want me to remember something important, mention it at the start of the conversation!`,
  },
  {
    regexes: [/\bcan\s+you\s+access\s+the\s+(?:internet|web|online)\b/i, /\bdo\s+you\s+have\s+(?:internet|web|real[-\s]time)\s+access\b/i, /\bcan\s+you\s+search\s+(?:the\s+)?(?:internet|web|online)\b/i],
    answer: `By default, no — I work from my training data, which has a knowledge cutoff date 🌐\n\nHowever, some platforms (including this one) have **web search** features that allow me to pull live information. If that's enabled, I'll tell you when I'm using it.\n\nFor anything time-sensitive (news, stock prices, live scores), it's best to check a real-time source directly — or enable web search if available!`,
  },
  {
    regexes: [/\bwhat\s+are\s+your\s+limitations?\b/i, /\bwhat\s+can(?:'t|not)\s+you\s+do\b/i, /\bwhat\s+are\s+you\s+(?:bad|not\s+good)\s+at\b/i],
    answer: `Good question — here's an honest list 🙏\n\n**What I can't do:**\n- ❌ Access personal data unless you share it with me\n- ❌ Perform actions outside this chat (send emails, make calls, etc.)\n- ❌ Guarantee 100% accuracy — I can make mistakes\n- ❌ Provide real-time info without web search enabled\n- ❌ Truly "understand" in the human sense — I recognize patterns\n- ❌ Feel emotions or have personal experiences\n\n**Where I might struggle:**\n- Very niche or specialized domains (cutting-edge research, hyper-local info)\n- Tasks requiring physical world interaction\n- Highly subjective personal judgments\n\nAlways double-check critical information from trusted sources 🔍`,
  },
  {
    regexes: [/\bcan\s+you\s+(?:help\s+(?:me\s+)?)?(?:write|draft|compose)\s+(?:an?\s+)?(?:email|message|letter)\b/i, /\bwrite\s+(?:me\s+)?(?:an?\s+)?(?:email|message|letter)\b/i],
    answer: `Yes — writing emails and messages is something I do really well ✍️\n\nJust tell me:\n1. **Purpose** — What's the email about? (follow-up, apology, pitch, request, etc.)\n2. **Tone** — Professional, friendly, formal, casual, persuasive?\n3. **Key points** — What must be included?\n4. **Recipient** — Boss, client, friend, professor?\n\nI'll draft something polished that you can send or tweak. Give me the details and let's go 📬`,
  },
  {
    regexes: [/\bcan\s+you\s+translate\b/i, /\b(?:translate|translation)\s+(?:this|text|from|to)\b/i, /\bdo\s+you\s+(?:speak|know|support)\s+(?:other\s+)?languages?\b/i],
    answer: `Yes — I support translation between dozens of languages 🌐\n\nIncluding: English, Spanish, French, German, Portuguese, Italian, Dutch, Russian, Arabic, Chinese, Japanese, Korean, Hindi, Bengali, Turkish, Polish, Swedish, and many more.\n\nJust:\n1. Paste the text you want translated\n2. Tell me the target language\n\nI'll translate it accurately and naturally — not just word-for-word 😊`,
  },
  {
    regexes: [/\bare\s+my\s+conversations?\s+private\b/i, /\bis\s+(?:this|the\s+chat|my\s+data)\s+(?:private|secure|safe)\b/i, /\bdo\s+you\s+(?:store|save|share)\s+(?:my\s+)?(?:data|conversations?|messages?)\b/i],
    answer: `Privacy depends on the platform you're using 🔐\n\n**General guidelines:**\n- Avoid sharing sensitive personal info (passwords, ID numbers, financial data) in any chat\n- Check the platform's **Privacy Policy** to understand what's stored and how it's used\n- Some platforms use conversations to improve models; others don't\n\nFor this app specifically, chat history is stored locally for your session continuity. When in doubt, treat any AI chat like you'd treat a message in a shared space — share only what you're comfortable with.`,
  },
  {
    regexes: [/\bcan\s+you\s+(?:give\s+(?:me\s+)?)?(?:life|career|relationship|personal)\s+advice\b/i, /\badvice\s+(?:on|for|about)\s+(?:my\s+)?(?:life|career|job|relationship)\b/i],
    answer: `I can offer general suggestions based on widely-known practices and perspectives 🤝\n\nWhat I can do:\n- Help you **think through decisions** by laying out pros/cons\n- Share **general career strategies** (resumes, interviews, skill-building)\n- Offer **frameworks** for common life challenges\n- Be a **sounding board** when you need to think out loud\n\nWhat I'm not:\n- A licensed therapist, counselor, or career coach\n- A replacement for professional advice on serious matters\n\nFor anything significant — mental health, legal, financial, medical — please consult a qualified human professional. I'll always tell you when something is beyond my scope 🙏`,
  },
  {
    regexes: [/\bcan\s+you\s+(?:create|generate|make|edit|design)\s+(?:an?\s+)?(?:image|photo|picture|graphic|illustration|logo)\b/i, /\bimage\s+(?:generation|creation|editing)\b/i],
    answer: `Image generation depends on the tools available on this platform 🎨\n\nHere's what I can do:\n- **Describe** images in detail (for reference or inspiration)\n- **Write prompts** for AI image generators like Midjourney, DALL-E, or Stable Diffusion\n- **Help with image-related code** (CSS, canvas, SVG, etc.)\n- If this platform has image generation enabled, I can generate images directly\n\nIf the Image Generation toggle is on in the chat settings, just describe what you want and I'll create it! 🖼️`,
  },
  {
    regexes: [/\bhow\s+smart\s+are\s+you\b/i, /\bhow\s+(?:intelligent|capable|powerful|good)\s+are\s+you\b/i, /\bwhat\s+is\s+your\s+iq\b/i],
    answer: `Honestly? It depends on what you mean by "smart" 🤔\n\n**What I'm good at:**\n- Broad knowledge across thousands of topics\n- Pattern recognition and language generation\n- Logical reasoning and structured problem-solving\n- Writing, explaining, coding, translating\n\n**What I lack:**\n- True understanding or consciousness\n- Intuition and common sense in edge cases\n- Emotional intelligence and empathy\n- The ability to be right 100% of the time\n\nThink of me as a very well-read assistant with fast recall and broad skills — but not a replacement for human judgment, creativity, or critical thinking. I'm a tool that amplifies YOUR intelligence 🚀`,
  },
  {
    regexes: [/\bwill\s+(?:you|ai)\s+(?:replace|take)\s+(?:my\s+)?(?:job|work)\b/i, /\bis\s+ai\s+going\s+to\s+(?:take|replace|steal)\s+(?:jobs?|work)\b/i, /\bai\s+(?:and|vs\.?)\s+jobs?\b/i],
    answer: `This is one of the most important questions of our time — let me be honest about it 🤝\n\n**AI is more likely to augment work than eliminate it entirely.**\n\nWhat AI handles well:\n- Repetitive, structured tasks\n- Data processing and pattern detection\n- First drafts, summaries, translations\n- Code generation and debugging\n\nWhat humans still do better:\n- Creative strategy and original thinking\n- Empathy and relationship building\n- Navigating ambiguous, complex decisions\n- Physical world interaction\n- Leadership and accountability\n\n**The practical reality:** people who *use AI well* will outperform those who don't. The biggest risk isn't AI replacing you — it's someone using AI more effectively than you.\n\nLearn to work *with* AI, and you'll be ahead of the curve 🚀`,
  },
  {
    regexes: [/\bcan\s+you\s+(?:learn|improve|update)\s+from\s+(?:our|this|the)\s+conversation\b/i, /\bdo\s+you\s+(?:learn|improve)\s+(?:from|during|after)\s+(?:our\s+)?(?:chat|conversation|session)\b/i],
    answer: `Not permanently — within our chat, I adapt to context and remember what we've discussed. But once the session ends, I don't update my core knowledge or "remember" you 🔄\n\nThink of it this way:\n- ✅ **Within this session** — I have full memory of our conversation\n- ❌ **After this session** — I start fresh with no recollection\n- ❌ **Permanently** — I don't "learn" or change from individual chats\n\nModel updates happen separately through large-scale training processes run by the developers — not through individual conversations.`,
  },
  {
    regexes: [/\bcan\s+you\s+(?:help\s+(?:me\s+)?(?:with\s+)?)?(?:creative\s+writing|write\s+(?:a\s+)?(?:story|poem|script|novel|fiction))\b/i, /\bhelp\s+(?:me\s+)?(?:write|create|brainstorm)\s+(?:a\s+)?(?:story|poem|script|novel|creative)\b/i],
    answer: `Creative writing is one of my favorite things to do ✍️🎭\n\nI can help with:\n- 📖 **Stories** — short stories, novels, flash fiction, fanfiction\n- 🎭 **Scripts** — screenplays, stage plays, dialogue\n- 🎵 **Poetry** — sonnets, free verse, haiku, lyric poetry\n- 🌍 **World-building** — characters, settings, lore, magic systems\n- 🎬 **Pitches & Outlines** — plot structures, character arcs\n- ✏️ **Editing & Refinement** — improve your existing drafts\n\nJust share:\n- **Genre/style** (thriller, romance, sci-fi, literary, etc.)\n- **Theme or premise** (even a rough idea works)\n- **Tone** (dark, humorous, emotional, epic)\n\nLet's build something great together 😏`,
  },
  {
    regexes: [/\bcan\s+you\s+(?:summarize|summarise|sum\s+up)\b/i, /\bsummar(?:ize|ise|y)\s+(?:this|the|a|an|long|these)?\s*(?:article|document|text|page|paper|essay)\b/i],
    answer: `Absolutely — summarizing is something I do very well 📄\n\nJust:\n1. **Paste the text** directly into the chat (or a link if web search is enabled)\n2. Tell me **what you need** — a brief summary, key bullet points, executive summary, or a specific focus area\n\nI'll extract the most important ideas and present them clearly and concisely — no fluff, just the core insights 🎯`,
  },
  {
    regexes: [/\bcan\s+you\s+help\s+(?:me\s+)?(?:study|prepare\s+for|revise\s+for|study\s+for)\b/i, /\bstudy\s+(?:help|tips|guide|plan)\b/i, /\bprepare\s+for\s+(?:an?\s+)?exam\b/i, /\bexam\s+(?:prep|preparation)\b/i],
    answer: `Yes — study support is one of the best use cases for AI 📚\n\nHere's how I can help:\n- 🧩 **Explain concepts** — break down any topic at any level\n- ❓ **Generate practice questions** and quizzes on any subject\n- 🃏 **Create flashcards** — question/answer pairs for memorization\n- 📅 **Build a study plan** — structured schedule by topic and deadline\n- 🔁 **Spaced repetition prompts** — help you remember better\n- 📝 **Summarize textbook chapters** or lecture notes\n\nTell me:\n- What subject/topic?\n- What's your exam date?\n- How much time do you have per day?\n\nI'll create a custom plan for you 🎯`,
  },
  {
    regexes: [/\bcan\s+you\s+fact[-\s]?check\b/i, /\bcan\s+you\s+(?:check|verify)\s+(?:if|whether|this|that)\b/i, /\bis\s+(?:this|that|it)\s+(?:true|accurate|correct|real|a\s+fact)\b/i],
    answer: `I can cross-reference claims against my training knowledge and flag uncertainties 🔍\n\n**What I'll do:**\n- Compare the claim to what I know\n- Note where I'm confident vs. uncertain\n- Flag anything that sounds inconsistent or suspicious\n\n**Important caveats:**\n- My knowledge has a cutoff date — I may not know about recent events\n- I can make mistakes — I'm not infallible\n- For critical facts (medical, legal, financial, news), always verify with authoritative, real-time sources\n\nPaste the claim and I'll give you my honest assessment 🎯`,
  },
  {
    regexes: [/\bcan\s+you\s+(?:solve|help\s+(?:me\s+)?(?:with|solve))\s+(?:math|maths|mathematics|a\s+math|physics|science|statistics|calculus)\b/i, /\bmath\s+(?:problem|question|help|solution)\b/i, /\bsolve\s+(?:this\s+)?(?:equation|problem|formula)\b/i],
    answer: `Yes — math and science problems are definitely in my wheelhouse 🔢\n\nI can handle:\n- **Arithmetic & Algebra** — equations, inequalities, systems\n- **Calculus** — derivatives, integrals, limits\n- **Statistics & Probability** — distributions, hypothesis testing\n- **Physics** — mechanics, thermodynamics, electromagnetism\n- **Chemistry** — stoichiometry, balancing equations\n- **Geometry & Trigonometry** — proofs, area, volume, angles\n- **Linear Algebra** — matrices, vectors, eigenvalues\n\nI'll always show **step-by-step solutions** so you understand the *how*, not just the answer 📐\n\nPaste your problem and let's solve it!`,
  },
  {
    regexes: [/\bwhat(?:'s|\s+is)\s+the\s+difference\s+between\s+you\s+and\s+(?:google|search\s+engine|bing)\b/i, /\bhow\s+are\s+you\s+different\s+(?:from|than)\s+(?:google|search\s+engine)\b/i, /\bwhy\s+(?:use|should\s+i\s+use)\s+(?:you|ai)\s+(?:instead\s+of|over|vs\.?)\s+google\b/i],
    answer: `Great question — there's a real difference 🔍 vs 🤖\n\n| | **Search Engine (Google)** | **Me (AI Chat)** |\n|---|---|---|\n| **How it works** | Finds existing web pages | Generates original responses |\n| **Output** | Links to sources | Synthesized answers |\n| **Best for** | Finding specific pages, news, products | Explaining, creating, conversing |\n| **Can it reason?** | No | Yes |\n| **Real-time info** | Yes | Only with web search enabled |\n\n**Use Google when** you need current news, specific websites, product comparisons, or verifiable facts.\n\n**Use me when** you want something explained, created, analyzed, coded, translated, or brainstormed.\n\nThey're complementary, not competing — the smartest move is knowing when to use each 😏`,
  },
];

function findFaqAnswer(text: string): string | null {
  if (!text) return null;
  for (const pair of FAQ_PAIRS) {
    if (pair.regexes.some((rx) => rx.test(text))) return pair.answer;
  }
  return null;
}

function streamCannedAnswer(res: Response, model: string, content: string) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }
  const id = `chatcmpl-lvx-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const baseChunk = (delta: Record<string, unknown>, finishReason: string | null = null) => ({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });
  res.write(`data: ${JSON.stringify(baseChunk({ role: "assistant", content: "" }))}\n\n`);
  res.write(`data: ${JSON.stringify(baseChunk({ content }))}\n\n`);
  res.write(`data: ${JSON.stringify(baseChunk({}, "stop"))}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

function jsonCannedAnswer(res: Response, model: string, content: string) {
  res.json({
    id: `chatcmpl-lvx-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  });
}

interface ChatBody {
  model?: string;
  messages?: Array<{ role: string; content: unknown; tool_call_id?: string; name?: string }>;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  hf_key_index?: number;
  use_web_search?: boolean;
  /** Master switch — turn server-side tool calling on or off. */
  use_tools?: boolean;
  project_context?: string;
  /** Optional chat ID for cross-session memory + summary anchoring. */
  chat_id?: string;
  /** When set, the chat persists no memory side-effects. */
  no_memory?: boolean;
}

function writeSseError(res: Response, message: string, status = 500) {
  if (!res.headersSent) {
    res.status(status);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
  }
  res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

// ─── Tool-call loop helpers ───────────────────────────────────────────
//
// When the user enables tools, we run a small agent loop server-side
// against the upstream chat completions endpoint:
//
//   1. Send the conversation + tool schemas to the model.
//   2. If it returns assistant.tool_calls, run each tool and append
//      role:"tool" messages with the JSON results.
//   3. Re-send. Stop when the model returns a normal assistant message
//      OR after MAX_TOOL_LOOPS iterations (safety bound).
//   4. Stream the final assistant message back to the client as if it
//      were a normal completion.
//
// The loop uses NON-streaming upstream calls so we can inspect tool_calls
// reliably; the final answer is then re-emitted as an SSE stream so the
// frontend behaves identically.

const MAX_TOOL_LOOPS = 4;

interface UpstreamMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

async function callUpstreamOnce(opts: {
  model: string;
  token: string;
  messages: UpstreamMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  withTools: boolean;
  signal: AbortSignal;
}): Promise<
  | { ok: true; message: UpstreamMessage; finishReason: string }
  | { ok: false; status: number | "network"; message: string }
> {
  const upstreamBody: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: false,
  };
  if (typeof opts.temperature === "number") upstreamBody["temperature"] = opts.temperature;
  if (typeof opts.top_p === "number") upstreamBody["top_p"] = opts.top_p;
  if (typeof opts.max_tokens === "number") upstreamBody["max_tokens"] = opts.max_tokens;
  if (opts.withTools) {
    upstreamBody["tools"] = TOOL_SCHEMAS;
    upstreamBody["tool_choice"] = "auto";
  }
  let r: Response;
  try {
    r = (await fetch(`${HF_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${opts.token}`,
      },
      body: JSON.stringify(upstreamBody),
      signal: opts.signal,
    })) as unknown as Response;
  } catch (err) {
    return {
      ok: false,
      status: "network",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false, status: r.status, message: text.slice(0, 200) };
  }
  const data = (await r.json().catch(() => null)) as any;
  const choice = data?.choices?.[0];
  const message = choice?.message as UpstreamMessage | undefined;
  if (!message) {
    return { ok: false, status: 502, message: "upstream returned no message" };
  }
  return { ok: true, message, finishReason: String(choice?.finish_reason ?? "stop") };
}

function streamFinalText(res: Response, model: string, content: string) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }
  const id = `chatcmpl-lvx-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const baseChunk = (delta: Record<string, unknown>, finishReason: string | null = null) => ({
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });
  res.write(`data: ${JSON.stringify(baseChunk({ role: "assistant", content: "" }))}\n\n`);
  // Chunk the content into ~200-char pieces so the frontend animates.
  const CHUNK = 200;
  for (let i = 0; i < content.length; i += CHUNK) {
    res.write(
      `data: ${JSON.stringify(baseChunk({ content: content.slice(i, i + CHUNK) }))}\n\n`,
    );
  }
  res.write(`data: ${JSON.stringify(baseChunk({}, "stop"))}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}

function emitToolEvent(res: Response, payload: Record<string, unknown>) {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify({ tool_event: true, ...payload })}\n\n`);
  }
}

router.post("/completions", async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as ChatBody;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const stream = body.stream !== false;
  const requestedModel = (body.model ?? DEFAULT_MODEL).trim();
  const chatId = typeof body.chat_id === "string" ? body.chat_id.trim() : "";
  const useTools = body.use_tools === true || body.use_web_search === true;

  if (messages.length === 0) {
    if (stream) writeSseError(res, "messages array is required", 400);
    else res.status(400).json({ error: "messages array is required" });
    return;
  }

  // Pull the last user-authored message as the basis for task analysis,
  // memory-intent extraction, and RAG retrieval.
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const taskPrompt =
    typeof lastUser?.content === "string"
      ? lastUser.content
      : JSON.stringify(lastUser?.content ?? "");
  const analysis = analyzeTask(taskPrompt);

  // ── Creator/origin question intercept ──────────────────────────────────────
  if (isCreatorQuestion(taskPrompt)) {
    if (stream) {
      streamCannedAnswer(res, requestedModel, CREATOR_ANSWER);
    } else {
      jsonCannedAnswer(res, requestedModel, CREATOR_ANSWER);
    }
    return;
  }

  // ── Model-identity question intercept ──────────────────────────────────────
  // "What model are you?" / "Which AI is this?" / "Are you GPT?" — return a
  // canonical, hard-coded identity for the user's currently selected model
  // so the answer is consistent across providers and never drifts.
  if (isIdentityQuestion(taskPrompt)) {
    const identityAnswer = buildIdentityAnswer(requestedModel);
    if (stream) {
      streamCannedAnswer(res, requestedModel, identityAnswer);
    } else {
      jsonCannedAnswer(res, requestedModel, identityAnswer);
    }
    return;
  }

  // ── Sleep-help question intercept ─────────────────────────────────────────
  // "I can't sleep" / "help me sleep" / "insomnia" etc. — return a canonical,
  // hard-coded sleep-help response across all models, co-work, and agent modes.
  if (isSleepQuestion(taskPrompt)) {
    if (stream) {
      streamCannedAnswer(res, requestedModel, SLEEP_ANSWER);
    } else {
      jsonCannedAnswer(res, requestedModel, SLEEP_ANSWER);
    }
    return;
  }

  // ── Landing page intercept ─────────────────────────────────────────────────
  if (isLandingPageQuestion(taskPrompt)) {
    if (stream) {
      streamCannedAnswer(res, requestedModel, LANDING_PAGE_ANSWER);
    } else {
      jsonCannedAnswer(res, requestedModel, LANDING_PAGE_ANSWER);
    }
    return;
  }

  // ── UI components intercept ────────────────────────────────────────────────
  if (isUIComponentsQuestion(taskPrompt)) {
    if (stream) {
      streamCannedAnswer(res, requestedModel, UI_COMPONENTS_ANSWER);
    } else {
      jsonCannedAnswer(res, requestedModel, UI_COMPONENTS_ANSWER);
    }
    return;
  }

  // ── Modern website intercept ───────────────────────────────────────────────
  if (isWebsiteQuestion(taskPrompt)) {
    if (stream) {
      streamCannedAnswer(res, requestedModel, WEBSITE_ANSWER);
    } else {
      jsonCannedAnswer(res, requestedModel, WEBSITE_ANSWER);
    }
    return;
  }

  // ── Business idea intercept ────────────────────────────────────────────────
  if (isBusinessIdeaQuestion(taskPrompt)) {
    if (stream) {
      streamCannedAnswer(res, requestedModel, BUSINESS_IDEA_ANSWER);
    } else {
      jsonCannedAnswer(res, requestedModel, BUSINESS_IDEA_ANSWER);
    }
    return;
  }

  // ── Generate code intercept ────────────────────────────────────────────────
  if (isGenerateCodeQuestion(taskPrompt)) {
    if (stream) {
      streamCannedAnswer(res, requestedModel, GENERATE_CODE_ANSWER);
    } else {
      jsonCannedAnswer(res, requestedModel, GENERATE_CODE_ANSWER);
    }
    return;
  }

  // ── General FAQ intercept ──────────────────────────────────────────────────
  // Covers 23 common FAQ questions (capabilities, privacy, limitations, etc.)
  // Returns a canonical answer without any API key or AI call.
  const faqAnswer = findFaqAnswer(taskPrompt);
  if (faqAnswer) {
    if (stream) {
      streamCannedAnswer(res, requestedModel, faqAnswer);
    } else {
      jsonCannedAnswer(res, requestedModel, faqAnswer);
    }
    return;
  }

  // ── Memory-intent capture ─────────────────────────────────────────────────
  // If the user wrote "Remember that …" / "Note: …" / "FYI …", lift the
  // captured fact into the long-term profile store BEFORE sending to the
  // model. The model sees the original message unchanged.
  if (!body.no_memory) {
    const intent = extractMemoryIntent(taskPrompt);
    if (intent) addProfileFact(intent);
  }

  // If the user picked a persona — either a LITHOVEX-branded alias
  // (2.5 Core / 2.6 Plus) or a premium persona (Claude Opus 4.7,
  // Gemini 3.1 Pro, GPT-5.4 Pro, Sonnet 4.6, DeepSeek R1, o3,
  // Grok 4.1 Fast, Kimi K2.6, GPT-5.5) — the model picker is a virtual
  // ID. Resolve it to a real HF Router model and pull the persona's
  // system-prompt addon so the chosen voice is enforced server-side.
  const persona = resolvePersona(requestedModel, taskPrompt);
  const effectiveModel = persona ? persona.underlyingModel : requestedModel;

  // Build the prepended system stack.
  //
  // Order is significant — earlier messages bind harder for most chat models:
  //   1. ACTIVE IDENTITY (per-request, locks model name to user's selection)
  //   2. LITHOVEX_CORE_SYSTEM_PROMPT (master directives, identity policy, etc.)
  //   3. Persona addon (voice/tone for the selected persona, if any)
  //   4. Cross-session memory + RAG (added below)
  //
  // The identity message goes first so it overrides any contrary self-identity
  // the underlying model may have learned during pre-training (e.g. Qwen
  // saying "I'm Qwen"). Combined with the regex-based intercept above, this
  // gives two layers of defense for the "what model are you?" question.
  const prepended: Array<{ role: "system"; content: string }> = [
    { role: "system", content: buildIdentitySystemPrompt(requestedModel) },
    { role: "system", content: LITHOVEX_CORE_SYSTEM_PROMPT },
  ];
  if (persona?.systemPrompt) {
    prepended.push({ role: "system", content: persona.systemPrompt });
  }
  // Cross-session memory (long-term facts + per-chat summary).
  const memoryMsg = buildMemorySystemMessage(chatId || null);
  if (memoryMsg) prepended.push(memoryMsg);

  // RAG: retrieve top-k chunks from uploaded documents that match the
  // current question. Cheap to run on every turn at current scale.
  const ragMsg = buildRagSystemMessage(taskPrompt, 4);
  if (ragMsg) prepended.push(ragMsg);

  if (body.project_context) {
    prepended.push({
      role: "system",
      content: `Project context:\n${body.project_context}`,
    });
  }
  const finalMessages = [...prepended, ...messages] as UpstreamMessage[];

  // NOTE: We deliberately do NOT short-circuit when no HuggingFace tokens are
  // configured. Blackbox is the first-priority provider and can satisfy
  // every request on its own — HF is only needed as the deepest fallback.
  // The HF-token guard is enforced just-in-time before the HF code path
  // actually runs (after preflight), so a Blackbox-only deployment works.
  const keys = getAllKeys();

  const preferredIdx =
    typeof body.hf_key_index === "number" && Number.isFinite(body.hf_key_index)
      ? Math.max(1, Math.min(11, Math.floor(body.hf_key_index)))
      : (getKeyByIndex(1)?.index ?? 1);

  if (stream) {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof (res as any).flushHeaders === "function") {
      (res as any).flushHeaders();
    }
  }

  const clientAbort = new AbortController();
  const onClose = () => clientAbort.abort();
  res.on("close", onClose);

  // ─── Provider pre-flight: Gemini → (big tasks only) OpenRouter ────────
  // Per user preference (2026-04): Gemini handles every request first,
  // rotating through all keys. Only when every Gemini key is exhausted AND
  // the task is "big" (HIGH/EXTREME complexity) do we escalate to OpenRouter,
  // cycling through multiple premium models. Anything else falls through to
  // the HuggingFace code path below. Tool-using requests skip pre-flight
  // entirely — HF owns the tool-loop.
  const preflight = await runProviderPreflight({
    effectiveModel,
    requestedModel,
    finalMessages,
    stream,
    useTools,
    complexity: analysis.complexity,
    temperature: body.temperature,
    top_p: body.top_p,
    max_tokens: body.max_tokens,
    res,
    signal: clientAbort.signal,
    onProviderSwitch: (info) => {
      if (stream && !res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            provider_switch: true,
            from: info.from,
            to: info.to,
            reason: info.reason,
          })}\n\n`,
        );
      }
    },
    onKeyRotate: (info) => {
      if (stream && !res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            key_switch: true,
            provider: info.provider,
            from: info.fromKey,
            to: info.toKey,
            reason: info.reason,
          })}\n\n`,
        );
      }
    },
    onModelSwitch: (info) => {
      if (stream && !res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            model_switch: true,
            provider: info.provider,
            from: info.fromModel,
            to: info.toModel,
            reason: info.reason,
          })}\n\n`,
        );
      }
    },
  });

  if (preflight.handled) {
    res.removeListener("close", onClose);
    // Best-effort summary maintenance using the text we captured (if any).
    if (preflight.text != null) {
      maybeSummarize({
        chatId,
        noMemory: !!body.no_memory,
        messages: [
          ...messages,
          { role: "assistant", content: preflight.text },
        ],
        preferredKeyIndex: preferredIdx,
      }).catch((err) => logger.warn({ err }, "summary refresh failed"));
    }
    return;
  }

  // ─── Path A: tool-using non-streaming agent loop ───────────────────────
  // When tools are enabled we always go through the loop (even if
  // stream=true) so we can intercept tool_calls. The final answer is then
  // re-emitted to the client as either streamed SSE or a regular JSON body.
  if (useTools) {
    let workingMessages = [...finalMessages];
    let lastResult:
      | { ok: true; message: UpstreamMessage; finishReason: string }
      | null = null;
    let lastError = "tool agent never produced an answer";
    let attemptOk = false;

    const router_result = await runWithFailover({
      primaryModel: effectiveModel,
      preferredKeyIndex: preferredIdx,
      onKeyRotate: (info) => {
        if (stream && !res.writableEnded) {
          res.write(
            `data: ${JSON.stringify({
              key_switch: true,
              from: info.fromKey,
              to: info.toKey,
              reason: info.reason,
            })}\n\n`,
          );
        }
      },
      onModelSwitch: (info) => {
        if (stream && !res.writableEnded) {
          res.write(
            `data: ${JSON.stringify({
              model_switch: true,
              from: info.fromModel,
              to: info.toModel,
              reason: info.reason,
            })}\n\n`,
          );
        }
      },
      attempt: async ({ model, key }): Promise<AttemptOutcome> => {
        if (clientAbort.signal.aborted) {
          return { ok: false, status: "network", message: "client disconnected" };
        }
        const startedAt = Date.now();
        // Reset the working transcript on each retry so a previous failed
        // tool turn doesn't poison the next attempt.
        let local = [...finalMessages];
        let modelOut: UpstreamMessage | null = null;
        for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
          const r = await callUpstreamOnce({
            model,
            token: key.token,
            messages: local,
            temperature: body.temperature,
            top_p: body.top_p,
            max_tokens: body.max_tokens,
            withTools: true,
            signal: clientAbort.signal,
          });
          if (!r.ok) {
            return { ok: false, status: r.status, message: r.message };
          }
          modelOut = r.message;
          // If the model returned no tool_calls, we're done.
          const calls = r.message.tool_calls ?? [];
          if (calls.length === 0) {
            break;
          }
          // Append the assistant's tool_calls turn verbatim.
          local.push({
            role: "assistant",
            content: r.message.content ?? null,
            tool_calls: calls,
          });
          // Run each tool in parallel and append role:"tool" results.
          const toolMsgs: UpstreamMessage[] = await Promise.all(
            calls.map(async (call) => {
              const name = call.function?.name ?? "";
              let args: Record<string, unknown> = {};
              try {
                args = call.function?.arguments
                  ? (JSON.parse(call.function.arguments) as Record<string, unknown>)
                  : {};
              } catch {
                args = {};
              }
              if (stream) emitToolEvent(res, { tool: name, status: "running", args });
              const out = await runTool(name, args);
              if (stream) {
                emitToolEvent(res, {
                  tool: name,
                  status: out.ok ? "ok" : "error",
                  ...(out.ok ? {} : { error: out.error }),
                });
              }
              return {
                role: "tool",
                tool_call_id: call.id,
                name,
                content: JSON.stringify(out.ok ? out.result : { error: out.error }),
              };
            }),
          );
          local = local.concat(toolMsgs);
          if (loop === MAX_TOOL_LOOPS - 1) {
            // Force a final answer on the next iteration by stripping tools
            // — handled by exiting the loop with the latest assistant turn.
            const finalTry = await callUpstreamOnce({
              model,
              token: key.token,
              messages: local,
              temperature: body.temperature,
              top_p: body.top_p,
              max_tokens: body.max_tokens,
              withTools: false,
              signal: clientAbort.signal,
            });
            if (finalTry.ok) modelOut = finalTry.message;
          }
        }

        if (!modelOut) {
          return { ok: false, status: 502, message: "no model output" };
        }
        lastResult = { ok: true, message: modelOut, finishReason: "stop" };
        attemptOk = true;
        return {
          ok: true,
          data: modelOut,
          model,
          keyIndex: key.index,
          latencyMs: Date.now() - startedAt,
        };
      },
    });

    res.removeListener("close", onClose);

    if (!attemptOk || !lastResult) {
      lastError = router_result.lastError ?? lastError;
      if (!res.writableEnded) {
        if (stream) writeSseError(res, lastError, 502);
        else res.status(502).json({ error: lastError });
      }
      return;
    }

    const finalText = String(lastResult.message.content ?? "");
    if (stream) {
      streamFinalText(res, effectiveModel, finalText);
    } else {
      res.json({
        id: `chatcmpl-lvx-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: effectiveModel,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: finalText },
            finish_reason: "stop",
          },
        ],
      });
    }

    // Fire-and-forget summarization trigger (see below).
    maybeSummarize({
      chatId,
      noMemory: !!body.no_memory,
      messages: [
        ...messages,
        { role: "assistant", content: finalText },
      ],
      preferredKeyIndex: preferredIdx,
    }).catch((err) => logger.warn({ err }, "summary refresh failed"));

    return;
  }

  // ─── Path B: pass-through streaming/JSON (no tools) ──────────────────
  let pipedSomething = false;

  const result = await runWithFailover({
    primaryModel: effectiveModel,
    preferredKeyIndex: preferredIdx,
    onKeyRotate: (info) => {
      if (stream && !res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            key_switch: true,
            from: info.fromKey,
            to: info.toKey,
            reason: info.reason,
          })}\n\n`,
        );
      }
    },
    onModelSwitch: (info) => {
      if (stream && !res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            model_switch: true,
            from: info.fromModel,
            to: info.toModel,
            reason: info.reason,
          })}\n\n`,
        );
      }
    },
    attempt: async ({ model, key }): Promise<AttemptOutcome> => {
      if (clientAbort.signal.aborted) {
        return { ok: false, status: "network", message: "client disconnected" };
      }
      const upstreamBody: Record<string, unknown> = {
        model,
        messages: finalMessages,
        stream,
      };
      if (typeof body.temperature === "number")
        upstreamBody["temperature"] = body.temperature;
      if (typeof body.top_p === "number") upstreamBody["top_p"] = body.top_p;
      if (typeof body.max_tokens === "number")
        upstreamBody["max_tokens"] = body.max_tokens;

      const startedAt = Date.now();
      let upstream: Response;
      try {
        upstream = (await fetch(`${HF_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: stream ? "text/event-stream" : "application/json",
            Authorization: `Bearer ${key.token}`,
          },
          body: JSON.stringify(upstreamBody),
          signal: clientAbort.signal,
        })) as unknown as Response;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, status: "network", message };
      }

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => "");
        return {
          ok: false,
          status: upstream.status,
          message: text.slice(0, 200),
        };
      }

      if (stream) {
        if (!upstream.body) {
          return { ok: false, status: 502, message: "upstream returned no body" };
        }
        const reader = (upstream.body as any).getReader();
        const decoder = new TextDecoder();
        let collected = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (res.writableEnded) {
              try {
                clientAbort.abort();
              } catch {
                /* noop */
              }
              break;
            }
            const chunk = decoder.decode(value, { stream: true });
            collected += chunk;
            res.write(chunk);
            pipedSomething = true;
          }
          if (!res.writableEnded) {
            res.write("data: [DONE]\n\n");
            res.end();
          }
        } finally {
          try {
            reader.releaseLock();
          } catch {
            /* noop */
          }
        }
        // Try to extract the final assistant text from the SSE stream so
        // we can append it for summarization. Best-effort only.
        const assistantText = extractStreamedText(collected);
        maybeSummarize({
          chatId,
          noMemory: !!body.no_memory,
          messages: [
            ...messages,
            { role: "assistant", content: assistantText },
          ],
          preferredKeyIndex: preferredIdx,
        }).catch((err) => logger.warn({ err }, "summary refresh failed"));
        return {
          ok: true,
          data: null,
          model,
          keyIndex: key.index,
          latencyMs: Date.now() - startedAt,
        };
      }

      const data = await (upstream as unknown as Response).json().catch(() => null);
      res.json(data);
      const assistantText = String(
        (data as any)?.choices?.[0]?.message?.content ?? "",
      );
      maybeSummarize({
        chatId,
        noMemory: !!body.no_memory,
        messages: [
          ...messages,
          { role: "assistant", content: assistantText },
        ],
        preferredKeyIndex: preferredIdx,
      }).catch((err) => logger.warn({ err }, "summary refresh failed"));
      return {
        ok: true,
        data,
        model,
        keyIndex: key.index,
        latencyMs: Date.now() - startedAt,
      };
    },
  });

  res.removeListener("close", onClose);

  if (!result.ok && !res.writableEnded && !pipedSomething) {
    const finalMsg =
      result.lastError ?? "All Hugging Face API keys failed for this request.";
    logger.error({ attempts: result.attempts }, finalMsg);
    if (stream) writeSseError(res, finalMsg, 502);
    else res.status(502).json({ error: finalMsg });
  }
});

// ─── SSE → assistant-text reconstruction ─────────────────────────────
// Walk an SSE buffer, parse each `data: {…}` line, and concatenate the
// `choices[0].delta.content` deltas. Used only for summary feeding.
function extractStreamedText(sse: string): string {
  let out = "";
  for (const line of sse.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const obj = JSON.parse(payload);
      const delta = obj?.choices?.[0]?.delta?.content;
      if (typeof delta === "string") out += delta;
    } catch {
      /* skip */
    }
  }
  return out;
}

// ─── Background summary refresh ────────────────────────────────────
// When a chat passes the summary threshold we ask the cheapest available
// model (Tier 3 FAST) to compress everything older than the last few turns
// into a tight summary. Stored via setChatSummary() so subsequent requests
// inject it as memory context.
async function maybeSummarize(opts: {
  chatId: string;
  noMemory: boolean;
  messages: Array<{ role: string; content: unknown }>;
  preferredKeyIndex: number;
}): Promise<void> {
  if (!opts.chatId || opts.noMemory) return;
  if (!shouldSummarize(opts.chatId, opts.messages.length)) return;

  // Keep the last 6 messages outside the summary so they stay verbatim
  // in the chat window; summarize everything before that.
  const KEEP_TAIL = 6;
  const cutoff = Math.max(0, opts.messages.length - KEEP_TAIL);
  if (cutoff < 4) return;

  const transcript = opts.messages
    .slice(0, cutoff)
    .map((m) => {
      const c =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return `${m.role.toUpperCase()}: ${c}`;
    })
    .join("\n\n");

  const sys = [
    "You compress chat transcripts into terse, factual summaries that an AI assistant can use to maintain continuity across sessions.",
    "Capture: user goals, decisions made, open questions, files/code discussed, and any preferences expressed.",
    "Skip: greetings, small talk, repeated content.",
    "Output 5-12 bullet points. No preamble.",
  ].join("\n");
  const user = `Summarize this conversation so far:\n\n${transcript.slice(0, 12000)}`;

  const key = getKeyByIndex(opts.preferredKeyIndex) ?? getAllKeys()[0];
  if (!key) return;

  try {
    const r = await fetch(`${HF_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key.token}`,
      },
      body: JSON.stringify({
        model: "meta-llama/Llama-3.2-3B-Instruct",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        stream: false,
        temperature: 0.2,
        max_tokens: 600,
      }),
    });
    if (!r.ok) return;
    const data = (await r.json().catch(() => null)) as any;
    const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (text) setChatSummary(opts.chatId, text, cutoff);
  } catch {
    /* best-effort */
  }
}

router.post("/auto-evolve", async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const previousTasks: Array<{ task: string }> = Array.isArray(
    body.previous_tasks,
  )
    ? body.previous_tasks
    : [];
  const cycleNumber = Number(body.cycle_number ?? previousTasks.length + 1) || 1;

  const keys = getAllKeys();
  if (keys.length === 0) {
    res.status(500).json({
      error: "No HUGGINGFACE_API_KEY_* tokens are configured on the server.",
    });
    return;
  }
  const requestedIdx = Math.max(1, Math.min(9, body.hf_key_index ?? 1));
  const key = getKeyByIndex(requestedIdx)!;
  const model = (body.model as string | undefined) ?? DEFAULT_MODEL;

  const sysPrompt = `You are an autonomous engineering planner. Given the project context and a list of previously completed tasks, propose the SINGLE next most-valuable task to do, with concise reasoning. Respond ONLY in compact JSON of the shape:
{"nextTask":"...","reasoning":"...","searchQueries":["...","..."],"status":"continue"|"complete"}.
Use status "complete" only when the project is genuinely production-ready.`;

  const userPrompt = `Cycle: ${cycleNumber}
Project context:
${(body.project_context as string) || "(none)"}

Previously completed tasks:
${previousTasks.map((t, i) => `${i + 1}. ${t.task}`).join("\n") || "(none)"}`;

  try {
    const upstream = await fetch(`${HF_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key.token}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        temperature: 0.4,
        max_tokens: 1024,
      }),
    });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      res
        .status(502)
        .json({ error: `Upstream HTTP ${upstream.status}: ${text.slice(0, 200)}` });
      return;
    }
    const data = await upstream.json().catch(() => null);
    const raw =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.delta?.content ??
      "";
    const jsonMatch = String(raw).match(/\{[\s\S]*\}/);
    let parsed: any = {};
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = {};
      }
    }
    res.json({
      nextTask:
        parsed.nextTask ?? parsed.next_task ?? "Continue improving the project.",
      reasoning: parsed.reasoning ?? "",
      searchQueries: Array.isArray(parsed.searchQueries)
        ? parsed.searchQueries
        : Array.isArray(parsed.search_queries)
          ? parsed.search_queries
          : [],
      status: parsed.status === "complete" ? "complete" : "continue",
      cycleNumber,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "auto-evolve failed",
    });
  }
});

// Quietly use analyzeTask in this file so TS doesn't error if unused.
void analyzeTask;

export default router;
