/**
 * Legacy path. Workshops are campus events; `/api/events` is the real handler.
 * Kept so existing clients keep working during the port, and it forwards
 * rather than duplicating the query.
 */
export { GET, POST } from "../events/route";
