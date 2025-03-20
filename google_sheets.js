import { google } from 'googleapis';
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/spreadsheets.readonly']
);

const sheets = google.sheets({
  version: 'v4',
  auth,
});
// ID of the Google Sheet (from its URL)
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const RANGE = 'C:C'; // For example, checking column C

export async function checkGoogleSheet(username) {
  try {
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
    });
    const rows = response.data.values || [];
    return rows.flat().map(name => name.trim().toLowerCase()).includes(cleanUsername);
  } catch (error) {
    console.error('❌ Error checking Google Sheet:', error);
    return false;
  }
}
