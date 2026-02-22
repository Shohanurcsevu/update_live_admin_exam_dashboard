const AIService = {
    API_URL: 'api/ai/gemini_proxy.php',

    async scrapeQuestions(images, customPrompt) {
        try {
            const contents = images.map(img => ({
                role: "user",
                parts: [
                    { text: customPrompt },
                    { inlineData: { mimeType: img.mimeType, data: img.base64.split(',')[1] } }
                ]
            }));

            // We send all images at once for context awareness if the API supports it, 
            // or we could loop if context window is an issue.
            // For now, following the user's request to treat them as continuous book pages.

            const payload = {
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: customPrompt },
                            ...images.map(img => ({
                                inlineData: { mimeType: img.mimeType, data: img.base64.split(',')[1] }
                            }))
                        ]
                    }
                ]
            };

            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'AI Scraping failed');
            }

            return await response.json();
        } catch (error) {
            console.error('AIService Error:', error);
            throw error;
        }
    }
};
