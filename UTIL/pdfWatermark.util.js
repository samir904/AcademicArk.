import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';

export const addWatermarkToPDF = async (
  filePath,
  watermarkText = 'AcademicArk'
) => {
  try {
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,  // ← key fix
      parseSpeed: 1500,
    });

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    // Embed font ONCE outside the loop
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const websiteText = 'Visit: academicark-mvp8.onrender.com';
    const websiteFontSize = 9;

    for (let index = 0; index < pages.length; index++) {
      const page = pages[index];

      try {
        const { width, height } = page.getSize();

        /* =====================
           Main watermark (ALL pages)
           ===================== */
        page.drawText(watermarkText, {
          x: width / 2 - 45,
          y: 30,
          size: 18,
          font,
          color: rgb(0.3, 0.3, 0.3),
          opacity: 0.95,
        });

        /* =====================
           Website URL (ONLY first & last page)
           ===================== */
        if (index === 0 || index === totalPages - 1) {
          const textWidth = font.widthOfTextAtSize(websiteText, websiteFontSize);
          page.drawText(websiteText, {
            x: width - textWidth - 20,
            y: 15,
            size: websiteFontSize,
            font,
            color: rgb(0.4, 0.4, 0.6),
            opacity: 0.6,
          });
        }
      } catch (pageErr) {
        // Skip broken pages without crashing the whole upload
        console.warn(`⚠️ Skipped watermark on page ${index + 1}: ${pageErr.message}`);
      }
    }

    const watermarkedBytes = await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
    });

    await fs.writeFile(filePath, Buffer.from(watermarkedBytes));
    console.log('✅ Watermark added (URL on first & last page only)');
    return true;

  } catch (error) {
    console.error('❌ Watermark error:', error.message);
    throw error;
  }
};
