// scripts/research-agent.js
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric"
});
const todaySlug = new Date().toISOString().split("T")[0];

function safeParseJSON(text) {
  // Try direct parse first
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) return JSON.parse(text.slice(start, end + 1));
  } catch(e) {}

  // If truncated, try to salvage what we have field by field
  const result = {};
  const summaryMatch = text.match(/"summary"\s*:\s*"([^"]+)"/);
  if (summaryMatch) result.summary = summaryMatch[1];

  const painPoints = [];
  const ppRegex = /"finding"\s*:\s*"([^"]+)"[^}]*?"source"\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = ppRegex.exec(text)) !== null && painPoints.length < 3) {
    painPoints.push({ finding: m[1], source: m[2] });
  }
  if (painPoints.length) result.pain_points = painPoints;

  const competitors = [];
  const compRegex = /"name"\s*:\s*"([^"]+)"[^}]*?"update"\s*:\s*"([^"]+)"/g;
  while ((m = compRegex.exec(text)) !== null && competitors.length < 3) {
    competitors.push({ name: m[1], update: m[2] });
  }
  if (competitors.length) result.competitor_updates = competitors;

  const implications = [];
  const impRegex = /"action"\s*:\s*"([^"]+)"/g;
  while ((m = impRegex.exec(text)) !== null && implications.length < 3) {
    implications.push({ action: m[1] });
  }
  if (implications.length) result.implications = implications;

  if (!result.summary && !painPoints.length) throw new Error("Could not parse any data from response");
  return result;
}

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
      max_tokens: 800,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `${today}. Research 55+ frontline worker job market (grocery/warehouse/retail). Search Reddit and news.

JSON only, no other text:
{"summary":"one sentence","pain_points":[{"finding":"one sentence","source":"one word source"}],"competitor_updates":[{"name":"one word","update":"one sentence","gap":"one sentence"}],"implications":[{"action":"one sentence"}]}

Rules: max 2 items per array, under 15 words per value, raw JSON only.`
      }],
    }),
  });

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
  console.log("Raw response length:", text.length);
  return safeParseJSON(text);
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
    h2{font-size:14px;font-weight:700;color:#111827;margin:0 0 10px}
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
    <div class="summary">${data.summary || "Research complete."}</div>
  </div>

  ${(data.pain_points||[]).length ? `<div class="section"><h2>⚡ Pain Points</h2>${(data.pain_points||[]).map(p=>card(`<div class="finding">${p.finding}</div><div class="meta">${p.source||""}</div>`)).join("")}</div>` : ""}

  ${(data.competitor_updates||[]).length ? `<div class="section"><h2>🔍 Competitor Updates</h2>${(data.competitor_updates||[]).map(c=>card(`<div class="finding">${c.name}</div><div class="meta">${c.update||""}</div>${c.gap?`<div class="gap">Gap: ${c.gap}</div>`:""}`)).join("")}</div>` : ""}

  ${(data.implications||[]).length ? `<div class="section"><h2>🚀 Implications for Pivoters</h2>${(data.implications||[]).map((imp,i)=>card(`<div class="action">${i+1}. ${imp.action}</div>`)).join("")}</div>` : ""}

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
