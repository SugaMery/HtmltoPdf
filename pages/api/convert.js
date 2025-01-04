import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { replacements } = req.body;

  if (!replacements || !Array.isArray(replacements)) {
    return res.status(400).send("Invalid input: 'replacements' must be an array.");
  }

  try {
    const templatePath = path.join(process.cwd(), "public", "templates", "finalLast.html");
    let htmlContent = fs.readFileSync(templatePath, "utf-8");

    replacements.forEach(({ searchWord, replaceWord }) => {
      if (searchWord && replaceWord !== undefined) {
        const regex = new RegExp(searchWord, "g");
        if (replaceWord.startsWith("data:image") || replaceWord.startsWith("http")) {
          htmlContent = htmlContent.replace(regex, `<img src="${replaceWord}" style="width: 550px; height: 400px;" />`);
        } else {
          htmlContent = htmlContent.replace(regex, replaceWord || " ");
        }
      }
    });

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "load" });

    // Use /tmp for storing the PDF temporarily
    const pdfPath = path.join("/tmp", "contrat.pdf");
    await page.pdf({ path: pdfPath, format: "A4" });
    await browser.close();

    // Send the PDF as a response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="contrat.pdf"`);
    res.send(fs.readFileSync(pdfPath));

    // Clean up the temporary file
    fs.unlinkSync(pdfPath);
  } catch (error) {
    console.error("Error during conversion:", error);
    res.status(500).send("An error occurred during HTML to PDF conversion.");
  }
}
