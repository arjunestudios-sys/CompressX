/**
 * Docholder Conversational Assistant Intent Parser & Multi-Step Planner
 */

function parseIntent(query, fileContext = null) {
    const q = (query || '').toLowerCase().trim();

    // Multiple target format recognition (e.g. "convert to PNG and WEBP", "to Word and JPG")
    const formatRegexes = [
        { key: 'docx', regex: /\b(word|docx|doc)\b/i },
        { key: 'pdf', regex: /\b(pdf)\b/i },
        { key: 'xlsx', regex: /\b(excel|xlsx|xls|spreadsheet)\b/i },
        { key: 'csv', regex: /\b(csv)\b/i },
        { key: 'jpg', regex: /\b(jpg|jpeg)\b/i },
        { key: 'png', regex: /\b(png)\b/i },
        { key: 'webp', regex: /\b(webp)\b/i },
        { key: 'tiff', regex: /\b(tiff|tif)\b/i },
        { key: 'bmp', regex: /\b(bmp)\b/i },
        { key: 'gif', regex: /\b(gif)\b/i },
        { key: 'mp3', regex: /\b(mp3|audio)\b/i },
        { key: 'wav', regex: /\b(wav)\b/i },
        { key: 'aac', regex: /\b(aac)\b/i },
        { key: 'ogg', regex: /\b(ogg)\b/i },
        { key: 'mp4', regex: /\b(mp4|video)\b/i },
        { key: 'webm', regex: /\b(webm)\b/i },
        { key: 'mov', regex: /\b(mov)\b/i },
        { key: 'avi', regex: /\b(avi)\b/i },
        { key: 'txt', regex: /\b(txt|text|plain text)\b/i },
        { key: 'html', regex: /\b(html|webpage)\b/i },
        { key: 'md', regex: /\b(markdown|md)\b/i },
        { key: 'json', regex: /\b(json)\b/i },
        { key: 'zip', regex: /\b(zip|archive|compressed)\b/i },
        { key: 'tar.gz', regex: /\b(tar|tar\.gz)\b/i }
    ];

    const matchedFormats = [];
    formatRegexes.forEach(item => {
        if (item.regex.test(q) && !matchedFormats.includes(item.key)) {
            matchedFormats.push(item.key);
        }
    });

    const isMultiExport = matchedFormats.length > 1 || /\b(every|all supported formats|multiple formats)\b/i.test(q);
    const targetFormat = matchedFormats[0] || null;

    // Target size extraction (e.g. "under 500kb", "to 20mb", "smaller than 1 mb", "below 300 kb")
    let targetSize = null;
    const sizeMatch = q.match(/(?:under|below|to|than|less than|within)\s+(\d+(?:\.\d+)?)\s*(kb|mb|gb|bytes?)/i);
    if (sizeMatch) {
        const value = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2].toLowerCase();
        if (unit.startsWith('kb')) targetSize = Math.round(value * 1024);
        else if (unit.startsWith('mb')) targetSize = Math.round(value * 1024 * 1024);
        else if (unit.startsWith('gb')) targetSize = Math.round(value * 1024 * 1024 * 1024);
        else targetSize = Math.round(value);
    }

    // Prepare for presets
    let preparePreset = null;
    if (/\b(twitter|tweet|x\.com)\b/i.test(q)) preparePreset = 'twitter';
    else if (/\b(discord|emote|discord upload)\b/i.test(q)) preparePreset = 'discord';
    else if (/\b(threads|meta threads)\b/i.test(q)) preparePreset = 'threads';
    else if (/\b(instagram|insta|reels?)\b/i.test(q)) preparePreset = 'instagram';
    else if (/\b(tiktok|shorts?)\b/i.test(q)) preparePreset = 'tiktok';
    else if (/\b(youtube|yt|thumbnail)\b/i.test(q)) preparePreset = 'youtube';
    else if (/\b(linkedin)\b/i.test(q)) preparePreset = 'linkedin';
    else if (/\b(email|mail|outlook|gmail)\b/i.test(q)) preparePreset = 'email';
    else if (/\b(whatsapp|telegram|chat|messaging)\b/i.test(q)) preparePreset = 'whatsapp';
    else if (/\b(web|website|online|browser)\b/i.test(q)) preparePreset = 'website';
    else if (/\b(print|printing|press)\b/i.test(q)) preparePreset = 'printing';
    else if (/\b(cloud|backup|drive|dropbox)\b/i.test(q)) preparePreset = 'cloud';

    // Video / Audio specific operations
    const isAudioExtraction = /\b(extract audio|extract mp3|rip audio|get audio|sound track|turn.*to audio)\b/i.test(q) || (/\b(extract)\b/i.test(q) && /\b(mp3|wav|aac|audio)\b/i.test(q));
    const isTrim = /\b(trim|cut|clip)\b/i.test(q);
    const isResize = /\b(resize|resolution|scale|dimensions|1080p|720p|480p)\b/i.test(q);
    const isStripExif = /\b(remove metadata|strip metadata|exif|privacy|clean metadata)\b/i.test(q);

    // Intent resolution
    let intent = 'general';
    let action = 'analyze';
    const pipelineSteps = [];

    if (preparePreset) {
        intent = 'prepare';
        action = `prepare_${preparePreset}`;
        pipelineSteps.push({ stage: 'Prepare', description: `Optimize specifically for ${preparePreset.toUpperCase()}` });
    } else if (isAudioExtraction) {
        intent = 'extract_audio';
        action = 'extract_audio';
        const outAudioFmt = matchedFormats.find(f => ['mp3', 'wav', 'aac', 'ogg'].includes(f)) || 'mp3';
        pipelineSteps.push({ stage: 'Audio Extraction', description: `Extract stream to ${outAudioFmt.toUpperCase()}` });
        if (targetSize) {
            pipelineSteps.push({ stage: 'Compress Audio', description: `Optimize audio below target size` });
        }
    } else if (isMultiExport) {
        intent = 'multi_convert';
        action = 'multi_export';
        matchedFormats.forEach(fmt => {
            pipelineSteps.push({ stage: `Convert → ${fmt.toUpperCase()}`, description: `Generate ${fmt.toUpperCase()} artifact` });
        });
    } else if (isTrim) {
        intent = 'trim';
        action = 'trim_media';
        pipelineSteps.push({ stage: 'Trim', description: 'Cut specified timestamp range' });
    } else if (isResize) {
        intent = 'resize';
        action = 'resize_media';
        pipelineSteps.push({ stage: 'Resize', description: 'Scale dimensions / resolution' });
    } else if (isStripExif) {
        intent = 'strip_exif';
        action = 'strip_metadata';
        pipelineSteps.push({ stage: 'Security', description: 'Wipe all EXIF/IPTC metadata' });
    } else if (/\b(split|extract pages|cut pages|separate)\b/i.test(q)) {
        intent = 'split_pdf';
        action = 'split';
        pipelineSteps.push({ stage: 'Split PDF', description: 'Extract page partitions' });
    } else if (/\b(merge|combine|join|stitch)\b/i.test(q)) {
        intent = 'merge';
        action = 'merge';
        pipelineSteps.push({ stage: 'Merge', description: 'Combine multiple files together' });
    } else if (/\b(watermark|stamp)\b/i.test(q)) {
        intent = 'watermark';
        action = 'watermark';
        pipelineSteps.push({ stage: 'Watermark', description: 'Apply custom watermark' });
    } else if (/\b(convert|turn into|transform|change to|export to|save as|make.*into)\b/i.test(q) && targetFormat) {
        intent = 'convert';
        action = `convert_to_${targetFormat}`;
        pipelineSteps.push({ stage: 'Convert', description: `Convert to ${targetFormat.toUpperCase()}` });
        if (targetSize) {
            pipelineSteps.push({ stage: 'Compress', description: `Reduce below target size` });
        }
    } else if (/\b(make.*smaller|optimize|reduce size|shrink|compress|compact|target size)\b/i.test(q) || targetSize) {
        intent = targetSize ? 'target_size' : 'compress';
        action = targetSize ? 'target_size_compress' : 'optimize';
        pipelineSteps.push({ stage: 'Optimization', description: targetSize ? `Compress below target limit` : 'Apply optimal compression' });
    } else if (targetFormat) {
        intent = 'convert';
        action = `convert_to_${targetFormat}`;
        pipelineSteps.push({ stage: 'Convert', description: `Convert to ${targetFormat.toUpperCase()}` });
    }

    return {
        query,
        intent,
        action,
        targetFormat,
        matchedFormats,
        isMultiExport,
        targetSize,
        preparePreset,
        pipelineSteps,
        confidence: intent === 'general' ? 0.4 : 0.95
    };
}

module.exports = {
    parseIntent
};
