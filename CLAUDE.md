# Teamly — Codebase Map for Claude Code

SaaS COD/dropshipping pour l'Afrique de l'Ouest. React + Vite + Supabase + Netlify.

## Quick stack facts

- **Frontend** : React 18, Vite, ~9500-line `src/App.jsx` (single file, intentional)
- **Backend** : Supabase (REST via `sbFetch`), Netlify Functions
- **Auth** : Supabase email/password + email OTP (signup), SMS OTP (login), magic-link callback
- **Deploy** : Netlify (auto-deploy from `main`)
- **PWA** : `public/sw.js` (service worker), `public/manifest.json`
- **No TypeScript, no tests** — change at your own risk, run the build

## Key globals (top of App.jsx)

| What | Where | Notes |
|---|---|---|
| `SB_URL`, `SB_KEY` | lines 3-4 | from `import.meta.env.VITE_SUPABASE_*` |
| `_authToken` | module-level mutable | NOT React state — used by `sbFetch` |
| `sbToken` (state) | inside App | mirror of `_authToken` for React reactivity |
| `sbFetch(path, method, body, token)` | ~50-104 | Supabase REST helper, throws on error |
| `sbAuth(email, pwd, type)` | ~163-180 | wrapper for `/auth/v1/token` and `/auth/v1/signup` |
| `STATUS` constant | ~436-448 | order status labels + colors (single source) |
| `LIV_ACTIVE`, `LIV_FINAL` | ~451-452 | livreur status sets |
| `OWNER_EMAIL`, `OWNER_EMAILS` | ~1483-1484 | platform owner gate |

## App.jsx zone map (approximate — line numbers shift with edits)

| Range | Zone |
|---|---|
| 1-560 | Imports, helpers (sbFetch, sbAuth, matchDeliveryZone client-side, ToastContainer, charts) |
| 829 | `CityComboBox` standalone component |
| 1002 | `OrderModal` standalone component |
| 1300-1550 | App component — useState declarations (~150 hooks) |
| 1541 | `upSt(id, status)` — main order status update handler |
| 1656 | useEffect for Wave payment success URL callback |
| 1700-1710 | `detectPricingIssues`, `handleTraiterOrder` |
| 1820-2360 | useEffects: plan check, data load, realtime, refs, zones-resync |
| 2080-2140 | `loadMain` — bulk fetch of orders/products/profiles/zones |
| 2363+ | Ref sync effects |
| 2556 | `addProduct(form)` |
| 2855 | `activeEnCamino` (livreur conflict check) |
| 2857-3220 | `OCard` — order card component (defined inside App, has closure access) |
| 3299 | `handleRegister` (signup submit) |
| 3372-3635 | Auth screens: tabs (login / phone / register), forms, password recovery |
| 3633-3940 | Auth step screens: plan choice, gestion mode, join |
| 4078-4220 | OTP verify-email screen (replaces magic-link UX) |
| 4019-4030 | `tabDef` per role |
| 4072-4090 | `filteredOrders` builder (date + status + search + livreur filters) |
| 4214 | "Mes Clients" sidebar button (OWNER → tab=superadmin) |
| 4290-4700 | Sidebar nav + header + bottom-tab + dashboard quick-actions |
| 4554-4673 | Super-admin panel (`tab=superadmin`, OWNER_EMAIL only) |
| 4675-4860 | Admin dashboard (top section) |
| 4860-5025 | Livreur dashboard |
| 5025-5235 | Admin dashboard banners (sync-zones) + KPIs + charts + Livraisons list rendering |
| 5033-5155 | Filter chips (Date / Tournée / Résultat) |
| 5160-5240 | Orders list rendering (pinned active livreur delivery + autres + terminées) |
| 5262-5800 | Clients tab |
| 6080-6700 | Compta tab — calculations, "Modifier coûts" inline form, pub/cash inputs |
| 6700-6900 | Stock tab |
| 6680-6810 | Chat (compositor + lightbox + render) |
| 7300-8100 | Frais de livraison page (zones config, table tab, test tab) |
| 7430-7510 | Card A — Zone principale (Dakar) with global rate input + bulk-apply |
| 7515-7740 | Card B — Autres régions with locaux/transport/total + bulk-apply |
| 8115-8500 | Settings modal — Mon compte, Plan |
| 8470-8570 | Edit product modal (`editProd`) |
| 8900-9000 | Pricing rules + bundle creation |
| 9388-9410 | `confirmModal` shared modal (`whiteSpace:pre-line`, danger flag) |
| 9420-9550 | Old "Analyse des produits" pricing-detection popup (still live) |

## Project structure outside App.jsx

