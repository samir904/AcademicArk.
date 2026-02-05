// UTIL/generatePreviewFromUrl.js
import axios from "axios";
import { PDFDocument } from "pdf-lib";

export async function generatePreviewFromUrl(pdfUrl, maxPages = 8) {
  const response = await axios.get(pdfUrl, {
    responseType: "arraybuffer"
  });

  const pdfDoc = await PDFDocument.load(response.data);
  const previewPdf = await PDFDocument.create();

  const pageCount = Math.min(maxPages, pdfDoc.getPageCount());

  const pages = await previewPdf.copyPages(
    pdfDoc,
    Array.from({ length: pageCount }, (_, i) => i)
  );

  pages.forEach(p => previewPdf.addPage(p));

  return await previewPdf.save(); // Buffer
}
