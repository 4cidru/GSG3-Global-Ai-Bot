import { google } from 'googleapis';

const SHEET_ID = process.env.SPREADSHEET_ID; // Replace with actual Sheet ID
const RANGE = 'C:C'; // Column A contains usernames

async function getGoogleAuth() {
    const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf8'));
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    return await auth.getClient();
}

export async function checkGoogleSheet(username) {
    try {
        const auth = await getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: RANGE
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log("🔴 No usernames found in Google Sheet.");
            return false;
        }

        return rows.some(row => row[0].toLowerCase() === username.toLowerCase());
    } catch (error) {
        console.error("❌ Error accessing Google Sheets:", error);
        return false;
    }
}
