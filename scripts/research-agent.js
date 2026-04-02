// scripts/research-agent.js
// Pivoters Daily Research Agent — full quality version
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric"
});
const todaySlug = new Date().toISOString().split("T")[0];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function callClaude(prompt, maxTokens = 2000) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (res.status === 429) {
      const wait = 60000 * (attempt + 1);
      console.log(`Rate limited. Waiting ${wait/1000}s...`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const text = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON found:\n" + text.slice(0, 400));
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch(e) {
      throw new Error("JSON parse failed: " + e.message + "\nText: " + text.slice(start, start + 400));
    }
  }
  throw new Error("Max retries exceeded");
}

async function research() {
  // ── CALL 1: Job seeker pain points ───────────────────────────────────────
  console.log("🔍 [1/3] Researching job seeker pain points...");
  await sleep(2000);

  const part1 = await callClaude(`Today is ${today}.

You are a senior product analyst for Pivoters.com — a job matching platform for workers aged 55+ looking for frontline jobs (grocery, warehouse, retail, delivery, cleaning, security). Many have no resume or LinkedIn.

Search Reddit RIGHT NOW for posts from the last 14 days in these subreddits: r/ageover50, r/jobs, r/Unemployment, r/povertyfinance, r/WorkReform, r/Layoffs, r/retirement.

Also search X/Twitter for: "55+ job search", "older worker hiring", "age discrimination retail warehouse", "senior worker job".

Also search news for: age discrimination 55+ hiring 2026, frontline worker shortage experienced, older workers retail warehouse 2026.

Find REAL specific complaints, patterns, and frustrations — not generic statistics.

Return ONLY this raw JSON object, nothing else:
{
  "summary": "2-3 sentences describing the most important thing happening right now for 55+ frontline job seekers",
  "trending_topics": ["topic1", "topic2", "topic3"],
  "total_signals": 45,
  "sentiment": {
    "job_seeker": "worsening",
    "job_seeker_reason": "one sentence why"
  },
  "pain_points": [
    {
      "insight": "Specific real finding from a real source",
      "source": "Reddit r/ageover50",
      "quote": "actual quote if available",
      "severity": "high",
      "trend": "rising"
    }
  ],
  "unmet_needs": [
    {
      "insight": "Something 55+ workers explicitly ask for that no platform provides",
      "source": "where you found this",
      "severity": "high"
    }
  ]
}

Max 4 pain_points, max 3 unmet_needs. Raw JSON only, no markdown.`, 1800);

  await sleep(8000);

  // ── CALL 2: Employer signals + competitors ────────────────────────────────
  console.log("🔍 [2/3] Researching employers and competitors...");

  const part2 = await callClaude(`Today is ${today}.

You are a senior product analyst for Pivoters.com — a job matching platform for 55+ frontline workers.

Search for:
1. Employer pain points: search "hiring experienced workers 55+ challenges 2026", "frontline worker shortage grocery retail warehouse", "older worker retention employer"
2. Competitors: search "AARP job board 2026", "RetirementJobs.com update", "Workforce50 new features", "Seniors4Hire", "job app seniors no resume 2026", "55+ hiring platform launch 2026"
3. Also check Product Hunt for any new job platforms targeting older or blue-collar workers launched in 2025-2026

Return ONLY this raw JSON, nothing else:
{
  "employer_pain_points": [
    {
      "insight": "Specific employer challenge found",
      "source": "news source or platform",
      "opportunity": "how Pivoters can address this"
    }
  ],
  "competitor_gaps": [
    {
      "competitor": "Platform name",
      "insight": "What they do and their specific weakness",
      "source": "where you found this",
      "opportunity": "specific Pivoters advantage here"
    }
  ],
  "sentiment": {
    "employer": "stable",
    "employer_reason": "one sentence",
    "competitor": "worsening",
    "competitor_reason": "one sentence"
  }
}

Max 3 employer_pain_points, max 4 competitor_gaps. Raw JSON only.`, 1800);

  await sleep(8000);

  // ── CALL 3: Recommendations ───────────────────────────────────────────────
  console.log("🔍 [3/3] Generating recommendations...");

  const context = JSON.stringify({
    pain_points: part1.pain_points,
    unmet_needs: part1.unmet_needs,
    employer_pain_points: part2.employer_pain_points,
    competitor_gaps: part2.competitor_gaps,
  });

  const part3 = await callClaude(`Today is ${today}. You are chief product officer at Pivoters.com — a job platform for 55+ frontline workers (grocery, warehouse, retail). No resume required.

Based on this research: ${context}

Generate 3 specific, actionable recommendations for the Pivoters product team. Each must be concrete — not "improve UX" but "add a one-tap apply button for warehouse roles that only asks for availability and phone number."

Return ONLY this raw JSON, nothing else:
{
  "top_3_recommendations": [
    {
      "rank": 1,
      "recommendation": "Specific actionable thing to build or do",
      "rationale": "Why, based on the research above",
      "effort": "low",
      "timing": "this week"
    }
  ]
}

Effort must be: low, medium, or high. Raw JSON only.`, 1000);

  // ── Merge all results ─────────────────────────────────────────────────────
  return {
    date: today,
    summary: part1.summary || "",
    trending_topics: part1.trending_topics || [],
    total_signals: part1.total_signals || 0,
    sentiment_overview: {
      job_seeker: { value: part1.sentiment?.job_seeker || "", reason: part1.sentiment?.job_seeker_reason || "" },
      employer: { value: part2.sentiment?.employer || "", reason: part2.sentiment?.employer_reason || "" },
      competitor: { value: part2.sentiment?.competitor || "", reason: part2.sentiment?.competitor_reason || "" },
    },
    pain_points: part1.pain_points || [],
    unmet_needs: part1.unmet_needs || [],
    employer_pain_points: part2.employer_pain_points || [],
    competitor_gaps: part2.competitor_gaps || [],
    top_3_recommendations: part3.top_3_recommendations || [],
  };
}

