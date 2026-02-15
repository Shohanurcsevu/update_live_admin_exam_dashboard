/**
 * CacheManager - Centralized utility for handling API caching on the client side.
 * Reduces server hits by storing response data in localStorage with an expiration time.
 */
window.CacheManager = (function () {
    'use strict';

    const CACHE_PREFIX = 'rethink_cache_';

    /**
     * Fetch with cache support
     * @param {string} url The API URL to fetch
     * @param {number} ttlMinutes Time to live in minutes
     * @param {boolean} forceRefresh If true, bypasses cache and fetches fresh data
     * @returns {Promise<any>} The response data
     */
    async function fetchWithCache(url, ttlMinutes = 5, forceRefresh = false) {
        const cacheKey = CACHE_PREFIX + btoa(url);

        if (!forceRefresh) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const { data, expiry } = JSON.parse(cached);
                    if (Date.now() < expiry) {
                        console.log(`%c[CacheManager] Hit for ${url}`, 'color: #10b981; font-weight: bold;');
                        return data;
                    }
                    console.log(`%c[CacheManager] Expired for ${url}`, 'color: #f59e0b; font-weight: bold;');
                } catch (e) {
                    console.error('[CacheManager] Parse error', e);
                }
            }
        }

        console.log(`%c[CacheManager] Fetching ${url}`, 'color: #3b82f6; font-weight: bold;');
        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            const cacheData = {
                data: result.data || result, // Handle both {success, data} and raw data patterns
                expiry: Date.now() + (ttlMinutes * 60 * 1000)
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            return cacheData.data;
        } else {
            throw new Error(result.message || 'API request failed');
        }
    }

    /**
     * Clear specific cache entry or all rethinking caches
     * @param {string|null} url If provided, clears only this URL's cache
     */
    function clearCache(url = null) {
        if (url) {
            localStorage.removeItem(CACHE_PREFIX + btoa(url));
        } else {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(CACHE_PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
        }
    }

    return {
        fetchWithCache,
        clearCache
    };
})();
