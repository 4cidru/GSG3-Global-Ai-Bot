import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

// 🔥 Load Google Credentials Safely
const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS, "base64").toString("utf-8")
);

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
const RANGE = "C:C"; // ✅ Check column C (Usernames)

export async function checkGoogleSheet(username) {
    try {
        // 🔥 Remove @ from username & standardize format
        const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
        console.log(`🔍 Checking Google Sheets for: "${cleanUsername}"`);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
        });

        const rows = response.data.values || [];
        const sheetUsernames = rows.flat().map(name => name.trim().toLowerCase());

        // ✅ Debugging: Show retrieved usernames from the sheet
        console.log("📋 [Google Sheets] Retrieved Usernames:", sheetUsernames);

        const isVerified = sheetUsernames.includes(cleanUsername);
        if (isVerified) {
            console.log(`✅ ${cleanUsername} IS VERIFIED in Google Sheets.`);
        } else {
            console.log(`❌ ${cleanUsername} NOT FOUND in Google Sheets.`);
        }

        return isVerified;
    } catch (error) {
        console.error("❌ Error checking Google Sheet:", error);
        return false;
    }
}
