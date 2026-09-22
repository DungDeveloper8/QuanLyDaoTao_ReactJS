import { SCHOOL_LOGO_URL, SCHOOL_NAME } from '../../app/config.js';

export default function SchoolLogo({ className = '', alt = `Logo ${SCHOOL_NAME}` }) {
  return (
    <img
      className={className}
      src={SCHOOL_LOGO_URL}
      alt={alt}
      decoding="async"
    />
  );
}
