'use strict';

const axios = require('axios');

class AuthError extends Error {
  constructor(msg) { super(msg); this.name = 'AuthError'; }
}
class RateLimitError extends Error {
  constructor(msg, retryAfter) {
    super(msg);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

const TRENDS_URL = 'https://api.twitter.com/2/trends/by/woeid/1'; // WOEID 1 = worldwide
const COUNTS_URL = 'https://api.twitter.com/2/tweets/counts/recent';

function authHeader() {
  return { Authorization: `Bearer ${process.env.TOKEN}` };
}

function apiCall(url, params) {
  return axios.get(url, { params, headers: authHeader(), timeout: 8000 });
}

/**
 * Fetch current worldwide trending topics, enriched with last-hour tweet counts.
 * Returns array of { trend_name, tweet_count } sorted by tweet_count descending.
 */
async function fetchTrendsWithCounts() {
  if (process.env.MOCK_TWITTER === '1') {
    return [
      { trend_name: '#Alpha', tweet_count: 500 },
      { trend_name: 'Breaking', tweet_count: 420 },
      { trend_name: '#Beta', tweet_count: 300 },
      { trend_name: 'Sports', tweet_count: 200 },
      { trend_name: '#Gamma', tweet_count: 150 },
      { trend_name: 'Tech', tweet_count: 120 },
      { trend_name: '#Delta', tweet_count: 90 },
      { trend_name: 'Music', tweet_count: 60 },
      { trend_name: '#Epsilon', tweet_count: 45 },
      { trend_name: 'Movies', tweet_count: 30 },
      { trend_name: '#Zeta', tweet_count: 25 },
      { trend_name: 'Science', tweet_count: 20 },
    ];
  }

  let trendsResp;
  try {
    trendsResp = await apiCall(TRENDS_URL);
  } catch (err) {
    handleAxiosError(err);
  }

  const trends = trendsResp.data.data || [];
  if (trends.length === 0) return [];

  const startTime = new Date(Date.now() - 3_600_000).toISOString();

  const enriched = await Promise.all(
    trends.map(async (trend, index) => {
      const count = await fetchTweetCount(trend.trend_name, startTime);
      const seedCount = extractSeedCount(trend, trends.length - index);
      return {
        trend_name: trend.trend_name,
        tweet_count: count ?? seedCount,
      };
    })
  );

  if (enriched.every((trend) => trend.tweet_count <= 0)) {
    return enriched
      .map((trend, index) => ({
        trend_name: trend.trend_name,
        tweet_count: buildRankFallbackCount(trends.length - index),
      }))
      .sort((a, b) => b.tweet_count - a.tweet_count);
  }

  return enriched
    .map((trend, index) => ({
      ...trend,
      tweet_count:
        trend.tweet_count > 0
          ? trend.tweet_count
          : buildRankFallbackCount(trends.length - index),
    }))
    .sort((a, b) => b.tweet_count - a.tweet_count);
}

/**
 * Fetch the total tweet count for a query term in the last hour.
 * Returns null on error so the caller can decide on a fallback strategy.
 */
async function fetchTweetCount(query, startTime) {
  try {
    const resp = await apiCall(COUNTS_URL, {
      query: buildCountQuery(query),
      granularity: 'hour',
      start_time: startTime,
    });
    return resp.data.meta?.total_tweet_count ?? null;
  } catch (_err) {
    return null;
  }
}

function buildCountQuery(query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return trimmed;

  const escaped = trimmed.replace(/"/g, '');
  const terms = [];

  if (escaped.startsWith('#')) {
    const plain = escaped.slice(1).trim();
    terms.push(escaped);
    if (plain) {
      terms.push(`"${plain}"`);
    }
  } else if (/\s/u.test(escaped)) {
    terms.push(`"${escaped}"`);
  } else {
    terms.push(escaped);
  }

  return terms.length === 1 ? terms[0] : `(${terms.join(' OR ')})`;
}

function extractSeedCount(trend, rankWeight) {
  const candidates = [
    trend.tweet_count,
    trend.tweet_volume,
    trend.post_count,
    trend.volume,
  ];

  for (const value of candidates) {
    if (typeof value === 'number' && value > 0) {
      return value;
    }
  }

  return buildRankFallbackCount(rankWeight);
}

function buildRankFallbackCount(rankWeight) {
  return Math.max(1, rankWeight) * 100;
}

function handleAxiosError(err) {
  if (err.response) {
    const status = err.response.status;
    if (status === 401 || status === 403) {
      throw new AuthError('Twitter authentication failed - check TOKEN in .env');
    }
    if (status === 429) {
      const reset = err.response.headers['x-rate-limit-reset'];
      throw new RateLimitError('Twitter rate limit hit', reset ? parseInt(reset, 10) : null);
    }
    const responseBody =
      typeof err.response.data === 'string'
        ? err.response.data
        : JSON.stringify(err.response.data);
    const error = new Error(
      `Twitter API returned ${status}${responseBody ? `: ${responseBody}` : ''}`
    );
    error.cause = err;
    throw error;
  }

  const networkMessage =
    err?.code
      ? `${err.code}${err.message ? ` - ${err.message}` : ''}`
      : err?.message || 'Unknown network error';
  const error = new Error(`Twitter upstream request failed: ${networkMessage}`);
  error.cause = err;
  throw error;
}

module.exports = { fetchTrendsWithCounts, AuthError, RateLimitError };
