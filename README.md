# hls-dash-dl

**HLS**(`.m3u8`) and **DASH**(`.mpd`) video streaming download tool.

Supports **multiple** audio tracks and **multiple** subtitle tracks.

## Install

```bash
npm install hls-dash-dl
```

## Usage

```javascript
const HLS = "https://cdn.theoplayer.com/video/elephants-dream/playlist-single-audio.m3u8";
const DASH = "https://dash.akamaized.net/akamai/test/caption_test/ElephantsDream/elephants_dream_480p_heaac5_1_https.mpd";

const Downloader = require("hls-dash-dl");

const dl = new Downloader({
  ffmpegPath: "./bin/ffmpeg.exe",
  // quality: "highest", // "highest" | "medium" | "lowest"
  // concurrency: 5,
  // videoCodec: "copy",
  // audioCodec: "copy",
  // subtitleCodec: "srt",
  // clean: true,
});

dl.download(DASH, "./DASH.mkv").then((video_info) => {
  console.log(video_info);
});

dl.parse(HLS, "./HLS.mkv").then((video_info) => {
  console.log(video_info);
});
```

```javascript
// decrypt example
const dl = new Downloader({
  ffmpegPath: "./bin/ffmpeg.exe",
  gpacPath: "C:/Program Files/GPAC/gpac.exe",
});

dl.download(
  {
    url: "https://cdn.bitmovin.com/content/assets/art-of-motion_drm/mpds/11331.mpd",
    keys: [
      "ccbf5fb4c2965be7aa130ffb3ba9fd73:9cc0c92044cb1d69433f5f5839a159df",
      "9bf0e9cf0d7b55aeb4b289a63bab8610:90f52fd8ca48717b21d0c2fed7a12ae1",
      "eb676abbcb345e96bbcf616630f1a3da:100b6c20940f779a4589152b57d2dacb",
      "0294b9599d755de2bbf0fdca3fa5eab7:3bda2f40344c7def614227b9c0f03e26",
      "639da80cf23b55f3b8cab3f64cfa5df6:229f5f29b643e203004b30c4eaf348f4",
    ],
  },
  "./bitmovin.mkv"
);
```

```javascript
// handler example
let childProcess;
dl.download(DASH, "./DASH.mkv", (event, data) => {
  if (event === "video_info") {
    const { video_info } = data;
  } else if (event === "child_process_spawn") {
    const { process, cwd, command, args } = data;
    childProcess = process;
  } else if (event === "child_process_close") {
    const { code } = data;
    childProcess = null;
  } else if (event === "child_process_error") {
    const { error } = data;
    childProcess = null;
  }
});
```

```javascript
// logger example
const fs = require("node:fs");
const logFile = "./log.txt";
const dl = new Downloader({
  ffmpegPath: "./bin/ffmpeg.exe",
  // logger: console, // default
  // logger: null, // silence
  logger: {
    indentSize: 2,
    indent: 0,
    group(...args) {
      this.indent += 1;
      fs.appendFileSync(logFile, args.join(" ") + "\n");
    },
    groupEnd() {
      this.indent -= 1;
    },
    log(...args) {
      fs.appendFileSync(logFile, " ".repeat(this.indent * this.indentSize) + args.join(" ") + "\n");
    },
    error(...args) {
      this.log(...args);
    },
  },
});
```

## API

### `new Downloader(config?)`

**config**

