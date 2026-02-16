/**
 * CacheManager - Centralized utility for handling API caching on the client side.
 * Reduces server hits by storing response data in localStorage with an expiration time.
 */
window.CacheManager = (function () {
    'use strict';

    const CACHE_PREFIX = 'rethink_cache_';

    // Helper for UTF-8 safe base64 encoding (e.g. for Bengali characters in URLs)
    const safeBtoa = (str) => btoa(unescape(encodeURIComponent(str)));
    const safeAtob = (str) => decodeURIComponent(escape(atob(str)));

    /**
     * Fetch with cache support
     * @param {string} url The API URL to fetch
     * @param {number} ttlMinutes Time to live in minutes
     * @param {boolean} forceRefresh If true, bypasses cache and fetches fresh data
     * @param {boolean} skipRevalidate Internal flag to prevent infinite loops during background refresh
     * @returns {Promise<any>} The response data
     */
    async function fetchWithCache(url, ttlMinutes = 5, forceRefresh = false, skipRevalidate = false, returnFullResponse = false) {
        const cacheKey = CACHE_PREFIX + safeBtoa(url);
        let cachedData = null;

        if (!forceRefresh) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsedCache = JSON.parse(cached);
                    const { data, expiry } = parsedCache;

                    if (Date.now() < expiry) {
                        console.log(`%c[CacheManager] Hit for ${url}`, 'color: #10b981; font-weight: bold;');

                        // --- SWR Pattern: Trigger background fetch to ensure freshness ---
                        if (!skipRevalidate) {
                            revalidateInBackground(url, ttlMinutes, data, returnFullResponse);
                        }

                        // Use returnFullResponse flag to determine what to return
                        if (returnFullResponse) {
                            if (parsedCache.fullResponse) {
                                return parsedCache.fullResponse;
                            }
                            // If full response requested but not in cache, treat as miss
                            console.log(`%c[CacheManager] Full response missing for ${url}, refreshing`, 'color: #f59e0b;');
                        } else {
                            return data;
                        }
                    }
                    console.log(`%c[CacheManager] Expired for ${url}`, 'color: #f59e0b; font-weight: bold;');
                    cachedData = returnFullResponse && parsedCache.fullResponse ? parsedCache.fullResponse : data; // Keep stale data just in case fetch fails
                } catch (e) {
                    console.error('[CacheManager] Parse error', e);
                    // clear corrupt cache
                    localStorage.removeItem(cacheKey);
                }
            }
        }

        try {
            console.log(`%c[CacheManager] Fetching ${url}`, 'color: #3b82f6; font-weight: bold;');
            const response = await fetch(url);
            const result = await response.json();

            // We cache regardless of success if we got a valid JSON response
            // But we usually only want to cache SUCCESSFUL data responses.
            // For now, let's stick to the existing logic which checks for success.
            if (result.success || result.data || Array.isArray(result)) {
                const data = result.data || result;

                const cacheData = {
                    data: data,
                    fullResponse: result, // Store the full response
                    expiry: Date.now() + (ttlMinutes * 60 * 1000)
                };
                localStorage.setItem(cacheKey, JSON.stringify(cacheData));

                return returnFullResponse ? result : data;
            } else {
                throw new Error(result.message || 'API request failed');
            }
        } catch (error) {
            if (cachedData) {
                console.warn(`%c[CacheManager] Fetch failed for ${url}, returning stale data`, 'color: #ef4444;');
                return cachedData;
            }
            throw error;
        }
    }

    /**
     * SWR: Fetches in background and notifies UI if data changed
     */
    async function revalidateInBackground(url, ttlMinutes, currentData) {
        try {
            const response = await fetch(url);
            const result = await response.json();
            const newData = result.data || result;

            if (JSON.stringify(newData) !== JSON.stringify(currentData)) {
                console.log(`%c[CacheManager] SWR: Data updated for ${url}`, 'color: #8b5cf6; font-weight: bold;');
                const cacheData = {
                    data: newData,
                    expiry: Date.now() + (ttlMinutes * 60 * 1000)
                };
                localStorage.setItem(CACHE_PREFIX + btoa(url), JSON.stringify(cacheData));

                // Notify UI that data has changed
                document.dispatchEvent(new CustomEvent('cache-revalidated', {
                    detail: { url, data: newData }
                }));
            }
        } catch (e) {
            // Background revalidation failed - ignore silently to not disturb user
        }
    }

    /**
     * Clear specific cache entry or all rethinking caches
     * @param {string|null} url If provided, clears only this URL's cache
     */
    function clearCache(url = null) {
        if (url) {
            localStorage.removeItem(CACHE_PREFIX + safeBtoa(url));
        } else {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(CACHE_PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
        }
    }

    /**
     * Clear all cache entries containing a specific keyword (group-based invalidation)
     * @param {string} keyword e.g. 'analytics', 'dashboard', 'exam'
     */
    function clearGroup(keyword) {
        console.log(`%c[CacheManager] Clearing group: ${keyword}`, 'color: #ef4444; font-weight: bold;');
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(CACHE_PREFIX)) {
                // Since we use btoa for keys, we need to check if the decodable URL contains the keyword
                try {
                    const encodedUrl = key.replace(CACHE_PREFIX, '');
                    const url = safeAtob(encodedUrl);
                    if (url.includes(keyword)) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    // Fallback: If it's not valid btoa or other issue, just skip it
                }
            }
        });
    }

    return {
        fetchWithCache,
        clearCache,
        clearGroup
    };
})();
