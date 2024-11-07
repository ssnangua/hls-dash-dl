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
  clean?: boolean;
}

const defaultDlOptions: DL_Options = {
  ffmpegPath: "ffmpeg.exe",
  outDir: path.resolve(os.homedir(), "Downloads"),
  quality: "highest",
  concurrency: 5,
  clean: true,
};

type DL_Handler = (event: string, data: any) => void;

enum DL_Event {
  VIDEO_INFO = "video_info",
  FFMPEG_SPAWN = "ffmpeg_spawn",
  FFMPEG_CLOSE = "ffmpeg_close",
  FFMPEG_ERROR = "ffmpeg_error",
  FFMPEG_DATA = "ffmpeg_data",
}

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
    const dlVideo = await this.#getDlVideo(url, outFile, handler);
    dlVideo.handler(DL_Event.VIDEO_INFO, { video_info: dlVideo });

    // create temporary directory
    fs.mkdirSync(dlVideo.tmpDir, { recursive: true });

    // download video track
    console.group(`Downloading Video Track (${dlVideo.video[0].quality})...`);
    await this.#downloadTrack(dlVideo.video[0], dlVideo);
    console.groupEnd();

    // download audio tracks
    for (let i = 0; i < dlVideo.audio.length; i++) {
      console.group(`Downloading Audio Tracks (${i + 1}/${dlVideo.audio.length})...`);
      await this.#downloadTrack(dlVideo.audio[i], dlVideo);
      console.groupEnd();
    }

    // download subtitle tracks
    for (let i = 0; i < dlVideo.text.length; i++) {
      console.group(`Downloading Subtitle Tracks (${i + 1}/${dlVideo.text.length})...`);
      await this.#downloadTrack(dlVideo.text[i], dlVideo);
      console.groupEnd();
    }

    // multiplex tracks
    console.group(`Multiplexing Tracks...`);
    await this.#multiplexingTracks(dlVideo);
    console.groupEnd();

    // clean temporary directory
    if (dlVideo.clean) {
      console.log("Clean Temporary Files...");
      fs.rmSync(dlVideo.tmpDir, { recursive: true, force: true });
    }

    console.group("Download Complete!");
    console.log("Path:", dlVideo.file);
    console.groupEnd();
    return dlVideo;
  }

  parse(url: string, outFile: string): Promise<DL_Video> {
    return this.#getDlVideo(url, outFile);
  }

  async #getDlVideo(url: string, outFile: string, handler: DL_Handler = () => {}): Promise<DL_Video> {
    // parse manifest
    console.group(`Parsing Manifest...`);
    const body = await fetch(url).then((r) => r.text());
    const manifest = await parseManifest(body, url);
    const { videos, audios, subtitles } = manifest.tracks;
    console.log("Videos:", videos.map((track) => track.quality).join(", "));
    console.log("Audios:", audios.map((track) => `${track.language}`).join(", "));
    console.log("Subtitles:", subtitles.map((track) => `${track.language}`).join(", "));
    console.groupEnd();

    videos.sort((a, b) => b.bitrate.bps - a.bitrate.bps); // sort by bitrate
    const qualityIndex =
      this.#options.quality === "highest"
        ? 0
        : this.#options.quality === "lowest"
        ? videos.length - 1
        : Math.round(videos.length / 2);

    const { dir = this.#options.outDir, name, ext } = path.parse(outFile);
    const tmpDir = path.resolve(dir, name);
    const file = path.resolve(dir, `${name}${ext}`);

    const videoTrack = this.#getDlTrack(TrackType.VIDEO, videos[qualityIndex], qualityIndex, tmpDir);
    const audioTracks = audios.map((track, index) => this.#getDlTrack(TrackType.AUDIO, track, index, tmpDir));
    const subtitleTracks = subtitles.map((track, index) => this.#getDlTrack(TrackType.TEXT, track, index, tmpDir));

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
      file,
    };
  }

  #getDlTrack(type: TrackType, track: Track, trackIndex: number, tmpDir: string): DL_Track {
    const segments: DL_Segment[] = track.segments.map((segment, index) =>
      this.#getDlSegment(type, trackIndex, segment, index, tmpDir)
    );
    // if subtitle, convert to srt, otherwise use first segment's extension
    const ext = type === TrackType.TEXT ? ".srt" : path.extname(segments[0].file);
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
    // download segments
    const queue = [];
    let downloaded = 0;
    for (let i = 0; i < dlVideo.concurrency; i++) {
      const task = this.#downloadSegment(dlTrack.segments, () => {
        console.log(`${++downloaded}/${dlTrack.segments.length}`);
      });
      queue.push(task);
    }
    await Promise.all(queue);

    // concat segments
    await this.#concatSegments(dlTrack, dlVideo);
  }

  async #downloadSegment(dlSegments: DL_Segment[], onDownloaded: () => void) {
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
      console.error(`${path.basename(dlSegment.file)} download failed: ${error}, retrying...`);
    }
    // next task
    return this.#downloadSegment(dlSegments, onDownloaded);
  }

  async #concatSegments(dlTrack: DL_Track, dlVideo: DL_Video) {
    const { type, segments, file } = dlTrack;

    // if video or audio, concat segments into one file
    if (type === TrackType.VIDEO || type === TrackType.AUDIO) {
      if (segments.length > 1) {
        console.log("Concat Segments...");
        for (let i = 0; i < segments.length; i++) {
          const buffer = fs.readFileSync(segments[i].file);
          fs.appendFileSync(file, buffer);
        }
      } else {
        fs.renameSync(segments[0].file, file);
      }
    } else {
      // if subtitle, concat segments into one file and convert to srt
      const args = [];
      let input;
      if (segments.length > 1) {
        console.log("Concat Segments...");
        // ffmpeg.exe -f concat -i list.txt -c copy output.*
        args.push("-f", "concat");
        args.push("-safe", "0"); // allow absolute path
        const listFile = path.resolve(path.dirname(segments[0].file), "segments.txt");
        const data = segments.map(({ file }) => `file '${file.replace(/\\/g, "/")}'`).join("\n");
        fs.writeFileSync(listFile, data);
        input = listFile;
      } else {
        input = segments[0].file;
      }
      args.push("-i", input, "-c:s", "srt", file, "-y");
      await this.#execFFmpeg(args, dlVideo);
    }
  }

  #multiplexingTracks(dlVideo: DL_Video) {
    // ffmpeg.exe -i 1.mp4 -i 1.mp4 -c copy -map 0:v:0 -map 1:a:0 output.mkv
    const { video: videoTracks, audio: audioTracks, text: subtitleTracks, file } = dlVideo;

    // add input tracks
    const args = [];
    args.push("-i", videoTracks[0].file); // add video track
    audioTracks.forEach((track) => args.push("-i", track.file)); // add audio tracks
    subtitleTracks.forEach((track) => args.push("-i", track.file)); // add subtitle tracks

    // map tracks
    console.log(`Mapping Video Track...`);
    args.push("-map", "0:v"); // map video track
    if (audioTracks.length > 0) {
      console.log(`Mapping Audio Tracks...`);
      audioTracks.forEach((track, i) => args.push("-map", `${i + 1}:a`)); // map audio tracks
    } else {
      args.push("-map", "0:a?"); // map audio track
    }
    if (subtitleTracks.length > 0) {
      console.log(`Mapping Subtitle Tracks...`);
      const offset = 1 + audioTracks.length;
      subtitleTracks.forEach((track, i) => args.push("-map", `${i + offset}`)); // map subtitle tracks
    }

    // add tracks metadata
    if (audioTracks.length > 0) {
      console.log(`Adding Audio Tracks Metadata...`);
      audioTracks.forEach((track, i) => {
        const kbps = track.bitrate && `${track.bitrate.kbps} kbps`;
        args.push(`-metadata:s:a:${i}`, `language=${track.language}`); // language
        args.push(`-metadata:s:a:${i}`, `title=${track.label || kbps || ""}`); // title
      });
    }
    if (subtitleTracks.length > 0) {
      console.log(`Adding Subtitle Track Metadata...`);
      subtitleTracks.forEach((track, i) => {
        args.push(`-metadata:s:s:${i}`, `language=${track.language}`); // language
        args.push(`-metadata:s:s:${i}`, `title=${track.label || ""}`); // title
      });
    }

    // codecs
    args.push("-c:v", "copy"); // video codec
    args.push("-c:a", "copy"); // audio codec
    args.push("-c:s", "srt"); // subtitle codec

    // output
    args.push(file, "-y");

    return this.#execFFmpeg(args, dlVideo);
  }

  #execFFmpeg(args: string[], dlVideo: DL_Video): Promise<number> {
    return new Promise((resolve, reject) => {
      const { dir: cwd, base: command } = path.parse(dlVideo.ffmpegPath);
      const process = spawn(command, args, { cwd });
      dlVideo.handler(DL_Event.FFMPEG_SPAWN, { process, cwd, command, args });
      process.on("close", (code) => {
        dlVideo.handler(DL_Event.FFMPEG_CLOSE, { code });
        resolve(code);
      });
      process.on("error", (error) => {
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
