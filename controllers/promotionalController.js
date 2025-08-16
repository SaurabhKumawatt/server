const { google } = require("googleapis");
const { PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const r2 = require("../utils/r2");
const PromotionalMaterial = require("../models/PromotionalMaterial");
const uploadDriveFileToR2 = require("../utils/driveToR2");

exports.streamPromotionalFile = async (req, res) => {
  try {
    const { fileId } = req.params;  // Only fileId is passed now

    if (!fileId) {
      console.error("❌ fileId is required");
      return res.status(400).json({ message: "fileId is required" });
    }

    console.log(`🧐 Request received for fileId: ${fileId}`);

    // Step 1: Fetch file metadata (name, size, mimeType) from Google Drive
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GDRIVE_CLIENT_EMAIL,
        private_key: (process.env.GDRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    // Get metadata for the file
    const meta = await drive.files.get({
      fileId,
      fields: "name,size,mimeType"
    });

    const fileName = meta.data.name;  // Get file name dynamically
    const fileSize = meta.data.size;
    const fileMimeType = meta.data.mimeType;

    console.log(`📦 File name: ${fileName}, size: ${fileSize} bytes, mimeType: ${fileMimeType}`);

    if (!fileSize) {
      console.error(`❌ Unable to determine file size for ${fileId}`);
      throw new Error(`Unable to determine file size for ${fileId}`);
    }

    // Create R2 key based on fileName
    const r2Key = `promotional/${fileName}`;
    console.log(`🔑 R2 key generated: ${r2Key}`);

    // Step 2: Check if file exists in R2
    let existsInR2 = true;
    try {
      await r2.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: r2Key }));
      console.log(`✅ File exists in R2.`);
    } catch (err) {
      console.log(`❌ File does not exist in R2. Proceeding to upload.`);
      existsInR2 = false;
    }

    // Step 3: If file doesn't exist in R2, upload from Google Drive to R2
    if (!existsInR2) {
      console.log(`⬆ Uploading ${fileName} from Google Drive → R2`);

      // Fetch the file stream from Google Drive
      const driveStream = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "stream", timeout: 10 * 60 * 1000 } // 10 min timeout
      );

      // Upload to Cloudflare R2
      await r2.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: r2Key,
          Body: driveStream.data,
          ContentType: fileMimeType,
          ContentLength: parseInt(fileSize, 10),
        })
      );

      console.log(`✅ Uploaded to R2: ${r2Key}`);
    }

    // Step 4: Stream the file from R2 (either newly uploaded or existing)
    console.log(`🔄 Streaming file from R2...`);
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Key,
    });

    const response = await r2.send(command);
    console.log(`✅ File fetched from R2: ${r2Key}`);

    // Set response headers for PDF
    res.setHeader("Content-Type", response.ContentType || "application/pdf");
    res.setHeader("Content-Length", response.ContentLength);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    response.Body.pipe(res); // Stream the file to client
    console.log(`📤 Streaming complete: ${fileName}`);
  } catch (err) {
    console.error("❌ Error streaming/uploading file:", err);
    res.status(500).json({ message: "Failed to process file", error: err.message });
  }
};



exports.syncDriveFolder = async (req, res) => {
  try {
    const { folderId } = req.body;
    if (!folderId) return res.status(400).json({ message: "folderId is required" });

    const parent = await PromotionalMaterial.findOne({ driveFolderId: folderId });
    if (!parent) return res.status(404).json({ message: "Parent not found" });

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GDRIVE_CLIENT_EMAIL,
        private_key: (process.env.GDRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    const drive = google.drive({ version: "v3", auth });

    const driveFiles = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType, thumbnailLink)",
    });

    let created = 0, skipped = 0;

    for (const file of driveFiles.data.files) {
      const exists = await PromotionalMaterial.findOne({ driveFolderId: file.id });
      if (exists) {
        skipped++;
        continue;
      }

      // Upload to R2
      const r2Key = await uploadDriveFileToR2(file.id, file.name);

      await PromotionalMaterial.create({
        title: file.name,
        parent: parent._id,
        type: file.mimeType.startsWith("image/") ? "image" : "video",
        url: r2Key,
        thumbnail: file.thumbnailLink,
        status: "published",
        driveFolderId: file.id,
      });
      created++;
    }

    res.json({ message: "Sync completed", created, skipped });
  } catch (err) {
    console.error("❌ Sync failed:", err.message);
    res.status(500).json({ message: "Sync failed", error: err.message });
  }
};