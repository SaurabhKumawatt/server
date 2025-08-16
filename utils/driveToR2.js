// utils/driveToR2.js
const { google } = require("googleapis");
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const stream = require("stream");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function fileExistsInR2(key) {
  try {
    await r2.send(new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch (err) {
    if (err.name === "NotFound") return false;
    return false;
  }
}

async function streamToBuffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on("data", (chunk) => chunks.push(chunk));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
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

  const meta = await drive.files.get({ fileId, fields: "name,size,mimeType" });
  if (!meta.data.size) throw new Error(`Unable to determine file size for ${fileId}`);

  const key = `promotional/${fileId}-${fileName}`;
  if (await fileExistsInR2(key)) {
    // console.log(`✅ Skipping upload, already exists: ${key}`);
    return key;
  }

  const fileRes = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );

  // console.log(`⬆️ Converting stream to buffer: ${fileName} (${meta.data.size} bytes)`);
  const buffer = await streamToBuffer(fileRes.data);

  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: meta.data.mimeType,
  }));

  // console.log(`☁ Uploaded to R2: ${key}`);
  return key;
}

module.exports = uploadDriveFileToR2;
