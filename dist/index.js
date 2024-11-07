"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } }// src/index.ts
var _os = require('os'); var os = _interopRequireWildcard(_os);
var _path = require('path'); var path = _interopRequireWildcard(_path);
var _fs = require('fs'); var fs = _interopRequireWildcard(_fs);
var _child_process = require('child_process');
var _dasha = require('dasha');
var defaultDlOptions = {
  ffmpegPath: "ffmpeg.exe",
  outDir: path.resolve(os.homedir(), "Downloads"),
  quality: "highest",
  concurrency: 5,
  clean: true,
  logger: console
};
var Downloader = class {
  #options;
  constructor(options) {
    this.#options = Object.assign({}, defaultDlOptions, options);
  }
  async download(url, outFile, handler = () => {
  }) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    const dlVideo = await this.#getDlVideo(url, outFile, handler);
    dlVideo.handler("video_info" /* VIDEO_INFO */, { video_info: dlVideo });
    fs.mkdirSync(dlVideo.tmpDir, { recursive: true });
    (_b = (_a = this.#options) == null ? void 0 : _a.logger) == null ? void 0 : _b.group(`Downloading Video Track (${dlVideo.video[0].quality})...`);
    await this.#downloadTrack(dlVideo.video[0], dlVideo);
    (_d = (_c = this.#options) == null ? void 0 : _c.logger) == null ? void 0 : _d.groupEnd();
    for (let i = 0; i < dlVideo.audio.length; i++) {
      (_f = (_e = this.#options) == null ? void 0 : _e.logger) == null ? void 0 : _f.group(`Downloading Audio Tracks (${i + 1}/${dlVideo.audio.length})...`);
      await this.#downloadTrack(dlVideo.audio[i], dlVideo);
      (_h = (_g = this.#options) == null ? void 0 : _g.logger) == null ? void 0 : _h.groupEnd();
    }
    for (let i = 0; i < dlVideo.text.length; i++) {
      (_j = (_i = this.#options) == null ? void 0 : _i.logger) == null ? void 0 : _j.group(`Downloading Subtitle Tracks (${i + 1}/${dlVideo.text.length})...`);
      await this.#downloadTrack(dlVideo.text[i], dlVideo);
      (_l = (_k = this.#options) == null ? void 0 : _k.logger) == null ? void 0 : _l.groupEnd();
    }
    (_n = (_m = this.#options) == null ? void 0 : _m.logger) == null ? void 0 : _n.group(`Multiplexing Tracks...`);
    await this.#multiplexingTracks(dlVideo);
    (_p = (_o = this.#options) == null ? void 0 : _o.logger) == null ? void 0 : _p.groupEnd();
    if (dlVideo.clean) {
      (_r = (_q = this.#options) == null ? void 0 : _q.logger) == null ? void 0 : _r.log("Clean Temporary Files...");
      fs.rmSync(dlVideo.tmpDir, { recursive: true, force: true });
    }
    (_t = (_s = this.#options) == null ? void 0 : _s.logger) == null ? void 0 : _t.group("Download Complete!");
    (_v = (_u = this.#options) == null ? void 0 : _u.logger) == null ? void 0 : _v.log("Path:", dlVideo.file);
    (_x = (_w = this.#options) == null ? void 0 : _w.logger) == null ? void 0 : _x.groupEnd();
    return dlVideo;
  }
  parse(url, outFile) {
    return this.#getDlVideo(url, outFile);
  }
  async #getDlVideo(url, outFile, handler = () => {
  }) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    (_b = (_a = this.#options) == null ? void 0 : _a.logger) == null ? void 0 : _b.group(`Parsing Manifest...`);
    const body = await fetch(url).then((r) => r.text());
    const manifest = await _dasha.parse.call(void 0, body, url);
    const { videos, audios, subtitles } = manifest.tracks;
    (_d = (_c = this.#options) == null ? void 0 : _c.logger) == null ? void 0 : _d.log("Videos:", videos.map((track) => track.quality).join(", "));
    (_f = (_e = this.#options) == null ? void 0 : _e.logger) == null ? void 0 : _f.log("Audios:", audios.map((track) => `${track.language}`).join(", "));
    (_h = (_g = this.#options) == null ? void 0 : _g.logger) == null ? void 0 : _h.log("Subtitles:", subtitles.map((track) => `${track.language}`).join(", "));
    (_j = (_i = this.#options) == null ? void 0 : _i.logger) == null ? void 0 : _j.groupEnd();
    videos.sort((a, b) => b.bitrate.bps - a.bitrate.bps);
    const qualityIndex = this.#options.quality === "highest" ? 0 : this.#options.quality === "lowest" ? videos.length - 1 : Math.round(videos.length / 2);
    const { dir = this.#options.outDir, name, ext } = path.parse(outFile);
    const tmpDir = path.resolve(dir, name);
    const file = path.resolve(dir, `${name}${ext}`);
    const videoTrack = this.#getDlTrack("video" /* VIDEO */, videos[qualityIndex], qualityIndex, tmpDir);
    const audioTracks = audios.map((track, index) => this.#getDlTrack("audio" /* AUDIO */, track, index, tmpDir));
    const subtitleTracks = subtitles.map((track, index) => this.#getDlTrack("text" /* TEXT */, track, index, tmpDir));
    return {
      ...this.#options,
      url,
      handler,
      manifest,
      video: [videoTrack],
      audio: audioTracks,
      text: subtitleTracks,
      tmpDir,
      name,
      ext,
      file
    };
  }
  #getDlTrack(type, track, trackIndex, tmpDir) {
    const segments = track.segments.map(
      (segment, index) => this.#getDlSegment(type, trackIndex, segment, index, tmpDir)
    );
    const ext = type === "text" /* TEXT */ ? ".srt" : path.extname(segments[0].file);
    const file = path.resolve(tmpDir, `${type}${trackIndex}${ext}`);
    const { bitrate, quality, language, label } = track;
    return { type, segments, file, bitrate, quality, language, label };
  }
  #getDlSegment(type, trackIndex, segment, segmentIndex, tmpDir) {
    const { url } = segment;
    const name = `${type}${trackIndex}_Segment${segmentIndex + 1}`;
    const ext = path.extname(new URL(url).pathname);
    const file = path.resolve(tmpDir, `${name}${ext}`);
    const stat = "waiting" /* WAITING */;
    return { url, file, stat };
  }
  async #downloadTrack(dlTrack, dlVideo) {
    const queue = [];
    let downloaded = 0;
    for (let i = 0; i < dlVideo.concurrency; i++) {
      const task = this.#downloadSegment(dlTrack.segments, () => {
        var _a, _b;
        (_b = (_a = this.#options) == null ? void 0 : _a.logger) == null ? void 0 : _b.log(`${++downloaded}/${dlTrack.segments.length}`);
      });
      queue.push(task);
    }
    await Promise.all(queue);
    await this.#concatSegments(dlTrack, dlVideo);
  }
  async #downloadSegment(dlSegments, onDownloaded) {
    var _a, _b;
    const dlSegment = dlSegments.find(({ stat }) => stat === "waiting" /* WAITING */);
    if (!dlSegment) return;
    try {
      dlSegment.stat = "downloading" /* DOWNLOADING */;
      const response = await fetch(dlSegment.url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(dlSegment.file, buffer);
      dlSegment.stat = "downloaded" /* DOWNLOADED */;
      onDownloaded();
    } catch (error) {
      dlSegment.stat = "waiting" /* WAITING */;
      (_b = (_a = this.#options) == null ? void 0 : _a.logger) == null ? void 0 : _b.error(`${path.basename(dlSegment.file)} download failed: ${error}, retrying...`);
    }
    return this.#downloadSegment(dlSegments, onDownloaded);
  }
  async #concatSegments(dlTrack, dlVideo) {
    var _a, _b, _c, _d;
    const { type, segments, file } = dlTrack;
    if (type === "video" /* VIDEO */ || type === "audio" /* AUDIO */) {
      if (segments.length > 1) {
        (_b = (_a = this.#options) == null ? void 0 : _a.logger) == null ? void 0 : _b.log("Concat Segments...");
        for (let i = 0; i < segments.length; i++) {
          const buffer = fs.readFileSync(segments[i].file);
          fs.appendFileSync(file, buffer);
        }
      } else {
        fs.renameSync(segments[0].file, file);
      }
    } else {
      const args = [];
      let input;
      if (segments.length > 1) {
        (_d = (_c = this.#options) == null ? void 0 : _c.logger) == null ? void 0 : _d.log("Concat Segments...");
        args.push("-f", "concat");
        args.push("-safe", "0");
        const listFile = path.resolve(path.dirname(segments[0].file), "segments.txt");
        const data = segments.map(({ file: file2 }) => `file '${file2.replace(/\\/g, "/")}'`).join("\n");
        fs.writeFileSync(listFile, data);
        input = listFile;
      } else {
        input = segments[0].file;
      }
      args.push("-i", input, "-c:s", "srt", file, "-y");
      await this.#execFFmpeg(args, dlVideo);
    }
  }
  #multiplexingTracks(dlVideo) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const { video: videoTracks, audio: audioTracks, text: subtitleTracks, file } = dlVideo;
    const args = [];
    args.push("-i", videoTracks[0].file);
    audioTracks.forEach((track) => args.push("-i", track.file));
    subtitleTracks.forEach((track) => args.push("-i", track.file));
    (_b = (_a = this.#options) == null ? void 0 : _a.logger) == null ? void 0 : _b.log(`Mapping Video Track...`);
    args.push("-map", "0:v");
    if (audioTracks.length > 0) {
      (_d = (_c = this.#options) == null ? void 0 : _c.logger) == null ? void 0 : _d.log(`Mapping Audio Tracks...`);
      audioTracks.forEach((track, i) => args.push("-map", `${i + 1}:a`));
    } else {
      args.push("-map", "0:a?");
    }
    if (subtitleTracks.length > 0) {
      (_f = (_e = this.#options) == null ? void 0 : _e.logger) == null ? void 0 : _f.log(`Mapping Subtitle Tracks...`);
      const offset = 1 + audioTracks.length;
      subtitleTracks.forEach((track, i) => args.push("-map", `${i + offset}`));
    }
    if (audioTracks.length > 0) {
      (_h = (_g = this.#options) == null ? void 0 : _g.logger) == null ? void 0 : _h.log(`Adding Audio Tracks Metadata...`);
      audioTracks.forEach((track, i) => {
        const kbps = track.bitrate && `${track.bitrate.kbps} kbps`;
        args.push(`-metadata:s:a:${i}`, `language=${track.language}`);
        args.push(`-metadata:s:a:${i}`, `title=${track.label || kbps || ""}`);
      });
    }
    if (subtitleTracks.length > 0) {
      (_j = (_i = this.#options) == null ? void 0 : _i.logger) == null ? void 0 : _j.log(`Adding Subtitle Track Metadata...`);
      subtitleTracks.forEach((track, i) => {
        args.push(`-metadata:s:s:${i}`, `language=${track.language}`);
        args.push(`-metadata:s:s:${i}`, `title=${track.label || ""}`);
      });
    }
    args.push("-c:v", "copy");
    args.push("-c:a", "copy");
    args.push("-c:s", "srt");
    args.push(file, "-y");
    return this.#execFFmpeg(args, dlVideo);
  }
  #execFFmpeg(args, dlVideo) {
    return new Promise((resolve2, reject) => {
      const { dir: cwd, base: command } = path.parse(dlVideo.ffmpegPath);
      const process = _child_process.spawn.call(void 0, command, args, { cwd });
      dlVideo.handler("ffmpeg_spawn" /* FFMPEG_SPAWN */, { process, cwd, command, args });
      process.on("close", (code) => {
        dlVideo.handler("ffmpeg_close" /* FFMPEG_CLOSE */, { code });
        resolve2(code);
      });
      process.on("error", (error) => {
        dlVideo.handler("ffmpeg_error" /* FFMPEG_ERROR */, { error });
        reject(error);
      });
      process.stderr.on("data", (data) => {
        dlVideo.handler("ffmpeg_data" /* FFMPEG_DATA */, { data });
      });
    });
  }
};
var src_default = Downloader;


exports.default = src_default;

module.exports = exports.default;
