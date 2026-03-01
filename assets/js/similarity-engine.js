/**
 * Similarity Engine — Rethink Admin
 * -----------------------------------------------------------------------------
 * A collection of string comparison algorithms for client-side deduplication.
 */
const SimilarityEngine = {
    /**
     * Main entry point: Calculate a similarity score (0 to 1) between two strings.
     * Uses a weighted combination of Word Overlap and Jaro-Winkler.
     */
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;

        const s1 = this.normalize(str1);
        const s2 = this.normalize(str2);

        if (s1 === s2) return 1.0;

        // 1. Jaro-Winkler Similarity (Great for typos and slight variations)
        const jwScore = this.jaroWinkler(s1, s2);

        // 2. Word Overlap (Sørensen–Dice coefficient - Great for reordered phrases)
        const diceScore = this.diceCoefficient(s1, s2);

        // Weighted average: Word ordering matters, but character accuracy handles typos.
        return (jwScore * 0.4) + (diceScore * 0.6);
    },

    /**
     * Clean and normalize string for comparison.
     */
    normalize(str) {
        return str
            .toLowerCase()
            .replace(/[^\w\s\u0980-\u09ff]/g, '') // Keep alphanumeric + Bangla Unicode
            .replace(/\s+/g, ' ')
            .trim();
    },

    /**
     * Jaro-Winkler Distance Implementation
     */
    jaroWinkler(s1, s2) {
        let m = 0;
        if (s1.length === 0 || s2.length === 0) return 0;
        if (s1 === s2) return 1;

        let range = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
        let s1Matches = new Array(s1.length).fill(false);
        let s2Matches = new Array(s2.length).fill(false);

        for (let i = 0; i < s1.length; i++) {
            let start = Math.max(0, i - range);
            let end = Math.min(i + range + 1, s2.length);
            for (let j = start; j < end; j++) {
                if (!s2Matches[j] && s1[i] === s2[j]) {
                    s1Matches[i] = true;
                    s2Matches[j] = true;
                    m++;
                    break;
                }
            }
        }

        if (m === 0) return 0;

        let t = 0;
        let k = 0;
        for (let i = 0; i < s1.length; i++) {
            if (s1Matches[i]) {
                while (!s2Matches[k]) k++;
                if (s1[i] !== s2[k]) t++;
                k++;
            }
        }

        let jaro = (m / s1.length + m / s2.length + (m - t / 2) / m) / 3;

        // Winkler adjustment
        let p = 0.1; // scaling factor
        let l = 0; // length of common prefix
        for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
            if (s1[i] === s2[i]) l++;
            else break;
        }

        return jaro + (l * p * (1 - jaro));
    },

    /**
     * Dice Coefficient (Bigram overlap)
     */
    diceCoefficient(s1, s2) {
        const getBigrams = (str) => {
            const bigrams = new Set();
            for (let i = 0; i < str.length - 1; i++) {
                bigrams.add(str.substring(i, i + 2));
            }
            return bigrams;
        };

        const b1 = getBigrams(s1);
        const b2 = getBigrams(s2);

        let intersect = 0;
        for (const item of b1) {
            if (b2.has(item)) intersect++;
        }

        return (2 * intersect) / (b1.size + b2.size);
    }
};
