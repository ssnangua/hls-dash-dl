const HLS = "https://cdn.theoplayer.com/video/elephants-dream/playlist-single-audio.m3u8";
const DASH =
  "https://dash.akamaized.net/akamai/test/caption_test/ElephantsDream/elephants_dream_480p_heaac5_1_https.mpd";

const Downloader = require("./");

const dl = new Downloader({
  ffmpegPath: "./bin/ffmpeg.exe",
  quality: "highest", // "highest" | "medium" | "lowest"
  concurrency: 5,
});

dl.download(DASH, "./DASH.mkv", (event, data) => {
  // console.log(event, data);
});

// dl.parse(HLS, "./HLS.mkv").then((video_info) => {
//   console.log(video_info);
//   require("node:fs").writeFileSync("./manifest.json", JSON.stringify(video_info, null, 2));
// });
