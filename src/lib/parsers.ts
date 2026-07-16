// Client-side document parsers. PDF and Word files are converted to plain text;
// Excel files are converted to Markdown tables. All parsing happens in the browser.

export type ContentKind = 'text' | 'markdown';

export interface ParsedDocument {
  content: string;
  kind: ContentKind;
  fileType: 'pdf' | 'word' | 'excel';
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const WORD_EXTS = ['.docx', '.doc'];
const EXCEL_EXTS = ['.xlsx', '.xls', '.csv'];
const PDF_EXTS = ['.pdf'];

export function detectFileType(filename: string): 'pdf' | 'word' | 'excel' | null {
  const lower = filename.toLowerCase();
  if (PDF_EXTS.some((e) => lower.endsWith(e))) return 'pdf';
  if (WORD_EXTS.some((e) => lower.endsWith(e))) return 'word';
  if (EXCEL_EXTS.some((e) => lower.endsWith(e))) return 'excel';
  return null;
}

export function isSupportedFile(filename: string): boolean {
  return detectFileType(filename) !== null;
}

export async function parseFile(file: File): Promise<ParsedDocument> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Ukuran file melebihi batas maksimum ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
  }

  const type = detectFileType(file.name);
  if (!type) {
    throw new Error('Format file tidak didukung. Gunakan PDF, Word, atau Excel.');
  }

  switch (type) {
    case 'pdf':
      return { content: await parsePdf(file), kind: 'text', fileType: 'pdf' };
    case 'word':
      return { content: await parseWord(file), kind: 'text', fileType: 'word' };
    case 'excel':
      return { content: await parseExcel(file), kind: 'markdown', fileType: 'excel' };
  }
}

// ── PDF ──────────────────────────────────────────────────────────────────────

async function parsePdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Use the bundled worker via Vite's ?url import
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
    text += pageText + '\n\n';
  }

  return text.trim() || '[Dokumen PDF tidak memiliki teks yang dapat diekstrak.]';
}

// ── Word ──────────────────────────────────────────────────────────────────────

async function parseWord(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim() || '[Dokumen Word kosong atau tidak memiliki teks.]';
}

// ── Excel ──────────────────────────────────────────────────────────────────────

async function parseExcel(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheets = workbook.SheetNames;
  if (sheets.length === 0) return '[File Excel tidak memiliki sheet.]';

  const parts: string[] = [];

  for (const sheetName of sheets) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: '',
    });

    if (rows.length === 0) {
      parts.push(`### Sheet: ${sheetName}\n\n[Sheet kosong]\n`);
      continue;
    }

    const header = rows[0].map((c) => String(c ?? ''));
    const dataRows = rows.slice(1);

    let table = `| ${header.join(' | ')} |\n`;
    table += `| ${header.map(() => '---').join(' | ')} |\n`;
    for (const row of dataRows) {
      const cells = (row as unknown[]).map((c) => String(c ?? ''));
      table += `| ${cells.join(' | ')} |\n`;
    }

    parts.push(`### Sheet: ${sheetName}\n\n${table}`);
  }

  return parts.join('\n').trim();
}
