// scripts/research-agent.js
// Runs daily: researches 55+ frontline worker job market, generates HTML report,
// commits to GitHub Pages, posts link to Google Chat

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TOPIC = `
You are researching the job market for workers aged 55+ who are frontline, blue-collar, 
and lower-income — people looking for work in grocery stores, warehouses, retail, 
hospitality, cleaning, security, delivery, manufacturing, and similar roles. 
Many do not have a resume, LinkedIn, or college degree. They may be searching on 
their phone. They are often overlooked by mainstream job platforms.

Search broadly across:
- Reddit: r/jobs, r/Unemployment, r/povertyfinance, r/retirement, r/ageover50, 
  r/WorkReform, r/careerguidance, r/Layoffs, r/personalfinance, r/seniorsonly
- X (Twitter): age discrimination, 55+ job search, senior workers hiring, 
  warehouse hiring older workers, retail ageism
- Blogs and news: AARP, Next Avenue, Senior Planet, PBS NewsHour economy section,
  local news about hiring fairs for older workers
- Job platform news: any new apps, tools, or platforms targeting older or 
  blue-collar workers
- Employer news: major retailers (Walmart, Target, Home Depot, Amazon, Kroger) 
  and their hiring practices or policies around older workers

Find what is trending and fresh TODAY. Prioritize recent posts, articles, and discussions.
`;

const COMPETITOR_FOCUS = `
Also specifically research NEW or emerging competitors to Pivoters.com — a job matching 
platform for experienced workers 55+ including frontline and blue-collar workers.

Look for:
- Any new job boards or apps launched in the last 6 months targeting 55+, seniors, 
  or blue-collar workers without requiring a resume or LinkedIn
- Updates or new features from existing players: AARP Job Board, RetirementJobs, 
  Workforce50, Seniors4Hire, MyPivot, WorkForce50, Hire55
- Any VC funding, press coverage, or product launches in this space
- What these platforms do well and where users complain they fall short
`;

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric"
});

const todaySlug = new Date().toISOString().split("T")[0]; // e.g. 2026-04-02

