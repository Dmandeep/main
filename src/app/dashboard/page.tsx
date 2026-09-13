import { redirect } from "next/navigation";

/**
 * Collapsed into The Forge.
 *
 * This was a third ideas browser — after /feed's Ideas tab and /archive — and
 * a broken one: its track filter was hardcoded to `ai`, `web3`, `fintech`,
 * `sustainability` and `edtech`, none of which are tracks this campus uses
 * (see CORE_TRACKS in src/types). Every track filter here returned nothing.
 *
 * ART-DIRECTION-V2.md §6 already called for /dashboard and /feed to collapse
 * into one screen. /feed has the browser; The Forge has your own work, which
 * is what a signed-in student actually wants from a home.
 */
export default function DashboardRedirect() {
  redirect("/forge");
}
