import { reconcileEvidenceCounts } from "../../src/lib/projects/reconcile";

/**
 * Rebuild the denormalised verified-evidence counters and report the drift.
 *
 * Safe to run at any time: it only writes where the cached number disagrees
 * with the evidence rows it is supposed to summarise.
 */
const result = await reconcileEvidenceCounts();
console.log(`checked ${result.projectsChecked} projects, corrected ${result.projectsCorrected}`);
for (const d of result.drifted) {
  console.log(`  ${d.was} -> ${d.now}  ${d.title}`);
}
process.exit(0);