async function callClaude(messages, tools) {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
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

${COMPETITOR_FOCUS}

Today is ${today}. Focus on what is NEW and TRENDING right now.

Return a JSON object with this exact structure — no markdown, no preamble, just raw JSON:

{
  "date": "${today}",
  "executive_summary": "3-4 sentence summary of the most important insight today",
  "trending_topics": ["topic 1", "topic 2", "topic 3"],
  "pain_points": [
    { "finding": "...", "source": "e.g. Reddit r/ageover50", "severity": "high|medium|low" }
  ],
  "employer_signals": [
    { "finding": "...", "source": "...", "company": "e.g. Walmart or General" }
  ],
  "unmet_needs": [
    { "need": "...", "evidence": "..." }
  ],
  "competitor_updates": [
    { "name": "competitor name", "update": "what's new or notable", "threat_level": "high|medium|low", "gap": "where they fall short" }
  ],
  "positive_signals": [
    { "signal": "...", "source": "..." }
  ],
  "implications_for_pivoters": [
    { "insight": "...", "action": "what the product team should do or watch" }
  ]
}`;

  const data = await callClaude(
    [{ role: "user", content: prompt }],
    [{ type: "web_search_20250305", name: "web_search" }]
  );

  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");

  // Strip any accidental markdown fences
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function severityColor(s) {
  return s === "high" ? "#DC2626" : s === "medium" ? "#D97706" : "#16A34A";
}

function threatColor(t) {
  return t === "high" ? "#DC2626" : t === "medium" ? "#D97706" : "#2563EB";
}

function generateHTML(data) {
  const pill = (text, color) =>
    `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;background:${color}22;color:${color};border:1px solid ${color}44">${text}</span>`;

  const card = (content) =>
    `<div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:20px 24px;margin-bottom:14px">${content}</div>`;

  const section = (title, icon, content) => `
    <div style="margin-bottom:36px">
      <h2 style="font-size:16px;font-weight:700;color:#111827;margin:0 0 14px;display:flex;align-items:center;gap:8px">
        <span style="font-size:20px">${icon}</span> ${title}
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
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #F9FAFB; color: #374151; font-size: 14px; line-height: 1.6; }
    a { color: #2563EB; }
    .container { max-width: 780px; margin: 0 auto; padding: 32px 20px 60px; }
    .header { background: linear-gradient(135deg, #1E3A5F, #2D6A4F); border-radius: 16px; padding: 32px; margin-bottom: 32px; color: #fff; }
    .header-label { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.65; margin-bottom: 8px; }
    .header-title { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
    .header-date { font-size: 13px; opacity: 0.7; margin-bottom: 20px; }
    .summary { background: rgba(255,255,255,0.12); border-radius: 10px; padding: 16px 20px; font-size: 14px; line-height: 1.7; }
    .trending { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .trend-tag { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 999px; padding: 4px 12px; font-size: 12px; color: #fff; }
    .finding { font-size: 14px; color: #111827; margin-bottom: 6px; font-weight: 500; }
    .meta { font-size: 12px; color: #6B7280; margin-top: 4px; }
    .divider { border: none; border-top: 1px solid #F3F4F6; margin: 12px 0; }
    .insight { font-weight: 600; color: #111827; margin-bottom: 4px; }
    .action { font-size: 13px; color: #4B5563; padding: 8px 12px; background: #F0FDF4; border-left: 3px solid #16A34A; border-radius: 4px; margin-top: 6px; }
    .footer { text-align: center; font-size: 12px; color: #9CA3AF; margin-top: 48px; }
  </style>
</head>
<body>
<div class="container">

  <div class="header">
    <div class="header-label">Pivoters.com · Daily Intelligence</div>
    <div class="header-title">Research Brief</div>
    <div class="header-date">${data.date}</div>
    <div class="summary">${data.executive_summary}</div>
    ${data.trending_topics?.length ? `
    <div class="trending">
      ${data.trending_topics.map(t => `<span class="trend-tag">🔥 ${t}</span>`).join("")}
    </div>` : ""}
  </div>

  ${section("Top Pain Points", "⚡", (data.pain_points || []).map(p => card(`
    <div class="finding">${p.finding}</div>
    <div class="meta">${pill(p.severity?.toUpperCase() || "—", severityColor(p.severity))} &nbsp; ${p.source || ""}</div>
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
      <div style="flex-shrink:0">${pill(c.threat_level?.toUpperCase() || "—", threatColor(c.threat_level))}</div>
    </div>
  `)).join(""))}

  ${section("Positive Signals", "💚", (data.positive_signals || []).map(s => card(`
    <div class="finding">${s.signal}</div>
    <div class="meta">${s.source || ""}</div>
  `)).join(""))}

  ${section("Implications for Pivoters", "🚀", (data.implications_for_pivoters || []).map((imp, i) => card(`
    <div class="insight">${i + 1}. ${imp.insight}</div>
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

  const filePath = path.join(reportsDir, `${todaySlug}.html`);
  fs.writeFileSync(filePath, htmlContent, "utf8");

  // Also write an index.html that redirects to today's report
  const indexPath = path.join(process.cwd(), "docs", "index.html");
  fs.writeFileSync(indexPath, `<!DOCTYPE html>
<html><head><meta http-equiv="refresh" content="0;url=reports/${todaySlug}.html"></head>
<body>Redirecting to today's brief...</body></html>`, "utf8");

  execSync('git config user.email "research-agent@pivoters.com"');
  execSync('git config user.name "Pivoters Research Agent"');
  execSync("git add docs/");
  execSync(`git commit -m "Daily brief: ${todaySlug}"`);
  execSync("git push");

  console.log(`✅ Report committed: docs/reports/${todaySlug}.html`);
}

async function sendToGoogleChat(reportUrl) {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK;
  if (!webhookUrl) {
    console.log("⚠️  No GOOGLE_CHAT_WEBHOOK set — skipping.");
    return;
  }

  const message = `*📋 Pivoters Daily Research Brief — ${today}*\n👉 ${reportUrl}`;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });

  if (!res.ok) throw new Error(`Google Chat error: ${res.status}`);
  console.log("✅ Posted to Google Chat.");
}

async function main() {
  try {
    const data = await research();
    const html = generateHTML(data);
    commitAndPush(html);

    const repoName = process.env.GITHUB_REPOSITORY; // e.g. "chenpivoters/pivoters-research-agent"
    const [owner, repo] = repoName.split("/");
    const reportUrl = `https://${owner}.github.io/${repo}/reports/${todaySlug}.html`;

    await sendToGoogleChat(reportUrl);
    console.log("🎉 Done. Report at:", reportUrl);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
