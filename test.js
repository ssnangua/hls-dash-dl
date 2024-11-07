const HLS = "https://cdn.theoplayer.com/video/elephants-dream/playlist-single-audio.m3u8";
const DASH =
  "https://dash.akamaized.net/akamai/test/caption_test/ElephantsDream/elephants_dream_480p_heaac5_1_https.mpd";

const Downloader = require("./");

const dl = new Downloader({
  ffmpegPath: "./bin/ffmpeg.exe",
  quality: "highest", // "highest" | "medium" | "lowest"
  concurrency: 5,
  clean: true,
});

// const fs = require("node:fs");
// const logFile = "./log.txt";
// const dl = new Downloader({
//   ffmpegPath: "./bin/ffmpeg.exe",
//   // logger: null, // silence
//   logger: {
//     _groupFlag: false,
//     group(...args) {
//       this._groupFlag = true;
//       fs.appendFileSync(logFile, args.join(" ") + "\n");
//     },
//     groupEnd() {
//       this._groupFlag = false;
//       fs.appendFileSync(logFile, "\n");
//     },
//     log(...args) {
//       fs.appendFileSync(logFile, (this._groupFlag ? "  " : "") + args.join(" ") + "\n");
//     },
//     error(...args) {
//       this.log(...args);
//     },
//   },
// });

// dl.download(DASH, "./DASH.mkv");

dl.download(DASH, "./DASH.mkv", (event, data) => {
  // console.log(event, data);
});

// dl.parse(HLS, "./HLS.mkv").then((video_info) => {
//   console.log(video_info);
//   require("node:fs").writeFileSync("./manifest.json", JSON.stringify(video_info, null, 2));
// });
