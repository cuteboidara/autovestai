const { readFileSync } = require("node:fs");
const { PDFParse } = require("pdf-parse");

async function main() {
  const [, , pdfPath] = process.argv;

  if (!pdfPath) {
    console.error("Usage: node app/scripts/extract_pdf_text.js <pdf-path>");
    process.exit(1);
  }

  const parser = new PDFParse({ data: readFileSync(pdfPath) });

  try {
    const result = await parser.getText();
    process.stdout.write(result.text);
  } finally {
    await parser.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
