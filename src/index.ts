import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { spawn, ChildProcess } from "node:child_process";
import { parse as parseManifest, Manifest, Track, Segment, Bitrate } from "dasha";

interface DL_Options {
  ffmpegPath?: string;
  outDir?: string;
  quality?: "highest" | "medium" | "lowest";
  concurrency?: number;
  videoCodec?: string;
  audioCodec?: string;
  subtitleCodec?: string;
  clean?: boolean;
  logger?: any;
}

const defaultDlOptions: DL_Options = {
  ffmpegPath: "ffmpeg.exe",
  outDir: path.resolve(os.homedir(), "Downloads"),
  quality: "highest",
  concurrency: 5,
  videoCodec: "copy",
  audioCodec: "copy",
  subtitleCodec: "srt",
  clean: true,
  logger: console,
};

enum DL_Event {
  VIDEO_INFO = "video_info",
  FFMPEG_SPAWN = "ffmpeg_spawn",
  FFMPEG_CLOSE = "ffmpeg_close",
  FFMPEG_ERROR = "ffmpeg_error",
  FFMPEG_DATA = "ffmpeg_data",
}

type DL_Handler = (event: DL_Event, data: any) => void;

enum TrackType {
  VIDEO = "video",
  AUDIO = "audio",
  TEXT = "text",
}

enum Stat {
  WAITING = "waiting",
  DOWNLOADING = "downloading",
  DOWNLOADED = "downloaded",
}

interface DL_Video extends DL_Options {
  url: string;
  handler: DL_Handler;
  manifest: Manifest;
  video: DL_Track[];
  audio: DL_Track[];
  text: DL_Track[];
  tmpDir: string;
  name: string;
  ext: string;
  file: string;
}

interface DL_Track {
  type: TrackType;
  segments: DL_Segment[];
  file: string;
  bitrate?: Bitrate;
  quality?: string;
  language?: string;
  label?: string;
}

interface DL_Segment {
  url: string;
  file: string;
  stat: Stat;
}

class Downloader {
  #options: DL_Options;

  constructor(options?: DL_Options) {
    this.#options = Object.assign({}, defaultDlOptions, options);
  }

  async download(url: string, outFile: string, handler: DL_Handler = () => {}): Promise<DL_Video> {
    const { logger } = this.#options;

    // get video info
    const dlVideo = await this.#getDlVideo(url, outFile, handler);
    dlVideo.handler(DL_Event.VIDEO_INFO, { video_info: dlVideo });

    // create temporary directory
    fs.mkdirSync(dlVideo.tmpDir, { recursive: true });

    // download video track
    logger?.group(`Downloading Video Track (${dlVideo.video[0].quality})...`);
    await this.#downloadTrack(dlVideo.video[0], dlVideo);
    logger?.groupEnd();

    // download audio tracks
    for (let i = 0; i < dlVideo.audio.length; i++) {
      logger?.group(`Downloading Audio Tracks (${i + 1}/${dlVideo.audio.length})...`);
      await this.#downloadTrack(dlVideo.audio[i], dlVideo);
      logger?.groupEnd();
    }

    // download subtitle tracks
    for (let i = 0; i < dlVideo.text.length; i++) {
      logger?.group(`Downloading Subtitle Tracks (${i + 1}/${dlVideo.text.length})...`);
      await this.#downloadTrack(dlVideo.text[i], dlVideo);
      logger?.groupEnd();
    }

    // multiplex tracks
    logger?.group(`Multiplexing Tracks...`);
    await this.#multiplexingTracks(dlVideo);
    logger?.groupEnd();

    // clean temporary directory
    if (dlVideo.clean) {
      logger?.log("Clean Temporary Files...");
      fs.rmSync(dlVideo.tmpDir, { recursive: true, force: true });
    }

    logger?.group("Download Complete!");
    logger?.log("Path:", dlVideo.file);
    logger?.groupEnd();
    return dlVideo;
  }

  parse(url: string, outFile: string): Promise<DL_Video> {
    return this.#getDlVideo(url, outFile);
  }

  async #getDlVideo(url: string, outFile: string, handler: DL_Handler = () => {}): Promise<DL_Video> {
    const { logger } = this.#options;

    // path
    let { dir, name, ext } = path.parse(outFile);
    dir ||= this.#options.outDir;
    const tmpDir = path.resolve(dir, `tmp-${name}`);
    const file = path.resolve(dir, `${name}${ext}`);

