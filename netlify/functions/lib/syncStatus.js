"use strict";

const norm = s => (s || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Determine sync_status for an incoming order based on:
 *   - zone match result (matchDeliveryZone)
 *   - settings.zones_configured flag (admin has interacted with Frais de livraison)
 *
 * Behavior:
 *   - settings.zones_configured === false (default) → use defaults (2500/4000),
 *     regardless of any zones present in DB. Status = awaiting_zone_config.
 *   - settings.zones_configured === true + match → synced with real fee.
 *   - settings.zones_configured === true + no match → unmatched_zone,
 *     frais_liv defaults to 2500 (Dakar) or 4000 (autres) so the order is not
 *     blocked while admin configures the missing city via the ⚙️ button.
 *
 * @param {object} matchResult  result from matchDeliveryZone()
 * @param {object|null} mainRegion  unused now (kept for signature back-compat)
 * @param {Array}  otherRegions     unused now
 * @param {string} city
 * @param {string} region
 * @param {object} [settings]   organizations.settings JSONB
 * @param {object} [meta]       { isDakar?: boolean } — pre-computed region info
 */
function deriveSyncStatus(matchResult, mainRegion, otherRegions, city, region, settings, meta) {
  const s = settings || {};
  const configured = s.zones_configured === true;
  const mainDefault  = parseInt(s.defaultMainPrice)  || 2500;
  const otherDefault = parseInt(s.defaultOtherPrice) || 4000;

  // Resolve "is this a Dakar address?": prefer pre-computed meta from
  // extractCityFromAddress; fall back to crude substring match.
  const isMain = (meta && typeof meta.isDakar === "boolean")
    ? meta.isDakar
    : norm(`${city || ""} ${region || ""}`).includes("dakar");

  if (!configured) {
    return {
      sync_status: "awaiting_zone_config",
      frais_liv: isMain ? mainDefault : otherDefault,
      unmatched_city: city || null,
      unmatched_region: region || null,
    };
  }

  const matched = matchResult && matchResult.matchType !== "fallback";
  if (matched) {
    return {
      sync_status: "synced",
      frais_liv: matchResult.fee,
      unmatched_city: null,
      unmatched_region: null,
    };
  }

  // Zones configured but this city isn't listed yet — surface a banner so the
  // admin adds it, but pre-fill a sensible default frais so the order is not
  // blocked in the meantime.
  return {
    sync_status: "unmatched_zone",
    frais_liv: isMain ? mainDefault : otherDefault,
    unmatched_city: city || null,
    unmatched_region: region || null,
  };
}

module.exports = { deriveSyncStatus };
