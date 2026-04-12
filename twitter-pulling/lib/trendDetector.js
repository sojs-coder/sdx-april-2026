'use strict';

// ---------------------------------------------------------------------------
// Union-Find (path-compressed, union-by-rank)
// ---------------------------------------------------------------------------
class UnionFind {
  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  find(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)));
    }
    return this.parent.get(x);
  }

  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank.get(ra) < this.rank.get(rb)) {
      this.parent.set(ra, rb);
    } else if (this.rank.get(ra) > this.rank.get(rb)) {
      this.parent.set(rb, ra);
    } else {
      this.parent.set(rb, ra);
      this.rank.set(ra, (this.rank.get(ra) || 0) + 1);
    }
  }

  getRoot(x) {
    return this.find(x);
  }
}

// ---------------------------------------------------------------------------
// Stopwords (~150 common English words)
// ---------------------------------------------------------------------------
const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'have', 'from', 'they', 'will',
  'been', 'their', 'what', 'when', 'make', 'like', 'time', 'just', 'know',
  'take', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'than',
  'then', 'look', 'come', 'over', 'also', 'back', 'after', 'think', 'about',
  'because', 'more', 'through', 'even', 'before', 'line', 'right', 'still',
  'well', 'need', 'many', 'much', 'under', 'never', 'here', 'does', 'only',
  'down', 'would', 'there', 'these', 'things', 'want', 'going', 'long',
  'said', 'same', 'each', 'those', 'both', 'being', 'very', 'should',
  'most', 'other', 'while', 'such', 'which', 'where', 'between', 'might',
  'always', 'actually', 'really', 'every', 'getting', 'making', 'saying',
  'having', 'doing', 'going', 'since', 'something', 'nothing', 'anything',
  'everything', 'someone', 'anyone', 'everyone', 'somehow', 'somewhere',
  'another', 'however', 'though', 'together', 'against', 'without', 'around',
  'whether', 'point', 'until', 'using', 'thing', 'again', 'great', 'last',
  'once', 'next', 'knew', 'must', 'away', 'done', 'went', 'stop', 'tell',
  'gave', 'else', 'high', 'seem', 'help', 'live', 'ask', 'move', 'show',
  'play', 'turn', 'read', 'hold', 'mean', 'keep', 'head', 'give', 'lets',
  'twitter', 'tweet', 'retweet', 'follow', 'https', 'http', 'amp', 'via',
  'just', 'were', 'from', 'your', 'that', 'with', 'this', 'have', 'they',
]);

// ---------------------------------------------------------------------------
// Keyword extraction for Jaccard fallback
// ---------------------------------------------------------------------------
function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')     // strip URLs
    .replace(/[^a-z0-9\s]/g, ' ')       // strip punctuation
    .split(/\s+/)
    .filter(t => t.length >= 4 && !STOPWORDS.has(t))
    .slice(0, 8);
}

