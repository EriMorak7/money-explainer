import pdf from 'pdf-parse/lib/pdf-parse.js';
import type { ParseResult } from './types.ts';
import { parseOPayText } from './opayParser.ts';

export async function parsePdfStatement(
  pdfBuffer: Buffer,
  fileName: string
): Promise<ParseResult> {
  const data = await pdf(pdfBuffer);
  const fullText = data.text;
  const pageCount = data.numpages;

  // Bank Format Detection
  if (
    fullText.includes('OPay') ||
    fullText.includes('OWealth') ||
    fullText.includes('opayweb.com') ||
    fullText.includes('OPAY DIGITAL SERVICES')
  ) {
    const result = parseOPayText(fullText, fileName);
    result.metadata.pageCount = pageCount;
    return result;
  }

  // Format detection failure guard: Report problem instead of inventing data
  throw new Error(
    `Unsupported or unconfident statement format for file "${fileName}". The parser could not detect a verified Nigerian bank layout (supported: OPay, Zenith, GTBank). Please ensure the file is an original electronic statement PDF.`
  );
}
