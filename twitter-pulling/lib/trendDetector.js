'use strict';

/**
 * Format pre-enriched trend data into the final response shape.
 * Input: array of { trend_name, tweet_count } already sorted by tweet_count desc.
 * Output: top topN trends in API response format.
 */
function detectTrends(trendsWithCounts, topN) {
  return trendsWithCounts
    .slice(0, topN)
    .map(t => ({
      trend: t.trend_name,
      trend_score: t.tweet_count,
      post_count: t.tweet_count,
      representative_hashtags: t.trend_name.startsWith('#') ? [t.trend_name] : [],
    }));
}

module.exports = { detectTrends };
