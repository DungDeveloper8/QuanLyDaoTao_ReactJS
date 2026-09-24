import { SCHOOL_NAME } from '../../app/config.js';

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

  for (const [header, value] of Object.entries(row || {})) {
    if (
      normalizedAliases.includes(normalizeExcelHeader(header))
      && value != null
      && String(value).trim() !== ''
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
    return new Date(base + Math.round(serial) * 86400000).toISOString().slice(0, 10);
  }

  return '';
}

function cell(value, { type = 'String', style = 'TextOdd', mergeAcross = 0 } = {}) {
  const merge = mergeAcross > 0 ? ` ss:MergeAcross="${mergeAcross}"` : '';
  return `<Cell ss:StyleID="${style}"${merge}><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function row(cells, height) {
  const rowHeight = height ? ` ss:Height="${height}"` : '';
  return `<Row${rowHeight}>${cells.join('')}</Row>`;
}

function valueOf(column, item) {
  return typeof column.value === 'function' ? column.value(item) : item?.[column.value];
}

function formatExportDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function columnWidth(column, rows) {
  const configured = Number(column.width);
  if (Number.isFinite(configured) && configured > 0) return configured;

  const values = rows.slice(0, 80).map((item) => String(valueOf(column, item) ?? ''));
  const maxLength = Math.max(String(column.label || '').length, ...values.map((value) => value.length));
  return clamp(maxLength * 6.2 + 18, 58, 220);
}

function statusStyle(value) {
  const normalized = normalizeExcelHeader(value);
  if (['dat', 'du dieu kien', 'dang hoc', 'da tot nghiep'].includes(normalized)) return 'StatusGood';
  if (['khong dat', 'khong du dieu kien', 'thoi hoc'].includes(normalized)) return 'StatusBad';
  if (['bao luu', 'chua nhap', 'chua co'].includes(normalized)) return 'StatusWarn';
  return '';
}

function inferredAlignment(column) {
  if (column.align) return column.align;
  if (column.type === 'Number') return 'center';

  const label = normalizeExcelHeader(column.label);
  if (/^(ma|gioi tinh|ngay sinh|lop|so dien thoai|trang thai|diem|ket qua|xep loai|so tc|tin chi)/.test(label)) {
    return 'center';
  }

  return 'left';
}

function bodyStyle(column, value, rowIndex) {
  const status = statusStyle(value);
  if (status) return status;

  const suffix = rowIndex % 2 === 0 ? 'Even' : 'Odd';
  if (column.type === 'Number') return `Number${suffix}`;
  if (inferredAlignment(column) === 'center') return `Center${suffix}`;
  if (inferredAlignment(column) === 'right') return `Right${suffix}`;
  return `Text${suffix}`;
}

function buildDataRows(columns, rows, template) {
  return rows.map((item, rowIndex) => row(columns.map((column) => {
    const raw = valueOf(column, item);
    const numeric = column.type === 'Number'
      && raw !== ''
      && raw != null
      && Number.isFinite(Number(raw));

    return cell(numeric ? Number(raw) : raw, {
      type: numeric ? 'Number' : 'String',
      style: template
        ? (numeric ? 'TemplateNumber' : 'TemplateInput')
        : bodyStyle(column, raw, rowIndex),
    });
  }), 24)).join('\n   ');
}

function buildMetadataRows(metadata, columnCount) {
  return (Array.isArray(metadata) ? metadata : [])
    .filter((item) => item?.value != null && String(item.value).trim() !== '')
    .map((item) => row([
      cell(`${item.label || ''}: ${item.value}`, {
        style: 'Meta',
        mergeAcross: columnCount - 1,
      }),
    ], 20));
}

function styles() {
  return `<Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Color="#1F2937"/>
  </Style>
  <Style ss:ID="Brand">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="11" ss:Bold="1" ss:Color="#17365D"/>
  </Style>
  <Style ss:ID="Title">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Times New Roman" ss:Size="16" ss:Bold="1" ss:Color="#0F2742"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Italic="1" ss:Color="#52677D"/>
  </Style>
  <Style ss:ID="Meta">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Color="#334E68"/>
   <Interior ss:Color="#F7FAFC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1F4E78" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#163A5B"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#163A5B"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#163A5B"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#163A5B"/>
   </Borders>
  </Style>
  <Style ss:ID="TemplateHeader" ss:Parent="Header">
   <Interior ss:Color="#1F4E78" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="BaseCell">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Color="#1F2937"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D5DEE8"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D5DEE8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D5DEE8"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D5DEE8"/>
   </Borders>
  </Style>
  <Style ss:ID="TextOdd" ss:Parent="BaseCell"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="TextEven" ss:Parent="BaseCell"><Interior ss:Color="#F6F9FC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CenterOdd" ss:Parent="BaseCell"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CenterEven" ss:Parent="BaseCell"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#F6F9FC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="RightOdd" ss:Parent="BaseCell"><Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="RightEven" ss:Parent="BaseCell"><Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#F6F9FC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="NumberOdd" ss:Parent="CenterOdd"><NumberFormat ss:Format="0.##"/></Style>
  <Style ss:ID="NumberEven" ss:Parent="CenterEven"><NumberFormat ss:Format="0.##"/></Style>
  <Style ss:ID="TemplateInput" ss:Parent="BaseCell"><Interior ss:Color="#FFFBEA" ss:Pattern="Solid"/></Style>
  <Style ss:ID="TemplateNumber" ss:Parent="TemplateInput"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><NumberFormat ss:Format="0.##"/></Style>
  <Style ss:ID="StatusGood" ss:Parent="BaseCell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1" ss:Color="#166534"/>
   <Interior ss:Color="#E8F5E9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="StatusBad" ss:Parent="BaseCell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1" ss:Color="#991B1B"/>
   <Interior ss:Color="#FDECEC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="StatusWarn" ss:Parent="BaseCell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1" ss:Color="#92400E"/>
   <Interior ss:Color="#FFF4D6" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Total">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1" ss:Color="#17365D"/>
   <Interior ss:Color="#EAF2F8" ss:Pattern="Solid"/>
   <Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9FBAD0"/></Borders>
  </Style>
 </Styles>`;
}

export function buildExcel2003Xml({
  sheetName,
  columns,
  rows,
  title = '',
  subtitle = '',
  metadata = [],
  variant = 'report',
  orientation,
}) {
  if (!Array.isArray(columns) || !columns.length) {
    throw new Error('Cấu hình cột Excel không hợp lệ.');
  }

  const safeRows = Array.isArray(rows) ? rows : [];
  const columnCount = columns.length;
  const template = variant === 'template';
  const documentTitle = String(title || sheetName || 'Báo cáo').trim();
  const resolvedOrientation = orientation || (columnCount >= 7 ? 'Landscape' : 'Portrait');
  const columnDefinitions = columns
    .map((column) => `<Column ss:AutoFitWidth="0" ss:Width="${columnWidth(column, safeRows).toFixed(0)}"/>`)
    .join('');
  const header = row(columns.map((column) => cell(column.label, {
    style: template ? 'TemplateHeader' : 'Header',
  })), 34);
  const dataRows = buildDataRows(columns, safeRows, template);

  let tableRows;
  let headerRowIndex;
  let lastDataRow;

  if (template) {
    tableRows = `${header}${dataRows ? `\n   ${dataRows}` : ''}`;
    headerRowIndex = 1;
    lastDataRow = Math.max(1, safeRows.length + 1);
  } else {
    const intro = [
      row([cell(SCHOOL_NAME.toUpperCase(), { style: 'Brand', mergeAcross: columnCount - 1 })], 22),
      row([cell(documentTitle.toUpperCase(), { style: 'Title', mergeAcross: columnCount - 1 })], 32),
      ...(subtitle ? [row([cell(subtitle, { style: 'Subtitle', mergeAcross: columnCount - 1 })], 22)] : []),
      ...buildMetadataRows(metadata, columnCount),
      row([cell('', { style: 'TextOdd', mergeAcross: columnCount - 1 })], 8),
    ];

    headerRowIndex = intro.length + 1;
    lastDataRow = headerRowIndex + safeRows.length;
    const total = row([
      cell(`Tổng số bản ghi: ${safeRows.length}`, { style: 'Total', mergeAcross: columnCount - 1 }),
    ], 23);
    tableRows = `${intro.join('\n   ')}\n   ${header}${dataRows ? `\n   ${dataRows}` : ''}\n   ${total}`;
  }

  const autoFilter = safeRows.length
    ? `<AutoFilter x:Range="R${headerRowIndex}C1:R${lastDataRow}C${columnCount}" xmlns="urn:schemas-microsoft-com:office:excel"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>${escapeXml(SCHOOL_NAME)}</Author>
  <Title>${escapeXml(documentTitle)}</Title>
  <Company>${escapeXml(SCHOOL_NAME)}</Company>
 </DocumentProperties>
 ${styles()}
 <Worksheet ss:Name="${escapeXml(sanitizeSheetName(sheetName))}">
  <Table ss:DefaultRowHeight="20">
   ${columnDefinitions}
   ${tableRows}
  </Table>
  ${autoFilter}
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <Selected/>
   <DoNotDisplayGridlines/>
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>${headerRowIndex}</SplitHorizontal>
   <TopRowBottomPane>${headerRowIndex}</TopRowBottomPane>
   <PageSetup>
    <Layout x:Orientation="${resolvedOrientation}" x:CenterHorizontal="1"/>
    <Header x:Margin="0.2" x:Data="&amp;C${escapeXml(template ? documentTitle : SCHOOL_NAME)}"/>
    <Footer x:Margin="0.25" x:Data="&amp;L${escapeXml(formatExportDate())}&amp;RTrang &amp;P / &amp;N"/>
    <PageMargins x:Bottom="0.45" x:Left="0.3" x:Right="0.3" x:Top="0.45"/>
   </PageSetup>
   <FitToPage/>
   <Print>
    <PaperSizeIndex>9</PaperSizeIndex>
    <FitWidth>1</FitWidth>
    <FitHeight>0</FitHeight>
   </Print>
   <Zoom>90</Zoom>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

export function downloadExcel2003(options) {
  const xml = buildExcel2003Xml(options);
  const fileName = String(options?.fileName || 'du-lieu.xls');
  const blob = new Blob([`\ufeff${xml}`], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.toLowerCase().endsWith('.xls') ? fileName : `${fileName}.xls`;
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
    .filter((item) => item.some((value) => String(value ?? '').trim() !== ''))
    .map((item) => Object.fromEntries(
      headers.map((header, index) => [header, item[index] ?? '']),
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

    for (const currentCell of cells) {
      const explicitIndex = [...currentCell.attributes].find(
        (attribute) => attribute.localName === 'Index',
      );
      if (explicitIndex) targetIndex = Math.max(0, Number(explicitIndex.value) - 1);

      const dataNode = currentCell.getElementsByTagNameNS('*', 'Data')[0];
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

function firstLocal(node, localName) {
  return localElements(node, localName)[0] || null;
}

function relationshipTarget(documentXml, relationshipId) {
  const relationship = localElements(documentXml, 'Relationship').find(
    (item) => item.getAttribute('Id') === relationshipId,
  );
  return relationship?.getAttribute('Target') || '';
}

function sharedStringsFromXml(text) {
  if (!text) return [];
  const documentXml = xmlDocument(text, 'Tệp .xlsx có bảng chuỗi không hợp lệ.');
  return localElements(documentXml, 'si').map((item) =>
    localElements(item, 't').map((textNode) => textNode.textContent || '').join(''));
}

function columnIndex(reference) {
  const letters = String(reference || '').match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function rowsFromWorksheetXml(text, sharedStrings) {
  const documentXml = xmlDocument(text, 'Tệp .xlsx có worksheet không hợp lệ.');

  return localElements(documentXml, 'row').map((rowNode) => {
    const values = [];

    localElements(rowNode, 'c').forEach((cellNode) => {
      const index = columnIndex(cellNode.getAttribute('r'));
      const type = cellNode.getAttribute('t');
      const valueNode = firstLocal(cellNode, 'v');
      const inlineString = firstLocal(cellNode, 'is');
      let value = '';

      if (type === 's') {
        value = sharedStrings[Number(valueNode?.textContent || 0)] || '';
      } else if (type === 'inlineStr') {
        value = localElements(inlineString || cellNode, 't')
          .map((item) => item.textContent || '')
          .join('');
      } else if (type === 'b') {
        value = valueNode?.textContent === '1' ? 'TRUE' : 'FALSE';
      } else {
        value = valueNode?.textContent || '';
      }

      values[Math.max(0, index)] = value;
    });

    return values;
  });
}

function normalizeZipPath(basePath, target) {
  const raw = target.startsWith('/')
    ? target.slice(1)
    : `${basePath.slice(0, basePath.lastIndexOf('/') + 1)}${target}`;
  const parts = [];

  raw.split('/').forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') parts.pop();
    else parts.push(part);
  });

  return parts.join('/');
}

async function unzipEntries(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8');
  const entries = new Map();
  let end = bytes.length - 22;

  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error('Tệp .xlsx không hợp lệ.');

  const centralOffset = view.getUint32(end + 16, true);
  const totalEntries = view.getUint16(end + 10, true);
  let offset = centralOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('Tệp .xlsx có cấu trúc ZIP không hợp lệ.');
    }

    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error('Tệp .xlsx có mục ZIP không hợp lệ.');
    }

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    let content;

    if (compression === 0) {
      content = compressed;
    } else if (compression === 8 && typeof DecompressionStream !== 'undefined') {
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      content = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error('Trình duyệt không hỗ trợ đọc tệp .xlsx này. Hãy dùng .xls hoặc .csv.');
    }

    entries.set(name, content);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function parseXlsx(file) {
  const entries = await unzipEntries(file);
  const workbookBytes = entries.get('xl/workbook.xml');
  const relsBytes = entries.get('xl/_rels/workbook.xml.rels');
  if (!workbookBytes || !relsBytes) throw new Error('Tệp .xlsx thiếu workbook.');

  const decoder = new TextDecoder('utf-8');
  const workbookXml = xmlDocument(decoder.decode(workbookBytes), 'Workbook .xlsx không hợp lệ.');
  const relsXml = xmlDocument(decoder.decode(relsBytes), 'Quan hệ workbook .xlsx không hợp lệ.');
  const firstSheet = firstLocal(workbookXml, 'sheet');
  if (!firstSheet) return [];

  const relationId = firstSheet.getAttribute('r:id')
    || [...firstSheet.attributes].find((item) => item.localName === 'id')?.value;
  const target = relationshipTarget(relsXml, relationId);
  if (!target) throw new Error('Không xác định được worksheet đầu tiên trong .xlsx.');

  const worksheetPath = normalizeZipPath('xl/workbook.xml', target);
  const worksheetBytes = entries.get(worksheetPath);
  if (!worksheetBytes) throw new Error('Không đọc được worksheet trong .xlsx.');

  const sharedBytes = entries.get('xl/sharedStrings.xml');
  const sharedStrings = sharedStringsFromXml(sharedBytes ? decoder.decode(sharedBytes) : '');
  return rowsToObjects(rowsFromWorksheetXml(decoder.decode(worksheetBytes), sharedStrings));
}

export async function readExcelTable(file) {
  const extension = String(file?.name || '').toLowerCase().split('.').pop();

  if (extension === 'xlsx') return parseXlsx(file);

  const text = await file.text();
  if (extension === 'csv') return parseCsv(text);
  if (extension === 'xls' || text.includes('<Workbook')) return parseSpreadsheetXml(text);

  throw new Error('Định dạng tệp không được hỗ trợ. Hãy dùng .xlsx, .xls hoặc .csv.');
}
