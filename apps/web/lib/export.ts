/**
 * CSV export utility — works entirely in the browser, no server needed.
 * Usage: exportCsv('tenants', rows, columns)
 */

export function exportCsv(filename: string, rows: Record<string, unknown>[], columns: { key: string; label: string }[]) {
  if (!rows.length) return

  const header = columns.map(c => `"${c.label}"`).join(',')
  const body = rows.map(row =>
    columns.map(c => {
      const val = row[c.key]
      if (val === null || val === undefined) return '""'
      const s = String(val).replace(/"/g, '""')
      return `"${s}"`
    }).join(',')
  ).join('\n')

  const csv = `${header}\n${body}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
