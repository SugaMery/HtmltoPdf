import fs from "fs";
import path from "path";
import { PDFDocument, rgb } from "pdf-lib";
import pdfParse from "pdf-parse";

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
    const pdfPath = path.join(process.cwd(), "public", "templates", "contrat.pdf");
    const pdfBytes = fs.readFileSync(pdfPath);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pdfData = await pdfParse(pdfBytes);

    let anyReplacementsMade = false;

    for (const { searchWord, replaceWord } of replacements) {
      const pages = pdfDoc.getPages();
      let found = false;
      for (const page of pages) {
        const { width, height } = page.getSize();
        const textContent = pdfData.text;

        if (textContent.includes(searchWord)) {
          found = true;
          anyReplacementsMade = true;
          const textInstances = textContent.split(searchWord);
          let yOffset = height;

          for (let i = 0; i < textInstances.length - 1; i++) {
            const x = 0; // You need to determine the correct x coordinate
            yOffset -= 20; // Adjust yOffset as needed
            page.drawText(replaceWord, { x, y: yOffset, size: 12, color: rgb(0, 0, 0) });
          }
        }
      }
      console.log(`Search word: "${searchWord}", Found: ${found}`);
    }

    if (anyReplacementsMade) {
      const modifiedPdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="modified_contrat.pdf"`);
      res.send(Buffer.from(modifiedPdfBytes));
      console.log("PDF modified and saved successfully.");
    } else {
      res.status(200).send("No replacements made.");
      console.log("No replacements were made.");
    }
  } catch (error) {
    console.error("Error during PDF modification:", error);
    res.status(500).send("An error occurred during PDF modification.");
  }
}
