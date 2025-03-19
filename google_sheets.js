import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, "base64").toString("utf-8"));
const sheets = google.sheets({
    version: "v4",
    auth: new google.auth.JWT(
        credentials.client_email, 
        null, 
        credentials.private_key, 
        ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    )
});

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const RANGE = "C:C"; // ✅ Check usernames in column C

export async function checkGoogleSheet(username) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
        });

        const rows = response.data.values || [];

        // ✅ Debug: Log fetched usernames
        console.log("🔍 Usernames found in Google Sheet:", rows.flat());

        return rows.flat().map(name => name.toLowerCase()).includes(username.toLowerCase()); // Check if username is found
    } catch (error) {
        console.error("❌ Error checking Google Sheet:", error);
        return false;
    }
}
