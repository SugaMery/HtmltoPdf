import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { PDFDocument } from "pdf-lib";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { replacements } = req.body;

  if (!replacements || !Array.isArray(replacements)) {
    return res.status(400).send("Invalid input: 'replacements' must be an array.");
  }

  // Validate each replacement object
  for (const replacement of replacements) {
    if (
      typeof replacement !== "object" ||
      !replacement.hasOwnProperty("searchWord") ||
      !replacement.hasOwnProperty("replaceWord")
    ) {
      return res.status(400).send("Invalid input: each replacement must be an object with 'searchWord' and 'replaceWord' properties.");
    }
  }

  try {
    const templatePath = path.join(process.cwd(), "public", "templates", "finalLast.html");
    let htmlContent = fs.readFileSync(templatePath, "utf-8");

    // Create a map of searchWord to replaceWord
    const replacementsMap = new Map();
    replacements.forEach(({ searchWord, replaceWord }) => {
      if (searchWord && replaceWord !== undefined) {
        replacementsMap.set(searchWord, replaceWord);
      }
    });

    // Create a single regex to match all searchWords
    const searchWords = Array.from(replacementsMap.keys()).join("|");
    const regex = new RegExp(searchWords, "g");

    // Replace all searchWords in one pass
    htmlContent = htmlContent.replace(regex, (matched) => {
      const replaceWord = replacementsMap.get(matched);
      if (replaceWord.startsWith("data:image") || replaceWord.startsWith("http")) {
        return `<img src="${replaceWord}" style="width: 550px; height: 400px;" />`;
      } else if (replaceWord == "notFound" || replaceWord == "") {
        return " ";
      } else {
        return replaceWord;
      }
    });

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "load" });

    // Use /tmp for storing the PDF temporarily
    const pdfPath = path.join("/tmp", "contrat.pdf");
    const pdfOptions = {
      path: pdfPath,
      format: "A4",
      printBackground: true,
      width: '210mm', // A4 width
      height: '297mm', // A4 height
    };
    await page.pdf(pdfOptions);
    await browser.close();

    // Load the generated PDF and the last page PDF
    const generatedPdfBytes = fs.readFileSync(pdfPath);
    const lastPagePdfPath = path.join(process.cwd(), "public", "templates", "lastpage.pdf");
    const lastPagePdfBytes = fs.readFileSync(lastPagePdfPath);

    // Merge the PDFs
    const generatedPdfDoc = await PDFDocument.load(generatedPdfBytes);
    const lastPagePdfDoc = await PDFDocument.load(lastPagePdfBytes);

    // Remove any blank pages from the generated PDF
    const pages = generatedPdfDoc.getPages();
    for (let i = pages.length - 1; i >= 0; i--) {
      if (pages[i].getTextContent().items.length === 0) {
        generatedPdfDoc.removePage(i);
      }
    }

    const [lastPage] = await generatedPdfDoc.copyPages(lastPagePdfDoc, [0]);
    generatedPdfDoc.addPage(lastPage);

    const mergedPdfBytes = await generatedPdfDoc.save();

    // Send the merged PDF as a response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="contrat.pdf"`);
    res.send(Buffer.from(mergedPdfBytes));

    // Clean up the temporary file
    fs.unlinkSync(pdfPath);
  } catch (error) {
    console.error("Error during conversion:", error);
    res.status(500).send("An error occurred during HTML to PDF conversion.");
  }
}
