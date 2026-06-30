'use client';

import { useMemo, useState } from 'react';

export default function CrudTable({
  title,
  rows,
  columns,
  emptyMessage,
  addButtonLabel,
  onAdd,
  onUpdate,
  onDelete,
  renderAddForm,
  getRowKey,
  detailValueFormatter,
  detailLabelFormatter,
}) {
  const [sortKey, setSortKey] = useState(columns[0]?.key || '');
  const [sortDirection, setSortDirection] = useState('asc');
  const [modalMode, setModalMode] = useState(null);
  const [modalRow, setModalRow] = useState(null);
  const [formDraft, setFormDraft] = useState({});
  const [menuRowId, setMenuRowId] = useState(null);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;

    return [...rows].sort((left, right) => {
      const column = columns.find((columnItem) => columnItem.key === sortKey);
      const leftValue = column?.sortValue ? column.sortValue(left) : left[sortKey];
      const rightValue = column?.sortValue ? column.sortValue(right) : right[sortKey];
      const leftText = typeof leftValue === 'string' ? leftValue.toLowerCase() : String(leftValue ?? '');
      const rightText = typeof rightValue === 'string' ? rightValue.toLowerCase() : String(rightValue ?? '');
      const comparison = leftText.localeCompare(rightText, 'sv');
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });
  }, [rows, sortDirection, sortKey, columns]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const openAddModal = () => {
    setModalMode('add');
    setFormDraft({});
    setModalRow(null);
  };

  const openEditModal = (row) => {
    setModalMode('edit');
    setModalRow(row);
    setFormDraft(row);
  };

  const openViewModal = (row) => {
    setModalMode('view');
    setModalRow(row);
  };

  const closeModal = () => {
    setModalMode(null);
    setModalRow(null);
    setFormDraft({});
    setMenuRowId(null);
  };

  const toggleRowMenu = (rowId) => {
    setMenuRowId((current) => (current === rowId ? null : rowId));
  };

  const closeRowMenu = () => setMenuRowId(null);

  const submitModal = async (event) => {
    event.preventDefault();
    if (modalMode === 'add') {
      await onAdd?.(formDraft);
    }
    if (modalMode === 'edit') {
      await onUpdate?.(getRowKey(modalRow), formDraft);
    }
    closeModal();
  };

  const renderRowValue = (row, column) => (
    column.renderValue ? column.renderValue(row) : row[column.key]
  );

  const renderDetailRows = (row) => (
    <>
      {columns.map((column) => {
        if (!column.key || column.key.toLowerCase().includes('id') || column.key.toLowerCase() === 'created_at' || column.key.toLowerCase().includes('created')) return null;
        return (
          <div key={column.key} className="modal-row">
            <span className="modal-label">{column.label}</span>
            <span className="modal-value">{column.renderValue ? column.renderValue(row) : row[column.key]}</span>
          </div>
        );
      })}
      {Object.keys(row)
        .filter((key) => !key.toLowerCase().includes('id') && key.toLowerCase() !== 'created_at' && !key.toLowerCase().includes('created') && !columns.some((column) => column.key === key))
        .map((key) => {
          const rawValue = row[key];
          const value = detailValueFormatter ? detailValueFormatter(key, rawValue, row) : rawValue;
          const label = detailLabelFormatter ? detailLabelFormatter(key, rawValue, row) : key.replace(/_/g, ' ');
          return (
            <div key={key} className="modal-row">
              <span className="modal-label">{label}</span>
              <span className="modal-value">{String(value)}</span>
            </div>
          );
        })}
    </>
  );

  const titleLabel = modalMode === 'add' ? `Lägg till ${title.toLowerCase()}` : modalMode === 'edit' ? `Redigera ${title.toLowerCase()}` : `${title} information`;

  return (
    <section className="card">
      <div className="table-toolbar">
        <div className="toolbar-top">
          <h2>{title}</h2>
          <button type="button" className="primary" onClick={openAddModal}>{addButtonLabel}</button>
        </div>
        <div className="table-header-row">
          {columns.map((column) => (
            <div key={column.key} className="table-header-cell">
              {column.sortable ? (
                <button type="button" className="sort-button" onClick={() => handleSort(column.key)}>
                  {column.label}
                  {sortKey === column.key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              ) : (
                column.label
              )}
            </div>
          ))}
          <div className="table-header-cell table-header-actions">Åtgärder</div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <tbody>
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="empty-cell">{emptyMessage}</td>
              </tr>
            )}

            {sortedRows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} data-label={column.label}>
                    {renderRowValue(row, column)}
                  </td>
                ))}
                <td data-label="Åtgärder">
                  <div className="row-actions">
                    <button
                      type="button"
                      className="row-menu-button"
                      aria-expanded={menuRowId === getRowKey(row)}
                      onClick={() => toggleRowMenu(getRowKey(row))}
                    >
                      ⋮
                    </button>
                    {menuRowId === getRowKey(row) && (
                      <div className="row-menu">
                        <button type="button" className="row-menu-item" onClick={() => { openViewModal(row); closeRowMenu(); }}>Visa</button>
                        <button type="button" className="row-menu-item" onClick={() => { openEditModal(row); closeRowMenu(); }}>Redigera</button>
                        <button type="button" className="row-menu-item danger" onClick={() => { onDelete?.(getRowKey(row)); closeRowMenu(); }}>Ta bort</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalMode && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{titleLabel}</h3>
              <button type="button" className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              {modalMode === 'view' ? (
                renderDetailRows(modalRow)
              ) : (
                <form onSubmit={submitModal} className="table-form">
                  {renderAddForm(formDraft, setFormDraft)}
                  <div className="table-actions">
                    <button type="submit" className="primary">Spara</button>
                    <button type="button" className="secondary" onClick={closeModal}>Avbryt</button>
                  </div>
                </form>
              )}
            </div>
            {modalMode === 'view' && (
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => openEditModal(modalRow)}>Redigera</button>
                <button type="button" className="danger" onClick={() => { onDelete?.(getRowKey(modalRow)); closeModal(); }}>Ta bort</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
