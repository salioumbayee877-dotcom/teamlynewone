"use strict";

const norm = s => (s || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Determine sync_status for an incoming order based on zone match result.
 * When no zones are configured at all, applies defaults from settings
 * (fallback 2500 main / 4000 other) so the order has a price; admin
 * gets prompted to configure zones, and resync re-matches once they do.
 *
 * @param {object} matchResult  result from matchDeliveryZone()
 * @param {object|null} mainRegion
 * @param {Array} otherRegions
 * @param {string} city
 * @param {string} region
 * @param {object} [settings]   organizations.settings JSONB
 * @returns {{ sync_status: string, frais_liv: number|null, unmatched_city: string|null, unmatched_region: string|null }}
 */
function deriveSyncStatus(matchResult, mainRegion, otherRegions, city, region, settings) {
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
    const s = settings || {};
    const mainDefault  = parseInt(s.defaultMainPrice)  || 2500;
    const otherDefault = parseInt(s.defaultOtherPrice) || 4000;
    const isMain = norm(`${city || ""} ${region || ""}`).includes("dakar");
    return {
      sync_status: "awaiting_zone_config",
      frais_liv: isMain ? mainDefault : otherDefault,
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
