const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const PDFDocument = require('pdfkit');

/**
 * Docholder PowerPoint (.pptx) Engine
 * Generates and converts Office OpenXML presentations natively
 */

function escapeXml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Generate a standard, compliant .pptx presentation file
 * @param {Array<{title: string, bullets: string[]}>} slides
 * @param {string} outputPath
 */
async function generatePptx(slides, outputPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve({ outputPath, size: archive.pointer() }));
        archive.on('error', (err) => reject(err));
        archive.pipe(output);

        // 1. [Content_Types].xml
        let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`;
        
        for (let i = 1; i <= slides.length; i++) {
            contentTypes += `\n  <Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
        }
        contentTypes += `\n</Types>`;
        archive.append(contentTypes, { name: '[Content_Types].xml' });

        // 2. _rels/.rels
        const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
        archive.append(rootRels, { name: '_rels/.rels' });

        // 3. ppt/_rels/presentation.xml.rels
        let presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
        for (let i = 1; i <= slides.length; i++) {
            presRels += `\n  <Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`;
        }
        presRels += `\n</Relationships>`;
        archive.append(presRels, { name: 'ppt/_rels/presentation.xml.rels' });

        // 4. ppt/presentation.xml
        let presXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/officeDocument/2006/presentationml">
  <p:sldIdLst>`;
        for (let i = 1; i <= slides.length; i++) {
            presXml += `\n    <p:sldId id="${255 + i}" r:id="rId${i}"/>`;
        }
        presXml += `\n  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="5143500"/>
</p:presentation>`;
        archive.append(presXml, { name: 'ppt/presentation.xml' });

        // 5. Slides
        slides.forEach((slide, idx) => {
            const slideNum = idx + 1;
            let bulletXml = '';
            (slide.bullets || []).forEach(b => {
                bulletXml += `
            <a:p>
              <a:pPr lvl="0"/>
              <a:r>
                <a:rPr lang="en-US" sz="1800"/>
                <a:t>${escapeXml(b)}</a:t>
              </a:r>
            </a:p>`;
            });

            const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/officeDocument/2006/presentationml">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
      <!-- Title Box -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="838200" y="457200"/>
            <a:ext cx="7467600" cy="800100"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="2800" b="1">
                <a:solidFill><a:srgbClr val="0F172A"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(slide.title || `Slide ${slideNum}`)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Content Box -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Content"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="838200" y="1400000"/>
            <a:ext cx="7467600" cy="3200000"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          ${bulletXml}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
            archive.append(slideXml, { name: `ppt/slides/slide${slideNum}.xml` });
        });

        archive.finalize();
    });
}

/**
 * Extract slides text from a PPTX file
 */
function extractPptxText(pptxPath) {
    try {
        const zip = new AdmZip(pptxPath);
        const zipEntries = zip.getEntries();
        const slides = [];

        zipEntries
            .filter(e => e.entryName.startsWith('ppt/slides/slide') && e.entryName.endsWith('.xml'))
            .sort((a, b) => {
                const numA = parseInt(a.entryName.replace(/\D/g, '') || '0', 10);
                const numB = parseInt(b.entryName.replace(/\D/g, '') || '0', 10);
                return numA - numB;
            })
            .forEach((entry, idx) => {
                const xml = entry.getData().toString('utf8');
                // Extract all <a:t> text nodes
                const matches = xml.match(/<a:t>([^<]+)<\/a:t>/g) || [];
                const lines = matches.map(m => m.replace(/<\/?a:t>/g, '').trim()).filter(Boolean);
                slides.push({
                    title: lines[0] || `Slide ${idx + 1}`,
                    content: lines.slice(1).join('\n')
                });
            });

        return slides;
    } catch(e) {
        console.warn('PPTX parsing error:', e);
        return [];
    }
}

/**
 * Convert PPTX presentation to PDF document
 */
async function pptxToPdf(pptxPath, outputPath) {
    const slides = extractPptxText(pptxPath);
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: [792, 612], // 11 x 8.5 inches landscape
            margin: 50
        });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        if (slides.length === 0) {
            doc.fontSize(24).font('Helvetica-Bold').text('Presentation', 50, 100);
            doc.fontSize(14).font('Helvetica').text('No text content could be extracted.', 50, 150);
        } else {
            slides.forEach((s, idx) => {
                if (idx > 0) doc.addPage();
                // Slide Background
                doc.rect(20, 20, 752, 572).lineWidth(1).strokeColor('#CBD5E1').stroke();
                
                // Header Title
                doc.fontSize(22).font('Helvetica-Bold').fillColor('#0F172A').text(s.title, 50, 50, { width: 692 });
                doc.moveDown(0.5);
                doc.strokeColor('#6366F1').lineWidth(2).moveTo(50, doc.y).lineTo(742, doc.y).stroke();
                doc.moveDown(1.5);

                // Body Content
                doc.fontSize(13).font('Helvetica').fillColor('#334155').lineGap(6).text(s.content || '', 50, doc.y, { width: 692 });

                // Footer
                doc.fontSize(9).font('Helvetica').fillColor('#94A3B8').text(`Docholder Presentation • Slide ${idx + 1} of ${slides.length}`, 50, 550, { width: 692, align: 'right' });
            });
        }

        doc.end();
        stream.on('finish', () => resolve({ outputPath, size: fs.statSync(outputPath).size }));
        stream.on('error', reject);
    });
}

/**
 * Convert raw text or document paragraphs into structured PPTX slides
 */
async function textToPptx(text, title, outputPath) {
    const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
    const slides = [];

    // Title slide
    slides.push({
        title: title || 'Executive Summary',
        bullets: lines.slice(0, 4)
    });

    // Group remaining into chunks of 4-5 bullet points
    const rest = lines.slice(4);
    for (let i = 0; i < rest.length; i += 5) {
        const chunk = rest.slice(i, i + 5);
        slides.push({
            title: `Section ${Math.floor(i / 5) + 1}`,
            bullets: chunk
        });
    }

    if (slides.length === 0) {
        slides.push({ title: title || 'Document Overview', bullets: ['No text segments detected.'] });
    }

    return generatePptx(slides, outputPath);
}

module.exports = {
    generatePptx,
    extractPptxText,
    pptxToPdf,
    textToPptx
};