function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) if (setB.has(item)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ---------------------------------------------------------------------------
// Normalize entity strings for matching
// ---------------------------------------------------------------------------
function normalizeEntity(str) {
  return str
    .toLowerCase()
    .replace(/'s\b/g, '')   // strip possessives
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Count frequency of items across an array of arrays
// ---------------------------------------------------------------------------
function mostFrequent(arrays) {
  const freq = new Map();
  for (const arr of arrays) {
    for (const item of arr) {
      freq.set(item, (freq.get(item) || 0) + 1);
    }
  }
  let best = null, bestCount = 0;
  for (const [item, count] of freq) {
    if (count > bestCount) { best = item; bestCount = count; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
function detectTrends(tweets, topN) {
  // Step 0: compute engagement, discard zero-signal tweets
  const scored = tweets
    .map(t => ({
      ...t,
      engagement: t.likes + t.retweets * 3 + t.replies * 2 + t.quotes * 2,
    }))
    .filter(t => t.engagement > 0);

  if (scored.length === 0) return [];

  // Union-Find over tweet indices
  const uf = new UnionFind();
  for (let i = 0; i < scored.length; i++) uf.find(i); // register all

  // Step 1: Hashtag clustering
  const hashtagIndex = new Map(); // normalized hashtag → first tweet index
  for (let i = 0; i < scored.length; i++) {
    for (const tag of scored[i].hashtags) {
      if (hashtagIndex.has(tag)) {
        uf.union(i, hashtagIndex.get(tag));
      } else {
        hashtagIndex.set(tag, i);
      }
    }
  }

  // Step 2: Cashtag clustering
  const cashtagIndex = new Map();
  for (let i = 0; i < scored.length; i++) {
    for (const tag of scored[i].cashtags) {
      if (cashtagIndex.has(tag)) {
        uf.union(i, cashtagIndex.get(tag));
      } else {
        cashtagIndex.set(tag, i);
      }
    }
  }

  // Step 3: Named entity + mention clustering
  const entityIndex = new Map();
  for (let i = 0; i < scored.length; i++) {
    const keys = [
      ...scored[i].annotations.map(normalizeEntity),
      ...scored[i].mentions.map(normalizeEntity),
    ].filter(Boolean);

    for (const key of keys) {
      if (entityIndex.has(key)) {
        uf.union(i, entityIndex.get(key));
      } else {
        entityIndex.set(key, i);
      }
    }
  }

  // Step 4: Keyword Jaccard fallback for tweets still unclustered (singleton)
  // A tweet is "singleton" if its root is itself AND no other tweet shares its root yet
  const rootCounts = new Map();
  for (let i = 0; i < scored.length; i++) {
    const r = uf.find(i);
    rootCounts.set(r, (rootCounts.get(r) || 0) + 1);
  }

  const singletons = [];
  for (let i = 0; i < scored.length; i++) {
    if (rootCounts.get(uf.find(i)) === 1) singletons.push(i);
  }

  if (singletons.length >= 2) {
    const kwSets = singletons.map(i => new Set(extractKeywords(scored[i].text)));
    for (let a = 0; a < singletons.length - 1; a++) {
      for (let b = a + 1; b < singletons.length; b++) {
        if (jaccard(kwSets[a], kwSets[b]) >= 0.3) {
          uf.union(singletons[a], singletons[b]);
        }
      }
    }
  }

  // Step 5: Build clusters
  const clusters = new Map(); // root → { tweets: [], allHashtags: [], allCashtags: [], allAnnotations: [], allKeywords: [] }
  for (let i = 0; i < scored.length; i++) {
    const root = uf.find(i);
    if (!clusters.has(root)) {
      clusters.set(root, {
        tweets: [],
        allHashtags: [],   // arrays of original-cased tags per tweet
        allCashtags: [],
        allAnnotations: [],
        allKeywords: [],
      });
    }
    const c = clusters.get(root);
    c.tweets.push(scored[i]);
    // preserve original-cased hashtags from raw text for label extraction
    c.allHashtags.push(...scored[i].hashtags);
    c.allCashtags.push(...scored[i].cashtags);
    c.allAnnotations.push(...scored[i].annotations);
    c.allKeywords.push(...extractKeywords(scored[i].text));
  }

  // Step 5 (cont): score clusters
  const results = [];
  for (const [, c] of clusters) {
    const totalEngagement = c.tweets.reduce((s, t) => s + t.engagement, 0);
    const tweetCount = c.tweets.length;
    const clusterScore = Math.round(totalEngagement * Math.pow(tweetCount, 0.7));

    // Step 6: label extraction
    let trend = null;

    if (c.allHashtags.length > 0) {
      const tag = mostFrequent([c.allHashtags]);
      // get original casing from source tweets
      const originalTag = (() => {
        for (const t of c.tweets) {
          const found = t.hashtags.find(h => h === tag);
          if (found) {
            // re-find from raw tweet text for original casing
            const match = t.text.match(new RegExp(`#(${escapeRegex(found)})`, 'i'));
            return match ? `#${match[1]}` : `#${tag}`;
          }
        }
        return `#${tag}`;
      })();
      trend = originalTag;
    } else if (c.allCashtags.length > 0) {
      trend = `$${mostFrequent([c.allCashtags])}`;
    } else if (c.allAnnotations.length > 0) {
      trend = mostFrequent([c.allAnnotations]);
    } else if (c.allKeywords.length > 0) {
      const kw = mostFrequent([c.allKeywords]);
      trend = kw ? toTitleCase(kw) : null;
    }

    if (!trend) trend = 'Unknown';

    // representative_hashtags: hashtags appearing in >= 2 tweets, up to 5
    const hashFreq = new Map();
    for (const t of c.tweets) {
      const seen = new Set(t.hashtags);
      for (const h of seen) hashFreq.set(h, (hashFreq.get(h) || 0) + 1);
    }
    let repHashtags = [...hashFreq.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([h]) => {
        // recover original casing from tweet text
        for (const t of c.tweets) {
          const m = t.text.match(new RegExp(`#(${escapeRegex(h)})`, 'i'));
          if (m) return `#${m[1]}`;
        }
        return `#${h}`;
      });

    if (repHashtags.length === 0 && c.allHashtags.length > 0) {
      // fall back to any hashtag that appears at least once
      repHashtags = [...new Set(c.allHashtags)].slice(0, 5).map(h => {
        for (const t of c.tweets) {
          const m = t.text.match(new RegExp(`#(${escapeRegex(h)})`, 'i'));
          if (m) return `#${m[1]}`;
        }
        return `#${h}`;
      });
    }

    results.push({ trend, trend_score: clusterScore, post_count: tweetCount, representative_hashtags: repHashtags });
  }

  // Step 7: sort and slice
  return results
    .sort((a, b) => b.trend_score - a.trend_score)
    .slice(0, topN);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toTitleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

module.exports = { detectTrends };