    // parse manifest
    logger?.group(`Parsing Manifest...`);
    logger?.log("URL:", url);
    logger?.log("Path:", file);
    const body = await fetch(url).then((r) => r.text());
    const manifest = await parseManifest(body, url);
    const { videos, audios, subtitles } = manifest.tracks;
    logger?.group(`Tracks:`);
    logger?.log("Videos:", videos.map((track) => track.quality).join(", "));
    logger?.log("Audios:", audios.map((track) => `${track.language}`).join(", "));
    logger?.log("Subtitles:", subtitles.map((track) => `${track.language}`).join(", "));
    logger?.groupEnd();
    logger?.groupEnd();

    // sort tracks
    const compareString = (a, b) => {
      return (a && !b ? -1 : !a && b ? 1 : a && b && a.localeCompare(b, undefined, { numeric: true })) || 0;
    };
    videos.sort((a, b) => b.bitrate.bps - a.bitrate.bps);
    audios.sort(
      (a, b) =>
        compareString(a.label, b.label) ||
        compareString(a.language, b.language) ||
        b?.bitrate?.bps - a?.bitrate?.bps ||
        0
    );
    subtitles.sort((a, b) => compareString(a.label, b.label) || compareString(a.language, b.language) || 0);

    // video index
    const videoIndex =
      this.#options.quality === "highest"
        ? 0
        : this.#options.quality === "lowest"
        ? videos.length - 1
        : Math.round(videos.length / 2);

    // tracks
    const videoTracks = [this.#getDlTrack(TrackType.VIDEO, videos[videoIndex], videoIndex, tmpDir)];
    const audioTracks = audios.map((track, index) => this.#getDlTrack(TrackType.AUDIO, track, index, tmpDir));
    const subtitleTracks = subtitles.map((track, index) => this.#getDlTrack(TrackType.TEXT, track, index, tmpDir));

    return {
      ...this.#options,
      url,
      handler,
      manifest,
      video: videoTracks,
      audio: audioTracks,
      text: subtitleTracks,
      tmpDir,
      name,
      ext,
      file,
    };
  }

  #getDlTrack(type: TrackType, track: Track, trackIndex: number, tmpDir: string): DL_Track {
    const segments: DL_Segment[] = track.segments.map((segment, index) =>
      this.#getDlSegment(type, trackIndex, segment, index, tmpDir)
    );
    const ext = path.extname(segments[0].file);
    const file = path.resolve(tmpDir, `${type}${trackIndex}${ext}`);
    const { bitrate, quality, language, label } = track as any;
    return { type, segments, file, bitrate, quality, language, label };
  }

  #getDlSegment(
    type: TrackType,
    trackIndex: number,
    segment: Segment,
    segmentIndex: number,
    tmpDir: string
  ): DL_Segment {
    const { url } = segment;
    const name = `${type}${trackIndex}_Segment${segmentIndex + 1}`;
    const ext = path.extname(new URL(url).pathname);
    const file = path.resolve(tmpDir, `${name}${ext}`);
    const stat = Stat.WAITING;
    return { url, file, stat };
  }

  async #downloadTrack(dlTrack: DL_Track, dlVideo: DL_Video) {
    const { logger } = this.#options;

