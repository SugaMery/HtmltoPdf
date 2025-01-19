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

    replacements.forEach(({ searchWord, replaceWord }) => {
      if (searchWord && replaceWord !== undefined) {
        const regex = new RegExp(searchWord, "g");
        if (typeof replaceWord === "string" && (replaceWord.startsWith("data:image") || replaceWord.startsWith("http"))) {
          if (searchWord === "{cachet}") {
            //print("Cachet found cachet", replaceWord);
            htmlContent = htmlContent.replace(regex, `<img src="${replaceWord}" style="width: 600px; height: 800px;" />`);
          } else {
            htmlContent = htmlContent.replace(regex, `<img src="${replaceWord}" style="width: 550px; height: 400px;" />`);
          }
          console.log("Image replacement done", htmlContent);
        } else if (replaceWord == "notFound" || replaceWord == "") {
          // Handle empty string replacement
          htmlContent = htmlContent.replace(regex, " ");
        } else {
          // Regular text replacement
          htmlContent = htmlContent.replace(regex, replaceWord);
        }
      }
    });

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
      ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfOptions = {
      format: "A4",
      printBackground: true,
      width: '210mm',
      height: '297mm',
    };
    const pdfBuffer = await page.pdf(pdfOptions);
    await browser.close();

    const generatedPdfDoc = await PDFDocument.load(pdfBuffer);
    const lastPagePdfPath = path.join(process.cwd(), "public", "templates", "lastpage.pdf");
    const lastPagePdfBytes = fs.readFileSync(lastPagePdfPath);
    const lastPagePdfDoc = await PDFDocument.load(lastPagePdfBytes);
    const [lastPage] = await generatedPdfDoc.copyPages(lastPagePdfDoc, [0]);
    generatedPdfDoc.addPage(lastPage);

    const mergedPdfBytes = await generatedPdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="contrat.pdf"`);
    res.send(Buffer.from(mergedPdfBytes));
  } catch (error) {
    console.error("Error during conversion:", error);
    res.status(500).send("An error occurred during HTML to PDF conversion.");
  }
}