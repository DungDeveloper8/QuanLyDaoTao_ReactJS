import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { downloadExcel2003, readExcelTable } from '../utils/exportExcel.js';

export default function ExcelExportButton({
  fileName,
  sheetName,
  columns,
  rows,
  title = '',
  subtitle = '',
  metadata = [],
  variant = 'report',
  orientation,
  className = '',
  children = 'Xuất Excel',
}) {
  function handleExport() {
    downloadExcel2003({
      fileName,
      sheetName,
      columns,
      rows,
      title,
      subtitle,
      metadata,
      variant,
      orientation,
    });
  }

  return (
    <button
      className={`btn btn-excel ${className}`.trim()}
      type="button"
      onClick={handleExport}
      disabled={!rows?.length}
      title={!rows?.length ? 'Không có dữ liệu để xuất' : 'Xuất dữ liệu đang hiển thị ra Excel'}
    >
      <Icon name="download" size={15} />
      <span>{children}</span>
    </button>
  );
}

export function ExcelImportButton({
  onImport,
  className = '',
  children = 'Nhập Excel',
  disabled = false,
  title = 'Nhập dữ liệu từ .xlsx, .xls hoặc .csv',
}) {
  const inputRef = useRef(null);
  const [reading, setReading] = useState(false);

  async function handleFile(event) {
    const [file] = event.target.files || [];
    event.target.value = '';
    if (!file) return;

    setReading(true);
    try {
      const rows = await readExcelTable(file);
      await onImport(rows, file);
    } catch (error) {
      window.alert(error.message || 'Không thể đọc tệp Excel.');
    } finally {
      setReading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        onChange={handleFile}
        tabIndex={-1}
      />
      <button
        className={`btn btn-excel-import ${className}`.trim()}
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || reading}
        title={title}
      >
        <Icon name="upload" size={15} />
        <span>{reading ? 'Đang đọc...' : children}</span>
      </button>
    </>
  );
}
