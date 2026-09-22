import { useEffect, useMemo, useState } from 'react';
import { createOne, list, removeOne, updateOne } from '../../core/api/apiClient.js';
import { ErrorState, LoadingState } from './DataState.jsx';
import ExcelExportButton from './ExcelExportButton.jsx';
import Modal from './Modal.jsx';
import Pagination from './Pagination.jsx';
import Icon from './Icon.jsx';

function getExportValue(column, item) {
  const rendered = column.exportValue
    ? column.exportValue(item)
    : column.render
      ? column.render(item)
      : item[column.key];

  return ['string', 'number', 'boolean'].includes(typeof rendered)
    ? rendered
    : item[column.key] ?? '';
}

function createInitialForm(fields) {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      field.defaultValue ?? (field.type === 'number' ? 0 : ''),
    ]),
  );
}

function normalizeForm(fields, form) {
  const normalized = { ...form };

  fields.forEach((field) => {
    if (field.type === 'number' || field.type === 'select-number') {
      normalized[field.name] = Number(form[field.name]);
    } else if (field.type === 'checkbox') {
      normalized[field.name] = Boolean(form[field.name]);
    }

    if (field.transform) {
      normalized[field.name] = field.transform(form[field.name], form);
    }
  });

  return normalized;
}

export default function CrudPanel({
  title,
  resource,
  fields,
  columns,
  validate,
  canDelete,
  onChanged,
  afterSave,
  afterDelete,
  initialItems,
  pageSize = 8,
}) {
  const hasInitialItems = Array.isArray(initialItems);
  const [items, setItems] = useState(hasInitialItems ? initialItems : []);
  const [loading, setLoading] = useState(!hasInitialItems);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(undefined);
  const [form, setForm] = useState(createInitialForm(fields));
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function commitItems(nextItems) {
    setItems(nextItems);
    onChanged?.(nextItems);
  }

  async function load() {
    setLoading(true);
    setError('');

    try {
      const response = await list(resource);
      commitItems(response.data);
    } catch (loadError) {
      setError(loadError?.message || 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setQuery('');
    setPage(1);
    setEditing(undefined);
    setForm(createInitialForm(fields));
    setFormError('');

    if (hasInitialItems) {
      setItems(initialItems);
      setLoading(false);
      setError('');
      return;
    }

    load();
  }, [resource]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return items;
    }

    return items.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(keyword),
    );
  }, [items, query]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedItems = filteredItems.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  function openCreate() {
    setEditing(null);
    setForm(createInitialForm(fields));
    setFormError('');
  }

  function openEdit(item) {
    setEditing(item);
    setForm(
      Object.fromEntries(
        fields.map((field) => [
          field.name,
          item[field.name] ?? field.defaultValue ?? '',
        ]),
      ),
    );
    setFormError('');
  }

  async function handleSave(event) {
    event.preventDefault();
    setFormError('');

    const normalized = normalizeForm(fields, form);
    const validationMessage = validate?.(normalized, items, editing);

    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setSaving(true);

    try {
      const response = editing
        ? await updateOne(resource, editing.id, { ...editing, ...normalized })
        : await createOne(resource, normalized);

      await afterSave?.(response.data, editing);

      const nextItems = editing
        ? items.map((item) => (item.id === editing.id ? response.data : item))
        : [...items, response.data];

      commitItems(nextItems);
      setEditing(undefined);
    } catch (saveError) {
      setFormError(saveError?.message || 'Không thể lưu dữ liệu.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(item) {
    const blockedMessage = await canDelete?.(item);
    if (blockedMessage) {
      window.alert(blockedMessage);
      return;
    }

    if (!window.confirm(`Xóa "${item.name || item.code || item.id}"?`)) {
      return;
    }

    try {
      await removeOne(resource, item.id);
      await afterDelete?.(item);
      commitItems(items.filter((current) => current.id !== item.id));
    } catch (removeError) {
      window.alert(removeError?.message || 'Không thể xóa dữ liệu.');
    }
  }

  if (loading) {
    return <LoadingState text={`Đang tải ${title.toLowerCase()}...`} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const modalOpen = editing !== undefined;

  return (
    <section className="crud-panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <span>{items.length} bản ghi</span>
        </div>
        <div className="page-actions">
          <ExcelExportButton
            className="btn-sm"
            fileName={`${resource}.xls`}
            sheetName={title}
            rows={filteredItems}
            columns={columns.map((column) => ({
              label: column.label,
              value: (item) => getExportValue(column, item),
            }))}
          />
          <button className="btn btn-primary btn-sm" type="button" onClick={openCreate}>
            <Icon name="plus" size={15} />
            <span>Thêm mới</span>
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-field">
          <Icon name="search" size={16} />
          <input
            placeholder="Tìm kiếm..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span className="toolbar-result">{filteredItems.length} kết quả</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map((item) => (
              <tr key={item.id}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render ? column.render(item) : item[column.key]}
                  </td>
                ))}
                <td className="action-cell">
                  <button
                    className="btn btn-light btn-xs"
                    type="button"
                    onClick={() => openEdit(item)}
                  >
                    <Icon name="edit" size={13} />
                    <span>Sửa</span>
                  </button>
                  <button
                    className="btn btn-danger btn-xs"
                    type="button"
                    onClick={() => handleRemove(item)}
                  >
                    <Icon name="trash" size={13} />
                    <span>Xóa</span>
                  </button>
                </td>
              </tr>
            ))}

            {!pagedItems.length ? (
              <tr>
                <td colSpan={columns.length + 1} className="table-empty">
                  Không có dữ liệu.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />

      <Modal
        open={modalOpen}
        title={editing ? `Cập nhật ${title}` : `Thêm ${title}`}
        onClose={() => setEditing(undefined)}
      >
        <form className="form-grid" onSubmit={handleSave}>
          {fields.map((field) => (
            <label key={field.name} className={field.full ? 'full' : ''}>
              {field.label}
              {field.type === 'textarea' ? (
                <textarea
                  rows="3"
                  value={form[field.name] ?? ''}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, [field.name]: event.target.value }));
                  }}
                />
              ) : field.type === 'select' || field.type === 'select-number' ? (
                <select
                  value={form[field.name] ?? ''}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, [field.name]: event.target.value }));
                  }}
                >
                  <option value="">-- Chọn --</option>
                  {(field.options || []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <input
                  type="checkbox"
                  checked={Boolean(form[field.name])}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, [field.name]: event.target.checked }));
                  }}
                />
              ) : (
                <input
                  type={field.type || 'text'}
                  min={field.min}
                  max={field.max}
                  value={form[field.name] ?? ''}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, [field.name]: event.target.value }));
                  }}
                />
              )}
            </label>
          ))}

          {formError ? (
            <div className="form-alert form-alert-error full">{formError}</div>
          ) : null}

          <div className="form-actions full">
            <button
              type="button"
              className="btn btn-light"
              onClick={() => setEditing(undefined)}
            >
              Hủy
            </button>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
