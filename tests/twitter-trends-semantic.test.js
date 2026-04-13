const test = require("node:test");
const assert = require("node:assert/strict");

const { buildKeywordClusters } = require("../lib/twitter-trends.ts");
const {
  applySemanticClusterMerges,
} = require("../lib/twitter-trends-semantic.ts");

test("merges lexical clusters into a contextual event cluster", () => {
  const lexicalClusters = buildKeywordClusters([
    { trend: "Orban", trend_score: 100, post_count: 100, representative_hashtags: [] },
    { trend: "Hungary", trend_score: 90, post_count: 90, representative_hashtags: [] },
    { trend: "Hungarian", trend_score: 80, post_count: 80, representative_hashtags: [] },
    { trend: "Rory", trend_score: 70, post_count: 70, representative_hashtags: [] },
  ]);

  const mergedClusters = applySemanticClusterMerges(lexicalClusters, [
    {
      event: "Hungarian election",
      cluster_slugs: ["orban", "hungary"],
      confidence: 0.93,
      reason: "Orban and the Hungary/Hungarian cluster are part of the same election storyline.",
    },
  ]);

  assert.equal(mergedClusters[0].keyword, "Hungarian election");
  assert.equal(mergedClusters[0].mergeStrategy, "semantic");
  assert.equal(mergedClusters[0].memberCount, 3);
  assert.deepEqual(
    mergedClusters[0].trends.map((trend) => trend.trend),
    ["Orban", "Hungary", "Hungarian"],
  );
  assert.equal(mergedClusters[1].keyword, "rory");
});

test("prefers the highest-confidence non-overlapping semantic merge", () => {
  const lexicalClusters = buildKeywordClusters([
    { trend: "Orban", trend_score: 100, post_count: 100, representative_hashtags: [] },
    { trend: "Hungary", trend_score: 90, post_count: 90, representative_hashtags: [] },
    { trend: "Hungarian", trend_score: 80, post_count: 80, representative_hashtags: [] },
    { trend: "Magyar", trend_score: 70, post_count: 70, representative_hashtags: [] },
  ]);

  const mergedClusters = applySemanticClusterMerges(lexicalClusters, [
    {
      event: "Hungarian election",
      cluster_slugs: ["orban", "hungary"],
      confidence: 0.9,
      reason: "High-confidence merge.",
    },
    {
      event: "Election aliases",
      cluster_slugs: ["hungary", "magyar"],
      confidence: 0.91,
      reason: "Should be ignored because hungary was already claimed.",
    },
    {
      event: "Too weak",
      cluster_slugs: ["magyar", "orban"],
      confidence: 0.5,
      reason: "Below threshold.",
    },
  ]);

  assert.equal(mergedClusters.length, 2);
  assert.equal(mergedClusters[0].keyword, "Election aliases");
  assert.equal(mergedClusters[0].memberCount, 3);
  assert.equal(mergedClusters[1].keyword, "orban");
});