// ── HTML Generator ────────────────────────────────────────────────────────────
function severityBadge(s) {
  const colors = { high: "#DC2626", medium: "#D97706", low: "#16A34A" };
  const c = colors[s] || "#6B7280";
  return `<span style="display:inline-block;padding:1px 8px;border-radius:999px;font-size:10px;font-weight:700;background:${c}20;color:${c};border:1px solid ${c}40;text-transform:uppercase">${s||"med"}</span>`;
}

function trendBadge(t) {
  if (!t) return "";
  const up = t === "rising"; 
  return `<span style="font-size:11px;color:${up?"#DC2626":"#16A34A"}">${up?"↑ Rising":"→ Stable"}</span>`;
}

function effortBadge(e) {
  const colors = { low: "#16A34A", medium: "#D97706", high: "#DC2626" };
  const c = colors[e] || "#6B7280";
  return `<span style="display:inline-block;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${c}15;color:${c};text-transform:uppercase">${e||""} effort</span>`;
}

function card(content, accent) {
  return `<div style="background:#fff;border:1px solid #E5E7EB;border-left:3px solid ${accent||"#E5E7EB"};border-radius:10px;padding:16px 20px;margin-bottom:10px">${content}</div>`;
}

function sectionHeader(icon, title, color) {
  return `<div style="display:flex;align-items:center;gap:8px;margin:28px 0 12px">
    <span style="font-size:18px">${icon}</span>
    <h2 style="font-size:15px;font-weight:700;color:${color||"#111827"};margin:0">${title}</h2>
  </div>`;
}

