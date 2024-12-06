import { Manifest, Bitrate } from 'dasha';

interface DL_Config {
    ffmpegPath?: string;
    gpacPath?: string;
    outDir?: string;
    quality?: "highest" | "medium" | "lowest";
    concurrency?: number;
    videoCodec?: string;
    audioCodec?: string;
    subtitleCodec?: string;
    clean?: boolean;
    logger?: any;
}
declare enum DL_Event {
    VIDEO_INFO = "video_info",
    CHILD_PROCESS_SPAWN = "child_process_spawn",
    CHILD_PROCESS_CLOSE = "child_process_close",
    CHILD_PROCESS_ERROR = "child_process_error",
    CHILD_PROCESS_STDOUT = "child_process_stdout",
    CHILD_PROCESS_STDERR = "child_process_stderr"
}
type DL_Handler = (event: DL_Event, data: any) => void;
declare enum TrackType {
    VIDEO = "video",
    AUDIO = "audio",
    SUBTITLE = "subtitle"
}
declare enum Stat {
    WAITING = "waiting",
    DOWNLOADING = "downloading",
    DOWNLOADED = "downloaded"
}
interface DL_Video extends DL_Config {
    manifest: Manifest;
    text: string;
    url: string;
    keys: string | string[];
    handler: DL_Handler;
    tmpDir: string;
    dir: string;
    name: string;
    ext: string;
    file: string;
    video: DL_Track[];
    audio: DL_Track[];
    subtitle: DL_Track[];
}
interface DL_Track {
    type: TrackType;
    segments: DL_Segment[];
    tmpDir: string;
    name: string;
    ext: string;
    file: string;
    codec?: string;
    bitrate?: Bitrate;
    quality?: string;
    language?: string;
    label?: string;
    fps?: number;
    defaultKeyId?: string;
    decrypted?: string;
}
interface DL_Segment {
    url: string;
    tmpDir: string;
    name: string;
    ext: string;
    file: string;
    stat: Stat;
}
type DL_Manifest = string | {
    url?: string;
    text?: string;
    keys?: string | string[];
};
declare class Downloader {
    #private;
    constructor(config?: DL_Config);
    download(manifest: DL_Manifest, outFile: string, handler?: DL_Handler): Promise<DL_Video>;
    parse(manifest: DL_Manifest, outFile: string): Promise<DL_Video>;
}

export = Downloader;