    // download segments
    const queue = [];
    let downloaded = 0;
    for (let i = 0; i < dlVideo.concurrency; i++) {
      const task = this.#downloadSegment(dlTrack.segments, () => {
        logger?.log(`${++downloaded}/${dlTrack.segments.length}`);
      });
      queue.push(task);
    }
    await Promise.all(queue);

    // concat segments
    await this.#concatSegments(dlTrack, dlVideo);
  }

  async #downloadSegment(dlSegments: DL_Segment[], onDownloaded: () => void) {
    const { logger } = this.#options;
    const dlSegment = dlSegments.find(({ stat }) => stat === Stat.WAITING);
    if (!dlSegment) return;
    try {
      dlSegment.stat = Stat.DOWNLOADING;
      const response = await fetch(dlSegment.url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(dlSegment.file, buffer);
      dlSegment.stat = Stat.DOWNLOADED;
      onDownloaded();
    } catch (error) {
      dlSegment.stat = Stat.WAITING; // reset to waiting
      logger?.error(`${path.basename(dlSegment.file)} download failed: ${error}, retrying...`);
    }
    // next task
    return this.#downloadSegment(dlSegments, onDownloaded);
  }

  async #concatSegments(dlTrack: DL_Track, dlVideo: DL_Video) {
    const { logger } = this.#options;
    const { type, segments, file } = dlTrack;

    if (segments.length > 1) {
      logger?.log("Concat Segments...");
      for (let i = 0; i < segments.length; i++) {
        const buffer = fs.readFileSync(segments[i].file);
        fs.appendFileSync(file, buffer);
      }
    } else {
      fs.renameSync(segments[0].file, file);
    }
  }

  #multiplexingTracks(dlVideo: DL_Video) {
    const { logger } = this.#options;
    const { video: videoTracks, audio: audioTracks, text: subtitleTracks, file } = dlVideo;

    // add input tracks
    const args = [];
    args.push("-i", videoTracks[0].file); // add video track
    audioTracks.forEach((track) => args.push("-i", track.file)); // add audio tracks
    subtitleTracks.forEach((track) => args.push("-i", track.file)); // add subtitle tracks

    // map tracks
    logger?.log(`Map Video Track`);
    args.push("-map", "0:v"); // map video track
    if (audioTracks.length > 0) {
      logger?.log(`Map Audio Tracks`);
      audioTracks.forEach((track, i) => args.push("-map", `${i + 1}:a`)); // map audio tracks
    } else {
      args.push("-map", "0:a?"); // map audio track
    }
    if (subtitleTracks.length > 0) {
      logger?.log(`Map Subtitle Tracks`);
      const offset = 1 + audioTracks.length;
      subtitleTracks.forEach((track, i) => args.push("-map", `${i + offset}`)); // map subtitle tracks
    }

    // add tracks metadata
    if (audioTracks.length > 0) {
      logger?.log(`Add Audio Tracks Metadata`);
      audioTracks.forEach((track, i) => {
        const kbps = track.bitrate && `${track.bitrate.kbps} kbps`;
        args.push(`-metadata:s:a:${i}`, `language=${track.language}`); // language
        args.push(`-metadata:s:a:${i}`, `title=${track.label || kbps || ""}`); // title
      });
    }
    if (subtitleTracks.length > 0) {
      logger?.log(`Add Subtitle Track Metadata`);
      subtitleTracks.forEach((track, i) => {
        args.push(`-metadata:s:s:${i}`, `language=${track.language}`); // language
        args.push(`-metadata:s:s:${i}`, `title=${track.label || ""}`); // title
      });
    }

    // set default track
    if (audioTracks.length > 0) {
      logger?.log(`Set Default Audio Track`);
      audioTracks.forEach((track, i) => args.push(`-disposition:a:${i}`, "default"));
    }
    if (subtitleTracks.length > 0) {
      logger?.log(`Set Default Subtitle Track`);
      subtitleTracks.forEach((track, i) => args.push(`-disposition:s:${i}`, "default"));
    }

    // codecs
    const { videoCodec, audioCodec, subtitleCodec } = dlVideo;
    args.push("-c:v", videoCodec);
    args.push("-c:a", audioCodec);
    args.push("-c:s", subtitleCodec);

    // output
    args.push(file, "-y");

    return this.#execFFmpeg(args, dlVideo);
  }

  #execFFmpeg(args: string[], dlVideo: DL_Video): Promise<number> {
    return new Promise((resolve, reject) => {
      const { logger } = this.#options;
      const { dir: cwd, base: command } = path.parse(dlVideo.ffmpegPath);
      logger?.group("Executing FFmpeg...");
      logger?.log(`Command: ${command} ${args.join(" ")}`);
      const process = spawn(command, args, { cwd });
      dlVideo.handler(DL_Event.FFMPEG_SPAWN, { process, cwd, command, args });
      process.on("close", (code) => {
        logger?.log(`Code: ${code}`);
        logger?.groupEnd();
        dlVideo.handler(DL_Event.FFMPEG_CLOSE, { code });
        resolve(code);
      });
      process.on("error", (error) => {
        logger?.error(`Failed: ${error}`);
        logger?.groupEnd();
        dlVideo.handler(DL_Event.FFMPEG_ERROR, { error });
        reject(error);
      });
      process.stderr.on("data", (data) => {
        dlVideo.handler(DL_Event.FFMPEG_DATA, { data });
      });
    });
  }
}

export default Downloader;
