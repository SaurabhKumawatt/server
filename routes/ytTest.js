const ytdl = require("ytdl-core");

const url = "https://www.youtube.com/watch?v=Zq_RsBgod8g";

ytdl(url)
  .on("error", (err) => console.error("❌ STREAM ERROR:", err.message))
  .pipe(require("fs").createWriteStream("video.mp4"));
