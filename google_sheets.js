import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

let checkGoogleSheet;

try {
  // Decode base64-encoded credentials from environment variable
  const decodedCredentials = Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf-8');

  // Parse JSON credentials
  const credentials = JSON.parse(decodedCredentials);

  // Initialize Google Sheets API
  const sheets = google.sheets({
    version: 'v4',
    auth: new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key.replace(/\\n/g, '\n'), // Fix line breaks in private key
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    )
  });

  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
  const RANGE = 'C:C'; // Check column C (Usernames)

  // Function to check if a username exists in Google Sheets
  checkGoogleSheet = async function (username) {
    try {
      const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE,
      });

      const rows = response.data.values || [];
      console.log('🔍 [Google Sheets] Usernames Found:', rows.flat());

      return rows.flat().map(name => name.trim().toLowerCase()).includes(cleanUsername);
    } catch (error) {
      console.error('❌ Error checking Google Sheet:', error);
      return false;
    }
  };

} catch (error) {
  console.error('❌ Error parsing GOOGLE_CREDENTIALS:', error);
  // Fallback function in case of credential parsing error
  checkGoogleSheet = async (username) => false;
}

export { checkGoogleSheet };
