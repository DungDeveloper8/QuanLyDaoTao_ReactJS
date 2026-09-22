function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function sanitizeSheetName(value) {
  return String(value || 'Du lieu')
    .replace(/[\\/?*\[\]:]/g, ' ')
    .trim()
    .slice(0, 31) || 'Du lieu';
}

export function normalizeExcelHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getExcelValue(row, aliases) {
  const normalizedAliases = (Array.isArray(aliases) ? aliases : [aliases])
    .map(normalizeExcelHeader);
  const entries = Object.entries(row || {});

  for (const [header, value] of entries) {
    if (
      normalizedAliases.includes(normalizeExcelHeader(header)) &&
      value != null &&
      String(value).trim() !== ''
    ) {
      return value;
    }
  }

  return '';
}

export function getExcelNumber(row, aliases, fallback = Number.NaN) {
  const raw = getExcelValue(row, aliases);
  if (raw === '') return Number(fallback);
  const value = Number(String(raw).trim().replace(',', '.'));
  return Number.isFinite(value) ? value : Number.NaN;
}

export function normalizeExcelDate(value) {
  if (value == null || String(value).trim() === '') return '';
  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const vietnameseDate = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (vietnameseDate) {
    const [, day, month, year] = vietnameseDate;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const base = Date.UTC(1899, 11, 30);
    const date = new Date(base + Math.round(serial) * 86400000);
    return date.toISOString().slice(0, 10);
  }

  return '';
}

function createCell(value, type = 'String', styleId = 'Cell') {
  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

export function downloadExcel2003({ fileName, sheetName, columns, rows }) {
  if (!Array.isArray(columns) || !columns.length) {
    throw new Error('Cấu hình cột Excel không hợp lệ.');
  }

  const safeRows = Array.isArray(rows) ? rows : [];
  const header = columns
    .map((column) => createCell(column.label, 'String', 'Header'))
    .join('');
  const columnDefinitions = columns
    .map((column) => `<Column ss:AutoFitWidth="1" ss:Width="${Number(column.width) || 120}"/>`)
    .join('');
  const body = safeRows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const value = typeof column.value === 'function'
            ? column.value(row)
            : row?.[column.value];
          const numeric = column.type === 'Number' && value !== '' && value != null;

          return createCell(
            numeric ? Number(value) : value,
            numeric ? 'Number' : 'String',
            numeric ? 'NumberCell' : 'Cell',
          );
        })
        .join('');

      return `<Row>${cells}</Row>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Arial" ss:Size="10"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#173B67" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="Cell">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="NumberCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sanitizeSheetName(sheetName))}">
  <Table>
   ${columnDefinitions}
   <Row ss:Height="22">${header}</Row>
   ${body}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([`\ufeff${xml}`], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.xls') ? fileName : `${fileName}.xls`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function parseDelimitedRow(line, separator) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === separator && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function rowsToObjects(rows) {
  const [headerRow = [], ...bodyRows] = rows;
  const headers = headerRow.map((value) => String(value ?? '').trim());

  if (!headers.some(Boolean)) {
    throw new Error('Tệp Excel không có hàng tiêu đề.');
  }

  return bodyRows
    .filter((row) => row.some((value) => String(value ?? '').trim() !== ''))
    .map((row) => Object.fromEntries(
      headers.map((header, index) => [header, row[index] ?? '']),
    ));
}

function parseSpreadsheetXml(text) {
  const documentXml = new DOMParser().parseFromString(text, 'application/xml');
  if (documentXml.querySelector('parsererror')) {
    throw new Error('Không đọc được tệp .xls. Hãy dùng tệp Excel do hệ thống xuất.');
  }

  const rowNodes = [...documentXml.getElementsByTagNameNS('*', 'Row')];
  if (!rowNodes.length) {
    throw new Error('Không tìm thấy dữ liệu bảng trong tệp Excel.');
  }

  const rows = rowNodes.map((rowNode) => {
    const cells = [...rowNode.getElementsByTagNameNS('*', 'Cell')];
    const values = [];
    let targetIndex = 0;

    for (const cell of cells) {
      const explicitIndex = [...cell.attributes].find(
        (attribute) => attribute.localName === 'Index',
      );
      if (explicitIndex) targetIndex = Math.max(0, Number(explicitIndex.value) - 1);

      const dataNode = cell.getElementsByTagNameNS('*', 'Data')[0];
      values[targetIndex] = dataNode?.textContent ?? '';
      targetIndex += 1;
    }

    return values;
  });

  return rowsToObjects(rows);
}

function parseCsv(text) {
  const normalized = text.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  const lines = normalized.split('\n');
  const separator = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  return rowsToObjects(lines.map((line) => parseDelimitedRow(line, separator)));
}

function xmlDocument(text, message) {
  const documentXml = new DOMParser().parseFromString(text, 'application/xml');
  if (documentXml.querySelector('parsererror')) throw new Error(message);
  return documentXml;
}

function localElements(node, localName) {
  return [...node.getElementsByTagNameNS('*', localName)];
}

function decodeEntry(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

function normalizeWorkbookTarget(target) {
  const value = String(target || '').replace(/^\//, '');
  if (value.startsWith('xl/')) return value;
  return `xl/${value.replace(/^\.\//, '')}`;
}

async function unzipXlsx(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const minOffset = Math.max(0, bytes.length - 65557);
  let eocdOffset = -1;

  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Tệp .xlsx không có cấu trúc ZIP hợp lệ.');

  const entryCount = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('Không đọc được danh mục tệp bên trong .xlsx.');
    }

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder('utf-8').decode(
      bytes.slice(offset + 46, offset + 46 + fileNameLength),
    );

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error('Tệp .xlsx có mục ZIP không hợp lệ.');
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);

    let content;
    if (method === 0) {
      content = compressed;
    } else if (method === 8) {
      if (!globalThis.DecompressionStream) {
        throw new Error('Trình duyệt chưa hỗ trợ giải nén .xlsx. Hãy dùng Chrome/Edge mới hoặc tệp .xls.');
      }
      const stream = new Blob([compressed])
        .stream()
        .pipeThrough(new DecompressionStream('deflate-raw'));
      content = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error(`Tệp .xlsx dùng kiểu nén chưa hỗ trợ (${method}).`);
    }

    entries.set(name, content);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function xlsxSharedStrings(entries) {
  const content = entries.get('xl/sharedStrings.xml');
  if (!content) return [];
  const documentXml = xmlDocument(decodeEntry(content), 'Shared strings trong .xlsx không hợp lệ.');
  return localElements(documentXml, 'si').map((item) =>
    localElements(item, 't').map((node) => node.textContent || '').join(''),
  );
}

