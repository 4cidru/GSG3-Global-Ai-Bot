const axios = require("axios");

async function checkSafeSearch(url) {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY; // Store your API key in .env
    const apiUrl = "https://safebrowsing.googleapis.com/v4/threatMatches:find?key=" + apiKey;

    const requestBody = {
        client: {
            clientId: "GSG3-GLOBAL-AI-BOT",
            clientVersion: "1.0"
        },
        threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }]
        }
    };

    try {
        const response = await axios.post(apiUrl, requestBody);
        if (response.data.matches) {
            return "⚠️ Warning: This link may be unsafe!";
        } else {
            return "✅ This link appears to be safe.";
        }
    } catch (error) {
        console.error("SafeSearch API Error:", error);
        return "❌ Error checking the link.";
    }
}

module.exports = { checkSafeSearch };
