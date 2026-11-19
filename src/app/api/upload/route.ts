import { NextRequest, NextResponse } from 'next/server';
import { parsePdfStatement } from '@/lib/parser/pdfParser';
import { parseCsvStatement } from '@/lib/parser/csvParser';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided in request.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds the 20MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please upload a smaller bank statement file.`,
        },
        { status: 413 }
      );
    }

    const fileName = file.name;
    const lowerName = fileName.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. PDF Statement Handling
    if (lowerName.endsWith('.pdf')) {
      // Magic bytes check: %PDF- (0x25 0x50 0x44 0x46)
      if (
        buffer.length < 4 ||
        buffer[0] !== 0x25 ||
        buffer[1] !== 0x50 ||
        buffer[2] !== 0x44 ||
        buffer[3] !== 0x46
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `File "${fileName}" does not appear to be a valid PDF document (invalid magic bytes header).`,
          },
          { status: 422 }
        );
      }

      const parseResult = await parsePdfStatement(buffer, fileName);
      return NextResponse.json({
        success: true,
        data: parseResult,
      });
    }

    // 2. CSV Statement Handling
    if (lowerName.endsWith('.csv')) {
      const csvContent = buffer.toString('utf-8');
      const parseResult = parseCsvStatement(csvContent, fileName);
      return NextResponse.json({
        success: true,
        data: parseResult,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: `File format not yet supported for direct extraction: ${fileName}. Please upload a PDF e-statement or CSV file.`,
      },
      { status: 415 }
    );
  } catch (err: unknown) {
    console.error('Statement extraction error:', err);
    const message = err instanceof Error ? err.message : 'Failed to parse bank statement.';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 422 }
    );
  }
}
