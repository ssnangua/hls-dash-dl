import { Manifest, Bitrate } from 'dasha';

interface DL_Options {
    ffmpegPath?: string;
    outDir?: string;
    quality?: "highest" | "medium" | "lowest";
    concurrency?: number;
    clean?: boolean;
    logger?: any;
}
declare enum DL_Event {
    VIDEO_INFO = "video_info",
    FFMPEG_SPAWN = "ffmpeg_spawn",
    FFMPEG_CLOSE = "ffmpeg_close",
    FFMPEG_ERROR = "ffmpeg_error",
    FFMPEG_DATA = "ffmpeg_data"
}
type DL_Handler = (event: DL_Event, data: any) => void;
declare enum TrackType {
    VIDEO = "video",
    AUDIO = "audio",
    TEXT = "text"
}
declare enum Stat {
    WAITING = "waiting",
    DOWNLOADING = "downloading",
    DOWNLOADED = "downloaded"
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
declare class Downloader {
    #private;
    constructor(options?: DL_Options);
    download(url: string, outFile: string, handler?: DL_Handler): Promise<DL_Video>;
    parse(url: string, outFile: string): Promise<DL_Video>;
}

export = Downloader;
