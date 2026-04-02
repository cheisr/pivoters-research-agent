// scripts/research-agent.js
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric"
});
const todaySlug = new Date().toISOString().split("T")[0];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function callClaude(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (res.status === 429) {
      console.log(`Rate limited, waiting 60s… (attempt ${i + 1}/${retries})`);
      await sleep(60000);
      continue;
    }

    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const text = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON in response: " + text.slice(0, 300));
    return JSON.parse(text.slice(start, end + 1));
  }
  throw new Error("Max retries hit");
}

async function research() {
  console.log("🔍 Researching pain points…");

  const part1 = await callClaude(`Today is ${today}.

Search Reddit RIGHT NOW for posts from the last 7 days in r/ageover50, r/jobs, r/Unemployment, r/povertyfinance about people aged 55+ struggling to find work in grocery stores, warehouses, retail, delivery, or cleaning. Find REAL complaints and frustrations people are actually posting about.

Also search X/Twitter for recent posts about "55+ job search", "older worker hiring", "age discrimination retail", "senior worker warehouse".

Return ONLY this JSON, no other text:
{
  "summary": "One sentence describing the single most relevant thing happening right now for 55+ frontline job seekers",
  "pain_points": [
    {"finding": "Specific real complaint or trend from a real source", "source": "Reddit r/ageover50 or X/Twitter etc"}
  ]
}

Max 3 pain_points. Each finding must be a SPECIFIC real signal, not a generic stat. Raw JSON only.`);

  await sleep(5000);

  console.log("🔍 Researching competitors…");

  const part2 = await callClaude(`Today is ${today}.

Search the web for any job platforms, apps, or websites that help workers aged 55+ or seniors find frontline jobs (grocery, retail, warehouse, delivery) WITHOUT needing a resume or LinkedIn. 

Specifically check for recent news, product launches, or updates from: AARP Job Board, RetirementJobs.com, Workforce50.com, Seniors4Hire.org, MyPivot, Hire55, and any NEW platforms launched in 2025-2026.

Also search "job app for seniors no resume", "55+ hiring platform 2026", "older worker job board new".

Return ONLY this JSON, no other text:
{
  "competitor_updates": [
    {"name": "Platform name", "update": "What is actually new or notable about them right now", "gap": "Specific weakness or complaint users have about them"}
  ],
  "implications": [
    {"action": "Specific thing Pivoters should build, fix, or prioritize based on what you found"}
  ]
}

Max 3 competitor_updates, max 2 implications. Must be based on real findings. Raw JSON only.`);

  return {
    date: today,
    summary: part1.summary || "",
    pain_points: part1.pain_points || [],
    competitor_updates: part2.competitor_updates || [],
    implications: part2.implications || [],
  };
}

function card(content) {
  return `<div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:18px 22px;margin-bottom:10px">${content}</div>`;
}

function generateHTML(data) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Pivoters Brief — ${data.date}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',sans-serif;background:#F9FAFB;color:#374151;font-size:14px;line-height:1.6}
    .wrap{max-width:680px;margin:0 auto;padding:32px 20px 60px}
    .header{background:linear-gradient(135deg,#1E3A5F,#2D6A4F);border-radius:16px;padding:28px;margin-bottom:24px;color:#fff}
    .label{font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.6;margin-bottom:6px}
    .title{font-size:22px;font-weight:700;margin-bottom:4px}
    .date{font-size:12px;opacity:0.65;margin-bottom:14px}
    .summary{background:rgba(255,255,255,0.13);border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.7}
    h2{font-size:14px;font-weight:700;color:#111827;margin:0 0 10px}
    .section{margin-bottom:28px}
    .finding{font-weight:500;color:#111827;margin-bottom:3px}
    .meta{font-size:12px;color:#6B7280;margin-top:3px}
    .action{font-size:13px;padding:10px 14px;background:#F0FDF4;border-left:3px solid #16A34A;border-radius:4px}
    .gap{font-size:12px;color:#9061F9;margin-top:6px;font-style:italic}
    .footer{text-align:center;font-size:12px;color:#9CA3AF;margin-top:36px}
  </style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="label">Pivoters.com · Daily Intelligence</div>
    <div class="title">Research Brief</div>
    <div class="date">${data.date}</div>
    <div class="summary">${data.summary}</div>
  </div>

  ${data.pain_points.length ? `
  <div class="section">
    <h2>⚡ Pain Points — What 55+ workers are saying right now</h2>
    ${data.pain_points.map(p => card(`
      <div class="finding">${p.finding}</div>
      <div class="meta">📍 ${p.source}</div>
    `)).join("")}
  </div>` : ""}

  ${data.competitor_updates.length ? `
  <div class="section">
    <h2>🔍 Competitor Landscape</h2>
    ${data.competitor_updates.map(c => card(`
      <div class="finding">${c.name}</div>
      <div class="meta">${c.update}</div>
      ${c.gap ? `<div class="gap">⚠️ Gap: ${c.gap}</div>` : ""}
    `)).join("")}
  </div>` : ""}

  ${data.implications.length ? `
  <div class="section">
    <h2>🚀 What Pivoters should do</h2>
    ${data.implications.map((imp, i) => card(`
      <div class="action">${i + 1}. ${imp.action}</div>
    `)).join("")}
  </div>` : ""}

  <div class="footer">Pivoters Research Agent · ${data.date}</div>
</div>
</body>
</html>`;
}

function commitAndPush(html) {
  const dir = path.join(process.cwd(), "docs", "reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${todaySlug}.html`), html, "utf8");
  fs.writeFileSync(
    path.join(process.cwd(), "docs", "index.html"),
    `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=reports/${todaySlug}.html"></head><body>Redirecting...</body></html>`
  );
  execSync('git config user.email "research-agent@pivoters.com"');
  execSync('git config user.name "Pivoters Research Agent"');
  execSync("git add docs/");
  execSync(`git commit -m "Daily brief: ${todaySlug}"`);
  execSync("git push");
  console.log("✅ Committed");
}

async function sendToGoogleChat(url) {
  const webhook = process.env.GOOGLE_CHAT_WEBHOOK;
  if (!webhook) { console.log("⚠️ No webhook"); return; }
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `*📋 Pivoters Daily Brief — ${today}*\n👉 ${url}` }),
  });
  if (!res.ok) throw new Error(`Chat error: ${res.status}`);
  console.log("✅ Posted to Google Chat");
}

async function main() {
  try {
    const data = await research();
    const html = generateHTML(data);
    commitAndPush(html);
    const [owner, repo] = (process.env.GITHUB_REPOSITORY || "cheisr/pivoters-research-agent").split("/");
    const url = `https://${owner}.github.io/${repo}/reports/${todaySlug}.html`;
    await sendToGoogleChat(url);
    console.log("🎉 Done:", url);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
