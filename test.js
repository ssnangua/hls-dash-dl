const HLS = "https://cdn.theoplayer.com/video/elephants-dream/playlist-single-audio.m3u8";
const DASH =
  "https://dash.akamaized.net/akamai/test/caption_test/ElephantsDream/elephants_dream_480p_heaac5_1_https.mpd";

const Downloader = require("./");

// const dl = new Downloader({
//   ffmpegPath: "./bin/ffmpeg.exe",
//   // quality: "highest", // "highest" | "medium" | "lowest"
//   // concurrency: 5,
//   // videoCodec: "copy",
//   // audioCodec: "copy",
//   // subtitleCodec: "srt",
//   // clean: true,
//   // logger: null,
// });

const fs = require("node:fs");
const logFile = "./log.txt";
const dl = new Downloader({
  ffmpegPath: "./bin/ffmpeg.exe",
  // logger: null, // silence
  logger: {
    _groupFlag: false,
    group(...args) {
      this._groupFlag = true;
      fs.appendFileSync(logFile, args.join(" ") + "\n");
    },
    groupEnd() {
      this._groupFlag = false;
    },
    log(...args) {
      fs.appendFileSync(logFile, (this._groupFlag ? "  " : "") + args.join(" ") + "\n");
    },
    error(...args) {
      this.log(...args);
    },
  },
});

// dl.download(DASH, "./DASH.mkv").then((video_info) => {
//   console.log(video_info);
// });

dl.download(DASH, "./DASH.mkv", (event, data) => {
  if (event === "video_info") {
    const { video_info } = data;
  } else if (event === "ffmpeg_spawn") {
    const { process, cwd, command, args } = data;
  } else if (event === "ffmpeg_data") {
    // console.log(`Stderr: ${data.data}`);
  } else if (event === "ffmpeg_close") {
    const { code } = data;
  } else if (event === "ffmpeg_error") {
    const { error } = data;
  }
});

// dl.parse(HLS, "./HLS.mkv").then((video_info) => {
//   console.log(video_info);
//   // require("node:fs").writeFileSync("./manifest.json", JSON.stringify(video_info, null, 2));
// });
