import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

// ✅ Ensure GOOGLE_CREDENTIALS is set
if (!process.env.GOOGLE_CREDENTIALS) {
    console.error("❌ GOOGLE_CREDENTIALS is missing.");
    process.exit(1);
}

// ✅ Decode GOOGLE_CREDENTIALS from Base64
let credentials;
try {
    const decodedCredentials = Buffer.from(process.env.GOOGLE_CREDENTIALS, "base64").toString("utf-8");
    credentials = JSON.parse(decodedCredentials);

    // ✅ Validate credentials
    if (!credentials.private_key || !credentials.client_email) {
        throw new Error("Invalid GOOGLE_CREDENTIALS format.");
    }

    console.log("✅ Successfully loaded Google credentials.");
} catch (error) {
    console.error("❌ Error parsing GOOGLE_CREDENTIALS:", error);
    process.exit(1);
}

// ✅ Initialize Google Sheets API
const sheets = google.sheets({
    version: "v4",
    auth: new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key.replace(/\\n/g, "\n"), // Fixes private key formatting
        ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    ),
});

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const RANGE = "C:C"; // ✅ Check Column C (Usernames)

export async function checkGoogleSheet(username) {
    try {
        const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
        console.log(`🔍 Checking Google Sheets for: "${cleanUsername}"`);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
        });

        const rows = response.data.values || [];
        const sheetUsernames = rows.flat().map(name => name.trim().toLowerCase());

        console.log("📋 [Google Sheets] Retrieved Usernames:", sheetUsernames);

        const isVerified = sheetUsernames.includes(cleanUsername);
        console.log(isVerified ? `✅ ${cleanUsername} IS VERIFIED` : `❌ ${cleanUsername} NOT FOUND`);

        return isVerified;
    } catch (error) {
        console.error("❌ Error checking Google Sheet:", error);
        return false;
    }
}
