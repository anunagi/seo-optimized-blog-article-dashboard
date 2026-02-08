import { google } from 'googleapis';
import { Readable } from 'stream';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export async function saveToDrive(content: string, filename: string): Promise<string> {
    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!credentialsJson) {
        console.warn("GOOGLE_SERVICE_ACCOUNT_JSON is not set. Skipping Drive upload.");
        return "skipped-no-credentials";
    }

    try {
        const credentials = JSON.parse(credentialsJson);

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: SCOPES,
        });

        const drive = google.drive({ version: 'v3', auth });

        const fileMetadata = {
            name: filename,
            mimeType: 'application/vnd.google-apps.document', // Save as Google Doc
        };

        const media = {
            mimeType: 'text/markdown',
            body: Readable.from([content]),
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        return response.data.webViewLink || "";
    } catch (error) {
        console.error("Google Drive upload error:", error);
        // Fallback or rethrow?
        // For now returning empty string to signal failure
        return "";
    }
}
