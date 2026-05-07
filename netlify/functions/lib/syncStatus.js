"use strict";

/**
 * Determine sync_status for an incoming order based on zone match result.
 *
 * @param {object} matchResult  result from matchDeliveryZone()
 * @param {object|null} mainRegion
 * @param {Array} otherRegions
 * @param {string} city
 * @param {string} region
 * @returns {{ sync_status: string, frais_liv: number|null, unmatched_city: string|null, unmatched_region: string|null }}
 */
function deriveSyncStatus(matchResult, mainRegion, otherRegions, city, region) {
  const hasZones = !!mainRegion || (Array.isArray(otherRegions) && otherRegions.length > 0);
  const matched  = matchResult && matchResult.matchType !== "fallback";

  if (matched) {
    return {
      sync_status: "synced",
      frais_liv: matchResult.fee,
      unmatched_city: null,
      unmatched_region: null,
    };
  }

  if (!hasZones) {
    return {
      sync_status: "awaiting_zone_config",
      frais_liv: null,
      unmatched_city: city || null,
      unmatched_region: region || null,
    };
  }

  return {
    sync_status: "unmatched_zone",
    frais_liv: null,
    unmatched_city: city || null,
    unmatched_region: region || null,
  };
}

module.exports = { deriveSyncStatus };
