const { createCanvas, loadImage, registerFont } = require("canvas");
const fs = require("fs");
const path = require("path");
const fontkit = require("fontkit"); // used to verify actual font name
const cloudinary = require("./cloudinary");

// Get correct font name using fontkit
const fontPath = path.join(__dirname, "../fonts/AlexBrush-Regular.ttf");
const font = fontkit.openSync(fontPath);
const fontFamily = font.familyName; // likely "Alex Brush"
console.log(`Using font: "${fontFamily}"`);


registerFont(fontPath, { family: "AlexBrush-Regular" });

const generateCertificate = async ({ fullName, courseTitle }) => {
    try {
        const certTemplatePath = path.join(__dirname, "../assets/stravix certificate new.png");
        const image = await loadImage(certTemplatePath);

        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext("2d");

        ctx.drawImage(image, 0, 0);

        // 🧑‍🎓 Full Name
        ctx.font = `100px "AlexBrush-Regular"`;
        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.fillText(fullName, canvas.width / 2, 850);

        // 📘 Course Title with "StraviX" bold
        // 📘 Course Title with "StraviX" bold on the next line
        const baseText = `for successfully completing the ${courseTitle} Course with`;
        const boldText = "StraviX";

        ctx.font = "24px sans-serif";
        const baseWidth = ctx.measureText(baseText).width;
        const boldWidth = ctx.measureText(boldText).width;

        const baseX = canvas.width / 2 - baseWidth / 2;
        const boldX = canvas.width / 2 - boldWidth / 2;

        ctx.textAlign = "left";

        // First line
        ctx.font = "24px sans-serif";
        ctx.fillText(baseText, baseX, 900);

        // Second line (StraviX)
        ctx.font = "bold 24px sans-serif";
        ctx.fillText(boldText, boldX, 940); // 940 places it on the next line


        // Ensure temp folder exists
        const tempDir = path.join(__dirname, "../temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        const fileName = `certificate-${Date.now()}.png`;
        const filePath = path.join(tempDir, fileName);
        fs.writeFileSync(filePath, canvas.toBuffer("image/png"));

        const result = await cloudinary.uploader.upload(filePath, {
            folder: "certificates",
            resource_type: "image",
        });

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return result.secure_url;
    } catch (err) {
        console.error("❌ Certificate generation failed:", err);
        throw new Error("Certificate generation error");
    }
};

module.exports = generateCertificate;
