// scripts/research-agent.js
// Runs daily: researches 55+ frontline worker job market, generates HTML report,
// commits to GitHub Pages, posts link to Google Chat

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TOPIC = `
Research the job market for workers aged 55+ who are frontline, blue-collar, and lower-income.
Focus on people looking for work in grocery stores, warehouses, retail, hospitality, cleaning,
security, delivery, and manufacturing. Many have no resume, no LinkedIn, no college degree.

Search across: Reddit (r/jobs, r/Unemployment, r/povertyfinance, r/ageover50, r/WorkReform,
r/Layoffs, r/retirement), X/Twitter (age discrimination, 55+ job search, senior workers hiring,
warehouse hiring older workers), blogs and news (AARP, Next Avenue, Senior Planet), and major
retailer hiring news (Walmart, Target, Home Depot, Amazon, Kroger).

Also find NEW or emerging competitors to Pivoters.com — a job matching platform for 55+
frontline workers. Look for new job boards or apps targeting seniors or blue-collar workers,
updates from AARP Job Board, RetirementJobs, Workforce50, Seniors4Hire, and any VC funding
or product launches in this space.

Focus on what is trending TODAY. Be concise.
`;

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric"
});
const todaySlug = new Date().toISOString().split("T")[0];

async function callClaude(messages, tools) {
  const body = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages,
  };
  if (tools) body.tools = tools;

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  return res.json();
}

async function research() {
  console.log("🔍 Researching…");

  const prompt = `${TOPIC}

Today is ${today}.

Return ONLY a raw JSON object, no markdown, no backticks, no explanation. Use this structure:

{
  "date": "${today}",
  "executive_summary": "3 sentence summary of most important insight today",
  "trending_topics": ["topic 1", "topic 2", "topic 3"],
  "pain_points": [
    { "finding": "...", "source": "e.g. Reddit r/ageover50", "severity": "high" }
  ],
  "employer_signals": [
    { "finding": "...", "source": "...", "company": "e.g. Walmart" }
  ],
  "unmet_needs": [
    { "need": "...", "evidence": "..." }
  ],
  "competitor_updates": [
    { "name": "...", "update": "...", "threat_level": "medium", "gap": "..." }
  ],
  "positive_signals": [
    { "signal": "...", "source": "..." }
  ],
  "implications_for_pivoters": [
    { "insight": "...", "action": "..." }
  ]
}

Keep each field to 1-2 sentences max. Return 3-5 items per array. Raw JSON only.`;

  const data = await callClaude(
    [{ role: "user", content: prompt }],
    [{ type: "web_search_20250305", name: "web_search" }]
  );

  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
  const clean = text.replace(/```json|```/g, "").trim();

  // Find the JSON object in the response
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");

  return JSON.parse(clean.slice(start, end + 1));
}

function severityColor(s) {
  return s === "high" ? "#DC2626" : s === "medium" ? "#D97706" : "#16A34A";
}
function threatColor(t) {
  return t === "high" ? "#DC2626" : t === "medium" ? "#D97706" : "#2563EB";
}

