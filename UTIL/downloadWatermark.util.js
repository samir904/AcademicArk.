import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs/promises';

// ✨ MASK EMAIL FUNCTION
const maskEmail = (email) => {
  const [localPart, domain] = email.split('@');

  // Show first char + last char, mask middle
  if (localPart.length <= 2) {
    return `*@${domain}`;
  }

  const firstChar = localPart.charAt(0);
  const lastChar = localPart.charAt(localPart.length - 1);
  const maskedMiddle = '*'.repeat(localPart.length - 2);

  return `${firstChar}${maskedMiddle}${lastChar}@${domain}`;
};

// ✨ FORMAT DATE FUNCTION
const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};
// ✨ CAPITALIZE FULL NAME FUNCTION
const capitalizeFullName = (fullName) => {
  if (!fullName) return fullName;
  
  return fullName
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

// ✨ MAIN DOWNLOAD WATERMARK FUNCTION
export const addDownloadWatermarkToPDF = async (pdfBuffer, userDetails) => {
  try {
    const { fullName, email, downloadDate } = userDetails;

    // Mask the email
    const capitalizedName = capitalizeFullName(fullName);
    const maskedEmail = maskEmail(email);
    const formattedDate = formatDate(downloadDate);

    // Load PDF from buffer
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    //  const footerText = `Downloaded by ${fullName} • ${maskedEmail} • AcademicArk • ${formattedDate}`;
    const footerText = `Downloaded by ${capitalizedName} • AcademicArk • ${formattedDate}`;

    // Add watermark to every page
    pages.forEach((page) => {
      const { width, height } = page.getSize();
      page.drawLine({
        start: { x: 25, y: 28 },
        end: { x: width - 25, y: 28 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
        opacity: 0.4,
      });

      // Draw footer text at bottom
      page.drawText(footerText, {
        x: 30,                           // 30px from left
        y: 15,                           // 15px from bottom
        size: 11,                         // 9.5pt font
        color: rgb(0.2, 0.5, 0.6) ,   // Teal blue 
        opacity: 0.95,                    // 90% opacity (visible but subtle)
      });
    });

    // Save and return buffer
    const watermarkedBytes = await pdfDoc.save();
    return Buffer.from(watermarkedBytes);

  } catch (error) {
    console.error('❌ Download watermark error:', error.message);
    throw error;
  }
};

// ✨ LIGHTWEIGHT VERSION (Just text, no download date)
export const addSimpleDownloadWatermark = async (pdfBuffer, fullName, maskedEmail) => {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    const footerText = `Downloaded by: ${fullName} (${maskedEmail}) | AcademicArk`;

    pages.forEach((page) => {
      const { width, height } = page.getSize();

      page.drawText(footerText, {
        x: 30,
        y: 15,
        size: 8,
        color: rgb(0.4, 0.4, 0.4),
        opacity: 0.7,
      });
    });

    const watermarkedBytes = await pdfDoc.save();
    return Buffer.from(watermarkedBytes);

  } catch (error) {
    console.error('❌ Simple download watermark error:', error.message);
    throw error;
  }
};

// ✨ ADVANCED VERSION (With diagonal watermark option)
export const addAdvancedDownloadWatermark = async (
  pdfBuffer,
  userDetails,
  options = {}
) => {
  try {
    const { fullName, email, downloadDate } = userDetails;
    const { addDiagonal = false, diagonalText = 'FOR PERSONAL USE ONLY' } = options;

    const maskedEmail = maskEmail(email);
    const formattedDate = formatDate(downloadDate);

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    const footerText = `Downloaded by: ${fullName} (${maskedEmail}) | ${formattedDate} | AcademicArk`;

    pages.forEach((page, index) => {
      const { width, height } = page.getSize();

      // Add footer on every page
      page.drawText(footerText, {
        x: 30,
        y: 15,
        size: 8,
        color: rgb(0.4, 0.4, 0.4),
        opacity: 0.7,
      });

      // Add diagonal watermark if enabled
      if (addDiagonal) {
        page.drawText(diagonalText, {
          x: width / 2 - 100,
          y: height / 2,
          size: 48,
          color: rgb(0.7, 0.7, 0.7),
          opacity: 0.15,
          rotate: 45, // 45 degree angle
        });
      }

      // Highlight first page with header
      if (index === 0) {
        page.drawText('ACADEMIC RESOURCE - PERSONAL USE ONLY', {
          x: 30,
          y: height - 30,
          size: 9,
          color: rgb(0.3, 0.3, 0.5),
          opacity: 0.6,
        });
      }
    });

    const watermarkedBytes = await pdfDoc.save();
    return Buffer.from(watermarkedBytes);

  } catch (error) {
    console.error('❌ Advanced download watermark error:', error.message);
    throw error;
  }
};

// ✨ UTILITY FUNCTIONS

export const getDisplayEmail = (email) => {
  return maskEmail(email);
};

export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const getFormattedDateTime = (date) => {
  return formatDate(date);
};