```
src/
  App.jsx                   ← everything
  main.jsx                  ← entry, Sentry init, login redirect
  ProductAnalysisPopup.jsx  ← standalone, used for new_product / price_change / price_drop
  teamly-v2.jsx             ← landing page (renders when path="/" and no token)
public/
  manifest.json             ← PWA (no orientation key — respects device auto-rotate)
  sw.js                     ← service worker (network-first, cache fallback, skip API URLs)
  index.html                ← global CSS in <style> (tap-highlight off, :active feedback)
netlify/
  functions/
    _auth.js                ← shared requireUser + getProfile helpers
    ai-chat.js              ← Anthropic API proxy (auth-gated)
    shopify-webhook.js      ← uses lib/matchDeliveryZone + lib/syncStatus
    woocommerce-webhook.js  ← idem
    youcanshop-webhook.js   ← idem
    wave-checkout.js        ← Wave payment session creation
    wave-success.js         ← plan upgrade after Wave payment (auth + admin + org check)
    super-admin.js          ← OWNER-only platform clients management
    resync-pending-orders.js ← re-match awaiting/unmatched orders against zones
    delete-member.js        ← admin team member removal
    check-member-limit.js   ← plan member limit check
    lib/
      matchDeliveryZone.js  ← exact > alias > fuzzy(Levenshtein≤2) > fallback
      syncStatus.js         ← derive sync_status from match result
supabase-rls.sql            ← run manually in Supabase SQL Editor (RLS policies)
supabase-sync-status.sql    ← run manually (orders.sync_status + platform columns)
```

## Supabase tables

| Table | Notes |
|---|---|
| `auth.users` | managed by Supabase Auth |
| `profiles` | id (=auth.uid), org_id, nom, phone, email, role ('admin'/'closer'/'livreur'), birthday, lat, lng, city |
| `organizations` | id, name, whatsapp, plan, plan_expires_at, settings (JSONB: defaultDeliveryPrice, regional_local_fee, regional_transport_fee, baseZone, notif*, closerCompta, etc.) |
| `orders` | client, phone, address, product, price, status, frais_liv, livreur_id, closer_id, archived, sync_status, unmatched_city, unmatched_region, platform, delivered_at, amount_collected, delivered_by |
| `products` | name, cost, price, stock, stock_initial, frais_liv, frais_liv_extra, niche, archived, org_id |
| `messages` | chat — text encodes media: `IMG:url`, `AUD:dur\|url`, `FILE:url\|name\|size\|mime` |
| `notifications` | type, title, body, role_target, read, data |
| `stock_movements` | source, delta, reason, order_id |
| `delivery_main_region` | id, org_id, name (default "Dakar"), price, cities (text[] of "name\|price"), aliases |
| `delivery_other_regions` | per-region rows: name, price (local), interurbain_price (transport), cities, aliases |
| `product_pricing_rules` | type, bundle_quantity, reference_price_unit, reference_price_bundle, discount_percentage, discount_type |

**RLS**: every table is filtered by `org_id = auth_org_id()` SECURITY DEFINER function (in `supabase-rls.sql`).

## Common gotchas

1. **`_authToken` vs `sbToken`** — the module-level `_authToken` is mutable JS, mutated directly during login. `sbToken` is the React state that mirrors it for `useEffect` reactivity. Use `sbToken` in deps, not `_authToken`.
2. **`addToast` and `setConfirmModal`** are defined inside App component. Available everywhere via closure but only when editing inside App. Reusable confirm pattern: `setConfirmModal({msg, sub, danger?, onConfirm})`. `sub` supports multi-line via `\n` (rendered with `whiteSpace:pre-line`).
3. **Order status flow**: `pendiente → confirmado → livreur_en_route → colis_pris → en_camino → chez_client → entregado | rechazado | no_contesta | reprogramar`. The OCard renders different action buttons per status.
4. **Pinned livreur delivery**: when status ∈ `{en_camino, chez_client}`, the order pins to top of Livraisons tab. Other states move to "Autres / Terminées" sections.
5. **Zone matching priority**: exact city > alias > Levenshtein fuzzy ≤ 2 > fallback. Fallback fee = `regional_local_fee + regional_transport_fee` (settings JSONB), else `defaultDeliveryPrice`.
6. **Banners on Admin Dashboard**: `awaiting_zone_config` (no zones at all) + `unmatched_zone` (zones but no city match). Both auto-clear when resync resolves them.
7. **Multi-tenant**: every Supabase query filters by `org_id`. Never query without it. Netlify Functions use `SUPABASE_SERVICE_KEY` which bypasses RLS — they MUST verify ownership manually (see `_auth.js` `getProfile`).
8. **`addProduct`** rolls back local state and shows toast if Supabase rejects (e.g., missing column). Look there as a template for resilient writes.
9. **Webhooks**: incoming Shopify/Woo/YouCan orders set `platform`, `sync_status`, and (if unmatched) `unmatched_city/region`. Resync useEffect (content-hash on zones) re-matches them when zones change.

## Useful approach for editing

1. Don't `Read` App.jsx whole. Use `Grep` + `Read` with offset/limit.
2. For status flow / role logic, jump to `STATUS`/`LIV_ACTIVE` constants first.
3. For new pages → look for `tab===` patterns to know how to gate them.
4. For new modals → look at `confirmModal` or existing modals (lines 8115+) for visual conventions.
5. Color palette: `G.green`, `G.gold`, `G.red`, `G.dark`, `G.gray`, `G.greenLight`, `G.grayLight`. Use these, never hex.
6. Currency formatter: `fmt(n)` (French locale, no decimals). Always use it for CFA amounts.
7. Build before commit: `npm run build` (sentry source map upload runs ~30-60s).
8. Don't drop columns. Don't run destructive SQL. List orphans in the report.
