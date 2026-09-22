export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="pagination" aria-label="Phân trang">
      <button className="btn btn-light btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Trước</button>
      <span>Trang {page}/{totalPages}</span>
      <button className="btn btn-light btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Sau</button>
    </div>
  )
}
