const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// Configure fluent-ffmpeg to use bundled static binary
if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
}

// Attempt to configure ffprobe path if available
try {
    const ffprobeStatic = require('ffprobe-static');
    if (ffprobeStatic && ffprobeStatic.path) {
        ffmpeg.setFfprobePath(ffprobeStatic.path);
    }
} catch(e) {}

/**
 * Get media file metadata (duration, dimensions, bitrate, codecs)
 */
function getMediaMetadata(filePath) {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err || !metadata) {
                // Fallback: estimate from file stat
                try {
                    const stats = fs.statSync(filePath);
                    return resolve({
                        duration: 0,
                        durationFormatted: '0:00',
                        width: null,
                        height: null,
                        resolution: null,
                        fps: null,
                        bitrate: 0,
                        hasAudio: true,
                        hasVideo: false,
                        fileSize: stats.size
                    });
                } catch(e) {
                    return resolve({ duration: 0, width: null, height: null });
                }
            }

            const format = metadata.format || {};
            const streams = metadata.streams || [];
            const videoStream = streams.find(s => s.codec_type === 'video');
            const audioStream = streams.find(s => s.codec_type === 'audio');

            const duration = parseFloat(format.duration || (videoStream && videoStream.duration) || (audioStream && audioStream.duration) || 0);
            const minutes = Math.floor(duration / 60);
            const seconds = Math.floor(duration % 60);
            const durationFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            let fps = null;
            if (videoStream && videoStream.r_frame_rate) {
                const parts = videoStream.r_frame_rate.split('/');
                if (parts.length === 2 && parseInt(parts[1], 10) > 0) {
                    fps = Math.round(parseInt(parts[0], 10) / parseInt(parts[1], 10));
                }
            }

            const width = videoStream ? videoStream.width : null;
            const height = videoStream ? videoStream.height : null;
            const resolution = width && height ? `${width}x${height}` : null;

            resolve({
                duration,
                durationFormatted,
                width,
                height,
                resolution,
                fps,
                bitrate: format.bit_rate ? parseInt(format.bit_rate, 10) : 0,
                videoCodec: videoStream ? videoStream.codec_name : null,
                audioCodec: audioStream ? audioStream.codec_name : null,
                hasVideo: !!videoStream,
                hasAudio: !!audioStream,
                fileSize: format.size || 0
            });
        });
    });
}

/**
 * Compress Video
 * Supports quality presets, target size in bytes, resolution downscaling, FPS limiting, and optional audio stripping.
 */
function compressVideo(inputPath, outputPath, options = {}) {
    return new Promise(async (resolve, reject) => {
        try {
            const meta = await getMediaMetadata(inputPath);
            const duration = meta.duration || 10;

            const command = ffmpeg(inputPath);

            // Audio track options
            if (options.removeAudio) {
                command.noAudio();
            } else {
                command.audioCodec('aac').audioBitrate('128k');
            }

            // Target size calculation
            if (options.targetSizeBytes && options.targetSizeBytes > 0) {
                // targetBitrate = (targetBytes * 8 / duration) - audioBitrate (128kbps)
                const totalTargetBits = options.targetSizeBytes * 8;
                const audioBitsPerSec = options.removeAudio ? 0 : 128000;
                let videoBitrateK = Math.max(100, Math.floor((totalTargetBits / duration - audioBitsPerSec) / 1000 * 0.9)); // 10% safety margin
                
                command.videoCodec('libx264')
                    .videoBitrate(`${videoBitrateK}k`)
                    .outputOptions(['-preset fast', '-movflags +faststart']);
            } else {
                // Quality-based compression (CRF)
                const quality = (options.quality || 'medium').toLowerCase();
                let crf = 26; // balanced
                let preset = 'medium';

                if (quality === 'high') crf = 22;
                else if (quality === 'low' || quality === 'maximum') crf = 32;

                command.videoCodec('libx264')
                    .outputOptions([
                        `-crf ${crf}`,
                        `-preset ${preset}`,
                        '-movflags +faststart'
                    ]);
            }

            // Resolution / Scaling
            if (options.resolution) {
                const resMap = {
                    '1080p': '1920:1080',
                    '720p': '1280:720',
                    '480p': '854:480',
                    '360p': '640:360',
                    'tiktok': '720:1280',
                    'reels': '720:1280',
                    'shorts': '720:1280',
                    '9:16': '720:1280',
                    'vertical': '720:1280',
                    'square': '720:720',
                    '1:1': '720:720',
                    'twitter': '1280:720',
                    'discord': '1280:720'
                };
                const scaleTarget = resMap[options.resolution] || options.resolution;
                command.outputOptions([`-vf scale=${scaleTarget}:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2`]);
            } else {
                // Ensure even dimensions for h264
                command.outputOptions(['-vf pad=ceil(iw/2)*2:ceil(ih/2)*2']);
            }

            // FPS
            if (options.fps) {
                command.fps(parseInt(options.fps, 10));
            }

            command
                .on('error', (err) => reject(new Error(`Video compression failed: ${err.message}`)))
                .on('end', () => resolve({ outputPath, success: true }))
                .save(outputPath);
        } catch(err) {
            reject(err);
        }
    });
}

