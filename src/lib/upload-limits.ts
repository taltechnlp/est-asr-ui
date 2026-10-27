// Shared with the browser so oversized files are refused before they are sent.
// nginx (client_max_body_size 1100M) rejects anything much larger with a bare 413.
export const UPLOAD_LIMIT = 1024 * 1024 * 1000; // 1000MB
