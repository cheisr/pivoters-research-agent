// scripts/research-agent.js
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric"
});
const todaySlug = new Date().toISOString().split("T")[0];

async function research() {
  console.log("🔍 Researching…");

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `Today is ${today}. You are a researcher for Pivoters.com — a job platform for workers aged 55+ in frontline roles (grocery, warehouse, retail, delivery). Many have no resume or LinkedIn.

Search Reddit, X/Twitter, and news for what is happening TODAY. Also check for any new competitors or updates from AARP Job Board, RetirementJobs, Workforce50, Seniors4Hire.

Return ONLY this raw JSON, no markdown, no extra text:
{
  "summary": "2 sentences max",
  "pain_points": [
    {"finding": "1 sentence", "source": "where"}
  ],
  "competitor_updates": [
    {"name": "...", "update": "1 sentence", "gap": "1 sentence"}
  ],
  "implications": [
    {"action": "1 sentence what Pivoters should do or watch"}
  ]
}

Strict limits: max 3 items per array, 1 sentence per field. Raw JSON only.`
      }],
    }),
  });

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found: " + text.slice(0, 300));
  return JSON.parse(text.slice(start, end + 1));
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
  <title>Pivoters Brief — ${today}</title>
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
    h2{font-size:14px;font-weight:700;color:#111827;margin:0 0 10px;display:flex;align-items:center;gap:6px}
    .section{margin-bottom:28px}
    .finding{font-weight:500;color:#111827;margin-bottom:3px}
    .meta{font-size:12px;color:#6B7280}
    .action{font-size:13px;padding:8px 12px;background:#F0FDF4;border-left:3px solid #16A34A;border-radius:4px}
    .gap{font-size:12px;color:#6B7280;margin-top:4px;font-style:italic}
    .footer{text-align:center;font-size:12px;color:#9CA3AF;margin-top:36px}
  </style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="label">Pivoters.com · Daily Intelligence</div>
    <div class="title">Research Brief</div>
    <div class="date">${today}</div>
    <div class="summary">${data.summary || ""}</div>
  </div>

  <div class="section">
    <h2>⚡ Pain Points</h2>
    ${(data.pain_points || []).map(p => card(`
      <div class="finding">${p.finding}</div>
      <div class="meta">${p.source || ""}</div>
    `)).join("")}
  </div>

  <div class="section">
    <h2>🔍 Competitor Updates</h2>
    ${(data.competitor_updates || []).map(c => card(`
      <div class="finding">${c.name}</div>
      <div class="meta">${c.update || ""}</div>
      ${c.gap ? `<div class="gap">Gap: ${c.gap}</div>` : ""}
    `)).join("")}
  </div>

  <div class="section">
    <h2>🚀 Implications for Pivoters</h2>
    ${(data.implications || []).map((imp, i) => card(`
      <div class="action">${i + 1}. ${imp.action}</div>
    `)).join("")}
  </div>

  <div class="footer">Pivoters Research Agent · ${today}</div>
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