- `ffmpegPath?` string - FFmpeg executable file path (download [here](https://ffmpeg.org/download.html)). Default by `ffmpeg` (in the `Path` of the system environment variables). For decrypting and muxing tracks.
- `gpacPath?` string - GPAC executable file path (download [here](https://gpac.io/downloads/gpac-nightly-builds/)). Default by `gpac` (in the `Path` of the system environment variables). For extracting WVTT/TTML subtitle tracks.
- `outDir?` string - Default output directory. Default by `Downloads` directory.
- `quality?` string - Quality of video to download, can be `highest` | `medium` | `lowest`. Default by `highest`.
- `concurrency?` number - Number of concurrent downloads of segments. Default by `5`.
- `videoCodec?` string - Video Codec. Default by `copy`.
- `audioCodec?` string - Audio Codec. Default by `copy`.
- `subtitleCodec?` string - Subtitle Codec. Default by `srt`.
- `clean?` boolean - Clear temporary files after download is complete. Default by `true`.
- `logger?` console - Custom logger. Default by `console`. Set to `null` for silence.

### `downloader.download(manifest, outFile, handler?): Promise`

- `manifest` - **HLS**(`.m3u8`) or **DASH**(`.mpd`) manifest info.
  - string - Manifest url or content text.
  - { url?, text?, keys? } - With decryption key(s).
    - `url?` string - Manifest url.
    - `text?` string - Manifest content text.
    - `keys?` string | string[] - Decryption key(s).
- `outFile` string - Output file path.
- `handler(event, data)?` Function - Event handler.
  - (`"video_info"`, `{ video_info }`) - Manifest parsed.
  - (`"child_process_spawn"`, `{ process, cwd, command, args }`) - Spawn child process (FFmpeg or GPAC).
  - (`"child_process_close"`, `{ code }`) - child process closed.
  - (`"child_process_error"`, `{ error }`) - child process error.
  - (`"child_process_stdout"`, `{ data }`) - child process stdout data.
  - (`"child_process_stderr"`, `{ data }`) - child process stderr data.

Resolves with `video_info`.

### `downloader.parse(manifest, outFile): Promise`

- `manifest` string | { url?, text?, keys? } - **HLS**(`.m3u8`) or **DASH**(`.mpd`) manifest info.
- `outFile` string - Output file path.

Resolves with `video_info`.

### `video_info`

```javascript
{
  // config
  ffmpegPath: './bin/ffmpeg.exe',
  gpacPath: 'C:/Program Files/GPAC/gpac.exe',
  outDir: 'C:\\Users\\ssnangua\\Downloads',
  quality: 'highest',
  concurrency: 5,
  videoCodec: 'copy',
  audioCodec: 'copy',
  subtitleCodec: 'srt',
  clean: true,
  logger: { /*...*/ },

  // manifest
  url: 'https://.../*.mpd',
  text: '/*...*/', // *.mpd file content
  keys: [/*...*/], // decryption keys
  manifest: { /*...*/ }, // dasha library Manifest object

  // output
  dir: 'E:\\GitHub\\hls-dash-dl',
  name: 'DASH',
  ext: '.mkv',
  file: 'E:\\GitHub\\hls-dash-dl\\DASH.mkv'
  tmpDir: 'E:\\GitHub\\hls-dash-dl\\tmp-DASH',
  handler: (event, data) => { /*...*/ },

  // tracks
  video: [
    {
      // attributes
      type: 'video',
      codec: 'H.264',
      bitrate: { /*...*/ },
      quality: '480p',
      language: '',
      label: undefined,
      fps: 24,
      defaultKeyId: '9eb4050de44b4802932e27d75083e266',
      // segments
      segments: [
        {
          url: 'https://.../*.mp4',
          tmpDir: 'E:\\GitHub\\hls-dash-dl\\tmp-DASH',
          name: 'video0_Segment0',
          ext: '.mp4',
          file: 'E:\\GitHub\\hls-dash-dl\\tmp-DASH\\video0_Segment0.mp4',
          stat: 'waiting',
        },
        /*...*/
      ],
      // output
      tmpDir: 'E:\\GitHub\\hls-dash-dl\\tmp-DASH',
      name: 'video0_1080p_H.264', // [type][index]_[quality]_[codec]
      ext: '.mp4',
      file: 'E:\\GitHub\\hls-dash-dl\\tmp-DASH\\video0_1080p_H.264.mp4',
    }
  ],
  audio: [
    {
      // attributes
      type: 'audio',
      codec: 'AAC',
      bitrate: { /*...*/ },
      quality: undefined,
      language: 'en',
      label: undefined,
      defaultKeyId: "9eb4050de44b4802932e27d75083e266",
      // segments
      segments: [
        {
          url: 'https://.../*.mp4',
          tmpDir: 'E:\\GitHub\\hls-dash-dl\\tmp-DASH',
          name: 'audio0_Segment0',
          ext: '.mp4',
          file: 'E:\\GitHub\\hls-dash-dl\\tmp-DASH\\audio0_Segment0.mp4',
          stat: 'waiting',
        },
        /*...*/
      ],
      // output
      tmpDir: 'E:\\GitHub\\hls-dash-dl\\tmp-DASH',
      name: 'audio0_en_AAC', // [type][index]_[language]_[codec]
      ext: '.mp4',
      file: 'E:\\GitHub\\hls-dash-dl\\tmp-DASH\\audio0_en_AAC.mp4',
    },
    /*...*/
  ],
  subtitle: [
    {
      // attributes
      type: 'subtitle',
      codec: 'VTT',
      bitrate: { /*...*/ },
      quality: undefined,
      language: 'en',
      label: undefined,
      // segments
      segments: [
        {
          url: 'https://.../*.vtt',
          tmpDir: 'E:\\GitHub\\hls-dash-dl\\tmp-DASH',
          name: 'subtitle0_Segment0',
          ext: '.vtt',
          file: 'E:\\GitHub\\hls-dash-dl\\tmp-DASH\\subtitle0_Segment0.vtt',
          stat: 'waiting',
        },
        /*...*/
      ],
      // output
      tmpDir: 'E:\\GitHub\\hls-dash-dl\\tmp-DASH',
      name: 'subtitle0_en_VTT', // [type][index]_[language]_[codec]
      ext: '.vtt',
      file: 'E:\\GitHub\\hls-dash-dl\\tmp-DASH\\subtitle0_en_VTT.vtt',
    },
    /*...*/
  ]
}
```

## See Also

[dasha](https://github.com/vitalygashkov/dasha)
