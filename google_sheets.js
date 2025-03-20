// google_sheets.js (API Key Version)
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// Just read the API key as a raw string
const API_KEY = process.env.GOOGLE_API_KEY;

// Create a sheets client using the API key
const sheets = google.sheets({
  version: 'v4',
  auth: API_KEY,
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
