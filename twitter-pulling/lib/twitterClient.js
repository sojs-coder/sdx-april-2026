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
  // Step 1: get trending topic names
  let trendsResp;
  try {
    trendsResp = await apiCall(TRENDS_URL);
  } catch (err) {
    handleAxiosError(err);
  }

  const trends = trendsResp.data.data || []; // [{ trend_name }, ...]

  if (trends.length === 0) return [];

  const startTime = new Date(Date.now() - 3_600_000).toISOString();

  // Step 2: fetch last-hour tweet count for every trend in parallel
  const enriched = await Promise.all(
    trends.map(async (t) => {
      const count = await fetchTweetCount(t.trend_name, startTime);
      return { trend_name: t.trend_name, tweet_count: count };
    })
  );

  return enriched.sort((a, b) => b.tweet_count - a.tweet_count);
}

/**
 * Fetch the total tweet count for a query term in the last hour.
 * Returns 0 on any error so a single failure doesn't break the whole request.
 */
async function fetchTweetCount(query, startTime) {
  try {
    const resp = await apiCall(COUNTS_URL, {
      query,
      granularity: 'hour',
      start_time: startTime,
    });
    return resp.data.meta?.total_tweet_count || 0;
  } catch (err) {
    // Don't surface individual count failures — just score as 0
    return 0;
  }
}

function handleAxiosError(err) {
  if (err.response) {
    const status = err.response.status;
    if (status === 401 || status === 403) {
      throw new AuthError('Twitter authentication failed — check TOKEN in .env');
    }
    if (status === 429) {
      const reset = err.response.headers['x-rate-limit-reset'];
      throw new RateLimitError('Twitter rate limit hit', reset ? parseInt(reset, 10) : null);
    }
  }
  throw err;
}

module.exports = { fetchTrendsWithCounts, AuthError, RateLimitError };