function firstWorksheetPath(entries) {
  const workbookContent = entries.get('xl/workbook.xml');
  const relationshipsContent = entries.get('xl/_rels/workbook.xml.rels');

  if (workbookContent && relationshipsContent) {
    const workbook = xmlDocument(decodeEntry(workbookContent), 'workbook.xml không hợp lệ.');
    const firstSheet = localElements(workbook, 'sheet')[0];
    const relationshipId = firstSheet
      ? [...firstSheet.attributes].find((attribute) => attribute.localName === 'id')?.value
      : '';

    if (relationshipId) {
      const relationships = xmlDocument(
        decodeEntry(relationshipsContent),
        'Quan hệ workbook trong .xlsx không hợp lệ.',
      );
      const relationship = localElements(relationships, 'Relationship')
        .find((item) => item.getAttribute('Id') === relationshipId);
      const target = relationship?.getAttribute('Target');
      if (target) return normalizeWorkbookTarget(target);
    }
  }

  return [...entries.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort()[0];
}

function parseXlsxWorksheet(entries) {
  const worksheetPath = firstWorksheetPath(entries);
  if (!worksheetPath || !entries.has(worksheetPath)) {
    throw new Error('Không tìm thấy worksheet trong tệp .xlsx.');
  }

  const sharedStrings = xlsxSharedStrings(entries);
  const sheet = xmlDocument(decodeEntry(entries.get(worksheetPath)), 'Worksheet trong .xlsx không hợp lệ.');
  const rows = localElements(sheet, 'row').map((rowNode) => {
    const row = [];
    for (const cell of localElements(rowNode, 'c')) {
      const reference = cell.getAttribute('r') || '';
      const columnLetters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
      let columnIndex = 0;
      for (const letter of columnLetters) {
        columnIndex = columnIndex * 26 + (letter.charCodeAt(0) - 64);
      }
      columnIndex = Math.max(0, columnIndex - 1);

      const type = cell.getAttribute('t');
      const raw = localElements(cell, 'v')[0]?.textContent ?? '';
      let value = raw;
      if (type === 's') value = sharedStrings[Number(raw)] ?? '';
      if (type === 'inlineStr') {
        value = localElements(cell, 't').map((node) => node.textContent || '').join('');
      }
      row[columnIndex] = value;
    }
    return row;
  });

  return rowsToObjects(rows);
}

async function parseXlsx(file) {
  const entries = await unzipXlsx(await file.arrayBuffer());
  return parseXlsxWorksheet(entries);
}

export async function readExcelTable(file) {
  if (!file) return [];
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (!['xlsx', 'xls', 'csv'].includes(extension)) {
    throw new Error('Chỉ hỗ trợ .xlsx, .xls hoặc .csv.');
  }

  if (extension === 'xlsx') return parseXlsx(file);
  const text = await file.text();
  return extension === 'csv' ? parseCsv(text) : parseSpreadsheetXml(text);
}
