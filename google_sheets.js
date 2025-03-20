import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// Use API key from environment variable or fallback to your provided key
const API_KEY = process.env.GOOGLE_API_KEY;

// Initialize the Google Sheets API with the API key
const sheets = google.sheets({
  version: 'v4',
  auth: API_KEY,
});

// Get the Spreadsheet ID from environment variables
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID; // Make sure to set this in your .env file or environment
const RANGE = 'C:C'; // Check column C (Usernames)

// Function to check if a username exists in Google Sheets
async function checkGoogleSheet(username) {
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
}

export { checkGoogleSheet };
