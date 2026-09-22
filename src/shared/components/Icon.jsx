const paths = {
  dashboard: <><path d="M3 3h7v7H3z"/><path d="M14 3h7v4h-7z"/><path d="M14 11h7v10h-7z"/><path d="M3 14h7v7H3z"/></>,
  catalog: <><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/><path d="M7 3v4"/><path d="M12 10v4"/><path d="M17 17v4"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 6h8"/><path d="M8 10h8"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/></>,
  report: <><path d="M4 19V5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M14 3v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  attendance: <><path d="M9 11l2 2 4-4"/><path d="M4 21v-2a4 4 0 0 1 4-4h4"/><circle cx="10" cy="7" r="4"/><path d="M16 16h5"/><path d="M18.5 13.5v5"/></>,
  score: <><path d="M5 4h14v16H5z"/><path d="M8 8h8"/><path d="M8 12h3"/><path d="M8 16h5"/></>,
  logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4z"/></>,
  trash: <><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></>,
  download: <><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
  upload: <><path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M5 3h14"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  close: <><path d="M6 6l12 12"/><path d="M18 6L6 18"/></>,
  chevronLeft: <path d="M15 18l-6-6 6-6"/>,
  chevronRight: <path d="M9 18l6-6-6-6"/>,
};

export default function Icon({ name, size = 18, className = '' }) {
  const content = paths[name];
  if (!content) {
    return null;
  }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {content}
    </svg>
  );
}
