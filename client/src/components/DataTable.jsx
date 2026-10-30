import EmptyState from "./EmptyState.jsx";

export default function DataTable({ columns, rows, getKey }) {
  if (!rows?.length) return <EmptyState />;

  return (
    <div className="min-w-0">
      <div className="grid gap-3 md:hidden">
        {rows.map((row, index) => (
          <article key={getKey ? getKey(row) : row._id || index} className="table-mobile-card app-surface p-4">
            {columns.map((column, columnIndex) => (
              <div key={`${column.key}-${column.label}-${columnIndex}`} className="grid grid-cols-[minmax(4.5rem,6rem)_minmax(0,1fr)] gap-3 py-1.5 text-sm">
                <span className="break-words text-xs font-semibold uppercase tracking-wide text-slate-400">{column.label}</span>
                <div className="min-w-0 break-words font-medium text-slate-900">{column.render ? column.render(row) : row[column.key] || "-"}</div>
              </div>
            ))}
          </article>
        ))}
      </div>
      <div className="table-scroll-frame app-surface hidden overflow-x-auto md:block">
      <table className="table table-md">
        <thead>
          <tr>
            {columns.map((column, columnIndex) => (
              <th key={`${column.key}-${column.label}-${columnIndex}`}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getKey ? getKey(row) : row._id || index}>
              {columns.map((column, columnIndex) => (
                <td key={`${column.key}-${column.label}-${columnIndex}`}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
