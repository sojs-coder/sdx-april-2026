'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function nowTimestamp() {
  return new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function write(filepath, lines) {
  fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-idea file writers
// ─────────────────────────────────────────────────────────────────────────────

function writeOverview(idea, dir) {
  const lines = [];
  lines.push(`# ${idea.name} — Overview & Roadmap`);
  lines.push('');
  lines.push(`> ${idea.tagline}`);
  lines.push('');
  lines.push(`**Trend:** ${idea.related_trend}  `);
  lines.push(`**Target:** ${idea.target_customer}  `);
  lines.push(`**Revenue:** ${idea.revenue_model}`);
  lines.push('');
  lines.push('## Problem');
  lines.push(idea.problem);
  lines.push('');
  lines.push('## Solution');
  lines.push(idea.solution);
  lines.push('');
  lines.push('## MVP Features');
  (idea.mvp_features || []).forEach(f => lines.push(`- ${f}`));
  lines.push('');
  lines.push('## Why Now');
  lines.push(idea.why_now || '');
  lines.push('');

  const prd = idea.full_prd?.overview;

  lines.push('---');
  lines.push('');
  lines.push('## Auth Flow');
  if (prd?.auth_flow?.length) {
    prd.auth_flow.forEach(s => lines.push(s));
  } else {
    lines.push('_Not generated._');
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## Billing');
  const b = prd?.billing_integration;
  if (b) {
    lines.push(`**Provider:** ${b.provider || 'Stripe'}`);
    lines.push('');
    if (b.plans?.length) {
      lines.push('| Plan | $/mo | Stripe Price ID | Features |');
      lines.push('|------|------|-----------------|----------|');
      b.plans.forEach(p => {
        lines.push(`| ${p.name} | $${p.price_monthly} | \`${p.stripe_price_id_placeholder}\` | ${(p.features || []).join(', ')} |`);
      });
      lines.push('');
    }
    if (b.webhook_events?.length) {
      lines.push('**Webhook events:**');
      b.webhook_events.forEach(e => lines.push(`- \`${e}\``));
      lines.push('');
    }
    if (b.notes) lines.push(`**Notes:** ${b.notes}`);
  } else {
    lines.push('_Not generated._');
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## MVP Build Order');
  if (prd?.mvp_build_order?.length) {
    prd.mvp_build_order.forEach(d => lines.push(d));
  } else {
    lines.push('_Not generated._');
  }
  lines.push('');

  write(path.join(dir, '01-overview.md'), lines);
}

function writeBackend(idea, dir) {
  const lines = [];
  lines.push(`# ${idea.name} — Backend Spec`);
  lines.push('');
  const prd = idea.full_prd?.backend;

  if (!prd) {
    lines.push('> ⚠ Backend PRD generation failed.');
    write(path.join(dir, '02-backend.md'), lines);
    return;
  }

  // Tech stack
  lines.push('## Tech Stack');
  lines.push('');
  const ts = prd.tech_stack || {};
  if (ts.runtime)       lines.push(`- **Runtime:** ${ts.runtime}`);
  if (ts.framework)     lines.push(`- **Framework:** ${ts.framework}`);
  if (ts.database)      lines.push(`- **Database:** ${ts.database}`);
  if (ts.auth_library)  lines.push(`- **Auth:** ${ts.auth_library}`);
  if (ts.hosting)       lines.push(`- **Hosting:** ${ts.hosting}`);
  if (ts.third_party_apis?.length) {
    lines.push('');
    lines.push('**Third-party APIs:**');
    ts.third_party_apis.forEach(a => lines.push(`- ${a}`));
  }
  lines.push('');

  // File structure
  if (prd.file_structure?.length) {
    lines.push('---');
    lines.push('');
    lines.push('## File Structure');
    lines.push('');
    lines.push('```');
    prd.file_structure.forEach(f => lines.push(f));
    lines.push('```');
    lines.push('');
  }

  // DB schema
  if (prd.database_schema?.length) {
    lines.push('---');
    lines.push('');
    lines.push('## Database Schema');
    lines.push('');
    prd.database_schema.forEach(table => {
      lines.push(`### \`${table.table}\``);
      if (table.notes) lines.push(table.notes);
      lines.push('');
      lines.push('| Column | Type | Constraints | Notes |');
      lines.push('|--------|------|-------------|-------|');
      (table.columns || []).forEach(c => {
        lines.push(`| \`${c.name}\` | \`${c.type}\` | ${c.constraints || ''} | ${c.notes || ''} |`);
      });
      lines.push('');
      if (table.indexes?.length) {
        lines.push('**Indexes:**');
        table.indexes.forEach(i => lines.push(`- ${i}`));
        lines.push('');
      }
    });
  }

  // API contracts
  if (prd.api_contracts?.length) {
    lines.push('---');
    lines.push('');
    lines.push('## API Contracts');
    lines.push('');
    prd.api_contracts.forEach(ep => {
      const lock = ep.auth_required ? ' 🔒' : '';
      lines.push(`### \`${ep.method} ${ep.path}\`${lock}`);
      if (ep.notes) lines.push(ep.notes);
      lines.push('');
      if (ep.query_params && Object.keys(ep.query_params).length) {
        lines.push('**Query params:**');
        Object.entries(ep.query_params).forEach(([k, v]) => lines.push(`- \`${k}\`: ${v}`));
        lines.push('');
      }
      if (ep.request_body && Object.keys(ep.request_body).length) {
        lines.push('**Request body:**');
        lines.push('```json');
        lines.push(JSON.stringify(ep.request_body, null, 2));
        lines.push('```');
        lines.push('');
      }
      if (ep.response_200 && Object.keys(ep.response_200).length) {
        lines.push('**Response 200:**');
        lines.push('```json');
        lines.push(JSON.stringify(ep.response_200, null, 2));
        lines.push('```');
        lines.push('');
      }
      if (ep.response_errors?.length) {
        lines.push('**Errors:**');
        ep.response_errors.forEach(e => lines.push(`- ${e}`));
        lines.push('');
      }
    });
  }

  // Background jobs
  if (prd.background_jobs?.length) {
    lines.push('---');
    lines.push('');
    lines.push('## Background Jobs');
    lines.push('');
    lines.push('| Job | Trigger | Runtime | Description |');
    lines.push('|-----|---------|---------|-------------|');
    prd.background_jobs.forEach(j => {
      lines.push(`| ${j.name} | \`${j.trigger}\` | ${j.estimated_runtime} | ${j.description} |`);
    });
    lines.push('');
  }

  // Env vars
  if (prd.environment_variables?.length) {
    lines.push('---');
    lines.push('');
    lines.push('## Environment Variables');
    lines.push('');
    lines.push('| Variable | Description | Example |');
    lines.push('|----------|-------------|---------|');
    prd.environment_variables.forEach(v => {
      lines.push(`| \`${v.key}\` | ${v.description} | \`${v.example}\` |`);
    });
    lines.push('');
  }

  write(path.join(dir, '02-backend.md'), lines);
}

function writeFrontend(idea, dir) {
  const lines = [];
  lines.push(`# ${idea.name} — Frontend Spec`);
  lines.push('');
  const prd = idea.full_prd?.frontend;

  if (!prd) {
    lines.push('> ⚠ Frontend PRD generation failed.');
    write(path.join(dir, '03-frontend.md'), lines);
    return;
  }

  // Tech stack
  lines.push('## Tech Stack');
  lines.push('');
  const ts = prd.tech_stack || {};
  if (ts.framework)        lines.push(`- **Framework:** ${ts.framework}`);
  if (ts.styling)          lines.push(`- **Styling:** ${ts.styling}`);
  if (ts.state_management) lines.push(`- **State:** ${ts.state_management}`);
  if (ts.data_fetching)    lines.push(`- **Data fetching:** ${ts.data_fetching}`);
  if (ts.key_libraries?.length) {
    lines.push('');
    lines.push('**Key libraries:**');
    ts.key_libraries.forEach(l => lines.push(`- ${l}`));
  }
  lines.push('');

  // Pages
  if (prd.pages?.length) {
    lines.push('---');
    lines.push('');
    lines.push('## Pages');
    lines.push('');
    prd.pages.forEach(page => {
      const lock = page.auth_required ? ' 🔒' : '';
      lines.push(`### \`${page.route}\` — ${page.name}${lock}`);
      if (page.description) lines.push(page.description);
      lines.push('');
      if (page.components?.length) {
        lines.push('**Components:**');
        page.components.forEach(c => lines.push(`- ${c}`));
        lines.push('');
      }
      if (page.api_calls?.length) {
        lines.push('**API calls:**');
        page.api_calls.forEach(c => lines.push(`- ${c}`));
        lines.push('');
      }
    });
  }

  write(path.join(dir, '03-frontend.md'), lines);
}

function writeDesign(idea, dir) {
  const lines = [];
  lines.push(`# ${idea.name} — Design Spec`);
  lines.push('');
  const prd = idea.full_prd?.design;

  if (!prd) {
    lines.push('> ⚠ Design PRD generation failed.');
    write(path.join(dir, '04-design.md'), lines);
    return;
  }

  if (prd.component_library) {
    lines.push(`**Component library:** ${prd.component_library}`);
    lines.push('');
  }
  if (prd.vibe) {
    lines.push(`**Vibe:** ${prd.vibe}`);
    lines.push('');
  }

  // Design tokens
  const dt = prd.design_tokens;
  if (dt) {
    lines.push('---');
    lines.push('');
    lines.push('## Design Tokens');
    lines.push('');
    lines.push('| Token | Value |');
    lines.push('|-------|-------|');
    Object.entries(dt).forEach(([k, v]) => {
      const swatch = v?.startsWith?.('#') ? ` <span style="background:${v}">&nbsp;&nbsp;&nbsp;</span>` : '';
      lines.push(`| \`${k}\` | \`${v}\`${swatch} |`);
    });
    lines.push('');
  }

  // UX patterns
  if (prd.ux_patterns?.length) {
    lines.push('---');
    lines.push('');
    lines.push('## UX Patterns');
    lines.push('');
    prd.ux_patterns.forEach(p => lines.push(`- ${p}`));
    lines.push('');
  }

  // Key screens
  if (prd.key_screens?.length) {
    lines.push('---');
    lines.push('');
    lines.push('## Key Screens');
    lines.push('');
    prd.key_screens.forEach(s => {
      lines.push(`### ${s.screen}`);
      if (s.layout) lines.push(`**Layout:** ${s.layout}`);
      lines.push('');
      if (s.key_interactions?.length) {
        lines.push('**Interactions:**');
        s.key_interactions.forEach(i => lines.push(`- ${i}`));
      }
      lines.push('');
    });
  }

  write(path.join(dir, '04-design.md'), lines);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main save function
// ─────────────────────────────────────────────────────────────────────────────

function savePRDs(result) {
  ensureDir(DATA_DIR);

  const now = new Date();
  const ts = nowTimestamp();
  const runDir = path.join(DATA_DIR, ts);
  fs.mkdirSync(runDir);

  // ── index.md ───────────────────────────────────────────────────────────────
  const idx = [];
  idx.push(`# Micro-SaaS Ideas — ${now.toUTCString()}`);
  idx.push('');
  idx.push('## Trending Topics (grouped)');
  idx.push('');
  (result.meta_trends || []).forEach(m => {
    idx.push(`### ${m.name}  \`${Number(m.combined_score).toLocaleString()} tweets/hr\``);
    idx.push(`**Raw trends:** ${m.trends.join(', ')}`);
    idx.push('');
    idx.push(m.context);
    idx.push('');
  });

  idx.push('---');
  idx.push('');
  idx.push('## Ideas');
  idx.push('');
  (result.ideas || []).forEach((idea, i) => {
    const slug = slugify(idea.name);
    idx.push(`### ${i + 1}. ${idea.name}`);
    idx.push(`> ${idea.tagline}`);
    idx.push('');
    idx.push(`**Trend:** ${idea.related_trend}  `);
    idx.push(`**Files:**`);
    idx.push(`- [Overview](./${slug}/01-overview.md)`);
    idx.push(`- [Backend](./${slug}/02-backend.md)`);
    idx.push(`- [Frontend](./${slug}/03-frontend.md)`);
    idx.push(`- [Design](./${slug}/04-design.md)`);
    idx.push('');
  });

  write(path.join(runDir, 'index.md'), idx);

  // ── Per-idea subdirectories ─────────────────────────────────────────────────
  for (const idea of (result.ideas || [])) {
    const ideaDir = path.join(runDir, slugify(idea.name));
    fs.mkdirSync(ideaDir);
    writeOverview(idea, ideaDir);
    writeBackend(idea, ideaDir);
    writeFrontend(idea, ideaDir);
    writeDesign(idea, ideaDir);
  }

  return runDir;
}

function listPRDs() {
  ensureDir(DATA_DIR);
  return fs.readdirSync(DATA_DIR)
    .filter(f => fs.statSync(path.join(DATA_DIR, f)).isDirectory())
    .sort().reverse()
    .map(folder => {
      const runDir = path.join(DATA_DIR, folder);
      const ideaDirs = fs.readdirSync(runDir)
        .filter(f => fs.statSync(path.join(runDir, f)).isDirectory());
      return {
        folder,
        path: runDir,
        index: path.join(runDir, 'index.md'),
        created: folder,
        ideas: ideaDirs.map(d => ({
          name: d,
          files: fs.readdirSync(path.join(runDir, d)).filter(f => f.endsWith('.md')),
        })),
      };
    });
}

module.exports = { savePRDs, listPRDs, DATA_DIR };
