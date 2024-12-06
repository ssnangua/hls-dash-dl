"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } }// src/index.ts
var _os = require('os'); var os = _interopRequireWildcard(_os);
var _path = require('path'); var path = _interopRequireWildcard(_path);
var _fs = require('fs'); var fs = _interopRequireWildcard(_fs);
var _child_process = require('child_process');
var _dasha = require('dasha');
var _ttml2srt = require('ttml2srt');
var defaultDlConfig = {
  ffmpegPath: process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  gpacPath: process.platform === "win32" ? "gpac.exe" : "gpac",
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
  #config;
  constructor(config) {
    this.#config = Object.assign({}, defaultDlConfig, config);
  }
  async download(manifest, outFile, handler) {
    var _a;
    const { logger } = this.#config;
    const dlVideo = await this.#getDlVideo(manifest, outFile, handler);
    (_a = dlVideo.handler) == null ? void 0 : _a.call(dlVideo, "video_info" /* VIDEO_INFO */, { video_info: dlVideo });
    fs.mkdirSync(dlVideo.tmpDir, { recursive: true });
    logger == null ? void 0 : logger.group(`Download Video Track (${dlVideo.video[0].quality})...`);
    await this.#downloadTrack(dlVideo.video[0], dlVideo);
    logger == null ? void 0 : logger.groupEnd();
    for (let i = 0; i < dlVideo.audio.length; i++) {
      logger == null ? void 0 : logger.group(`Download Audio Tracks (${i + 1}/${dlVideo.audio.length})...`);
      await this.#downloadTrack(dlVideo.audio[i], dlVideo);
      logger == null ? void 0 : logger.groupEnd();
    }
    for (let i = 0; i < dlVideo.subtitle.length; i++) {
      logger == null ? void 0 : logger.group(`Download Subtitle Tracks (${i + 1}/${dlVideo.subtitle.length})...`);
      await this.#downloadTrack(dlVideo.subtitle[i], dlVideo);
      logger == null ? void 0 : logger.groupEnd();
    }
    if (this.#isBinAvailable(dlVideo.ffmpegPath)) {
      if (Array.isArray(dlVideo.keys) && dlVideo.keys.length > 0) {
        await this.#decryptTracks(dlVideo);
      }
    }
    await this.#processSubtitles(dlVideo);
    if (this.#isBinAvailable(dlVideo.ffmpegPath)) {
      logger == null ? void 0 : logger.group(`Multiplex Tracks...`);
      await this.#multiplexingTracks(dlVideo);
      logger == null ? void 0 : logger.groupEnd();
    } else {
      logger == null ? void 0 : logger.log("FFmpeg Invalid, Output Tracks...");
      [].concat(dlVideo.video, dlVideo.audio, dlVideo.subtitle).forEach((track) => {
        const file = path.resolve(dlVideo.dir, `${track.name}${track.ext}`);
        fs.copyFileSync(track.file, file);
      });
    }
    if (dlVideo.clean) {
      logger == null ? void 0 : logger.log("Clean Temporary Files...");
      fs.rmSync(dlVideo.tmpDir, { recursive: true, force: true });
    }
    logger == null ? void 0 : logger.group("Download Complete!");
    logger == null ? void 0 : logger.log("Path:", dlVideo.file);
    logger == null ? void 0 : logger.groupEnd();
    return dlVideo;
  }
  parse(manifest, outFile) {
    return this.#getDlVideo(manifest, outFile);
  }
  async #getDlVideo(manifest, outFile, handler) {
    const { logger } = this.#config;
    let { dir, name, ext } = path.parse(path.resolve(outFile));
    dir ||= path.resolve(this.#config.outDir);
    const tmpDir = path.resolve(dir, `tmp-${name}`);
    const file = path.resolve(dir, `${name}${ext}`);
    const dlManifest = typeof manifest === "string" ? manifest.startsWith("http") ? { url: manifest } : { text: manifest } : manifest || {};
    let { text, url, keys } = dlManifest;
    if (!text && !url) throw new Error("Invalid manifest");
    if (!text) text = await fetch(url).then((r) => r.text());
    if (typeof keys === "string") keys = [keys];
    else if (Array.isArray(keys)) keys = keys;
    logger == null ? void 0 : logger.group(`Parse Manifest...`);
    logger == null ? void 0 : logger.log("Manifest:", manifest);
    logger == null ? void 0 : logger.log("Path:", file);
    const parsedManifest = await _dasha.parse.call(void 0, text, url);
    const { videos, audios, subtitles } = parsedManifest.tracks;
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
    const videoIndex = this.#config.quality === "highest" ? 0 : this.#config.quality === "lowest" ? videos.length - 1 : Math.round(videos.length / 2);
    const videoTracks = [this.#getDlTrack("video" /* VIDEO */, videos[videoIndex], videoIndex, tmpDir)];
    const audioTracks = audios.map((track, index) => this.#getDlTrack("audio" /* AUDIO */, track, index, tmpDir));
    const subtitleTracks = subtitles.map((track, index) => this.#getDlTrack("subtitle" /* SUBTITLE */, track, index, tmpDir));
    return {
      ...this.#config,
      url,
      text,
      keys,
      handler,
      manifest: parsedManifest,
      dir,
      name,
      ext,
      file,
      tmpDir,
      video: videoTracks,
      audio: audioTracks,
      subtitle: subtitleTracks
    };
  }
  #getDlTrack(type, track, trackIndex, tmpDir) {
    var _a, _b, _c;
    const { codec, bitrate, quality, language, label, fps, protection } = track;
    const segments = track.segments.map(
      (segment, index) => this.#getDlSegment(type, trackIndex, segment, index, tmpDir)
    );
    const name = `${type}${trackIndex}_${quality || language}_${codec}`;
    const ext = path.extname(segments[0].file);
    const file = path.resolve(tmpDir, `${name}${ext}`);
    const defaultKeyId = (_c = (_b = (_a = protection == null ? void 0 : protection.common) == null ? void 0 : _a.defaultKeyId) == null ? void 0 : _b.replace) == null ? void 0 : _c.call(_b, /\-/g, "");
    return { type, segments, tmpDir, name, ext, file, codec, bitrate, quality, language, label, fps, defaultKeyId };
  }
  #getDlSegment(type, trackIndex, segment, segmentIndex, tmpDir) {
    const { url } = segment;
    const name = `${type}${trackIndex}_Segment${segmentIndex}`;
    const ext = path.extname(new URL(url).pathname);
    const file = path.resolve(tmpDir, `${name}${ext}`);
    const stat = "waiting" /* WAITING */;
    return { url, tmpDir, name, ext, file, stat };
  }
  async #downloadTrack(dlTrack, dlVideo) {
    if (fs.existsSync(dlTrack.file)) return;
    const { logger } = this.#config;
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
    const { logger } = this.#config;
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
      logger == null ? void 0 : logger.error(`${path.basename(dlSegment.file)} download failed: ${error}, retry...`);
    }
    return this.#downloadSegment(dlSegments, onDownloaded);
  }
  async #concatSegments(dlTrack, dlVideo) {
    const { logger } = this.#config;
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
  async #decryptTracks(dlVideo) {
    const { logger } = this.#config;
    const { video: videoTracks, audio: audioTracks } = dlVideo;
    logger == null ? void 0 : logger.group("Decrypt Video Track...");
    await this.#decryptTrack(videoTracks[0], dlVideo);
    logger == null ? void 0 : logger.groupEnd();
    for (let i = 0; i < audioTracks.length; i++) {
      logger == null ? void 0 : logger.group(`Decrypt Audio Tracks (${i + 1}/${audioTracks.length})...`);
      await this.#decryptTrack(audioTracks[i], dlVideo);
      logger == null ? void 0 : logger.groupEnd();
    }
  }
  async #decryptTrack(track, dlVideo) {
    const { defaultKeyId, tmpDir, name, ext, file } = track;
    if (!defaultKeyId) return;
    const key = this.#findKey(dlVideo.keys, defaultKeyId);
    if (!key) return;
    const decrypted = path.resolve(tmpDir, `${name}_decrypted${ext}`);
    const args = ["-decryption_key", key, "-i", file, "-c", "copy", decrypted, "-y"];
    await this.#execBin(this.#config.ffmpegPath, args, dlVideo.handler);
    track.decrypted = decrypted;
  }
  #findKey(keys, keyId) {
    for (let i = 0; i < keys.length; i++) {
      if (!keys[i].includes(":")) return keys[i];
      const [, kid, key] = keys[i].match(/(\w+):(\w+)/);
      if (kid === keyId) return key;
    }
    return null;
  }
  async #processSubtitles(dlVideo) {
    const { logger } = this.#config;
    const wvtt_stpp_tracks = dlVideo.subtitle.filter((subtitle) => {
      return subtitle.codec === "WVTT" || subtitle.codec === "STPP";
    });
    if (wvtt_stpp_tracks.length > 0) {
      if (this.#isBinAvailable(dlVideo.gpacPath)) {
        logger == null ? void 0 : logger.group("Process WVTT/STPP Subtitles...");
        for (let i = 0; i < wvtt_stpp_tracks.length; i++) {
          const subtitle = wvtt_stpp_tracks[i];
          const ext = subtitle.codec === "WVTT" ? ".srt" : ".ttml";
          const file = path.resolve(subtitle.tmpDir, `${subtitle.name}${ext}`);
          const args = ["-i", subtitle.file, "-o", file];
          await this.#execBin(this.#config.gpacPath, args, dlVideo.handler);
          subtitle.ext = ext;
          subtitle.file = file;
        }
        logger == null ? void 0 : logger.groupEnd();
      } else {
        logger == null ? void 0 : logger.log("GPAC Invalid, Remove WVTT/STPP Subtitles...");
        dlVideo.subtitle = dlVideo.subtitle.filter((subtitle) => {
          return subtitle.codec !== "WVTT" && subtitle.codec !== "STPP";
        });
      }
    }
    const ttml_tracks = dlVideo.subtitle.filter((subtitle) => {
      return subtitle.codec === "TTML" || subtitle.ext === ".ttml";
    });
    if (ttml_tracks.length > 0) {
      logger == null ? void 0 : logger.log("Convert TTML Subtitles to SRT...");
      for (let i = 0; i < ttml_tracks.length; i++) {
        const subtitle = ttml_tracks[i];
        const file = path.resolve(subtitle.tmpDir, `${subtitle.name}.srt`);
        const ttmlText = fs.readFileSync(subtitle.file, "utf8");
        const srtText = _ttml2srt.ttml2srt.call(void 0, ttmlText, dlVideo.video[0].fps);
        fs.writeFileSync(file, srtText);
        subtitle.ext = ".srt";
        subtitle.file = file;
      }
    }
    logger == null ? void 0 : logger.log("Remove Duplicate Subtitles...");
    const map = dlVideo.subtitle.reduce((map2, subtitle) => {
      const key = fs.readFileSync(subtitle.file, "utf8").split("\n").map((line) => line.trim()).join("");
      map2[key] = subtitle;
      return map2;
    }, {});
    dlVideo.subtitle = Object.values(map);
  }
  #multiplexingTracks(dlVideo) {
    const { logger } = this.#config;
    const { video: videoTracks, audio: audioTracks, subtitle: subtitleTracks, file } = dlVideo;
    const args = [];
    args.push("-i", videoTracks[0].decrypted || videoTracks[0].file);
    audioTracks.forEach((track) => args.push("-i", track.decrypted || track.file));
    subtitleTracks.forEach((track) => args.push("-i", track.decrypted || track.file));
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
    return this.#execBin(this.#config.ffmpegPath, args, dlVideo.handler);
  }
  #execBin(binPath, args, handler) {
    return new Promise((resolve2, reject) => {
      const { logger } = this.#config;
      const { dir: cwd, base: command } = path.parse(binPath);
      logger == null ? void 0 : logger.group("Spawn Child Process...");
      logger == null ? void 0 : logger.log(`Command: ${command} ${args.join(" ")}`);
      const process2 = _child_process.spawn.call(void 0, command, args, { cwd });
      handler == null ? void 0 : handler("child_process_spawn" /* CHILD_PROCESS_SPAWN */, { process: process2, cwd, command, args });
      process2.on("close", (code) => {
        logger == null ? void 0 : logger.log(`Code: ${code}`);
        logger == null ? void 0 : logger.groupEnd();
        handler == null ? void 0 : handler("child_process_close" /* CHILD_PROCESS_CLOSE */, { code, cwd, command, args });
        resolve2(code);
      });
      process2.on("error", (error) => {
        logger == null ? void 0 : logger.error(`Failed: ${error}`);
        logger == null ? void 0 : logger.groupEnd();
        handler == null ? void 0 : handler("child_process_error" /* CHILD_PROCESS_ERROR */, { error, cwd, command, args });
        reject(error);
      });
      process2.stdout.on("data", (data) => {
        handler == null ? void 0 : handler("child_process_stdout" /* CHILD_PROCESS_STDOUT */, { data, cwd, command, args });
      });
      process2.stderr.on("data", (data) => {
        handler == null ? void 0 : handler("child_process_stderr" /* CHILD_PROCESS_STDERR */, { data, cwd, command, args });
      });
    });
  }
  #isBinAvailable(binPath) {
    if (fs.existsSync(binPath)) return true;
    if (new RegExp(path.parse(binPath).name, "i").test(process.env.Path)) return true;
    return false;
  }
};
var src_default = Downloader;


exports.default = src_default;

module.exports = exports.default;