/**
 * Convert Video format (MP4, WEBM, MOV, AVI, MKV, GIF)
 */
function convertVideo(inputPath, outputPath, targetFormat, options = {}) {
    return new Promise((resolve, reject) => {
        const fmt = targetFormat.toLowerCase().trim();
        const command = ffmpeg(inputPath);

        if (fmt === 'gif') {
            const fps = options.fps || 12;
            const width = options.width || 480;
            command
                .fps(fps)
                .outputOptions([
                    `-vf fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`
                ]);
        } else if (fmt === 'webm') {
            command.videoCodec('libvpx-vp9')
                .audioCodec('libopus')
                .outputOptions(['-b:v 0', '-crf 32']);
        } else if (fmt === 'mp4') {
            command.videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions(['-preset fast', '-crf 23', '-movflags +faststart', '-vf pad=ceil(iw/2)*2:ceil(ih/2)*2']);
        } else if (fmt === 'mov') {
            command.videoCodec('libx264')
                .audioCodec('aac');
        } else if (fmt === 'avi') {
            command.videoCodec('mpeg4')
                .audioCodec('mp3');
        } else if (fmt === 'mkv') {
            command.videoCodec('libx264')
                .audioCodec('aac');
        }

        if (options.removeAudio) command.noAudio();

        command
            .on('error', (err) => reject(new Error(`Video conversion to ${fmt.toUpperCase()} failed: ${err.message}`)))
            .on('end', () => resolve({ outputPath, success: true }))
            .save(outputPath);
    });
}

/**
 * Extract Audio from Video
 */
function extractAudio(inputPath, outputPath, targetFormat = 'mp3', options = {}) {
    return new Promise((resolve, reject) => {
        const fmt = targetFormat.toLowerCase().trim();
        const bitrate = options.bitrate || '192k';

        const command = ffmpeg(inputPath).noVideo();

        if (fmt === 'mp3') {
            command.audioCodec('libmp3lame').audioBitrate(bitrate);
        } else if (fmt === 'wav') {
            command.audioCodec('pcm_s16le');
        } else if (fmt === 'aac') {
            command.audioCodec('aac').audioBitrate(bitrate);
        } else if (fmt === 'ogg') {
            command.audioCodec('libvorbis').audioBitrate(bitrate);
        }

        if (options.sampleRate) {
            command.audioFrequency(parseInt(options.sampleRate, 10));
        }

        command
            .on('error', (err) => reject(new Error(`Audio extraction failed: ${err.message}`)))
            .on('end', () => resolve({ outputPath, success: true }))
            .save(outputPath);
    });
}

/**
 * Trim Video
 */
function trimVideo(inputPath, outputPath, startTime, endTime) {
    return new Promise((resolve, reject) => {
        const command = ffmpeg(inputPath);

        if (startTime !== undefined && startTime !== null) {
            command.setStartTime(startTime);
        }
        if (endTime !== undefined && endTime !== null) {
            const startSec = typeof startTime === 'number' ? startTime : 0;
            const endSec = typeof endTime === 'number' ? endTime : 10;
            const duration = Math.max(1, endSec - startSec);
            command.setDuration(duration);
        }

        command.videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions(['-preset fast', '-crf 23', '-movflags +faststart'])
            .on('error', (err) => reject(new Error(`Video trim failed: ${err.message}`)))
            .on('end', () => resolve({ outputPath, success: true }))
            .save(outputPath);
    });
}

/**
 * Convert Audio
 */
function convertAudio(inputPath, outputPath, targetFormat, options = {}) {
    return new Promise((resolve, reject) => {
        const fmt = targetFormat.toLowerCase().trim();
        const bitrate = options.bitrate || '192k';
        const command = ffmpeg(inputPath);

        if (fmt === 'mp3') {
            command.audioCodec('libmp3lame').audioBitrate(bitrate);
        } else if (fmt === 'wav') {
            command.audioCodec('pcm_s16le');
        } else if (fmt === 'aac') {
            command.audioCodec('aac').audioBitrate(bitrate);
        } else if (fmt === 'ogg') {
            command.audioCodec('libvorbis').audioBitrate(bitrate);
        } else if (fmt === 'm4a') {
            command.audioCodec('aac').audioBitrate(bitrate);
        } else if (fmt === 'flac') {
            command.audioCodec('flac');
        }

        if (options.sampleRate) {
            command.audioFrequency(parseInt(options.sampleRate, 10));
        }

        command
            .on('error', (err) => reject(new Error(`Audio conversion failed: ${err.message}`)))
            .on('end', () => resolve({ outputPath, success: true }))
            .save(outputPath);
    });
}

