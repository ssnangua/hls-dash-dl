const Downloader = require("./");

const dl = new Downloader({
  ffmpegPath: "./bin/ffmpeg.exe",
  gpacPath: "C:/Program Files/GPAC/gpac.exe",
  quality: "lowest", // "highest" | "medium" | "lowest"
  // concurrency: 5,
  // videoCodec: "copy",
  // audioCodec: "copy",
  // subtitleCodec: "srt",
  // clean: true,
  // logger: null,
});

dl.download(
  {
    url: "https://media.axprod.net/TestVectors/v7-MultiDRM-SingleKey/Manifest_1080p.mpd",
    keys: "9eb4050de44b4802932e27d75083e266:166634c675823c235a4a9446fad52e4d",
  },
  "./dashif.mkv"
);

// dl.download(
//   {
//     url: "https://cdn.bitmovin.com/content/assets/art-of-motion_drm/mpds/11331.mpd",
//     keys: [
//       "ccbf5fb4c2965be7aa130ffb3ba9fd73:9cc0c92044cb1d69433f5f5839a159df",
//       "9bf0e9cf0d7b55aeb4b289a63bab8610:90f52fd8ca48717b21d0c2fed7a12ae1",
//       "eb676abbcb345e96bbcf616630f1a3da:100b6c20940f779a4589152b57d2dacb",
//       "0294b9599d755de2bbf0fdca3fa5eab7:3bda2f40344c7def614227b9c0f03e26",
//       "639da80cf23b55f3b8cab3f64cfa5df6:229f5f29b643e203004b30c4eaf348f4",
//     ],
//   },
//   "./bitmovin.mkv"
// );

// dl.parse(
//   {
//     url: "https://media.axprod.net/TestVectors/v7-MultiDRM-SingleKey/Manifest_1080p.mpd",
//     keys: "9eb4050de44b4802932e27d75083e266:166634c675823c235a4a9446fad52e4d",
//   },
//   "./decrypt.mkv"
// ).then((video_info) => {
//   // console.log(video_info);
//   require("node:fs").writeFileSync("./manifest.json", JSON.stringify(video_info, null, 2));
// });
