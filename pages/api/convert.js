import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";
import chromium from "chrome-aws-lambda";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { replacements } = req.body;

  if (!replacements || !Array.isArray(replacements)) {
    return res.status(400).send("Invalid input: 'replacements' must be an array.");
  }

  try {
    // Path to the HTML template
    const templatePath = path.join(process.cwd(), "public", "templates", "finalLast.html");
    let htmlContent = fs.readFileSync(templatePath, "utf-8");

    // Perform search and replace for each replacement
    replacements.forEach(({ searchWord, replaceWord }) => {
      if (searchWord && replaceWord !== undefined) {
        const regex = new RegExp(searchWord, "g");
        if (replaceWord.startsWith("data:image") || replaceWord.startsWith("http")) {
          // Replace with an image tag
          htmlContent = htmlContent.replace(regex, `<img src="${replaceWord}" style="width: 550px; height: 400px;" />`);
        } else {
          // Replace with text or an empty space
          htmlContent = htmlContent.replace(regex, replaceWord || " ");
        }
      }
    });

    // Use /tmp for storing the PDF, as it's writable in serverless environments
    const pdfPath = path.join("/tmp", "contrat.pdf");

    // Launch Puppeteer with Vercel-compatible settings
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "load" });

    // Generate the PDF
    await page.pdf({ path: pdfPath, format: "A4" });
    await browser.close();

    // Serve the PDF as a response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="contrat.pdf"`);
    res.send(fs.readFileSync(pdfPath));

    // Clean up the temporary PDF file (optional, as it's in the /tmp directory and will be cleared after execution)
    fs.unlinkSync(pdfPath);
  } catch (error) {
    console.error("Error during conversion:", error);
    res.status(500).send("An error occurred during HTML to PDF conversion.");
  }
}
