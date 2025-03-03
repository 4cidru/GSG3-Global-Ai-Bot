export async function checkSafeSearch(url) {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
    const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;

    const requestBody = {
        client: { clientId: "GSG3-GLOBAL-AI-BOT", clientVersion: "1.0" },
        threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }]
        }
    };

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        return data.matches ? "⚠️ Warning: This link may be unsafe!" : "✅ This link appears to be safe.";
    } catch (error) {
        console.error("SafeSearch API Error:", error);
        return "❌ Error checking the link.";
    }
}