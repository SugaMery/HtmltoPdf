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
    const templatePath = path.join(process.cwd(), "public", "templates", "facture.html");
    let htmlContent = fs.readFileSync(templatePath, "utf-8");

    replacements.forEach(({ searchWord, replaceWord }) => {
      if (searchWord && replaceWord !== undefined) {
        const regex = new RegExp(searchWord, "g");
        if (replaceWord.startsWith("data:image") || replaceWord.startsWith("http")) {
          htmlContent = htmlContent.replace(regex, `<img src="${replaceWord}" style="width: 700px; height: 500px;" />`);
        } else {
          htmlContent = htmlContent.replace(regex, replaceWord || " ");
        }
      }
    });

    // Ensure the 'converted' directory exists
    const convertedDir = path.join(process.cwd(), "public", "converted");
    if (!fs.existsSync(convertedDir)) {
      fs.mkdirSync(convertedDir);
    }

    const pdfPath = path.join(convertedDir, "facture.pdf");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "load" });

    await page.pdf({ path: pdfPath, format: "A4" });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="facture.pdf"`);
    res.send(fs.readFileSync(pdfPath));

    fs.unlinkSync(pdfPath); // Clean up the temporary file
  } catch (error) {
    console.error("Error during conversion:", error);
    res.status(500).send("An error occurred during HTML to PDF conversion.");
  }
}
