/**
 * Similarity Engine — Rethink Admin
 * -----------------------------------------------------------------------------
 * A collection of string comparison algorithms for client-side deduplication.
 */
const SimilarityEngine = {
    /**
     * Main entry point: Calculate a similarity score (0 to 1) between two questions.
     * Takes question objects with { question, options, answer }.
     */
    calculateFullSimilarity(q1, q2) {
        if (!q1 || !q2) return { score: 0 };

        const text1 = q1.question || '';
        const text2 = q2.question || '';
        const opts1 = q1.options || {};
        const opts2 = q2.options || {};

        // 1. Text Similarity (Weighted Jaro-Winkler + Dice)
        const s1 = this.normalize(text1);
        const s2 = this.normalize(text2);

        let textScore = 0;
        if (s1 === s2) {
            textScore = 1.0;
        } else {
            const jw = this.jaroWinkler(s1, s2);
            const dice = this.diceCoefficient(s1, s2);
            textScore = (jw * 0.4) + (dice * 0.6);
        }

        // 2. Options Similarity (Order Independent)
        const optionsScore = this.calculateOptionsSimilarity(opts1, opts2);

        // 3. Answer Similarity (Check if the correct answer text matches)
        const ans1 = opts1[q1.answer] ? this.normalize(opts1[q1.answer]) : '';
        const ans2 = opts2[q2.answer] ? this.normalize(opts2[q2.answer]) : '';
        const answersMatch = (ans1 === ans2 && ans1 !== '') ? 1.0 : (ans1 && ans2 ? this.diceCoefficient(ans1, ans2) : 0);

        // 4. Explanation Similarity
        const exp1 = this.normalize(q1.explanation || '');
        const exp2 = this.normalize(q2.explanation || '');
        let explanationScore = 0;
        const hasExplanations = (exp1.length > 10 && exp2.length > 10);
        if (hasExplanations) {
            explanationScore = (exp1 === exp2) ? 1.0 : this.diceCoefficient(exp1, exp2);
        }

        // 5. Quoted Term Check — extract terms inside quotes from ORIGINAL text
        const sharedQuotedTerm = this.hasSharedQuotedTerm(text1, text2);

        // 6. Final Balanced Score (weights shift when explanations are available)
        let finalScore = 0;
        if (hasExplanations) {
            // 45% Text, 20% Options, 15% Answer, 20% Explanation
            finalScore = (textScore * 0.45) + (optionsScore * 0.20) + (answersMatch * 0.15) + (explanationScore * 0.20);
        } else {
            // 50% Text, 35% Options, 15% Answer Match
            finalScore = (textScore * 0.50) + (optionsScore * 0.35) + (answersMatch * 0.15);
        }

        // 7. Confidence Boost A: If options and answers match perfectly
        if (optionsScore > 0.95 && answersMatch > 0.95 && textScore > 0.65) {
            finalScore = Math.max(finalScore, 0.92);
        }

        // 8. Confidence Boost B: Shared quoted term with option evidence
        if (sharedQuotedTerm && textScore > 0.55 && optionsScore > 0.15) {
            finalScore = Math.max(finalScore, 0.88);
        }

        // 9. Confidence Boost C: High text similarity alone
        if (textScore > 0.85) {
            finalScore = Math.max(finalScore, textScore * 0.95);
        }

        // 10. Confidence Boost D: Identical explanations are a very strong signal
        if (hasExplanations && explanationScore > 0.90 && textScore > 0.50) {
            finalScore = Math.max(finalScore, 0.90);
        }

        // 11. Answer Mismatch Penalty: Different answer text = intentionally different question
        if (answersMatch < 0.3) {
            finalScore = Math.min(finalScore, 0.80);
        }

        return {
            score: finalScore,
            textScore: textScore,
            optionsScore: optionsScore,
            answersMatch: answersMatch,
            explanationScore: explanationScore,
            sharedQuotedTerm: sharedQuotedTerm
        };
    },

    /**
     * Extract terms inside quotes from original (un-normalized) text
     * and check if both questions share any quoted term.
     */
    hasSharedQuotedTerm(text1, text2) {
        const extract = (str) => {
            const terms = [];
            // Match text inside various quote styles: '' "" '' ""
            const regex = /['\u2018\u2019'\u201c\u201d""]([^'\u2018\u2019'\u201c\u201d""]{2,})['\u2018\u2019'\u201c\u201d""]/g;
            let match;
            while ((match = regex.exec(str)) !== null) {
                terms.push(this.normalize(match[1]));
            }
            return terms;
        };

        const terms1 = extract(text1);
        const terms2 = extract(text2);

        if (terms1.length === 0 || terms2.length === 0) return false;

        for (const t1 of terms1) {
            for (const t2 of terms2) {
                if (t1 === t2 || (t1.length > 3 && this.diceCoefficient(t1, t2) > 0.85)) {
                    return true;
                }
            }
        }
        return false;
    },

    /**
     * Compare two sets of options regardless of keys (A, B, C, D).
     */
    calculateOptionsSimilarity(opts1, opts2) {
        const v1 = Object.values(opts1).map(v => this.normalize(v));
        const v2 = Object.values(opts2).map(v => this.normalize(v));

        if (v1.length === 0 || v2.length === 0) return 0;

        let matches = 0;
        const usedIndexes = new Set();

        v1.forEach(val1 => {
            let bestMatchIdx = -1;
            let bestMatchScore = 0;

            v2.forEach((val2, idx2) => {
                if (usedIndexes.has(idx2)) return;

                const score = (val1 === val2) ? 1 : this.diceCoefficient(val1, val2);
                if (score > bestMatchScore && score > 0.8) {
                    bestMatchScore = score;
                    bestMatchIdx = idx2;
                }
            });

            if (bestMatchIdx !== -1) {
                matches += bestMatchScore;
                usedIndexes.add(bestMatchIdx);
            }
        });

        const totalOptions = Math.max(v1.length, v2.length);
        return matches / totalOptions;
    },

    /**
     * Legacy method for backward compatibility
     */
    calculateSimilarity(str1, str2) {
        return this.calculateFullSimilarity({ question: str1 }, { question: str2 }).score;
    },

    /**
     * Clean and normalize string for comparison.
     */
    normalize(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            // Strip leading question numbers (e.g., "1.", "6.", "12)")
            .replace(/^\s*\d+[\.\)\-\u0964]\s*/, '')
            // Remove common punctuation that varies between editors
            .replace(/[।,;:\-\?\!\(\)\"\'\u2018\u2019\u201c\u201d\[\]\{\}]/g, ' ')
            .replace(/[^\w\s\u0980-\u09ff]/g, '')
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
        let p = 0.1;
        let l = 0;
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
        if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 1 : 0;

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
