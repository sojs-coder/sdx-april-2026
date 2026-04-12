'use strict';
/**
 * Full pipeline test — run with: node test-pipeline.js
 * Tests the entire flow: trends → grouping → ideas → tech PRDs → file save
 */

require('dotenv').config();

const { fetchTrendsWithCounts } = require('./lib/twitterClient');
const { detectTrends } = require('./lib/trendDetector');
const { generateIdeas } = require('./lib/ideaAgent');
const { savePRDs, listPRDs } = require('./lib/storage');

const EXPECTED_PRD_PARTS = ['overview', 'backend', 'frontend', 'design'];

let passed = 0;
let failed = 0;

function pass(msg) { console.log('  [PASS]', msg); passed++; }
function fail(msg) { console.log('  [FAIL]', msg); failed++; }
function section(title) { console.log('\n---', title, '---'); }

(async () => {
  // ── Step 1: Trends ────────────────────────────────────────────────────────
  section('Twitter Trends');
  let trends;
  try {
    const raw = await fetchTrendsWithCounts();
    trends = detectTrends(raw, raw.length);
    if (trends.length > 0) pass(`Fetched ${trends.length} trends — top: "${trends[0].trend}" (${trends[0].trend_score.toLocaleString()} tweets/hr)`);
    else fail('No trends returned');
  } catch (e) {
    fail('fetchTrendsWithCounts threw: ' + e.message);
    process.exit(1);
  }

  // ── Step 2: Ideas + PRDs ──────────────────────────────────────────────────
  section('Idea + PRD Generation');
  let result;
  try {
    result = await generateIdeas(trends);
  } catch (e) {
    fail('generateIdeas threw: ' + e.message);
    process.exit(1);
  }

  // Meta-trends
  if (result.meta_trends?.length > 0) pass(`Grouped into ${result.meta_trends.length} meta-trends`);
  else fail('No meta-trends produced');

  // Ideas count
  if (result.ideas?.length === 3) pass('Exactly 3 ideas generated');
  else fail(`Expected 3 ideas, got ${result.ideas?.length}`);

  // Per-idea checks
  for (const idea of (result.ideas || [])) {
    console.log(`\n  Idea: "${idea.name}"`);

    // Brief fields
    const briefFields = ['name', 'tagline', 'problem', 'solution', 'target_customer', 'revenue_model', 'mvp_features', 'why_now'];
    const missingBrief = briefFields.filter(k => !idea[k]);
    if (missingBrief.length === 0) pass('All brief fields present');
    else fail('Missing brief fields: ' + missingBrief.join(', '));

    // Full PRD — 4 parts
    const prd = idea.full_prd;
    if (!prd) { fail('full_prd is null'); continue; }

    const missingParts = EXPECTED_PRD_PARTS.filter(k => !prd[k]);
    if (missingParts.length === 0) pass('All 4 PRD parts present (overview, backend, frontend, design)');
    else fail(`Missing PRD parts: ${missingParts.join(', ')}`);

    // Overview checks
    if (prd.overview?.mvp_build_order?.length) pass(`Build order has ${prd.overview.mvp_build_order.length} day(s)`);
    else fail('overview.mvp_build_order missing');
    if (prd.overview?.billing_integration?.plans?.length) pass(`Billing has ${prd.overview.billing_integration.plans.length} plan(s)`);
    else fail('overview.billing_integration.plans missing');

    // Backend checks
    if (prd.backend?.tech_stack?.runtime) pass('backend.tech_stack.runtime: ' + prd.backend.tech_stack.runtime.slice(0, 60));
    else fail('backend.tech_stack.runtime missing');
    if (Array.isArray(prd.backend?.database_schema) && prd.backend.database_schema.length) {
      pass(`database_schema: ${prd.backend.database_schema.map(t => t.table).join(', ')}`);
    } else fail('backend.database_schema missing');
    if (Array.isArray(prd.backend?.api_contracts) && prd.backend.api_contracts.length) {
      pass(`api_contracts: ${prd.backend.api_contracts.length} endpoint(s)`);
    } else fail('backend.api_contracts missing');

    // Frontend checks
    if (prd.frontend?.tech_stack?.framework) pass('frontend.tech_stack.framework: ' + prd.frontend.tech_stack.framework.slice(0, 60));
    else fail('frontend.tech_stack.framework missing');
    if (Array.isArray(prd.frontend?.pages) && prd.frontend.pages.length) {
      pass(`frontend pages: ${prd.frontend.pages.map(p => p.route).join(', ')}`);
    } else fail('frontend.pages missing');

    // Design checks
    if (prd.design?.design_tokens?.primary) pass('design tokens present, primary: ' + prd.design.design_tokens.primary);
    else fail('design.design_tokens.primary missing');
    if (prd.design?.key_screens?.length) pass(`design key_screens: ${prd.design.key_screens.map(s => s.screen).join(', ')}`);
    else fail('design.key_screens missing');
  }

  // ── Step 3: File save ─────────────────────────────────────────────────────
  section('File Storage');
  let savedDir;
  try {
    savedDir = savePRDs(result);
    pass('savePRDs completed without error');
  } catch (e) {
    fail('savePRDs threw: ' + e.message);
    process.exit(1);
  }

  const fs = require('fs');
  const files = fs.readdirSync(savedDir);
  const mdFiles = files.filter(f => f.endsWith('.md'));
  if (files.includes('index.md')) pass('index.md created');
  else fail('index.md missing');

  // PRD files now live in idea subdirs — just check index exists at root
  pass('index.md confirmed at run root');

  // Check each idea subfolder has all 4 files with no failure warnings
  const path = require('path');
  const ideaDirs = fs.readdirSync(savedDir).filter(f => fs.statSync(path.join(savedDir, f)).isDirectory());
  if (ideaDirs.length === 3) pass(`3 idea subdirectories: ${ideaDirs.join(', ')}`);
  else fail(`Expected 3 idea subdirs, got ${ideaDirs.length}`);

  for (const ideaDir of ideaDirs) {
    const ideaPath = path.join(savedDir, ideaDir);
    const ideaFiles = fs.readdirSync(ideaPath).filter(f => f.endsWith('.md'));
    if (ideaFiles.length === 4) pass(`${ideaDir}: all 4 files present`);
    else fail(`${ideaDir}: expected 4 files, got ${ideaFiles.length} (${ideaFiles.join(', ')})`);

    for (const f of ideaFiles) {
      const content = fs.readFileSync(path.join(ideaPath, f), 'utf8');
      if (content.includes('generation failed')) fail(`${ideaDir}/${f} has failure warning`);
      else pass(`${ideaDir}/${f} complete`);
    }
  }

  // History list
  const runs = listPRDs();
  if (runs.length > 0) pass(`listPRDs returns ${runs.length} run(s)`);
  else fail('listPRDs returned empty list');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n==============================');
  const total = passed + failed;
  if (failed === 0) console.log(`  ALL ${passed} / ${total} TESTS PASSED`);
  else console.log(`  ${passed} PASSED   ${failed} FAILED   (${total} total)`);
  console.log('==============================');
  console.log('\nSaved to:', savedDir);
})();