/**
 * Compress Audio
 */
function compressAudio(inputPath, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
        const bitrate = options.bitrate || '128k';
        const sampleRate = options.sampleRate || 44100;

        ffmpeg(inputPath)
            .audioCodec('libmp3lame')
            .audioBitrate(bitrate)
            .audioFrequency(sampleRate)
            .audioChannels(options.mono ? 1 : 2)
            .on('error', (err) => reject(new Error(`Audio compression failed: ${err.message}`)))
            .on('end', () => resolve({ outputPath, success: true }))
            .save(outputPath);
    });
}

/**
 * Trim Audio
 */
function trimAudio(inputPath, outputPath, startTime, endTime) {
    return new Promise((resolve, reject) => {
        const command = ffmpeg(inputPath);

        if (startTime !== undefined && startTime !== null) {
            command.setStartTime(startTime);
        }
        if (endTime !== undefined && endTime !== null) {
            const startSec = typeof startTime === 'number' ? startTime : 0;
            const endSec = typeof endTime === 'number' ? endTime : 10;
            const duration = Math.max(1, endSec - startSec);
            command.setDuration(duration);
        }

        command
            .on('error', (err) => reject(new Error(`Audio trim failed: ${err.message}`)))
            .on('end', () => resolve({ outputPath, success: true }))
            .save(outputPath);
    });
}

/**
 * Merge multiple audio files
 */
function mergeAudio(inputPaths, outputPath) {
    return new Promise((resolve, reject) => {
        if (!inputPaths || inputPaths.length === 0) return reject(new Error('No input audio files provided'));
        const cmd = ffmpeg();
        inputPaths.forEach(p => cmd.input(p));
        cmd.complexFilter([
            {
                filter: 'concat',
                options: { n: inputPaths.length, v: 0, a: 1 }
            }
        ])
        .audioCodec('libmp3lame')
        .on('error', (err) => reject(new Error(`Audio merge failed: ${err.message}`)))
        .on('end', () => resolve({ outputPath, success: true }))
        .save(outputPath);
    });
}

/**
 * Adjust audio volume
 */
function adjustVolume(inputPath, outputPath, volumeFactor = 1.0) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioFilters(`volume=${volumeFactor}`)
            .audioCodec('libmp3lame')
            .on('error', (err) => reject(new Error(`Volume adjustment failed: ${err.message}`)))
            .on('end', () => resolve({ outputPath, success: true }))
            .save(outputPath);
    });
}

/**
 * Split audio into segments
 */
function splitAudio(inputPath, outputDir, segmentDuration = 30) {
    return new Promise((resolve, reject) => {
        const outPattern = path.join(outputDir, 'segment_%03d.mp3');
        ffmpeg(inputPath)
            .outputOptions([
                '-f', 'segment',
                '-segment_time', String(segmentDuration),
                '-c', 'copy'
            ])
            .on('error', (err) => reject(new Error(`Audio split failed: ${err.message}`)))
            .on('end', () => {
                const files = fs.readdirSync(outputDir).filter(f => f.startsWith('segment_')).map(f => path.join(outputDir, f));
                resolve({ outputFiles: files, success: true });
            })
            .save(outPattern);
    });
}

/**
 * Merge multiple videos
 */
function mergeVideos(inputPaths, outputPath) {
    return new Promise((resolve, reject) => {
        if (!inputPaths || inputPaths.length === 0) return reject(new Error('No input video files provided'));
        const cmd = ffmpeg();
        inputPaths.forEach(p => cmd.input(p));
        cmd.complexFilter([
            {
                filter: 'concat',
                options: { n: inputPaths.length, v: 1, a: 1 }
            }
        ])
        .outputOptions(['-c:v', 'libx264', '-preset', 'fast', '-crf', '24', '-c:a', 'aac'])
        .on('error', (err) => reject(new Error(`Video merge failed: ${err.message}`)))
        .on('end', () => resolve({ outputPath, success: true }))
        .save(outputPath);
    });
}

/**
 * Convert Video to animated GIF
 */
function videoToGif(inputPath, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
        const fps = options.fps || 10;
        const width = options.width || 480;
        const duration = options.duration || 10;
        const startTime = options.startTime || 0;

        const cmd = ffmpeg(inputPath);
        if (startTime) cmd.setStartTime(startTime);
        cmd.setDuration(duration)
            .complexFilter([`fps=${fps},scale=${width}:-1:flags=lanczos`])
            .on('error', (err) => reject(new Error(`Video to GIF failed: ${err.message}`)))
            .on('end', () => resolve({ outputPath, success: true }))
            .save(outputPath);
    });
}

module.exports = {
    getMediaMetadata,
    compressVideo,
    convertVideo,
    extractAudio,
    trimVideo,
    convertAudio,
    compressAudio,
    trimAudio,
    mergeAudio,
    adjustVolume,
    splitAudio,
    mergeVideos,
    videoToGif
};
