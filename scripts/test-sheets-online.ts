/**
 * CLI tool to test online connection and reading of Google Spreadsheet.
 * Run with: pnpm tsx --env-file=.env.local scripts/test-sheets-online.ts
 */
import { db } from "../src/server/db";
import { users } from "../src/server/db/schema";
import { testReadSpreadsheet } from "../src/features/sheets-sync/google";

async function main() {
  console.log("====================================================");
  console.log("   TETRA Google Sheets Online Inspection Test");
  console.log("====================================================\n");

  const spreadsheetId =
    process.env.GOOGLE_SPREADSHEET_ID || "1Rup5jNnSu-oTcOlZC3zIN7MNfzHqcP_rNrhnLIsX89Y";
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Wahid";
  const sheetGid = process.env.GOOGLE_SHEET_GID || "1976323691";

  console.log(`Target Spreadsheet ID : ${spreadsheetId}`);
  console.log(`Target Worksheet Name  : ${sheetName}`);
  console.log(`Target Sheet GID       : ${sheetGid}`);
  console.log(`Spreadsheet URL        : https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetGid}\n`);

  // Check available credentials
  console.log("--- Checking Credentials ---");
  const hasServiceAccount =
    !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  console.log(`Service Account Configured : ${hasServiceAccount ? "YES" : "NO"}`);

  const allUsers = await db.select().from(users);
  const usersWithGoogleToken = allUsers.filter((u) => !!u.googleAccessToken);
  console.log(`Users with Google OAuth    : ${usersWithGoogleToken.length} / ${allUsers.length}`);

  let testUserId: string | undefined = undefined;
  if (usersWithGoogleToken.length > 0) {
    testUserId = usersWithGoogleToken[0].id;
    console.log(`Using OAuth token of user  : ${usersWithGoogleToken[0].email} (${usersWithGoogleToken[0].name})`);
  }

  console.log("\n--- Testing Online Reading ---");
  const result = await testReadSpreadsheet({
    userId: testUserId,
    spreadsheetId,
    worksheetName: sheetName,
    sheetGid,
  });

  if (result.ok) {
    console.log("\n✅ SUCCESS: Successfully connected & read online spreadsheet!");
    console.log(`Spreadsheet Title : "${result.spreadsheetTitle}"`);
    console.log(`Auth Method       : ${result.authMethod}`);
    console.log(`Target Sheet      : "${result.targetSheetName}" (GID: ${result.targetSheetGid})`);
    console.log(`Total Tabs Found  : ${result.sheets.length}`);
    console.log(`Available Tabs    : ${result.sheets.map((s) => `"${s.title}" (gid: ${s.id})`).join(", ")}`);
    console.log(`Sample Range      : ${result.sampleRange}`);
    console.log(`Rows Retrieved    : ${result.rowCount}`);
    console.log(`Columns Retrieved : ${result.columnCount}`);

    if (result.sampleValues && result.sampleValues.length > 0) {
      console.log("\n--- Sample Content Preview (First 5 Rows) ---");
      result.sampleValues.slice(0, 5).forEach((row, idx) => {
        console.log(`Row ${idx + 1}: [ ${row.slice(0, 8).map((v) => JSON.stringify(v)).join(", ")} ]`);
      });
    }
  } else {
    console.log("\n❌ NOTICE: Could not read online spreadsheet.");
    console.log(`Auth Method Attempted : ${result.authMethod}`);
    console.log(`Reason / Error        : ${result.error}`);

    if (result.authMethod === "none") {
      console.log("\n💡 HOW TO ENABLE ONLINE READ ACCESS:");
      console.log("Option 1 (Recommended for user sync):");
      console.log("  1. Open http://localhost:3000/login in your browser.");
      console.log("  2. Click 'Continue with Google' and sign in with the Google account");
      console.log("     that has permission to view this spreadsheet.");
      console.log("  3. TETRA will securely store your OAuth access token and read/write your sheets.");
      console.log("\nOption 2 (For server-to-server automated sync):");
      console.log("  Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
      console.log("  in .env.local, and share the Google Sheet with that service account email.");
    }
  }

  console.log("\n====================================================");
  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error running test:", err);
  process.exit(1);
});