function generateHTML(data) {
  const pill = (text, color) =>
    `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;background:${color}22;color:${color};border:1px solid ${color}44">${text.toUpperCase()}</span>`;

  const card = (content) =>
    `<div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:18px 22px;margin-bottom:12px">${content}</div>`;

  const section = (title, icon, content) => `
    <div style="margin-bottom:32px">
      <h2 style="font-size:15px;font-weight:700;color:#111827;margin:0 0 12px;display:flex;align-items:center;gap:8px">
        <span>${icon}</span> ${title}
      </h2>
      ${content}
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Pivoters Daily Brief — ${data.date}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Inter',sans-serif; background:#F9FAFB; color:#374151; font-size:14px; line-height:1.6; }
    .container { max-width:760px; margin:0 auto; padding:32px 20px 60px; }
    .header { background:linear-gradient(135deg,#1E3A5F,#2D6A4F); border-radius:16px; padding:28px; margin-bottom:28px; color:#fff; }
    .header-label { font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:0.65; margin-bottom:6px; }
    .header-title { font-size:24px; font-weight:700; margin-bottom:4px; }
    .header-date { font-size:12px; opacity:0.7; margin-bottom:16px; }
    .summary { background:rgba(255,255,255,0.12); border-radius:10px; padding:14px 18px; font-size:14px; line-height:1.7; }
    .trending { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
    .trend-tag { background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25); border-radius:999px; padding:3px 12px; font-size:12px; }
    .finding { font-size:14px; color:#111827; font-weight:500; margin-bottom:4px; }
    .meta { font-size:12px; color:#6B7280; margin-top:4px; }
    .action { font-size:13px; color:#4B5563; padding:8px 12px; background:#F0FDF4; border-left:3px solid #16A34A; border-radius:4px; margin-top:6px; }
    .footer { text-align:center; font-size:12px; color:#9CA3AF; margin-top:40px; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="header-label">Pivoters.com · Daily Intelligence</div>
    <div class="header-title">Research Brief</div>
    <div class="header-date">${data.date}</div>
    <div class="summary">${data.executive_summary}</div>
    ${(data.trending_topics || []).length ? `<div class="trending">${data.trending_topics.map(t => `<span class="trend-tag">🔥 ${t}</span>`).join("")}</div>` : ""}
  </div>

  ${section("Top Pain Points", "⚡", (data.pain_points || []).map(p => card(`
    <div class="finding">${p.finding}</div>
    <div class="meta">${pill(p.severity || "medium", severityColor(p.severity))} &nbsp; ${p.source || ""}</div>
  `)).join(""))}

  ${section("Employer Signals", "🏢", (data.employer_signals || []).map(e => card(`
    <div class="finding">${e.finding}</div>
    <div class="meta">${e.company ? `<strong>${e.company}</strong> · ` : ""}${e.source || ""}</div>
  `)).join(""))}

  ${section("Unmet Needs", "🎯", (data.unmet_needs || []).map(n => card(`
    <div class="finding">${n.need}</div>
    <div class="meta">${n.evidence || ""}</div>
  `)).join(""))}

  ${section("Competitor Updates", "🔍", (data.competitor_updates || []).map(c => card(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div>
        <div class="finding">${c.name}</div>
        <div style="font-size:13px;color:#374151;margin:4px 0">${c.update}</div>
        ${c.gap ? `<div class="meta">Gap: ${c.gap}</div>` : ""}
      </div>
      <div style="flex-shrink:0">${pill(c.threat_level || "medium", threatColor(c.threat_level))}</div>
    </div>
  `)).join(""))}

  ${section("Positive Signals", "💚", (data.positive_signals || []).map(s => card(`
    <div class="finding">${s.signal}</div>
    <div class="meta">${s.source || ""}</div>
  `)).join(""))}

  ${section("Implications for Pivoters", "🚀", (data.implications_for_pivoters || []).map((imp, i) => card(`
    <div class="finding">${i + 1}. ${imp.insight}</div>
    <div class="action">→ ${imp.action}</div>
  `)).join(""))}

  <div class="footer">Generated by Pivoters Research Agent · ${data.date}</div>
</div>
</body>
</html>`;
}

function commitAndPush(htmlContent) {
  const reportsDir = path.join(process.cwd(), "docs", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  fs.writeFileSync(path.join(reportsDir, `${todaySlug}.html`), htmlContent, "utf8");
  fs.writeFileSync(path.join(process.cwd(), "docs", "index.html"),
    `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=reports/${todaySlug}.html"></head><body>Redirecting...</body></html>`,
    "utf8"
  );

  execSync('git config user.email "research-agent@pivoters.com"');
  execSync('git config user.name "Pivoters Research Agent"');
  execSync("git add docs/");
  execSync(`git commit -m "Daily brief: ${todaySlug}"`);
  execSync("git push");
  console.log(`✅ Report committed: docs/reports/${todaySlug}.html`);
}

async function sendToGoogleChat(reportUrl) {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK;
  if (!webhookUrl) { console.log("⚠️ No GOOGLE_CHAT_WEBHOOK set."); return; }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `*📋 Pivoters Daily Research Brief — ${today}*\n👉 ${reportUrl}` }),
  });
  if (!res.ok) throw new Error(`Google Chat error: ${res.status}`);
  console.log("✅ Posted to Google Chat.");
}

async function main() {
  try {
    const data = await research();
    const html = generateHTML(data);
    commitAndPush(html);

    const [owner, repo] = (process.env.GITHUB_REPOSITORY || "cheisr/pivoters-research-agent").split("/");
    const reportUrl = `https://${owner}.github.io/${repo}/reports/${todaySlug}.html`;
    await sendToGoogleChat(reportUrl);
    console.log("🎉 Done:", reportUrl);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
