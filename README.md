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
// handler example
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

### `new Downloader(options?)`

**options**

- `ffmpegPath?` string - FFmpeg executable file path (download [here](https://ffmpeg.org/download.html)). Default by `ffmpeg.exe` (in the `Path` of the system environment variables).
- `outDir?` string - Default output directory. Default by `Downloads` directory.
- `quality?` string - Quality of video to download, can be `highest` | `medium` | `lowest`. Default by `highest`.
- `concurrency?` number - Number of concurrent downloads of segments. Default by `5`.
- `clean?` boolean - Clear temporary files after download is complete. Default by `true`.
- `logger?` console - Custom logger. Default by `console`. Set to `null` for silence.
- `videoCodec?` string - Video Codec. Default by `copy`.
- `audioCodec?` string - Audio Codec. Default by `copy`.
- `subtitleCodec?` string - Subtitle Codec. Default by `srt`.

### `downloader.download(url, outFile, handler?): Promise`

- `url` string - **HLS**(`.m3u8`) or **DASH**(`.mpd`) manifest url.
- `outFile` string - Output file path.
- `handler(event, data)?` Function - Event handler.
  - (`"video_info"`, `{ video_info }`) - Manifest parsed.
  - (`"ffmpeg_spawn"`, `{ process, cwd, command, args }`) - Execute ffmpeg.
  - (`"ffmpeg_close"`, `{ code }`) - ffmpeg closed.
  - (`"ffmpeg_error"`, `{ error }`) - ffmpeg error.
  - (`"ffmpeg_data"`, `{ data }`) - ffmpeg stderr data.

Resolves with `video_info`.

### `downloader.parse(url, outFile): Promise`

- `url` string - **HLS**(`.m3u8`) or **DASH**(`.mpd`) manifest url.
- `outFile` string - Output file path.

Resolves with `video_info`.

### `video_info`

```javascript
{
  ffmpegPath: './bin/ffmpeg.exe',
  outDir: 'C:\\Users\\ssnangua\\Downloads',
  quality: 'highest',
  videoCodec: 'copy',
  audioCodec: 'copy',
  subtitleCodec: 'srt',
  concurrency: 5,
  clean: true,
  logger: { /*...*/ },
  url: 'https://.../*.mpd',
  handler: (event, data) => { /*...*/ },
  manifest: { /*...*/ }, // dasha library Manifest object
  video: [
    {
      type: 'video',
      segments: [
        {
          url: 'https://.../*.mp4',
          file: 'E:\\GitHub\\hls-dash-dl\\DASH\\video0_Segment1.mp4',
          stat: 'waiting'
        },
        /*...*/
      ],
      file: 'E:\\GitHub\\hls-dash-dl\\DASH\\video0.mp4',
      bitrate: { /*...*/ },,
      quality: '480p',
      language: '',
      label: undefined
    }
  ],
  audio: [
    {
      type: 'audio',
      segments: [
        {
          url: 'https://.../*.mp4',
          file: 'E:\\GitHub\\hls-dash-dl\\DASH\\audio0_Segment1.mp4',
          stat: 'waiting'
        },
        /*...*/
      ],
      file: 'E:\\GitHub\\hls-dash-dl\\DASH\\audio0.mp4',
      bitrate: { /*...*/ },,
      quality: undefined,
      language: 'en',
      label: undefined
    },
    /*...*/
  ],
  text: [ // subtitle
    {
      type: 'text',
      segments: [
        {
          url: 'https://.../*.vtt',
          file: 'E:\\GitHub\\hls-dash-dl\\DASH\\text0_Segment1.vtt',
          stat: 'waiting'
        },
        /*...*/
      ],
      file: 'E:\\GitHub\\hls-dash-dl\\DASH\\text0.vtt',
      bitrate: { /*...*/ },
      quality: undefined,
      language: 'en',
      label: undefined
    },
    /*...*/
  ],
  tmpDir: 'E:\\GitHub\\hls-dash-dl\\DASH',
  name: 'DASH',
  ext: '.mkv',
  file: 'E:\\GitHub\\hls-dash-dl\\DASH.mkv'
}
```

## See Also

[dasha](https://github.com/vitalygashkov/dasha)