function generateHTML(d) {
  const sentimentColor = (v) => v === "worsening" ? "#DC2626" : v === "improving" ? "#16A34A" : "#D97706";
  const sentimentIcon = (v) => v === "worsening" ? "↓" : v === "improving" ? "↑" : "→";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Pivoters Daily Brief — ${d.date}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',sans-serif;background:#F3F4F6;color:#374151;font-size:14px;line-height:1.6}
    .wrap{max-width:740px;margin:0 auto;padding:32px 20px 60px}
    .header{background:linear-gradient(135deg,#0F2942,#1A4731);border-radius:16px;padding:32px;margin-bottom:24px;color:#fff}
    .logo-row{display:flex;align-items:center;gap:10px;margin-bottom:16px}
    .logo-dot{width:32px;height:32px;background:linear-gradient(135deg,#F59E0B,#EF4444);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px}
    .logo-text{font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.65}
    .header-title{font-size:26px;font-weight:700;margin-bottom:4px}
    .header-date{font-size:12px;opacity:0.6;margin-bottom:18px}
    .summary-box{background:rgba(255,255,255,0.1);border-radius:10px;padding:16px 18px;font-size:14px;line-height:1.75;margin-bottom:18px}
    .trending-row{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:18px}
    .trend-tag{background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:999px;padding:3px 12px;font-size:11px}
    .stats-row{display:flex;gap:16px}
    .stat{background:rgba(255,255,255,0.08);border-radius:8px;padding:8px 14px;text-align:center}
    .stat-num{font-size:20px;font-weight:700}
    .stat-label{font-size:10px;opacity:0.65;text-transform:uppercase;letter-spacing:1px}
    .sentiment-table{background:#fff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;margin-bottom:28px}
    .sent-row{display:grid;grid-template-columns:140px 90px 1fr;gap:0;border-bottom:1px solid #F3F4F6;padding:12px 18px;align-items:start}
    .sent-row:last-child{border-bottom:none}
    .sent-label{font-weight:600;color:#111827;font-size:13px}
    .sent-value{font-weight:700;font-size:13px}
    .sent-reason{font-size:12px;color:#6B7280}
    .insight{font-weight:500;color:#111827;font-size:14px;margin-bottom:5px}
    .meta{font-size:12px;color:#6B7280;margin-top:4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .quote{font-size:12px;color:#4B5563;font-style:italic;border-left:2px solid #E5E7EB;padding-left:10px;margin-top:8px}
    .opp{font-size:12px;color:#065F46;background:#ECFDF5;border-radius:4px;padding:6px 10px;margin-top:8px}
    .rec-card{background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:20px 22px;margin-bottom:12px}
    .rec-rank{width:32px;height:32px;background:linear-gradient(135deg,#0F2942,#1A4731);color:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0}
    .rec-header{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px}
    .rec-title{font-weight:600;color:#111827;font-size:14px;margin-bottom:4px}
    .rec-rationale{font-size:13px;color:#4B5563;line-height:1.6}
    .rec-meta{display:flex;gap:8px;margin-top:10px;align-items:center}
    .footer{text-align:center;font-size:11px;color:#9CA3AF;margin-top:48px;padding-top:20px;border-top:1px solid #E5E7EB}
  </style>
</head>
<body>
<div class="wrap">

  <!-- Header -->
  <div class="header">
    <div class="logo-row">
      <div class="logo-dot">🔭</div>
      <div class="logo-text">Pivoters.com · Daily Intelligence</div>
    </div>
    <div class="header-title">Daily Research Digest</div>
    <div class="header-date">${d.date}</div>
    <div class="summary-box">${d.summary}</div>
    <div class="trending-row">
      ${(d.trending_topics||[]).map(t=>`<span class="trend-tag">🔥 ${t}</span>`).join("")}
    </div>
    <div class="stats-row">
      <div class="stat"><div class="stat-num">${d.total_signals||"—"}</div><div class="stat-label">Signals</div></div>
      <div class="stat"><div class="stat-num">${(d.pain_points||[]).length}</div><div class="stat-label">Pain Points</div></div>
      <div class="stat"><div class="stat-num">${(d.competitor_gaps||[]).length}</div><div class="stat-label">Competitors</div></div>
      <div class="stat"><div class="stat-num">${(d.top_3_recommendations||[]).length}</div><div class="stat-label">Recs</div></div>
    </div>
  </div>

  <!-- Sentiment -->
  <div class="sentiment-table">
    ${[
      ["45+ Job Seekers", d.sentiment_overview?.job_seeker?.value, d.sentiment_overview?.job_seeker?.reason],
      ["Employers", d.sentiment_overview?.employer?.value, d.sentiment_overview?.employer?.reason],
      ["Competitor Platforms", d.sentiment_overview?.competitor?.value, d.sentiment_overview?.competitor?.reason],
    ].map(([label, val, reason]) => `
    <div class="sent-row">
      <div class="sent-label">${label}</div>
      <div class="sent-value" style="color:${sentimentColor(val)}">${sentimentIcon(val)} ${(val||"").toUpperCase()}</div>
      <div class="sent-reason">${reason||""}</div>
    </div>`).join("")}
  </div>

  <!-- Pain Points -->
  ${sectionHeader("⚡", "Pain Points — What 55+ workers are saying right now", "#DC2626")}
  ${(d.pain_points||[]).map(p => card(`
    <div class="insight">${p.insight}</div>
    <div class="meta">${severityBadge(p.severity)} ${trendBadge(p.trend)} <span>📍 ${p.source||""}</span></div>
    ${p.quote ? `<div class="quote">"${p.quote}"</div>` : ""}
  `, "#DC2626")).join("")}

  <!-- Employer Pain Points -->
  ${sectionHeader("🏢", "Employer Pain Points", "#F97316")}
  ${(d.employer_pain_points||[]).map(e => card(`
    <div class="insight">${e.insight}</div>
    <div class="meta">📍 ${e.source||""}</div>
    ${e.opportunity ? `<div class="opp">→ Pivoters opportunity: ${e.opportunity}</div>` : ""}
  `, "#F97316")).join("")}

  <!-- Unmet Needs -->
  ${sectionHeader("🎯", "Unmet Needs", "#7C3AED")}
  ${(d.unmet_needs||[]).map(n => card(`
    <div class="insight">${n.insight}</div>
    <div class="meta">${severityBadge(n.severity)} <span>📍 ${n.source||""}</span></div>
  `, "#7C3AED")).join("")}

  <!-- Competitor Gaps -->
  ${sectionHeader("🔍", "Competitor Landscape", "#0EA5E9")}
  ${(d.competitor_gaps||[]).map(c => card(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div style="flex:1">
        <div class="insight">${c.competitor}</div>
        <div style="font-size:13px;color:#374151;margin:4px 0">${c.insight}</div>
        <div class="meta">📍 ${c.source||""}</div>
        ${c.opportunity ? `<div class="opp">→ Pivoters: ${c.opportunity}</div>` : ""}
      </div>
    </div>
  `, "#0EA5E9")).join("")}

  <!-- Recommendations -->
  ${sectionHeader("🚀", "Top Recommendations for Pivoters", "#059669")}
  ${(d.top_3_recommendations||[]).map(r => `
  <div class="rec-card">
    <div class="rec-header">
      <div class="rec-rank">${r.rank}</div>
      <div>
        <div class="rec-title">${r.recommendation}</div>
        <div class="rec-meta">${effortBadge(r.effort)} <span style="font-size:11px;color:#6B7280">${r.timing||""}</span></div>
      </div>
    </div>
    <div class="rec-rationale">${r.rationale}</div>
  </div>`).join("")}

  <div class="footer">
    Generated by Pivoters Research Agent · ${d.date}<br>
    Sources: Reddit, X/Twitter, LinkedIn, Glassdoor, AARP, News
  </div>
</div>
</body>
</html>`;
}

// ── Git commit ────────────────────────────────────────────────────────────────
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
  console.log("✅ Committed to GitHub Pages");
}

// ── Google Chat ───────────────────────────────────────────────────────────────
async function sendToGoogleChat(url, d) {
  const webhook = process.env.GOOGLE_CHAT_WEBHOOK;
  if (!webhook) { console.log("⚠️ No webhook set"); return; }

  const topPain = (d.pain_points||[])[0]?.insight || "";
  const topRec = (d.top_3_recommendations||[])[0]?.recommendation || "";

  const msg = `*📋 Pivoters Daily Research Brief — ${today}*
🔥 ${(d.trending_topics||[]).join(" · ")}

*Top pain point:* ${topPain}
*Top rec:* ${topRec}

👉 Full report: ${url}`;

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: msg }),
  });
  if (!res.ok) throw new Error(`Chat error: ${res.status}`);
  console.log("✅ Posted to Google Chat");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  try {
    const data = await research();
    console.log("✅ Research complete. Generating HTML...");
    const html = generateHTML(data);
    commitAndPush(html);
    const [owner, repo] = (process.env.GITHUB_REPOSITORY || "cheisr/pivoters-research-agent").split("/");
    const url = `https://${owner}.github.io/${repo}/reports/${todaySlug}.html`;
    await sendToGoogleChat(url, data);
    console.log("🎉 Done:", url);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
