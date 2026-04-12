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
class QueryError extends Error {
  constructor(msg) { super(msg); this.name = 'QueryError'; }
}

const SEARCH_URL = 'https://api.twitter.com/2/tweets/search/recent';
const ANNOTATION_TYPES = new Set(['Person', 'Organization', 'Product']);

/**
 * Fetch recent popular tweets from the last hour and normalize them.
 * @param {number} topN - number of trends the caller wants; drives how many pages to fetch
 * @returns {Promise<Array>} flat array of normalized tweet objects
 */
async function fetchRecentTweets(topN) {
  const token = process.env.TOKEN;
  const pages = Math.min(Math.ceil(topN * 2.5), 5);
  const startTime = new Date(Date.now() - 3_600_000).toISOString();

  const params = {
    query: 'min_faves:50 -is:retweet lang:en',
    start_time: startTime,
    max_results: 100,
    'tweet.fields': 'public_metrics,entities,created_at',
  };

  const headers = { Authorization: `Bearer ${token}` };

  const tweets = [];
  let nextToken = null;
  let fetched = 0;

  while (fetched < pages) {
    const reqParams = nextToken ? { ...params, next_token: nextToken } : params;

    let resp;
    try {
      resp = await axios.get(SEARCH_URL, { params: reqParams, headers, timeout: 8000 });
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        if (status === 401) throw new AuthError('Twitter authentication failed — check TOKEN in .env');
        if (status === 429) {
          const reset = err.response.headers['x-rate-limit-reset'];
          throw new RateLimitError('Twitter rate limit hit', reset ? parseInt(reset, 10) : null);
        }
        if (status === 400) throw new QueryError(`Twitter rejected query: ${JSON.stringify(err.response.data)}`);
      }
      throw err;
    }

    const { data: body } = resp;
    const rawTweets = body.data || [];

    for (const t of rawTweets) {
      tweets.push(normalizeTweet(t));
    }

    fetched++;

    if (!body.meta?.next_token || (body.meta?.result_count ?? 0) < 100) break;
    nextToken = body.meta.next_token;
  }

  return tweets;
}

function normalizeTweet(t) {
  const m = t.public_metrics || {};
  const entities = t.entities || {};

  const hashtags = (entities.hashtags || []).map(h => h.tag.toLowerCase());
  const cashtags = (entities.cashtags || []).map(c => c.tag.toUpperCase());
  const mentions = (entities.mentions || []).map(u => u.username.toLowerCase());
  const annotations = (entities.annotations || [])
    .filter(a => ANNOTATION_TYPES.has(a.type))
    .map(a => a.normalized_text || a.text || '');

  return {
    id: t.id,
    likes: m.like_count || 0,
    retweets: m.retweet_count || 0,
    replies: m.reply_count || 0,
    quotes: m.quote_count || 0,
    hashtags,
    cashtags,
    mentions,
    annotations,
    text: t.text || '',
  };
}

module.exports = { fetchRecentTweets, AuthError, RateLimitError, QueryError };
