/**
 * Legacy path. Postmortems live on archived projects, so `/api/archive` is
 * the real handler. Kept so existing clients keep working during the port.
 */
export { GET } from "../archive/route";
