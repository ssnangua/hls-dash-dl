"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } }// src/index.ts
var _os = require('os'); var os = _interopRequireWildcard(_os);
var _path = require('path'); var path = _interopRequireWildcard(_path);
var _fs = require('fs'); var fs = _interopRequireWildcard(_fs);
var _child_process = require('child_process');
var _dasha = require('dasha');
var defaultDlOptions = {
  ffmpegPath: process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  outDir: path.resolve(os.homedir(), "Downloads"),
  quality: "highest",
  concurrency: 5,
  videoCodec: "copy",
  audioCodec: "copy",
  subtitleCodec: "srt",
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
    const { logger } = this.#options;
    const dlVideo = await this.#getDlVideo(url, outFile, handler);
    dlVideo.handler("video_info" /* VIDEO_INFO */, { video_info: dlVideo });
    fs.mkdirSync(dlVideo.tmpDir, { recursive: true });
    logger == null ? void 0 : logger.group(`Downloading Video Track (${dlVideo.video[0].quality})...`);
    await this.#downloadTrack(dlVideo.video[0], dlVideo);
    logger == null ? void 0 : logger.groupEnd();
    for (let i = 0; i < dlVideo.audio.length; i++) {
      logger == null ? void 0 : logger.group(`Downloading Audio Tracks (${i + 1}/${dlVideo.audio.length})...`);
      await this.#downloadTrack(dlVideo.audio[i], dlVideo);
      logger == null ? void 0 : logger.groupEnd();
    }
    for (let i = 0; i < dlVideo.subtitle.length; i++) {
      logger == null ? void 0 : logger.group(`Downloading Subtitle Tracks (${i + 1}/${dlVideo.subtitle.length})...`);
      await this.#downloadTrack(dlVideo.subtitle[i], dlVideo);
      logger == null ? void 0 : logger.groupEnd();
    }
    logger == null ? void 0 : logger.group(`Multiplexing Tracks...`);
    await this.#multiplexingTracks(dlVideo);
    logger == null ? void 0 : logger.groupEnd();
    if (dlVideo.clean) {
      logger == null ? void 0 : logger.log("Clean Temporary Files...");
      fs.rmSync(dlVideo.tmpDir, { recursive: true, force: true });
    }
    logger == null ? void 0 : logger.group("Download Complete!");
    logger == null ? void 0 : logger.log("Path:", dlVideo.file);
    logger == null ? void 0 : logger.groupEnd();
    return dlVideo;
  }
  parse(url, outFile) {
    return this.#getDlVideo(url, outFile);
  }
  async #getDlVideo(url, outFile, handler = () => {
  }) {
    const { logger } = this.#options;
    let { dir, name, ext } = path.parse(outFile);
    dir ||= this.#options.outDir;
    const tmpDir = path.resolve(dir, `tmp-${name}`);
    const file = path.resolve(dir, `${name}${ext}`);
    logger == null ? void 0 : logger.group(`Parsing Manifest...`);
    logger == null ? void 0 : logger.log("URL:", url);
    logger == null ? void 0 : logger.log("Path:", file);
    const body = await fetch(url).then((r) => r.text());
    const manifest = await _dasha.parse.call(void 0, body, url);
    const { videos, audios, subtitles } = manifest.tracks;
    logger == null ? void 0 : logger.group(`Tracks:`);
    logger == null ? void 0 : logger.log("Videos:", videos.map((track) => track.quality).join(", "));
    logger == null ? void 0 : logger.log("Audios:", audios.map((track) => `${track.language}`).join(", "));
    logger == null ? void 0 : logger.log("Subtitles:", subtitles.map((track) => `${track.language}`).join(", "));
    logger == null ? void 0 : logger.groupEnd();
    logger == null ? void 0 : logger.groupEnd();
    const compareString = (a, b) => {
      return (a && !b ? -1 : !a && b ? 1 : a && b && a.localeCompare(b, void 0, { numeric: true })) || 0;
    };
    videos.sort((a, b) => b.bitrate.bps - a.bitrate.bps);
    audios.sort(
      (a, b) => {
        var _a, _b;
        return compareString(a.label, b.label) || compareString(a.language, b.language) || ((_a = b == null ? void 0 : b.bitrate) == null ? void 0 : _a.bps) - ((_b = a == null ? void 0 : a.bitrate) == null ? void 0 : _b.bps) || 0;
      }
    );
    subtitles.sort((a, b) => compareString(a.label, b.label) || compareString(a.language, b.language) || 0);
    const videoIndex = this.#options.quality === "highest" ? 0 : this.#options.quality === "lowest" ? videos.length - 1 : Math.round(videos.length / 2);
    const videoTracks = [this.#getDlTrack("video" /* VIDEO */, videos[videoIndex], videoIndex, tmpDir)];
    const audioTracks = audios.map((track, index) => this.#getDlTrack("audio" /* AUDIO */, track, index, tmpDir));
    const subtitleTracks = subtitles.map((track, index) => this.#getDlTrack("subtitle" /* SUBTITLE */, track, index, tmpDir));
    return {
      ...this.#options,
      url,
      handler,
      manifest,
      video: videoTracks,
      audio: audioTracks,
      subtitle: subtitleTracks,
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
    const ext = path.extname(segments[0].file);
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
    const { logger } = this.#options;
    const queue = [];
    let downloaded = 0;
    for (let i = 0; i < dlVideo.concurrency; i++) {
      const task = this.#downloadSegment(dlTrack.segments, () => {
        logger == null ? void 0 : logger.log(`${++downloaded}/${dlTrack.segments.length}`);
      });
      queue.push(task);
    }
    await Promise.all(queue);
    await this.#concatSegments(dlTrack, dlVideo);
  }
  async #downloadSegment(dlSegments, onDownloaded) {
    const { logger } = this.#options;
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
      logger == null ? void 0 : logger.error(`${path.basename(dlSegment.file)} download failed: ${error}, retrying...`);
    }
    return this.#downloadSegment(dlSegments, onDownloaded);
  }
  async #concatSegments(dlTrack, dlVideo) {
    const { logger } = this.#options;
    const { type, segments, file } = dlTrack;
    if (segments.length > 1) {
      logger == null ? void 0 : logger.log("Concat Segments...");
      for (let i = 0; i < segments.length; i++) {
        const buffer = fs.readFileSync(segments[i].file);
        fs.appendFileSync(file, buffer);
      }
    } else {
      fs.renameSync(segments[0].file, file);
    }
  }
  #multiplexingTracks(dlVideo) {
    const { logger } = this.#options;
    const { video: videoTracks, audio: audioTracks, subtitle: subtitleTracks, file } = dlVideo;
    const args = [];
    args.push("-i", videoTracks[0].file);
    audioTracks.forEach((track) => args.push("-i", track.file));
    subtitleTracks.forEach((track) => args.push("-i", track.file));
    logger == null ? void 0 : logger.log(`Map Video Track`);
    args.push("-map", "0:v");
    if (audioTracks.length > 0) {
      logger == null ? void 0 : logger.log(`Map Audio Tracks`);
      audioTracks.forEach((track, i) => args.push("-map", `${i + 1}:a`));
    } else {
      args.push("-map", "0:a?");
    }
    if (subtitleTracks.length > 0) {
      logger == null ? void 0 : logger.log(`Map Subtitle Tracks`);
      const offset = 1 + audioTracks.length;
      subtitleTracks.forEach((track, i) => args.push("-map", `${i + offset}`));
    }
    if (audioTracks.length > 0) {
      logger == null ? void 0 : logger.log(`Add Audio Tracks Metadata`);
      audioTracks.forEach((track, i) => {
        const kbps = track.bitrate && `${track.bitrate.kbps} kbps`;
        args.push(`-metadata:s:a:${i}`, `language=${track.language}`);
        args.push(`-metadata:s:a:${i}`, `title=${track.label || kbps || ""}`);
      });
    }
    if (subtitleTracks.length > 0) {
      logger == null ? void 0 : logger.log(`Add Subtitle Track Metadata`);
      subtitleTracks.forEach((track, i) => {
        args.push(`-metadata:s:s:${i}`, `language=${track.language}`);
        args.push(`-metadata:s:s:${i}`, `title=${track.label || ""}`);
      });
    }
    if (audioTracks.length > 0) {
      logger == null ? void 0 : logger.log(`Set Default Audio Track`);
      audioTracks.forEach((track, i) => args.push(`-disposition:a:${i}`, "default"));
    }
    if (subtitleTracks.length > 0) {
      logger == null ? void 0 : logger.log(`Set Default Subtitle Track`);
      subtitleTracks.forEach((track, i) => args.push(`-disposition:s:${i}`, "default"));
    }
    const { videoCodec, audioCodec, subtitleCodec } = dlVideo;
    args.push("-c:v", videoCodec);
    args.push("-c:a", audioCodec);
    args.push("-c:s", subtitleCodec);
    args.push(file, "-y");
    return this.#execFFmpeg(args, dlVideo);
  }
  #execFFmpeg(args, dlVideo) {
    return new Promise((resolve2, reject) => {
      const { logger } = this.#options;
      const { dir: cwd, base: command } = path.parse(dlVideo.ffmpegPath);
      logger == null ? void 0 : logger.group("Executing FFmpeg...");
      logger == null ? void 0 : logger.log(`Command: ${command} ${args.join(" ")}`);
      const process2 = _child_process.spawn.call(void 0, command, args, { cwd });
      dlVideo.handler("ffmpeg_spawn" /* FFMPEG_SPAWN */, { process: process2, cwd, command, args });
      process2.on("close", (code) => {
        logger == null ? void 0 : logger.log(`Code: ${code}`);
        logger == null ? void 0 : logger.groupEnd();
        dlVideo.handler("ffmpeg_close" /* FFMPEG_CLOSE */, { code });
        resolve2(code);
      });
      process2.on("error", (error) => {
        logger == null ? void 0 : logger.error(`Failed: ${error}`);
        logger == null ? void 0 : logger.groupEnd();
        dlVideo.handler("ffmpeg_error" /* FFMPEG_ERROR */, { error });
        reject(error);
      });
      process2.stderr.on("data", (data) => {
        dlVideo.handler("ffmpeg_data" /* FFMPEG_DATA */, { data });
      });
    });
  }
};
var src_default = Downloader;


exports.default = src_default;

module.exports = exports.default;
