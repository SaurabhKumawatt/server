// utils/driveToR2.js
const { google } = require("googleapis");
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

// Check if file already exists in R2
async function fileExistsInR2(key) {
  try {
    await r2.send(new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key
    }));
    return true; // exists
  } catch (err) {
    if (err.name === "NotFound") return false;
    throw err;
  }
}

async function uploadDriveFileToR2(fileId, fileName) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GDRIVE_CLIENT_EMAIL,
      private_key: (process.env.GDRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const drive = google.drive({ version: "v3", auth });

  // 1️⃣ Get metadata
  const meta = await drive.files.get({ fileId, fields: "name,size,mimeType" });
  if (!meta.data.size) throw new Error(`Unable to determine file size for ${fileId}`);
  console.log(`📦 File size: ${meta.data.size} bytes, type: ${meta.data.mimeType}`);

  // 2️⃣ Key naming based on fileId (so same file won't re-upload)
  const key = `promotional/${fileId}-${fileName}`;

  // 3️⃣ Check if already exists
  if (await fileExistsInR2(key)) {
    console.log(`✅ Skipping upload, already exists in R2: ${key}`);
    return key;
  }

  // 4️⃣ Get stream from Drive
  const fileRes = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream", timeout: 10 * 60 * 1000 }
  );

  // 5️⃣ Upload to R2
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: fileRes.data,
    ContentType: meta.data.mimeType,
    ContentLength: parseInt(meta.data.size, 10)
  }));

  console.log(`☁ Uploaded to R2: ${key}`);
  return key;
}

module.exports = uploadDriveFileToR2;
