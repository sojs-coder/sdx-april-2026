const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildKeywordClusters,
  getTrendKeywords,
} = require("../lib/twitter-trends.ts");

test("clusters accent and demonym variants for the same root topic", () => {
  const clusters = buildKeywordClusters([
    { trend: "Hungary", trend_score: 100, post_count: 100, representative_hashtags: [] },
    { trend: "Hungarian", trend_score: 80, post_count: 80, representative_hashtags: [] },
    { trend: "Hungría", trend_score: 60, post_count: 60, representative_hashtags: [] },
  ]);

  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].memberCount, 3);
});

test("does not merge unrelated hashtags on a shared stopword", () => {
  const clusters = buildKeywordClusters([
    { trend: "#TheMasters", trend_score: 100, post_count: 100, representative_hashtags: ["#TheMasters"] },
    { trend: "#HEAL_THE_GAP_BELIFT", trend_score: 80, post_count: 80, representative_hashtags: ["#HEAL_THE_GAP_BELIFT"] },
  ]);

  assert.equal(clusters.length, 2);
  assert.deepEqual(
    clusters.map((cluster) => cluster.memberCount),
    [1, 1],
  );
});

test("keeps non-latin keywords instead of falling back to trend", () => {
  const keywords = getTrendKeywords({
    trend: "喫茶店の日",
    trend_score: 100,
    post_count: 100,
    representative_hashtags: [],
  });

  assert.deepEqual(keywords, ["喫茶店の日"]);
});
