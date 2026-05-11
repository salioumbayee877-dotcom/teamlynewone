import React, { useState, useEffect, useRef, useCallback } from "react";
import ProductAnalysisPopup from "./ProductAnalysisPopup";
import { CityComboBox, CityAutocomplete } from "./components/CityComboBox";
import { OrderModal } from "./components/OrderModal";
import { AppContext } from "./context/AppContext";
import { OCard } from "./components/OCard";
import { StockPage } from "./components/StockPage";
import { ComptaPage } from "./components/ComptaPage";
import { FraisPage } from "./components/FraisPage";
import { ClientsPage } from "./components/ClientsPage";
import {
  WA_ZONES, _nz, detectZone, fullAddr,
  _normCity, _parseCity, SENEGAL_CITIES, _findSenCity, detectDeliveryZone,
} from "./lib/senegal";
// ── Supabase REST client (no SDK needed) ──────────────────────────────────
const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// User JWT stored after login — all data requests use this so RLS is enforced
let _authToken = null;
let _setSbTokenFn = null; // registered by component to sync React state after refresh
let _refreshPromise = null; // deduplicates concurrent refresh calls

const tryRefreshToken = async () => {
  if (_refreshPromise) return _refreshPromise;
  const rt = localStorage.getItem("teamly_refresh_token");
  if (!rt) return null;
  _refreshPromise = (async () => {
    try {
      const res = await fetchWithTimeout(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: {"Content-Type":"application/json","apikey":SB_KEY},
        body: JSON.stringify({refresh_token: rt}),
      }, 10000);
      if (!res.ok) return null;
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch(e) { return null; }
      if (!data?.access_token) return null;
      _authToken = data.access_token;
      try {
        localStorage.setItem("teamly_token", data.access_token);
        if (data.refresh_token) localStorage.setItem("teamly_refresh_token", data.refresh_token);
      } catch(e) {}
      if (_setSbTokenFn) _setSbTokenFn(data.access_token);
      return data.access_token;
    } catch(e) { return null; }
    finally { _refreshPromise = null; }
  })();
  return _refreshPromise;
};

const sbHeaders = (token) => ({
  "Content-Type":  "application/json",
  "apikey":        SB_KEY,
  "Authorization": `Bearer ${token||_authToken||SB_KEY}`,
  "Prefer":        "return=representation",
});

const fetchWithTimeout = async (url, opts={}, ms=7000) => {
  const ctrl = new AbortController();
  const id = setTimeout(()=>ctrl.abort(), ms);
  try { return await fetch(url, {...opts, signal:ctrl.signal}); } finally { clearTimeout(id); }
};

const isTokenExpired = (tok) => {
  if(!tok) return true;
  try {
    const payload = JSON.parse(atob(tok.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return payload.exp * 1000 < Date.now() + 60000;
  } catch(e) { return true; }
};

const sbFetch = async (path, method="GET", body=null, token=null) => {
  // Proactively refresh if token is expired before sending the request
  if(!token && isTokenExpired(_authToken)) {
    await tryRefreshToken();
  }
  try {
    const res = await fetchWithTimeout(`${SB_URL}/rest/v1/${path}`, {
      method,
      headers: sbHeaders(token),
      body: body ? JSON.stringify(body) : undefined,
    }, 8000);
    if(!res.ok) {
      const e=await res.text();
      let _errCode=""; try{_errCode=JSON.parse(e).code;}catch(_){}
      if(res.status===401 && _errCode==="PGRST303") {
        const newTok = await tryRefreshToken();
        if(newTok) {
          const r2 = await fetchWithTimeout(`${SB_URL}/rest/v1/${path}`,{method,headers:sbHeaders(newTok),body:body?JSON.stringify(body):undefined},8000);
          if(r2.ok){
            const t2=await r2.text();
            if(!t2||t2.trim()==="") return null;
            let d2; try{d2=JSON.parse(t2);}catch(e2){return null;}
            if((method==="POST"||method==="PATCH"||method==="DELETE")&&Array.isArray(d2)&&d2.length===0) throw new Error("Permission refusée — aucune ligne créée/modifiée (RLS ou contrainte DB)");
            return d2;
          }
        }
      }
      console.error("[TEAMLY DEBUG][sbFetch] HTTP "+res.status+" path="+path+" body="+e.slice(0,200));
      throw new Error(e);
    }
    const text = await res.text();
    if(!text||text.trim()==="") return null;
    let data;
    try { data = JSON.parse(text); } catch(e) { return null; }
    // Supabase returns 200 + [] when RLS silently blocks a write — detect it
    if((method==="POST"||method==="PATCH"||method==="DELETE") && Array.isArray(data) && data.length===0) {
      throw new Error("Permission refusée — aucune ligne créée/modifiée (RLS ou contrainte DB)");
    }
    return data;
  } catch(e) {
    if(e.name==="AbortError") throw new Error("Délai dépassé — vérifie ta connexion");
    console.error("sbFetch error:", path, e.message);
    throw e;
  }
};

// ── Device fingerprint + info (Web Crypto, no deps) ────────────────────
const getDeviceInfo = () => {
  const ua = navigator.userAgent || "";
  const isTablet  = /iPad|Tablet|PlayBook|Silk(?!.*Mobile)/i.test(ua);
  const isMobile  = !isTablet && /Mobi|Android|iPhone|iPod|Windows Phone|webOS|BlackBerry|Opera Mini/i.test(ua);
  const device_type = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";
  let os = "Unknown";
  if (/Windows NT 11/.test(ua)) os = "Windows 11";
  else if (/Windows NT 10/.test(ua)) os = "Windows 10";
  else if (/Mac OS X (\d+[._]\d+)/.test(ua)) os = "macOS " + ua.match(/Mac OS X (\d+[._]\d+)/)[1].replace("_",".");
  else if (/Android (\d+(\.\d+)?)/.test(ua)) os = "Android " + ua.match(/Android (\d+(\.\d+)?)/)[1];
  else if (/iPhone OS (\d+_\d+)/.test(ua)) os = "iOS " + ua.match(/iPhone OS (\d+_\d+)/)[1].replace("_",".");
  else if (/CPU OS (\d+_\d+)/.test(ua)) os = "iOS " + ua.match(/CPU OS (\d+_\d+)/)[1].replace("_",".");
  else if (/Linux/.test(ua)) os = "Linux";
  let browser = "Browser";
  if (/Edg\/(\d+)/.test(ua))     browser = "Edge "    + ua.match(/Edg\/(\d+)/)[1];
  else if (/OPR\/(\d+)/.test(ua))browser = "Opera "   + ua.match(/OPR\/(\d+)/)[1];
  else if (/Firefox\/(\d+)/.test(ua)) browser = "Firefox " + ua.match(/Firefox\/(\d+)/)[1];
  else if (/CriOS\/(\d+)/.test(ua)) browser = "Chrome iOS " + ua.match(/CriOS\/(\d+)/)[1];
  else if (/Chrome\/(\d+)/.test(ua)) browser = "Chrome " + ua.match(/Chrome\/(\d+)/)[1];
  else if (/Version\/(\d+).*Safari/.test(ua)) browser = "Safari " + ua.match(/Version\/(\d+)/)[1];
  const device_name = device_type === "desktop" ? `${browser} Desktop` : `${os.split(" ")[0]} ${browser.split(" ")[0]}`;
  return { device_type, os, browser, device_name, user_agent: ua };
};

const getDeviceFingerprint = async () => {
  let deviceId = null;
  try { deviceId = localStorage.getItem("teamly_device_id"); } catch(e){}
  if (!deviceId) {
    deviceId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : "did_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    try { localStorage.setItem("teamly_device_id", deviceId); } catch(e){}
  }
  const parts = [
    navigator.userAgent || "",
    `${(screen?.width)||0}x${(screen?.height)||0}`,
    String(new Date().getTimezoneOffset()),
    String(screen?.colorDepth || 0),
    deviceId,
  ].join("|");
  try {
    const buf = new TextEncoder().encode(parts);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch(e) {
    // Fallback: hex of deviceId padded
    return (deviceId.replace(/-/g,"") + "0".repeat(64)).slice(0,64);
  }
};

const registerDeviceSession = async (token) => {
  const fp = await getDeviceFingerprint();
  const info = getDeviceInfo();
  const r = await fetch("/.netlify/functions/register-session", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ device_fingerprint: fp, device_info: info }),
  });
  const data = await r.json().catch(()=>({}));
  return { fingerprint: fp, ...data };
};

const sbAuth = async (email, password, type="login") => {
  try {
    const endpoint = type==="login" ? "/auth/v1/token?grant_type=password" : "/auth/v1/signup";
    const res = await fetchWithTimeout(`${SB_URL}${endpoint}`, {
      method: "POST",
      headers: {"Content-Type":"application/json","apikey":SB_KEY},
      body: JSON.stringify({email, password}),
    }, 30000);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch(e) { throw new Error(`Erreur serveur (${res.status}): ${text.slice(0,120)}`); }
    if(!res.ok) throw new Error(data?.error_description||data?.msg||data?.message||`Erreur ${res.status}`);
    return data;
  } catch(e) {
    if(e.name==="AbortError") throw new Error("Connexion trop lente — réessaie");
    if(e.message.includes("fetch")||e.message.includes("network")) throw new Error("Pas de connexion internet");
    throw e;
  }
};

// PKCE helpers — newer Supabase projects default to PKCE for OAuth, which means
// the callback comes back as ?code=… in the query (not #access_token=… in the
// hash). We generate a code_verifier, store it in localStorage, and send the
// hashed code_challenge to /authorize. The callback handler exchanges the code
// + verifier for tokens at /auth/v1/token?grant_type=pkce.
const _b64url = (buf) => btoa(String.fromCharCode(...buf))
  .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");

const _pkceVerifier = () => {
  const arr = new Uint8Array(32);
  (typeof crypto!=="undefined"?crypto:window.crypto).getRandomValues(arr);
  return _b64url(arr);
};

const _pkceChallenge = async (verifier) => {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return _b64url(new Uint8Array(hash));
};

// Sends the user to Supabase /authorize for Google. Uses PKCE so the callback
// returns ?code=… which the startup useEffect exchanges for tokens. The
// redirect_to URL must be whitelisted in Supabase → URL Configuration.
const signInWithGoogle = async () => {
  try {
    const verifier  = _pkceVerifier();
    const challenge = await _pkceChallenge(verifier);
    try { localStorage.setItem("teamly_pkce_verifier", verifier); } catch(e){}
    const redirectTo = `${window.location.origin}/dashboard`;
    const url = `${SB_URL}/auth/v1/authorize?provider=google`
      + `&redirect_to=${encodeURIComponent(redirectTo)}`
      + `&code_challenge=${challenge}`
      + `&code_challenge_method=S256`;
    window.location.href = url;
  } catch(e) {
    console.error("[TEAMLY OAuth] signInWithGoogle error:", e);
    alert("Erreur lors de l'initialisation Google: "+(e?.message||""));
  }
};

const G = {
  green:"#1A5C38",greenMid:"#2E8B57",greenLight:"#E8F5EE",
  gold:"#F0A500",dark:"#1A1A1A",gray:"#6B7280",
  grayLight:"#F4F4F4",white:"#FFFFFF",red:"#DC2626",blue:"#2563EB",
};

// ── Logo Teamly ──────────────────────────────────────────────────────────────
const TeamlyLogo = ({size=1, dark=false}) => (
  <div style={{display:"flex",alignItems:"center",gap:3*size}}>
    <div style={{
      width:30*size,height:30*size,borderRadius:7*size,
      background:"#F0A500",display:"flex",alignItems:"center",justifyContent:"center",
      flexShrink:0,boxShadow:`0 2px 8px rgba(240,165,0,${size>1?0.5:0.35})`
    }}>
      <svg width={18*size} height={18*size} viewBox="0 0 18 18" fill="none">
        <rect x="1" y="2" width="16" height="2.5" rx="1.2" fill="#1A5C38"/>
        <rect x="7.25" y="4.5" width="3.5" height="11.5" rx="1.2" fill="#1A5C38"/>
      </svg>
    </div>
    <span style={{fontFamily:"Georgia,serif",fontWeight:700,fontSize:22*size,color:dark?"#1A1A1A":"#F0A500",letterSpacing:0.5,lineHeight:1}}>eamly</span>
  </div>
);
const fmt = n => Math.round(Number(n||0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g," ");
const pct = n => (Number(n||0)*100).toFixed(1)+"%";
const localDateStr = (dt = new Date()) => { const d = new Date(dt); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const TODAY = localDateStr();
const FRAIS_LIV = 1500;

// WA_ZONES, _nz, detectZone — moved to src/lib/senegal.js
const PAYMENT_METHODS = [
  {key:"cod",      label:"Espèces (COD)", icon:"💵", color:"#22C55E"},
  {key:"orange",   label:"Orange Money",  icon:"🟠", color:"#F97316"},
  {key:"wave",     label:"Wave",          icon:"💙", color:"#3B82F6"},
  {key:"sendwave", label:"Sendwave",      icon:"💸", color:"#8B5CF6"},
  {key:"free",     label:"Free Money",    icon:"💚", color:"#10B981"},
];
// _nz, detectZone, _normCity, _parseCity, SENEGAL_CITIES, _findSenCity, detectDeliveryZone — moved to src/lib/senegal.js
const fmtCity = s => s.trim().replace(/\b\w/g, c => c.toUpperCase());
const detectCountryFromPhone = phone => { const n=(phone||"").replace(/\s+/g,"").replace(/^\+/,""); if(n.startsWith("221"))return{code:"SN",flag:"🇸🇳",name:"Sénégal"}; if(n.startsWith("223"))return{code:"ML",flag:"🇲🇱",name:"Mali"}; if(n.startsWith("225"))return{code:"CI",flag:"🇨🇮",name:"Côte d'Ivoire"}; if(n.startsWith("228"))return{code:"TG",flag:"🇹🇬",name:"Togo"}; if(n.startsWith("226"))return{code:"BF",flag:"🇧🇫",name:"Burkina Faso"}; if(n.startsWith("229"))return{code:"BJ",flag:"🇧🇯",name:"Bénin"}; return null; };
const parseProd  = str  => (str||"").split(" + ").map(p => { const m = p.match(/^(.+?)\s+[x×](\d+)/i); return {name:(m?m[1]:p).trim(), qty:m?parseInt(m[2]):1}; });
const totalItems = str  => parseProd(str).reduce((s,p) => s+p.qty, 0);

// ── SVG Icon set ────────────────────────────────────────────────────────────
const NavIcon = ({name, size=20, color="#fff"}) => {
  const s = {width:size,height:size,display:"block"};
  const p = {stroke:color,strokeWidth:1.5,fill:"none",strokeLinecap:"round",strokeLinejoin:"round"};
  const icons = {
    dashboard: (
      <svg viewBox="0 0 24 24" style={s}>
        <rect {...p} x="3" y="3" width="8" height="8" rx="2"/>
        <rect {...p} x="13" y="3" width="8" height="8" rx="2"/>
        <rect {...p} x="3" y="13" width="8" height="8" rx="2"/>
        <rect {...p} x="13" y="13" width="8" height="8" rx="2"/>
      </svg>
    ),
    commandes: (
      <svg viewBox="0 0 24 24" style={s}>
        <path {...p} d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z"/>
        <line {...p} x1="3" y1="6" x2="21" y2="6"/>
        <path {...p} d="M9 12l2 2 4-4"/>
      </svg>
    ),
    compta: (
      <svg viewBox="0 0 24 24" style={s}>
        <path {...p} d="M18 20V10M12 20V4M6 20v-6"/>
        <path {...p} d="M3 20h18"/>
      </svg>
    ),
    tracking: (
      <svg viewBox="0 0 24 24" style={s}>
        <path {...p} d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle {...p} cx="12" cy="9" r="2.5"/>
      </svg>
    ),
    clients: (
      <svg viewBox="0 0 24 24" style={s}>
        <circle {...p} cx="12" cy="8" r="4"/>
        <path {...p} d="M4 20c0-3.31 3.58-6 8-6s8 2.69 8 6"/>
      </svg>
    ),
    chat: (
      <svg viewBox="0 0 24 24" style={s}>
        <path {...p} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        <circle cx="9" cy="11" r="1.1" fill={color} stroke="none"/>
        <circle cx="12" cy="11" r="1.1" fill={color} stroke="none"/>
        <circle cx="15" cy="11" r="1.1" fill={color} stroke="none"/>
      </svg>
    ),
    equipe: (
      <svg viewBox="0 0 24 24" style={s}>
        <circle {...p} cx="9" cy="7" r="3.5"/>
        <path {...p} d="M2 21c0-3.5 3.13-6.33 7-6.33S16 17.5 16 21"/>
        <path {...p} d="M17.5 4.5a3.5 3.5 0 010 7"/>
        <path {...p} d="M22 21c0-3-2-5.33-4.5-6"/>
      </svg>
    ),
    stock: (
      <svg viewBox="0 0 24 24" style={s}>
        <path {...p} d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <path {...p} d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>
      </svg>
    ),
    livraisons: (
      <svg viewBox="0 0 24 24" style={s}>
        <rect {...p} x="1" y="3" width="15" height="13" rx="2"/>
        <path {...p} d="M16 8h4l3 4.5V20h-7V8z"/>
        <circle {...p} cx="5.5" cy="18.5" r="2"/>
        <circle {...p} cx="18.5" cy="18.5" r="2"/>
      </svg>
    ),
    frais: (
      <svg viewBox="0 0 24 24" style={s}>
        <rect {...p} x="1" y="3" width="15" height="13" rx="2"/>
        <path {...p} d="M16 8h4l3 4.5V20h-7V8z"/>
        <circle {...p} cx="5.5" cy="18.5" r="2"/>
        <circle {...p} cx="18.5" cy="18.5" r="2"/>
        <line {...p} x1="4" y1="9" x2="10" y2="9"/>
      </svg>
    ),
    position: (
      <svg viewBox="0 0 24 24" style={s}>
        <circle {...p} cx="12" cy="12" r="9"/>
        <circle {...p} cx="12" cy="12" r="3"/>
        <line {...p} x1="12" y1="3" x2="12" y2="6"/>
        <line {...p} x1="12" y1="18" x2="12" y2="21"/>
        <line {...p} x1="3" y1="12" x2="6" y2="12"/>
        <line {...p} x1="18" y1="12" x2="21" y2="12"/>
      </svg>
    ),
    boutique: (
      <svg viewBox="0 0 24 24" style={s}>
        <path {...p} d="M3 9l1-5h16l1 5"/>
        <path {...p} d="M3 9h18v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9z"/>
        <path {...p} d="M9 9v1.5a3 3 0 006 0V9"/>
        <path {...p} d="M10 15h4v6h-4z"/>
      </svg>
    ),
    notifications: (
      <svg viewBox="0 0 24 24" style={s}>
        <path {...p} d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path {...p} d="M13.73 21a2 2 0 01-3.46 0"/>
        <circle cx="18" cy="5" r="2.5" fill="#EF4444" stroke="none"/>
      </svg>
    ),
    settings: (
      <svg viewBox="0 0 24 24" style={s}>
        <circle {...p} cx="12" cy="12" r="3"/>
        <path {...p} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  };
  return icons[name] || <span style={{fontSize:size*0.7,lineHeight:1}}>{name}</span>;
};

const STATUS = {
  pendiente:           {label:"En attente",        color:"#F0A500",bg:"#FFF8E7"},
  confirmado:          {label:"Client confirmé ✅", color:"#2E8B57",bg:"#E8F5EE"},
  livreur_en_route:    {label:"Livreur en route 🏍️",color:"#7C3AED",bg:"#EDE9FE"},
  colis_pris:          {label:"Colis en main 📦",         color:"#2563EB",bg:"#DBEAFE"},
  en_camino:           {label:"Vers le client 🚀",        color:"#0284C7",bg:"#E0F2FE"},
  chez_client:         {label:"Livreur chez le client 📍",color:"#D97706",bg:"#FEF3C7"},
  entregado:           {label:"✅ Encaissé",          color:"#1A5C38",bg:"#D1FAE5"},
  rechazado:           {label:"Rejeté",             color:"#DC2626",bg:"#FEE2E2"},
  no_contesta:         {label:"Absent",             color:"#6B7280",bg:"#F3F4F6"},
  reprogramar:         {label:"Reporter",           color:"#7C3AED",bg:"#EDE9FE"},
  boutique:            {label:"Boutique Shopify 🛒", color:"#96BF48",bg:"#F0F7E6"},
  // ── Régions hors zone principale (prépayé) ──
  en_attente_paiement: {label:"En attente de paiement ⏳", color:"#F0A500",bg:"#FFF8E7"},
  paiement_confirme:   {label:"Paiement confirmé ✅",       color:"#2E8B57",bg:"#E8F5EE"},
  colis_en_main:       {label:"Colis en main 📦",           color:"#2563EB",bg:"#DBEAFE"},
  en_route:            {label:"En route 🏍️",                color:"#7C3AED",bg:"#EDE9FE"},
  remis_transporteur:  {label:"Remis au transporteur 🚌",   color:"#0891B2",bg:"#CFFAFE"},
};

// Statuts intermédiaires livreur — l'ordre ne doit JAMAIS disparaître tant qu'il n'est pas final
const LIV_ACTIVE = new Set([
  "confirmado","livreur_en_route","colis_pris","en_camino","chez_client","no_contesta","reprogramar",
  // Flux régions hors zone principale (visibles livreur dès paiement_confirme)
  "paiement_confirme","colis_en_main","en_route",
]);
const LIV_FINAL  = new Set(["entregado","rechazado","remis_transporteur"]);

const INIT_PRODUCTS = [
  {id:1,name:"Chaussures Nike",cost:7000, price:25000,stock:42,fraisLiv:1500,niche:"Mode & Chaussures",
   bundles:[
     {id:1,label:"Pack 2",type:"quantite",qte:2,qteOfferte:0,prixVente:40000,livraisonOfferte:false},
     {id:2,label:"Buy 2 Get 1",type:"bxgyf",  qte:2,qteOfferte:1,prixVente:36000,livraisonOfferte:false},
   ]},
  {id:2,name:"Sac à main",     cost:5000, price:18000,stock:28,fraisLiv:1500,niche:"Mode & Chaussures",
   bundles:[
     {id:1,label:"Pack 3",type:"quantite",qte:3,qteOfferte:0,prixVente:45000,livraisonOfferte:true},
   ]},
  {id:3,name:"Montre Casio",   cost:9000, price:32000,stock:15,fraisLiv:2000,niche:"Électronique",
   bundles:[]},
];

const INIT_BUNDLES = [
  {id:1,name:"Pack 2 Chaussures",   type:"quantite",  produits:[{nom:"Chaussures Nike",qte:2}],            qteOfferte:0,remisePct:0, prixVente:40000,livraisonOfferte:false,venduAuj:3,rejetAuj:1},
  {id:2,name:"Buy 2 Get 1 Free Sac",type:"bxgyf",     produits:[{nom:"Sac à main",     qte:2}],            qteOfferte:1,remisePct:0, prixVente:36000,livraisonOfferte:false,venduAuj:2,rejetAuj:0},
  {id:3,name:"Kit Montre + Sac",    type:"kit",        produits:[{nom:"Montre Casio",qte:1},{nom:"Sac à main",qte:1}],qteOfferte:0,remisePct:0,prixVente:42000,livraisonOfferte:true, venduAuj:1,rejetAuj:0},
  {id:4,name:"Pack 3 remise 15%",   type:"remise_pct", produits:[{nom:"Chaussures Nike",qte:3}],            qteOfferte:0,remisePct:15,prixVente:63750,livraisonOfferte:false,venduAuj:2,rejetAuj:1},
];

const INIT_ORDERS = [
  {id:1, client:"Moussa Diallo", phone:"771234567",address:"Médina, Dakar",   product:"Chaussures Nike",   price:25000,status:"confirmado", livreur:"Ibou",   closer:"Aminata",note:"",isBundle:false},
  {id:2, client:"Fatou Ndiaye",  phone:"781234567",address:"Plateau, Dakar",  product:"Sac à main",        price:18000,status:"en_camino",  livreur:"Mamadou",closer:"Binta",  note:"",isBundle:false},
  {id:3, client:"Amadou Sow",    phone:"701234567",address:"Parcelles, Dakar",product:"Montre Casio",      price:32000,status:"pendiente",  livreur:null,     closer:null,     note:"",isBundle:false},
  {id:4, client:"Aïssatou Diop", phone:"761234567",address:"Yoff, Dakar",     product:"Chaussures Nike",   price:25000,status:"entregado",  livreur:"Ibou",   closer:"Aminata",note:"",isBundle:false},
  {id:5, client:"Omar Ba",       phone:"771234568",address:"Ngor, Dakar",     product:"Sac à main",        price:18000,status:"rechazado",  livreur:"Cheikh", closer:"Binta",  note:"Absent",isBundle:false},
  {id:6, client:"Rokhaya Seck",  phone:"781234569",address:"Ouakam, Dakar",   product:"Pack 2 Chaussures", price:40000,status:"entregado",  livreur:"Ibou",   closer:"Aminata",note:"",isBundle:true},
  {id:7, client:"Moussa Diallo", phone:"771234567",address:"Médina, Dakar",   product:"Sac à main",        price:18000,status:"entregado",  livreur:"Mamadou",closer:"Aminata",note:"",isBundle:false},
  {id:8, client:"Moussa Diallo", phone:"771234567",address:"Médina, Dakar",   product:"Montre Casio",      price:32000,status:"rechazado",  livreur:"Ibou",   closer:"Aminata",note:"",isBundle:false},
  {id:9, client:"Omar Ba",       phone:"771234568",address:"Ngor, Dakar",     product:"Chaussures Nike",   price:25000,status:"rechazado",  livreur:"Cheikh", closer:"Binta",  note:"Ne répond pas",isBundle:false},
  {id:10,client:"Fatou Ndiaye",  phone:"781234567",address:"Plateau, Dakar",  product:"Chaussures Nike",   price:25000,status:"entregado",  livreur:"Mamadou",closer:"Binta",  note:"",isBundle:false},
];

const INIT_CHAT = [
  {from:"Admin",   text:"Bon matin team!",      time:"09:00"},
  {from:"Aminata", text:"Commande #3 confirmée.",time:"09:10"},
  {from:"Ibou",    text:"Commande #1 livrée ✓", time:"09:45"},
];

const LIVREURS_DATA = []; // static fallback
const CLOSERS_DATA  = []; // static fallback
const LIVREURS = LIVREURS_DATA.map(x=>x.name);
const CLOSERS  = CLOSERS_DATA.map(x=>x.name);

function ToastContainer({toasts}) {
  if(!toasts||toasts.length===0) return null;
  return (
    <div style={{position:"fixed",top:70,right:12,zIndex:999,display:"flex",flexDirection:"column",gap:8,maxWidth:300}}>
      {toasts.map(t=>(
        <div key={t.id} style={{background:G.white,borderRadius:12,padding:"10px 14px",boxShadow:"0 4px 20px rgba(0,0,0,0.15)",borderLeft:`4px solid ${t.color||G.green}`,display:"flex",alignItems:"center",gap:8,animation:"slideIn 0.3s ease"}}>
          <span style={{fontSize:20,flexShrink:0}}>{t.icon}</span>
          <span style={{fontSize:13,fontWeight:600,color:G.dark}}>{t.msg}</span>
        </div>
      ))}
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
}

function BarChart({data, height=130}) {
  if(!data||data.length===0) return null;
  const maxVal = Math.max(...data.map(d=>Math.max(d.v1||0,d.v2||0)),1);
  const w = 100/data.length;
  return (
    <svg viewBox={"0 0 100 "+height} style={{width:"100%",height,display:"block"}} preserveAspectRatio="none">
      {data.map((d,i)=>{
        const bh1=(d.v1/maxVal)*(height-20);
        const bh2=(d.v2/maxVal)*(height-20);
        const x=i*w+w*0.08;
        return (
          <g key={i}>
            <rect x={x} y={height-20-bh1} width={w*0.38} height={bh1} fill="#1A5C38" rx="1" opacity="0.85"/>
            {d.v2!==undefined&&<rect x={x+w*0.42} y={height-20-bh2} width={w*0.38} height={bh2} fill="#F0A500" rx="1" opacity="0.85"/>}
            <text x={x+w*0.38} y={height-5} textAnchor="middle" fontSize="4" fill="#6B7280">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function SC({icon,label,value,color=G.dark,bg=G.white,onClick}) {
  return (
    <div onClick={onClick} style={{background:bg,borderRadius:12,padding:"11px 12px",flex:1,minWidth:0,boxShadow:"0 1px 4px rgba(0,0,0,0.05)",cursor:onClick?"pointer":"default",position:"relative"}}>
      <div style={{fontSize:18}}>{icon}</div>
      <div style={{fontSize:20,fontWeight:700,color,marginTop:3}}>{value}</div>
      <div style={{fontSize:11,color:G.gray,marginTop:1}}>{label}</div>
      {onClick&&<div style={{position:"absolute",top:8,right:10,fontSize:10,color:G.gray}}>→</div>}
    </div>
  );
}

function ST({children}) {
  return <div style={{fontWeight:700,fontSize:13,color:G.green,letterSpacing:0.5,marginBottom:9,paddingBottom:6,borderBottom:`1px solid ${G.grayLight}`}}>{children}</div>;
}

function Tbl({headers,rows,align}) {
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead>
          <tr style={{background:G.greenLight}}>
            {headers.map((h,i)=><th key={i} style={{padding:"7px 8px",textAlign:align?.[i]||"left",color:G.green,fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i)=>(
            <tr key={i} style={{background:i%2===0?G.white:"#F9F9F9",borderBottom:`1px solid ${G.grayLight}`}}>
              {row.map((cell,j)=><td key={j} style={{padding:"7px 8px",textAlign:align?.[j]||"left",whiteSpace:"nowrap"}}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function bundleCout(b, products) {
  return b.produits.reduce((acc,p) => {
    const prod = products.find(x=>x.name===p.nom);
    const qr = b.type==="bxgyf" ? (p.qte+(b.qteOfferte||0)) : p.qte;
    return acc + (prod?prod.cost:0)*qr;
  }, 0);
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = {error:null}; }
  static getDerivedStateFromError(e) { return {error:e}; }
  render() {
    if(this.state.error) return (
      <div style={{padding:24,background:"#1A5C38",minHeight:"100vh",color:"white",fontFamily:"sans-serif"}}>
        <div style={{fontSize:24,marginBottom:16}}>⚠️ Erreur Teamly</div>
        <div style={{background:"rgba(255,255,255,0.1)",borderRadius:12,padding:16,fontSize:12,wordBreak:"break-all",marginBottom:16}}>
          {this.state.error.message}
        </div>
        <button onClick={()=>{localStorage.clear();window.location.reload();}} 
          style={{background:"#F0A500",color:"#000",border:"none",borderRadius:10,padding:"12px 24px",fontWeight:700,cursor:"pointer"}}>
          🔄 Réinitialiser et recommencer
        </button>
      </div>
    );
    return this.props.children;
  }
}


function makeMarkerIcon(L, name, city="") {
  return L.divIcon({
    html:`<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="background:#1A5C38;border:2px solid #F0A500;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 10px rgba(0,0,0,0.35)">🏍️</div>
      <div style="background:#1A5C38;color:#F0A500;font-size:10px;font-weight:800;padding:2px 7px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);letter-spacing:0.3px">${name}</div>
      ${city?`<div style="background:rgba(255,255,255,0.92);color:#1A5C38;font-size:9px;font-weight:700;padding:1px 6px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.2)">📍 ${city}</div>`:""}
    </div>`,
    className:"", iconSize:[90, city?72:58], iconAnchor:[45, city?62:48]
  });
}

async function geocodeAddress(address) {
  if(!address) return null;
  try {
    const q = encodeURIComponent(address.trim()+", Sénégal");
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&accept-language=fr`);
    const d = await r.json();
    if(d&&d.length>0) return {lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon)};
  } catch(e) {}
  return null;
}

function MapView({positions, role, isDesktop=false, destination=null, livreurPos=null}) {
  const containerRef   = useRef(null);
  const stateRef       = useRef({map:null, markers:{}, loaded:false});
  const routeLayerRef  = useRef(null);
  const userMovedRef   = useRef(false);
  const [fullscreen, setFullscreen] = React.useState(false);

  useEffect(()=>{
    if(!document.getElementById("leaflet-css")) {
      const l = document.createElement("link");
      l.id="leaflet-css"; l.rel="stylesheet";
      l.href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(l);
    }

    const setupMap = () => {
      if(!containerRef.current || stateRef.current.map) return;
      const L = window.L;
      if(!L) return;
      const entries = Object.values(positions).filter(p=>p?.lat);
      const center = entries.length>0 ? [entries[0].lat, entries[0].lng] : [14.7167,-17.4677];
      const map = L.map(containerRef.current, {
        zoomControl:true,
        scrollWheelZoom:true,
        touchZoom:true,
        doubleClickZoom:true,
        attributionControl:false,
        tap:true,
      }).setView(center, 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
      stateRef.current.map = map;
      stateRef.current.loaded = true;
      // Detectar interacción manual del usuario
      map.on("dragstart zoomstart", ()=>{ userMovedRef.current = true; });
      Object.entries(positions).forEach(([name,pos])=>{
        if(!pos?.lat) return;
        const popup = `<div style="font-size:13px"><b>🏍️ ${name}</b>${pos.city?`<br><span style="color:#666;font-size:11px">📍 ${pos.city}</span>`:""}</div>`;
        stateRef.current.markers[name] = L.marker([pos.lat,pos.lng],{icon:makeMarkerIcon(L,name,pos.city||"")}).addTo(map).bindPopup(popup);
      });
    };

    if(window.L) { setTimeout(setupMap,150); }
    else {
      const s = document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      s.onload=()=>setTimeout(setupMap,150);
      document.head.appendChild(s);
    }
    return ()=>{ if(stateRef.current.map){try{stateRef.current.map.remove();}catch(e){} stateRef.current={map:null,markers:{},loaded:false};} };
  },[]);

  useEffect(()=>{
    const {map, markers, loaded} = stateRef.current;
    if(!loaded||!map||!window.L) return;
    const L = window.L;
    Object.entries(positions).forEach(([name,pos])=>{
      if(!pos?.lat) return;
      const popup = `<div style="font-size:13px"><b>🏍️ ${name}</b>${pos.city?`<br><span style="color:#666;font-size:11px">📍 ${pos.city}</span>`:""}</div>`;
      if(markers[name]) {
        markers[name].setLatLng([pos.lat,pos.lng]).setPopupContent(popup);
        markers[name].setIcon(makeMarkerIcon(L,name,pos.city||""));
      } else {
        markers[name] = L.marker([pos.lat,pos.lng],{icon:makeMarkerIcon(L,name,pos.city||"")}).addTo(map).bindPopup(popup);
      }
    });
  },[positions]);

  // Destination pin (red) for active delivery
  React.useEffect(()=>{
    if(!destination?.lat) return;
    const tryAdd = ()=>{
      const {map,markers,loaded}=stateRef.current;
      if(!loaded||!map||!window.L){setTimeout(tryAdd,300);return;}
      const L=window.L;
      const icon=L.divIcon({html:`<div style="width:20px;height:20px;background:#EF4444;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>`,className:"",iconSize:[20,20],iconAnchor:[10,10]});
      const popup=`<div style="font-size:13px"><b>📍 ${destination.client||"Livraison"}</b><br><span style="color:#666;font-size:11px">${destination.address||""}</span></div>`;
      if(markers["__dest__"]){markers["__dest__"].setLatLng([destination.lat,destination.lng]).setPopupContent(popup);}
      else{
        markers["__dest__"]=L.marker([destination.lat,destination.lng],{icon,zIndexOffset:1000}).addTo(map).bindPopup(popup).openPopup();
        const pts=Object.values(markers).filter(m=>m.getLatLng).map(m=>m.getLatLng());
        if(pts.length>1){try{map.fitBounds(L.latLngBounds(pts),{padding:[40,40]});}catch(e){}}
      }
    };
    tryAdd();
  },[destination]);

  // OSRM route line: livreur → destination
  React.useEffect(()=>{
    if(!destination?.lat||!livreurPos?.lat) return;
    const drawRoute=()=>{
      const {map,loaded}=stateRef.current;
      if(!loaded||!map||!window.L){setTimeout(drawRoute,400);return;}
      const L=window.L;
      // Remove old route
      if(routeLayerRef.current){try{map.removeLayer(routeLayerRef.current);}catch(e){} routeLayerRef.current=null;}
      const url=`https://router.project-osrm.org/route/v1/driving/${livreurPos.lng},${livreurPos.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
      fetch(url).then(r=>r.json()).then(data=>{
        const coords=data.routes?.[0]?.geometry?.coordinates;
        if(!coords) return;
        const latlngs=coords.map(([lng,lat])=>[lat,lng]);
        routeLayerRef.current=L.polyline(latlngs,{color:"#2563EB",weight:5,opacity:0.85,lineCap:"round",lineJoin:"round"}).addTo(map);
        // Animate a dashed overlay on top for Bolt-like style
        L.polyline(latlngs,{color:"#fff",weight:2,opacity:0.5,dashArray:"10,14",lineCap:"round"}).addTo(map);
        if(!userMovedRef.current) map.fitBounds(routeLayerRef.current.getBounds(),{padding:[50,50]});
      }).catch(()=>{});
    };
    drawRoute();
  },[destination,livreurPos]);

  // Invalide la taille de la carte quand on change de mode
  React.useEffect(()=>{
    setTimeout(()=>stateRef.current.map?.invalidateSize(),100);
  },[fullscreen]);

  return (
    <div style={{
      position: fullscreen ? "fixed" : "relative",
      inset: fullscreen ? 0 : undefined,
      zIndex: fullscreen ? 9999 : undefined,
      background: fullscreen ? "#000" : undefined,
      isolation:"isolate",
    }}>
      <style>{`.leaflet-control-zoom a{width:36px!important;height:36px!important;line-height:36px!important;font-size:20px!important;}`}</style>

      {/* Bouton plein écran */}
      <button onClick={()=>setFullscreen(f=>!f)} style={{
        position:"absolute", top:10, right:10, zIndex:1000,
        background:"#fff", border:"none", borderRadius:8,
        width:36, height:36, cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:"0 2px 6px rgba(0,0,0,0.25)", fontSize:16,
      }}>
        {fullscreen ? "✕" : "⛶"}
      </button>

      <div ref={containerRef} style={{
        height: fullscreen ? "100dvh" : isDesktop ? 480 : role==="livreur" ? "calc(100dvh - 200px)" : 320,
        width:"100%",
        background:"#E8F4F8",
        borderRadius: fullscreen ? 0 : 12,
      }}/>
    </div>
  );
}


function TourneeBlock({orders, onConfirm, G, fmt, mode="recuperer"}) {
  const [selected, setSelected] = useState(()=>new Set(orders.map(o=>o.id)));
  const [confirmed, setConfirmed] = useState(false);
  const toggle = (id) => setSelected(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  const total = orders.filter(o=>selected.has(o.id)).reduce((a,o)=>a+o.price,0);

  const isLivrer = mode==="livrer";
  const bgGrad   = isLivrer ? "linear-gradient(135deg,#0284C7,#1D4ED8)" : "linear-gradient(135deg,#1A5C38,#0D3D25)";
  const accent   = isLivrer ? "#60A5FA" : "#F0A500";
  const title    = isLivrer ? "🚀 Partir vers les clients" : "📦 Tournée du jour";
  const subtitle = isLivrer ? `${orders.length} colis récupérés — prêts à livrer` : `${orders.length} colis à récupérer chez l'Admin`;
  const btnLabel = (n) => isLivrer ? `🚀 Je pars vers ${n} client${n>1?"s":""}` : `🏍️ Je pars récupérer ${n} colis`;
  const confirmedMsg = isLivrer ? "En route vers les clients !" : "Tournée confirmée !";
  const confirmedSub = isLivrer ? `${selected.size} livraisons en cours` : `${selected.size} colis — partez récupérer`;
  const confirmedIcon = isLivrer ? "🚀" : "🏍️";

  if(confirmed) return (
    <div style={{background:isLivrer?"#DBEAFE":G.greenLight,borderRadius:16,padding:18,textAlign:"center",border:`2px solid ${isLivrer?"#60A5FA":G.green}`}}>
      <div style={{fontSize:36,marginBottom:8}}>{confirmedIcon}</div>
      <div style={{fontWeight:800,fontSize:16,color:isLivrer?G.blue:G.green}}>{confirmedMsg}</div>
      <div style={{fontSize:12,color:G.gray,marginTop:4}}>{confirmedSub}</div>
    </div>
  );

  return (
    <div style={{background:bgGrad,borderRadius:16,padding:18}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontWeight:800,fontSize:16,color:accent}}>{title}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:2}}>{subtitle}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:18,fontWeight:700,color:accent}}>{fmt(total)}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>CFA total</div>
        </div>
      </div>

      {/* Sélectionner tout */}
      <button onClick={()=>selected.size===orders.length?setSelected(new Set()):setSelected(new Set(orders.map(o=>o.id)))}
        style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,padding:"5px 12px",color:"rgba(255,255,255,0.7)",fontSize:11,cursor:"pointer",textAlign:"left",fontWeight:600,marginBottom:8,width:"100%"}}>
        {selected.size===orders.length?"☑️ Tout désélectionner":"☐ Tout sélectionner"}
      </button>

      {/* Liste */}
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
        {orders.map((o)=>{
          const isSel = selected.has(o.id);
          return (
            <div key={o.id} onClick={()=>toggle(o.id)}
              style={{background:isSel?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.05)",borderRadius:12,padding:"11px 14px",cursor:"pointer",border:`1.5px solid ${isSel?accent+"99":"rgba(255,255,255,0.1)"}`,display:"flex",alignItems:"center",gap:10,transition:"all 0.15s"}}>
              <div style={{width:22,height:22,borderRadius:6,background:isSel?accent:"rgba(255,255,255,0.15)",border:`2px solid ${isSel?accent:"rgba(255,255,255,0.3)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {isSel&&<span style={{fontSize:12,color:"#1A1A1A",fontWeight:800}}>✓</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:13,color:"#FFF"}}>{o.client}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  📍 {o.address} · 📦 {o.product}
                </div>
              </div>
              <div style={{fontWeight:700,fontSize:13,color:accent,flexShrink:0}}>{fmt(o.price)} CFA</div>
            </div>
          );
        })}
      </div>

      {/* Bouton confirmer */}
      <button
        disabled={selected.size===0}
        onClick={()=>{ onConfirm([...selected]); setConfirmed(true); }}
        style={{width:"100%",background:selected.size>0?accent:"rgba(255,255,255,0.2)",color:selected.size>0?"#1A1A1A":"rgba(255,255,255,0.4)",border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:selected.size>0?"pointer":"not-allowed",transition:"all 0.2s"}}>
        {selected.size===0 ? "Sélectionne au moins un" : btnLabel(selected.size)}
      </button>
    </div>
  );
}

function AppInner() {
  const [role,setRole] = useState(null);
  // Allow tryRefreshToken (module-level) to update React token state
  useEffect(()=>{ _setSbTokenFn = (tok)=>{ setSbToken(tok); }; }, []);
  const [orders,setOrders]   = useState([]);
  const [products,setProducts] = useState([]);
  const [bundles,setBundles] = useState(INIT_BUNDLES);
  const [chat,setChat]       = useState([]);
  const [chatMsg,setChatMsg] = useState("");
  const [tab,setTab]         = useState(()=>{
    try {
      const savedRole = localStorage.getItem("teamly_role");
      if(savedRole==="closer") return "dashboard";
      return localStorage.getItem("teamly_tab")||"dashboard";
    } catch(e){ return "dashboard"; }
  });
  const [comptaView,setComptaView] = useState("produits");
  const [showAdd,setShowAdd] = useState(false);
  const [showWA,setShowWA]   = useState(false);
  const [waUrl,setWaUrl]     = useState("");
  const [showAddProd,setShowAddProd]   = useState(false);
  const [showAddBundle,setShowAddBundle] = useState(false);
  const [noteModal,setNoteModal] = useState(null);
  const [noteText,setNoteText]   = useState("");
  const [mainRegion,   setMainRegion]   = useState(null);
  const [otherRegions, setOtherRegions] = useState([]);
  const [zoneBannersDismissed, setZoneBannersDismissed] = useState(false);
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(()=>{ try{return localStorage.getItem("teamly_email_banner_dismissed")==="1";}catch(e){return false;} });
  const [fraisConfigTab,    setFraisConfigTab]    = useState("config");
  const [fraisTestCity,     setFraisTestCity]     = useState("");
  const [fraisMainNameEdit, setFraisMainNameEdit] = useState(null);
  const [fraisNewMain,      setFraisNewMain]      = useState({city:"",price:""});
  const [fraisNewOther,     setFraisNewOther]     = useState({city:"",price:"",interurbain:""});
  const [fraisEditCity,     setFraisEditCity]     = useState(null);
  const [fraisTableauSearch,setFraisTableauSearch]= useState("");
  const [fraisTableauFilter,setFraisTableauFilter]= useState("all");
  const [newOrder,setNewOrder]   = useState({client:"",phone:"",address:"",city:"",product:"",bundle:"",price:"",qty:"1",discount:"",livreur:"",deliveryStatus:"confirmado",deliveryZoneType:"unknown",deliveryZoneName:"",deliveryFee:"",deliveryFeeOverridden:false,zone:"sn_dakar",fraisLiv:1500,paymentMethod:"cod"});
  const [newProd,setNewProd]     = useState({name:"",cost:"",price:"",stock:"",niche:"",bundles:[]});
  const [newBundleForm,setNewBundleForm] = useState({label:"",type:"quantite",qte:"2",qteOfferte:"1",prixVente:"",livraisonOfferte:false});
  const [newBundle,setNewBundle] = useState({name:"",type:"quantite",prodNom:"",prodQte:"2",qteOfferte:"1",remisePct:"",prixVente:"",livraisonOfferte:false});
  const [adSpend,setAdSpend]           = useState(()=>{try{return JSON.parse(localStorage.getItem("teamly_ad_spend")||"null")||{};}catch(e){return {};}});
  const [livraisonsEchouees,setLivraisonsEchouees] = useState(()=>{try{return JSON.parse(localStorage.getItem("teamly_echecs")||"null")||{};}catch(e){return {};}});
  const [comptaCostEdit,setComptaCostEdit] = useState({}); // {prodId:{cost,fraisLiv,stock}}
  const [comptaSaving,setComptaSaving]     = useState(null); // prodId en cours de sauvegarde
  const [expandedProd,setExpandedProd]     = useState(null); // produit id ouvert en détail
  const [isDesktop, setIsDesktop]          = useState(()=>window.innerWidth>=900);
  const [screenW,   setScreenW]            = useState(()=>window.innerWidth);

  // ── AI Assistant ──────────────────────────────────────────────────────────
  const [aiOpen,   setAiOpen]    = useState(false);
  const [aiMsgs,   setAiMsgs]    = useState([]);
  const [aiInput,  setAiInput]   = useState("");
  const [aiLoading,setAiLoading] = useState(false);
  const aiBottomRef  = useRef(null);
  const aiScrollRef  = useRef(null);

  useEffect(()=>{
    const onResize = ()=>{ setIsDesktop(window.innerWidth>=900); setScreenW(window.innerWidth); };
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);

  const [keyboardH, setKeyboardH] = useState(0);
  useEffect(()=>{
    const vv = window.visualViewport;
    if(!vv) return;
    const update = ()=>{
      const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardH(kh);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return ()=>{ vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  },[]);
  const [cashRemis,setCashRemis]       = useState("");
  const [comptaExpandedProd,setComptaExpandedProd] = useState(null);
  const [comptaExportOpen,setComptaExportOpen]     = useState(false);
  const [comptaPeriodMode,setComptaPeriodMode]     = useState(()=>{try{const s=JSON.parse(localStorage.getItem("teamly_compta_filter")||"{}").shortcut;if(s==="thismonth"||s==="lastmonth")return"mois";if(!s)return"plage";return"jour";}catch(e){return"jour";}});
  const [fraisAdminEditId,setFraisAdminEditId]     = useState(null);
  const [fraisAdminEditVal,setFraisAdminEditVal]   = useState("");
  const _COMPTA_FILTERS_DEFAULT = {produits:[],livraisonType:"all",region:"",ville:"",livreurs:[],statuts:["entregado"],source:"all"};
  const [comptaFilters,setComptaFilters]           = useState(()=>{try{return JSON.parse(localStorage.getItem("teamly_compta_adv_filters")||"null")||_COMPTA_FILTERS_DEFAULT;}catch(e){return _COMPTA_FILTERS_DEFAULT;}});
  const [comptaFiltersOpen,setComptaFiltersOpen]   = useState(false);
  const [toasts,setToasts]             = useState([]); // [{id,msg,color,icon}]
  const [dateFrom,setDateFrom]         = useState(()=>{try{return JSON.parse(localStorage.getItem("teamly_compta_filter")||"{}").dateFrom||TODAY;}catch(e){return TODAY;}});
  const [dateTo,setDateTo]             = useState(()=>{try{return JSON.parse(localStorage.getItem("teamly_compta_filter")||"{}").dateTo||TODAY;}catch(e){return TODAY;}});
  const [newAssignment,setNewAssignment] = useState(null);
  const [showGpsPrompt,setShowGpsPrompt] = useState(false);
  const [showIosInstall,setShowIosInstall] = useState(false);
  const [confirmModal,setConfirmModal]   = useState(null);
  const [memberModal,setMemberModal]     = useState(null); // {member}
  const [assignLivreurModal,setAssignLivreurModal] = useState(null); // {order}
  const [assignSelLiv,setAssignSelLiv]             = useState(null); // selected livreur member
  const [assignDelStatus,setAssignDelStatus]       = useState("confirmado");
  const [pricingRules,   setPricingRules]   = useState([]);
  const [pricingPopup,   setPricingPopup]   = useState(null);
  const [pricingChecked, setPricingChecked] = useState(new Set());
  const [sbToken,setSbToken]             = useState(null);  // JWT token
  const [orgId,setOrgId]                 = useState(null);
  const [sbReady,setSbReady]             = useState(false);
  const [dataReady,setDataReady]         = useState(false);
  const [currentUser,setCurrentUser]     = useState({id:"",nom:"",email:"",role:"admin"});
  const [teamMembers,setTeamMembers]     = useState([]);
  const [dbNotifs,setDbNotifs]           = useState([]); // from Supabase notifications table
  const dismissNotif = (id) => {
    try {
      const key = `notif_dismissed_${orgId}`;
      const s = new Set(JSON.parse(localStorage.getItem(key)||"[]"));
      s.add(String(id));
      localStorage.setItem(key, JSON.stringify([...s].slice(-300)));
    } catch(e) {}
  };
  const [appLoading,setAppLoading]       = useState(()=>{
    try {
      // If this is an invite link, don't show loading - show join form directly
      const params = new URLSearchParams(window.location.search);
      if(params.get("org") && params.get("role")) return false;
      return !!localStorage.getItem("teamly_token");
    } catch(e){ return false; }
  });
  const [debugVisible, setDebugVisible] = useState(true);
  const [sbError,setSbError]             = useState(null);
  const prevOrdersRef                  = useRef(null);
  const [gestionMode,setGestionMode]   = useState(null); // null | "solo" | "delegue"
  const [remise,setRemise]     = useState({});
  const [comptaShortcut,setComptaShortcut] = useState(()=>{try{return JSON.parse(localStorage.getItem("teamly_compta_filter")||"{}").shortcut||"today";}catch(e){return"today";}});
  const [livFinalConfirm, setLivFinalConfirm] = useState(null); // {orderId, type:"livre"|"rejete", client, price}
  const [livFinalNote,    setLivFinalNote]    = useState("");
  const [livBtnLoading,   setLivBtnLoading]   = useState(null);
  const [livConfirming,   setLivConfirming]   = useState(false);
  const [conflictDelivery,setConflictDelivery]= useState(null);
  const [showClientDetail, setShowClientDetail] = useState(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [filterStatus, setFilterStatus] = useState(()=>{try{const s=new URLSearchParams(window.location.search).get("status");if(s)return s;}catch(e){}return "all";});
  const [filterDate,   setFilterDate]   = useState(()=>{try{const u=new URLSearchParams(window.location.search).get("date");if(u&&["today","yesterday","week","all"].includes(u))return u;return localStorage.getItem("teamly_filter_date")||"all";}catch(e){return "all";}});
  const filterDateRef = useRef(filterDate);
  const [filterLivreur,    setFilterLivreur]    = useState("all");
  const [livResultFilter,  setLivResultFilter]  = useState([]); // multi-select result statuses for livreur
  const [refreshing, setRefreshing]     = useState(false);
  const [showSearch, setShowSearch]     = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [editOrder, setEditOrder]       = useState(null);
  const [showArchived, setShowArchived]   = useState(false);
  const [orderDetail, setOrderDetail]     = useState(null);
  const [dismissedNotifs,setDismissedNotifs] = useState(()=>{try{return new Set(JSON.parse(localStorage.getItem("teamly_dismissed")||"[]"))}catch(e){return new Set()}});
  const [isRecording,setIsRecording]       = useState(false);
  const isRecordingRef                     = useRef(false); // ref avoids stale closure in stopRecord
  const [audioChunks,setAudioChunks]       = useState([]);
  const mediaRecorderRef                   = useRef(null);
  const audioTimerRef                      = useRef(null);
  const [recordSecs,setRecordSecs]         = useState(0);
  const [chatUnread,setChatUnread]         = useState(0);
  const [profileEdit,setProfileEdit]       = useState({nom:"",phone:"",birthday:""});
  const [orgMemberCount,setOrgMemberCount] = useState(null);
  const [clientCat,setClientCat]           = useState("confirme");
  const [clientDate,setClientDate]         = useState("all");
  const [clientLoading,setClientLoading]   = useState(false);
  const [selectedMsgId,setSelectedMsgId]  = useState(null);
  const [playingMsgId,setPlayingMsgId]    = useState(null);
  const audioRef                           = useRef(null);
  const chatBottomRef                      = useRef(null);
  const pendingUploadsRef                  = useRef(new Map());
  const chatScrollRef                      = useRef(null);
  const tabRef                             = useRef(tab);
  const currentUserRef                     = useRef(currentUser);
  const loadChatRef                        = useRef(null);
  const loadMainRef                        = useRef(null);
  const [chatShowNew, setChatShowNew]      = useState(false);
  const [lightboxSrc, setLightboxSrc]     = useState(null);
  const [attachMenuOpen, setAttachMenuOpen]= useState(false);
  const [chatLoading, setChatLoading]      = useState(true);
  const [authStep, setAuthStep]   = useState(()=>{
    const params = new URLSearchParams(window.location.search);
    if(params.get("org") && params.get("role")) return "join";
    return "login";
  });
  const [authMode, setAuthMode]   = useState(()=>{
    try { return new URLSearchParams(window.location.search).get("signup")==="1" ? "register" : "login"; }
    catch(e) { return "login"; }
  });
  const [otpCode, setOtpCode]     = useState(["","","","","",""]);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpResendIn, setOtpResendIn]   = useState(0);
  const [googleOnboard, setGoogleOnboard] = useState(null); // {userId, email, fullName} when new Google user needs to set boutique+phone
  const [authForm, setAuthForm]   = useState(()=>{
    const params = new URLSearchParams(window.location.search);
    const org  = params.get("org")  || "";
    const role = params.get("role") || "";
    const tok  = params.get("token")|| "";
    return {email:"",password:"",boutique:"",whatsapp:"",nom:"",phone:"",adresse:"",otp:"",
      inviteOrg:org, inviteRole:role, inviteToken:tok,
      inviteUrl: org ? window.location.href : ""
    };
  });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [dragIdx,setDragIdx]               = useState(null);
  const [showNotifSettings,setShowNotifSettings] = useState(false);
  const [showNotifPanel, setShowNotifPanel]     = useState(false);
  // Device session limit
  const [deviceFingerprint, setDeviceFingerprint] = useState(null);
  const [deviceLimitModal, setDeviceLimitModal] = useState(null); // {sessions, retry}
  const [kickedOut, setKickedOut] = useState(false);
  const [mySessions, setMySessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [settings, setSettings]         = useState({boutique:"Ma Boutique", whatsapp:"221771234567", nom:"Admin", plan:"gratuit", notifStock:true, notifRejet:true, notifSansLivreur:true, notifLivre:true, notifRetour:true, notifChat:true, closerCompta:false, baseZone:"sn_dakar", defaultDeliveryPrice:3500, regional_local_fee:1500, regional_transport_fee:2000});
  const [showSettings, setShowSettings] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(14);
  const [isPro,         setIsPro]         = useState(false);
  const [isOwnerOrg,    setIsOwnerOrg]    = useState(false);
  const [payLoading,    setPayLoading]    = useState(false);
  const [saClients,     setSaClients]     = useState([]);
  const [saLoading,     setSaLoading]     = useState(false);
  const [saPlanEdit,    setSaPlanEdit]    = useState({});
  const OWNER_EMAIL = "salioumbayee877@gmail.com";
  const OWNER_EMAILS = ["salioumbayee877@gmail.com","salioumbayeee261@gmail.com","mamadou@gmail.com","sezambackelo@gmail.com","gueyediarria@gmail.com","diarriag@gmail.com"];
  const [stockAjout, setStockAjout]     = useState({});
  const [editProd,   setEditProd]       = useState(null);
  const [waTemplate, setWaTemplate]     = useState(`✅ Commande confirmée !\n\n📦 {produit}\n💰 {prix} CFA (paiement à la livraison)\n📍 {adresse}\n📲 Enregistrez notre numéro pour ne pas rater aucune promotion !\nNos meilleures offres sont publiées dans nos statuts WhatsApp 🔥`); // produit en cours d'édition
  const [gpsActive, setGpsActive]     = useState(false);
  const [gpsPos, setGpsPos]           = useState(null);
  const [gpsError, setGpsError]       = useState("");
  const [destPos, setDestPos]         = useState(null);
  const geocodedOrderRef              = useRef(null);
  const pendingOrderUpdates           = useRef({});
  const dragItemRef                   = useRef(null);
  const [localOrderIds, setLocalOrderIds] = useState(()=>{try{return JSON.parse(localStorage.getItem("teamly_order")||"[]")}catch(e){return []}});
  const [pinnedOrderIds, setPinnedOrderIds] = useState(()=>{try{return JSON.parse(localStorage.getItem("teamly_pinned")||"[]")}catch(e){return []}});
  const [openModifId, setOpenModifId] = useState(null);
  const [waSentIds, setWaSentIds] = useState(()=>{try{return new Set(JSON.parse(localStorage.getItem("teamly_wa_sent")||"[]"))}catch(e){return new Set()}});
  useEffect(()=>{try{localStorage.setItem("teamly_pinned",JSON.stringify(pinnedOrderIds))}catch(e){}},[pinnedOrderIds]);
  useEffect(()=>{try{localStorage.setItem("teamly_order",JSON.stringify(localOrderIds))}catch(e){}},[localOrderIds]);
  useEffect(()=>{try{localStorage.setItem("teamly_dismissed",JSON.stringify([...dismissedNotifs]))}catch(e){}},[dismissedNotifs]);
  useEffect(()=>{try{localStorage.setItem("teamly_wa_sent",JSON.stringify([...waSentIds]))}catch(e){}},[waSentIds]);
  useEffect(()=>{try{localStorage.setItem("teamly_compta_filter",JSON.stringify({dateFrom,dateTo,shortcut:comptaShortcut}))}catch(e){}},[dateFrom,dateTo,comptaShortcut]);
  useEffect(()=>{try{localStorage.setItem("teamly_compta_adv_filters",JSON.stringify(comptaFilters))}catch(e){}},[comptaFilters]);
  const [livreurPositions, setLivreurPositions] = useState({
  });
  const gpsWatchRef = useRef(null);

  // ── Export Excel/CSV ──
  const exportExcel = () => {
    if(!canUseExport){ addToast("Export disponible à partir du plan Pro","🔒","#7C3AED"); setShowPlanModal(true); return; }
    const cols = ["Date","Client","Téléphone","Adresse","Produit","Prix","Statut","Livreur","Closer","Note"];
    const rows = orders.map(o=>[
      o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR") : "",
      o.client||"", o.phone||"", o.address||"", o.product||"",
      o.price||0, STATUS[o.status]?.label||o.status||"",
      o.livreur||"", o.closer||"", o.note||""
    ]);
    const csv = [cols, ...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";")).join("\n");
    const bom = "﻿";
    const blob = new Blob([bom+csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `commandes_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    addToast("Fichier Excel téléchargé ✅","📊",G.green);
  };

  // ── WhatsApp confirmation ──
  const sendWAConfirmation = (order) => {
    if(!order?.phone) return;
    const phone = order.phone.replace(/\D/g,"");
    const intlPhone = phone.startsWith("221") ? phone : `221${phone}`;
    const msg = waTemplate
      .replace("{client}", order.client||"")
      .replace("{produit}", order.product||"")
      .replace("{prix}", Number(order.price).toLocaleString("fr-FR"))
      .replace("{adresse}", order.address||"")
      .replace("{boutique}", settings.boutique||"Teamly");
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // ── actions ──
  const upSt = (id,s) => {
    const LABELS={pendiente:"En attente",confirmado:"Client confirmé ✅",livreur_en_route:"Livreur en route 🏍️",colis_pris:"Colis en main 📦",en_camino:"En route vers le client 🚀",chez_client:"Livreur chez le client 📍",entregado:"Livré ✅",rechazado:"Rejeté ❌",no_contesta:"Absent 📵",reprogramar:"Reporter 🔄"};
    const ICONS={entregado:"✅",rechazado:"❌",en_camino:"🚀",chez_client:"📍",colis_pris:"📦",livreur_en_route:"🏍️",no_contesta:"📵",reprogramar:"🔄",confirmado:"✅"};
    const COLORS={entregado:G.green,rechazado:G.red,en_camino:"#0284C7",chez_client:"#D97706",colis_pris:G.blue,livreur_en_route:"#7C3AED",no_contesta:G.gray,reprogramar:"#7C3AED"};
    const prevOrders = orders;
    setOrders(o=>o.map(x=>{
      if(x.id!==id) return x;
      if(s==="entregado"&&x.status!=="entregado") {
        setProducts(p=>p.map(pr=>pr.name===x.product?{...pr,stock:Math.max(0,pr.stock-1)}:pr));
        sbFetch("stock_movements","POST",{org_id:orgId,product_id:x.product,user_id:currentUser?.id,source:"entregado",delta:-1,reason:"Livraison confirmée",order_id:x.id}).catch(()=>{});
      }
      if(s==="rechazado"&&x.status==="entregado") {
        setProducts(p=>p.map(pr=>pr.name===x.product?{...pr,stock:pr.stock+1}:pr));
        sbFetch("stock_movements","POST",{org_id:orgId,product_id:x.product,user_id:currentUser?.id,source:"rechazado",delta:+1,reason:"Retour stock — livraison annulée",order_id:x.id}).catch(()=>{});
      }
      return {...x,status:s};
    }));
    pendingOrderUpdates.current[id] = Date.now();
    const order = orders.find(x=>x.id===id);
    if(order) addToast(`${order.client} → ${LABELS[s]||s}`, ICONS[s]||"📦", COLORS[s]||G.green);
    // Save to Supabase — rollback local state if it fails
    if(!String(id).startsWith("tmp_")) {
      sbFetch(`orders?id=eq.${id}`,"PATCH",{status:s}).catch(e=>{
        console.error("upSt error:",e);
        setOrders(prevOrders);
        addToast("Statut non sauvegardé — vérifie ta connexion","⚠️",G.red);
      });
      // Notify closer + admin on key livreur status changes
      if(orgId && order && (s==="entregado"||s==="rechazado"||s==="en_camino"||s==="chez_client")) {
        const notifTitle = s==="entregado"?`✅ Livré — ${order.client} a payé ${fmt(order.price)} CFA`:s==="rechazado"?`❌ Rejeté — ${order.client}`:s==="en_camino"?`🚀 En route → ${order.client}`:s==="chez_client"?`📍 Arrivé chez ${order.client}`:"📦";
        const notifType = s==="entregado"?"delivered":s==="rechazado"?"rejected":"status_update";
        sbFetch("notifications","POST",{org_id:orgId,type:notifType,title:notifTitle,body:`${order.product} · ${fmt(order.price)} CFA`,role_target:"closer",read:false,data:{}}).catch(()=>{});
      }
    }
  };
  const upLiv = (id, livId) => {
    const mem = teamMembers.find(m=>m.id===livId);
    const livName = mem?.nom || livId;
    setOrders(o=>o.map(x=>x.id===id?{...x,livreur:livName,livreur_id:livId}:x));
    const order = orders.find(x=>x.id===id);
    if(order) {
      addToast(`${order.client} assigné à ${livName} 🏍️`, "🏍️", G.green);
      if(livId===currentUser.id) setTimeout(()=>setNewAssignment(order),500);
    }
    if(!String(id).startsWith("tmp_")) sbFetch(`orders?id=eq.${id}`,"PATCH",{livreur:livName,livreur_id:livId}).catch(e=>console.error("upLiv error:",e));
  };
  const upLivDirect = (id, livId) => {
    const mem = teamMembers.find(m=>m.id===livId);
    const livName = mem?.nom || (livId===currentUser.id ? currentUser.nom : livId);
    setOrders(o=>o.map(x=>x.id===id?{...x,livreur:livName,livreur_id:livId,status:"en_camino"}:x));
    const order = orders.find(x=>x.id===id);
    if(order) addToast(`${order.client} ajouté à la tournée de ${livName} 🚀`,"🚀","#0284C7");
    if(!String(id).startsWith("tmp_")) sbFetch(`orders?id=eq.${id}`,"PATCH",{livreur:livName,livreur_id:livId,status:"en_camino"}).catch(e=>console.error("upLivDirect error:",e));
  };
  const upClo = (id, clId) => {
    const mem = teamMembers.find(m=>m.id===clId);
    const clName = mem?.nom || (clId===currentUser.id ? currentUser.nom : clId);
    setOrders(o=>o.map(x=>x.id===id?{...x,closer:clName,closer_id:clId}:x));
    if(!String(id).startsWith("tmp_")) sbFetch(`orders?id=eq.${id}`,"PATCH",{closer:clName,closer_id:clId}).catch(e=>console.error("upClo error:",e));
  };
  const addToast = (msg, icon="ℹ️", color=G.green, duration=4000) => {
    const id = Date.now();
    setToasts(t=>[...t,{id,msg,icon,color}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),duration);
  };

  // ── Détection intelligente des prix produits ──────────────────────────────
  const detectPricingIssues = (order) => {
    const items = parseProd(order.product);
    const totalQty = items.reduce((s,p)=>s+p.qty, 0);
    const orderPrice = parseInt(order.price)||0;
    const issues = [];
    for(const item of items) {
      const rule = pricingRules.find(r=>_normCity(r.product_name)===_normCity(item.name));
      const itemPrice = items.length===1 ? orderPrice : Math.round(orderPrice*item.qty/Math.max(1,totalQty));
      const pricePerUnit = item.qty>0 ? Math.round(itemPrice/item.qty) : itemPrice;
      if(!rule) {
        issues.push({case:1, name:item.name, price:itemPrice, qty:item.qty, pricePerUnit, rule:null});
      } else {
        let expectedPrice = (rule.reference_price_unit||0) * item.qty;
        if(rule.type==="bundle" && rule.reference_price_bundle && item.qty===rule.bundle_quantity) expectedPrice = rule.reference_price_bundle;
        const tol = Math.max(50, expectedPrice * 0.02);
        if(expectedPrice>0 && itemPrice > expectedPrice + tol) issues.push({case:2, name:item.name, price:itemPrice, qty:item.qty, pricePerUnit, rule, expectedPrice});
        else if(expectedPrice>0 && itemPrice < expectedPrice - tol && itemPrice > 0) issues.push({case:3, name:item.name, price:itemPrice, qty:item.qty, pricePerUnit, rule, expectedPrice});
      }
    }
    return issues;
  };

  const handleTraiterOrder = (order) => {
    setAssignSelLiv(null); setAssignDelStatus("confirmado");
    if(pricingChecked.has(order.id)||!order.product) { setAssignLivreurModal(order); return; }
    const issues = detectPricingIssues(order);
    if(issues.length===0) { setPricingChecked(prev=>new Set([...prev, order.id])); setAssignLivreurModal(order); }
    else setPricingPopup({orderId:order.id, order, items:issues, responses:issues.map(()=>({type:null,bundleQty:null,discountPct:"",discountType:"ponctuel",resolved:false}))});
  };

  const startWavePayment = async (amount=8000, planKey="basic") => {
    if(!orgId||payLoading) return;
    setPayLoading(planKey);
    try {
      const res = await fetch("/.netlify/functions/wave-checkout",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({orgId, amount: String(amount), plan: planKey}),
      });
      const data = await res.json();
      if(data.url) window.location.href = data.url;
      else addToast("Erreur Wave — réessaie","❌","#DC2626");
    } catch(e){ addToast("Erreur de connexion","❌","#DC2626"); }
    finally{ setPayLoading(false); }
  };

  // Handle Wave payment return (?payment=success)
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    if(params.get("payment")==="success" && params.get("org")===orgId && orgId) {
      const sessionId = params.get("session") || params.get("session_id") || null;
      fetch("/.netlify/functions/wave-success",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${_authToken||SB_KEY}`},
        body: JSON.stringify({orgId, sessionId}),
      }).then(r=>r.json()).then(d=>{
        if(d.success){ setIsPro(true); setTrialDaysLeft(31); addToast("Paiement confirmé — Bienvenue en Pro 🎉","✅","#1A5C38"); }
      }).catch(()=>{});
      window.history.replaceState({},document.title,window.location.pathname);
    }
    if(params.get("payment")==="error") {
      addToast("Paiement annulé","⚠️","#F59E0B");
      window.history.replaceState({},document.title,window.location.pathname);
    }
  },[orgId]);

  // Scroll instantané au dernier message quand on ouvre le chat (comme WhatsApp)
  useEffect(()=>{
    if(aiOpen && aiMsgs.length > 0) {
      setTimeout(()=>{ if(aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight; }, 30);
    }
  },[aiOpen]);

  const sendAiMessage = async (text) => {
    if (!text.trim() || aiLoading) return;
    const userMsg = { role: "user", content: text.trim() };
    const next = [...aiMsgs, userMsg];
    setAiMsgs(next);
    setAiInput("");
    setAiLoading(true);
    setTimeout(() => aiBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const res = await fetch("/.netlify/functions/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${_authToken||SB_KEY}` },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      const reply = data.reply || "Désolé, je n'ai pas pu répondre.";
      setAiMsgs(p => [...p, { role: "assistant", content: reply }]);
    } catch {
      setAiMsgs(p => [...p, { role: "assistant", content: "❌ Erreur de connexion. Réessaie." }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => aiBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  };

  // Auto-start GPS when livreur logs in — skip if user previously manually stopped it
  useEffect(()=>{
    if(role!=="livreur" || !currentUser?.id || gpsActive) return;
    if(!navigator?.geolocation) return;
    try { if(localStorage.getItem(`teamly_gps_off_${currentUser.id}`)==="true") return; } catch(e){}
    const t = setTimeout(()=>{
      try {
        gpsWatchRef.current = navigator.geolocation.watchPosition(
          async pos => {
            const {latitude:lat,longitude:lng,accuracy} = pos.coords;
            setGpsPos({lat,lng,accuracy:Math.round(accuracy)});
            let city = "";
            try {
              const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
              const gd  = await geo.json();
              city = gd.address?.city||gd.address?.town||gd.address?.village||gd.address?.county||gd.address?.state||"";
            } catch(e){}
            const uid = currentUserRef.current?.id;
            const nom = currentUserRef.current?.nom;
            if(uid) sbFetch(`profiles?id=eq.${uid}`,"PATCH",{lat,lng,city},_authToken).catch(()=>{});
            if(nom) setLivreurPositions(p=>({...p,[nom]:{lat,lng,name:nom,city,order:"En livraison"}}));
          },
          err => {
            const msgs={1:"GPS refusé — autorisez dans les réglages",2:"Signal GPS faible",3:"Délai GPS dépassé"};
            setGpsError(msgs[err.code]||"Erreur GPS");
          },
          {enableHighAccuracy:true,timeout:15000,maximumAge:10000}
        );
        setGpsActive(true);
      } catch(e){}
    }, 1200);
    return ()=>clearTimeout(t);
  },[role, currentUser?.id]);

  // Geocode active delivery for livreur destination pin
  useEffect(()=>{
    if(role!=="livreur"||!currentUser?.id){setDestPos(null);return;}
    const active=orders.find(o=>o.livreur_id===currentUser.id&&["livreur_en_route","colis_pris","en_camino","chez_client"].includes(o.status));
    if(!active){setDestPos(null);geocodedOrderRef.current=null;return;}
    const base={address:active.address,client:active.client,phone:active.phone,price:active.price,orderId:active.id};
    setDestPos(d=>d?.orderId===active.id?d:base);
    if(geocodedOrderRef.current===active.id) return;
    geocodedOrderRef.current=active.id;
    geocodeAddress(active.address).then(geo=>{
      if(geo) setDestPos(d=>d?.orderId===active.id?{...d,...geo}:d);
    });
  },[orders,role,currentUser?.id]);

  // hCaptcha desactivado

  // ── Vérification du plan toutes les 2 minutes ────────────────────────────
  useEffect(()=>{
    if(!orgId || !sbReady) return;
    const checkPlan = async () => {
      try {
        const orgs = await sbFetch(`organizations?id=eq.${orgId}&limit=1&select=plan,created_at,settings`,"GET");
        const org  = orgs?.[0];
        if(!org) return;
        // Sync org.settings for non-admin roles (closerCompta, etc.)
        const currentRole = currentUserRef.current?.role || localStorage.getItem("teamly_role");
        if(org.settings && currentRole!=="admin") setSettings(s=>({...s,...org.settings}));
        const OWNER_MAILS = ["salioumbayee877@gmail.com","salioumbayeee261@gmail.com","mamadou@gmail.com","sezambackelo@gmail.com"];
        // Owner: always full access, just sync the plan label
        if(OWNER_MAILS.includes(currentUserRef.current?.email)) {
          setIsPro(true); setIsOwnerOrg(true);
          const validPlans=["gratuit","basic","pro","scale"];
          const normalizedPlan=validPlans.includes(org.plan)?org.plan:(["basic","pro","scale"].includes(org.plan)?org.plan:"gratuit");
          if(org.plan) setSettings(s=>({...s, plan: normalizedPlan}));
          return;
        }
        // Check if org admin is an owner email — if so, all members get Scale access
        try {
          const adminProfiles = await sbFetch(`profiles?org_id=eq.${orgId}&role=eq.admin&select=email&limit=5`,"GET");
          if(Array.isArray(adminProfiles) && adminProfiles.some(p=>OWNER_MAILS.includes(p.email))) {
            setIsPro(true); setIsOwnerOrg(true);
            setSettings(s=>({...s, plan:"scale"}));
            return;
          }
        } catch(e){}
        const paidPlans = ["basic","pro","scale"];
        const notExpired = !org.plan_expires_at || new Date(org.plan_expires_at) > new Date();
        const pro = paidPlans.includes(org.plan) && notExpired;
        setIsPro(pro);
        if(org.plan) setSettings(s=>({...s, plan: org.plan}));
        if(!pro) {
          const days = Math.max(0, 14 - Math.floor((Date.now()-new Date(org.created_at||Date.now()))/86400000));
          setTrialDaysLeft(days);
        }
      } catch(e) {}
    };
    checkPlan();
    const interval = setInterval(checkPlan, 30 * 1000); // toutes les 30s
    const onVisible = () => { if(document.visibilityState==="visible") checkPlan(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [orgId, sbReady]);

  // Reset tab if it's not available for current role/plan
  useEffect(()=>{
    try {
      const saved = localStorage.getItem("teamly_tab");
      const validTabs = {admin:["dashboard","boutique","commandes","compta","tracking","clients","chat","equipe","stock","frais"],closer:["dashboard","boutique","commandes","stock","compta","chat","equipe"],livreur:["livraisons","chat","dashboard","equipe","position"]};
      if(saved && role && validTabs[role] && !validTabs[role].includes(saved)){
        setTab(validTabs[role][0]);
      }
    } catch(e){}
  },[role]);

  // closer permissions are saved directly on toggle click — no useEffect needed

  // Save tab to localStorage when it changes
  useEffect(()=>{
    try { localStorage.setItem("teamly_tab", tab); } catch(e){}
    if(tab==="chat") {
      setChatUnread(0);
      setChatShowNew(false);
      // Save current timestamp so on next reload we only count messages newer than this
      try { localStorage.setItem(`teamly_lastread_${currentUser.id}`, new Date().toISOString()); } catch(e){}
      setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:"smooth"}),100);
    }
  },[tab]);

  // Sync filterStatus to URL query param (?status=xxx) so it survives refresh
  useEffect(()=>{
    try {
      const p = new URLSearchParams(window.location.search);
      filterStatus==="all" ? p.delete("status") : p.set("status", filterStatus);
      const qs = p.toString();
      window.history.replaceState(null,"", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    } catch(e) {}
  },[filterStatus]);

  // Sync filterDate to URL + localStorage, and re-fetch from server when it changes
  useEffect(()=>{
    filterDateRef.current = filterDate;
    try { localStorage.setItem("teamly_filter_date", filterDate); } catch(e){}
    try {
      const p = new URLSearchParams(window.location.search);
      filterDate==="all" ? p.delete("date") : p.set("date", filterDate);
      const qs = p.toString();
      window.history.replaceState(null,"", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    } catch(e){}
    console.log("[TEAMLY] filterDate →", filterDate);
    if(loadMainRef.current) loadMainRef.current();
  },[filterDate]);

  // ── Restore session from localStorage on startup ───────────────────────
  useEffect(()=>{
    // ── Detect Supabase email confirmation callback ──────────────────────
    const _hash = window.location.hash;
    const _qp   = new URLSearchParams(window.location.search);
    const _hp   = new URLSearchParams(_hash.startsWith("#") ? _hash.slice(1) : "");
    const _confirmToken = _hp.get("access_token");
    const _confirmType  = _hp.get("type") || _qp.get("type");
    const _tokenHash    = _qp.get("token_hash");
    if((_confirmToken && _confirmType === "signup") || (_tokenHash && _confirmType === "email")) {
      (async()=>{
        try {
          let jwt = _confirmToken;
          if(!jwt && _tokenHash) {
            const vRes = await fetchWithTimeout(`${SB_URL}/auth/v1/verify`,{
              method:"POST",
              headers:{"Content-Type":"application/json","apikey":SB_KEY},
              body:JSON.stringify({type:"email",token_hash:_tokenHash}),
            },15000);
            const vData = await vRes.json();
            jwt = vData.access_token;
          }
          if(!jwt) { setAppLoading(false); return; }
          const uRes = await fetchWithTimeout(`${SB_URL}/auth/v1/user`,{
            headers:{"Authorization":`Bearer ${jwt}`,"apikey":SB_KEY},
          },10000);
          const uData = await uRes.json();
          const userId = uData.id;
          if(!userId) { setAppLoading(false); return; }
          let pending = null;
          try { pending = JSON.parse(localStorage.getItem("teamly_pending_signup")||"null"); } catch(e){}
          if(pending) {
            _authToken = jwt; setSbToken(jwt);
            const {nom,phone,boutique,orgId:newOrgId,email} = pending;
            await sbFetch("organizations","POST",{id:newOrgId,name:boutique||"Ma Boutique",whatsapp:phone||""});
            await sbFetch("profiles","POST",{id:userId,org_id:newOrgId,nom:nom||"Admin",phone:phone||"",email,role:"admin"});
            setOrgId(newOrgId); setSbReady(true);
            setCurrentUser({id:userId,nom,email,role:"admin"});
            setSettings(s=>({...s,nom,whatsapp:phone,boutique}));
            setOrg({id:newOrgId,name:boutique,whatsapp:phone,plan:null});
            try{
              localStorage.setItem("teamly_org",newOrgId);
              localStorage.setItem("teamly_token",jwt);
              localStorage.setItem("teamly_email",email);
              localStorage.setItem("teamly_role","admin");
              localStorage.setItem("teamly_userId",userId);
              localStorage.setItem("teamly_nom",nom||"Admin");
              localStorage.removeItem("teamly_pending_signup");
            }catch(e){}
            window.history.replaceState(null,"",window.location.pathname);
            setAppLoading(false);
            setAuthStep("plan");
            return;
          }
          // No pending signup — just log in with the confirmed token
          _authToken = jwt; setSbToken(jwt);
          window.history.replaceState(null,"",window.location.pathname);
        } catch(e) { console.error("Email confirmation error:",e); }
        setAppLoading(false);
      })();
      return;
    }
    // ── Detect Google OAuth callback (PKCE or implicit) ──────────────────
    // PKCE: ?code=…  →  POST /auth/v1/token?grant_type=pkce  → tokens
    // Implicit: #access_token=…&refresh_token=…              → tokens directly
    const _processOAuthTokens = async (jwt, refreshTok) => {
      try {
        const uRes = await fetchWithTimeout(`${SB_URL}/auth/v1/user`,{
          headers:{"Authorization":`Bearer ${jwt}`,"apikey":SB_KEY},
        },10000);
        const uData = await uRes.json();
        console.log("[TEAMLY OAuth] /auth/v1/user response:", uRes.status, uData);
        const userId = uData.id;
        const email  = uData.email || "";
        const fullName = uData?.user_metadata?.full_name || uData?.user_metadata?.name || (email? email.split("@")[0] : "");
        if(!userId) {
          console.error("[TEAMLY OAuth] No userId in /auth/v1/user response — token rejected?");
          setAuthError("Erreur Google : token rejeté par Supabase");
          setAppLoading(false);
          return;
        }
        _authToken = jwt; setSbToken(jwt);
        try {
          localStorage.setItem("teamly_token", jwt);
          if(refreshTok) localStorage.setItem("teamly_refresh_token", refreshTok);
          localStorage.setItem("teamly_email", email);
        } catch(e){}
        const profiles = await sbFetch(`profiles?id=eq.${userId}&limit=1`).catch((e)=>{
          console.error("[TEAMLY OAuth] profile lookup failed:", e?.message);
          return null;
        });
        console.log("[TEAMLY OAuth] profile lookup result:", profiles);
        if(profiles && profiles.length > 0 && profiles[0].org_id) {
          const p = profiles[0];
          console.log("[TEAMLY OAuth] Existing user — routing to dashboard, role:", p.role);
          const orgs = await sbFetch(`organizations?id=eq.${p.org_id}&limit=1&select=id,name,whatsapp,plan,plan_expires_at,created_at,settings`).catch(()=>null);
          const orgName  = orgs?.[0]?.name  || "Ma Boutique";
          const orgPhone = orgs?.[0]?.whatsapp || "";
          setOrgId(p.org_id); setSbReady(true);
          setSettings(s=>({...s, nom:p.nom||s.nom, whatsapp:p.phone||orgPhone||s.whatsapp, boutique:orgName, ...(orgs?.[0]?.plan?{plan:orgs[0].plan}:{}), ...(orgs?.[0]?.settings||{})}));
          setOrg(orgs?.[0] ? {id:orgs[0].id, name:orgs[0].name, whatsapp:orgs[0].whatsapp, plan:orgs[0].plan} : null);
          setCurrentUser({id:p.id, nom:p.nom||fullName, email:p.email||email, role:p.role||"admin", phone:p.phone||"", birthday:p.birthday||""});
          setRole(p.role||"admin"); setTab("dashboard");
          try {
            localStorage.setItem("teamly_org", p.org_id);
            localStorage.setItem("teamly_role", p.role||"admin");
            localStorage.setItem("teamly_userId", p.id||"");
            localStorage.setItem("teamly_nom", p.nom||fullName||"");
          } catch(e){}
        } else {
          console.log("[TEAMLY OAuth] New user — onboarding (boutique + phone)");
          // Defer org creation until user fills boutique + phone in onboarding screen
          setGoogleOnboard({userId, email, fullName: fullName||""});
          setAuthForm(p=>({...p, email, nom: fullName||"", boutique:"", phone:""}));
          setAuthStep("google-onboard");
        }
        registerDeviceSession(jwt).catch(()=>{});
        window.history.replaceState(null,"",window.location.pathname);
        console.log("[TEAMLY OAuth] Done — auth state should now show dashboard/plan");
      } catch(e) {
        console.error("[TEAMLY OAuth] processing error:", e?.message, e);
        setAuthError("Erreur de connexion Google : "+(e?.message||"réessayez"));
      }
      setAppLoading(false);
    };

    // PKCE callback — Supabase default for OAuth in newer projects
    const _code = _qp.get("code");
    if(_code && !_qp.get("token_hash")) {
      console.log("[TEAMLY OAuth] PKCE code received, exchanging for tokens…");
      (async()=>{
        try {
          const verifier = (()=>{ try{return localStorage.getItem("teamly_pkce_verifier");}catch(e){return null;} })();
          if(!verifier) {
            console.error("[TEAMLY OAuth] No code_verifier in storage — flow state lost");
            setAuthError("Erreur OAuth : session expirée, réessayez");
            setAppLoading(false);
            return;
          }
          const tokRes = await fetchWithTimeout(`${SB_URL}/auth/v1/token?grant_type=pkce`,{
            method:"POST",
            headers:{"Content-Type":"application/json","apikey":SB_KEY},
            body: JSON.stringify({ auth_code: _code, code_verifier: verifier }),
          }, 15000);
          const tokData = await tokRes.json().catch(()=>({}));
          console.log("[TEAMLY OAuth] PKCE token exchange:", tokRes.status, tokData);
          try { localStorage.removeItem("teamly_pkce_verifier"); } catch(e){}
          if(!tokRes.ok || !tokData.access_token) {
            setAuthError("Erreur OAuth : "+(tokData?.error_description||tokData?.msg||tokData?.error||"échec d'échange"));
            setAppLoading(false);
            return;
          }
          await _processOAuthTokens(tokData.access_token, tokData.refresh_token);
        } catch(e) {
          console.error("[TEAMLY OAuth] PKCE error:", e?.message, e);
          setAuthError("Erreur OAuth PKCE : "+(e?.message||""));
          setAppLoading(false);
        }
      })();
      return;
    }

    // Implicit flow fallback — tokens directly in URL hash
    const _refreshInHash = _hp.get("refresh_token");
    const _isOAuth = _confirmToken && _refreshInHash &&
      _confirmType !== "signup" && _confirmType !== "email" && _confirmType !== "recovery";
    if(_isOAuth) {
      console.log("[TEAMLY OAuth] Detected implicit flow callback (hash tokens)");
      (async()=>{ await _processOAuthTokens(_confirmToken, _refreshInHash); })();
      return;
    }
    try {
      // If this is an invite link, ignore any saved session
      const inviteCheck = new URLSearchParams(window.location.search);
      if(inviteCheck.get("org") && inviteCheck.get("role")) {
        setAppLoading(false);
        return; // Don't restore session - show join form
      }

      const tok      = localStorage.getItem("teamly_token");
      const email    = localStorage.getItem("teamly_email");
      const savedOrg = localStorage.getItem("teamly_org");
      const savedRole= localStorage.getItem("teamly_role");
      const savedId  = localStorage.getItem("teamly_userId");
      const savedNom = localStorage.getItem("teamly_nom");
      if(!email || !savedOrg) { setAppLoading(false); return; }
      // If token is expired AND no refresh token → session is dead, force re-login
      if(tok && isTokenExpired(tok) && !localStorage.getItem("teamly_refresh_token")) {
        try { localStorage.clear(); } catch(e) {}
        _authToken = null;
        setAppLoading(false);
        return;
      }
      if(tok) { setSbToken(tok); _authToken = tok; }
      // Safety timeout: never stay on loading screen more than 5 seconds
      const safetyTimer = setTimeout(()=>setAppLoading(false), 5000);
      // Restore immediately from cache so dashboard shows data while verifying
      if(savedOrg && savedRole && savedId) {
        setOrgId(savedOrg);
        setCurrentUser({id:savedId,nom:savedNom||"",email,role:savedRole,phone:localStorage.getItem("teamly_phone")||"",birthday:localStorage.getItem("teamly_birthday")||""});
        setRole(savedRole);
        if(savedRole==="admin"){
          const cc=localStorage.getItem(`teamly_cc_${savedOrg}`)||localStorage.getItem("teamly_closerCompta");
          const sb=localStorage.getItem(`teamly_boutique_${savedOrg}`)||localStorage.getItem("teamly_boutique");
          const sw=localStorage.getItem(`teamly_whatsapp_${savedOrg}`)||localStorage.getItem("teamly_whatsapp");
          const sn=localStorage.getItem("teamly_nom");
          if(cc!==null)setSettings(s=>({...s,closerCompta:cc==="true"}));
          if(sb)setSettings(s=>({...s,boutique:sb}));
          if(sw)setSettings(s=>({...s,whatsapp:sw}));
          if(sn)setSettings(s=>({...s,nom:sn}));
        }
        setSbReady(true);
        setAppLoading(false);
      }
      // Verify & refresh profile in background using stored JWT
      sbFetch(`profiles?email=eq.${encodeURIComponent(email)}&limit=1`,"GET")
        .then(async profiles=>{
          clearTimeout(safetyTimer);
          if(profiles&&profiles.length>0){
            const p=profiles[0];
            // Member was removed from the team — block access immediately
            if(!p.org_id){
              try{localStorage.clear();}catch(e){}
              _authToken=null;
              setRole(null);setOrgId(null);setSbReady(false);setAppLoading(false);
              setAuthError("Ton compte a été retiré de cette équipe. Contacte l'administrateur.");
              return;
            }
            setOrgId(p.org_id);
            setSbReady(true);
            try {
              const orgs = await sbFetch(`organizations?id=eq.${p.org_id}&limit=1&select=id,name,whatsapp,plan,created_at,settings`,"GET");
              const orgName = (orgs&&orgs.length>0)?orgs[0].name:"Ma Boutique";
              const orgPhone = (orgs&&orgs.length>0)?orgs[0].whatsapp:"";
              setSettings(s=>({...s,nom:p.nom||s.nom,whatsapp:p.phone||orgPhone||s.whatsapp,boutique:orgName}));
              if(orgs&&orgs[0]) {
                const org = orgs[0];
                if(org.plan) setSettings(s=>({...s,plan:org.plan}));
                if(org.settings) setSettings(s=>({...s,...org.settings}));
                // Propriétaire → accès complet gratuit toujours
                if(["salioumbayee877@gmail.com","salioumbayeee261@gmail.com"].includes(p.email)) {
                  setIsPro(true);
                  setTrialDaysLeft(999);
                } else {
                  const paidPlans = ["basic","pro","scale"];
                  const notExpired = !org.plan_expires_at || new Date(org.plan_expires_at)>new Date();
                  const pro = paidPlans.includes(org.plan) && notExpired;
                  setIsPro(pro);
                  if(!pro) {
                    const days = Math.max(0, 14 - Math.floor((Date.now()-new Date(org.created_at||Date.now()))/86400000));
                    setTrialDaysLeft(days);
                  }
                }
              }
            } catch(e){}
            // Always apply localStorage overrides AFTER org fetch — runs even if org returns [] or throws
            if(p.role==="admin"){
              const cc=localStorage.getItem(`teamly_cc_${p.org_id}`)||localStorage.getItem("teamly_closerCompta");
              const sb=localStorage.getItem(`teamly_boutique_${p.org_id}`)||localStorage.getItem("teamly_boutique");
              const sw=localStorage.getItem(`teamly_whatsapp_${p.org_id}`)||localStorage.getItem("teamly_whatsapp");
              const sn=localStorage.getItem("teamly_nom");
              if(cc!==null)setSettings(s=>({...s,closerCompta:cc==="true"}));
              if(sb)setSettings(s=>({...s,boutique:sb}));
              if(sw)setSettings(s=>({...s,whatsapp:sw}));
              if(sn)setSettings(s=>({...s,nom:sn}));
            }
            if(p.role==="closer"){const cc=localStorage.getItem(`teamly_cc_${p.org_id}`);if(cc!==null)setSettings(s=>({...s,closerCompta:cc==="true"}));}
            setCurrentUser({id:p.id||"",nom:p.nom||"",email:p.email||"",role:p.role||"admin",phone:p.phone||"",birthday:p.birthday||""});
            setRole(p.role||"admin");
            try {
              localStorage.setItem("teamly_org",p.org_id);
              localStorage.setItem("teamly_role",p.role||"admin");
              localStorage.setItem("teamly_userId",p.id||"");
              localStorage.setItem("teamly_nom",p.nom||"");
              localStorage.setItem("teamly_phone",p.phone||"");
              localStorage.setItem("teamly_birthday",p.birthday||"");
            } catch(e){}
          }
          setAppLoading(false);
        })
        .catch(()=>{ clearTimeout(safetyTimer); setAppLoading(false); });
    } catch(e) { 
      console.log("Session restore error:", e.message);
      setAppLoading(false);
    }
  },[]);

  // ── Supabase: sync data when connected ──────────────────────────────────
  useEffect(()=>{
    if(!sbReady||!orgId) return;
    console.log("[TEAMLY DEBUG][MOUNT] sbReady=true orgId="+orgId+" _authToken="+(_authToken?_authToken.slice(0,20)+"...":"NULL")+" filterDate="+filterDate+" filterStatus="+filterStatus);

    const mapOrders = (ords) => ords.map(o=>({...o,isBundle:o.is_bundle,fraisLiv:o.frais_liv,closer_id:o.closer_id,livreur_id:o.livreur_id,deliveryZoneType:o.delivery_zone_type,deliveryZoneName:o.delivery_zone_name,deliveryFee:o.delivery_fee,deliveryFeeOverridden:o.delivery_fee_overridden,region_type:o.region_type,payment_type:o.payment_type}));
    const mapProds  = (prods) => prods.map(p=>({...p,fraisLiv:p.frais_liv,fraisLivExtra:p.frais_liv_extra,stockInitial:p.stock_initial}));
    const mapMsgs   = (msgs) => msgs.map(m=>{
      const t=m.text||"";
      const isImg=t.startsWith("IMG:");
      const isAud=t.startsWith("AUD:");
      const isFile=t.startsWith("FILE:");
      let audioUrl=null,dur="0:00",fileUrl=null,fileName=null,fileSize=null,fileMime=null;
      if(isAud){const rest=t.slice(4);const sep=rest.indexOf("|");dur=sep>-1?rest.slice(0,sep):"0:00";audioUrl=sep>-1?rest.slice(sep+1):null;}
      if(isFile){const parts=t.slice(5).split("|");fileUrl=parts[0]||null;fileName=parts[1]||"Fichier";fileSize=parts[2]?Number(parts[2]):null;fileMime=parts[3]||null;}
      return {id:m.id,from:m.from_user,role:m.role,text:isImg||isFile?"":isAud?"🎤":t,type:isImg?"image":isFile?"file":null,imgSrc:isImg?t.slice(4):null,fileUrl,fileName,fileSize,fileMime,audio:isAud||!!m.audio,audioUrl,duration:dur,created_at:m.created_at,time:new Date(m.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})};
    });

    // Restore pedidos/productos/equipo del caché al instante
    try {
      const cached = JSON.parse(localStorage.getItem(`teamly_cache_${orgId}`) || "null");
      if(cached) {
        if(cached.orders)   setOrders(cached.orders);
        if(cached.products) setProducts(cached.products);
        if(cached.members)  setTeamMembers(cached.members);
        setDataReady(true);
      }
    } catch(e){}
    // Fallback: never keep loading screen more than 3s even without cache
    const readyFallback = setTimeout(()=>setDataReady(true), 3000);

    // Carga pedidos, productos y equipo juntos (sin mensajes — son pesados)
    let mainReqId = 0;
    const buildDateQuery = (dateKey) => {
      if(!dateKey || dateKey==="all") return "";
      const now = new Date();
      let start, end;
      if(dateKey==="today") {
        start=new Date(now); start.setHours(0,0,0,0);
        end=new Date(now);   end.setHours(23,59,59,999);
      } else if(dateKey==="yesterday") {
        start=new Date(now); start.setDate(start.getDate()-1); start.setHours(0,0,0,0);
        end=new Date(now);   end.setDate(end.getDate()-1);     end.setHours(23,59,59,999);
      } else if(dateKey==="week") {
        start=new Date(now); start.setDate(start.getDate()-((start.getDay()+6)%7)); start.setHours(0,0,0,0);
        end=new Date(now);   end.setHours(23,59,59,999);
      }
      if(!start||!end) return "";
      console.log("[TEAMLY] Filter range:", start.toISOString(), "→", end.toISOString());
      return `&created_at=gte.${encodeURIComponent(start.toISOString())}&created_at=lte.${encodeURIComponent(end.toISOString())}`;
    };

    const loadMain = async() => {
      const reqId = ++mainReqId;
      const _t0 = Date.now();
      const dateKey = filterDateRef.current || "all";
      const dateQuery = buildDateQuery(dateKey);
      console.log("[TEAMLY DEBUG][loadMain #"+reqId+"] START token="+(_authToken?_authToken.slice(0,20)+"...":"NULL")+" orgId="+orgId+" dateFilter="+dateKey);
      try {
        console.log("[TEAMLY DEBUG][loadMain #"+reqId+"] QUERY orders?org_id=eq."+orgId+"&archived=not.is.true"+dateQuery+"&order=created_at.desc");
        const [ords, prods, mems, zMain, zOthers, zPricing] = await Promise.all([
          sbFetch(`orders?org_id=eq.${orgId}&archived=not.is.true${dateQuery}&order=created_at.desc`),
          sbFetch(`products?org_id=eq.${orgId}&archived=not.is.true`),
          sbFetch(`profiles?org_id=eq.${orgId}&role=in.(closer,livreur)&select=id,nom,phone,email,role,lat,lng,city`),
          sbFetch(`delivery_main_region?org_id=eq.${orgId}&limit=1`).catch(()=>null),
          sbFetch(`delivery_other_regions?org_id=eq.${orgId}&order=created_at.asc`).catch(()=>null),
          sbFetch(`product_pricing_rules?org_id=eq.${orgId}&order=created_at.asc`).catch(()=>null),
        ]);
        console.log("[TEAMLY] Orders returned:", ords?.length, "| filter:", dateKey, "| ms:", Date.now()-_t0);
        console.log("[TEAMLY DEBUG][loadMain #"+reqId+"] RESPONSE ords="+(ords===null?"null":Array.isArray(ords)?"array("+ords.length+")":typeof ords)+" ms="+(Date.now()-_t0)+(Array.isArray(ords)&&ords.length===0?" ⚠️ EMPTY ARRAY":Array.isArray(ords)&&ords.length>0?" sample_id="+ords[0]?.id:""));
        if (zMain?.[0]) setMainRegion(zMain[0]);
        if (Array.isArray(zOthers)) setOtherRegions(zOthers);
        if (Array.isArray(zPricing)) setPricingRules(zPricing);
        if(reqId !== mainReqId) return; // discard stale parallel response
        clearTimeout(readyFallback);
        const mappedOrds  = ords  ? mapOrders(ords)  : null;
        const mappedProds = prods ? mapProds(prods)   : null;
        if(mappedOrds) {
          setOrders(prev=>{
            const now=Date.now();
            const merged = mappedOrds.map(o=>{
              const t=pendingOrderUpdates.current[o.id];
              return (t&&now-t<10000)?(prev.find(p=>p.id===o.id)||o):o;
            });
            // Keep temp orders (tmp_xxx) still in flight — INSERT not yet confirmed
            const serverIds = new Set(mappedOrds.map(o=>o.id));
            const tempOrds = prev.filter(p=>String(p.id).startsWith("tmp_")&&!serverIds.has(p.id));
            console.log("[TEAMLY DEBUG][loadMain #"+reqId+"] setOrders prev="+prev.length+" server="+mappedOrds.length+" merged="+merged.length+" temp="+tempOrds.length+" → total="+(merged.length+tempOrds.length));
            return [...merged, ...tempOrds];
          });
        }
        if(mappedProds) setProducts(mappedProds);
        if(mems) {
          setTeamMembers(mems);
          // Actualizar posiciones reales de los livreurs
          const pos = {};
          mems.filter(m=>m.role==="livreur"&&m.lat&&m.lng).forEach(m=>{
            pos[m.nom] = {lat:m.lat, lng:m.lng, name:m.nom, city:m.city||""};
          });
          setLivreurPositions(pos);
        }
        setDataReady(true);
        // Guardar en caché (sin mensajes porque son demasiado grandes)
        try {
          localStorage.setItem(`teamly_cache_${orgId}`, JSON.stringify({
            orders: mappedOrds, products: mappedProds, members: mems
          }));
        } catch(e){}
      } catch(e) { console.error("[TEAMLY DEBUG][loadMain #"+reqId+"] ERROR", e.message, e); }
    };

    // Restaurar chat desde cache instantáneamente
    const chatCacheKey = `teamly_chat_${orgId}`;
    try {
      const cached = JSON.parse(localStorage.getItem(chatCacheKey) || "null");
      if(cached && cached.length > 0) { setChat(cached); setChatLoading(false); }
    } catch(e){}

    // Carga mensajes — primera vez completo, luego solo nuevos (par created_at, pas par id UUID)
    let lastMsgTime = null;
    const loadChat = async(firstLoad=false) => {
      try {
        const query = firstLoad || !lastMsgTime
          ? `messages?org_id=eq.${orgId}&order=created_at.desc&limit=100`
          : `messages?org_id=eq.${orgId}&created_at=gt.${encodeURIComponent(lastMsgTime)}&order=created_at.asc&limit=50`;
        const msgs = await sbFetch(query);
        if(firstLoad) setChatLoading(false);
        if(!msgs || msgs.length === 0) return;
        const myNom = currentUserRef.current.nom||(role==="admin"?"Admin":role==="closer"?"Closer":"Livreur");
        const lastReadKey = `teamly_lastread_${currentUser.id}`;
        setChat(prev => {
          let merged;
          if(firstLoad || !lastMsgTime) {
            const fromDb = mapMsgs([...msgs].reverse());
            // Keep optimistic (numeric id) messages that are still pending/failed
            const pending = prev.filter(m=>typeof m.id==="number"&&(m.uploading||m.uploadFailed));
            const pendingNotInDb = pending.filter(p=>!fromDb.find(d=>d.imgSrc===p.imgSrc&&d.type===p.type));
            merged = [...fromDb, ...pendingNotInDb];
          } else {
            const newMapped = mapMsgs(msgs);
            merged = [...prev, ...newMapped.filter(m => {
              if(prev.find(p=>String(p.id)===String(m.id))) return false;
              // Text message dedup: same sender + same text
              if(!m.audio && m.type!=="image" && prev.find(p=>typeof p.id==="number"&&p.from===m.from&&p.text===m.text)) return false;
              // Audio dedup: same sender sent audio within 60s
              if(m.audio && prev.find(p=>typeof p.id==="number"&&p.audio&&p.from===m.from&&(Date.now()-p.id)<60000)) return false;
              // Image dedup: same sender sent image within 60s
              if(m.type==="image" && prev.find(p=>typeof p.id==="number"&&p.type==="image"&&p.from===m.from&&(Date.now()-p.id)<60000)) return false;
              // File dedup: same sender sent file with same name within 60s
              if(m.type==="file" && prev.find(p=>typeof p.id==="number"&&p.type==="file"&&p.from===m.from&&p.fileName===m.fileName&&(Date.now()-p.id)<60000)) return false;
              return true;
            })];
          }
          // Update lastMsgTime using created_at (works with UUID ids)
          if(merged.length > 0) lastMsgTime = merged[merged.length-1].created_at||null;
          // Unread badge — use tabRef.current to avoid stale closure
          const currentTab = tabRef.current;
          // Full load (firstLoad=true OR lastMsgTime null → query returned all 100 messages):
          // Use timestamp-based check so cached-but-already-read messages are not counted as new.
          // Incremental load (lastMsgTime set → query only returned truly new messages):
          // Use genuineNew logic (messages not already in prev state).
          if(firstLoad || !lastMsgTime || prev.length === 0) {
            if(currentTab !== "chat" && merged.length > 0) {
              const lastReadTime = (() => { try { return localStorage.getItem(lastReadKey); } catch(e) { return null; } })();
              let unread = 0;
              if(lastReadTime) {
                unread = merged.filter(m=>m.from!==myNom && m.created_at && m.created_at > lastReadTime).length;
              } else {
                const cutoff = new Date(Date.now()-24*60*60*1000).toISOString();
                unread = merged.filter(m=>m.from!==myNom && m.created_at && m.created_at > cutoff).length;
              }
              if(unread > 0) setChatUnread(Math.min(unread, 99));
            }
          } else if(merged.length > prev.length) {
            // True incremental: only messages not already in state
            const prevIds = new Set(prev.map(m=>String(m.id)));
            const genuineNew = merged.filter(m=>!prevIds.has(String(m.id))&&m.from!==myNom);
            if(genuineNew.length > 0) {
              if(currentTab !== "chat") {
                setChatUnread(u => u + genuineNew.length);
              }
              // Browser push notification when app not focused
              genuineNew.forEach(m => {
                if(!document.hasFocus() && typeof Notification !== "undefined" && Notification.permission === "granted") {
                  try { new Notification(m.from||"Équipe", {body: m.text||"📷 Photo", icon:"/icon.svg", tag:"teamly-chat"}); } catch(e){}
                }
              });
              // Auto-scroll or show "new message" button — resolved outside setChat via setTimeout
              setTimeout(()=>{
                const el = chatScrollRef.current;
                if(!el) return;
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                if(atBottom) {
                  chatBottomRef.current?.scrollIntoView({behavior:"smooth"});
                } else {
                  setChatShowNew(true);
                }
              }, 50);
            }
          }
          // Save to cache (last 60)
          try { localStorage.setItem(chatCacheKey, JSON.stringify(merged.slice(-60))); } catch(e){}
          return merged;
        });
      } catch(e) {
        if(firstLoad) setChatLoading(false);
        console.error("Chat load error:", e.message);
      }
    };

    // ── Notifications Supabase ───────────────────────────────────────────────
    const loadNotifs = async() => {
      try {
        const notifs = await sbFetch(`notifications?org_id=eq.${orgId}&read=eq.false&order=created_at.desc&limit=30`,"GET");
        if(!notifs) return;
        const userRole = currentUserRef.current?.role || role;
        const userNom  = currentUserRef.current?.nom  || "";
        const dismissed = (() => { try { return new Set(JSON.parse(localStorage.getItem(`notif_dismissed_${orgId}`)||"[]")); } catch(e) { return new Set(); } })();
        const relevant = notifs.filter(n=>{
          if(dismissed.has(String(n.id))) return false;
          if(!n.role_target || n.role_target==="all") return true;
          if(n.role_target !== userRole) return false;
          if(userRole==="livreur" && n.livreur_name && n.livreur_name!==userNom) return false;
          return true;
        });
        setDbNotifs(relevant);
      } catch(e) {}
    };

    loadChatRef.current = loadChat;
    loadMainRef.current = loadMain;
    loadMain();
    loadChat(true);
    loadNotifs();
    const intervalMain   = setInterval(loadMain, 5000);
    const intervalNotifs = setInterval(loadNotifs, 20000);

    // Kick out if admin removes this user while they're active
    const checkSelfProfile = async () => {
      const uid = currentUserRef.current?.id;
      if (!uid) return;
      try {
        const data = await sbFetch(`profiles?id=eq.${uid}&select=org_id&limit=1`);
        if (Array.isArray(data) && data.length > 0 && data[0].org_id === null) {
          try { localStorage.clear(); } catch(e) {}
          _authToken = null;
          setRole(null); setOrgId(null); setSbReady(false); setAppLoading(false);
          setAuthError("Ton compte a été retiré de cette équipe. Contacte l'administrateur.");
        }
      } catch(e) {}
    };
    const intervalSelf = setInterval(checkSelfProfile, 60000);
    // Polling toutes les 8s — si chat vide, force un reload complet
    const intervalChat = setInterval(()=>{
      setChat(prev => {
        if(prev.length === 0) loadChat(true);  // retry complet si toujours vide
        else loadChat(false);                   // sinon incrémental
        return prev;
      });
    }, 8000);

    // ── Supabase Realtime WebSocket — chat en temps réel ─────────────────
    let ws = null, wsRef = 0, wsHeartbeat = null, wsReconnect = null;
    const setupWS = () => {
      try {
        ws = new WebSocket(`${(SB_URL||"").replace("https://","wss://")}/realtime/v1/websocket?apikey=${SB_KEY}&vsn=1.0.0`);
        ws.onopen = () => {
          ws.send(JSON.stringify({
            topic: `realtime:chat_${orgId}`,
            event: "phx_join",
            payload: {
              config: {
                broadcast: {self: false},
                postgres_changes: [
                  {event:"INSERT", schema:"public", table:"messages",      filter:`org_id=eq.${orgId}`},
                  {event:"INSERT", schema:"public", table:"notifications",  filter:`org_id=eq.${orgId}`}
                ]
              },
              access_token: _authToken || SB_KEY
            },
            ref: String(++wsRef),
            join_ref: String(wsRef)
          }));
          wsHeartbeat = setInterval(()=>{
            if(ws?.readyState === 1) ws.send(JSON.stringify({topic:"phoenix",event:"heartbeat",payload:{},ref:String(++wsRef)}));
          }, 25000);
        };
        ws.onmessage = (evt) => {
          try {
            const d = JSON.parse(evt.data);
            // Nouveau message INSERT détecté → charger immédiatement
            if(d.event === "postgres_changes" && d.payload?.data?.type === "INSERT") {
              const tbl = d.payload?.data?.table;
              if(!tbl || tbl === "messages")      loadChat(false);
              if(!tbl || tbl === "notifications")  loadNotifs();
            }
          } catch(e) {}
        };
        ws.onclose = () => {
          clearInterval(wsHeartbeat);
          wsReconnect = setTimeout(setupWS, 2000); // reconnexion auto
        };
        ws.onerror = () => ws.close();
      } catch(e) { /* WebSocket non dispo, polling de secours actif */ }
    };
    setupWS();

    setChatLoading(true);
    return ()=>{
      clearTimeout(readyFallback);
      clearInterval(intervalMain);
      clearInterval(intervalChat);
      clearInterval(intervalNotifs);
      clearInterval(intervalSelf);
      clearInterval(wsHeartbeat);
      clearTimeout(wsReconnect);
      if(ws) { ws.onclose = null; ws.close(); }
    };
  },[sbReady, orgId]);

  // Show iOS install banner once after login (only on iPhone Safari, not already installed)
  useEffect(()=>{
    if(!orgId) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true;
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
    const dismissed = (() => { try { return localStorage.getItem("teamly_ios_install_dismissed"); } catch(e){ return null; } })();
    if(isIos && isSafari && !isStandalone && !dismissed) {
      const t = setTimeout(()=>setShowIosInstall(true), 3000);
      return ()=>clearTimeout(t);
    }
  },[orgId]);

  // Auto-load superadmin clients when navigating to that tab
  useEffect(()=>{
    if(tab==="superadmin" && currentUser?.email===OWNER_EMAIL && saClients.length===0 && !saLoading){
      setSaLoading(true);
      fetch("/.netlify/functions/super-admin",{headers:{"Authorization":`Bearer ${_authToken}`}})
        .then(r=>r.json())
        .then(data=>{ if(Array.isArray(data)) setSaClients(data); else addToast("Erreur chargement clients","❌",G.red); })
        .catch(()=>addToast("Erreur connexion","❌",G.red))
        .finally(()=>setSaLoading(false));
    }
  },[tab]);

  // Compute device fingerprint once on mount (so heartbeat works after page reload)
  useEffect(() => {
    if (!deviceFingerprint) getDeviceFingerprint().then(setDeviceFingerprint).catch(()=>{});
  }, []);

  // Auto-resync pending orders when zones change (admin only, content-hash to skip polling noise)
  const lastZonesHashRef = useRef(null);
  useEffect(() => {
    if (!sbToken || !orgId || role !== "admin") return;
    const hash = JSON.stringify({
      m: mainRegion ? { n: mainRegion.name, p: mainRegion.price, c: mainRegion.cities||[], a: mainRegion.aliases||[] } : null,
      o: (otherRegions||[]).map(r=>({ n:r.name, p:r.price, ip:r.interurbain_price, c:r.cities||[], a:r.aliases||[] })),
    });
    if (lastZonesHashRef.current === null) { lastZonesHashRef.current = hash; return; }
    if (lastZonesHashRef.current === hash) return; // no real change
    lastZonesHashRef.current = hash;
    // First admin interaction with zones flips zones_configured → webhooks
    // stop using defaults 2500/4000 and start using real configured zones.
    if (!settings?.zones_configured) {
      const newSettings = { ...(settings||{}), zones_configured: true };
      setSettings(newSettings);
      sbFetch(`organizations?id=eq.${orgId}`, "PATCH", { settings: newSettings }).catch(()=>{});
    }
    const timer = setTimeout(() => {
      fetch("/.netlify/functions/resync-pending-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sbToken}` }
      })
        .then(r=>r.json())
        .then(d=>{ if(d?.resynced>0) addToast(`✅ ${d.resynced} commande${d.resynced>1?"s":""} synchronisée${d.resynced>1?"s":""}`,"✅",G.green); })
        .catch(()=>{});
    }, 1500);
    return () => clearTimeout(timer);
  }, [mainRegion, otherRegions, sbToken, orgId, role, settings]);

  // Auto-load active sessions when Settings modal opens
  useEffect(() => {
    if (!showSettings || !sbToken || !currentUser?.id) return;
    fetch(`${SB_URL}/rest/v1/user_sessions?user_id=eq.${currentUser.id}&is_active=eq.true&order=last_active_at.desc&select=*`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${sbToken}` }
    })
      .then(r => r.json())
      .then(data => Array.isArray(data) && setMySessions(data))
      .catch(()=>{});
  }, [showSettings, sbToken, currentUser?.id]);

  // Device session heartbeat — every 30s when in foreground
  useEffect(() => {
    if (!sbToken || !deviceFingerprint || kickedOut) return;
    let cancelled = false;
    let intervalId = null;
    const ping = async () => {
      if (document.hidden || cancelled) return;
      try {
        const r = await fetch("/.netlify/functions/session-heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sbToken}` },
          body: JSON.stringify({ device_fingerprint: deviceFingerprint }),
        });
        const data = await r.json().catch(()=>({}));
        if (data?.kicked) {
          cancelled = true;
          setKickedOut(true);
          // Clear auth state to drop back to login screen
          _authToken = null;
          setSbToken(null);
          setRole(null);
          setOrgId(null);
          setSbReady(false);
          setCurrentUser({nom:"",email:"",role:""});
          setAuthStep("login");
          try {
            localStorage.removeItem("teamly_token");
            localStorage.removeItem("teamly_refresh_token");
            localStorage.removeItem("teamly_role");
            localStorage.removeItem("teamly_org");
          } catch(e){}
        }
      } catch(e) { /* network error — try again next tick */ }
    };
    const start = () => { if (!intervalId) intervalId = setInterval(ping, 30000); };
    const stop  = () => { if (intervalId) { clearInterval(intervalId); intervalId = null; } };
    if (!document.hidden) start();
    const onVis = () => { document.hidden ? stop() : (ping(), start()); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [sbToken, deviceFingerprint, kickedOut]);

  // Keep refs in sync so closures always read fresh values
  useEffect(()=>{ tabRef.current = tab; }, [tab]);
  useEffect(()=>{ currentUserRef.current = currentUser; }, [currentUser]);

  // Request browser notification permission once user is logged in
  useEffect(()=>{
    if(!orgId) return;
    if(typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(()=>{});
    }
  },[orgId]);

  // Show new notifications as toasts
  const prevNotifsRef = useRef([]);
  useEffect(()=>{
    if(!dbNotifs.length) return;
    const prev = prevNotifsRef.current;
    const newOnes = dbNotifs.filter(n => !prev.find(p => p.id === n.id));
    newOnes.forEach(n => {
      const icon = n.type==="nouveau_colis"?"🔔":n.type==="delivered"?"✅":n.type==="rejected"?"❌":n.type==="low_stock"?"⚠️":n.type==="livraison_directe"?"🚀":"📦";
      const color = n.type==="delivered"?"#10B981":n.type==="rejected"?"#EF4444":n.type==="low_stock"?"#EF4444":"#F0A500";
      addToast(n.title, icon, color);
    });
    prevNotifsRef.current = dbNotifs;
  },[dbNotifs]);

  // Debug log
  useEffect(()=>{
    if(orgId) console.log("✅ Teamly connected — orgId:", orgId, "role:", role, "sbReady:", sbReady);
    else console.log("⚠️ No orgId — sbReady:", sbReady, "sbToken:", !!sbToken);
  },[orgId, role, sbReady, sbToken]);

  // Cuenta miembros reales de la org (para límite de plan)
  useEffect(()=>{
    if(!orgId||!sbReady) return;
    sbFetch(`profiles?org_id=eq.${orgId}&select=id`)
      .then(p=>{ if(Array.isArray(p)) setOrgMemberCount(p.length); })
      .catch(()=>{});
  },[orgId, sbReady, teamMembers.length]);

  // Supabase persist helpers
  const sbSave = async (table, data) => {
    if(!sbToken||!orgId) return;
    try { await sbFetch(table, "POST", {...data, org_id:orgId}, sbToken); } 
    catch(e) { console.error("sbSave error:", e.message); }
  };
  const sbUpdate = async (table, id, data) => {
    if(!sbToken||!orgId) return;
    try { await sbFetch(`${table}?id=eq.${id}`, "PATCH", data, sbToken); }
    catch(e) { console.error("sbUpdate error:", e.message); }
  };

  // ── Detect new orders assigned to livreur
  useEffect(()=>{
    if(role!=="livreur") return;
    const myName = currentUserRef.current.nom;
    const myId   = currentUserRef.current.id;
    // Skip first two runs: null→[] (initial) and []→data (cache restore)
    if(prevOrdersRef.current===null || (prevOrdersRef.current.length===0 && orders.length>0)) {
      prevOrdersRef.current=orders; return;
    }
    const prev = prevOrdersRef.current;
    const newlyAssigned = orders.find(o=>
      (o.livreur===myName||o.livreur_id===myId) &&
      o.status==="confirmado" &&
      !prev.find(p=>p.id===o.id&&(p.livreur===myName||p.livreur_id===myId))
    );
    if(newlyAssigned && (!newAssignment || newAssignment.id!==newlyAssigned.id)) {
      setNewAssignment(newlyAssigned);
    }
    prevOrdersRef.current = orders;
  },[orders, role]);

  const prendre = id => {
    upClo(id, currentUser.id);
    addToast(`Pris en charge par ${currentUser.nom}`, "✋", G.gold);
  };

  const addOrder = wa => {
    if(!newOrder.client.trim()) { addToast("Nom du client obligatoire","⚠️","#F59E0B"); return; }
    if(!newOrder.product)       { addToast("Sélectionne un produit","⚠️","#F59E0B"); return; }
    if(!newOrder.deliveryStatus){ addToast("Situation du colis obligatoire","⚠️",G.red); return; }
    const prod  = products.find(x=>x.name===newOrder.product);
    const bund  = prod?.bundles?.find(b=>String(b.id)===newOrder.bundle);
    const qty   = parseInt(newOrder.qty||1);
    const disc  = parseFloat(newOrder.discount||0);
    let price, productLabel;
    if(bund) {
      price = bund.prixVente;
      productLabel = `${prod.name} — ${bund.label}`;
    } else if(prod) {
      const basePrice = prod.price * qty;
      price = disc>0 ? Math.round(basePrice*(1-disc/100)) : basePrice;
      productLabel = qty>1 ? `${prod.name} ×${qty}${disc>0?` (−${disc}%)`:""}` : prod.name;
    } else {
      price = 0; productLabel = "";
    }
    const tempId = "tmp_" + Date.now();
    const closerLivId = newOrder.livreur ? (teamMembers.find(m=>m.nom===newOrder.livreur)?.id||null) : null;
    const deliveryStatus = newOrder.deliveryStatus;
    // Zone de livraison : depuis la détection dynamique ou fallback WA_ZONES
    const _dynZone = detectDeliveryZone(newOrder.city||"", mainRegion, otherRegions, settings.defaultDeliveryPrice||3500);
    const _deliveryFee = parseInt(newOrder.deliveryFee||0) || (_dynZone.price||FRAIS_LIV);
    const _zoneType = _dynZone.type;
    const _zoneName = _dynZone.name || newOrder.deliveryZoneName || "";
    const _zoneOverridden = newOrder.deliveryFeeOverridden || false;
    const _regionType  = _zoneType === "other" ? "other" : _zoneType === "main" ? "main" : null;
    const _paymentType = _regionType === "other" ? "prepaid" : _regionType === "main" ? "cod" : null;
    const order = {id:tempId,client:newOrder.client,phone:newOrder.phone,address:newOrder.address,city:newOrder.city||"",product:productLabel,price,status:deliveryStatus,livreur:newOrder.livreur||null,livreur_id:closerLivId,closer:role==="closer"?currentUser.nom:null,closer_id:role==="closer"?currentUser.id:null,note:"",isBundle:!!bund,deliveryZoneType:_zoneType,deliveryZoneName:_zoneName,deliveryFee:_deliveryFee,deliveryFeeOverridden:_zoneOverridden,region_type:_regionType,payment_type:_paymentType,created_at:new Date().toISOString()};
    setOrders(o=>[...o,order]);
    pendingOrderUpdates.current[tempId] = Date.now();
    // Auto-save unknown city with manually-entered fee for future autocomplete
    if(orgId && newOrder.city && _zoneType==="unknown" && _zoneOverridden && _deliveryFee>0) {
      const cityName = fmtCity(newOrder.city);
      sbFetch("delivery_other_regions","POST",{org_id:orgId,name:cityName,price:_deliveryFee,interurbain_price:0,cities:[cityName]})
        .then(res=>{ const s=Array.isArray(res)?res[0]:res; if(s?.id) setOtherRegions(prev=>[...prev,s]); })
        .catch(()=>{});
    }
    if(orgId) {
      sbFetch("orders","POST",{org_id:orgId,client:order.client,phone:order.phone,address:order.address,product:order.product,price:order.price,status:order.status,livreur:order.livreur||null,livreur_id:order.livreur_id||null,closer:order.closer||null,closer_id:order.closer_id||null,note:order.note||"",is_bundle:order.isBundle||false,frais_liv:_deliveryFee,archived:false,region_type:_regionType,payment_type:_paymentType})
        .then(res=>{
          const saved = Array.isArray(res)?res[0]:res;
          if(saved?.id) {
            setOrders(o=>{const mapped=o.map(x=>x.id===tempId?{...x,id:saved.id}:x);const seen=new Set();return mapped.filter(x=>seen.has(x.id)?false:(seen.add(x.id),true));});
            addToast("Commande enregistrée ✓","💾",G.green);
            // Update cache immediately so order survives refresh even if loadMain hasn't run yet
            try {
              const cacheKey = `teamly_cache_${orgId}`;
              const cache = JSON.parse(localStorage.getItem(cacheKey)||"{}");
              const mappedSaved = {...saved, isBundle:saved.is_bundle, fraisLiv:saved.frais_liv, deliveryZoneType:saved.delivery_zone_type, deliveryZoneName:saved.delivery_zone_name, deliveryFee:saved.delivery_fee, deliveryFeeOverridden:saved.delivery_fee_overridden};
              cache.orders = [mappedSaved, ...(cache.orders||[]).filter(o=>o.id!==saved.id)];
              localStorage.setItem(cacheKey, JSON.stringify(cache));
            } catch(e){}
            // Re-fetch from server so the new order passes through the active date/status filter
            if(loadMainRef.current) loadMainRef.current();
          } else {
            console.error("addOrder: INSERT returned no row — RLS or constraint blocked it silently. res:", JSON.stringify(res));
            addToast("Commande non enregistrée — RLS/contrainte DB (res vide)","❌",G.red,12000);
          }
          // Envoyer notification au livreur selon le statut choisi
          if(newOrder.livreur && orgId) {
            const NOTIF_MSG = {
              confirmado:       "🔔 Nouveau colis — Aller récupérer chez l'Admin",
              livreur_en_route: "🏍️ Tu es en route pour récupérer le colis",
              colis_pris:       "📦 Colis en main — Partir vers le client",
              en_camino:        "🚀 Livraison directe — En route vers le client",
              chez_client:      "📍 Déjà chez le client — Finaliser la livraison",
            };
            sbFetch("notifications","POST",{org_id:orgId,type:"nouveau_colis",title:NOTIF_MSG[deliveryStatus]||"🔔 Nouveau colis",body:`${newOrder.client} — ${productLabel} · ${Number(price).toLocaleString("fr-FR")} CFA`,role_target:"livreur",livreur_name:newOrder.livreur,read:false,data:{}}).catch(()=>{});
          }
        })
        .catch(e=>{
          let sbErr={};
          try{sbErr=JSON.parse(e.message);}catch(_){}
          const errMsg = sbErr.message||e.message||"Erreur inconnue";
          const errCode = sbErr.code?"["+sbErr.code+"] ":"";
          console.error("addOrder error — code:",sbErr.code,"message:",errMsg,"details:",sbErr.details,"hint:",sbErr.hint);
          addToast(`Erreur sauvegarde: ${errCode}${errMsg.slice(0,100)}`,"❌",G.red,12000);
        });
    }

    if(wa) {
      const phone = newOrder.phone.replace(/\s+/g,"").replace(/^00/,"").replace(/^\+/,"");
      const phoneWA = phone.startsWith("221") ? phone : `221${phone}`;
      // Use editable template — replace variables
      const msg = waTemplate
        .replace(/{client}/g, newOrder.client||"")
        .replace(/{produit}/g, productLabel)
        .replace(/{prix}/g, Number(price).toLocaleString("fr-FR"))
        .replace(/{adresse}/g, newOrder.address||"")
        .replace(/{boutique}/g, settings.boutique||"Teamly")
        .replace(/{livreur}/g, newOrder.livreur||"notre livreur");
      const url = `https://wa.me/${phoneWA}?text=${encodeURIComponent(msg)}`;
      setWaUrl(url);
      setShowWA(true);
    }

    setNewOrder({client:"",phone:"",address:"",city:"",product:"",bundle:"",price:"",qty:"1",discount:"",livreur:"",deliveryStatus:"confirmado",deliveryZoneType:"unknown",deliveryZoneName:"",deliveryFee:"",deliveryFeeOverridden:false,zone:"sn_dakar",fraisLiv:1500,paymentMethod:"cod"});
    setShowAdd(false);
  };

  const [prodErrors, setProdErrors]     = useState({});
  const [bundleErrors, setBundleErrors] = useState({});

  const addProduct = () => {
    // Validation
    const errors = {};
    if(!newProd.name)    errors.name     = true;
    if(!newProd.cost)    errors.cost     = true;
    if(!newProd.price)   errors.price    = true;
    if(!newProd.stock && newProd.stock!=="0") errors.stock = true;
    if(!newProd.niche)   errors.niche    = true;
    if(Object.keys(errors).length>0) { setProdErrors(errors); return; }
    setProdErrors({});
    const tempProdId = "tmp_" + Date.now();
    const _defFrais = settings.defaultDeliveryPrice||1500;
    const newProduct = {id:tempProdId,name:newProd.name,cost:parseInt(newProd.cost)||0,price:parseInt(newProd.price)||0,stock:parseInt(newProd.stock)||0,stockInitial:parseInt(newProd.stock)||0,fraisLiv:_defFrais,fraisLivExtra:_defFrais,niche:newProd.niche||"Autre",bundles:newProd.bundles||[]};
    setProducts(p=>[...p,newProduct]);
    if(!orgId) {
      setProducts(p=>p.filter(x=>x.id!==tempProdId));
      addToast("⚠️ Connexion incomplète — réessayez","⚠️",G.red);
      return;
    }
    sbFetch("products","POST",{org_id:orgId,name:newProduct.name,cost:newProduct.cost,price:newProduct.price,stock:newProduct.stock,stock_initial:newProduct.stock,frais_liv:newProduct.fraisLiv,frais_liv_extra:newProduct.fraisLivExtra,niche:newProduct.niche,archived:false})
      .then(res=>{
        const saved=Array.isArray(res)?res[0]:res;
        if(saved?.id) setProducts(p=>p.map(x=>x.id===tempProdId?{...x,id:saved.id}:x));
        else {
          setProducts(p=>p.filter(x=>x.id!==tempProdId));
          addToast("❌ Réponse invalide du serveur","❌",G.red);
          console.error("addProduct: no id returned", res);
        }
      }).catch(e=>{
        setProducts(p=>p.filter(x=>x.id!==tempProdId));
        addToast(`❌ Erreur d'enregistrement: ${e.message}`,"❌",G.red);
        console.error("addProduct error:",e.message);
      });
    setNewProd({name:"",cost:"",price:"",stock:"",niche:"",bundles:[]});
    setNewBundleForm({label:"",type:"quantite",qte:"2",qteOfferte:"1",prixVente:"",livraisonOfferte:false});
    setShowAddProd(false);
  };

  const addBundle = () => {
    if(!newBundle.name||!newBundle.prodNom||!newBundle.prixVente) return;
    setBundles(p=>[...p,{id:p.length+1,name:newBundle.name,type:newBundle.type,produits:[{nom:newBundle.prodNom,qte:parseInt(newBundle.prodQte||2)}],qteOfferte:parseInt(newBundle.qteOfferte||0),remisePct:parseFloat(newBundle.remisePct||0),prixVente:parseInt(newBundle.prixVente),livraisonOfferte:newBundle.livraisonOfferte,venduAuj:0,rejetAuj:0}]);
    setNewBundle({name:"",type:"quantite",prodNom:"",prodQte:"2",qteOfferte:"1",remisePct:"",prixVente:"",livraisonOfferte:false});
    setShowAddBundle(false);
  };

  const myName = currentUser.nom||(role==="admin"?"Admin":role==="closer"?"Closer":"Livreur");

  const sendChat = (textOverride, extra={}) => {
    const txt = textOverride ?? chatMsg;
    if(!txt && !extra.audio && !extra.type) return;
    const now = new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    const optimisticId = Date.now(); // numeric id enables dedup when real message arrives
    const msg = {id:optimisticId, from:myName, role, text:txt||"", time:now, audio:false, ...extra};
    setChat(p=>[...p,msg]);
    setChatMsg("");
    setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:"smooth"}),50);
    if(!orgId) return;
    // Use return=minimal to avoid receiving large payloads back (critical for audio/image)
    const isMedia = extra.audio || extra.type === "image";
    const timeout = isMedia ? 30000 : 8000;
    fetchWithTimeout(`${SB_URL}/rest/v1/messages`, {
      method: "POST",
      headers: {...sbHeaders(), "Prefer":"return=minimal"},
      body: JSON.stringify({org_id:orgId, from_user:myName, role, text:msg.text, audio:!!extra.audio}),
    }, timeout).catch(e => console.error("sendChat error:", e.message));
  };

  const uploadMedia = async (blob, ext, mime, folder="photos") => {
    const path = `${orgId}/chat/${folder}/${Date.now()}.${ext}`;
    const res = await fetch(`${SB_URL}/storage/v1/object/chat-media/${path}`, {
      method: "POST",
      headers: {"Authorization":`Bearer ${_authToken||SB_KEY}`,"Content-Type":mime,"x-upsert":"true"},
      body: blob,
    });
    if(!res.ok){const txt=await res.text().catch(()=>"");console.error("uploadMedia failed",res.status,txt);throw new Error(`upload ${res.status}`);}
    return `${SB_URL}/storage/v1/object/public/chat-media/${path}`;
  };

  const sendPhoto = async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    e.target.value = "";

    const blobUrl = URL.createObjectURL(file);
    const optimisticId = Date.now();
    const now = new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    setChat(p=>[...p,{id:optimisticId,from:myName,role,text:"",time:now,audio:false,type:"image",imgSrc:blobUrl,uploading:true}]);
    setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:"smooth"}),50);

    const compress = (src) => new Promise(res=>{
      const img = new Image();
      img.onload = () => {
        const MAX=1280; let w=img.width, h=img.height;
        if(w>MAX||h>MAX){if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;}}
        const c=document.createElement("canvas"); c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        c.toBlob(b=>res(b||file),"image/jpeg",0.75);
      };
      img.onerror=()=>res(file);
      img.src=src;
    });

    try {
      const compressed = await compress(blobUrl);
      pendingUploadsRef.current.set(optimisticId, {blob:compressed,ext:"jpg",mime:"image/jpeg",folder:"photos",type:"image",blobUrl});
      const url = await uploadMedia(compressed,"jpg","image/jpeg","photos");
      if(orgId) fetchWithTimeout(`${SB_URL}/rest/v1/messages`,{
        method:"POST",
        headers:{...sbHeaders(),"Prefer":"return=minimal"},
        body:JSON.stringify({org_id:orgId,from_user:myName,role,text:"IMG:"+url,audio:false}),
      },30000).catch(err=>console.error("sendPhoto DB error:",err.message));
      pendingUploadsRef.current.delete(optimisticId);
      setChat(p=>p.map(m=>m.id===optimisticId?{...m,imgSrc:url,uploading:false}:m));
      URL.revokeObjectURL(blobUrl);
    } catch(err) {
      console.error("sendPhoto upload error:",err.message);
      setChat(p=>p.map(m=>m.id===optimisticId?{...m,uploading:false,uploadFailed:true}:m));
    }
  };

  const retryUpload = async (msg) => {
    const pending = pendingUploadsRef.current.get(msg.id);
    if(!pending) return;
    setChat(p=>p.map(m=>m.id===msg.id?{...m,uploading:true,uploadFailed:false}:m));
    try {
      const url = await uploadMedia(pending.blob,pending.ext,pending.mime,pending.folder);
      const textPayload = pending.type==="file"
        ? `FILE:${url}|${pending.fileName||"Fichier"}|${pending.fileSize||0}|${pending.mime}`
        : `IMG:${url}`;
      if(orgId) fetchWithTimeout(`${SB_URL}/rest/v1/messages`,{
        method:"POST",
        headers:{...sbHeaders(),"Prefer":"return=minimal"},
        body:JSON.stringify({org_id:orgId,from_user:myName,role,text:textPayload,audio:false}),
      },30000).catch(err=>console.error("retryUpload DB error:",err.message));
      pendingUploadsRef.current.delete(msg.id);
      if(pending.type==="image"){
        setChat(p=>p.map(m=>m.id===msg.id?{...m,imgSrc:url,uploading:false}:m));
        if(pending.blobUrl) URL.revokeObjectURL(pending.blobUrl);
      } else {
        setChat(p=>p.map(m=>m.id===msg.id?{...m,fileUrl:url,uploading:false}:m));
      }
    } catch(err) {
      console.error("retryUpload error:",err.message);
      setChat(p=>p.map(m=>m.id===msg.id?{...m,uploading:false,uploadFailed:true}:m));
    }
  };

  const sendFile = async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    e.target.value = "";
    if(file.size > 20*1024*1024){alert("Fichier trop grand (max 20 Mo)");return;}
    const ext = (file.name.split(".").pop()||"bin").slice(0,10);
    const optimisticId = Date.now();
    const now = new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    setChat(p=>[...p,{id:optimisticId,from:myName,role,text:"",time:now,audio:false,type:"file",fileUrl:null,fileName:file.name,fileSize:file.size,fileMime:file.type,uploading:true}]);
    setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:"smooth"}),50);
    try {
      pendingUploadsRef.current.set(optimisticId,{blob:file,ext,mime:file.type||"application/octet-stream",folder:"files",type:"file",fileName:file.name,fileSize:file.size});
      const url = await uploadMedia(file,ext,file.type||"application/octet-stream","files");
      if(orgId) fetchWithTimeout(`${SB_URL}/rest/v1/messages`,{
        method:"POST",
        headers:{...sbHeaders(),"Prefer":"return=minimal"},
        body:JSON.stringify({org_id:orgId,from_user:myName,role,text:`FILE:${url}|${file.name}|${file.size}|${file.type}`,audio:false}),
      },30000).catch(err=>console.error("sendFile DB error:",err.message));
      pendingUploadsRef.current.delete(optimisticId);
      setChat(p=>p.map(m=>m.id===optimisticId?{...m,fileUrl:url,uploading:false}:m));
    } catch(err) {
      console.error("sendFile upload error:",err.message);
      setChat(p=>p.map(m=>m.id===optimisticId?{...m,uploading:false,uploadFailed:true}:m));
    }
  };

  const sendAudioBlob = async (blob, secs) => {
    const dur = `0:${String(secs).padStart(2,"0")}`;
    const ext = blob.type?.includes("mp4") ? "mp4" : blob.type?.includes("ogg") ? "ogg" : "webm";
    try {
      const url = await uploadMedia(blob, ext, blob.type||"audio/webm");
      sendChat("", {audio:true, audioUrl:url, duration:dur, text:`AUD:${dur}|${url}`});
    } catch {
      // fallback a base64
      const reader = new FileReader();
      reader.onload = ev => sendChat("", {audio:true, audioUrl:ev.target.result, duration:dur, text:`AUD:${dur}|${ev.target.result}`});
      reader.readAsDataURL(blob);
    }
  };

  const deleteMsg = (id) => {
    if(!id) return;
    sbFetch(`messages?id=eq.${id}`,"DELETE").catch(()=>{});
    setChat(p=>p.filter(m=>m.id!==id));
    setSelectedMsgId(null);
  };

  // ── stats ──
  const livres  = orders.filter(o=>o.status==="entregado").length;
  const rejetes = orders.filter(o=>o.status==="rechazado").length;
  const enRoute = orders.filter(o=>o.status==="en_camino").length;
  const revenus = orders.filter(o=>o.status==="entregado").reduce((a,o)=>a+o.price,0);
  const taux    = orders.length>0?Math.round(livres/orders.length*100):0;
  const myLiv   = orders.filter(o=>o.livreur_id===currentUser.id);
  const myClo   = role==="closer" ? orders : orders.filter(o=>o.closer_id===currentUser.id);

  // ── compta par produit ──
  const calcProd = products.map(prod=>{
    const op      = orders.filter(o=>o.product?.startsWith(prod.name));
    const nLiv    = op.filter(o=>o.status==="entregado").length;
    const nRej    = op.filter(o=>o.status==="rechazado").length;
    const ca      = nLiv*prod.price;
    const camv    = nLiv*prod.cost;
    // Zone-aware frais: use order-level frais_liv if available, else detect from address
    const livOps  = op.filter(o=>o.status==="entregado");
    const frais   = livOps.reduce((s,o)=>{
      if(o.fraisLiv) return s+o.fraisLiv;
      return s+detectZone(o.address).price;
    },0)||nLiv*(prod.fraisLiv||FRAIS_LIV);
    // Zone breakdown for display
    const zoneBreakdown = WA_ZONES.map(z=>({
      zone:z,
      count:livOps.filter(o=>detectZone(o.address).key===z.key).length,
    })).filter(x=>x.count>0);
    const echouees = parseFloat(livraisonsEchouees[prod.id]||0);
    const pub     = parseFloat(adSpend[prod.id]||0);
    const ben     = ca-camv-frais-echouees-pub;
    const marge   = ca>0?ben/ca:0;
    return {prod,nLiv,nRej,ca,camv,frais,echouees,pub,ben,marge,zoneBreakdown};
  });
  const tCA   = calcProd.reduce((a,x)=>a+x.ca,0);
  const tBen  = calcProd.reduce((a,x)=>a+x.ben,0);
  const caJour= orders.filter(o=>o.status==="entregado"&&o.created_at&&localDateStr(o.created_at)===localDateStr()).reduce((a,o)=>a+o.price,0);
  const tCamv = calcProd.reduce((a,x)=>a+x.camv,0);
  const tFrais= calcProd.reduce((a,x)=>a+x.frais,0);
  const tPub  = calcProd.reduce((a,x)=>a+x.pub,0);
  const tMarge= tCA>0?tBen/tCA:0;

  // ── Comptabilité filtrée par plage de dates + filtres avancés ──
  const comptaOrders = (()=>{
    const from = dateFrom ? new Date(dateFrom+"T00:00:00.000Z") : null;
    const to   = dateTo   ? new Date(dateTo  +"T23:59:59.999Z") : null;
    const cf   = comptaFilters;
    return orders.filter(o=>{
      // Date
      const d = o.created_at ? new Date(o.created_at) : null;
      if(from && (!d||d<from)) return false;
      if(to   && (!d||d>to  )) return false;
      // Produit
      if(cf.produits.length>0 && !cf.produits.some(p=>o.product?.startsWith(p))) return false;
      // Statut
      if(cf.statuts.length>0 && !cf.statuts.includes(o.status)) return false;
      // Type livraison (main=locale, other=régionale)
      if(cf.livraisonType==="locale_moto"    && o.deliveryZoneType!=="main" ) return false;
      if(cf.livraisonType==="regionale_voiture" && o.deliveryZoneType!=="other") return false;
      // Source
      if(cf.source!=="all"){
        const isShopify = !!(o.note?.includes("Shopify")||o.order_source==="shopify");
        if(cf.source==="shopify" && !isShopify) return false;
        if(cf.source==="manual"  &&  isShopify) return false;
      }
      // Livreur
      if(cf.livreurs.length>0 && !cf.livreurs.includes(o.livreur||"")) return false;
      // Région/ville (match against deliveryZoneName or city field)
      if(cf.ville){
        const haystack=_normCity((o.city||o.deliveryZoneName||o.address||""));
        if(!haystack.includes(_normCity(cf.ville))) return false;
      } else if(cf.region){
        const haystack=_normCity((o.deliveryZoneName||o.address||""));
        if(!haystack.includes(_normCity(cf.region))) return false;
      }
      return true;
    });
  })();
  const comptaCalcProd = products.map(prod=>{
    const op     = comptaOrders.filter(o=>o.product?.startsWith(prod.name));
    const nLiv   = op.filter(o=>o.status==="entregado").length;
    const nRej   = op.filter(o=>o.status==="rechazado").length;
    const ca     = nLiv*prod.price;
    const camv   = nLiv*prod.cost;
    const livOps = op.filter(o=>o.status==="entregado");
    const frais  = livOps.reduce((s,o)=>{
      if(o.fraisLiv) return s+o.fraisLiv;
      return s+detectZone(o.address).price;
    },0)||nLiv*(prod.fraisLiv||FRAIS_LIV);
    const zoneBreakdown = WA_ZONES.map(z=>({
      zone:z,
      count:livOps.filter(o=>detectZone(o.address).key===z.key).length,
    })).filter(x=>x.count>0);
    const echouees = parseFloat(livraisonsEchouees[prod.id]||0);
    const pub      = parseFloat(adSpend[prod.id]||0);
    const ben      = ca-camv-frais-echouees-pub;
    const marge    = ca>0?ben/ca:0;
    return {prod,nLiv,nRej,ca,camv,frais,echouees,pub,ben,marge,zoneBreakdown};
  });
  const comptaCA    = comptaCalcProd.reduce((a,x)=>a+x.ca,0);
  const comptaBen   = comptaCalcProd.reduce((a,x)=>a+x.ben,0);
  const comptaCamv  = comptaCalcProd.reduce((a,x)=>a+x.camv,0);
  const comptaFrais = comptaCalcProd.reduce((a,x)=>a+x.frais,0);
  const comptaPub   = comptaCalcProd.reduce((a,x)=>a+x.pub,0);
  const comptaMarge = comptaCA>0?comptaBen/comptaCA:0;

  // ── Move card up/down within its status group ──
  const moveInGroup = (id, direction) => {
    const target = orders.find(o => o.id === id);
    if (!target) return;
    setLocalOrderIds(prev => {
      const allIds = prev.length > 0 ? [...prev] : filteredOrders.map(x => x.id);
      filteredOrders.forEach(o => { if (!allIds.includes(o.id)) allIds.push(o.id); });
      const groupIds = allIds.filter(oid => {
        const found = filteredOrders.find(o => o.id === oid);
        return found && found.status === target.status;
      });
      const idx = groupIds.indexOf(id);
      if (direction === 'up' && idx <= 0) return prev;
      if (direction === 'down' && idx >= groupIds.length - 1) return prev;
      const swapId = direction === 'up' ? groupIds[idx - 1] : groupIds[idx + 1];
      const next = [...allIds];
      const idxA = next.indexOf(id), idxB = next.indexOf(swapId);
      if (idxA < 0 || idxB < 0) return prev;
      [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
      return next;
    });
  };

  const activeEnCamino = role==="livreur" ? orders.find(x=>String(x.livreur_id)===String(currentUser.id)&&(x.status==="en_camino"||x.status==="chez_client")) : null;

  const [org, setOrg]             = useState(null);
  const [inviteLink, setInviteLink] = useState({closer:"",livreur:""});

  const PLANS = [
    {
      key:"gratuit", name:"Gratuit", price:"0 CFA", priceNum:0, maxMembers:2, maxOrders:30, maxStores:0, color:G.gray, bg:"#F9FAFB",
      tag:"14 jours d'essai",
      description:"Pour découvrir Teamly sans engagement",
      features:[
        "2 membres — Admin + 1 membre",
        "30 commandes / mois",
        "Création manuelle de commandes",
        "Gestion des produits — ajout & édition",
        "Suivi du stock (quantités)",
        "Suivi des livraisons",
        "Chat équipe interne",
        "Dashboard & statistiques basiques",
      ],
      locked:[
        "GPS livreur temps réel",
        "Intégration boutique (Shopify, WooCommerce, YouCan)",
        "Synchronisation stock automatique",
        "Comptabilité & marges",
        "Assistant IA",
        "Confirmation WhatsApp automatique",
        "Alertes stock bas",
      ],
    },
    {
      key:"basic", name:"Basic", price:"8 000 CFA", priceNum:8000, maxMembers:3, maxOrders:100, maxStores:1, color:G.green, bg:G.greenLight,
      tag:"Le plus populaire",
      description:"Pour les boutiques qui démarrent",
      features:[
        "3 membres — Admin + 1 Closer + 1 Livreur",
        "100 commandes / mois",
        "1 boutique connectée (Shopify, WooCommerce ou YouCan)",
        "Confirmation WhatsApp automatique",
        "Gestion produits & stock",
        "GPS livreur temps réel",
        "Comptabilité & marges",
        "Assistant IA",
        "Chat équipe interne",
        "Dashboard complet",
      ],
      locked:[],
    },
    {
      key:"pro", name:"Pro", price:"14 000 CFA", priceNum:14000, maxMembers:5, maxOrders:2000, maxStores:2, color:G.blue, bg:"#EFF6FF",
      tag:"Pour les équipes",
      description:"Pour les boutiques en croissance",
      features:[
        "5 membres — 3 rôles (Admin, Closer, Livreur)",
        "2 000 commandes / mois",
        "2 boutiques connectées (Shopify, WooCommerce, YouCan)",
        "Toutes les fonctions Basic",
        "Confirmation WhatsApp automatique",
        "Gestion produits & stock avancée",
        "GPS livreur temps réel",
        "Comptabilité & marges",
        "Assistant IA",
        "Rapports & statistiques avancés",
        "Export Excel clients",
        "Chat équipe interne",
      ],
      locked:[],
    },
    {
      key:"scale", name:"Scale", price:"25 000 CFA", priceNum:25000, maxMembers:null, maxOrders:null, maxStores:4, color:"#7C3AED", bg:"#EDE9FE",
      tag:"Pour les grandes équipes",
      description:"Croissance sans limites",
      features:[
        "Membres illimités — 3 rôles inclus",
        "Commandes illimitées",
        "4 boutiques connectées (Shopify, WooCommerce, YouCan)",
        "Toutes les fonctions Pro",
        "Confirmation WhatsApp automatique",
        "Gestion produits & stock",
        "GPS livreur temps réel",
        "Comptabilité & marges",
        "Assistant IA",
        "Rapports & statistiques avancés",
        "Export Excel clients",
        "Support prioritaire 24/7",
        "Chat équipe interne",
      ],
      locked:[],
    },
  ];

  const genToken = () => Math.random().toString(36).substring(2,10).toUpperCase();

  const DISPOSABLE_DOMAINS = ["mailinator.com","guerrillamail.com","tempmail.com","10minutemail.com","throwam.com","yopmail.com","sharklasers.com","guerrillamailblock.com","grr.la","guerrillamail.info","spam4.me","trashmail.com","trashmail.me","trashmail.net","fakeinbox.com","maildrop.cc","dispostable.com","mailnull.com","spamgourmet.com","getairmail.com","filzmail.com","throwam.com","mailnesia.com","meltmail.com","tempr.email","discard.email","spamspot.com","spamevade.com","deadaddress.com","spamfree24.org","mt2015.com","dingbone.com","fudgerub.com","lookugly.com","shitmail.me","tempe-mail.com","temp-mail.org","temp-mail.io"];
  const handleRegister = () => {
    if(!authForm.email||!authForm.password||!authForm.boutique||!authForm.phone) { setAuthError("Remplis tous les champs obligatoires *"); return; }
    if(authForm.password.length<8) { setAuthError("Mot de passe: 8 caractères minimum"); return; }
    if(!/[A-Za-z]/.test(authForm.password)||!/[0-9]/.test(authForm.password)) { setAuthError("Mot de passe: au moins une lettre et un chiffre"); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if(!emailRegex.test(authForm.email)) { setAuthError("Adresse email invalide"); return; }
    const emailDomain = authForm.email.split("@")[1]?.toLowerCase();
    if(DISPOSABLE_DOMAINS.includes(emailDomain)) { setAuthError("Les emails temporaires ne sont pas autorisés — utilise une vraie adresse email"); return; }
    setAuthError("");
    const derivedNom = (authForm.email.split("@")[0] || "Admin").slice(0, 60);
    sbAuth(authForm.email, authForm.password, "register")
      .then(async(data)=>{
        if(!data.access_token) {
          // Supabase email confirmation is enabled — save pending data, show verify screen
          const newOrgId = crypto.randomUUID ? crypto.randomUUID() : `org_${Date.now()}`;
          try { localStorage.setItem("teamly_pending_signup", JSON.stringify({
            userId: data.user?.id, email: authForm.email, nom: derivedNom,
            phone: authForm.phone, boutique: authForm.boutique, orgId: newOrgId,
          })); } catch(e) {}
          setAuthStep("verify-email");
          return;
        }
        const tok=data.access_token; _authToken=tok; setSbToken(tok);
        // Generate org UUID client-side so we don't need to read it back
        const newOrgId = crypto.randomUUID ? crypto.randomUUID() : `org_${Date.now()}`;
        await sbFetch("organizations","POST",{id:newOrgId,name:authForm.boutique||"Ma Boutique",whatsapp:authForm.phone||""});
        await sbFetch("profiles","POST",{id:data.user.id,org_id:newOrgId,nom:derivedNom,phone:authForm.phone||"",email:authForm.email,role:"admin"});
        // Set REAL UUID - critical for invite links
        setOrgId(newOrgId);
        setSbReady(true);
        setCurrentUser({id:data.user.id,nom:derivedNom,email:authForm.email,role:"admin"});
        setSettings(s=>(({...s,nom:derivedNom,whatsapp:authForm.phone,boutique:authForm.boutique})));
        setOrg({id:newOrgId,name:authForm.boutique,whatsapp:authForm.phone,plan:null});
        try{localStorage.setItem("teamly_org",newOrgId);localStorage.setItem("teamly_token",tok);if(data.refresh_token)localStorage.setItem("teamly_refresh_token",data.refresh_token);localStorage.setItem("teamly_email",authForm.email);localStorage.setItem("teamly_role","admin");localStorage.setItem("teamly_userId",data.user.id);localStorage.setItem("teamly_nom",derivedNom);}catch(e){}
        setAuthStep("plan"); // Move to plan AFTER org is created
      }).catch(e=>setAuthError(e.message||"Erreur inscription — email déjà utilisé ?"));
  };

  const handleGoogleOnboardSubmit = async () => {
    if(!googleOnboard) return;
    if(!authForm.boutique?.trim() || !authForm.phone?.trim()) {
      setAuthError("Nom de la boutique et téléphone obligatoires *");
      return;
    }
    setAuthError("");
    const {userId, email, fullName} = googleOnboard;
    const nom = (fullName || email.split("@")[0] || "Admin").slice(0, 60);
    const userJwt = _authToken || (typeof localStorage!=="undefined" ? localStorage.getItem("teamly_token") : null);
    let newOrgId;
    try {
      const r = await fetchWithTimeout("/.netlify/functions/google-onboard", {
        method: "POST",
        headers: { "Content-Type":"application/json", "Authorization":`Bearer ${userJwt||""}` },
        body: JSON.stringify({ boutique: authForm.boutique.trim(), phone: authForm.phone.trim(), nom }),
      }, 15000);
      const data = await r.json().catch(()=>({}));
      if (!r.ok || !data.ok) {
        console.error("[TEAMLY OAuth] onboard fn failed:", r.status, data);
        setAuthError("Erreur création — "+((data?.error||`HTTP ${r.status}`)||"réessaye").slice(0,180));
        return;
      }
      newOrgId = data.orgId;
    } catch(e) {
      console.error("[TEAMLY OAuth] onboard fn error:", e?.message);
      setAuthError("Erreur réseau — "+(e?.message||"réessaye").slice(0,180));
      return;
    }
    setOrgId(newOrgId); setSbReady(true);
    setCurrentUser({id:userId, nom, email, role:"admin", phone:authForm.phone.trim()});
    setSettings(s=>({...s, nom, whatsapp:authForm.phone.trim(), boutique:authForm.boutique.trim()}));
    setOrg({id:newOrgId, name:authForm.boutique.trim(), whatsapp:authForm.phone.trim(), plan:null});
    setRole("admin");
    try {
      localStorage.setItem("teamly_org", newOrgId);
      localStorage.setItem("teamly_role", "admin");
      localStorage.setItem("teamly_userId", userId);
      localStorage.setItem("teamly_nom", nom);
      localStorage.setItem("teamly_phone", authForm.phone.trim());
    } catch(e){}
    setGoogleOnboard(null);
    setAuthStep("plan");
  };

  const handlePlan = (plan) => {
    setOrg(o=>({...o,plan}));
    setAuthStep("gestion"); // New step: choose closer mode
  };

  const handleGestion = (mode) => {
    setGestionMode(mode);
    // orgId is the REAL UUID set after Supabase registration
    const realOrgId = orgId || org?.id || "";
    const closerToken  = genToken();
    const livreurToken = genToken();
    setInviteLink({
      closer:  `${window.location.origin}?org=${realOrgId}&role=closer&token=${closerToken}`,
      livreur: `${window.location.origin}?org=${realOrgId}&role=livreur&token=${livreurToken}`,
    });
    setAuthStep("invite");
  };

  // ── Login screen ──
  if(appLoading) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:"#1A5C38"}}>
      <div style={{marginBottom:20}}><TeamlyLogo size={1.3}/></div>
      <div style={{width:36,height:36,border:"3px solid rgba(255,255,255,0.2)",borderTop:"3px solid #F0A500",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );

  if(!role) return (
    <div style={{minHeight:"100vh",background:`linear-gradient(155deg,${G.green} 0%,#0D3D25 100%)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",padding:24,overflowY:"auto"}}>

      {/* Logo */}
      <div style={{marginBottom:32,textAlign:"center"}}>
        <TeamlyLogo size={2}/>
        <div style={{color:"rgba(255,255,255,0.5)",fontSize:11,marginTop:6,fontFamily:"sans-serif",letterSpacing:2}}>GESTION DE COMMANDES · WEST AFRICA</div>
      </div>

      {/* ── ÉTAPE 1: Login / Register ── */}
      {(authStep==="login")&&(
        <div style={{width:"100%",maxWidth:360}}>
          {/* Toggle */}
          <div style={{display:"flex",background:"rgba(0,0,0,0.25)",borderRadius:12,padding:3,gap:3,marginBottom:20}}>
            {[{k:"login",l:"Email"},{k:"register",l:"S'inscrire"}].map(m=>(
              <button key={m.k} onClick={()=>{setAuthMode(m.k);setAuthError("");}}
                style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:600,fontSize:12,fontFamily:"sans-serif",background:authMode===m.k?G.gold:"none",color:authMode===m.k?G.dark:"rgba(255,255,255,0.7)"}}>
                {m.l}
              </button>
            ))}
          </div>

          {/* Login */}
          {authMode==="login"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={signInWithGoogle} type="button"
                style={{background:"#fff",color:"#1F1F1F",border:"none",borderRadius:10,padding:"11px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:10,width:"100%"}}>
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continuer avec Google
              </button>
              <div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0",color:"rgba(255,255,255,0.4)",fontSize:11,fontFamily:"sans-serif"}}>
                <div style={{flex:1,height:1,background:"rgba(255,255,255,0.15)"}}/>
                ou
                <div style={{flex:1,height:1,background:"rgba(255,255,255,0.15)"}}/>
              </div>
              {[{key:"email",label:"📧 Email",ph:"vous@boutique.sn",type:"email"},{key:"password",label:"🔒 Mot de passe",ph:"••••••••",type:"password"}].map(f=>(
                <div key={f.key}>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginBottom:4,fontFamily:"sans-serif"}}>{f.label}</div>
                  <input type={f.type} value={authForm[f.key]} onChange={e=>setAuthForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}
                    style={{width:"100%",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"11px 14px",fontSize:13,color:G.white,outline:"none",boxSizing:"border-box",fontFamily:"sans-serif"}}/>
                </div>
              ))}
              {authError&&<div style={{fontSize:11,color:"#FCA5A5",fontFamily:"sans-serif"}}>{authError}</div>}
              <button onClick={async()=>{
                if(!authForm.email||!authForm.password){setAuthError("Email et mot de passe requis");return;}
                setAuthError(""); setAuthLoading(true);
                try {
                  const data = await sbAuth(authForm.email, authForm.password, "login");
                  const tok = data.access_token;
                  _authToken = tok; setSbToken(tok);
                  // Device session check (max 2 devices)
                  const sess = await registerDeviceSession(tok).catch(()=>({ok:true}));
                  setDeviceFingerprint(sess.fingerprint);
                  if (sess.limit_reached) {
                    setDeviceLimitModal({ sessions: sess.existing_sessions || [], token: tok, fingerprint: sess.fingerprint });
                    setAuthLoading(false);
                    return;
                  }
                  // Fetch profile by user ID, fallback to email if not found
                  let profiles = await sbFetch(`profiles?id=eq.${data.user.id}&limit=1`).catch(()=>null);
                  if(!profiles||profiles.length===0) profiles = await sbFetch(`profiles?email=eq.${encodeURIComponent(authForm.email)}&limit=1`).catch(()=>null);
                  if(profiles&&profiles.length>0){
                    const p=profiles[0];
                    // Account removed from team — block login
                    if(!p.org_id){
                      setAuthError("Ton compte a été retiré de cette équipe. Contacte l'administrateur.");
                      setAuthLoading(false); return;
                    }
                    const orgs = await sbFetch(`organizations?id=eq.${p.org_id}&limit=1&select=id,name,whatsapp,plan,created_at,settings`).catch(()=>null);
                    const orgName  = orgs?.[0]?.name  || "Ma Boutique";
                    const orgPhone = orgs?.[0]?.whatsapp || "";
                    setOrgId(p.org_id); setSbReady(true);
                    setSettings(s=>({...s,nom:p.nom||s.nom,whatsapp:p.phone||orgPhone||s.whatsapp,boutique:orgName,...(orgs?.[0]?.plan?{plan:orgs[0].plan}:{}),...(orgs?.[0]?.settings||{})}));
                    // Apply localStorage overrides — user-saved values take priority over DB defaults
                    if((p.role||"admin")==="admin"){
                      const sbLS=localStorage.getItem(`teamly_boutique_${p.org_id}`)||localStorage.getItem("teamly_boutique");
                      const swLS=localStorage.getItem(`teamly_whatsapp_${p.org_id}`)||localStorage.getItem("teamly_whatsapp");
                      const ccLS=localStorage.getItem(`teamly_cc_${p.org_id}`)||localStorage.getItem("teamly_closerCompta");
                      if(sbLS)setSettings(s=>({...s,boutique:sbLS}));
                      if(swLS)setSettings(s=>({...s,whatsapp:swLS}));
                      if(ccLS!==null)setSettings(s=>({...s,closerCompta:ccLS==="true"}));
                    }
                    if(orgs?.[0]) {
                      const org=orgs[0];
                      if(authForm.email==="salioumbayee877@gmail.com"||authForm.email==="salioumbayeee261@gmail.com"){
                        setIsPro(true); setTrialDaysLeft(999);
                      } else {
                        const paidPlans=["basic","pro","scale"];
                        const notExpired=!org.plan_expires_at||new Date(org.plan_expires_at)>new Date();
                        const pro=paidPlans.includes(org.plan)&&notExpired;
                        setIsPro(pro);
                        if(!pro){const days=Math.max(0,14-Math.floor((Date.now()-new Date(org.created_at||Date.now()))/86400000));setTrialDaysLeft(days);}
                      }
                    }
                    setCurrentUser({id:p.id||"",nom:p.nom||"",email:p.email||authForm.email,role:p.role||"admin",phone:p.phone||"",birthday:p.birthday||"",email_confirmed_at:data.user?.email_confirmed_at||null});
                    setRole(p.role||"admin"); setTab("dashboard");
                    try {
                      localStorage.setItem("teamly_token", tok);
                      if(data.refresh_token) localStorage.setItem("teamly_refresh_token", data.refresh_token);
                      localStorage.setItem("teamly_email", authForm.email);
                      localStorage.setItem("teamly_org", p.org_id);
                      localStorage.setItem("teamly_role", p.role||"admin");
                      localStorage.setItem("teamly_userId", p.id||"");
                      localStorage.setItem("teamly_nom", p.nom||"");
                    } catch(e){}
                  } else {
                    // No profile — create org+profile with user JWT (RLS allows it)
                    const newOrgId = crypto.randomUUID ? crypto.randomUUID() : `org_${Date.now()}`;
                    await sbFetch("organizations","POST",{id:newOrgId,name:"Ma Boutique",whatsapp:""});
                    await sbFetch("profiles","POST",{id:data.user.id,org_id:newOrgId,nom:authForm.email.split("@")[0],phone:"",email:authForm.email,role:"admin"});
                    setOrgId(newOrgId); setSbReady(true); setRole("admin"); setTab("dashboard");
                    try{localStorage.setItem("teamly_token",tok);localStorage.setItem("teamly_email",authForm.email);localStorage.setItem("teamly_org",newOrgId);localStorage.setItem("teamly_role","admin");}catch(e){}
                  }
                } catch(e) {
                  const errMsg = e.message||"";
                  const isServerDown = errMsg.includes("503")||errMsg.includes("upstream")||errMsg.includes("Délai")||errMsg.includes("lente");
                  setAuthError(isServerDown?"Serveur Supabase indisponible (503) — vérifie que ton projet n'est pas pausé sur supabase.com":errMsg||"Email ou mot de passe incorrect");
                }
                setAuthLoading(false);
              }} disabled={authLoading} style={{background:authLoading?"#A0845C":G.gold,color:G.dark,border:"none",borderRadius:10,padding:"13px 0",fontWeight:700,fontSize:14,cursor:authLoading?"not-allowed":"pointer",marginTop:4,fontFamily:"sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                {authLoading?(
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G.dark} strokeWidth="2.5" strokeLinecap="round" style={{animation:"spin 0.8s linear infinite"}}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Connexion en cours... (30s max)
                  </>
                ):"Se connecter →"}
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              </button>
              <div style={{textAlign:"center",marginTop:6}}>
                <button onClick={async()=>{
                  if(!authForm.email){setAuthError("Entre ton email d'abord");return;}
                  try{
                    const r=await fetch(`${SB_URL}/auth/v1/recover`,{method:"POST",headers:{"Content-Type":"application/json","apikey":SB_KEY},body:JSON.stringify({email:authForm.email})});
                    if(r.ok) setAuthError("✅ Email de récupération envoyé !");
                    else setAuthError("Erreur — vérifie ton email");
                  }catch(e){setAuthError("Erreur réseau");}
                }} style={{background:"none",border:"none",color:"rgba(255,255,255,0.45)",fontSize:11,cursor:"pointer",fontFamily:"sans-serif",textDecoration:"underline"}}>
                  Mot de passe oublié ?
                </button>
              </div>
              <div style={{textAlign:"center",marginTop:4}}>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontFamily:"sans-serif"}}>Tu as un lien d'invitation ? </span>
                <button onClick={()=>setAuthStep("join")} style={{background:"none",border:"none",color:G.gold,fontSize:11,cursor:"pointer",fontFamily:"sans-serif",fontWeight:600}}>Rejoindre une équipe</button>
              </div>
            </div>
          )}

          {/* Register */}
          {authMode==="register"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={signInWithGoogle} type="button"
                style={{background:"#fff",color:"#1F1F1F",border:"none",borderRadius:10,padding:"11px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:10,width:"100%"}}>
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continuer avec Google
              </button>
              <div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0",color:"rgba(255,255,255,0.4)",fontSize:11,fontFamily:"sans-serif"}}>
                <div style={{flex:1,height:1,background:"rgba(255,255,255,0.15)"}}/>
                ou
                <div style={{flex:1,height:1,background:"rgba(255,255,255,0.15)"}}/>
              </div>
              {[
                {key:"boutique",  label:"🏪 Nom de ta boutique *",  ph:"Ma Boutique Dakar",  type:"text",     ac:"organization"},
                {key:"email",     label:"📧 Email *",                ph:"vous@boutique.sn",   type:"email",    ac:"email"},
                {key:"phone",     label:"📱 Téléphone *",            ph:"77 123 45 67",       type:"tel",      ac:"tel"},
                {key:"password",  label:"🔒 Mot de passe *",         ph:"8 car. min · 1 lettre + 1 chiffre",   type:"password", ac:"new-password"},
              ].map(f=>(
                <div key={f.key}>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginBottom:4,fontFamily:"sans-serif"}}>{f.label}</div>
                  <input 
                    type={f.type}
                    autoComplete={f.ac}
                    name={f.key}
                    value={authForm[f.key]||""}
                    onChange={e=>setAuthForm(p=>({...p,[f.key]:e.target.value}))}
                    placeholder={f.ph}
                    style={{width:"100%",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"11px 14px",fontSize:13,color:G.white,outline:"none",boxSizing:"border-box",fontFamily:"sans-serif"}}/>
                </div>
              ))}
              {authError&&<div style={{fontSize:11,color:"#FCA5A5",fontFamily:"sans-serif"}}>{authError}</div>}
              <button onClick={handleRegister}
                style={{background:G.gold,color:G.dark,border:"none",borderRadius:10,padding:"13px 0",fontWeight:700,fontSize:14,cursor:"pointer",marginTop:4,fontFamily:"sans-serif"}}>
                Créer mon compte →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ÉTAPE Google onboard: boutique + téléphone ── */}
      {authStep==="google-onboard"&&(
        <div style={{width:"100%",maxWidth:380}}>
          <div style={{textAlign:"center",marginBottom:22}}>
            <div style={{fontSize:36,marginBottom:8}}>🎉</div>
            <div style={{fontSize:18,fontWeight:700,color:G.white,fontFamily:"sans-serif"}}>Bienvenue {googleOnboard?.fullName||""} !</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:6,fontFamily:"sans-serif"}}>Quelques infos pour finaliser ton compte</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginBottom:4,fontFamily:"sans-serif"}}>🏪 Nom de ta boutique *</div>
              <input type="text" value={authForm.boutique||""} onChange={e=>setAuthForm(p=>({...p,boutique:e.target.value}))} placeholder="Ma Boutique Dakar"
                style={{width:"100%",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"11px 14px",fontSize:13,color:G.white,outline:"none",boxSizing:"border-box",fontFamily:"sans-serif"}}/>
            </div>
            <div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginBottom:4,fontFamily:"sans-serif"}}>📱 Téléphone *</div>
              <input type="tel" value={authForm.phone||""} onChange={e=>setAuthForm(p=>({...p,phone:e.target.value}))} placeholder="77 123 45 67"
                style={{width:"100%",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"11px 14px",fontSize:13,color:G.white,outline:"none",boxSizing:"border-box",fontFamily:"sans-serif"}}/>
            </div>
            {authError&&<div style={{fontSize:11,color:"#FCA5A5",fontFamily:"sans-serif"}}>{authError}</div>}
            <button onClick={handleGoogleOnboardSubmit}
              style={{background:G.gold,color:G.dark,border:"none",borderRadius:10,padding:"13px 0",fontWeight:700,fontSize:14,cursor:"pointer",marginTop:6,fontFamily:"sans-serif"}}>
              Continuer →
            </button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 2: Choix du plan ── */}
      {authStep==="plan"&&(
        <div style={{width:"100%",maxWidth:380}}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:18,fontWeight:700,color:G.white,fontFamily:"sans-serif"}}>Bienvenue, {authForm.boutique} 👋</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:6,fontFamily:"sans-serif"}}>Choisis ton plan pour commencer</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {PLANS.map(p=>(
              <button key={p.key} onClick={()=>handlePlan(p.key)}
                style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:14,padding:"16px 18px",cursor:"pointer",textAlign:"left",width:"100%"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.15)"}
                onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontWeight:700,fontSize:16,color:G.gold,fontFamily:"sans-serif"}}>{p.name}</div>
                  <div style={{fontWeight:700,fontSize:15,color:G.white,fontFamily:"sans-serif"}}>{p.price} <span style={{fontSize:10,opacity:0.7}}>CFA/mois</span></div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  {p.features.map((f,i)=>(
                    <div key={i} style={{fontSize:11,color:"rgba(255,255,255,0.7)",fontFamily:"sans-serif"}}>✓ {f}</div>
                  ))}
                </div>
              </button>
            ))}
            <div style={{textAlign:"center",marginTop:4}}>
              <button onClick={()=>handlePlan("starter")} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:11,cursor:"pointer",fontFamily:"sans-serif"}}>Essayer gratuitement 14 jours →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 2b: Mode gestion closer ── */}
      {authStep==="gestion"&&(
        <div style={{width:"100%",maxWidth:380}}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontSize:32,marginBottom:8}}>📞</div>
            <div style={{fontSize:18,fontWeight:700,color:G.white,fontFamily:"sans-serif"}}>Qui confirme les commandes ?</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:6,fontFamily:"sans-serif"}}>Le Closer appelle les clients, confirme les commandes et assigne les livreurs</div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {/* Option 1: Je gère moi-même */}
            <button onClick={()=>handleGestion("solo")}
              style={{background:"rgba(255,255,255,0.08)",border:"2px solid rgba(240,165,0,0.5)",borderRadius:16,padding:"20px 18px",cursor:"pointer",textAlign:"left",width:"100%"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(240,165,0,0.15)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                <span style={{fontSize:28}}>⚡</span>
                <div>
                  <div style={{fontWeight:700,fontSize:16,color:G.gold,fontFamily:"sans-serif"}}>Gestion autonome</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontFamily:"sans-serif"}}>Je gère moi-même les confirmations</div>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                {["✓ Tu es à la fois Admin et Closer","✓ Idéal pour démarrer seul","✓ Accès complet à tout le tableau de bord"].map((f,i)=>(
                  <div key={i} style={{fontSize:11,color:"rgba(255,255,255,0.65)",fontFamily:"sans-serif"}}>{f}</div>
                ))}
              </div>
            </button>

            {/* Option 2: Je délègue à un Closer */}
            <button onClick={()=>handleGestion("delegue")}
              style={{background:"rgba(255,255,255,0.08)",border:"2px solid rgba(59,130,246,0.5)",borderRadius:16,padding:"20px 18px",cursor:"pointer",textAlign:"left",width:"100%"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(59,130,246,0.1)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.08)"}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                <span style={{fontSize:28}}>👥</span>
                <div>
                  <div style={{fontWeight:700,fontSize:16,color:"#93C5FD",fontFamily:"sans-serif"}}>Déléguer à un Closer</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontFamily:"sans-serif"}}>Un membre de l'équipe gère les confirmations</div>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                {["✓ Tu invites un Closer dédié","✓ Idéal si tu as une équipe","✓ Tu gardes la vue Admin complète"].map((f,i)=>(
                  <div key={i} style={{fontSize:11,color:"rgba(255,255,255,0.65)",fontFamily:"sans-serif"}}>{f}</div>
                ))}
              </div>
            </button>
          </div>

          <div style={{textAlign:"center",marginTop:16}}>
            <button onClick={()=>setAuthStep("plan")} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:11,cursor:"pointer",fontFamily:"sans-serif"}}>← Retour</button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE 3: Inviter l'équipe ── */}
      {authStep==="invite"&&(
        <div style={{width:"100%",maxWidth:380}}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:40,marginBottom:8}}>🎉</div>
            <div style={{fontSize:18,fontWeight:700,color:G.white,fontFamily:"sans-serif"}}>Compte créé !</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:6,fontFamily:"sans-serif"}}>
              {gestionMode==="solo" ? "Invite ton livreur pour commencer" : "Invite ton équipe en envoyant ces liens par WhatsApp"}
            </div>
          </div>

          {/* Badge mode choisi */}
          <div style={{background:gestionMode==="solo"?"rgba(240,165,0,0.15)":"rgba(59,130,246,0.15)",borderRadius:10,padding:"8px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:8,border:`1px solid ${gestionMode==="solo"?"rgba(240,165,0,0.3)":"rgba(59,130,246,0.3)"}`}}>
            <span style={{fontSize:16}}>{gestionMode==="solo"?"⚡":"👥"}</span>
            <div style={{fontSize:12,color:gestionMode==="solo"?G.gold:"#93C5FD",fontWeight:600,fontFamily:"sans-serif"}}>
              {gestionMode==="solo" ? "Mode Gestion autonome — tu es Admin + Closer" : "Mode Délégué — tu invites un Closer dédié"}
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {/* Closer — seulement si mode délégué */}
            {gestionMode==="delegue"&&(
              <div style={{background:"rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 16px",border:"1px solid rgba(59,130,246,0.3)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:15,color:"#93C5FD",fontFamily:"sans-serif"}}>📞 Closer</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2,fontFamily:"sans-serif"}}>Confirme les commandes et assigne les livreurs</div>
                  </div>
                </div>
                <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:"8px 10px",marginBottom:8,fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:"monospace",wordBreak:"break-all"}}>{inviteLink.closer}</div>
                <div style={{display:"flex",gap:6,marginBottom:12}}>
                  <button onClick={()=>navigator.clipboard?.writeText(inviteLink.closer).then(()=>alert("Lien copié !"))}
                    style={{flex:1,background:"rgba(255,255,255,0.15)",color:G.white,border:"none",borderRadius:8,padding:"8px 0",fontSize:12,cursor:"pointer",fontFamily:"sans-serif"}}>
                    📋 Copier
                  </button>
                  <button onClick={()=>{const msg=`Bonjour ! Je t'invite à rejoindre mon équipe sur Teamly en tant que Closer.\n\nClique ici:\n${inviteLink.closer}`;window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");}}
                    style={{flex:1,background:"#25D366",color:G.white,border:"none",borderRadius:8,padding:"8px 0",fontSize:12,cursor:"pointer",fontFamily:"sans-serif",fontWeight:600}}>
                    📲 WhatsApp
                  </button>
                </div>

                {/* Accès comptabilité pour le Closer */}
                <div style={{borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:12}}>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",fontWeight:600,fontFamily:"sans-serif",marginBottom:10}}>
                    🔐 Accès du Closer
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",opacity:isGratuit?0.5:1}}>
                    <div>
                      <div style={{fontSize:12,color:G.white,fontFamily:"sans-serif",fontWeight:600}}>📊 Voir la Comptabilité</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontFamily:"sans-serif",marginTop:2}}>{isGratuit?"🔒 Plan Basic requis":"Revenus, bénéfices, CA par produit"}</div>
                    </div>
                    <button onClick={()=>{if(isGratuit){setShowPlanModal(true);return;}const v=!settings.closerCompta;setSettings(s=>({...s,closerCompta:v}));try{localStorage.setItem(`teamly_cc_${orgId}`,String(v));}catch(e){}sbFetch(`organizations?id=eq.${orgId}`,"PATCH",{settings:{closerCompta:v}},_authToken).then(res=>{if(!res||(Array.isArray(res)&&res.length===0)){setSettings(s=>({...s,closerCompta:!v}));try{localStorage.setItem(`teamly_cc_${orgId}`,String(!v));}catch(e){}addToast("Erreur de sauvegarde — vérifie les règles Supabase","❌","#DC2626");}else{addToast(v?"✅ Closer peut voir la Compta (il doit actualiser son app)":"Accès Compta retiré","✅",v?G.green:"#6B7280");}}).catch(()=>{setSettings(s=>({...s,closerCompta:!v}));try{localStorage.setItem(`teamly_cc_${orgId}`,String(!v));}catch(e){}addToast("Erreur de sauvegarde — réessaie","❌","#DC2626");});}}
                      style={{background:isGratuit?"rgba(255,255,255,0.1)":settings.closerCompta?"#22C55E":"rgba(255,255,255,0.15)",border:"none",borderRadius:20,width:46,height:26,cursor:isGratuit?"not-allowed":"pointer",position:"relative",flexShrink:0,transition:"background 0.2s"}}>
                      <div style={{position:"absolute",top:3,left:(!isGratuit&&settings.closerCompta)?22:3,width:20,height:20,background:G.white,borderRadius:"50%",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.3)"}}/>
                    </button>
                  </div>
                  {!isGratuit&&settings.closerCompta&&(
                    <div style={{background:"rgba(34,197,94,0.15)",borderRadius:8,padding:"6px 10px",marginTop:6,border:"1px solid rgba(34,197,94,0.3)"}}>
                      <div style={{fontSize:11,color:"#86EFAC",fontFamily:"sans-serif"}}>✅ Le Closer verra un onglet Compta dans son dashboard</div>
                    </div>
                  )}
                  {isGratuit&&(
                    <div style={{background:"rgba(240,165,0,0.1)",borderRadius:8,padding:"6px 10px",marginTop:6,border:"1px solid rgba(240,165,0,0.25)"}}>
                      <div style={{fontSize:11,color:"#FCD34D",fontFamily:"sans-serif"}}>🔒 Passez au plan Basic pour activer cette option</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Livreur — toujours visible */}
            <div style={{background:"rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 16px",border:`1px solid ${G.greenMid}50`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:"#6EE7B7",fontFamily:"sans-serif"}}>🏍️ Livreur</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2,fontFamily:"sans-serif"}}>Effectue les livraisons et met à jour les statuts</div>
                </div>
              </div>
              <div style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:"8px 10px",marginBottom:8,fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:"monospace",wordBreak:"break-all"}}>{inviteLink.livreur}</div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>navigator.clipboard?.writeText(inviteLink.livreur).then(()=>alert("Lien copié !"))}
                  style={{flex:1,background:"rgba(255,255,255,0.15)",color:G.white,border:"none",borderRadius:8,padding:"8px 0",fontSize:12,cursor:"pointer",fontFamily:"sans-serif"}}>
                  📋 Copier
                </button>
                <button onClick={()=>{const msg=`Bonjour ! Je t'invite à rejoindre mon équipe sur Teamly en tant que Livreur.\n\nClique ici:\n${inviteLink.livreur}`;window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");}}
                  style={{flex:1,background:"#25D366",color:G.white,border:"none",borderRadius:8,padding:"8px 0",fontSize:12,cursor:"pointer",fontFamily:"sans-serif",fontWeight:600}}>
                  📲 WhatsApp
                </button>
              </div>
            </div>

            {/* Option gestion autonome (si mode délégué, rappeler l'option) */}
            {gestionMode==="delegue"&&(
              <div style={{background:"rgba(240,165,0,0.1)",borderRadius:14,padding:"12px 16px",border:"1px solid rgba(240,165,0,0.3)"}}>
                <div style={{fontWeight:700,fontSize:13,color:G.gold,fontFamily:"sans-serif",marginBottom:4}}>⚡ Gestion autonome</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginBottom:10,fontFamily:"sans-serif"}}>Tu peux aussi gérer les confirmations toi-même en attendant ton Closer.</div>
                <button onClick={()=>{setGestionMode("solo");}}
                  style={{width:"100%",background:"rgba(240,165,0,0.2)",color:G.gold,border:"1px solid rgba(240,165,0,0.4)",borderRadius:8,padding:"8px 0",fontSize:12,cursor:"pointer",fontFamily:"sans-serif",fontWeight:600}}>
                  ✅ Je gère moi-même les confirmations
                </button>
              </div>
            )}
          </div>

          <button onClick={()=>{setRole("admin");setTab("dashboard");}}
            style={{width:"100%",background:G.gold,color:G.dark,border:"none",borderRadius:12,padding:"14px 0",fontWeight:700,fontSize:15,cursor:"pointer",marginTop:16,fontFamily:"sans-serif"}}>
            Accéder à mon Dashboard →
          </button>
          <div style={{textAlign:"center",marginTop:10}}>
            <button onClick={()=>setAuthStep("gestion")} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:11,cursor:"pointer",fontFamily:"sans-serif"}}>← Retour</button>
          </div>
        </div>
      )}

      {/* ── ÉTAPE JOIN: Rejoindre une équipe ── */}
      {authStep==="join"&&(
        <div style={{width:"100%",maxWidth:360}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:18,fontWeight:700,color:G.white,fontFamily:"sans-serif"}}>Rejoindre une équipe</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:6,fontFamily:"sans-serif"}}>Complète ton profil pour commencer</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>

            {/* Lien d'invitation */}
            <div style={{background:"rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 14px",border:"1px solid rgba(255,255,255,0.15)"}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",fontFamily:"sans-serif",marginBottom:6}}>🔗 Lien d'invitation</div>
              <input type="text" placeholder="teamly.app/join?org=ABC&role=closer..." value={authForm.inviteUrl||""}
                onChange={e=>setAuthForm(p=>({...p,inviteUrl:e.target.value}))}
                style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,padding:"9px 12px",fontSize:11,color:G.white,outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}/>
              {/* Détecter le rôle depuis le lien */}
              {(authForm.inviteRole||authForm.inviteUrl)&&(
                <div style={{marginTop:8,background:"rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 12px",fontSize:12,fontFamily:"sans-serif"}}>
                  {(authForm.inviteRole==="closer"||authForm.inviteUrl?.includes("role=closer"))
                    ?<span style={{color:"#93C5FD",fontWeight:700}}>📞 Tu rejoins en tant que <strong>Closer</strong></span>
                    :(authForm.inviteRole==="livreur"||authForm.inviteUrl?.includes("role=livreur"))
                    ?<span style={{color:"#6EE7B7",fontWeight:700}}>🏍️ Tu rejoins en tant que <strong>Livreur</strong></span>
                    :<span style={{color:"rgba(255,255,255,0.5)"}}>Lien d'invitation détecté</span>
                  }
                </div>
              )}
            </div>

            {/* Séparateur */}
            <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontFamily:"sans-serif",fontWeight:600,letterSpacing:0.5}}>MON PROFIL</div>

            {/* Champs profil complets */}
            {[
              {key:"nom",      label:"👤 Prénom & Nom *",       ph:"Ibou Diallo",          type:"text",     ac:"name"},
              {key:"phone",    label:"📱 Numéro de téléphone *", ph:"77 123 45 67",         type:"tel",      ac:"tel"},
              {key:"email",    label:"📧 Email *",               ph:"ibou@exemple.com",     type:"email",    ac:"email"},
              {key:"adresse",  label:"📍 Quartier / Zone *",     ph:"Médina, Dakar",        type:"text",     ac:"street-address"},
              {key:"password", label:"🔒 Mot de passe *",        ph:"6 caractères minimum", type:"password", ac:"new-password"},
            ].map(f=>(
              <div key={f.key}>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginBottom:4,fontFamily:"sans-serif"}}>{f.label}</div>
                <input
                  type={f.type}
                  name={f.key}
                  autoComplete={f.ac}
                  value={authForm[f.key]||""}
                  onChange={e=>{const v=e.target.value; setAuthForm(p=>({...p,[f.key]:v}));}}
                  placeholder={f.ph}
                  style={{width:"100%",background:"rgba(255,255,255,0.1)",border:`1px solid rgba(255,255,255,${authForm[f.key]?"0.4":"0.15"})`,borderRadius:10,padding:"11px 14px",fontSize:13,color:G.white,outline:"none",boxSizing:"border-box",fontFamily:"sans-serif"}}/>
              </div>
            ))}

            {authError&&<div style={{fontSize:11,color:"#FCA5A5",fontFamily:"sans-serif",background:"rgba(220,38,38,0.15)",borderRadius:8,padding:"8px 12px"}}>{authError}</div>}

            <button onClick={async()=>{
              const missing = [];
              if(!authForm.nom?.trim()) missing.push("Nom");
              if(!authForm.phone?.trim()) missing.push("Téléphone");
              if(!authForm.email?.trim()) missing.push("Email");
              if(!authForm.adresse?.trim()) missing.push("Adresse");
              if(!authForm.password?.trim()) missing.push("Mot de passe");
              if(missing.length>0){ setAuthError("Champs manquants: "+missing.join(", ")); return; }
              if(authForm.password.length<6){setAuthError("Mot de passe trop court (6 min)");return;}
              const url = authForm.inviteUrl||"";
              const roleFromUrl = url.includes("role=closer")?"closer":url.includes("role=livreur")?"livreur":"livreur";
              setAuthError("");
              // Register with Supabase
              // Re-read URL params fresh to avoid stale state
              const freshParams = new URLSearchParams(window.location.search);
              const freshOrg   = freshParams.get("org")  || authForm.inviteOrg || "";
              const freshRole  = freshParams.get("role") || authForm.inviteRole || "";
              const detectedRole = freshRole || (url.includes("role=closer")?"closer":"livreur");
              const detectedOrg  = freshOrg;
              console.log("Join: detectedOrg=", detectedOrg, "detectedRole=", detectedRole);
              // Validate it's a UUID
              const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(detectedOrg);
              if(!isValidUUID) { 
                setAuthError(`Lien invalide (org="${detectedOrg}") — demande un nouveau lien à l'Admin`); 
                return; 
              }
              // ── Verificar límite del plan ANTES de registrar ──────────
              try {
                const limitRes = await fetch(`/.netlify/functions/check-member-limit?org=${detectedOrg}`);
                const limitData = await limitRes.json();
                if (limitRes.ok && !limitData.ok) {
                  setAuthError(`❌ Cette équipe a atteint sa limite (${limitData.max} membres). Demande à l'Admin de passer au plan supérieur.`);
                  return;
                }
              } catch(e) { /* si falla la comprobación, dejamos continuar */ }
              // ─────────────────────────────────────────────────────────────
              sbAuth(authForm.email, authForm.password, "register")
                .then(async(data)=>{
                  const tok=data.access_token;
                  _authToken = tok; setSbToken(tok);
                  // Create profile using user JWT (RLS: WITH CHECK id = auth.uid())
                  await sbFetch("profiles","POST",{
                    id:data.user.id,
                    org_id:detectedOrg,
                    nom:(authForm.nom||"").trim(),
                    phone:(authForm.phone||"").trim(),
                    email:(authForm.email||"").trim(),
                    adresse:(authForm.adresse||"").trim(),
                    role:detectedRole
                  });
                  // Set state
                  setCurrentUser({id:data.user.id,nom:authForm.nom,email:authForm.email,role:detectedRole});
                  setOrgId(detectedOrg);
                  setSbReady(true);
                  // Save session
                  try {
                    localStorage.setItem("teamly_token",tok);
                    if(data.refresh_token) localStorage.setItem("teamly_refresh_token",data.refresh_token);
                    localStorage.setItem("teamly_email",authForm.email);
                    localStorage.setItem("teamly_org",detectedOrg);
                  } catch(e){}
                  setRole(detectedRole);
                  setTab(detectedRole==="livreur"?"livraisons":"dashboard");
                  if(window.history) window.history.replaceState({},"",window.location.pathname);
                  // Force reload to ensure clean state
                  setTimeout(()=>window.location.reload(), 300);
                })
                .catch(e=>setAuthError(e.message||"Erreur inscription"));
            }} style={{background:G.gold,color:G.dark,border:"none",borderRadius:12,padding:"14px 0",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"sans-serif",marginTop:4}}>
              Rejoindre l'équipe →
            </button>

            <div style={{textAlign:"center"}}>
              <button onClick={()=>setAuthStep("login")} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:11,cursor:"pointer",fontFamily:"sans-serif"}}>← Retour</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: limite 2 appareils ── */}
      {deviceLimitModal&&(()=>{
        const fmtRel = (iso) => {
          if(!iso) return "—";
          const diff = Math.max(0, Date.now() - new Date(iso).getTime());
          const mins = Math.floor(diff/60000);
          if (mins < 1)   return "à l'instant";
          if (mins < 60)  return `il y a ${mins} min`;
          const hrs = Math.floor(mins/60);
          if (hrs < 24)   return `il y a ${hrs} h`;
          const days = Math.floor(hrs/24);
          return days < 7 ? `il y a ${days} j` : new Date(iso).toLocaleDateString("fr-FR");
        };
        const iconFor = (t) => t==="mobile" ? "📱" : t==="tablet" ? "📱" : "💻";
        const kick = async (sid) => {
          try {
            await fetch("/.netlify/functions/revoke-session", {
              method: "POST",
              headers: { "Content-Type":"application/json", "Authorization":`Bearer ${deviceLimitModal.token}` },
              body: JSON.stringify({ session_id: sid, by_fingerprint: deviceLimitModal.fingerprint }),
            });
            // Retry register-session — should succeed now (count = 1)
            const r = await fetch("/.netlify/functions/register-session", {
              method: "POST",
              headers: { "Content-Type":"application/json", "Authorization":`Bearer ${deviceLimitModal.token}` },
              body: JSON.stringify({ device_fingerprint: deviceLimitModal.fingerprint, device_info: getDeviceInfo() }),
            });
            const data = await r.json().catch(()=>({}));
            if (!data.ok) { addToast("Erreur — réessayez","❌","#DC2626"); return; }
            // Restore token + reload login to fetch profile
            _authToken = deviceLimitModal.token;
            setSbToken(deviceLimitModal.token);
            setDeviceFingerprint(deviceLimitModal.fingerprint);
            setDeviceLimitModal(null);
            addToast("✅ Connecté","✅","#1A5C38");
            // Trigger profile fetch via login retry — simplest: tell user to retry
            try { localStorage.setItem("teamly_token", deviceLimitModal.token); } catch(e){}
            window.location.reload();
          } catch(e) {
            addToast("Erreur réseau","❌","#DC2626");
          }
        };
        return (
        <div onClick={()=>setDeviceLimitModal(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:5000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"sans-serif"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:18,padding:"22px 20px",width:"100%",maxWidth:420,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 12px 40px rgba(0,0,0,0.4)"}}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:38,marginBottom:6}}>⚠️</div>
              <div style={{fontWeight:800,fontSize:17,color:"#0F1923",marginBottom:6}}>Limite de 2 appareils atteinte</div>
              <div style={{fontSize:12,color:"#6B7280",lineHeight:1.5}}>Vous êtes déjà connecté sur 2 appareils. Choisissez celui à déconnecter pour continuer :</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {(deviceLimitModal.sessions||[]).map(s=>(
                <div key={s.id} style={{border:"1px solid #E5E7EB",borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontSize:28,flexShrink:0}}>{iconFor(s.device_type)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#0F1923"}}>{s.device_name||"Appareil inconnu"}</div>
                    <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>{s.os||""}{s.location?` · ${s.location}`:""}</div>
                    <div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>Dernière activité : {fmtRel(s.last_active_at)}</div>
                  </div>
                  <button onClick={()=>kick(s.id)} style={{background:"#DC2626",color:"#fff",border:"none",borderRadius:9,padding:"8px 12px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>Déconnecter</button>
                </div>
              ))}
            </div>
            <button onClick={()=>{
              setDeviceLimitModal(null);
              _authToken = null; setSbToken(null);
              try { localStorage.removeItem("teamly_token"); localStorage.removeItem("teamly_refresh_token"); } catch(e){}
            }} style={{marginTop:14,width:"100%",background:"#F3F4F6",color:"#374151",border:"none",borderRadius:11,padding:"12px 0",fontWeight:600,fontSize:13,cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
        );
      })()}

      {/* ── Modal: kicked out ── */}
      {kickedOut&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,25,35,0.96)",zIndex:5500,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"sans-serif"}}>
          <div style={{maxWidth:380,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:54,marginBottom:14}}>🚪</div>
            <div style={{fontWeight:800,fontSize:22,color:"#fff",marginBottom:10}}>Vous avez été déconnecté</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.65)",lineHeight:1.6,marginBottom:24}}>Un autre appareil a pris votre place.<br/>Pour des raisons de sécurité, votre compte est limité à 2 appareils.</div>
            <button onClick={()=>{ setKickedOut(false); setAuthStep("login"); }}
              style={{background:"#F0A500",color:"#0F1923",border:"none",borderRadius:12,padding:"13px 32px",fontWeight:700,fontSize:14,cursor:"pointer"}}>
              Se reconnecter
            </button>
          </div>
        </div>
      )}

      {authStep==="verify-email"&&(()=>{
        const pending = (()=>{try{return JSON.parse(localStorage.getItem("teamly_pending_signup")||"null");}catch(e){return null;}})();
        const email   = authForm.email || pending?.email || "";

        const setBox = (i, v) => {
          const clean = (v||"").replace(/\D/g,"").slice(0,1);
          setOtpCode(prev=>{ const next=[...prev]; next[i]=clean; return next; });
          if(clean && i<5) document.getElementById(`otp-${i+1}`)?.focus();
        };
        const onPaste = (e) => {
          const txt = (e.clipboardData?.getData("text")||"").replace(/\D/g,"").slice(0,6);
          if(txt.length>=2){
            e.preventDefault();
            const arr = ["","","","","",""];
            for(let i=0;i<txt.length;i++) arr[i] = txt[i];
            setOtpCode(arr);
            const focusIdx = Math.min(txt.length, 5);
            setTimeout(()=>document.getElementById(`otp-${focusIdx}`)?.focus(), 0);
          }
        };
        const onKey = (i, e) => {
          if(e.key==="Backspace" && !otpCode[i] && i>0) document.getElementById(`otp-${i-1}`)?.focus();
        };

        const verifyCode = async () => {
          const token = otpCode.join("");
          if(token.length!==6) { setAuthError("Entre les 6 chiffres"); return; }
          if(!email) { setAuthError("Email manquant — recommence l'inscription"); return; }
          setOtpVerifying(true); setAuthError("");
          try {
            const r = await fetchWithTimeout(`${SB_URL}/auth/v1/verify`, {
              method:"POST",
              headers:{"Content-Type":"application/json","apikey":SB_KEY},
              body: JSON.stringify({email, token, type:"signup"}),
            }, 20000);
            const data = await r.json().catch(()=>({}));
            if(!r.ok || !data.access_token) {
              const msg = (data.error_description||data.msg||data.message||"").toLowerCase();
              setAuthError(msg.includes("expired") ? "Code expiré — demandez-en un nouveau" : msg.includes("invalid") || msg.includes("token") ? "Code incorrect, réessayez" : "Erreur de vérification, réessayez");
              setOtpVerifying(false); return;
            }
            const tok = data.access_token; _authToken = tok; setSbToken(tok);
            const userId = data.user?.id;
            const newOrgId = pending?.orgId || (crypto.randomUUID ? crypto.randomUUID() : `org_${Date.now()}`);
            const nom      = pending?.nom      || authForm.nom      || "Admin";
            const phone    = pending?.phone    || authForm.phone    || "";
            const boutique = pending?.boutique || authForm.boutique || "Ma Boutique";
            try {
              await sbFetch("organizations","POST",{id:newOrgId,name:boutique,whatsapp:phone});
              await sbFetch("profiles","POST",{id:userId,org_id:newOrgId,nom,phone,email,role:"admin"});
            } catch(e){ /* may already exist via realtime — ignore */ }
            setOrgId(newOrgId); setSbReady(true);
            setCurrentUser({id:userId, nom, email, role:"admin", phone});
            setSettings(s=>({...s,nom,whatsapp:phone,boutique}));
            setOrg({id:newOrgId,name:boutique,whatsapp:phone,plan:null});
            try {
              localStorage.setItem("teamly_token",tok);
              if(data.refresh_token) localStorage.setItem("teamly_refresh_token",data.refresh_token);
              localStorage.setItem("teamly_email",email);
              localStorage.setItem("teamly_org",newOrgId);
              localStorage.setItem("teamly_role","admin");
              localStorage.setItem("teamly_userId",userId||"");
              localStorage.setItem("teamly_nom",nom);
              localStorage.removeItem("teamly_pending_signup");
            } catch(e){}
            addToast("✅ Compte créé avec succès","✅","#1A5C38");
            setOtpCode(["","","","","",""]);
            setOtpVerifying(false);
            setAuthStep("plan");
          } catch(e) {
            setAuthError("Erreur réseau, réessayez");
            setOtpVerifying(false);
          }
        };

        const resendCode = () => {
          if(otpResendIn>0 || !email) return;
          setAuthError("");
          fetchWithTimeout(`${SB_URL}/auth/v1/resend`,{
            method:"POST",
            headers:{"Content-Type":"application/json","apikey":SB_KEY},
            body:JSON.stringify({type:"signup",email}),
          },15000)
            .then(()=>{ setAuthError("✓ Code renvoyé"); setOtpResendIn(60); const t=setInterval(()=>setOtpResendIn(s=>{ if(s<=1){clearInterval(t); return 0;} return s-1; }),1000); })
            .catch(()=>setAuthError("Erreur — réessayez dans quelques secondes"));
        };

        return (
        <div style={{minHeight:"100dvh",background:"#0F1923",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"sans-serif"}}>
          <div style={{width:"100%",maxWidth:400,display:"flex",flexDirection:"column",gap:18}}>
            <div style={{textAlign:"center",marginBottom:4}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:24}}>
                <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#1A5C38,#2E8B57)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20 7L12 3L4 7V17L12 21L20 17V7Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/></svg>
                </div>
                <span style={{color:"#fff",fontWeight:800,fontSize:22,letterSpacing:-0.5}}>Teamly</span>
              </div>
              <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(240,165,0,0.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px"}}>
                <span style={{fontSize:32}}>✉️</span>
              </div>
              <div style={{color:"#fff",fontWeight:800,fontSize:20,marginBottom:8}}>Vérifiez votre email</div>
              <div style={{color:"rgba(255,255,255,0.6)",fontSize:13,lineHeight:1.6}}>
                Nous avons envoyé un code à 6 chiffres à<br/>
                <span style={{color:"#F0A500",fontWeight:600}}>{email||"votre email"}</span>
              </div>
            </div>

            {/* OTP boxes */}
            <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:4}} onPaste={onPaste}>
              {otpCode.map((v,i)=>(
                <input key={i} id={`otp-${i}`}
                  inputMode="numeric" pattern="[0-9]*" maxLength={1} autoComplete="one-time-code"
                  value={v} onChange={e=>setBox(i,e.target.value)} onKeyDown={e=>onKey(i,e)}
                  style={{width:46,height:54,textAlign:"center",fontSize:22,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.08)",border:`1.5px solid ${authError.includes("incorrect")||authError.includes("expir")?"rgba(220,38,38,0.55)":"rgba(255,255,255,0.18)"}`,borderRadius:10,outline:"none",fontFamily:"sans-serif"}}/>
              ))}
            </div>

            {authError&&<div style={{background:authError.startsWith("✓")?"rgba(26,92,56,0.3)":"rgba(220,38,38,0.2)",border:`1px solid ${authError.startsWith("✓")?"rgba(26,92,56,0.5)":"rgba(220,38,38,0.4)"}`,borderRadius:10,padding:"10px 14px",color:authError.startsWith("✓")?"#4ADE80":"#FCA5A5",fontSize:12,textAlign:"center"}}>{authError}</div>}

            <button onClick={verifyCode} disabled={otpVerifying||otpCode.join("").length!==6}
              style={{background:otpVerifying||otpCode.join("").length!==6?"#A0845C":"#F0A500",color:"#0F1923",border:"none",borderRadius:12,padding:"13px 0",fontWeight:700,fontSize:14,cursor:otpVerifying||otpCode.join("").length!==6?"not-allowed":"pointer",fontFamily:"sans-serif"}}>
              {otpVerifying?"Vérification…":"Vérifier →"}
            </button>

            <div style={{textAlign:"center",fontSize:12,color:"rgba(255,255,255,0.55)",fontFamily:"sans-serif"}}>
              Pas reçu ?{" "}
              <button onClick={resendCode} disabled={otpResendIn>0}
                style={{background:"none",border:"none",color:otpResendIn>0?"rgba(255,255,255,0.3)":"#F0A500",fontSize:12,cursor:otpResendIn>0?"not-allowed":"pointer",fontFamily:"sans-serif",fontWeight:600,textDecoration:otpResendIn>0?"none":"underline"}}>
                {otpResendIn>0?`Renvoyer dans ${otpResendIn}s`:"Renvoyer le code"}
              </button>
            </div>

            <div style={{textAlign:"center"}}>
              <button onClick={()=>{setAuthStep("login");setAuthMode("register");setOtpCode(["","","","","",""]);setAuthError("");}}
                style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:11,cursor:"pointer",fontFamily:"sans-serif"}}>← Modifier l'email</button>
            </div>
          </div>
        </div>
        );
      })()}

    </div>
  );

  const pC = settings; // permisos closer
  const canEditStock        = role==="admin" || role==="closer";
  const canDeleteOrder      = role==="admin";
  const canManageTeam       = role==="admin";
  const canEditOrders = role==="admin" || role==="closer";
  const canSeeCompta  = role==="admin" || (role==="closer" && pC.closerCompta);

  const isOwner       = OWNER_EMAILS.includes(currentUser.email) || isOwnerOrg;
  const trialExpired  = !isOwner && !isPro && trialDaysLeft === 0;

  // ── Plan actif et feature gating ─────────────────────────────────────────
  const PLAN_ORDER_LIMITS = {gratuit:30, starter:30, trial:30, basic:100, pro:2000, scale:Infinity};
  const currentPlanKey    = settings.plan || "gratuit";
  const orderLimit        = isOwner ? Infinity : (PLAN_ORDER_LIMITS[currentPlanKey] ?? 30);
  const THIS_MONTH        = new Date().toISOString().slice(0,7);
  const ordersThisMonth   = orders.filter(o=>o.created_at?.slice(0,7)===THIS_MONTH).length;
  const orderLimitReached = !isOwner && isFinite(orderLimit) && ordersThisMonth >= orderLimit;
  const orderLimitWarning = !isOwner && isFinite(orderLimit) && ordersThisMonth >= Math.floor(orderLimit * 0.8);

  // Fonctions bloquées selon le plan (owner = accès complet toujours)
  const isGratuit     = !isOwner && !isPro;
  const canUseGPS     = isOwner || isPro;
  const canUseShopify = isOwner || isPro;
  const canUseCompta  = isOwner || (isPro && role!=="closer") || (role==="closer" && settings.closerCompta);
  const canUseAI      = isOwner || isPro;
  const canUseExport  = isOwner || ["pro","scale"].includes(currentPlanKey);
  const tabDefBase = {
    admin:   [{k:"dashboard",icon:"dashboard",l:"Dashboard"},...(canUseShopify?[{k:"boutique",icon:"boutique",l:"Cmdes à confirmer"}]:[]),{k:"commandes",icon:"commandes",l:"Cmdes à traiter"},...(canUseCompta?[{k:"compta",icon:"compta",l:"Compta"}]:[]),...(canUseGPS?[{k:"tracking",icon:"tracking",l:"Livreurs"}]:[]),{k:"clients",icon:"clients",l:"Clients"},{k:"chat",icon:"chat",l:"Messages"},{k:"stock",icon:"stock",l:"Produits"},{k:"frais",icon:"frais",l:"Frais livraison"}],
    closer:  [{k:"dashboard",icon:"dashboard",l:"Dashboard"},...(canUseShopify?[{k:"boutique",icon:"boutique",l:"Cmdes à confirmer"}]:[]),{k:"commandes",icon:"commandes",l:"Cmdes à traiter"},...(canUseGPS?[{k:"tracking",icon:"tracking",l:"Livreurs"}]:[]),{k:"clients",icon:"clients",l:"Clients"},{k:"stock",icon:"stock",l:"Produits"},{k:"chat",icon:"chat",l:"Équipe Chat"},{k:"equipe",icon:"equipe",l:"Équipe"},...(canUseCompta?[{k:"compta",icon:"compta",l:"Compta"}]:[])],
    livreur: [{k:"livraisons",icon:"livraisons",l:"Livraisons"},{k:"chat",icon:"chat",l:"Équipe Chat"},{k:"dashboard",icon:"dashboard",l:"Dashboard"},{k:"equipe",icon:"equipe",l:"Équipe"},...(canUseGPS?[{k:"position",icon:"position",l:"Localisation"}]:[])],
  };
  // Quand le trial expire → bloquer tout pour tous les rôles
  const tabDef = trialExpired
    ? {admin:[], closer:[], livreur:[]}
    : tabDefBase;
  const rlabel={admin:`👑 ${settings.nom||currentUser.nom}`,closer:`📞 ${currentUser.nom||"Closer"} · ${settings.boutique||""}`,livreur:`🏍️ ${currentUser.nom||"Livreur"} · ${settings.boutique||""}`};



  // ── Notifications ──
  // Alerts — séparées par rôle
  const adminAlerts = [
    // Commandes sans livreur
    ...orders.filter(o=>!o.livreur&&o.status==="confirmado").map(o=>({type:"sans_livreur",msg:`${o.client} — sans livreur`,sub:"Assigne un livreur pour cette commande",id:o.id,color:"#F0A500",bg:"#FFF8E7",icon:"🏍️",phone:o.phone})),
    // Livrées récemment
    ...orders.filter(o=>o.status==="entregado").slice(-3).map(o=>({type:"livre",msg:`${o.client} — Livré ✅`,sub:`${Number(o.price).toLocaleString("fr-FR")} CFA encaissé`,id:o.id,color:G.green,bg:G.greenLight,icon:"✅",phone:o.phone})),
    // Rejetées
    ...orders.filter(o=>o.status==="rechazado").map(o=>({type:"rejet",msg:`${o.client} — Rejeté ❌`,sub:"Relancer le client ou clôturer",id:o.id,color:G.red,bg:"#FEE2E2",icon:"❌",phone:o.phone})),
    // Stock bas
    ...products.filter(p=>p.stock<5).map(p=>({type:"stock",msg:`Stock bas: ${p.name}`,sub:`${p.stock} unités restantes`,id:p.id,color:G.red,bg:"#FEE2E2",icon:"📦"})),
  ];
  // While settings.zones_configured===false, every order display is overridden
  // with the default fee (2500 main / 4000 other) + warning, mirroring what the
  // webhook stores. Once admin saves zones, the real o.frais_liv is shown.
  // Treat as configured if any of:
  //   - zones_configured === true (admin actually saved zones)
  //   - fraisWarningDismissed === true (persisted on first ⚙️ click)
  //   - zoneBannersDismissed (session-level fallback)
  const fraisDisplay = (o) => {
    const treatAsConfigured = settings?.zones_configured === true
      || settings?.fraisWarningDismissed === true
      || zoneBannersDismissed;
    const txt    = `${o.address||""} ${o.unmatched_city||""} ${o.unmatched_region||""}`.toLowerCase();
    const isMain = /dakar/.test(txt);
    const def    = isMain ? (parseInt(settings?.defaultMainPrice)||2500) : (parseInt(settings?.defaultOtherPrice)||4000);
    if (treatAsConfigured) {
      const v = o.frais_liv != null ? o.frais_liv : def;
      return { fee: v, label: `${fmt(v)} F`, warning: false };
    }
    return { fee: def, label: `${fmt(def)} F`, warning: true };
  };

  // Open Frais de livraison + persist the dismiss so warnings never come back
  // (banner + per-order ⚠️) until admin actually configures zones (which would
  // flip zones_configured anyway).
  const openFraisAndDismiss = () => {
    setZoneBannersDismissed(true);
    setTab("frais");
    if (!settings?.fraisWarningDismissed && orgId) {
      const newSettings = { ...(settings||{}), fraisWarningDismissed: true };
      setSettings(newSettings);
      sbFetch(`organizations?id=eq.${orgId}`, "PATCH", { settings: newSettings }).catch(()=>{});
    }
  };

  const livreurAlerts = [
    ...myLiv.filter(o=>o.status==="colis_pris").map(o=>({type:"recuperer",msg:`📦 ${o.client}`,sub:`Prêt à livrer — ${fmt(o.price)} CFA`,address:o.address,phone:o.phone,price:o.price,product:o.product,id:o.id,color:G.green,bg:G.greenLight,icon:"📦"})),
    ...myLiv.filter(o=>o.status==="en_camino").map(o=>({type:"pedido",msg:`🚀 ${o.client}`,sub:`En route — ${fmt(o.price)} CFA`,address:o.address,phone:o.phone,price:o.price,product:o.product,id:o.id,color:"#0284C7",bg:"#EFF6FF",icon:"🚀"})),
    ...myLiv.filter(o=>o.status==="confirmado").map(o=>({type:"nouveau",msg:`🔔 Nouveau colis : ${o.client}`,sub:`${o.product} — ${fmt(o.price)} CFA`,address:o.address,phone:o.phone,price:o.price,product:o.product,id:o.id,color:G.gold,bg:"#FFF8E7",icon:"🔔"})),
    ...myLiv.filter(o=>o.status==="livreur_en_route").map(o=>({type:"route",msg:`🏍️ ${o.client}`,sub:`Je pars récupérer — ${o.address}`,address:o.address,phone:o.phone,price:o.price,product:o.product,id:o.id,color:"#7C3AED",bg:"#EDE9FE",icon:"🏍️"})),
  ];
  const alerts = role==="livreur" ? livreurAlerts : adminAlerts;
  const alertCount = alerts.length + dbNotifs.length;

  // ── Filtered orders ──
  const allOrders = showArchived ? orders.filter(o=>o.archived) : orders.filter(o=>!o.archived);
  const baseOrders = role==="livreur" ? allOrders.filter(o=>o.livreur_id===currentUser.id&&o.status!=="confirmado") : allOrders;
  const _now       = new Date();
  const _pad       = n => String(n).padStart(2,"0");
  const TODAY_STR  = `${_now.getFullYear()}-${_pad(_now.getMonth()+1)}-${_pad(_now.getDate())}`;
  const _yest      = new Date(_now); _yest.setDate(_yest.getDate()-1);
  const YESTERDAY  = `${_yest.getFullYear()}-${_pad(_yest.getMonth()+1)}-${_pad(_yest.getDate())}`;
  // Monday of the current week (local time)
  const _mon       = new Date(_now); _mon.setDate(_now.getDate() - ((_now.getDay()+6)%7));
  const WEEK_START = `${_mon.getFullYear()}-${_pad(_mon.getMonth()+1)}-${_pad(_mon.getDate())}`;
  const filteredOrders = baseOrders.filter(o=>{
    const matchSearch = !searchQuery || o.client?.toLowerCase().includes(searchQuery.toLowerCase()) || o.phone?.includes(searchQuery) || o.product?.toLowerCase().includes(searchQuery.toLowerCase());
    const d = o.created_at ? (() => { const dt=new Date(o.created_at); return `${dt.getFullYear()}-${_pad(dt.getMonth()+1)}-${_pad(dt.getDate())}`; })() : "";
    const matchDate = filterDate==="all" || (filterDate==="today"&&d===TODAY_STR) || (filterDate==="yesterday"&&d===YESTERDAY) || (filterDate==="week"&&d>=WEEK_START);
    if(role==="livreur") {
      // Pedidos hors zone principale: visibles de paiement_confirme à remis_transporteur (livreur garde la trace)
      if(o.region_type==="other") {
        const VISIBLE_OTHER = new Set(["paiement_confirme","colis_en_main","en_route","remis_transporteur"]);
        if(!VISIBLE_OTHER.has(o.status)) return false;
      }
      const hasResult  = livResultFilter.length>0;
      const hasTournee = filterStatus!=="all";
      if(hasResult)  return matchDate && matchSearch && livResultFilter.includes(o.status);
      if(hasTournee) return matchDate && matchSearch && o.status===filterStatus;
      return matchDate && matchSearch;
    }
    const LIVRAISON_STATUTS = ["livreur_en_route","colis_pris","en_camino","chez_client"];
    const matchStatus = filterStatus==="all" || (filterStatus==="livraison" ? LIVRAISON_STATUTS.includes(o.status) : o.status===filterStatus);
    const matchLivreur = filterLivreur==="all" || o.livreur===filterLivreur;
    return matchSearch && matchStatus && matchLivreur && matchDate;
  });

  const SIDEBAR_W = 280;
  const isWide = isDesktop && screenW >= 1400;

  // Context value for extracted components (OCard, etc.). Listed exhaustively
  // so consumers don't need to receive a long prop list.
  const appCtx = {
    // module-level constants/helpers (re-exposed so child files don't import them)
    G, fmt, pct, STATUS, parseProd, FRAIS_LIV, TODAY, ST, Tbl, sbFetch, fmtCity,
    localDateStr,
    _COMPTA_FILTERS_DEFAULT,
    // state
    role, currentUser, settings, orders, products, teamMembers, orgId,
    canUseExport,
    clientCat, clientDate, clientLoading, showClientDetail,
    mainRegion, otherRegions,
    openModifId, pinnedOrderIds, waSentIds,
    expandedProd, stockAjout,
    // compta state
    comptaFilters, comptaFiltersOpen, comptaPeriodMode, comptaShortcut,
    dateFrom, dateTo, comptaExpandedProd, comptaCostEdit, comptaExportOpen,
    adSpend, livraisonsEchouees, cashRemis,
    // compta derived
    comptaOrders, comptaCalcProd, comptaCA, comptaBen, comptaCamv, comptaFrais,
    comptaPub, comptaMarge,
    // frais state
    fraisConfigTab, fraisMainNameEdit, fraisEditCity, fraisNewMain, fraisNewOther,
    fraisTableauSearch, fraisTableauFilter, fraisTestCity,
    // actions / setters
    setOpenModifId, setOrderDetail, setWaSentIds, setConflictDelivery,
    setLivFinalNote, setLivFinalConfirm, setNoteModal, setNoteText, setEditOrder,
    setProducts, setExpandedProd, setStockAjout, setShowAddProd,
    setComptaFilters, setComptaFiltersOpen, setComptaPeriodMode, setComptaShortcut,
    setDateFrom, setDateTo, setComptaExpandedProd, setComptaCostEdit, setComptaExportOpen,
    setAdSpend, setLivraisonsEchouees, setCashRemis,
    setMainRegion, setOtherRegions, setSettings, setConfirmModal,
    setClientCat, setClientDate, setClientLoading, setShowClientDetail, setShowPlanModal,
    setFraisConfigTab, setFraisMainNameEdit, setFraisEditCity, setFraisNewMain, setFraisNewOther,
    setFraisTableauSearch, setFraisTableauFilter, setFraisTestCity,
    upSt, addToast,
  };

  return (
    <AppContext.Provider value={appCtx}>
    <div style={{minHeight:"100vh",background:G.grayLight,fontFamily:"'Helvetica Neue',sans-serif",maxWidth:isDesktop?"none":480,margin:isDesktop?"0":"0 auto",display:isDesktop?"flex":"block"}}>
      <style>{`@keyframes candleGlow{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.45;transform:scale(0.78)}}.soft-pulse{animation:candleGlow 3.5s ease-in-out infinite}@keyframes stepPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 var(--sc,rgba(46,139,87,0.35))}50%{transform:scale(1.13);box-shadow:0 0 0 5px rgba(0,0,0,0)}}.step-active{animation:stepPulse 3.5s ease-in-out infinite}@keyframes pinCandle{0%,100%{box-shadow:0 0 4px 2px rgba(240,165,0,0.5)}50%{box-shadow:0 0 10px 4px rgba(240,165,0,0.85)}}.pin-glow{animation:pinCandle 3.5s ease-in-out infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* ── PAYWALL — trial expiré ── */}
      {trialExpired&&(()=>{
        const PLANS_PAY = PLANS.filter(p=>p.key!=="gratuit").map(p=>({
          key:p.key, name:p.name, price:p.priceNum, priceLabel:p.price.replace(" CFA",""),
          tag:p.tag, features:p.features,
          highlight:p.key==="basic",
        }));
        return (
          <div style={{position:"fixed",inset:0,background:"linear-gradient(160deg,#0D1F14 0%,#1A3828 100%)",zIndex:9000,overflowY:"auto",padding:"24px 16px"}}>
            <div style={{maxWidth:480,margin:"0 auto"}}>
              {/* Logo */}
              <div style={{textAlign:"center",marginBottom:24}}>
                <div style={{display:"inline-flex",background:"rgba(255,255,255,0.07)",borderRadius:14,padding:"10px 20px"}}>
                  <TeamlyLogo size={1}/>
                </div>
              </div>

              {/* Titre */}
              <div style={{textAlign:"center",marginBottom:24}}>
                <div style={{fontSize:11,letterSpacing:2,color:"rgba(255,255,255,0.45)",fontWeight:600,marginBottom:8}}>PÉRIODE D'ESSAI TERMINÉE</div>
                <div style={{fontWeight:800,fontSize:22,color:"#FFF",marginBottom:6}}>Choisissez votre plan</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.55)"}}>L'accès est suspendu pour toute votre équipe</div>
              </div>

              {/* Plan Starter — rappel gratuit */}
              <div style={{background:"rgba(255,255,255,0.06)",borderRadius:16,padding:"14px 18px",marginBottom:12,border:"1px solid rgba(255,255,255,0.08)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"rgba(255,255,255,0.5)",letterSpacing:0.5}}>STARTER — ESSAI GRATUIT</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",marginTop:3}}>3 membres · 100 commandes/mois · 14 jours</div>
                  </div>
                  <div style={{fontWeight:800,fontSize:18,color:"rgba(255,255,255,0.3)"}}>0 CFA</div>
                </div>
              </div>

              {/* Plans payants */}
              {PLANS_PAY.map(p=>(
                <div key={p.key} style={{background:p.highlight?"#FFF":"rgba(255,255,255,0.04)",borderRadius:18,overflow:"hidden",marginBottom:12,border:p.highlight?`2px solid ${G.gold}`:"1px solid rgba(255,255,255,0.1)",boxShadow:p.highlight?"0 20px 60px rgba(0,0,0,0.4)":"none"}}>
                  {p.highlight&&(
                    <div style={{background:G.gold,padding:"6px 18px",fontSize:10,fontWeight:800,color:"#1A1A1A",letterSpacing:1.5}}>RECOMMANDÉ</div>
                  )}
                  <div style={{padding:"20px 22px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                      <div>
                        <div style={{fontWeight:800,fontSize:16,color:p.highlight?G.dark:"#FFF",letterSpacing:0.3}}>{p.name}</div>
                        <div style={{fontSize:12,color:p.highlight?G.gray:"rgba(255,255,255,0.4)",marginTop:2}}>{p.members} · {p.orders}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontWeight:800,fontSize:26,color:p.highlight?G.green:G.gold,lineHeight:1}}>{p.priceLabel}</div>
                        <div style={{fontSize:11,color:p.highlight?G.gray:"rgba(255,255,255,0.4)"}}>CFA / mois</div>
                      </div>
                    </div>

                    <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:18}}>
                      {p.features.map(f=>(
                        <div key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:p.highlight?G.dark:"rgba(255,255,255,0.7)"}}>
                          <div style={{width:5,height:5,borderRadius:"50%",background:p.highlight?G.green:G.gold,flexShrink:0}}/>
                          {f}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={()=>startWavePayment(p.price, p.key)}
                      disabled={!!payLoading}
                      style={{width:"100%",background:payLoading===p.key?"#9CA3AF":p.highlight?G.green:"rgba(240,165,0,0.15)",color:p.highlight?"#FFF":G.gold,border:p.highlight?"none":`1px solid ${G.gold}`,borderRadius:11,padding:"13px 0",fontWeight:700,fontSize:14,cursor:payLoading?"not-allowed":"pointer",letterSpacing:0.3}}>
                      {payLoading===p.key?"Connexion Wave...":`Choisir ${p.name} — ${p.priceLabel} CFA`}
                    </button>
                  </div>
                </div>
              ))}

              <div style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.25)",marginTop:8}}>
                Paiement sécurisé via Wave · Sans engagement
              </div>
              <button onClick={()=>window.location.reload()} style={{width:"100%",background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 0",fontSize:12,cursor:"pointer",marginTop:8,marginBottom:24}}>
                J'ai déjà payé — Actualiser
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── BANNIÈRE EMAIL NON CONFIRMÉ (dismissible) ── */}
      {currentUser.email && !currentUser.email_confirmed_at && !emailBannerDismissed && (
        <div style={{background:"#FFF4D6",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexShrink:0,borderBottom:"1px solid rgba(0,0,0,0.05)"}}>
          <div style={{fontSize:12,color:G.green,fontWeight:500,flex:1}}>
            📧 Vérifie ton email pour sécuriser ton compte
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
            <button onClick={async()=>{
              try {
                await fetch(`${SB_URL}/auth/v1/resend`,{method:"POST",headers:{"Content-Type":"application/json","apikey":SB_KEY},body:JSON.stringify({type:"signup",email:currentUser.email})});
                addToast("✅ Email de vérification renvoyé","✅",G.green);
              } catch(e) { addToast("Erreur — réessaie","❌",G.red); }
            }} style={{background:G.green,color:"#FFF",border:"none",borderRadius:6,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Renvoyer</button>
            <button onClick={()=>{ setEmailBannerDismissed(true); try{localStorage.setItem("teamly_email_banner_dismissed","1");}catch(e){} }}
              style={{background:"none",border:"none",color:G.green,fontSize:18,cursor:"pointer",lineHeight:1,padding:"0 4px"}}>×</button>
          </div>
        </div>
      )}

      {/* ── BANNIÈRE TRIAL (derniers 3 jours) ── */}
      {!isPro&&!trialExpired&&trialDaysLeft<=3&&(
        <div style={{background:G.green,padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexShrink:0}}>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.9)",fontWeight:500}}>
            <strong style={{color:"#F0A500"}}>{trialDaysLeft} jour{trialDaysLeft>1?"s":""}</strong> d'essai restants
          </div>
          <button onClick={()=>startWavePayment(14000,"pro")} disabled={!!payLoading}
            style={{background:"#F0A500",color:"#FFF",border:"none",borderRadius:8,padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,letterSpacing:0.2}}>
            {payLoading?"...":"Passer Pro — 14 000 CFA/mois"}
          </button>
        </div>
      )}

      {/* Sidebar overlay — mobile uniquement */}
      {!isDesktop&&sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200}}/>}

      {/* Sidebar */}
      <div style={{
        position:isDesktop?"sticky":"fixed",
        top:0, left:0, bottom:isDesktop?undefined:0,
        width:SIDEBAR_W,
        height:isDesktop?"100vh":undefined,
        background:G.green,
        zIndex:201,
        transform:isDesktop?"none":sidebarOpen?"translateX(0)":"translateX(-100%)",
        transition:"transform 0.28s ease",
        display:"flex", flexDirection:"column",
        flexShrink:0,
        boxShadow:isDesktop?"2px 0 20px rgba(0,0,0,0.15)":"4px 0 20px rgba(0,0,0,0.3)",
        overflowY:"auto",
      }}>
        {/* Sidebar header */}
        <div style={{padding:"20px 18px 16px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
          <TeamlyLogo size={1.05}/>
          <div style={{color:"rgba(255,255,255,0.5)",fontSize:11,marginTop:2}}>{rlabel[role]}</div>
          <div style={{marginTop:8,background:"rgba(255,255,255,0.1)",borderRadius:8,padding:"5px 10px",display:"inline-block"}}>
            <span style={{fontSize:10,color:G.gold,fontWeight:700}}>{settings.boutique}</span>
          </div>
        </div>

        {/* Nav links */}
        <div style={{flex:1,overflowY:"auto",padding:"10px 0"}}>
          {/* Super-admin link — visible uniquement pour le propriétaire */}
          {currentUser.email===OWNER_EMAIL&&(
            <button onClick={()=>{setTab("superadmin");setSidebarOpen(false);}}
              style={{width:"100%",background:tab==="superadmin"?"rgba(240,165,0,0.15)":"none",border:"none",borderLeft:`3px solid ${tab==="superadmin"?G.gold:"transparent"}`,padding:"12px 18px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:18,transition:"background 0.15s"}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tab==="superadmin"?G.gold:"rgba(255,255,255,0.7)"} strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span style={{fontSize:13,fontWeight:tab==="superadmin"?700:400,color:tab==="superadmin"?G.gold:"rgba(255,255,255,0.85)",letterSpacing:0.3}}>Mes Clients</span>
              <span style={{background:"#F0A500",color:"#000",borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:800}}>OWNER</span>
            </button>
          )}
          {tabDef[role].map(t=>{
            const isActive = tab===t.k;
            return (
            <button key={t.k} onClick={()=>{setTab(t.k);setSidebarOpen(false);}}
              style={{width:"100%",background:isActive?"rgba(240,165,0,0.15)":"none",border:"none",borderLeft:`3px solid ${isActive?G.gold:"transparent"}`,padding:"12px 18px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:18,transition:"background 0.15s"}}>
              <NavIcon name={t.icon} size={20} color={isActive?G.gold:"rgba(255,255,255,0.7)"}/>
              <span style={{fontSize:13,fontWeight:isActive?700:400,color:isActive?G.gold:"rgba(255,255,255,0.85)",letterSpacing:0.3,flex:1}}>{t.l}</span>
              {t.k==="notifications"&&alertCount>0&&<span style={{background:G.red,color:G.white,borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{alertCount}</span>}
              {t.k==="chat"&&chatUnread>0&&<span style={{background:"#25D366",color:G.white,borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{chatUnread}</span>}
              {t.k==="boutique"&&(()=>{const cnt=orders.filter(o=>o.status==="boutique").length;return cnt>0?<span style={{background:G.gold,color:G.dark,borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{cnt}</span>:null;})()}
              {t.k==="commandes"&&(()=>{const cnt=orders.filter(o=>o.status==="confirmado"&&!o.livreur&&(role!=="closer"||o.closer_id!==currentUser.id)).length;return cnt>0?<span style={{background:"#EF4444",color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{cnt}</span>:null;})()}
              {t.k==="livraisons"&&(()=>{const cnt=orders.filter(o=>o.livreur_id===currentUser.id&&!["entregado","rechazado"].includes(o.status)).length;return cnt>0?<span style={{background:"#0284C7",color:G.white,borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{cnt}</span>:null;})()}
            </button>
            );
          })}

          {/* Équipe — admin sidebar shortcut */}
          {role==="admin"&&(
            <button onClick={()=>{setTab("equipe");setSidebarOpen(false);}}
              style={{width:"100%",background:tab==="equipe"?"rgba(240,165,0,0.15)":"none",border:"none",borderLeft:`3px solid ${tab==="equipe"?G.gold:"transparent"}`,padding:"12px 18px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:18,transition:"background 0.15s"}}>
              <NavIcon name="equipe" size={20} color={tab==="equipe"?G.gold:"rgba(255,255,255,0.7)"}/>
              <span style={{fontSize:13,fontWeight:tab==="equipe"?700:400,color:tab==="equipe"?G.gold:"rgba(255,255,255,0.85)",letterSpacing:0.3}}>Équipe</span>
            </button>
          )}

          {/* Tabs bloqués — plan gratuit */}
          {isGratuit&&(()=>{
            const LOCKED_TABS = [
              ...((role==="admin"||role==="closer") ? [{k:"boutique",icon:"boutique",l:"Boutique en ligne"}] : []),
              ...((role==="admin"||role==="closer") ? [{k:"compta",icon:"compta",l:"Comptabilité & marges"}] : []),
              ...(role==="admin" ? [{k:"tracking",icon:"tracking",l:"Suivi Livreurs"}] : []),
              ...(role==="livreur" ? [{k:"position",icon:"position",l:"GPS temps réel"}] : []),
            ].filter(t => !tabDef[role]?.find(x=>x.k===t.k));
            if(!LOCKED_TABS.length) return null;
            return (
              <div style={{marginTop:6,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:6}}>
                <div style={{padding:"6px 18px",fontSize:9,letterSpacing:1.5,color:"rgba(255,255,255,0.25)",fontWeight:700}}>PLAN BASIC</div>
                {LOCKED_TABS.map(t=>(
                  <button key={t.k} onClick={()=>{setShowPlanModal(true);setSidebarOpen(false);}}
                    style={{width:"100%",background:"none",border:"none",borderLeft:"3px solid transparent",padding:"10px 18px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:18,opacity:0.45}}>
                    <NavIcon name={t.icon} size={20} color="rgba(255,255,255,0.5)"/>
                    <span style={{fontSize:13,color:"rgba(255,255,255,0.6)",flex:1,letterSpacing:0.3}}>{t.l}</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Bottom actions */}
        <div style={{padding:"10px 12px",borderTop:"1px solid rgba(255,255,255,0.1)",display:"flex",flexDirection:"column",gap:6}}>
          <button onClick={()=>{setProfileEdit({nom:currentUser.nom||"",phone:currentUser.phone||"",birthday:currentUser.birthday||""});setShowSettings(true);setSidebarOpen(false);}} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:9,padding:"10px 14px",cursor:"pointer",textAlign:"left",color:G.white,fontSize:13,display:"flex",alignItems:"center",gap:8}}>
            ⚙️ <span>Paramètres</span>
          </button>
          <button onClick={()=>{
            try{localStorage.removeItem("teamly_token");localStorage.removeItem("teamly_email");localStorage.removeItem("teamly_org");localStorage.removeItem("teamly_role");localStorage.removeItem("teamly_userId");localStorage.removeItem("teamly_nom");}catch(e){}
            _authToken = null;
            setRole(null);setSbToken(null);setOrgId(null);setSbReady(false);setOrders([]);setProducts([]);setChat([]);
          }} style={{background:"rgba(220,38,38,0.15)",border:"none",borderRadius:9,padding:"10px 14px",cursor:"pointer",textAlign:"left",color:"#FCA5A5",fontSize:13,display:"flex",alignItems:"center",gap:8}}>
            🚪 <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* ── Main content wrapper (flex:1 on desktop) ── */}
      <div style={{flex:isDesktop?1:"none",minWidth:0,display:"flex",flexDirection:"column",minHeight:isDesktop?"100vh":"auto"}}>

      {/* Header */}
      <div style={{background:G.green,padding:isDesktop?"16px 32px":"13px 18px",paddingTop:isDesktop?"16px":"calc(13px + env(safe-area-inset-top, 0px))",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {!isDesktop&&<button onClick={()=>setSidebarOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",flexDirection:"column",gap:4}}>
            <div style={{width:20,height:2,background:G.white,borderRadius:2}}/>
            <div style={{width:20,height:2,background:G.white,borderRadius:2}}/>
            <div style={{width:14,height:2,background:G.white,borderRadius:2}}/>
          </button>}
          {!isDesktop&&<TeamlyLogo size={0.85}/>}
          {isDesktop&&<div>
            <div style={{fontWeight:800,fontSize:18,color:G.white,letterSpacing:0.3}}>{
              tab==="dashboard"?"Dashboard":tab==="boutique"?"Commandes Boutique":tab==="commandes"?"Commandes à traiter":tab==="compta"?"Comptabilité":tab==="tracking"?"Suivi Livreurs":tab==="clients"?"Clients":tab==="chat"?"Messages":tab==="equipe"?"Équipe":tab==="stock"?"Produits":tab==="frais"?"Frais de livraison":"Teamly"
            }</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:1}}>{settings.boutique}</div>
          </div>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {(role==="admin"||role==="closer")&&tab==="commandes"&&(
            <button
              onClick={()=>{ if(orderLimitReached){addToast(`Limite ${orderLimit} commandes/mois atteinte — passez au plan supérieur`,"🔒","#DC2626");return;} setShowAdd(true); }}
              style={{background:orderLimitReached?"rgba(255,255,255,0.15)":G.gold,border:"none",borderRadius:10,padding:"8px 14px",cursor:orderLimitReached?"not-allowed":"pointer",fontWeight:700,fontSize:12,color:orderLimitReached?"rgba(255,255,255,0.6)":G.dark,letterSpacing:0.2,flexShrink:0}}
              title={orderLimitReached?`Limite de ${orderLimit} commandes/mois atteinte`:""}>
              {orderLimitReached?"Limite":"+ Commande"}
            </button>
          )}
          {role==="admin"&&tab==="stock"&&(
            <button onClick={()=>setShowAddProd(true)} style={{background:G.gold,border:"none",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontWeight:700,fontSize:12,color:G.dark,letterSpacing:0.2}}>+ Produit</button>
          )}
          <button onClick={()=>setShowSearch(s=>!s)} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:10,width:36,height:36,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg viewBox="0 0 24 24" width={18} height={18} stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
          </button>
          <div style={{position:"relative",flexShrink:0}}>
            <button onClick={()=>setShowNotifPanel(v=>!v)} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:10,width:36,height:36,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <NavIcon name="notifications" size={18} color="#fff"/>
            </button>
            {dbNotifs.length>0&&<div style={{position:"absolute",top:-3,right:-3,background:G.red,color:G.white,borderRadius:"50%",minWidth:16,height:16,padding:"0 3px",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",boxSizing:"border-box"}}>{dbNotifs.length}</div>}
          </div>
        </div>
      </div>

      {/* Notification panel */}
      {showNotifPanel&&(
        <div style={{position:"fixed",top:56,right:12,width:310,background:"#fff",borderRadius:16,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",zIndex:9999,overflow:"hidden",border:"1px solid #E5E7EB"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #F3F4F6",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontWeight:700,fontSize:14,color:G.dark}}>🔔 Notifications</span>
            <button onClick={()=>setShowNotifPanel(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:G.gray}}>✕</button>
          </div>
          <div style={{maxHeight:360,overflowY:"auto"}}>
            {dbNotifs.length===0?(
              <div style={{padding:28,textAlign:"center",color:G.gray,fontSize:13}}>Aucune notification</div>
            ):dbNotifs.map(n=>(
              <div key={n.id} style={{padding:"12px 16px",borderBottom:"1px solid #F9FAFB",display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:22,flexShrink:0}}>{n.type==="delivered"?"✅":n.type==="rejected"?"❌":n.type==="nouveau_colis"?"🔔":n.type==="status_update"?"📦":"🔔"}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:G.dark}}>{n.title}</div>
                  {n.body&&<div style={{fontSize:11,color:G.gray,marginTop:2}}>{n.body}</div>}
                </div>
                <button onClick={()=>{dismissNotif(n.id);sbFetch(`notifications?id=eq.${n.id}`,"PATCH",{read:true}).catch(()=>{});setDbNotifs(p=>p.filter(x=>x.id!==n.id));}} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#9CA3AF",flexShrink:0,padding:2}}>✕</button>
              </div>
            ))}
          </div>
          {dbNotifs.length>0&&<div style={{padding:"10px 16px",borderTop:"1px solid #F3F4F6",textAlign:"center"}}>
            <button onClick={()=>{dbNotifs.forEach(n=>{dismissNotif(n.id);sbFetch(`notifications?id=eq.${n.id}`,"PATCH",{read:true}).catch(()=>{});});setDbNotifs([]);setShowNotifPanel(false);}} style={{background:"none",border:"none",color:G.gray,fontSize:12,cursor:"pointer"}}>Tout marquer comme lu</button>
          </div>}
        </div>
      )}

      {/* Search bar */}
      {showSearch&&(
        <div style={{background:G.white,padding:"10px 14px",borderBottom:`1px solid ${G.grayLight}`,display:"flex",flexDirection:"column",gap:8}}>
          <input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="🔍 Rechercher client, téléphone, produit..."
            style={{width:"100%",border:`1.5px solid ${G.green}`,borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>

          {(searchQuery||filterStatus!=="all"||filterLivreur!=="all")&&(
            <div style={{fontSize:11,color:G.gray}}>{filteredOrders.length} résultat{filteredOrders.length!==1?"s":""} trouvé{filteredOrders.length!==1?"s":""}</div>
          )}
        </div>
      )}


      <div style={{padding:isDesktop?32:14,paddingBottom:isDesktop?32:tab==="chat"?"0px":(role==="admin"||(role==="closer"&&sbReady))?"calc(90px + env(safe-area-inset-bottom,0px))":"calc(40px + env(safe-area-inset-bottom,0px))",maxWidth:isWide?1400:isDesktop?1100:"none",margin:isDesktop?"0 auto":"0",width:"100%",overflow:(!isDesktop&&tab==="chat")?"hidden":undefined}}>

        {/* ── LEADS SHOPIFY (pedidos sin confirmar) ── */}
        {tab==="boutique"&&(role==="admin"||role==="closer")&&(()=>{
          const leads = orders.filter(o=>o.status==="boutique");
          const webhookUrl     = `${window.location.origin}/.netlify/functions/shopify-webhook?org=${orgId}`;
          const wooUrl         = `${window.location.origin}/.netlify/functions/woocommerce-webhook?org=${orgId}`;
          const youcanUrl      = `${window.location.origin}/.netlify/functions/youcanshop-webhook?org=${orgId}`;
          return (
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Header */}
              <div style={{background:"linear-gradient(135deg,#FDE68A,#FCD34D)",borderRadius:16,padding:"16px 18px",color:G.green}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:26}}>🛒</span>
                    <div>
                      <div style={{fontWeight:800,fontSize:16,color:G.green}}>Commandes Boutique</div>
                      <div style={{fontSize:11,color:G.greenMid,fontWeight:600}}>Commandes à confirmer</div>
                    </div>
                  </div>
                  <div style={{background:"rgba(26,92,56,0.15)",borderRadius:20,padding:"4px 14px",fontWeight:800,fontSize:20,color:G.green}}>
                    {leads.length}
                  </div>
                </div>
              </div>

              {/* Liste commandes */}
              {leads.length===0?(
                <div style={{textAlign:"center",padding:40,color:G.gray,background:G.white,borderRadius:14}}>
                  <div style={{fontSize:48,marginBottom:12}}>📭</div>
                  <div style={{fontWeight:700,fontSize:15,color:G.dark}}>Sans commande pour l'instant</div>
                  <div style={{fontSize:12,marginTop:6,color:G.gray}}>Les commandes de ta boutique apparaîtront ici</div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {leads.map(o=>{
                    // ✓ = matched existing, ★ = auto-created, neither = unknown
                    const isMatched     = o.note?.includes("✓");
                    const isAutoCreated = o.note?.includes("★");
                    const catalogMatch  = products.find(p=>p.name===o.product);
                    const productRecognized = isMatched || isAutoCreated || !!catalogMatch;
                    return (
                    <div key={o.id} style={{background:G.white,borderRadius:14,boxShadow:"0 2px 8px rgba(0,0,0,0.08)",borderLeft:`4px solid ${productRecognized?"#10B981":"#F59E0B"}`,overflow:"hidden"}}>
                      {/* Info cliente — clic para ver detalles */}
                      <div onClick={()=>setOrderDetail(o)} style={{padding:"14px 14px 10px",cursor:"pointer"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                          <div>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{fontWeight:700,fontSize:15,color:G.dark}}>{o.client}</div>
                              {o.created_at&&<span style={{fontSize:10,color:G.gray,background:G.grayLight,borderRadius:5,padding:"1px 6px"}}>
                                🕐 {new Date(o.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}
                              </span>}
                            </div>
                            {(()=>{
                              const items=parseProd(o.product); const tot=items.reduce((s,p)=>s+p.qty,0);
                              const isMulti=tot>1||items.length>1;
                              const z=detectZone(o.address);
                              return (
                                <div style={{marginTop:3}}>
                                  {isMulti&&<div style={{display:"inline-flex",alignItems:"center",gap:4,background:"#FEF3C7",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:800,color:"#92400E",marginBottom:4}}>
                                    📦 BUNDLE · {tot} article{tot>1?"s":""}</div>}
                                  <div style={{display:"flex",flexDirection:"column",gap:2}}>
                                    {items.map((p,pi)=>(
                                      <div key={pi} style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                                        <span style={{fontSize:12,color:G.gray}}>📦 {p.name}</span>
                                        <span style={{background:p.qty>1?"#FEF3C7":"#F3F4F6",color:p.qty>1?"#92400E":G.gray,borderRadius:5,padding:"1px 7px",fontSize:11,fontWeight:800,flexShrink:0}}>×{p.qty}</span>
                                        {pi===0&&(isMatched||catalogMatch
                                          ?<span style={{background:"#D1FAE5",color:"#065F46",borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:700,flexShrink:0}}>✓ Reconnu</span>
                                          :isAutoCreated
                                            ?<span style={{background:"#EDE9FE",color:"#5B21B6",borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:700,flexShrink:0}}>★ Ajouté</span>
                                            :<span style={{background:"#FEF3C7",color:"#92400E",borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:700,flexShrink:0}}>⚠ Inconnu</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                                    <span style={{fontSize:11,color:G.gray}}>📍 {fullAddr(o)}</span>
                                    {(()=>{const f=fraisDisplay(o);return(<><span style={{background:z.color+"18",color:z.color,borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:700}}>{z.flag} {z.label} · {f.label}{f.warning&&<span style={{marginLeft:4,color:G.gold}}>⚠️</span>}</span>{f.warning&&<button onClick={e=>{e.stopPropagation();openFraisAndDismiss();}} title="Configurer les zones" style={{background:G.gold,color:"#fff",border:"none",borderRadius:5,padding:"2px 6px",fontSize:10,fontWeight:700,cursor:"pointer",lineHeight:1}}>⚙️</button>}</>);})()}
                                    {z.prepaid&&<span style={{background:"#FEF3C7",color:"#92400E",borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:700}}>⚠️ Prépayé</span>}
                                  </div>
                                  <div style={{fontSize:11,color:G.gray,marginTop:2}}>📱 {o.phone||"—"}</div>
                                  {o.note&&!o.note.startsWith("Commande Shopify")&&!o.note.startsWith("Commande WooCommerce")&&<div style={{fontSize:10,color:"#92400E",background:"#FEF3C7",borderRadius:5,padding:"2px 6px",marginTop:3,display:"inline-block"}}>{o.note.replace(/ [✓★]/g,"")}</div>}
                                </div>
                              );
                            })()}
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontWeight:800,fontSize:17,color:"#D97706"}}>{Number(o.price).toLocaleString("fr-FR")}</div>
                            <div style={{fontSize:10,color:G.gray}}>CFA</div>
                            <div style={{fontSize:10,color:G.gray,marginTop:4,background:"#FEF3C7",borderRadius:5,padding:"2px 6px"}}>👁 Voir détails</div>
                          </div>
                        </div>
                      </div>
                      <div style={{padding:"0 14px 14px"}}>
                      {/* Actions : Appeler · Rejeter · À traiter */}
                      <div style={{display:"flex",gap:7}}>
                        <a href={`tel:${o.phone}`} style={{flex:1,background:"#EFF6FF",color:G.blue,borderRadius:10,padding:"10px 0",fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4,textDecoration:"none"}}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={G.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.7A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/></svg>
                          Appeler
                        </a>
                        <button onClick={()=>{ upSt(o.id,"rechazado"); addToast(`Commande annulée ❌`,"❌",G.red); }}
                          style={{background:"#FEE2E2",color:G.red,border:"none",borderRadius:10,padding:"10px 10px",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                          ❌
                        </button>
                        <button onClick={()=>handleTraiterOrder(o)}
                          style={{flex:2,background:G.green,color:"#fff",border:"none",borderRadius:10,padding:"10px 0",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                          → Cmd à traiter
                        </button>
                      </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {/* Guide intégration webhook */}
              <div style={{background:G.white,borderRadius:14,padding:14}}>
                <div style={{fontWeight:700,fontSize:13,color:G.dark,marginBottom:12}}>🔗 Connecter ta boutique</div>

                {[
                  {icon:"🛒", label:"Shopify", url:webhookUrl, steps:["Va dans ton admin Shopify","Settings → Notifications → Webhooks","Clique \"Create webhook\"","Event: Order payment · Format: JSON","Colle l'URL ci-dessous → Save"]},
                  {icon:"⚡", label:"YouCan Shop", url:youcanUrl, steps:["Va dans ton panel YouCan Shop","Settings → Webhooks","Clique \"Add webhook\"","Event: Order created","Colle l'URL ci-dessous → Save"]},
                  {icon:"🔧", label:"WooCommerce", url:wooUrl, steps:["Va dans ton admin WordPress","WooCommerce → Settings → Advanced → Webhooks","Clique \"Add webhook\"","Topic: Order created · Format: JSON","Colle l'URL ci-dessous → Save"]},
                ].map(p=>(
                  <div key={p.label} style={{borderRadius:10,border:"1px solid #E5E7EB",overflow:"hidden",marginBottom:10}}>
                    <div style={{background:"#F9FAFB",padding:"8px 12px",fontWeight:700,fontSize:12,color:G.dark,display:"flex",alignItems:"center",gap:6}}>
                      {p.icon} {p.label}
                    </div>
                    <div style={{padding:"10px 12px"}}>
                      <div style={{fontSize:11,color:G.gray,lineHeight:1.8,marginBottom:8}}>
                        {p.steps.map((s,i)=><div key={i}>{i+1}. {s}</div>)}
                      </div>
                      <div style={{background:"#F3F4F6",borderRadius:7,padding:"6px 10px",fontSize:9,color:"#374151",wordBreak:"break-all",fontFamily:"monospace",marginBottom:6}}>{p.url}</div>
                      <button onClick={()=>navigator.clipboard?.writeText(p.url).then(()=>addToast(`URL ${p.label} copiée ✅`,"✅",G.green))}
                        style={{width:"100%",background:G.green,color:"#fff",border:"none",borderRadius:7,padding:"8px 0",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                        📋 Copier l'URL {p.label}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── PANTALLA DE CARGA ── */}
        {!dataReady&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",gap:20}}>
            <div style={{position:"relative",width:56,height:56}}>
              <svg viewBox="0 0 56 56" style={{width:56,height:56,animation:"spin 1s linear infinite"}}>
                <circle cx="28" cy="28" r="24" fill="none" stroke="#E5E7EB" strokeWidth="4"/>
                <circle cx="28" cy="28" r="24" fill="none" stroke={G.green} strokeWidth="4"
                  strokeDasharray="38 113" strokeLinecap="round"/>
              </svg>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📦</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontWeight:700,fontSize:15,color:G.dark}}>Chargement en cours…</div>
              <div style={{fontSize:12,color:G.gray,marginTop:4}}>Synchronisation avec le serveur</div>
            </div>
            {/* Skeleton cards */}
            {[1,2,3].map(i=>(
              <div key={i} style={{width:"100%",maxWidth:400,background:"#F3F4F6",borderRadius:14,padding:"16px 18px",animation:"pulse 1.5s ease-in-out infinite"}}>
                <div style={{height:10,background:"#E5E7EB",borderRadius:6,width:"60%",marginBottom:10}}/>
                <div style={{height:28,background:"#E5E7EB",borderRadius:6,width:"40%",marginBottom:8}}/>
                <div style={{height:10,background:"#E5E7EB",borderRadius:6,width:"80%"}}/>
              </div>
            ))}
          </div>
        )}

        {/* ── ADMIN DASHBOARD ── */}
        {/* ── SUPER ADMIN PANEL ── */}
        {tab==="superadmin"&&currentUser.email===OWNER_EMAIL&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:"linear-gradient(135deg,#0D1F14,#1A3828)",borderRadius:16,padding:"18px 20px"}}>
              <div style={{fontSize:10,letterSpacing:2,color:"rgba(255,255,255,0.4)",fontWeight:600,marginBottom:6}}>PROPRIÉTAIRE</div>
              <div style={{fontWeight:800,fontSize:18,color:"#FFF",marginBottom:4}}>Gestion des clients</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Modifie les plans de tes clients directement ici</div>
            </div>

            <button onClick={async()=>{
              setSaLoading(true);
              try {
                const res = await fetch("/.netlify/functions/super-admin",{
                  headers:{"Authorization":`Bearer ${_authToken}`}
                });
                const data = await res.json();
                if(Array.isArray(data)) setSaClients(data);
                else addToast("Erreur chargement clients","❌",G.red);
              } catch(e){ addToast("Erreur connexion","❌",G.red); }
              setSaLoading(false);
            }} style={{background:saLoading?"#6B7280":G.green,color:"#FFF",border:"none",borderRadius:12,padding:"11px 0",fontWeight:700,fontSize:13,cursor:saLoading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {saLoading?<><div style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.75s linear infinite"}}/>Chargement…</>:<>↺ Actualiser la liste</>}
            </button>

            {saClients.map(client=>{
              const planColors={gratuit:G.gray,basic:G.green,pro:G.blue,scale:"#7C3AED"};
              const planColor = planColors[client.plan||"gratuit"]||G.gray;
              const edit = saPlanEdit[client.id] || {};
              return (
                <div key={client.id} style={{background:"#FFF",borderRadius:14,padding:"16px 18px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
                  {/* Header client */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:15,color:G.dark}}>{client.name}</div>
                      <div style={{fontSize:11,color:G.gray,marginTop:2}}>
                        {client.memberCount} membre{client.memberCount>1?"s":""} · {client.ordersThisMonth} cmd ce mois
                      </div>
                    </div>
                    <span style={{background:planColor+"20",color:planColor,borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>
                      {client.plan||"gratuit"}
                    </span>
                  </div>

                  {/* Modifier plan */}
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <select
                      value={edit.plan||client.plan||"gratuit"}
                      onChange={e=>setSaPlanEdit(p=>({...p,[client.id]:{...edit,plan:e.target.value}}))}
                      style={{flex:1,border:"1px solid #E5E7EB",borderRadius:9,padding:"8px 10px",fontSize:13,outline:"none",minWidth:120}}>
                      <option value="gratuit">Gratuit</option>
                      <option value="basic">Basic — 8 000 CFA</option>
                      <option value="pro">Pro — 14 000 CFA</option>
                      <option value="scale">Scale — 25 000 CFA</option>
                    </select>

                    <select
                      value={edit.expiry||"never"}
                      onChange={e=>setSaPlanEdit(p=>({...p,[client.id]:{...edit,expiry:e.target.value}}))}
                      style={{border:"1px solid #E5E7EB",borderRadius:9,padding:"8px 10px",fontSize:12,outline:"none"}}>
                      <option value="never">Sans expiration</option>
                      <option value="7d">7 jours</option>
                      <option value="30d">30 jours</option>
                      <option value="90d">90 jours</option>
                      <option value="1y">1 an</option>
                    </select>

                    <button onClick={async()=>{
                      const newPlan = edit.plan||client.plan||"gratuit";
                      const expiry  = edit.expiry||"never";
                      let plan_expires_at = null;
                      if(expiry!=="never"){
                        const days = expiry==="7d"?7:expiry==="30d"?30:expiry==="90d"?90:365;
                        plan_expires_at = new Date(Date.now()+days*86400000).toISOString();
                      }
                      try {
                        const res = await fetch("/.netlify/functions/super-admin",{
                          method:"PATCH",
                          headers:{"Content-Type":"application/json","Authorization":`Bearer ${_authToken}`},
                          body:JSON.stringify({orgId:client.id, plan:newPlan, plan_expires_at}),
                        });
                        const data = await res.json();
                        if(data.success){
                          setSaClients(p=>p.map(c=>c.id===client.id?{...c,plan:newPlan}:c));
                          setSaPlanEdit(p=>({...p,[client.id]:{}}));
                          addToast(`${client.name} → ${newPlan} ✅`,"✅",G.green);
                        } else addToast("Erreur mise à jour","❌",G.red);
                      } catch(e){ addToast("Erreur connexion","❌",G.red); }
                    }} style={{background:G.green,color:"#FFF",border:"none",borderRadius:9,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                      Sauvegarder
                    </button>
                  </div>

                  {/* Raccourcis */}
                  <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                    {["basic","pro","scale"].map(p=>(
                      <button key={p} onClick={async()=>{
                        try {
                          const res = await fetch("/.netlify/functions/super-admin",{
                            method:"PATCH",
                            headers:{"Content-Type":"application/json","Authorization":`Bearer ${_authToken}`},
                            body:JSON.stringify({orgId:client.id, plan:p, plan_expires_at:null}),
                          });
                          const data = await res.json();
                          if(data.success){ setSaClients(prev=>prev.map(c=>c.id===client.id?{...c,plan:p}:c)); addToast(`${client.name} → ${p} gratuit ✅`,"✅",G.green); }
                        } catch(e){}
                      }} style={{background:"#F3F4F6",color:G.dark,border:"none",borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer",textTransform:"capitalize"}}>
                        {p} gratuit
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {saLoading&&saClients.length===0&&(
              <div style={{textAlign:"center",padding:32,color:G.gray,fontSize:13,display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
                <div style={{width:28,height:28,border:"3px solid #E5E7EB",borderTopColor:G.green,borderRadius:"50%",animation:"spin 0.75s linear infinite"}}/>
                Chargement des clients…
              </div>
            )}
            {saClients.length===0&&!saLoading&&(
              <div style={{textAlign:"center",padding:32,color:G.gray,fontSize:13}}>
                Aucun client trouvé. Clique sur "↺ Actualiser" pour réessayer.
              </div>
            )}
          </div>
        )}

        {dataReady&&tab==="dashboard"&&role==="admin"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* Salutation */}
            <div style={{background:`linear-gradient(135deg,${G.green},#0D3D25)`,borderRadius:16,padding:"16px 18px",color:G.white}}>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>Bonjour, {settings.nom} 👋</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2}}>{settings.boutique} · {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:12}}>
                <div>
                  <div style={{fontSize:10,color:G.gold,fontWeight:700,letterSpacing:1}}>CA DU JOUR</div>
                  <div style={{fontSize:30,fontWeight:700,color:G.gold,marginTop:2}}>{fmt(caJour)} <span style={{fontSize:14}}>CFA</span></div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginTop:3}}>Bénéf. total: {fmt(tBen)} CFA</div>
                </div>
                <button onClick={()=>setTab("compta")} style={{background:"rgba(240,165,0,0.2)",color:G.gold,border:"1px solid rgba(240,165,0,0.4)",borderRadius:9,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  Voir Compta →
                </button>
              </div>
            </div>

            {/* ── Sync zones banners (admin only) ── */}
            {(()=>{
              if (zoneBannersDismissed) return null;
              const awaiting  = orders.filter(o=>o.sync_status==="awaiting_zone_config");
              // Only count unmatched orders with an actionable city — empty / "-" / "—" / whitespace
              // can never be matched against a zone, so banner-them is useless and creates a permanent banner.
              const hasUsefulCity = c => { const t=(c||"").trim(); return t.length>0 && !/^[-—\s]+$/.test(t); };
              const unmatched = orders.filter(o=>o.sync_status==="unmatched_zone" && hasUsefulCity(o.unmatched_city));
              if (awaiting.length===0 && unmatched.length===0) return null;
              const cityCounts = {};
              unmatched.forEach(o=>{ const c=(o.unmatched_city||"").trim(); if(c) cityCounts[c]=(cityCounts[c]||0)+1; });
              const cities = Object.entries(cityCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
              return (
                <>
                  {awaiting.length>0&&(
                    <div style={{background:"#FFF7E6",borderLeft:`4px solid ${G.gold}`,borderRadius:12,padding:14,display:"flex",flexDirection:isDesktop?"row":"column",alignItems:isDesktop?"center":"flex-start",gap:12}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:14,color:G.dark,marginBottom:4}}>⚠️ Tarifs de livraison non configurés</div>
                        <div style={{fontSize:12,color:"#6B7280",lineHeight:1.5}}>Vous avez <strong>{awaiting.length}</strong> commande{awaiting.length>1?"s":""} en attente sans frais de livraison. Configurez vos zones pour synchroniser automatiquement vos commandes Shopify.</div>
                      </div>
                      <button onClick={()=>openFraisAndDismiss()} style={{background:G.gold,color:"#fff",border:"none",borderRadius:8,padding:"10px 16px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                        Configurer maintenant →
                      </button>
                    </div>
                  )}
                  {unmatched.length>0&&(
                    <div style={{background:"#FFF7E6",borderLeft:`4px solid ${G.gold}`,borderRadius:12,padding:14,display:"flex",flexDirection:"column",gap:10}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,color:G.dark,marginBottom:4}}>⚠️ Nouvelle zone détectée</div>
                        <div style={{fontSize:12,color:"#6B7280",lineHeight:1.5,marginBottom:8}}>{unmatched.length} commande{unmatched.length>1?"s":""} provenant de :</div>
                        <ul style={{margin:0,paddingLeft:20,fontSize:12,color:G.dark,lineHeight:1.7}}>
                          {cities.map(([city,n])=>(
                            <li key={city}><strong>{city}</strong> ({n} commande{n>1?"s":""})</li>
                          ))}
                        </ul>
                        <div style={{fontSize:12,color:"#6B7280",lineHeight:1.5,marginTop:8}}>Ajoutez ces zones pour calculer automatiquement leurs frais.</div>
                      </div>
                      <button onClick={()=>openFraisAndDismiss()} style={{alignSelf:"flex-start",background:G.gold,color:"#fff",border:"none",borderRadius:8,padding:"10px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        Ajouter ces zones →
                      </button>
                    </div>
                  )}
                </>
              );
            })()}

            {/* KPIs */}
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(4,1fr)":"1fr 1fr",gap:isDesktop?12:8}}>
              <SC icon="📦" label="Total commandes" value={orders.length} onClick={()=>setTab("commandes")}/>
              <SC icon="✅" label="Livrées" value={livres} color={G.green} bg={G.greenLight} onClick={()=>{setFilterStatus("entregado");setTab("commandes");}}/>
              <SC icon="❌" label="Rejetées" value={rejetes} color={G.red} bg="#FEE2E2" onClick={()=>{setFilterStatus("rechazado");setTab("commandes");}}/>
              <SC icon="🏍️" label="En route" value={enRoute} color={G.blue} bg="#EFF6FF" onClick={()=>{setFilterStatus("livraison");setTab("commandes");}}/>
            </div>

            {/* Aperçu du jour */}
            {(()=>{
              const todayStr = new Date().toISOString().slice(0,10);
              const tod = orders.filter(o=>(o.created_at||"").startsWith(todayStr));
              const bars = [
                {label:"Confirmé", count:tod.filter(o=>o.status==="confirmado").length,                                                        color:G.green},
                {label:"En route", count:tod.filter(o=>["livreur_en_route","colis_pris","en_camino","chez_client"].includes(o.status)).length, color:G.blue},
                {label:"Livré",    count:tod.filter(o=>o.status==="entregado").length,                                                         color:"#4ADE80"},
                {label:"Rejeté",   count:tod.filter(o=>o.status==="rechazado").length,                                                         color:G.red},
              ];
              const maxB = Math.max(...bars.map(b=>b.count),1);
              return (
                <div style={{background:G.white,borderRadius:14,padding:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:G.dark,marginBottom:12}}>📊 Aperçu du jour</div>
                  <div style={{display:"flex",alignItems:"flex-end",gap:8,height:140}}>
                    {bars.map((b,i)=>(
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,height:"100%",justifyContent:"flex-end"}}>
                        <span style={{fontSize:11,fontWeight:700,color:b.count>0?b.color:G.gray}}>{b.count}</span>
                        <div style={{width:"100%",background:b.count>0?b.color:G.grayLight,borderRadius:6,height:b.count>0?`${Math.max(b.count/maxB*100,6)}px`:"2px",transition:"height 0.4s"}}/>
                        <span style={{fontSize:9,color:G.gray,textAlign:"center",lineHeight:1.2}}>{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Taux */}
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:12,fontWeight:700,color:G.dark}}>Taux de livraison</span>
                <span style={{fontSize:14,fontWeight:700,color:taux>=60?G.green:G.red}}>{taux}%</span>
              </div>
              <div style={{background:G.grayLight,borderRadius:4,height:8}}>
                <div style={{background:taux>=60?G.green:G.red,borderRadius:4,height:8,width:`${taux}%`,transition:"width 0.5s"}}/>
              </div>
            </div>

            {/* CA par produit — visuel */}
            {calcProd.filter(x=>x.ca>0).length>0&&(
              <div style={{background:G.white,borderRadius:14,padding:14}}>
                <ST>💰 CA PAR PRODUIT</ST>
                {calcProd.filter(x=>x.ca>0).sort((a,b)=>b.ca-a.ca).map(({prod,ca,nLiv,ben},i)=>{
                  const maxCA = Math.max(...calcProd.map(x=>x.ca),1);
                  const pctBar = Math.round(ca/maxCA*100);
                  return (
                    <div key={i} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:12,fontWeight:600,color:G.dark}}>{prod.name}</span>
                        <div style={{textAlign:"right"}}>
                          <span style={{fontSize:12,fontWeight:700,color:G.green}}>{fmt(ca)} CFA</span>
                          <span style={{fontSize:10,color:G.gray,marginLeft:6}}>({nLiv} livrées)</span>
                        </div>
                      </div>
                      <div style={{background:G.grayLight,borderRadius:4,height:8}}>
                        <div style={{background:G.green,borderRadius:4,height:8,width:`${pctBar}%`,transition:"width 0.5s"}}/>
                      </div>
                      <div style={{fontSize:10,color:ben>=0?G.greenMid:G.red,marginTop:2}}>Bénéfice: {fmt(ben)} CFA</div>
                    </div>
                  );
                })}
                <div style={{background:G.greenLight,borderRadius:10,padding:"8px 12px",marginTop:6,display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,fontWeight:700,color:G.green}}>CA Total</span>
                  <span style={{fontSize:14,fontWeight:700,color:G.green}}>{fmt(tCA)} CFA</span>
                </div>
              </div>
            )}

            {/* Actions rapides */}
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <ST>⚡ ACTIONS RAPIDES</ST>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  {icon:"📦",label:orderLimitReached?"Limite atteinte":"+ Commande",action:()=>{ if(orderLimitReached){addToast(`Limite ${orderLimit} commandes/mois atteinte`,"🔒","#DC2626");return;} setShowAdd(true); },bg:orderLimitReached?"#FEE2E2":G.greenLight,color:orderLimitReached?G.red:G.green},
                  {icon:"📦",label:"+ Produit",action:()=>setShowAddProd(true),bg:"#EFF6FF",color:G.blue},
                  {icon:"👤",label:"Clients",action:()=>setTab("clients"),bg:"#FFF8E7",color:G.gold},
                  {icon:"🗺️",label:"Tracking",action:()=>setTab("tracking"),bg:"#EDE9FE",color:"#7C3AED"},
                  {icon:"👥",label:"Équipe",  action:()=>setTab("equipe"),  bg:"#F0FDF4",color:G.green},
                ].map((a,i)=>(
                  <button key={i} onClick={a.action} style={{background:a.bg,border:"none",borderRadius:10,padding:"12px 8px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                    <span style={{fontSize:22}}>{a.icon}</span>
                    <span style={{fontSize:11,fontWeight:700,color:a.color}}>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ── CLOSER DASHBOARD ── */}
        {dataReady&&tab==="dashboard"&&role==="closer"&&(()=>{
          const todayStr  = new Date().toISOString().slice(0,10);
          const todayOrds = myClo.filter(o=>(o.created_at||"").startsWith(todayStr));
          const confirmed = myClo.filter(o=>o.status==="confirmado");
          const pending   = myClo.filter(o=>["pendiente","no_contesta","reprogramar"].includes(o.status));
          const revenue   = myClo.filter(o=>o.status==="entregado").reduce((s,o)=>s+(parseFloat(o.price)||0),0);
          const days7     = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-6+i); const ds=d.toISOString().slice(0,10); return {label:d.toLocaleDateString("fr",{weekday:"short"}).slice(0,3), count:myClo.filter(o=>(o.created_at||"").startsWith(ds)).length}; });
          const maxCnt    = Math.max(...days7.map(d=>d.count),1);
          const cW=280, cH=80;
          const pts = days7.map((d,i)=>`${(i/(days7.length-1))*cW},${cH-(d.count/maxCnt)*(cH-10)}`).join(" ");
          return (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                {icon:"📦",label:"Aujourd'hui",value:todayOrds.length,color:"#0284C7",bg:"#E0F2FE"},
                {icon:"✅",label:"Confirmées", value:confirmed.length, color:G.green,  bg:G.greenLight},
                {icon:"⏳",label:"En attente", value:pending.length,   color:G.gold,   bg:"#FFF8E7"},
                {icon:"💰",label:"Revenu livré",value:fmt(revenue),    color:"#7C3AED",bg:"#EDE9FE"},
              ].map((kpi,i)=>(
                <div key={i} style={{background:G.white,borderRadius:14,padding:"14px 12px",boxShadow:"0 1px 6px rgba(0,0,0,0.06)"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{kpi.icon}</div>
                  <div style={{fontSize:22,fontWeight:800,color:kpi.color}}>{kpi.value}</div>
                  <div style={{fontSize:11,color:G.gray,fontWeight:500,marginTop:2}}>{kpi.label}</div>
                </div>
              ))}
            </div>
            <div style={{background:G.white,borderRadius:14,padding:14,boxShadow:"0 1px 6px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:11,fontWeight:700,color:G.gray,letterSpacing:0.5,marginBottom:10}}>TENDANCE 7 JOURS</div>
              <svg width="100%" viewBox={`0 0 ${cW} ${cH+20}`} style={{overflow:"visible"}}>
                <defs><linearGradient id="cloTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={G.green} stopOpacity="0.2"/><stop offset="100%" stopColor={G.green} stopOpacity="0"/></linearGradient></defs>
                <polygon points={`0,${cH} ${pts} ${cW},${cH}`} fill="url(#cloTrend)"/>
                <polyline points={pts} fill="none" stroke={G.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                {days7.map((d,i)=>{ const x=(i/(days7.length-1))*cW; const y=cH-(d.count/maxCnt)*(cH-10); return (<g key={i}><circle cx={x} cy={y} r="3" fill={G.green}/>{d.count>0&&<text x={x} y={y-7} textAnchor="middle" fontSize="9" fill={G.green} fontWeight="700">{d.count}</text>}<text x={x} y={cH+16} textAnchor="middle" fontSize="9" fill={G.gray}>{d.label}</text></g>); })}
              </svg>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setTab("commandes");setTimeout(()=>setShowAdd(true),50);}} style={{flex:1,background:G.green,color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>➕ Nouvelle commande</button>
              <a href={`https://wa.me/${(settings.phone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{flex:1,background:"#25D366",color:"#fff",borderRadius:12,padding:"13px 0",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6,textDecoration:"none"}}>💬 WhatsApp</a>
            </div>
            {pending.length>0&&(
            <div style={{background:G.white,borderRadius:14,padding:14,boxShadow:"0 1px 6px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:11,fontWeight:700,color:G.gray,letterSpacing:0.5,marginBottom:10}}>🔥 À TRAITER EN PRIORITÉ</div>
              {pending.map(o=>{const st=STATUS[o.status];return(<div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${G.grayLight}`}}><div><div style={{fontSize:13,fontWeight:600}}>{o.client}</div><div style={{fontSize:11,color:G.gray}}>📱 {o.phone}</div></div><span style={{background:st.bg,color:st.color,borderRadius:8,padding:"3px 9px",fontSize:11,fontWeight:600}}>{st.label}</span></div>);})}
            </div>
            )}
            <div style={{background:G.white,borderRadius:14,padding:14,boxShadow:"0 1px 6px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:11,fontWeight:700,color:G.gray,letterSpacing:0.5,marginBottom:10}}>🏍️ LIVREURS</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>{teamMembers.filter(m=>m.role==="livreur").map(m=>{const busy=orders.filter(o=>o.livreur_id===m.id&&o.status==="en_camino").length;return(<div key={m.id} style={{background:busy>0?"#FFF8E7":G.greenLight,borderRadius:10,padding:"7px 11px",fontSize:12,fontWeight:600,color:busy>0?G.gold:G.green}}>🏍️ {m.nom} {busy>0?`(${busy} en route)`:"· Dispo"}</div>);})}{teamMembers.filter(m=>m.role==="livreur").length===0&&<div style={{fontSize:12,color:G.gray}}>Aucun livreur dans l'équipe</div>}</div>
            </div>
          </div>
          );
        })()}

        {/* ── LIVREUR DASHBOARD ── */}
        {dataReady&&tab==="dashboard"&&role==="livreur"&&(()=>{
          const toConfirm  = myLiv.filter(o=>o.status==="confirmado");
          const toPickup   = myLiv.filter(o=>o.status==="livreur_en_route");
          const inProgress = myLiv.filter(o=>["colis_pris","en_camino","chez_client"].includes(o.status));
          const isBatch    = livBtnLoading==="batch";

          const batchAdvance = async(batchOrds, nextStatus, toastMsg) => {
            const origMap = Object.fromEntries(batchOrds.map(o=>[o.id,o.status]));
            setLivBtnLoading("batch");
            setOrders(prev=>prev.map(o=>origMap[o.id]!==undefined?{...o,status:nextStatus}:o));
            try {
              await Promise.all(batchOrds.map(o=>sbFetch(`orders?id=eq.${o.id}`,"PATCH",{status:nextStatus})));
              addToast(toastMsg,"✅",G.green);
            } catch(e) {
              setOrders(prev=>prev.map(o=>origMap[o.id]!==undefined?{...o,status:origMap[o.id]}:o));
              addToast("Échec de la mise à jour, réessayez","❌",G.red);
            } finally {
              setLivBtnLoading(null);
            }
          };

          return (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* Empty states */}
            {myLiv.length===0&&orders.length>0&&(
              <div style={{background:"#FFF8E7",borderRadius:12,padding:14,fontSize:12,color:"#92400E",border:"1px solid #FDE68A"}}>
                ⚠️ Aucune livraison assignée à <strong>{currentUser.nom}</strong>. Demande à l'Admin de t'assigner des commandes.
              </div>
            )}
            {toConfirm.length===0&&toPickup.length===0&&inProgress.length===0&&myLiv.length>0&&(
              <div style={{background:G.greenLight,borderRadius:14,padding:20,textAlign:"center",border:`1px solid ${G.green}33`}}>
                <div style={{fontSize:32,marginBottom:6}}>✅</div>
                <div style={{fontWeight:700,fontSize:15,color:G.green}}>Toutes les livraisons sont terminées</div>
                <div style={{fontSize:12,color:G.gray,marginTop:4}}>Bien joué ! Attends de nouvelles assignations.</div>
              </div>
            )}

            {/* ── BATCH NOTIFICATION 1 — Je pars récupérer ── */}
            {toConfirm.length>0&&(
              <div style={{background:"#EDE9FE",borderRadius:16,border:"2px solid #C4B5FD",padding:"18px 16px 20px",boxShadow:"0 2px 12px rgba(0,0,0,0.08)",animation:"livFadeIn 220ms ease"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <span style={{fontSize:28,lineHeight:1}}>🔔</span>
                  <div>
                    <div style={{fontWeight:800,fontSize:16,color:"#5B21B6"}}>Je pars récupérer {toConfirm.length} colis</div>
                    <div style={{fontSize:11,color:"#7C3AED",fontWeight:600,marginTop:2}}>Nouveaux colis assignés — confirmez le départ</div>
                  </div>
                </div>
                <div style={{background:"rgba(255,255,255,0.75)",borderRadius:10,padding:"10px 12px",marginBottom:14}}>
                  {toConfirm.slice(0,5).map((o,i)=>{
                    const ref=o.note?.match(/#[\w-]+/)?.[0]||"";
                    return (
                      <div key={o.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 0",borderBottom:i<Math.min(toConfirm.length,5)-1?"0.5px solid #EDE9FE":"none"}}>
                        {ref&&<span style={{fontSize:10,color:"#7C3AED",fontWeight:700,flexShrink:0,minWidth:44}}>{ref}</span>}
                        <span style={{fontSize:13,fontWeight:700,color:"#111",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.client}</span>
                        <span style={{fontSize:11,color:"#6B7280",flexShrink:0}}>{o.city||"—"}</span>
                      </div>
                    );
                  })}
                  {toConfirm.length>5&&<div style={{fontSize:11,color:"#7C3AED",marginTop:5,fontWeight:600}}>+{toConfirm.length-5} autres colis…</div>}
                </div>
                <button disabled={isBatch}
                  onClick={()=>batchAdvance(toConfirm,"livreur_en_route","Départ confirmé — En route pour récupérer 🏍️")}
                  style={{width:"100%",background:isBatch?"#9CA3AF":"#7C3AED",color:"#fff",border:"none",borderRadius:12,padding:"16px 0",fontWeight:800,fontSize:15,cursor:isBatch?"not-allowed":"pointer",transition:"background 150ms"}}>
                  {isBatch?"…":"Je pars récupérer les colis"}
                </button>
              </div>
            )}

            {/* ── BATCH NOTIFICATION 2 — Colis en main (ONLY after N1 confirmed) ── */}
            {toPickup.length>0&&toConfirm.length===0&&(
              <div style={{background:"#EFF6FF",borderRadius:16,border:"2px solid #BAE6FD",padding:"18px 16px 20px",boxShadow:"0 2px 12px rgba(0,0,0,0.08)",animation:"livFadeIn 220ms ease"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <span style={{fontSize:28,lineHeight:1}}>📦</span>
                  <div>
                    <div style={{fontWeight:800,fontSize:16,color:"#0369A1"}}>Colis en main</div>
                    <div style={{fontSize:11,color:"#0284C7",fontWeight:600,marginTop:2}}>{toPickup.length} colis récupérés — confirmer la prise en charge</div>
                  </div>
                </div>
                <div style={{background:"rgba(255,255,255,0.75)",borderRadius:10,padding:"10px 12px",marginBottom:14}}>
                  {toPickup.slice(0,5).map((o,i)=>{
                    const ref=o.note?.match(/#[\w-]+/)?.[0]||"";
                    return (
                      <div key={o.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 0",borderBottom:i<Math.min(toPickup.length,5)-1?"0.5px solid #BAE6FD":"none"}}>
                        {ref&&<span style={{fontSize:10,color:"#0284C7",fontWeight:700,flexShrink:0,minWidth:44}}>{ref}</span>}
                        <span style={{fontSize:13,fontWeight:700,color:"#111",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.client}</span>
                        <span style={{fontSize:11,color:"#6B7280",flexShrink:0}}>📍 {o.city||"—"}</span>
                      </div>
                    );
                  })}
                  {toPickup.length>5&&<div style={{fontSize:11,color:"#0284C7",marginTop:5,fontWeight:600}}>+{toPickup.length-5} autres colis…</div>}
                </div>
                <button disabled={isBatch}
                  onClick={()=>batchAdvance(toPickup,"colis_pris","Colis pris en charge. Continuez les livraisons.")}
                  style={{width:"100%",background:isBatch?"#9CA3AF":"#0369A1",color:"#fff",border:"none",borderRadius:12,padding:"16px 0",fontWeight:800,fontSize:15,cursor:isBatch?"not-allowed":"pointer",transition:"background 150ms"}}>
                  {isBatch?"…":"Colis en main"}
                </button>
              </div>
            )}

            {/* ── EN COURS — gérer dans Livraisons ── */}
            {(()=>{
              if(inProgress.length===0) return null;
              const livDismissKey=`teamly_liv_dismissed_${orgId}_${currentUser.id}`;
              let dismissed;
              try { dismissed=new Set(JSON.parse(localStorage.getItem(livDismissKey)||"[]")); } catch { dismissed=new Set(); }
              const showBanner=inProgress.some(o=>!dismissed.has(o.id));
              if(!showBanner) return null;
              return (
              <div style={{background:"#FFF8E7",borderRadius:16,border:"2px solid #FDE68A",padding:"16px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",animation:"livFadeIn 220ms ease"}}>
                <div style={{fontWeight:800,fontSize:14,color:"#92400E",marginBottom:10}}>🚀 {inProgress.length} livraison{inProgress.length>1?"s":""} en cours</div>
                {inProgress.slice(0,3).map((o,i)=>{
                  const st=STATUS[o.status]||STATUS.pendiente;
                  return (
                    <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:i<Math.min(inProgress.length,3)-1?"0.5px solid #FDE68A":"none"}}>
                      <span style={{fontWeight:700,fontSize:13,color:"#111"}}>{o.client}</span>
                      <span style={{background:st.bg,color:st.color,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{st.label}</span>
                    </div>
                  );
                })}
                {inProgress.length>3&&<div style={{fontSize:11,color:"#D97706",marginTop:5,fontWeight:600}}>+{inProgress.length-3} autres…</div>}
                <button onClick={()=>{
                  const cur=new Set(dismissed);
                  inProgress.forEach(o=>cur.add(o.id));
                  try{localStorage.setItem(livDismissKey,JSON.stringify([...cur]));}catch{}
                  setTab("livraisons");
                }}
                  style={{width:"100%",background:"#D97706",color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontWeight:700,fontSize:14,cursor:"pointer",marginTop:14}}>
                  Gérer dans Livraisons →
                </button>
              </div>
              );
            })()}

            {/* Stats */}
            <div style={{display:"flex",gap:8}}>
              <SC icon="📦" label="Assignées" value={myLiv.length}/>
              <SC icon="✅" label="Livrées" value={myLiv.filter(o=>o.status==="entregado").length} color={G.green} bg={G.greenLight}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <SC icon="🏍️" label="En route" value={myLiv.filter(o=>["en_camino","chez_client"].includes(o.status)).length} color={G.blue} bg="#EFF6FF"/>
              <SC icon="❌" label="Rejetées" value={myLiv.filter(o=>o.status==="rechazado").length} color={G.red} bg="#FEE2E2"/>
            </div>
            <div style={{background:G.greenLight,borderRadius:14,padding:18,textAlign:"center"}}>
              <div style={{fontSize:11,color:G.gray,fontWeight:700,letterSpacing:1}}>CASH COLLECTÉ</div>
              <div style={{fontSize:28,fontWeight:700,color:G.green,marginTop:4}}>{fmt(myLiv.filter(o=>o.status==="entregado").reduce((a,o)=>a+o.price,0))} CFA</div>
            </div>
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <ST>📋 MES LIVRAISONS</ST>
              <Tbl headers={["Client","Produit","Prix","Statut"]} align={["left","left","right","left"]}
                rows={[...myLiv].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).map(o=>{const st=STATUS[o.status]||STATUS.pendiente;return [<span style={{fontWeight:600}}>{o.client}</span>,o.product,<span style={{fontWeight:700,color:G.green}}>{fmt(o.price)}</span>,<span style={{background:st.bg,color:st.color,borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:600}}>{st.label}</span>];})}
              />
            </div>
          </div>
          );
        })()}

        {/* ── COMMANDES / LIVRAISONS ── */}
        {dataReady&&(tab==="commandes"||tab==="livraisons")&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>

            {/* Bannière limite commandes */}
            {tab==="commandes"&&isFinite(orderLimit)&&orderLimitWarning&&(
              <div style={{background:orderLimitReached?"#FEE2E2":"#FEF3C7",border:`1px solid ${orderLimitReached?"#FECACA":"#FDE68A"}`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:orderLimitReached?"#991B1B":"#92400E"}}>
                    {orderLimitReached?"Limite atteinte — création bloquée":`Attention : ${ordersThisMonth}/${orderLimit} commandes ce mois`}
                  </div>
                  <div style={{fontSize:11,color:orderLimitReached?"#DC2626":"#B45309",marginTop:2}}>
                    {orderLimitReached?`Passez au plan supérieur pour continuer`:`Il reste ${orderLimit-ordersThisMonth} commande${orderLimit-ordersThisMonth>1?"s":""} disponible${orderLimit-ordersThisMonth>1?"s":""}`}
                  </div>
                </div>
                {orderLimitReached&&(
                  <button onClick={()=>setShowPlanModal(true)} style={{background:"#DC2626",color:"#FFF",border:"none",borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                    Changer de plan
                  </button>
                )}
              </div>
            )}

            {/* ── Filtros ── */}
            {(tab==="commandes"||(tab==="livraisons"&&role==="livreur"))&&(
              <div style={{background:G.white,borderRadius:14,padding:"12px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                {/* Date */}
                <div style={{fontSize:11,color:"#374151",fontWeight:800,marginBottom:8,letterSpacing:0.3}}>📅 DATE</div>
                <div style={{display:"flex",gap:5,marginBottom:12,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                  {(()=>{
                    const _fd = new Date();
                    const _fmt = d => d.toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"});
                    const _yest = new Date(_fd); _yest.setDate(_fd.getDate()-1);
                    const _mon  = new Date(_fd); _mon.setDate(_fd.getDate()-((_fd.getDay()+6)%7));
                    const chips = [
                      {k:"today",     l:"Aujourd'hui", sub:_fmt(_fd)},
                      {k:"yesterday", l:"Hier",        sub:_fmt(_yest)},
                      {k:"week",      l:"Semaine",     sub:`dès ${_fmt(_mon)}`},
                      {k:"all",       l:"Tout",        sub:"toutes dates"},
                    ];
                    return chips.map(d=>{
                      const active = filterDate===d.k;
                      return (
                        <button key={d.k} onClick={()=>{setFilterDate(d.k);try{localStorage.setItem("teamly_filter_date",d.k);}catch(e){}}}
                          style={{flexShrink:0,background:active?G.green:"#F3F4F6",color:active?"#fff":"#374151",border:active?`2px solid ${G.green}`:"2px solid transparent",borderRadius:10,padding:"7px 10px",cursor:"pointer",textAlign:"center",minWidth:70}}>
                          <div style={{fontSize:12,fontWeight:700}}>{d.l}</div>
                          <div style={{fontSize:9,opacity:active?0.85:0.6,marginTop:1,fontWeight:500}}>{d.sub}</div>
                        </button>
                      );
                    });
                  })()}
                </div>

                {/* Statut — deux groupes pour admin/closer, liste simple pour livreur */}
                {role!=="livreur"?(
                  <>
                    {/* Groupe 1 : Statut de livraison */}
                    <div style={{fontSize:10,color:"#6B7280",fontWeight:700,marginBottom:6,letterSpacing:0.5}}>🚚 STATUT DE LIVRAISON</div>
                    <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:4,marginBottom:10,WebkitOverflowScrolling:"touch"}}>
                      {[
                        {k:"all",        l:"Tout",                    c:"#374151", bg:"#E5E7EB"},
                        {k:"pendiente",  l:"En attente",              c:STATUS.pendiente.color,  bg:STATUS.pendiente.color+"22"},
                        {k:"confirmado", l:"Confirmé 🔔",             c:STATUS.confirmado.color, bg:STATUS.confirmado.color+"22"},
                        {k:"livreur_en_route", l:"Livreur en route 🏍️", c:STATUS.livreur_en_route.color, bg:STATUS.livreur_en_route.color+"22"},
                        {k:"colis_pris", l:"Colis en main 📦",        c:STATUS.colis_pris.color, bg:STATUS.colis_pris.color+"22"},
                        {k:"en_camino",  l:"Vers le client 🚀",       c:STATUS.en_camino.color,  bg:STATUS.en_camino.color+"22"},
                        {k:"chez_client",l:"Chez le client 📍",       c:STATUS.chez_client.color,bg:STATUS.chez_client.color+"22"},
                      ].map(({k,l,c,bg})=>{
                        const active = filterStatus===k;
                        return (
                          <button key={k} onClick={()=>setFilterStatus(active&&k!=="all"?"all":k)}
                            style={{flexShrink:0,background:active?c:bg,color:active?"#fff":c,border:`1.5px solid ${active?c:c+"55"}`,borderRadius:20,padding:"5px 11px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.13s"}}>
                            {l}
                          </button>
                        );
                      })}
                    </div>
                    {/* Groupe 2 : Résultat */}
                    <div style={{fontSize:10,color:"#6B7280",fontWeight:700,marginBottom:6,letterSpacing:0.5}}>🏁 RÉSULTAT</div>
                    <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:2,WebkitOverflowScrolling:"touch"}}>
                      {[
                        {k:"entregado",  l:"Encaissé ✅",  c:STATUS.entregado.color,  bg:STATUS.entregado.color+"22"},
                        {k:"rechazado",  l:"Rejeté ❌",    c:STATUS.rechazado.color,  bg:STATUS.rechazado.color+"22"},
                        {k:"no_contesta",l:"Absent 📵",    c:STATUS.no_contesta.color,bg:STATUS.no_contesta.color+"22"},
                      ].map(({k,l,c,bg})=>{
                        const active = filterStatus===k;
                        return (
                          <button key={k} onClick={()=>setFilterStatus(active?"all":k)}
                            style={{flexShrink:0,background:active?c:bg,color:active?"#fff":c,border:`1.5px solid ${active?c:c+"55"}`,borderRadius:20,padding:"5px 11px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.13s"}}>
                            {l}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ):(
                  <>
                    <div style={{fontSize:10,color:"#6B7280",fontWeight:700,marginBottom:6,letterSpacing:0.5}}>🚚 MA TOURNÉE</div>
                    <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:4,marginBottom:10,WebkitOverflowScrolling:"touch"}}>
                      {[
                        {k:"all",              l:"Tout",                 c:"#374151", bg:"#E5E7EB"},
                        {k:"livreur_en_route", l:"En route 🏍️",          c:STATUS.livreur_en_route.color, bg:STATUS.livreur_en_route.color+"22"},
                        {k:"colis_pris",       l:"Colis en main 📦",     c:STATUS.colis_pris.color,       bg:STATUS.colis_pris.color+"22"},
                        {k:"en_camino",        l:"Vers client 🚀",       c:STATUS.en_camino.color,        bg:STATUS.en_camino.color+"22"},
                        {k:"chez_client",      l:"Chez client 📍",       c:STATUS.chez_client.color,      bg:STATUS.chez_client.color+"22"},
                      ].map(({k,l,c,bg})=>{
                        const active = filterStatus===k;
                        return (
                          <button key={k} onClick={()=>{setFilterStatus(active&&k!=="all"?"all":k);setLivResultFilter([]);}}
                            style={{flexShrink:0,background:active?c:bg,color:active?"#fff":c,border:`1.5px solid ${active?c:c+"55"}`,borderRadius:20,padding:"5px 11px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.13s"}}>
                            {l}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{fontSize:10,color:"#6B7280",fontWeight:700,marginBottom:6,letterSpacing:0.5}}>🏁 RÉSULTAT</div>
                    <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:2,WebkitOverflowScrolling:"touch"}}>
                      {[
                        {k:"entregado",  l:"Livré ✅",     c:STATUS.entregado.color,   bg:STATUS.entregado.color+"22"},
                        {k:"rechazado",  l:"Refusé ❌",    c:STATUS.rechazado.color,   bg:STATUS.rechazado.color+"22"},
                        {k:"no_contesta",l:"Absent 📵",    c:STATUS.no_contesta.color, bg:STATUS.no_contesta.color+"22"},
                        {k:"reprogramar",l:"Reporté ⏰",   c:STATUS.reprogramar.color, bg:STATUS.reprogramar.color+"22"},
                      ].map(({k,l,c,bg})=>{
                        const active = livResultFilter.includes(k);
                        return (
                          <button key={k} onClick={()=>{setLivResultFilter(prev=>prev.includes(k)?prev.filter(x=>x!==k):[...prev,k]);setFilterStatus("all");}}
                            style={{flexShrink:0,background:active?c:bg,color:active?"#fff":c,border:`1.5px solid ${active?c:c+"55"}`,borderRadius:20,padding:"5px 11px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.13s"}}>
                            {l}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {(tab==="commandes"||(tab==="livraisons"&&role==="livreur"))&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:2,marginBottom:2}}>
                <span style={{fontSize:12,fontWeight:700,color:G.gray,padding:"3px 0"}}>
                  {filteredOrders.length} commande{filteredOrders.length!==1?"s":""}
                </span>
              </div>
            )}
            {(localOrderIds.length>0||pinnedOrderIds.length>0)&&(
              <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:4}}>
                {pinnedOrderIds.length>0&&<button onClick={()=>setPinnedOrderIds([])} style={{background:"none",border:"none",color:G.gray,fontSize:11,cursor:"pointer",padding:"4px 8px",borderRadius:6,textDecoration:"underline dotted"}}>📌 Tout désépingler</button>}
                {localOrderIds.length>0&&<button onClick={()=>setLocalOrderIds([])} style={{background:"none",border:"none",color:G.gray,fontSize:11,cursor:"pointer",padding:"4px 8px",borderRadius:6,textDecoration:"underline dotted"}}>↺ Ordre par défaut</button>}
              </div>
            )}
            {filteredOrders.length===0&&(
              <div style={{textAlign:"center",padding:40,color:G.gray,background:G.white,borderRadius:14}}>
                <div style={{fontSize:32,marginBottom:8}}>🔍</div>
                <div style={{fontSize:14,fontWeight:600}}>Aucun résultat</div>
                <div style={{fontSize:12,marginTop:4}}>Modifie ta recherche ou tes filtres</div>
              </div>
            )}
            {(()=>{
              const GROUP_ORDER = ["confirmado","livreur_en_route","colis_pris","en_camino","chez_client","no_contesta","reprogramar","entregado","rechazado","pendiente"];
              const sortFn = (a,b) => {
                if(localOrderIds.length>0){
                  const ia=localOrderIds.indexOf(a.id), ib=localOrderIds.indexOf(b.id);
                  if(ia<0&&ib<0) return role==="livreur" ? new Date(a.created_at||0)-new Date(b.created_at||0) : new Date(b.created_at||0)-new Date(a.created_at||0);
                  if(ia<0) return 1; if(ib<0) return -1; return ia-ib;
                }
                return role==="livreur" ? new Date(a.created_at||0)-new Date(b.created_at||0) : new Date(b.created_at||0)-new Date(a.created_at||0);
              };

              // ── Livreur: pin en_camino/chez_client at top (from baseOrders — never filtered out) ──
              if(role==="livreur") {
                const LIV_PIN_STATUSES = new Set(["en_camino","chez_client"]);
                // Always find pin from baseOrders so active delivery is never hidden by filters
                const pinnedLiv  = baseOrders.find(o=>LIV_PIN_STATUSES.has(o.status)&&String(o.livreur_id)===String(currentUser.id));
                const activeOrds = filteredOrders.filter(o=>LIV_ACTIVE.has(o.status)&&o.id!==(pinnedLiv?.id)).sort(sortFn);
                const finalOrds  = filteredOrders.filter(o=>LIV_FINAL.has(o.status)).sort(sortFn);
                return (
                  <>
                    {/* 📌 LIVRAISON EN COURS — pinned en_camino */}
                    {pinnedLiv&&(
                      <div style={{marginBottom:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,margin:"4px 0 8px",paddingLeft:2}}>
                          <span style={{fontSize:11,fontWeight:700,color:G.green,letterSpacing:0.5}}>📌 LIVRAISON EN COURS</span>
                          <div style={{flex:1,height:1,background:`${G.green}33`}}/>
                        </div>
                        <div style={{position:"relative",borderLeft:`4px solid ${G.green}`,borderRadius:14,boxShadow:"0 4px 12px rgba(26,92,56,0.15)"}}>
                          <div style={{position:"absolute",top:10,right:10,zIndex:2,background:G.greenLight,color:G.green,padding:"4px 8px",fontSize:11,fontWeight:600,borderRadius:6,pointerEvents:"none"}}>📌 En cours</div>
                          <OCard o={pinnedLiv}/>
                        </div>
                      </div>
                    )}
                    {/* Autres livraisons */}
                    {activeOrds.length>0&&(
                      <div style={{marginBottom:8}}>
                        {pinnedLiv&&<div style={{display:"flex",alignItems:"center",gap:8,margin:"4px 0 8px",paddingLeft:2}}>
                          <span style={{fontSize:11,fontWeight:700,color:G.gray,letterSpacing:0.5}}>AUTRES LIVRAISONS</span>
                          <span style={{fontSize:11,color:G.gray}}>({activeOrds.length})</span>
                          <div style={{flex:1,height:1,background:"#6B728033"}}/>
                        </div>}
                        {!pinnedLiv&&<div style={{display:"flex",alignItems:"center",gap:8,margin:"4px 0 8px",paddingLeft:2}}>
                          <span style={{fontSize:13}}>🔥</span>
                          <span style={{fontSize:11,fontWeight:700,color:"#D97706",letterSpacing:0.3}}>TOURNÉE EN COURS</span>
                          <span style={{fontSize:11,color:G.gray}}>({activeOrds.length})</span>
                          <div style={{flex:1,height:1,background:"#D9770633"}}/>
                        </div>}
                        {activeOrds.map(o=><OCard key={o.id} o={o}/>)}
                      </div>
                    )}
                    {!pinnedLiv&&activeOrds.length===0&&(
                      <div style={{textAlign:"center",padding:"30px 16px",background:G.white,borderRadius:14,marginBottom:8}}>
                        <div style={{fontSize:28,marginBottom:6}}>✅</div>
                        <div style={{fontSize:13,fontWeight:700,color:G.dark}}>Aucune livraison active</div>
                        <div style={{fontSize:11,color:G.gray,marginTop:3}}>Toutes les livraisons du jour sont terminées</div>
                      </div>
                    )}
                    {/* Terminées */}
                    {finalOrds.length>0&&(
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,margin:"4px 0 8px",paddingLeft:2}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:"#6B7280",flexShrink:0}}/>
                          <span style={{fontSize:11,fontWeight:700,color:"#6B7280",letterSpacing:0.3}}>TERMINÉES</span>
                          <span style={{fontSize:11,color:G.gray}}>({finalOrds.length})</span>
                          <div style={{flex:1,height:1,background:"#6B728033"}}/>
                        </div>
                        {finalOrds.map(o=><OCard key={o.id} o={o}/>)}
                      </div>
                    )}
                  </>
                );
              }

              // ── Admin / closer: tri par created_at DESC ──
              const pinnedOrders = filteredOrders.filter(o=>pinnedOrderIds.includes(o.id)).sort((a,b)=>pinnedOrderIds.indexOf(a.id)-pinnedOrderIds.indexOf(b.id));
              const pinnedSet = new Set(pinnedOrders.map(o=>o.id));
              const sortedOrds = filteredOrders.filter(o=>!pinnedSet.has(o.id)).sort(sortFn);
              return (
                <>
                  {pinnedOrders.length>0&&(
                    <div style={{marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,margin:"4px 0 8px",paddingLeft:2}}>
                        <span style={{fontSize:13}}>📌</span>
                        <span style={{fontSize:11,fontWeight:700,color:"#F0A500",letterSpacing:0.3}}>ÉPINGLÉS</span>
                        <span style={{fontSize:11,color:G.gray}}>({pinnedOrders.length})</span>
                        <div style={{flex:1,height:1,background:"#F0A50033"}}/>
                      </div>
                      <div style={{display:isDesktop?"grid":"block",gridTemplateColumns:isWide?"1fr 1fr 1fr":"1fr 1fr",gap:10}}>
                        {pinnedOrders.map(o=><OCard key={o.id} o={o} showPrendre={true}/>)}
                      </div>
                    </div>
                  )}
                  <div style={{display:isDesktop?"grid":"block",gridTemplateColumns:isWide?"1fr 1fr 1fr":"1fr 1fr",gap:10}}>
                    {sortedOrds.map(o=><OCard key={o.id} o={o} showPrendre={true}/>)}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ── CLIENTS ── */}
        {dataReady&&tab==="clients"&&(role==="admin"||role==="closer")&&<ClientsPage/>}

        {/* ── LIVREURS / CARTE ── */}
        {dataReady&&tab==="tracking"&&(role==="admin"||role==="closer")&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* Statuts livreurs */}
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1,background:G.greenLight,borderRadius:12,padding:"11px 12px",textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:700,color:G.green}}>{orders.filter(o=>["livreur_en_route","colis_pris","en_camino","chez_client"].includes(o.status)).length}</div>
                <div style={{fontSize:11,color:G.gray}}>Livraisons actives</div>
              </div>
              <div style={{flex:1,background:"#EFF6FF",borderRadius:12,padding:"11px 12px",textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:700,color:G.blue}}>{[...new Set(orders.filter(o=>o.livreur&&["livreur_en_route","colis_pris","en_camino","chez_client"].includes(o.status)).map(o=>o.livreur))].length}</div>
                <div style={{fontSize:11,color:G.gray}}>Livreurs actifs</div>
              </div>
            </div>

            {/* Carte Leaflet — prioritaire */}
            <div style={{background:G.white,borderRadius:14,overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.08)"}}>
              <div style={{padding:"12px 14px",borderBottom:`1px solid ${G.grayLight}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontWeight:700,fontSize:13,color:G.green}}>📍 Positions en temps réel</div>
                <div style={{fontSize:11,color:G.green,background:G.greenLight,borderRadius:6,padding:"2px 8px",fontWeight:600}}>
                  {Object.keys(livreurPositions).filter(k=>livreurPositions[k]?.lat).length} actif(s)
                </div>
              </div>
              {(()=>{
                const teamNoms = new Set(teamMembers.filter(m=>m.role==="livreur").map(m=>m.nom));
                const activePosns = Object.fromEntries(Object.entries(livreurPositions).filter(([k,v])=>v?.lat && teamNoms.has(k)));
                return Object.keys(activePosns).length===0
                  ? <div style={{padding:30,textAlign:"center",color:G.gray,fontSize:13}}>Aucun livreur GPS actif pour le moment</div>
                  : <MapView positions={activePosns} role="admin" isDesktop={isDesktop}/>;
              })()}
            </div>

            {/* Liste livreurs avec leurs livraisons actives */}
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <div style={{fontWeight:700,fontSize:13,color:G.green,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${G.grayLight}`}}>🏍️ LIVREURS</div>
              {teamMembers.filter(m=>m.role==="livreur").map((m,i)=>{
                const name=m.nom;
                const active = orders.filter(o=>o.livreur_id===m.id&&["confirmado","livreur_en_route","colis_pris","en_camino","chez_client"].includes(o.status));
                const pos = livreurPositions[name];
                const livreurs=teamMembers.filter(x=>x.role==="livreur");
                return (
                  <div key={i} style={{padding:"10px 0",borderBottom:i<livreurs.length-1?`1px solid ${G.grayLight}`:"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:active.length>0?6:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:G.dark}}>🏍️ {name}</div>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        {pos?<div style={{width:8,height:8,borderRadius:"50%",background:G.green,boxShadow:"0 0 0 3px #BBF7D0"}}/>:<div style={{width:8,height:8,borderRadius:"50%",background:"#D1D5DB"}}/>}
                        <span style={{fontSize:11,fontWeight:600,color:pos?G.green:G.gray}}>{pos?`GPS actif${pos.city?" · "+pos.city:""}` :"Hors ligne"}</span>
                        {active.length>0&&<span style={{background:"#EFF6FF",color:G.blue,borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>{active.length} livr.</span>}
                      </div>
                    </div>
                    {active.map((o,j)=>(
                      <div key={j} style={{background:G.grayLight,borderRadius:8,padding:"6px 10px",fontSize:11,color:G.dark,marginBottom:3}}>
                        <span style={{fontWeight:600}}>{o.client}</span>
                        <span style={{color:G.gray}}> · {STATUS[o.status]?.label||o.status}</span>
                        <span style={{float:"right",fontWeight:700,color:G.green}}>{Number(o.price).toLocaleString("fr-FR")} CFA</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MA POSITION — Livreur ── */}
        {tab==="position"&&role==="livreur"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* Bouton partager position réelle — sauvegarde aussi dans Supabase */}
            <button onClick={()=>{
              if(!navigator.geolocation){ setGpsError("GPS non disponible sur cet appareil"); return; }
              addToast("Localisation en cours…","📍","#0284C7");
              navigator.geolocation.getCurrentPosition(
                async(pos)=>{
                  const lat=pos.coords.latitude, lng=pos.coords.longitude;
                  let city="";
                  try {
                    const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                    const gd  = await geo.json();
                    city = gd.address?.city||gd.address?.town||gd.address?.village||gd.address?.county||"";
                  } catch(e){}
                  setGpsPos({lat,lng,accuracy:Math.round(pos.coords.accuracy||0)});
                  setLivreurPositions(p=>({...p,[currentUser.nom]:{lat,lng,name:currentUser.nom,city,order:"En livraison"}}));
                  // Sauvegarder dans Supabase pour que l'Admin voie la position
                  sbFetch(`profiles?id=eq.${currentUser.id}`,"PATCH",{lat,lng,city},_authToken)
                    .then(()=>addToast("📍 Position partagée avec l'Admin !","📍",G.green))
                    .catch(()=>addToast("Position locale OK — erreur de sync","⚠️","#F59E0B"));
                },
                (err)=>{
                  const msgs={1:"Accès refusé — autorisez la localisation",2:"Signal GPS faible",3:"Délai dépassé"};
                  setGpsError(msgs[err.code]||"Erreur GPS");
                },
                {enableHighAccuracy:true,timeout:10000,maximumAge:0}
              );
            }} style={{background:"#0284C7",color:G.white,border:"none",borderRadius:14,padding:"16px 0",fontWeight:800,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
              📍 Partager ma position maintenant
            </button>

            {/* Explication GPS */}
            <div style={{background:"#EFF6FF",borderRadius:12,padding:"12px 14px",border:"1px solid #BFDBFE",fontSize:11,color:"#1D4ED8"}}>
              <div style={{fontWeight:700,marginBottom:4}}>📱 Comment ça fonctionne</div>
              <div style={{lineHeight:1.6}}>
                1. Sur votre <strong>téléphone</strong>, appuyez sur "Démarrer le GPS"<br/>
                2. Autorisez la localisation quand le navigateur demande<br/>
                3. L'Admin voit votre position sur sa carte en temps réel<br/>
                <span style={{color:"#3B82F6",fontStyle:"italic"}}>⚠️ Le GPS est bloqué dans l'aperçu Claude — fonctionne sur Chrome/Safari mobile</span>
              </div>
            </div>

            {/* Bouton GPS */}
            <div style={{background:G.white,borderRadius:14,padding:20,textAlign:"center"}}>
              <div style={{fontSize:44,marginBottom:10}}>{gpsActive?"📡":"📍"}</div>
              <div style={{fontWeight:700,fontSize:16,color:G.dark,marginBottom:6}}>
                {gpsActive?"GPS Actif ✅":"GPS Inactif"}
              </div>
              <div style={{fontSize:12,color:G.gray,marginBottom:16,lineHeight:1.5}}>
                {gpsActive?"L'Admin peut voir ta position en temps réel":"Active le GPS pendant tes livraisons"}
              </div>
              {gpsError&&(
                <div style={{background:"#FEE2E2",borderRadius:10,padding:"10px 12px",marginBottom:12,fontSize:11,color:G.red,textAlign:"left"}}>
                  ⚠️ {gpsError}
                </div>
              )}
              {gpsPos&&(
                <div style={{background:G.greenLight,borderRadius:10,padding:"10px 12px",marginBottom:14,fontSize:12,color:G.green,fontWeight:600,textAlign:"left"}}>
                  📍 {livreurPositions[currentUser.nom]?.city||`${gpsPos.lat.toFixed(4)}°, ${gpsPos.lng.toFixed(4)}°`}
                  <div style={{fontSize:10,color:"#4B7A5A",fontWeight:400,marginTop:2}}>Précision ±{gpsPos.accuracy}m · Partagé avec l'Admin ✅</div>
                </div>
              )}
              <button onClick={()=>{
                if(gpsActive) {
                  try { if(gpsWatchRef.current) navigator.geolocation.clearWatch(gpsWatchRef.current); } catch(e){}
                  try { localStorage.setItem(`teamly_gps_off_${currentUser.id}`,"true"); } catch(e){}
                  setGpsActive(false); setGpsPos(null); setGpsError("");
                } else {
                  if(!navigator?.geolocation) { setGpsError("GPS non disponible — utilisez Chrome ou Safari sur votre téléphone"); return; }
                  setGpsError("");
                  try {
                    gpsWatchRef.current = navigator.geolocation.watchPosition(
                      async pos => {
                        const {latitude:lat,longitude:lng,accuracy} = pos.coords;
                        setGpsPos({lat,lng,accuracy:Math.round(accuracy)});
                        // Reverse geocoding — ciudad real
                        let city = "";
                        try {
                          const geo = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                          const gd  = await geo.json();
                          city = gd.address?.city||gd.address?.town||gd.address?.village||gd.address?.county||gd.address?.state||"";
                        } catch(e){}
                        // Guardar en Supabase con el token de l'utilisateur
                        sbFetch(`profiles?id=eq.${currentUser.id}`,"PATCH",{lat,lng,city},_authToken).catch(()=>{});
                        setLivreurPositions(p=>({...p,[currentUser.nom]:{lat,lng,name:currentUser.nom,city,order:"En livraison"}}));
                      },
                      err => {
                        const msgs={1:"Accès refusé — autorisez la localisation dans votre navigateur",2:"Signal GPS faible",3:"Délai dépassé — réessayez"};
                        setGpsError(msgs[err.code]||"Erreur GPS");
                        setGpsActive(false);
                      },
                      {enableHighAccuracy:true,timeout:15000,maximumAge:10000}
                    );
                    try { localStorage.removeItem(`teamly_gps_off_${currentUser.id}`); } catch(e){}
                    setGpsActive(true);
                  } catch(e) { setGpsError("GPS non disponible dans cet environnement"); }
                }
              }} style={{width:"100%",background:gpsActive?"#DC2626":G.green,color:G.white,border:"none",borderRadius:12,padding:"14px 0",fontWeight:700,fontSize:15,cursor:"pointer"}}>
                {gpsActive?"⏹️ Arrêter le GPS":"▶️ Activer le GPS"}
              </button>
            </div>

            {/* Carte position livreur — position uniquement, pas de route ni destination */}
            {gpsPos&&(
              <div style={{background:G.white,borderRadius:14,overflow:"hidden"}}>
                <div style={{padding:"10px 14px",borderBottom:`1px solid ${G.grayLight}`,fontWeight:700,fontSize:13,color:G.green}}>📍 Équipe en temps réel</div>
                <MapView positions={{
                  ...Object.fromEntries(Object.entries(livreurPositions).filter(([k,v])=>v?.lat&&teamMembers.some(m=>m.role==="livreur"&&m.nom===k))),
                  [currentUser.nom]:{...gpsPos,name:currentUser.nom,order:"Ma position"},
                }} role="livreur" isDesktop={isDesktop}/>
              </div>
            )}

            {/* Livraisons en cours */}
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <div style={{fontWeight:700,fontSize:13,color:G.green,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${G.grayLight}`}}>📦 MES LIVRAISONS</div>
              {myLiv.filter(o=>!["entregado","rechazado","no_contesta","reprogramar"].includes(o.status)).length===0
                ?<div style={{fontSize:13,color:G.gray,textAlign:"center",padding:"16px 0"}}>Aucune livraison en cours</div>
                :myLiv.filter(o=>!["entregado","rechazado","no_contesta","reprogramar"].includes(o.status)).map(o=>(
                  <div key={o.id} style={{padding:"9px 0",borderBottom:`1px solid ${G.grayLight}`}}>
                    <div style={{fontWeight:700,fontSize:13}}>{o.client}</div>
                    <div style={{fontSize:11,color:G.gray}}>📍 {fullAddr(o)}</div>
                    <div style={{fontSize:12,fontWeight:700,color:G.green,marginTop:2}}>{fmt(o.price)} CFA</div>
                  </div>
                ))
              }
            </div>
          </div>
        )}


        {/* ── ÉQUIPE ── */}
        {dataReady&&tab==="equipe"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* Vue simplifiée pour le Livreur — contacts équipe */}
            {role==="livreur"&&(
              <>
                <div style={{background:G.greenLight,borderRadius:12,padding:"10px 14px",fontSize:12,color:G.green,fontWeight:600}}>
                  👥 Les contacts de ton équipe
                </div>

                {/* Admin */}
                <div style={{background:G.white,borderRadius:14,padding:14}}>
                  <div style={{fontWeight:700,fontSize:13,color:G.green,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${G.grayLight}`}}>👑 ADMIN</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:G.dark}}>👑 {settings.nom||"Admin"}</div>
                      <div style={{fontSize:10,color:G.gold,marginTop:2,fontWeight:600}}>Responsable de la boutique</div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <a href={`tel:+${settings.whatsapp||""}`}
                        style={{background:"#FFF8E7",color:G.gold,borderRadius:10,padding:"8px 12px",fontSize:13,textDecoration:"none",fontWeight:700,border:`1px solid ${G.gold}`}}>
                        📞
                      </a>
                      <a href={`https://wa.me/${settings.whatsapp}`} target="_blank" rel="noreferrer"
                        style={{background:"#25D366",color:"#FFF",borderRadius:10,padding:"8px 12px",fontSize:13,textDecoration:"none",fontWeight:700}}>
                        💬
                      </a>
                    </div>
                  </div>
                </div>

                {/* Closers */}
                <div style={{background:G.white,borderRadius:14,padding:14}}>
                  <div style={{fontWeight:700,fontSize:13,color:G.green,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${G.grayLight}`}}>📞 CLOSERS</div>
                  {teamMembers.filter(m=>m.role==="closer").map((m,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<teamMembers.filter(m=>m.role==="closer").length-1?`1px solid ${G.grayLight}`:"none"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:G.dark}}>📞 {m.nom}</div>
                        {m.email!==currentUser.email&&<div style={{fontSize:11,color:G.gray,marginTop:2}}>📱 {m.phone}</div>}
                      </div>
                      {m.email!==currentUser.email&&(
                        <div style={{display:"flex",gap:5}}>
                          <a href={`tel:+221${m.phone}`} style={{background:G.greenLight,color:G.green,borderRadius:10,padding:"8px 11px",fontSize:13,textDecoration:"none",fontWeight:700}}>📞</a>
                          <a href={`https://wa.me/221${m.phone?.replace(/\s+/g,"")}`} target="_blank" rel="noreferrer" style={{background:"#25D366",color:"#FFF",borderRadius:10,padding:"8px 11px",fontSize:13,textDecoration:"none",fontWeight:700}}>💬</a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Livreurs */}
                <div style={{background:G.white,borderRadius:14,padding:14}}>
                  <div style={{fontWeight:700,fontSize:13,color:G.green,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${G.grayLight}`}}>🏍️ LIVREURS</div>
                  {teamMembers.filter(m=>m.role==="livreur").map((m,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<teamMembers.filter(m=>m.role==="livreur").length-1?`1px solid ${G.grayLight}`:"none"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:m.email===currentUser.email?G.green:G.dark}}>
                          🏍️ {m.nom} {m.email===currentUser.email&&<span style={{fontSize:10,color:G.green,fontWeight:600}}>(toi)</span>}
                        </div>
                        {m.email!==currentUser.email&&<div style={{fontSize:11,color:G.gray,marginTop:2}}>📱 {m.phone}</div>}
                      </div>
                      {m.email!==currentUser.email&&(
                        <div style={{display:"flex",gap:5}}>
                          <a href={`tel:+221${m.phone}`} style={{background:"#EFF6FF",color:G.blue,borderRadius:10,padding:"8px 11px",fontSize:13,textDecoration:"none",fontWeight:700}}>📞</a>
                          <a href={`https://wa.me/221${m.phone?.replace(/\s+/g,"")}`} target="_blank" rel="noreferrer" style={{background:"#25D366",color:"#FFF",borderRadius:10,padding:"8px 11px",fontSize:13,textDecoration:"none",fontWeight:700}}>💬</a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Admin/Closer — full view with stats + actions */}
            {(role==="admin"||role==="closer")&&(
              <>
            {/* Admin card */}
            <div style={{background:`linear-gradient(135deg,${G.green},${G.greenDark||"#0D3D25"})`,borderRadius:14,padding:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:800,fontSize:15,color:G.gold}}>👑 {settings.nom||"Admin"}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2}}>Responsable boutique · Admin</div>
              </div>
            </div>

            {/* Closers */}
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <div style={{fontWeight:700,fontSize:13,color:G.green,marginBottom:12,paddingBottom:6,borderBottom:`1px solid ${G.grayLight}`}}>📞 CLOSERS</div>
              {teamMembers.filter(m=>m.role==="closer").map((m,i)=>{
                const all=orders.filter(o=>o.closer_id===m.id);
                return(
                  <div key={i} style={{padding:"12px 0",borderBottom:i<teamMembers.filter(m=>m.role==="closer").length-1?`1px solid ${G.grayLight}`:"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,color:G.dark}}>📞 {m.nom}</div>
                        <div style={{fontSize:11,color:G.gray,marginTop:2}}>{m.email!==currentUser.email&&`📱 ${m.phone} · `}📧 {m.email}</div>
                      </div>
                      <div style={{display:"flex",gap:5,alignItems:"center"}}>
                        {m.email!==currentUser.email&&<a href={`tel:+221${m.phone}`} style={{background:G.greenLight,color:G.green,borderRadius:8,padding:"5px 9px",fontSize:14,textDecoration:"none"}}>📞</a>}
                        {m.email!==currentUser.email&&<a href={`https://wa.me/221${m.phone?.replace(/\s+/g,"")}`} target="_blank" rel="noreferrer" style={{background:"#25D366",color:"#FFF",borderRadius:8,padding:"5px 9px",fontSize:14,textDecoration:"none"}}>💬</a>}
                        {isOwner&&<button onClick={()=>setMemberModal(m)} style={{background:G.grayLight,color:G.dark,border:"none",borderRadius:8,padding:"5px 9px",fontSize:12,cursor:"pointer",fontWeight:600}}>✏️</button>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      {[{l:"Livrées",v:all.filter(o=>o.status==="entregado").length,c:G.green,bg:G.greenLight},{l:"Rejetées",v:all.filter(o=>o.status==="rechazado").length,c:G.red,bg:"#FEE2E2"},{l:"Total",v:all.length,c:G.gray,bg:G.grayLight}].map(s=>(
                        <div key={s.l} style={{flex:1,background:s.bg,borderRadius:8,padding:"6px 0",textAlign:"center"}}>
                          <div style={{fontSize:16,fontWeight:700,color:s.c}}>{s.v}</div>
                          <div style={{fontSize:10,color:G.gray}}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Livreurs */}
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <div style={{fontWeight:700,fontSize:13,color:G.green,marginBottom:12,paddingBottom:6,borderBottom:`1px solid ${G.grayLight}`}}>🏍️ LIVREURS</div>
              {teamMembers.filter(m=>m.role==="livreur").map((m,i)=>{
                const all=orders.filter(o=>o.livreur_id===m.id);
                const gains=all.filter(o=>o.status==="entregado").reduce((a,o)=>a+o.price,0);
                return(
                  <div key={i} style={{padding:"12px 0",borderBottom:i<teamMembers.filter(m=>m.role==="livreur").length-1?`1px solid ${G.grayLight}`:"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,color:m.email===currentUser.email?G.green:G.dark}}>🏍️ {m.nom}{m.email===currentUser.email&&<span style={{fontSize:10,color:G.green,marginLeft:6}}>(moi)</span>}</div>
                        {m.email!==currentUser.email&&<div style={{fontSize:11,color:G.gray,marginTop:2}}>📱 {m.phone} · 📧 {m.email}</div>}
                      </div>
                      <div style={{display:"flex",gap:5,alignItems:"center"}}>
                        {m.email!==currentUser.email&&<a href={`tel:+221${m.phone}`} style={{background:G.greenLight,color:G.green,borderRadius:8,padding:"5px 9px",fontSize:14,textDecoration:"none"}}>📞</a>}
                        {m.email!==currentUser.email&&<a href={`https://wa.me/221${m.phone?.replace(/\s+/g,"")}`} target="_blank" rel="noreferrer" style={{background:"#25D366",color:"#FFF",borderRadius:8,padding:"5px 9px",fontSize:14,textDecoration:"none"}}>💬</a>}
                        {isOwner&&<button onClick={()=>setMemberModal(m)} style={{background:G.grayLight,color:G.dark,border:"none",borderRadius:8,padding:"5px 9px",fontSize:12,cursor:"pointer",fontWeight:600}}>✏️</button>}
                      </div>
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:G.green,marginBottom:6}}>{fmt(gains)} CFA encaissés</div>
                    <div style={{display:"flex",gap:6}}>
                      {[{l:"Livrées",v:all.filter(o=>o.status==="entregado").length,c:G.green,bg:G.greenLight},{l:"En route",v:all.filter(o=>["livreur_en_route","colis_pris","en_camino","chez_client"].includes(o.status)).length,c:G.blue,bg:"#EFF6FF"},{l:"Rejetées",v:all.filter(o=>o.status==="rechazado").length,c:G.red,bg:"#FEE2E2"}].map(s=>(
                        <div key={s.l} style={{flex:1,background:s.bg,borderRadius:8,padding:"6px 0",textAlign:"center"}}>
                          <div style={{fontSize:16,fontWeight:700,color:s.c}}>{s.v}</div>
                          <div style={{fontSize:10,color:G.gray}}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Inviter un membre (toujours visible, grisé si limite atteinte) ── */}
            {(()=>{
              const curPlan = PLANS.find(p=>p.key===settings.plan)||(isPro?PLANS.find(p=>p.key==="basic"):PLANS[0])||PLANS[0];
              const membersUsed = teamMembers.length + 1;
              const atLimit = curPlan.maxMembers && membersUsed >= curPlan.maxMembers;
              return (
                <div style={{background:G.white,borderRadius:14,padding:14,marginTop:4}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontWeight:700,fontSize:13,color:G.dark}}>➕ Inviter un membre</div>
                    <div style={{fontSize:11,color:atLimit?G.red:G.gray,fontWeight:600}}>
                      {membersUsed}/{curPlan.maxMembers||"∞"} membres
                    </div>
                  </div>
                  {atLimit&&(
                    <div style={{background:"#FEF3C7",borderRadius:8,padding:"7px 10px",marginBottom:10,fontSize:11,color:"#92400E"}}>
                      ⚠️ Limite {curPlan.name} atteinte — passe au plan supérieur pour inviter plus
                    </div>
                  )}
                  <div style={{display:"flex",gap:8}}>
                    {[{role:"closer",label:"📞 Closer"},{role:"livreur",label:"🏍️ Livreur"}].map(r=>(
                      <button key={r.role} onClick={()=>{
                        if(atLimit){ setShowPlanModal(true); return; }
                        const token=Math.random().toString(36).substring(2,10).toUpperCase();
                        const link=`${window.location.origin}?org=${orgId}&role=${r.role}&token=${token}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(`Bonjour ! Rejoins mon équipe sur Teamly:\n${link}`)}`,"_blank");
                      }} style={{
                        flex:1,
                        background:atLimit?"#D1D5DB":"#25D366",
                        color:atLimit?"#9CA3AF":"#fff",
                        border:"none",borderRadius:9,padding:"10px 0",
                        fontSize:12,fontWeight:700,cursor:"pointer",
                        opacity:atLimit?0.7:1,
                      }}>
                        {r.label} {atLimit?"🔒":"📲"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            </>
            )} {/* end admin/closer */}
          </div>
        )}

        {/* ── COMPTA locked screen for closer without permission ── */}
        {dataReady&&tab==="compta"&&role==="closer"&&!pC.closerCompta&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:320,gap:16,padding:24}}>
            <div style={{width:72,height:72,borderRadius:"50%",background:"#F3F4F6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34}}>🔒</div>
            <div style={{fontWeight:800,fontSize:17,color:"#374151",textAlign:"center"}}>Comptabilité bloquée</div>
            <div style={{fontSize:13,color:"#6B7280",textAlign:"center",maxWidth:260,lineHeight:1.5}}>Demande à ton admin d'activer l'accès à la comptabilité dans ses paramètres.</div>
            <div style={{background:"#F0FDF4",borderRadius:12,padding:"10px 16px",border:"1px solid #BBF7D0",fontSize:12,color:"#15803D",textAlign:"center",maxWidth:280}}>
              ✅ Paramètres → Permission Closer → Activer Comptabilité
            </div>
          </div>
        )}

        {/* ── COMPTA ── */}
        {dataReady&&tab==="compta"&&canSeeCompta&&<ComptaPage/>}

        {/* ── STOCK ── */}
        {dataReady&&tab==="stock"&&(role==="admin"||role==="closer")&&<StockPage/>}

        {/* ── NOTIFICATIONS ── */}
        {tab==="notifications"&&(()=>{
          // Build grouped notifications
          const NOTIFS_ADMIN = [
            ...orders.filter(o=>o.status==="confirmado"&&!o.livreur).map(o=>({key:`noLiv_${o.id}`,type:"noLiv",icon:"🏍️",title:"Sans livreur",body:o.client,color:"#F0A500",bg:"#FFF8E7",id:o.id,phone:o.phone,time:"à l'instant"})),
            ...orders.filter(o=>o.status==="entregado").slice(-5).map(o=>({key:`liv_${o.id}`,type:"livre",icon:"✅",title:"Encaissé",body:`${o.client} — ${Number(o.price).toLocaleString("fr-FR")} CFA`,color:G.green,bg:"#D1FAE5",id:o.id,phone:o.phone,time:"aujourd'hui"})),
            ...orders.filter(o=>o.status==="rechazado").map(o=>({key:`rej_${o.id}`,type:"rejet",icon:"❌",title:"Commande rejetée",body:o.client,color:G.red,bg:"#FEE2E2",id:o.id,phone:o.phone,time:"aujourd'hui"})),
            ...orders.filter(o=>["no_contesta","reprogramar"].includes(o.status)).map(o=>({key:`ret_${o.id}`,type:"retour",icon:"🔄",title:"À retenter",body:o.client,color:"#7C3AED",bg:"#EDE9FE",id:o.id,phone:o.phone,time:"aujourd'hui"})),
            ...products.filter(p=>p.stock<5).map(p=>({key:`stock_${p.id}`,type:"stock",icon:"📦",title:"Stock bas",body:`${p.name} — ${p.stock} restants`,color:G.red,bg:"#FEE2E2",id:p.id,time:"maintenant"})),
          ];
          const NOTIFS_LIVREUR = [
            ...myLiv.filter(o=>o.status==="en_camino"||o.status==="colis_pris"||o.status==="livreur_en_route").map(o=>({key:`enc_${o.id}`,type:"encours",icon:"🚀",title:"En cours",body:`${o.client} · ${o.address}`,color:G.blue,bg:"#DBEAFE",id:o.id,phone:o.phone,price:o.price,time:"en cours"})),
          ];

          const allNotifs = role==="livreur" ? NOTIFS_LIVREUR : NOTIFS_ADMIN;

          // Group by type
          const grouped = {};
          allNotifs.forEach(n=>{
            if(!grouped[n.type]) grouped[n.type]=[];
            grouped[n.type].push(n);
          });


          const visible = allNotifs.filter(n=>!dismissedNotifs.has(n.key));

          return (
          <div style={{display:"flex",flexDirection:"column",gap:0}}>

            {/* Header barre */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:16,color:G.dark}}>
                Notifications
                {visible.length>0&&<span style={{background:G.red,color:G.white,borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700,marginLeft:8}}>{visible.length}</span>}
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {visible.length>0&&(
                  <button onClick={()=>setDismissedNotifs(new Set(allNotifs.map(n=>n.key)))}
                    style={{background:"none",border:"none",color:G.gray,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>
                    Tout effacer
                  </button>
                )}
                <button onClick={()=>setShowNotifSettings(v=>!v)}
                  style={{background:showNotifSettings?G.green:G.grayLight,color:showNotifSettings?G.white:G.gray,border:"none",borderRadius:10,width:36,height:36,cursor:"pointer",fontSize:16}}>
                  ⚙️
                </button>
              </div>
            </div>

            {/* Panneau paramètres */}
            {showNotifSettings&&(
              <div style={{background:G.white,borderRadius:14,padding:14,marginBottom:14,border:`1px solid ${G.grayLight}`}}>
                <div style={{fontWeight:700,fontSize:13,color:G.dark,marginBottom:10}}>Paramètres notifications</div>
                {(role==="livreur"?[
                  {key:"notifLivre",   label:"✅ Livraison confirmée"},
                  {key:"notifRejet",   label:"❌ Commande rejetée"},
                  {key:"notifRetour",  label:"🔄 À retenter"},
                  {key:"notifChat",    label:"💬 Nouveau message"},
                ]:[
                  {key:"notifSansLivreur", label:"🏍️ Sans livreur"},
                  {key:"notifRejet",       label:"❌ Commande rejetée"},
                  {key:"notifLivre",       label:"✅ Commande encaissée"},
                  {key:"notifRetour",      label:"🔄 À retenter"},
                  {key:"notifChat",        label:"💬 Nouveau message"},
                  {key:"notifStock",       label:"📦 Stock bas"},
                ]).map(n=>(
                  <div key={n.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${G.grayLight}`}}>
                    <span style={{fontSize:13,color:G.dark}}>{n.label}</span>
                    <button onClick={()=>setSettings(s=>({...s,[n.key]:!s[n.key]}))}
                      style={{background:settings[n.key]?G.green:G.grayLight,border:"none",borderRadius:20,width:40,height:22,cursor:"pointer",position:"relative",flexShrink:0}}>
                      <div style={{position:"absolute",top:2,left:settings[n.key]?20:2,width:18,height:18,background:G.white,borderRadius:"50%",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Liste notifications */}
            {visible.length===0?(
              <div style={{textAlign:"center",padding:"40px 0",color:G.gray}}>
                <div style={{fontSize:44,marginBottom:10}}>🔔</div>
                <div style={{fontSize:15,fontWeight:700,color:G.dark}}>Aucune notification</div>
                <div style={{fontSize:12,marginTop:4}}>Tout est à jour ✅</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {Object.entries(grouped).map(([type,items])=>{
                  const first=items[0];
                  const count=items.length;
                  const isGrouped=count>1;
                  const notDismissed=items.filter(n=>!dismissedNotifs.has(n.key));
                  if(notDismissed.length===0) return null;
                  return (
                    <div key={type} style={{background:G.white,borderRadius:14,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                      {/* Group header */}
                      <div style={{background:first.bg,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,borderLeft:`4px solid ${first.color}`}}>
                        <span style={{fontSize:22,flexShrink:0}}>{first.icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:14,color:G.dark}}>
                            {first.title}
                            {notDismissed.length>1&&<span style={{background:first.color,color:G.white,borderRadius:20,padding:"1px 8px",fontSize:11,fontWeight:700,marginLeft:6}}>{notDismissed.length}</span>}
                          </div>
                        </div>
                        <button onClick={()=>setDismissedNotifs(d=>new Set([...d,...notDismissed.map(n=>n.key)]))}
                          style={{background:"none",border:"none",color:"#9CA3AF",fontSize:18,cursor:"pointer",padding:"2px 6px"}}>
                          ×
                        </button>
                      </div>
                      {/* Items */}
                      {notDismissed.map((n,i)=>(
                        <div key={n.key} style={{padding:"10px 14px",borderBottom:i<notDismissed.length-1?`1px solid ${G.grayLight}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:600,color:G.dark}}>{n.body}</div>
                            {n.price&&<div style={{fontSize:12,color:G.green,fontWeight:700,marginTop:1}}>{Number(n.price).toLocaleString("fr-FR")} CFA</div>}
                            <div style={{fontSize:10,color:G.gray,marginTop:1}}>{n.time}</div>
                          </div>
                          <div style={{display:"flex",gap:6,alignItems:"center"}}>
                            {n.phone&&<a href={`tel:+221${n.phone.replace(/\s+/g,"")}`} style={{background:G.greenLight,color:G.green,borderRadius:8,padding:"5px 8px",fontSize:14,textDecoration:"none"}}>📞</a>}
                            <button onClick={()=>setDismissedNotifs(d=>new Set([...d,n.key]))}
                              style={{background:"none",border:"none",color:"#D1D5DB",fontSize:16,cursor:"pointer",padding:"2px 6px"}}>
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Barre chat fixe en bas de la section Équipe ── */}
            <div onClick={()=>setTab("chat")} style={{marginTop:8,background:"linear-gradient(135deg,#25D366,#128C7E)",borderRadius:16,padding:"16px 20px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",boxShadow:"0 6px 20px rgba(37,211,102,0.3)",position:"relative",overflow:"hidden"}}>
              <div style={{width:46,height:46,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:800,fontSize:14,color:"#fff",marginBottom:2}}>Chat de l'équipe</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.75)"}}>{teamMembers.length+1} membres · Discutez en temps réel</div>
              </div>
              {chatUnread>0&&<div style={{background:"#fff",color:"#25D366",borderRadius:"50%",width:24,height:24,fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{chatUnread}</div>}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>

          </div>
          );
        })()}
        {/* ── CHAT ── */}
        {dataReady&&tab==="chat"&&(()=>{
          const startRecord = async() => {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({audio:true});
              const mime = ["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg"].find(t=>MediaRecorder.isTypeSupported(t))||"";
              const mr = new MediaRecorder(stream, mime?{mimeType:mime}:{});
              const chunks = [];
              mr.ondataavailable = e => chunks.push(e.data);
              mr.onstop = () => {
                isRecordingRef.current = false;
                sendAudioBlob(new Blob(chunks,{type:mr.mimeType||"audio/webm"}), recordSecs);
                stream.getTracks().forEach(t=>t.stop());
                setIsRecording(false); setRecordSecs(0); clearInterval(audioTimerRef.current);
              };
              mr.start(); mediaRecorderRef.current = mr;
              isRecordingRef.current = true;
              setIsRecording(true); setRecordSecs(0);
              audioTimerRef.current = setInterval(()=>setRecordSecs(s=>s+1),1000);
            } catch(e){ addToast("Microphone non disponible","🎤",G.red); }
          };
          // Use ref (not state) to avoid stale closure — onMouseUp fires before React re-renders
          const stopRecord = () => {
            if(mediaRecorderRef.current && isRecordingRef.current) {
              isRecordingRef.current = false;
              mediaRecorderRef.current.stop();
            }
          };
          const ROLE_COLOR = {admin:G.gold, closer:"#7C3AED", livreur:"#0284C7"};

          const hasBottomBar = !isDesktop; // all roles have tab bar on mobile
          const chatH = isDesktop
            ? "calc(100vh - 54px)"
            : "calc(100dvh - 58px - env(safe-area-inset-top, 0px) - 54px - env(safe-area-inset-bottom, 0px))";
          const chatMargin = isDesktop ? "-24px -24px -24px" : "-14px -14px 0px";

          return (
          <div style={{display:"flex",flexDirection:"column",margin:chatMargin,height:chatH,position:"relative",overflow:"hidden"}}>

            {/* Header groupe style WhatsApp */}
            <div style={{background:G.green,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
              <button onClick={()=>setTab("dashboard")} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"50%",width:36,height:36,color:G.white,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>←</button>
              <div style={{width:42,height:42,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>👥</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14,color:G.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Chat de mon équipe · {settings.boutique}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginTop:1}}>
                  {teamMembers.length+1} membres · Admin{teamMembers.filter(m=>m.role==="closer").length>0?` · ${teamMembers.filter(m=>m.role==="closer").length} closer`:""}
                  {teamMembers.filter(m=>m.role==="livreur").length>0?` · ${teamMembers.filter(m=>m.role==="livreur").length} livreur`:""}</div>
              </div>
            </div>

            {/* Zone messages */}
            <div ref={chatScrollRef}
              onScroll={()=>{
                const el = chatScrollRef.current;
                if(!el) return;
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                if(atBottom) setChatShowNew(false);
              }}
              style={{flex:1,minHeight:0,overflowY:"auto",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain",padding:"10px 12px",display:"flex",flexDirection:"column",gap:1,background:"#ECE5DD"}}>
              {chatLoading&&chat.length===0&&(
                <div style={{display:"flex",flexDirection:"column",gap:10,padding:"12px 4px"}}>
                  {[1,2,3,4].map((i)=>(
                    <div key={i} style={{display:"flex",gap:8,justifyContent:i%2===0?"flex-end":"flex-start",alignItems:"flex-end"}}>
                      {i%2!==0&&<div style={{width:32,height:32,borderRadius:"50%",background:"#D1D5DB",flexShrink:0,animation:"pulse 1.4s ease-in-out infinite"}}/>}
                      <div style={{background:"#D1D5DB",borderRadius:i%2===0?"16px 16px 4px 16px":"4px 16px 16px 16px",width:`${50+i*15}%`,maxWidth:220,height:40,animation:`pulse 1.4s ease-in-out ${i*0.15}s infinite`}}/>
                    </div>
                  ))}
                </div>
              )}
              {!chatLoading&&chat.length===0&&(
                <div style={{textAlign:"center",padding:40,color:"#8a9a8a",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
                  <div style={{fontSize:36}}>💬</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#555"}}>Aucun message</div>
                  <div style={{fontSize:11}}>Soyez le premier à écrire !</div>
                  <button onClick={()=>{ setChatLoading(true); loadChatRef.current?.(true); }}
                    style={{marginTop:8,background:G.green,color:"#fff",border:"none",borderRadius:20,padding:"8px 20px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    🔄 Actualiser
                  </button>
                </div>
              )}
              {chat.map((msg,i)=>{
                // Skip garbled old messages (raw base64 without proper prefix)
                if(!msg.type&&!msg.audio&&msg.text&&(msg.text.startsWith("data:")||(msg.text.length>400&&!/\s/.test(msg.text.slice(0,80))))) return null;
                const isMe = msg.from===myName;
                const canDel = isMe || role==="admin";
                const prevFrom = i>0?chat[i-1].from:null;
                const showAvatar = !isMe && msg.from!==prevFrom;
                const ROLE_LABEL = {admin:"Admin",closer:"Closer",livreur:"Livreur"};
                const rc = ROLE_COLOR[msg.role]||G.gray;
                const isSelected = selectedMsgId===msg.id;
                return (
                  <div key={i} style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",marginBottom:showAvatar&&!isMe?6:2,marginTop:showAvatar&&!isMe?6:0}}>
                    <div style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",paddingLeft:isMe?40:0,paddingRight:isMe?0:40,width:"100%"}}>
                    {!isMe&&(
                      <div style={{width:30,height:30,borderRadius:"50%",background:showAvatar?rc:"transparent",color:"#FFF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0,alignSelf:"flex-end",marginRight:6}}>
                        {showAvatar?msg.from.charAt(0).toUpperCase():""}
                      </div>
                    )}
                    <div onClick={()=>msg.id&&canDel&&setSelectedMsgId(isSelected?null:msg.id)}
                      style={{maxWidth:"75%",background:isMe?"#DCF8C6":G.white,borderRadius:isMe?"14px 4px 14px 14px":"4px 14px 14px 14px",padding:"7px 10px",boxShadow:"0 1px 2px rgba(0,0,0,0.12)",position:"relative",cursor:msg.id&&canDel?"pointer":"default",outline:isSelected?"2px solid #EF4444":"none"}}>
                      {!isMe&&(showAvatar||msg.audio)&&<div style={{fontSize:11,fontWeight:700,color:rc,marginBottom:3,display:"flex",alignItems:"center",gap:5}}><span>{msg.from}</span>{msg.role&&<span style={{background:rc+"22",borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:600,color:rc,textTransform:"capitalize"}}>{ROLE_LABEL[msg.role]||msg.role}</span>}</div>}
                      {msg.type==="image"?(
                        <div style={{position:"relative",display:"inline-block",width:"100%",borderRadius:8,overflow:"hidden"}}>
                          <img
                            src={msg.imgSrc||msg.text} alt=""
                            onClick={e=>{e.stopPropagation();if(!msg.uploading&&!msg.uploadFailed&&(msg.imgSrc||msg.text))setLightboxSrc(msg.imgSrc||msg.text);}}
                            style={{maxWidth:"100%",maxHeight:220,width:"100%",borderRadius:8,display:"block",objectFit:"cover",opacity:msg.uploading?0.55:1,cursor:msg.uploading||msg.uploadFailed?"default":"zoom-in"}}/>
                          {msg.uploading&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.25)",borderRadius:8}}>
                            <div style={{width:32,height:32,border:"3px solid rgba(255,255,255,0.4)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.75s linear infinite"}}/>
                            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                          </div>}
                          {msg.uploadFailed&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,background:"rgba(0,0,0,0.6)",borderRadius:8}}>
                            <span style={{fontSize:22}}>⚠️</span>
                            <span style={{color:"#fff",fontSize:12,fontWeight:700}}>Échec envoi</span>
                            {pendingUploadsRef.current.has(msg.id)&&<button onClick={e=>{e.stopPropagation();retryUpload(msg);}} style={{background:"#25D366",border:"none",borderRadius:20,padding:"6px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>↺ Réessayer</button>}
                          </div>}
                        </div>
                      ):msg.audio?(
                        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:170}}>
                          <button onClick={e=>{
                            e.stopPropagation();
                            if(!msg.audioUrl) return;
                            if(playingMsgId===msg.id){
                              audioRef.current?.pause();
                              setPlayingMsgId(null);
                            } else {
                              if(audioRef.current){audioRef.current.pause();}
                              const a=new Audio(msg.audioUrl);
                              audioRef.current=a;
                              a.play().catch(()=>{});
                              setPlayingMsgId(msg.id);
                              a.onended=()=>setPlayingMsgId(null);
                              a.onerror=()=>setPlayingMsgId(null);
                            }
                          }}
                            style={{width:36,height:36,borderRadius:"50%",background:isMe?G.green:"#25D366",border:"none",color:"#FFF",fontSize:15,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 6px rgba(0,0,0,0.2)"}}>
                            {playingMsgId===msg.id?"⏸":"▶"}
                          </button>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",gap:2,alignItems:"flex-end",height:22,marginBottom:2}}>
                              {[3,5,8,4,9,6,3,7,5,8,4,6].map((h,j)=>(
                                <div key={j} style={{
                                  width:3,borderRadius:2,
                                  background:isMe?"#128C7E":"#25D366",
                                  height:playingMsgId===msg.id?h*(0.5+Math.abs(Math.sin((Date.now()/200)+j))*0.8):h,
                                  opacity:playingMsgId===msg.id?1:0.5,
                                  transition:"height 0.15s ease",
                                  animation:playingMsgId===msg.id?`wave${j%4} 0.${6+j%4}s ease-in-out infinite alternate`:"none"
                                }}/>
                              ))}
                            </div>
                            <div style={{fontSize:10,color:G.gray}}>{msg.duration||"0:00"}</div>
                          </div>
                          <span style={{fontSize:16,opacity:playingMsgId===msg.id?1:0.5}}>🎤</span>
                          <style>{`
                            @keyframes wave0{from{height:3px}to{height:12px}}
                            @keyframes wave1{from{height:4px}to{height:18px}}
                            @keyframes wave2{from{height:5px}to{height:14px}}
                            @keyframes wave3{from{height:3px}to{height:10px}}
                          `}</style>
                        </div>
                      ):msg.type==="file"?(
                        (()=>{
                          const ext=(msg.fileName||"").split(".").pop().toUpperCase().slice(0,5)||"FILE";
                          const extColor=ext==="PDF"?"#E53935":ext==="DOC"||ext==="DOCX"?"#1565C0":ext==="XLS"||ext==="XLSX"?"#2E7D32":ext==="ZIP"||ext==="RAR"?"#6A1572":"#546E7A";
                          const fmtSize=msg.fileSize!=null?(msg.fileSize>1024*1024?(msg.fileSize/1024/1024).toFixed(1)+" Mo":(Math.ceil(msg.fileSize/1024))+" Ko"):null;
                          return (
                            <div style={{display:"flex",alignItems:"center",gap:10,padding:"4px 2px",minWidth:200,maxWidth:260}}>
                              {/* Type icon */}
                              <div style={{width:44,height:44,borderRadius:10,background:extColor,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                <span style={{color:"#fff",fontSize:9,fontWeight:800,letterSpacing:0.5}}>{ext}</span>
                              </div>
                              {/* Info */}
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:600,color:isMe?"#065f46":"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",lineHeight:1.3}}>{msg.fileName||"Fichier"}</div>
                                <div style={{fontSize:11,color:G.gray,marginTop:2,display:"flex",alignItems:"center",gap:6}}>
                                  {fmtSize&&<span>{fmtSize}</span>}
                                  {msg.uploading&&<span style={{color:"#25D366",fontWeight:600}}>Envoi…</span>}
                                  {msg.uploadFailed&&<span style={{color:"#EF4444",fontWeight:600}}>Échec</span>}
                                </div>
                                {msg.uploadFailed&&pendingUploadsRef.current.has(msg.id)&&(
                                  <button onClick={e=>{e.stopPropagation();retryUpload(msg);}} style={{marginTop:2,background:"none",border:"none",color:"#25D366",fontSize:11,fontWeight:700,cursor:"pointer",padding:0}}>↺ Réessayer</button>
                                )}
                              </div>
                              {/* Download / spinner */}
                              {msg.uploading&&<div style={{width:32,height:32,border:"3px solid #ddd",borderTopColor:"#25D366",borderRadius:"50%",animation:"spin 0.75s linear infinite",flexShrink:0}}/>}
                              {msg.fileUrl&&!msg.uploading&&!msg.uploadFailed&&(
                                <a href={msg.fileUrl} download={msg.fileName} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                                  style={{flexShrink:0,width:34,height:34,borderRadius:"50%",background:isMe?"#128C7E":"#25D366",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:"#fff",fontSize:16,boxShadow:"0 2px 6px rgba(0,0,0,0.2)"}}>
                                  ↓
                                </a>
                              )}
                            </div>
                          );
                        })()
                      ):(
                        <div style={{fontSize:13,lineHeight:1.5,wordBreak:"break-word"}}>{msg.text}</div>
                      )}
                      <div style={{fontSize:10,color:"#8a9a8a",textAlign:"right",marginTop:msg.type==="image"?4:2,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:3}}>
                        <span>{msg.time}</span>
                        {isMe&&<span style={{color:msg.read?"#53BDEB":"#8a9a8a",fontSize:13,lineHeight:1}}>✓✓</span>}
                      </div>
                    </div>
                    </div>
                    {isSelected&&msg.id&&(
                      <button onClick={()=>deleteMsg(msg.id)}
                        style={{marginTop:4,background:"#EF4444",color:"#FFF",border:"none",borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                        🗑️ Supprimer
                      </button>
                    )}
                  </div>
                );
              })}
              <div ref={chatBottomRef}/>
            </div>

            {/* Bouton "Nouveau message" flottant */}
            {chatShowNew&&(
              <button onClick={()=>{
                chatBottomRef.current?.scrollIntoView({behavior:"smooth"});
                setChatShowNew(false);
              }} style={{
                position:"absolute",bottom:72,left:"50%",transform:"translateX(-50%)",
                background:"#25D366",color:"#FFF",border:"none",borderRadius:20,
                padding:"7px 18px",fontSize:12,fontWeight:700,cursor:"pointer",
                boxShadow:"0 3px 10px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",gap:6,zIndex:10
              }}>
                ↓ Nouveau message
              </button>
            )}

            {/* Barre d'enregistrement active */}
            {isRecording&&(
              <div style={{background:"#FEE2E2",padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:G.red,animation:"pulse 1s infinite"}}/>
                <div style={{flex:1,fontWeight:700,fontSize:13,color:G.red}}>Enregistrement… 0:{String(recordSecs).padStart(2,"0")}</div>
                <button onClick={stopRecord} style={{background:G.red,color:"#FFF",border:"none",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>⏹ Envoyer</button>
                <button onClick={()=>{if(mediaRecorderRef.current){mediaRecorderRef.current.onstop=()=>{};mediaRecorderRef.current.stop();}isRecordingRef.current=false;setIsRecording(false);setRecordSecs(0);clearInterval(audioTimerRef.current);}} style={{background:"none",border:"none",color:G.gray,fontSize:18,cursor:"pointer"}}>✕</button>
              </div>
            )}

            {/* Zone saisie */}
            {!isRecording&&(
              <div style={{background:G.white,borderTop:`1px solid #DDD`,flexShrink:0}}>
                <div style={{padding:"8px 10px",paddingBottom:keyboardH>0?`${keyboardH+8}px`:"8px",display:"flex",gap:6,alignItems:"flex-end",transition:"padding-bottom 0.15s"}}>
                  <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendChat()}
                    placeholder="Message…"
                    style={{flex:1,border:"none",borderRadius:22,background:"#F3F4F6",padding:"10px 14px",fontSize:13,outline:"none",resize:"none"}}/>
                  {chatMsg.trim()?(
                    <button onClick={()=>sendChat()} style={{width:40,height:40,borderRadius:"50%",background:"#25D366",border:"none",color:"#FFF",fontSize:18,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>➤</button>
                  ):(
                    <button
                      onMouseDown={startRecord} onMouseUp={stopRecord}
                      onTouchStart={e=>{e.preventDefault();startRecord();}} onTouchEnd={stopRecord}
                      style={{width:40,height:40,borderRadius:"50%",background:"#25D366",border:"none",color:"#FFF",fontSize:18,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      🎤
                    </button>
                  )}
                </div>
              </div>
            )}
          {/* Lightbox plein écran photo */}
          {lightboxSrc&&(
            <div onClick={()=>setLightboxSrc(null)}
              style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
              <button onClick={()=>setLightboxSrc(null)}
                style={{position:"absolute",top:16,right:16,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:22,width:40,height:40,borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              <img src={lightboxSrc} alt="" onClick={e=>e.stopPropagation()}
                style={{maxWidth:"100%",maxHeight:"90vh",borderRadius:8,objectFit:"contain",boxShadow:"0 8px 40px rgba(0,0,0,0.6)"}}/>
              <a href={lightboxSrc} download target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                style={{position:"absolute",bottom:24,right:24,background:"#25D366",color:"#fff",border:"none",borderRadius:20,padding:"8px 18px",fontSize:13,fontWeight:700,textDecoration:"none",display:"flex",alignItems:"center",gap:6}}>
                ↓ Télécharger
              </a>
            </div>
          )}
          </div>
          );
        })()}

        {/* ── FRAIS DE LIVRAISON ── */}
        {dataReady&&tab==="frais"&&role==="admin"&&<FraisPage/>}
      </div>

      {/* ── MODAL: Ajouter commande ── */}
      {showAdd&&<OrderModal
        products={products} orders={orders} newOrder={newOrder} setNewOrder={setNewOrder}
        addOrder={addOrder} onClose={()=>setShowAdd(false)} G={G} fmt={fmt} FRAIS_LIV={FRAIS_LIV}
        livreurs={teamMembers.filter(m=>m.role==="livreur").map(m=>m.nom).filter(Boolean)} waTemplate={waTemplate} setWaTemplate={setWaTemplate}
        boutique={settings.boutique} mainRegion={mainRegion} otherRegions={otherRegions}
        defaultDeliveryPrice={settings.defaultDeliveryPrice||3500}
        onOpenFraisConfig={()=>{ setShowAdd(false); setTab("frais"); }}
      />}

      {/* ── MODAL: Zones de livraison — removed, use tab "frais" ── */}
      {false&&(()=>{
        const allCities = [...(mainRegion?.cities||[]), ...(otherRegions.flatMap(r=>r.cities||[]))];
        const dupCheck = (city, excludeRegionId=null) => {
          const t = _normCity(city);
          if (mainRegion && excludeRegionId!==mainRegion.id && mainRegion.cities?.some(c=>_normCity(c)===t)) return mainRegion.name;
          for(const r of otherRegions) {
            if(r.id===excludeRegionId) continue;
            if(r.cities?.some(c=>_normCity(c)===t)) return r.name;
          }
          return null;
        };
        const saveMainRegion = async() => {
          if(!zoneMainEdit.name.trim()){addToast("Nom de la région obligatoire","⚠️","#F59E0B");return;}
          if(!zoneMainEdit.price||parseInt(zoneMainEdit.price)<=0){addToast("Prix invalide (> 0)","⚠️","#F59E0B");return;}
          if(!zoneMainEdit.cities?.length){addToast("Au moins une ville obligatoire","⚠️","#F59E0B");return;}
          const payload = {org_id:orgId, name:zoneMainEdit.name.trim(), price:parseInt(zoneMainEdit.price), cities:zoneMainEdit.cities};
          try{
            let saved;
            if(mainRegion?.id){ saved = await sbFetch(`delivery_main_region?id=eq.${mainRegion.id}`,"PATCH",payload); setMainRegion(r=>({...r,...payload})); }
            else { const res = await sbFetch("delivery_main_region","POST",{...payload,Prefer:"return=representation"}); saved=res; setMainRegion(Array.isArray(res)?res[0]:res); }
            addToast(`${payload.name} enregistré ✅`,"✅",G.green);
            setZoneMainEdit(null);
          }catch(e){addToast("Erreur sauvegarde","❌",G.red);}
        };
        const saveOtherRegion = async() => {
          if(!zoneOtherEdit.name.trim()){addToast("Nom de la région obligatoire","⚠️","#F59E0B");return;}
          if(!zoneOtherEdit.price||parseInt(zoneOtherEdit.price)<=0){addToast("Prix invalide (> 0)","⚠️","#F59E0B");return;}
          if(!zoneOtherEdit.cities?.length){addToast("Au moins une ville obligatoire","⚠️","#F59E0B");return;}
          const payload = {org_id:orgId, name:zoneOtherEdit.name.trim(), price:parseInt(zoneOtherEdit.price), cities:zoneOtherEdit.cities};
          try{
            if(zoneOtherEdit.id){
              await sbFetch(`delivery_other_regions?id=eq.${zoneOtherEdit.id}`,"PATCH",payload);
              setOtherRegions(prev=>prev.map(r=>r.id===zoneOtherEdit.id?{...r,...payload}:r));
            } else {
              const res = await sbFetch("delivery_other_regions","POST",{...payload});
              const saved = Array.isArray(res)?res[0]:res;
              if(saved?.id) setOtherRegions(prev=>[...prev,{...payload,id:saved.id}]);
            }
            addToast(`${payload.name} enregistré ✅`,"✅",G.green);
            setZoneOtherEdit(null);
          }catch(e){addToast("Erreur sauvegarde","❌",G.red);}
        };
        const addCityToEdit = (editObj, setEdit, isMain=false) => {
          const city = fmtCity(editObj.cityInput||"");
          if(!city){return;}
          const dup = dupCheck(city, isMain?mainRegion?.id:editObj.id);
          if(dup){addToast(`"${city}" est déjà dans la région ${dup}`,"⚠️","#F59E0B");return;}
          if(editObj.cities?.some(c=>_normCity(c)===_normCity(city))){addToast("Ville déjà dans cette région","⚠️","#F59E0B");return;}
          setEdit(p=>({...p,cities:[...(p.cities||[]),city],cityInput:""}));
        };
        const TagInput = ({edit, setEdit, isMain=false}) => (
          <div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
              {(edit.cities||[]).map((c,i)=>(
                <span key={i} style={{background:"#E0F2FE",color:"#0369A1",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                  {c}
                  <button onClick={()=>setEdit(p=>({...p,cities:p.cities.filter((_,j)=>j!==i)}))} style={{background:"none",border:"none",cursor:"pointer",color:"#0369A1",fontSize:14,padding:0,lineHeight:1}}>×</button>
                </span>
              ))}
              {!(edit.cities?.length) && <span style={{fontSize:11,color:"#9CA3AF",padding:"3px 0"}}>Aucune ville ajoutée</span>}
            </div>
            <div style={{display:"flex",gap:6}}>
              <input type="text" value={edit.cityInput||""} placeholder="Ajouter une ville…"
                onChange={e=>setEdit(p=>({...p,cityInput:e.target.value}))}
                onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addCityToEdit(edit,setEdit,isMain);}}}
                style={{flex:1,border:"1.5px solid #BFDBFE",borderRadius:8,padding:"7px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              <button onClick={()=>addCityToEdit(edit,setEdit,isMain)}
                style={{background:"#1E40AF",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:700,fontSize:12,cursor:"pointer"}}>+ Ajouter</button>
            </div>
          </div>
        );
        return (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:G.white,borderRadius:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontWeight:700,fontSize:17,color:G.green,marginBottom:4}}>🗺️ Zones de livraison</div>
            <div style={{fontSize:12,color:G.gray,marginBottom:18}}>Configurez vos zones pour que les frais soient appliqués automatiquement à la création d'une commande.</div>

            {/* ── Région principale ── */}
            <div style={{background:"#F0FDF4",borderRadius:14,padding:14,marginBottom:14,border:"1.5px solid #86EFAC"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#166534",marginBottom:10}}>🏍️ Région principale de vente</div>
              {zoneMainEdit ? (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",gap:6}}>
                    <input type="text" value={zoneMainEdit.name} onChange={e=>setZoneMainEdit(p=>({...p,name:e.target.value}))} placeholder="ex: Dakar"
                      style={{flex:1,border:"1.5px solid #86EFAC",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                    <input type="number" value={zoneMainEdit.price} onChange={e=>setZoneMainEdit(p=>({...p,price:e.target.value}))} placeholder="1500"
                      style={{width:90,border:"1.5px solid #86EFAC",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                    <span style={{lineHeight:"38px",fontSize:11,color:G.gray,flexShrink:0}}>FCFA</span>
                  </div>
                  <TagInput edit={zoneMainEdit} setEdit={setZoneMainEdit} isMain={true}/>
                  <div style={{display:"flex",gap:8,marginTop:4}}>
                    <button onClick={saveMainRegion} style={{flex:1,background:G.green,color:"#fff",border:"none",borderRadius:10,padding:10,fontWeight:700,fontSize:13,cursor:"pointer"}}>✅ Enregistrer</button>
                    <button onClick={()=>setZoneMainEdit(null)} style={{background:G.grayLight,color:G.gray,border:"none",borderRadius:10,padding:"10px 14px",fontSize:13,cursor:"pointer"}}>Annuler</button>
                  </div>
                </div>
              ) : mainRegion ? (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div>
                      <span style={{fontWeight:700,fontSize:14,color:G.dark}}>{mainRegion.name}</span>
                      <span style={{fontSize:13,color:G.green,fontWeight:700,marginLeft:10}}>{fmt(mainRegion.price)} CFA</span>
                    </div>
                    <button onClick={()=>setZoneMainEdit({...mainRegion,cityInput:""})}
                      style={{background:"#EFF6FF",color:"#1E40AF",border:"none",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>✏️ Modifier</button>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                    {mainRegion.cities?.map((c,i)=><span key={i} style={{background:"#DCFCE7",color:"#166534",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600}}>{c}</span>)}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{fontSize:12,color:G.gray,marginBottom:8}}>Aucune région principale configurée.</div>
                  <button onClick={()=>setZoneMainEdit({name:"",price:"",cities:[],cityInput:""})}
                    style={{background:G.green,color:"#fff",border:"none",borderRadius:10,padding:"9px 18px",fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Configurer</button>
                </div>
              )}
            </div>

            {/* ── Autres régions ── */}
            <div style={{background:"#EFF6FF",borderRadius:14,padding:14,marginBottom:14,border:"1.5px solid #BFDBFE"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#1E40AF"}}>🌍 Autres régions</div>
                {!zoneOtherEdit&&<button onClick={()=>setZoneOtherEdit({name:"",price:"",cities:[],cityInput:""})}
                  style={{background:"#1E40AF",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,fontSize:12,cursor:"pointer"}}>+ Ajouter</button>}
              </div>

              {/* Formulaire ajout/édition */}
              {zoneOtherEdit&&(
                <div style={{background:"#DBEAFE",borderRadius:12,padding:"12px 14px",marginBottom:12,border:"1px solid #93C5FD"}}>
                  <div style={{fontWeight:700,fontSize:12,color:"#1E40AF",marginBottom:8}}>{zoneOtherEdit.id?"✏️ Modifier":"➕ Nouvelle région"}</div>
                  <div style={{display:"flex",gap:6,marginBottom:8}}>
                    <input type="text" value={zoneOtherEdit.name} onChange={e=>setZoneOtherEdit(p=>({...p,name:e.target.value}))} placeholder="ex: Thiès"
                      style={{flex:1,border:"1.5px solid #93C5FD",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none",boxSizing:"border-box",background:"#fff"}}/>
                    <input type="number" value={zoneOtherEdit.price} onChange={e=>setZoneOtherEdit(p=>({...p,price:e.target.value}))} placeholder="3000"
                      style={{width:90,border:"1.5px solid #93C5FD",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none",boxSizing:"border-box",background:"#fff"}}/>
                    <span style={{lineHeight:"38px",fontSize:11,color:G.gray,flexShrink:0}}>FCFA</span>
                  </div>
                  <TagInput edit={zoneOtherEdit} setEdit={setZoneOtherEdit}/>
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <button onClick={saveOtherRegion} style={{flex:1,background:"#1E40AF",color:"#fff",border:"none",borderRadius:10,padding:10,fontWeight:700,fontSize:13,cursor:"pointer"}}>✅ Enregistrer</button>
                    <button onClick={()=>setZoneOtherEdit(null)} style={{background:G.grayLight,color:G.gray,border:"none",borderRadius:10,padding:"10px 14px",fontSize:13,cursor:"pointer"}}>Annuler</button>
                  </div>
                </div>
              )}

              {/* Liste des autres régions */}
              {otherRegions.length===0&&!zoneOtherEdit&&<div style={{fontSize:12,color:G.gray}}>Aucune autre région configurée.</div>}
              {otherRegions.map(r=>(
                <div key={r.id} style={{background:"#fff",borderRadius:10,padding:"10px 12px",marginBottom:8,border:"1px solid #BFDBFE"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div>
                      <span style={{fontWeight:700,fontSize:13,color:G.dark}}>{r.name}</span>
                      <span style={{fontSize:13,color:"#1E40AF",fontWeight:700,marginLeft:10}}>{fmt(r.price)} CFA</span>
                    </div>
                    <div style={{display:"flex",gap:5}}>
                      <button onClick={()=>setZoneOtherEdit({...r,cityInput:""})}
                        style={{background:"#EFF6FF",color:"#1E40AF",border:"none",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✏️</button>
                      <button onClick={()=>setConfirmModal({msg:`Supprimer la région "${r.name}" ?`,sub:"Les commandes existantes ne sont pas affectées.",danger:true,onConfirm:async()=>{
                        await sbFetch(`delivery_other_regions?id=eq.${r.id}`,"DELETE").catch(()=>{});
                        setOtherRegions(prev=>prev.filter(x=>x.id!==r.id));
                        addToast(`${r.name} supprimée`,"🗑️",G.gray);
                      }})}
                        style={{background:"#FEE2E2",color:G.red,border:"none",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>🗑️</button>
                    </div>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {r.cities?.map((c,i)=><span key={i} style={{background:"#DBEAFE",color:"#1E40AF",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:600}}>{c}</span>)}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={()=>setShowZoneConfig(false)}
              style={{width:"100%",background:G.grayLight,color:G.gray,border:"none",borderRadius:10,padding:12,fontWeight:600,fontSize:13,cursor:"pointer"}}>
              ✕ Fermer
            </button>
          </div>
        </div>
        );
      })()}

      {/* ── MODAL: Ajouter produit ── */}
      {showAddProd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:isDesktop?"center":"flex-end"}}>
          <div style={{background:G.white,borderRadius:isDesktop?20:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{fontWeight:700,fontSize:16,color:G.green,marginBottom:14}}>📦 Nouveau produit</div>

            <div style={{background:"#EFF6FF",borderRadius:10,padding:"8px 12px",marginBottom:12,fontSize:11,color:G.blue,fontWeight:600}}>
              ✅ Champs obligatoires pour le tracking automatique
            </div>

            {/* Error summary */}
            {Object.keys(prodErrors).length>0&&(
              <div style={{background:"#FEE2E2",borderRadius:10,padding:"10px 12px",marginBottom:12,display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:18}}>🔴</span>
                <div>
                  <div style={{fontSize:12,color:G.red,fontWeight:700}}>Champs manquants</div>
                  <div style={{fontSize:11,color:G.red}}>Remplis les champs en rouge pour continuer</div>
                </div>
              </div>
            )}

            {[
              {key:"name",  label:"📦 Nom du produit *",          ph:"Chaussures Nike", type:"text",   req:true},
              {key:"cost",  label:"💰 Prix de revient (CFA) *",  ph:"7000",            type:"number", req:true},
              {key:"price", label:"💰 Prix de vente (CFA) *",    ph:"25000",           type:"number", req:true},
              {key:"stock", label:"📦 Stock initial *",            ph:"50",              type:"number", req:true},
            ].map(f=>(
              <div key={f.key} style={{marginBottom:9,position:"relative"}}>
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                  {prodErrors[f.key]&&<span style={{width:8,height:8,borderRadius:"50%",background:G.red,display:"inline-block",flexShrink:0}}/>}
                  <div style={{fontSize:11,color:prodErrors[f.key]?G.red:G.dark,fontWeight:600}}>{f.label}</div>
                </div>
                <input type={f.type} value={newProd[f.key]||""}
                  onChange={e=>{setNewProd({...newProd,[f.key]:e.target.value});if(prodErrors[f.key])setProdErrors(p=>({...p,[f.key]:false}));}}
                  placeholder={f.ph}
                  style={{width:"100%",border:`2px solid ${prodErrors[f.key]?G.red:"#93C5FD"}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box",background:prodErrors[f.key]?"#FFF5F5":G.white}}/>
              </div>
            ))}

            {/* Niche avec suggestions */}
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                {prodErrors.niche&&<span style={{width:8,height:8,borderRadius:"50%",background:G.red,display:"inline-block"}}/>}
                <div style={{fontSize:11,color:prodErrors.niche?G.red:G.dark,fontWeight:600}}>🎯 Niche de produit *</div>
              </div>
              <input type="text" value={newProd.niche||""}
                onChange={e=>{setNewProd({...newProd,niche:e.target.value});if(prodErrors.niche)setProdErrors(p=>({...p,niche:false}));}}
                placeholder="Mode, Beauté, Électronique..."
                style={{width:"100%",border:`2px solid ${prodErrors.niche?G.red:"#93C5FD"}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box",background:prodErrors.niche?"#FFF5F5":G.white}}/>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:7}}>
                {["Mode & Vêtements","Chaussures","Beauté & Cosmétiques","Électronique","Téléphones","Maison & Déco","Sport & Fitness","Santé","Enfants & Jouets","Montres & Bijoux","Alimentation"].filter(n=>!newProd.niche||n.toLowerCase().includes((newProd.niche||"").toLowerCase())).slice(0,8).map(n=>(
                  <button key={n} onClick={()=>{setNewProd(p=>({...p,niche:n}));setProdErrors(p=>({...p,niche:false}));}}
                    style={{background:newProd.niche===n?G.green:G.grayLight,color:newProd.niche===n?G.white:G.dark,border:"none",borderRadius:20,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:newProd.niche===n?700:400}}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {newProd.cost&&newProd.price&&(
              <div style={{background:G.greenLight,borderRadius:10,padding:"10px 14px",marginBottom:14}}>
                <div style={{fontSize:11,color:G.gray,fontWeight:700,marginBottom:4}}>APERÇU MARGE / UNITÉ</div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,color:G.gray}}>Après livraison</span>
                  <span style={{fontSize:14,fontWeight:700,color:G.green}}>{fmt(parseInt(newProd.price||0)-parseInt(newProd.cost||0)-(settings.defaultDeliveryPrice||1500))} CFA &nbsp;({pct(parseInt(newProd.price||0)>0?(parseInt(newProd.price||0)-parseInt(newProd.cost||0)-(settings.defaultDeliveryPrice||1500))/parseInt(newProd.price||0):0)})</span>
                </div>
              </div>
            )}

            {/* ── SECTION BUNDLES ── */}
            <div style={{borderTop:`2px dashed ${G.grayLight}`,paddingTop:16,marginTop:4}}>
              <div style={{fontWeight:700,fontSize:14,color:G.green,marginBottom:4}}>🎁 Bundles de ce produit</div>
              <div style={{fontSize:11,color:G.gray,marginBottom:12}}>Optionnel — à ajouter si vous proposez des offres groupées pour ce produit.</div>

              {/* Bundles déjà ajoutés */}
              {(newProd.bundles||[]).length>0&&(
                <div style={{marginBottom:12}}>
                  {newProd.bundles.map((b,i)=>{
                    const qr=b.type==="bxgyf"?(b.qte+(b.qteOfferte||0)):b.qte;
                    const cout=(parseInt(newProd.cost)||0)*qr;
                    const fl=b.livraisonOfferte?0:(settings.defaultDeliveryPrice||1500);
                    const m=b.prixVente-cout-fl;
                    const TN={quantite:"Pack Qté",bxgyf:"Buy X Get Y",kit:"Kit"};
                    return (
                      <div key={i} style={{background:G.grayLight,borderRadius:10,padding:"10px 12px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div>
                          <div style={{fontWeight:600,fontSize:13,color:G.dark}}>{b.label} <span style={{fontSize:10,color:G.gray,fontWeight:400}}>({TN[b.type]||b.type})</span></div>
                          <div style={{fontSize:11,color:G.gray,marginTop:2}}>
                            {b.qte}u{b.type==="bxgyf"?` + ${b.qteOfferte} offert`:""} · {fmt(b.prixVente)} CFA
                            {b.livraisonOfferte?" · 🚚 offerte":""}
                          </div>
                          <div style={{fontSize:11,fontWeight:600,color:m>=0?G.green:G.red,marginTop:2}}>Marge: {fmt(m)} CFA</div>
                        </div>
                        <button onClick={()=>setNewProd(p=>({...p,bundles:p.bundles.filter((_,j)=>j!==i)}))}
                          style={{background:"none",border:"none",color:G.red,fontSize:18,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Formulaire ajout bundle */}
              <div style={{background:"#FFF8E7",borderRadius:12,padding:"12px 14px",border:`1px solid #FDE68A`}}>
                <div style={{fontSize:12,fontWeight:700,color:G.gold,marginBottom:10}}>+ Ajouter un bundle</div>

                {/* Nom / Label */}
                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                    {bundleErrors.label&&<span style={{width:8,height:8,borderRadius:"50%",background:G.red,display:"inline-block",flexShrink:0}}/>}
                    <div style={{fontSize:11,color:bundleErrors.label?G.red:G.gray,fontWeight:bundleErrors.label?700:400}}>Nom / Label *</div>
                  </div>
                  <input type="text" value={newBundleForm.label}
                    onChange={e=>{setNewBundleForm(p=>({...p,label:e.target.value}));if(bundleErrors.label)setBundleErrors(p=>({...p,label:false}));}}
                    placeholder="Pack 2, Buy 2 Get 1..."
                    style={{width:"100%",border:`1.5px solid ${bundleErrors.label?G.red:"#FDE68A"}`,borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",boxSizing:"border-box",background:bundleErrors.label?"#FFF5F5":"#FFF8E7"}}/>
                </div>

                {/* Type */}
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,color:G.gray,marginBottom:6}}>Type</div>
                  <div style={{display:"flex",gap:5}}>
                    {[{k:"quantite",l:"📦 Pack Qté"},{k:"bxgyf",l:"🎁 Buy X Get Y"}].map(t=>(
                      <button key={t.k} onClick={()=>setNewBundleForm(p=>({...p,type:t.k}))}
                        style={{flex:1,padding:"7px 4px",borderRadius:8,border:`2px solid ${newBundleForm.type===t.k?G.gold:"#FDE68A"}`,cursor:"pointer",background:newBundleForm.type===t.k?"#FEF3C7":"#FFF8E7",fontWeight:600,fontSize:11,color:newBundleForm.type===t.k?G.gold:G.gray}}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantités + Prix */}
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:G.gray,marginBottom:3}}>{newBundleForm.type==="bxgyf"?"Qté achetée":"Qté bundle"}</div>
                    <input type="number" min="2" value={newBundleForm.qte}
                      onChange={e=>setNewBundleForm(p=>({...p,qte:e.target.value}))} placeholder="2"
                      style={{width:"100%",border:`1.5px solid #FDE68A`,borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  {newBundleForm.type==="bxgyf"&&(
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,color:G.gray,marginBottom:3}}>Qté offerte</div>
                      <input type="number" min="1" value={newBundleForm.qteOfferte}
                        onChange={e=>setNewBundleForm(p=>({...p,qteOfferte:e.target.value}))} placeholder="1"
                        style={{width:"100%",border:`1.5px solid #FDE68A`,borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                    </div>
                  )}
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
                      {bundleErrors.prixVente&&<span style={{width:7,height:7,borderRadius:"50%",background:G.red,display:"inline-block",flexShrink:0}}/>}
                      <div style={{fontSize:11,color:bundleErrors.prixVente?G.red:G.gray,fontWeight:bundleErrors.prixVente?700:400}}>Prix vente (CFA) *</div>
                    </div>
                    <input type="number" value={newBundleForm.prixVente}
                      onChange={e=>{setNewBundleForm(p=>({...p,prixVente:e.target.value}));if(bundleErrors.prixVente)setBundleErrors(p=>({...p,prixVente:false}));}}
                      placeholder="40000"
                      style={{width:"100%",border:`2px solid ${bundleErrors.prixVente?G.red:G.gold}`,borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box",fontWeight:600,background:bundleErrors.prixVente?"#FFF5F5":G.white}}/>
                  </div>
                </div>

                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <input type="checkbox" id="livbund" checked={newBundleForm.livraisonOfferte} onChange={e=>setNewBundleForm(p=>({...p,livraisonOfferte:e.target.checked}))} style={{width:16,height:16,cursor:"pointer"}}/>
                  <label htmlFor="livbund" style={{fontSize:12,color:G.dark,cursor:"pointer"}}>🚚 Livraison offerte avec ce bundle</label>
                </div>

                {/* Aperçu marge */}
                {newBundleForm.prixVente&&newProd.cost&&(()=>{
                  const qr=newBundleForm.type==="bxgyf"?(parseInt(newBundleForm.qte||2)+parseInt(newBundleForm.qteOfferte||1)):parseInt(newBundleForm.qte||2);
                  const c=(parseInt(newProd.cost)||0)*qr;
                  const fl=newBundleForm.livraisonOfferte?0:parseInt(newProd.fraisLiv||1500);
                  const m=parseInt(newBundleForm.prixVente||0)-c-fl;
                  return <div style={{fontSize:12,color:m>=0?G.green:G.red,fontWeight:600,marginBottom:8}}>Marge estimée: {fmt(m)} CFA ({pct(parseInt(newBundleForm.prixVente||0)>0?m/parseInt(newBundleForm.prixVente):0)})</div>;
                })()}

                {/* Erreur bundle */}
                {(bundleErrors.label||bundleErrors.prixVente)&&(
                  <div style={{background:"#FEE2E2",borderRadius:8,padding:"7px 10px",marginBottom:8,display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:14}}>🔴</span>
                    <div style={{fontSize:11,color:G.red,fontWeight:600}}>
                      {bundleErrors.label&&bundleErrors.prixVente?"Nom et Prix vente requis":bundleErrors.label?"Nom / Label requis":"Prix de vente requis"}
                    </div>
                  </div>
                )}

                <button onClick={()=>{
                  const errs = {};
                  if(!newBundleForm.label)     errs.label     = true;
                  if(!newBundleForm.prixVente) errs.prixVente = true;
                  if(Object.keys(errs).length>0) { setBundleErrors(errs); return; }
                  setBundleErrors({});
                  const nb={id:(newProd.bundles||[]).length+1,label:newBundleForm.label,type:newBundleForm.type,qte:parseInt(newBundleForm.qte||2),qteOfferte:parseInt(newBundleForm.qteOfferte||0),prixVente:parseInt(newBundleForm.prixVente),livraisonOfferte:newBundleForm.livraisonOfferte};
                  setNewProd(p=>({...p,bundles:[...(p.bundles||[]),nb]}));
                  setNewBundleForm({label:"",type:"quantite",qte:"2",qteOfferte:"1",prixVente:"",livraisonOfferte:false});
                }} style={{width:"100%",background:G.gold,color:G.dark,border:"none",borderRadius:9,padding:"9px 0",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                  ✅ Ajouter ce bundle
                </button>
              </div>
            </div>

            <div style={{marginTop:14,display:"flex",gap:8}}>
              <button onClick={addProduct} style={{flex:1,background:G.green,color:G.white,border:"none",borderRadius:10,padding:12,fontWeight:600,fontSize:13,cursor:"pointer"}}>
                Enregistrer le produit
              </button>
              <button onClick={()=>{setShowAddProd(false);setNewProd({name:"",cost:"",price:"",stock:"",fraisLiv:"1500",fraisLivExtra:"",niche:"",bundles:[]});setProdErrors({});}} style={{flex:1,background:G.grayLight,color:G.gray,border:"none",borderRadius:10,padding:12,cursor:"pointer",fontSize:13}}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Créer bundel ── */}
      {showAddBundle&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:isDesktop?"center":"flex-end"}}>
          <div style={{background:G.white,borderRadius:isDesktop?20:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontWeight:700,fontSize:16,color:G.green,marginBottom:14}}>🎁 Créer un bundel</div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>Nom du bundel</div>
              <input type="text" value={newBundle.name} onChange={e=>setNewBundle(p=>({...p,name:e.target.value}))} placeholder="Pack 2 Chaussures"
                style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:6}}>Type de bundel</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[{k:"quantite",l:"📦 Quantité",d:"2u = prix réduit"},{k:"bxgyf",l:"🎁 Buy X Get Y",d:"X achetés + Y offerts"},{k:"kit",l:"🧰 Kit",d:"Produits différents"},{k:"remise_pct",l:"💸 Remise %",d:"% sur le total"}].map(t=>(
                  <button key={t.k} onClick={()=>setNewBundle(p=>({...p,type:t.k}))}
                    style={{flex:1,minWidth:100,padding:"8px 6px",borderRadius:9,border:`2px solid ${newBundle.type===t.k?G.green:G.grayLight}`,cursor:"pointer",background:newBundle.type===t.k?G.greenLight:G.white,textAlign:"center"}}>
                    <div style={{fontSize:12,fontWeight:700,color:newBundle.type===t.k?G.green:G.dark}}>{t.l}</div>
                    <div style={{fontSize:10,color:G.gray}}>{t.d}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>Produit principal</div>
              <select value={newBundle.prodNom} onChange={e=>setNewBundle(p=>({...p,prodNom:e.target.value}))}
                style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:G.dark,background:G.white,boxSizing:"border-box"}}>
                <option value="">Sélectionner...</option>
                {products.map(p=><option key={p.id} value={p.name}>{p.name} (coût: {fmt(p.cost)} F)</option>)}
              </select>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>{newBundle.type==="bxgyf"?"Quantité achetée (X)":"Quantité dans le bundel"}</div>
              <input type="number" min="1" value={newBundle.prodQte} onChange={e=>setNewBundle(p=>({...p,prodQte:e.target.value}))} placeholder="2"
                style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            </div>
            {newBundle.type==="bxgyf"&&<div style={{marginBottom:10}}><div style={{fontSize:11,color:G.gray,marginBottom:3}}>Quantité offerte (Y)</div><input type="number" min="1" value={newBundle.qteOfferte} onChange={e=>setNewBundle(p=>({...p,qteOfferte:e.target.value}))} placeholder="1" style={{width:"100%",border:`1.5px solid #EDE9FE`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>}
            {newBundle.type==="remise_pct"&&<div style={{marginBottom:10}}><div style={{fontSize:11,color:G.gray,marginBottom:3}}>Remise % appliquée</div><input type="number" min="0" max="100" value={newBundle.remisePct} onChange={e=>setNewBundle(p=>({...p,remisePct:e.target.value}))} placeholder="15" style={{width:"100%",border:`1.5px solid #FEE2E2`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/></div>}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>💰 Prix de vente bundel (CFA)</div>
              <input type="number" value={newBundle.prixVente} onChange={e=>setNewBundle(p=>({...p,prixVente:e.target.value}))} placeholder="40000"
                style={{width:"100%",border:`2px solid ${G.gold}`,borderRadius:8,padding:"9px 12px",fontSize:14,outline:"none",boxSizing:"border-box",fontWeight:600}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 12px",background:G.grayLight,borderRadius:10}}>
              <input type="checkbox" id="livoff2" checked={newBundle.livraisonOfferte} onChange={e=>setNewBundle(p=>({...p,livraisonOfferte:e.target.checked}))} style={{width:18,height:18,cursor:"pointer"}}/>
              <label htmlFor="livoff2" style={{fontSize:13,color:G.dark,cursor:"pointer",fontWeight:500}}>🚚 Livraison offerte avec ce bundel</label>
            </div>
            {newBundle.prixVente&&newBundle.prodNom&&(()=>{
              const prod=products.find(p=>p.name===newBundle.prodNom);
              if(!prod) return null;
              const qr=newBundle.type==="bxgyf"?(parseInt(newBundle.prodQte||2)+parseInt(newBundle.qteOfferte||1)):parseInt(newBundle.prodQte||2);
              const c=prod.cost*qr,fl=newBundle.livraisonOfferte?0:FRAIS_LIV,m=parseInt(newBundle.prixVente||0)-c-fl;
              return <div style={{background:m>=0?G.greenLight:"#FEE2E2",borderRadius:10,padding:"10px 14px",marginBottom:14}}>
                <div style={{fontSize:11,color:G.gray,fontWeight:700}}>APERÇU MARGE</div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}><span style={{fontSize:12,color:G.gray}}>Coût ({qr} unités)</span><span style={{fontWeight:700}}>{fmt(c)} CFA</span></div>
                <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:G.gray}}>Frais livraison</span><span style={{fontWeight:700}}>{newBundle.livraisonOfferte?"Offerte":fmt(fl)+" CFA"}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",paddingTop:6,borderTop:`1px solid ${m>=0?"#BBF7D0":"#FCA5A5"}`,marginTop:4}}><span style={{fontSize:13,fontWeight:700}}>Marge nette</span><span style={{fontSize:16,fontWeight:700,color:m>=0?G.green:G.red}}>{fmt(m)} CFA ({pct(parseInt(newBundle.prixVente||0)>0?m/parseInt(newBundle.prixVente):0)})</span></div>
              </div>;
            })()}
            <button onClick={addBundle} style={{width:"100%",background:G.green,color:G.white,border:"none",borderRadius:10,padding:12,fontWeight:700,fontSize:14,cursor:"pointer",marginBottom:8}}>Créer le bundel</button>
            <button onClick={()=>setShowAddBundle(false)} style={{width:"100%",background:"none",border:"none",color:G.gray,padding:8,cursor:"pointer",fontSize:13}}>Annuler</button>
          </div>
        </div>
      )}

      {/* ── MODAL: Paramètres ── */}
      {showSettings&&(
        <div onClick={()=>setShowSettings(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:isDesktop?"center":"flex-end"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:G.white,borderRadius:isDesktop?20:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
              <div style={{width:40,height:4,borderRadius:2,background:G.grayLight}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{fontWeight:700,fontSize:16,color:G.green}}>⚙️ Paramètres</div>
              <button onClick={()=>setShowSettings(false)} style={{background:"none",border:"none",fontSize:20,color:G.gray,cursor:"pointer",lineHeight:1,padding:"0 4px"}}>×</button>
            </div>

            {role==="admin" ? (<>
            {/* Compte */}
            <div style={{marginBottom:18}}>
              <div style={{fontSize:12,fontWeight:700,color:G.gray,marginBottom:10,letterSpacing:0.5}}>MON COMPTE</div>
              {[
                {key:"nom",      label:"👤 Ton nom",           ph:"Admin"},
                {key:"boutique", label:"🏪 Nom de la boutique", ph:settings.boutique||"Ma Boutique Dakar"},
                {key:"whatsapp", label:"📱 Numéro WhatsApp",    ph:"221 77 123 45 67"},
              ].map(f=>(
                <div key={f.key} style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:G.gray,marginBottom:3}}>{f.label}</div>
                  <input type="text" value={settings[f.key]} onChange={e=>setSettings(s=>({...s,[f.key]:e.target.value}))} placeholder={f.ph}
                    style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>

            {/* Plan */}
            {(()=>{
              const curPlan = PLANS.find(p=>p.key===settings.plan)||(isPro?PLANS.find(p=>p.key==="basic"):PLANS[0])||PLANS[0];
              const membersUsed = teamMembers.length + 1;
              const atLimit = curPlan.maxMembers && membersUsed >= curPlan.maxMembers;
              return (
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:10,fontWeight:700,color:G.gray,marginBottom:10,letterSpacing:1.5}}>ABONNEMENT ACTUEL</div>

                  {/* Card plan élégante */}
                  <div style={{background:"linear-gradient(135deg,#0D3D25,#1A5C38)",borderRadius:16,padding:"20px",marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                      <div>
                        <div style={{fontSize:10,letterSpacing:2,color:"rgba(255,255,255,0.45)",fontWeight:600,marginBottom:4}}>{curPlan.key==="starter"?"ESSAI GRATUIT":"PLAN ACTIF"}</div>
                        <div style={{fontWeight:800,fontSize:22,color:"#FFF",letterSpacing:0.3}}>{curPlan.name}</div>
                        <div style={{fontSize:12,color:"rgba(255,255,255,0.55)",marginTop:3}}>
                          {curPlan.key==="starter"?"14 jours gratuits":`${curPlan.price} CFA / mois`}
                        </div>
                      </div>
                      <button onClick={()=>setShowPlanModal(true)}
                        style={{background:"rgba(255,255,255,0.12)",color:"#FFF",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"8px 14px",fontSize:11,fontWeight:600,cursor:"pointer",letterSpacing:0.3}}>
                        Changer
                      </button>
                    </div>

                    {/* Features */}
                    <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                      {curPlan.features.map((f,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"rgba(255,255,255,0.75)"}}>
                          <div style={{width:4,height:4,borderRadius:"50%",background:"#F0A500",flexShrink:0}}/>
                          {f}
                        </div>
                      ))}
                    </div>

                    {/* Barre membres */}
                    {curPlan.maxMembers&&(
                      <div style={{background:"rgba(0,0,0,0.2)",borderRadius:10,padding:"10px 12px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                          <span style={{fontSize:11,color:"rgba(255,255,255,0.55)",fontWeight:500}}>Membres utilisés</span>
                          <span style={{fontSize:11,fontWeight:700,color:atLimit?"#FCA5A5":"#FFF"}}>{membersUsed} / {curPlan.maxMembers}</span>
                        </div>
                        <div style={{background:"rgba(255,255,255,0.1)",borderRadius:4,height:4}}>
                          <div style={{background:atLimit?"#EF4444":G.gold,borderRadius:4,height:4,width:`${Math.min(100,membersUsed/curPlan.maxMembers*100)}%`,transition:"width 0.4s"}}/>
                        </div>
                        {atLimit&&<div style={{fontSize:10,color:"#FCA5A5",marginTop:6,fontWeight:600}}>Limite atteinte — passez au plan supérieur</div>}
                      </div>
                    )}
                  </div>

                  {/* Jours restants si trial */}
                  {curPlan.key==="starter"&&!isPro&&(
                    <div style={{background:"#FEF3C7",borderRadius:10,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:12,color:"#92400E",fontWeight:600}}>{trialDaysLeft} jour{trialDaysLeft>1?"s":""} restants</span>
                      <button onClick={()=>setShowPlanModal(true)} style={{background:"#F0A500",color:"#FFF",border:"none",borderRadius:7,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Passer Pro</button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Équipe */}
            <div style={{marginBottom:18}}>
              <div style={{fontSize:12,fontWeight:700,color:G.gray,marginBottom:10,letterSpacing:0.5}}>MON ÉQUIPE</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {teamMembers.map((m,i)=>({...m,icon:m.role==="closer"?"📞":"🏍️"})).map((m,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:G.grayLight,borderRadius:10,padding:"9px 12px"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600}}>{m.icon} {m.nom}</div>
                      {m.phone&&<div style={{fontSize:11,color:G.gray,marginTop:1}}>📱 {m.phone}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:11,color:G.gray,background:G.white,borderRadius:6,padding:"2px 8px"}}>{m.role}</span>
                      <button onClick={()=>setConfirmModal({msg:`Retirer ${m.nom} de l'équipe ?`,sub:"Le membre perdra l'accès immédiatement.",danger:true,onConfirm:async()=>{try{const r=await fetch("/.netlify/functions/delete-member",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({memberId:m.id,orgId,adminJwt:_authToken})});const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||"Erreur");setTeamMembers(p=>p.filter(x=>x.id!==m.id));setOrgMemberCount(c=>c!==null?c-1:c);addToast(`${m.nom} retiré de l'équipe ✅`,"✅",G.green);}catch(e){addToast(`Erreur: ${e.message}`,"❌",G.red);}}})}
                        style={{background:"#FEE2E2",color:G.red,border:"none",borderRadius:8,padding:"5px 10px",fontSize:13,cursor:"pointer",fontWeight:700}}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
              {(()=>{
                const curPlan = PLANS.find(p=>p.key===settings.plan)||(isPro?PLANS.find(p=>p.key==="basic"):PLANS[0])||PLANS[0];
                const membersUsed = teamMembers.length + 1;
                const atLimit = curPlan.maxMembers && membersUsed >= curPlan.maxMembers;
                const canInvite = orgMemberCount !== null && !atLimit;
                return (<>
                  {canInvite&&<div style={{marginTop:10,display:"flex",gap:6}}>
                    {[{role:"closer",label:"📞 Inviter Closer"},{role:"livreur",label:"🏍️ Inviter Livreur"}].map(r=>(
                      <button key={r.role} onClick={()=>{const token=Math.random().toString(36).substring(2,10).toUpperCase();const link=`${window.location.origin}?org=${orgId}&role=${r.role}&token=${token}`;window.open(`https://wa.me/?text=${encodeURIComponent(`Bonjour ! Rejoins mon équipe sur Teamly:\n${link}`)}`,"_blank");}}
                        style={{flex:1,background:"#25D366",color:G.white,border:"none",borderRadius:9,padding:"9px 0",fontSize:11,fontWeight:700,cursor:"pointer"}}>{r.label} 📲</button>
                    ))}
                  </div>}
                </>);
              })()}
            </div>

            {/* Permission Closer — uniquement comptabilité */}
            <div style={{marginBottom:18}}>
              <div style={{fontSize:12,fontWeight:700,color:G.gray,marginBottom:4,letterSpacing:0.5}}>🔐 PERMISSION CLOSER</div>
              <div style={{fontSize:11,color:G.gray,marginBottom:12}}>Le Closer voit déjà : dashboard, commandes, boutique, tracking, clients, produits, chat, équipe</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:G.grayLight,borderRadius:12,opacity:isGratuit?0.6:1}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:G.dark}}>📊 Accès à la comptabilité</div>
                  <div style={{fontSize:11,color:G.gray,marginTop:1}}>{isGratuit?"🔒 Plan Basic requis":"Revenus, bénéfices, statistiques"}</div>
                </div>
                <button onClick={()=>{if(isGratuit){setShowPlanModal(true);return;}const v=!settings.closerCompta;setSettings(s=>({...s,closerCompta:v}));try{localStorage.setItem(`teamly_cc_${orgId}`,String(v));}catch(e){}sbFetch(`organizations?id=eq.${orgId}`,"PATCH",{settings:{closerCompta:v}},_authToken).then(res=>{if(!res||(Array.isArray(res)&&res.length===0)){setSettings(s=>({...s,closerCompta:!v}));try{localStorage.setItem(`teamly_cc_${orgId}`,String(!v));}catch(e){}addToast("Erreur de sauvegarde — vérifie les règles Supabase","❌","#DC2626");}else{addToast(v?"✅ Closer peut voir la Compta (il doit actualiser son app)":"Accès Compta retiré","✅",v?G.green:"#6B7280");}}).catch(()=>{setSettings(s=>({...s,closerCompta:!v}));try{localStorage.setItem(`teamly_cc_${orgId}`,String(!v));}catch(e){}addToast("Erreur de sauvegarde — réessaie","❌","#DC2626");});}}
                  style={{background:isGratuit?"#E5E7EB":settings.closerCompta?G.green:"#E5E7EB",border:"none",borderRadius:20,width:44,height:24,cursor:isGratuit?"not-allowed":"pointer",position:"relative",flexShrink:0,transition:"background 0.2s"}}>
                  <div style={{position:"absolute",top:2,left:(!isGratuit&&settings.closerCompta)?22:2,width:20,height:20,background:G.white,borderRadius:"50%",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
                </button>
              </div>
            </div>

            {/* Supprimer compte admin */}
            <button onClick={()=>setConfirmModal({msg:"Supprimer ton compte ?",sub:"Toutes les données (commandes, produits, équipe) seront effacées. Cette action est irréversible.",danger:true,onConfirm:async()=>{
              const doLogout=()=>{try{localStorage.clear();}catch(e){}_authToken=null;setRole(null);setSbToken(null);setOrgId(null);setSbReady(false);setOrders([]);setProducts([]);setShowSettings(false);};
              try{
                await Promise.allSettled([
                  sbFetch(`orders?org_id=eq.${orgId}`,"DELETE"),
                  sbFetch(`products?org_id=eq.${orgId}`,"DELETE"),
                  sbFetch(`messages?org_id=eq.${orgId}`,"DELETE"),
                  sbFetch(`notifications?org_id=eq.${orgId}`,"DELETE"),
                  sbFetch(`profiles?id=eq.${currentUser.id}`,"DELETE"),
                ]);
              }catch(e){}
              doLogout();
            }})}
              style={{width:"100%",background:"#FEE2E2",color:G.red,border:"none",borderRadius:10,padding:12,fontWeight:600,fontSize:13,cursor:"pointer",marginBottom:8}}>
              🗑️ Supprimer mon compte
            </button>
            <button onClick={()=>{setShowSettings(false);setTab("frais");}}
              style={{width:"100%",background:"#EFF6FF",color:"#1E40AF",border:"1.5px solid #BFDBFE",borderRadius:10,padding:12,fontWeight:600,fontSize:13,cursor:"pointer",marginBottom:8}}>
              🚚 Frais de livraison
            </button>
            <button onClick={async()=>{
              try{await sbFetch(`profiles?id=eq.${currentUser.id}`,"PATCH",{nom:settings.nom},_authToken);}catch(e){}
              try{await sbFetch(`organizations?id=eq.${orgId}`,"PATCH",{name:settings.boutique,whatsapp:settings.whatsapp},_authToken);}catch(e){}
              try{await sbFetch(`organizations?id=eq.${orgId}`,"PATCH",{settings:{closerCompta:settings.closerCompta,baseZone:settings.baseZone||"sn_dakar",defaultDeliveryPrice:settings.defaultDeliveryPrice||3500}},_authToken);}catch(e){}
              const fresh = await sbFetch(`profiles?id=eq.${currentUser.id}&select=*`).catch(()=>null);
              if(fresh?.[0]) setCurrentUser(u=>({...u,...fresh[0]}));
              else setCurrentUser(u=>({...u,nom:settings.nom}));
              try{
                localStorage.setItem("teamly_nom",settings.nom);
                localStorage.setItem(`teamly_boutique_${orgId}`,settings.boutique||"");
                localStorage.setItem(`teamly_whatsapp_${orgId}`,settings.whatsapp||"");
                localStorage.setItem(`teamly_baseZone_${orgId}`,settings.baseZone||"sn_dakar");
              }catch(e){}
              addToast("Paramètres sauvegardés ✅","✅",G.green);
              setShowSettings(false);
            }} style={{width:"100%",background:G.green,color:G.white,border:"none",borderRadius:10,padding:12,fontWeight:600,fontSize:13,cursor:"pointer"}}>
              ✅ Enregistrer
            </button>
            </>) : (<>
            {/* Profil simplifié pour closer / livreur */}
            <div style={{marginBottom:18}}>
              <div style={{fontSize:12,fontWeight:700,color:G.gray,marginBottom:10,letterSpacing:0.5}}>MON PROFIL</div>
              {[
                {key:"nom",      label:"👤 Ton nom",          ph:"Ton nom"},
                {key:"phone",    label:"📱 Téléphone",         ph:"221 77 123 45 67"},
                {key:"birthday", label:"🎂 Date de naissance", ph:"JJ/MM/AAAA", type:"date"},
              ].map(f=>(
                <div key={f.key} style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:G.gray,marginBottom:3}}>{f.label}</div>
                  <input type={f.type||"text"} value={profileEdit[f.key]||""} onChange={e=>setProfileEdit(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}
                    style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>
            <button onClick={async()=>{
              await sbFetch(`profiles?id=eq.${currentUser.id}`,"PATCH",{nom:profileEdit.nom,phone:profileEdit.phone,birthday:profileEdit.birthday||null}).catch(()=>{});
              // Re-fetch from DB to keep currentUser in sync with any server-side changes
              const fresh = await sbFetch(`profiles?id=eq.${currentUser.id}&select=*`).catch(()=>null);
              if(fresh?.[0]) setCurrentUser(u=>({...u,...fresh[0]}));
              else setCurrentUser(u=>({...u,nom:profileEdit.nom,phone:profileEdit.phone,birthday:profileEdit.birthday}));
              try{localStorage.setItem("teamly_nom",profileEdit.nom);}catch(e){}
              try{localStorage.setItem("teamly_phone",profileEdit.phone||"");}catch(e){}
              try{localStorage.setItem("teamly_birthday",profileEdit.birthday||"");}catch(e){}
              addToast("Profil mis à jour ✅","✅",G.green);
              setShowSettings(false);
            }} style={{width:"100%",background:G.green,color:G.white,border:"none",borderRadius:10,padding:12,fontWeight:600,fontSize:13,cursor:"pointer",marginBottom:10}}>
              ✅ Enregistrer
            </button>
            <button onClick={()=>setConfirmModal({msg:"Supprimer ton compte ?",sub:"Tu perdras l'accès à Teamly définitivement.",danger:true,onConfirm:async()=>{
              try{await sbFetch(`profiles?id=eq.${currentUser.id}`,"DELETE");}catch(e){}
              try{localStorage.clear();}catch(e){}
              _authToken=null;setRole(null);setSbToken(null);setOrgId(null);setSbReady(false);setOrders([]);setProducts([]);setShowSettings(false);
            }})}
              style={{width:"100%",background:"#FEE2E2",color:G.red,border:"none",borderRadius:10,padding:12,fontWeight:600,fontSize:13,cursor:"pointer"}}>
              🗑️ Supprimer mon compte
            </button>
            </>)}

            {/* ── Mes appareils ── */}
            {(()=>{
              const fmtRel = (iso) => {
                if(!iso) return "—";
                const diff = Math.max(0, Date.now() - new Date(iso).getTime());
                const m = Math.floor(diff/60000);
                if (m<1) return "à l'instant";
                if (m<60) return `il y a ${m} min`;
                const h = Math.floor(m/60);
                if (h<24) return `il y a ${h} h`;
                const d = Math.floor(h/24);
                return d<7 ? `il y a ${d} j` : new Date(iso).toLocaleDateString("fr-FR");
              };
              const iconFor = (t) => t==="mobile"||t==="tablet" ? "📱" : "💻";
              const refresh = async () => {
                if (!sbToken) return;
                setLoadingSessions(true);
                try {
                  const r = await fetch(`${SB_URL}/rest/v1/user_sessions?user_id=eq.${currentUser.id}&is_active=eq.true&order=last_active_at.desc&select=*`, {
                    headers: { apikey: SB_KEY, Authorization: `Bearer ${sbToken}` }
                  });
                  const data = await r.json().catch(()=>[]);
                  setMySessions(Array.isArray(data) ? data : []);
                } catch(e) {}
                setLoadingSessions(false);
              };
              const revoke = async (sid) => {
                try {
                  await fetch("/.netlify/functions/revoke-session", {
                    method:"POST",
                    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${sbToken}` },
                    body: JSON.stringify({ session_id: sid, by_fingerprint: deviceFingerprint }),
                  });
                  setMySessions(p=>p.filter(s=>s.id!==sid));
                  addToast("Appareil déconnecté ✅","✅",G.green);
                } catch(e){ addToast("Erreur","❌",G.red); }
              };
              const revokeOthers = async () => {
                if (!deviceFingerprint) return;
                try {
                  await fetch("/.netlify/functions/revoke-session", {
                    method:"POST",
                    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${sbToken}` },
                    body: JSON.stringify({ all_others: true, by_fingerprint: deviceFingerprint }),
                  });
                  setMySessions(p=>p.filter(s=>s.device_fingerprint===deviceFingerprint));
                  addToast("Tous les autres appareils déconnectés ✅","✅",G.green);
                } catch(e){ addToast("Erreur","❌",G.red); }
              };
              return (
              <div style={{marginTop:18,paddingTop:18,borderTop:`1px solid ${G.grayLight}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontSize:12,fontWeight:700,color:G.gray,letterSpacing:0.5}}>🔐 MES APPAREILS CONNECTÉS</div>
                  <button onClick={refresh} disabled={loadingSessions} style={{background:"none",border:"none",color:G.gray,fontSize:12,cursor:loadingSessions?"not-allowed":"pointer"}}>{loadingSessions?"…":"↺"}</button>
                </div>
                <div style={{fontSize:11,color:G.gray,marginBottom:10}}>Maximum 2 appareils par compte</div>
                {mySessions.length===0 && !loadingSessions && (
                  <button onClick={refresh} style={{width:"100%",background:G.grayLight,border:"none",borderRadius:8,padding:"10px 0",fontSize:12,color:G.gray,cursor:"pointer",marginBottom:10}}>Charger mes appareils</button>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {mySessions.map(s=>{
                    const isCurrent = s.device_fingerprint===deviceFingerprint;
                    return (
                      <div key={s.id} style={{border:`1px solid ${isCurrent?G.green+"55":G.grayLight}`,background:isCurrent?G.greenLight+"55":"#fff",borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:10}}>
                        <div style={{fontSize:24,flexShrink:0}}>{iconFor(s.device_type)}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:700,color:G.dark,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                            {s.device_name||"Appareil"}
                            {isCurrent && <span style={{background:G.green,color:"#fff",borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>✅ CET APPAREIL</span>}
                          </div>
                          <div style={{fontSize:10,color:G.gray,marginTop:2}}>{s.os||""}{s.location?` · ${s.location}`:""}</div>
                          <div style={{fontSize:10,color:G.gray,marginTop:1}}>Dernière activité : {fmtRel(s.last_active_at)}</div>
                        </div>
                        {!isCurrent && (
                          <button onClick={()=>revoke(s.id)} style={{background:"#FEE2E2",color:G.red,border:"none",borderRadius:7,padding:"6px 10px",fontSize:10,fontWeight:700,cursor:"pointer",flexShrink:0}}>Déconnecter</button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {mySessions.length>1 && (
                  <button onClick={revokeOthers} style={{marginTop:10,width:"100%",background:"#FFF8E7",color:"#92400E",border:`1px solid ${G.gold}55`,borderRadius:8,padding:"9px 0",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    Déconnecter tous les autres appareils
                  </button>
                )}
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── MODAL: Profil membre ── */}
      {memberModal&&(
        <div onClick={()=>setMemberModal(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:600,display:"flex",alignItems:isDesktop?"center":"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:G.white,borderRadius:isDesktop?20:"20px 20px 0 0",width:"100%",maxWidth:480,padding:20,paddingBottom:32}}>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div>
                <div style={{fontWeight:800,fontSize:16,color:G.dark}}>{memberModal.nom}</div>
                <div style={{fontSize:11,color:G.gray,marginTop:2}}>{memberModal.role==="closer"?"📞 Closer":"🏍️ Livreur"} · {memberModal.email}</div>
              </div>
              <button onClick={()=>setMemberModal(null)} style={{background:G.grayLight,border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontWeight:700}}>✕</button>
            </div>

            {/* Infos */}
            <div style={{background:G.grayLight,borderRadius:12,padding:12,marginBottom:14}}>
              <div style={{display:"flex",gap:12}}>
                <div style={{flex:1,textAlign:"center"}}>
                  <div style={{fontSize:18,fontWeight:800,color:G.green}}>
                    {memberModal.role==="closer"
                      ? orders.filter(o=>o.closer_id===memberModal.id&&o.status==="entregado").length
                      : orders.filter(o=>o.livreur_id===memberModal.id&&o.status==="entregado").length}
                  </div>
                  <div style={{fontSize:10,color:G.gray}}>Livrées</div>
                </div>
                <div style={{flex:1,textAlign:"center"}}>
                  <div style={{fontSize:18,fontWeight:800,color:G.red}}>
                    {memberModal.role==="closer"
                      ? orders.filter(o=>o.closer_id===memberModal.id&&o.status==="rechazado").length
                      : orders.filter(o=>o.livreur_id===memberModal.id&&o.status==="rechazado").length}
                  </div>
                  <div style={{fontSize:10,color:G.gray}}>Rejetées</div>
                </div>
                <div style={{flex:1,textAlign:"center"}}>
                  <div style={{fontSize:18,fontWeight:800,color:G.blue}}>
                    {memberModal.role==="closer"
                      ? orders.filter(o=>o.closer_id===memberModal.id).length
                      : orders.filter(o=>o.livreur_id===memberModal.id).length}
                  </div>
                  <div style={{fontSize:10,color:G.gray}}>Total</div>
                </div>
              </div>
            </div>

            {/* Permission Closer — uniquement comptabilité */}
            {memberModal.role==="closer"&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:700,color:G.dark,marginBottom:10}}>Permission</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",opacity:isGratuit?0.6:1}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:G.dark}}>Accès à la comptabilité</div>
                    <div style={{fontSize:10,color:isGratuit?G.gold:G.gray}}>{isGratuit?"🔒 Plan Basic requis":"Revenus, marges et statistiques"}</div>
                  </div>
                  <button onClick={()=>{if(isGratuit){setShowPlanModal(true);return;}const v=!settings.closerCompta;setSettings(s=>({...s,closerCompta:v}));try{localStorage.setItem(`teamly_cc_${orgId}`,String(v));}catch(e){}sbFetch(`organizations?id=eq.${orgId}`,"PATCH",{settings:{closerCompta:v}},_authToken).then(res=>{if(!res||(Array.isArray(res)&&res.length===0)){setSettings(s=>({...s,closerCompta:!v}));try{localStorage.setItem(`teamly_cc_${orgId}`,String(!v));}catch(e){}addToast("Erreur de sauvegarde — vérifie les règles Supabase","❌","#DC2626");}else{addToast(v?"✅ Closer peut voir la Compta (il doit actualiser son app)":"Accès Compta retiré","✅",v?G.green:"#6B7280");}}).catch(()=>{setSettings(s=>({...s,closerCompta:!v}));try{localStorage.setItem(`teamly_cc_${orgId}`,String(!v));}catch(e){}addToast("Erreur de sauvegarde — réessaie","❌","#DC2626");});}}
                    style={{background:isGratuit?"#E5E7EB":settings.closerCompta?"#22C55E":G.grayLight,border:"none",borderRadius:20,width:44,height:24,cursor:isGratuit?"not-allowed":"pointer",position:"relative",flexShrink:0,transition:"background 0.2s"}}>
                    <div style={{position:"absolute",top:2,left:(!isGratuit&&settings.closerCompta)?22:2,width:20,height:20,background:G.white,borderRadius:"50%",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
                  </button>
                </div>
              </div>
            )}

            {/* Supprimer membre */}
            <button onClick={async()=>{
              if(!window.confirm(`Supprimer ${memberModal.nom} de l'équipe ?`)) return;
              try {
                const r=await fetch("/.netlify/functions/delete-member",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({memberId:memberModal.id,orgId,adminJwt:_authToken})});
                const d=await r.json();
                if(!r.ok||!d.success) throw new Error(d.error||"Erreur serveur");
                setTeamMembers(t=>t.filter(m=>m.id!==memberModal.id));
                setOrgMemberCount(c=>c!==null?c-1:c);
                addToast(`${memberModal.nom} retiré de l'équipe ✅`,"✅",G.green);
                setMemberModal(null);
              } catch(e){ addToast(`Erreur: ${e.message}`,"❌",G.red); }
            }} style={{width:"100%",background:"#FEE2E2",color:G.red,border:"none",borderRadius:12,padding:"12px 0",fontWeight:700,fontSize:14,cursor:"pointer"}}>
              Retirer de l'équipe
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: Changer de plan ── */}
      {showPlanModal&&(
        <div onClick={()=>setShowPlanModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:600,overflowY:"auto",padding:"20px 0"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:G.white,borderRadius:20,margin:"0 auto",width:"100%",maxWidth:480,overflow:"hidden"}}>
            {/* Header */}
            <div style={{background:"linear-gradient(135deg,#0D1F14,#1A3828)",padding:"20px 22px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:800,fontSize:18,color:"#FFF"}}>Nos plans</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginTop:2}}>Choisissez le plan adapté à votre équipe</div>
              </div>
              <button onClick={()=>setShowPlanModal(false)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"50%",width:32,height:32,color:"#FFF",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>

            <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:12}}>
              {PLANS.map(p=>{
                const isCurrent = (settings.plan||"gratuit")===p.key;
                const isPaidPlan = p.key!=="gratuit";
                return (
                  <div key={p.key} style={{border:`2px solid ${isCurrent?p.color:"#F3F4F6"}`,borderRadius:16,overflow:"hidden",background:isCurrent?p.bg:"#FFF"}}>
                    {/* Plan header */}
                    <div style={{padding:"14px 16px",borderBottom:`1px solid ${isCurrent?p.color+"30":"#F3F4F6"}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontWeight:800,fontSize:16,color:p.color}}>{p.name}</span>
                            {p.tag&&<span style={{background:p.color,color:"#FFF",borderRadius:6,padding:"2px 7px",fontSize:9,fontWeight:700,letterSpacing:0.5}}>{p.tag.toUpperCase()}</span>}
                            {isCurrent&&<span style={{background:"#10B981",color:"#FFF",borderRadius:6,padding:"2px 7px",fontSize:9,fontWeight:700}}>ACTUEL</span>}
                          </div>
                          <div style={{fontSize:11,color:G.gray,marginTop:2}}>{p.description}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontWeight:800,fontSize:18,color:G.dark,lineHeight:1}}>{p.key==="gratuit"?"Gratuit":p.price.split(" CFA")[0]}</div>
                          {p.key!=="gratuit"&&<div style={{fontSize:10,color:G.gray}}>CFA / mois</div>}
                          {p.key==="gratuit"&&<div style={{fontSize:10,color:G.gray}}>14 jours</div>}
                        </div>
                      </div>
                      {/* Stats rapides */}
                      <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                        {[
                          p.maxOrders?`${p.maxOrders.toLocaleString()} cmd/mois`:"Commandes illim.",
                          p.maxMembers?`${p.maxMembers} membres`:"Membres illim.",
                          p.maxStores===0?"Boutique non connectée":p.maxStores===1?"1 boutique":p.maxStores===null?"Boutiques illim.":`${p.maxStores} boutiques`,
                        ].map((s,i)=>(
                          <span key={i} style={{background:isCurrent?p.color+"15":"#F3F4F6",color:isCurrent?p.color:G.gray,borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:600}}>{s}</span>
                        ))}
                      </div>
                    </div>

                    {/* Features */}
                    <div style={{padding:"12px 16px"}}>
                      <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:p.locked?.length?10:0}}>
                        {p.features.map((f,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:G.dark}}>
                            <div style={{width:5,height:5,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                            {f}
                          </div>
                        ))}
                      </div>
                      {p.locked?.length>0&&(
                        <div style={{marginTop:6,paddingTop:8,borderTop:"1px solid #F3F4F6"}}>
                          {p.locked.map((f,i)=>(
                            <div key={i} style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:"#D1D5DB",marginBottom:4}}>
                              <div style={{width:5,height:5,borderRadius:"50%",background:"#E5E7EB",flexShrink:0}}/>
                              {f}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Bouton */}
                      {!isCurrent&&(
                        <button onClick={async()=>{
                          if(isPaidPlan && !isOwner){
                            startWavePayment(p.priceNum, p.key);
                            setShowPlanModal(false);
                          } else {
                            // Mise à jour immédiate locale
                            setSettings(s=>({...s, plan:p.key}));
                            const paidPlans = ["basic","pro","scale"];
                            if(paidPlans.includes(p.key)) setIsPro(true);
                            else if(!isOwner) setIsPro(false);
                            setShowPlanModal(false);
                            // Sauvegarde en base
                            try {
                              await sbFetch(`organizations?id=eq.${orgId}`,"PATCH",{plan:p.key},_authToken);
                              addToast(`Plan ${p.name} activé ✅`,"✅",p.color);
                            } catch(e) {
                              addToast("Erreur sauvegarde — réessaie","❌","#DC2626");
                            }
                          }
                        }} style={{width:"100%",marginTop:10,background:p.color,color:"#FFF",border:"none",borderRadius:10,padding:"11px 0",fontWeight:700,fontSize:13,cursor:"pointer",letterSpacing:0.2}}>
                          {isPaidPlan && !isOwner ? `Passer au ${p.name} — ${p.price}` : `Activer le plan ${p.name}`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── BANNER: iOS Install ── */}
      {showIosInstall&&(
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,zIndex:500,padding:"0 12px 12px"}}>
          <div style={{background:G.white,borderRadius:18,padding:"18px 18px 14px",boxShadow:"0 -4px 32px rgba(0,0,0,0.18)",border:`1.5px solid ${G.greenLight}`}}>
            <button onClick={()=>{setShowIosInstall(false);try{localStorage.setItem("teamly_ios_install_dismissed","1");}catch(e){}}}
              style={{position:"absolute",top:12,right:14,background:"none",border:"none",fontSize:20,color:G.gray,cursor:"pointer",lineHeight:1}}>✕</button>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <img src="/apple-touch-icon.png" style={{width:48,height:48,borderRadius:11,flexShrink:0}} alt="Teamly"/>
              <div>
                <div style={{fontWeight:800,fontSize:15,color:G.dark}}>Installer Teamly</div>
                <div style={{fontSize:12,color:G.gray,marginTop:2}}>Accès rapide depuis ton écran d'accueil</div>
              </div>
            </div>
            <div style={{background:G.greenLight,borderRadius:12,padding:"12px 14px",fontSize:12,color:G.green,lineHeight:1.8}}>
              <div><strong>1.</strong> Appuie sur <strong style={{letterSpacing:0.3}}>
                <svg style={{verticalAlign:"middle",marginRight:3}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                Partager</strong> en bas de Safari</div>
              <div><strong>2.</strong> Sélectionne <strong>"Sur l'écran d'accueil"</strong></div>
              <div><strong>3.</strong> Appuie sur <strong>"Ajouter"</strong> — c'est tout !</div>
            </div>
            <button onClick={()=>{setShowIosInstall(false);try{localStorage.setItem("teamly_ios_install_dismissed","1");}catch(e){}}}
              style={{width:"100%",marginTop:12,background:G.green,color:"#fff",border:"none",borderRadius:12,padding:"12px 0",fontWeight:700,fontSize:14,cursor:"pointer"}}>
              J'ai compris
            </button>
          </div>
        </div>
      )}

      {/* GPS refusé — bannière d'alerte livreur */}
      {gpsError&&role==="livreur"&&!gpsActive&&(
        <div style={{position:"fixed",bottom:isDesktop?28:72,left:0,right:0,zIndex:500,display:"flex",justifyContent:"center",pointerEvents:"none"}}>
          <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:12,padding:"10px 16px",fontSize:12,color:"#92400E",display:"flex",gap:8,alignItems:"center",maxWidth:360,pointerEvents:"all",margin:"0 16px"}}>
            <span>⚠️</span>
            <span style={{flex:1}}>{gpsError}</span>
            <button onClick={()=>setGpsError("")} style={{background:"none",border:"none",cursor:"pointer",color:"#92400E",fontSize:14}}>✕</button>
          </div>
        </div>
      )}

      {/* ── MODAL: Nouvelle livraison assignée (Livreur) ── */}
      {newAssignment&&role==="livreur"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:isDesktop?"center":"flex-end",justifyContent:"center"}}>
          <div style={{background:G.white,borderRadius:isDesktop?24:"24px 24px 0 0",padding:28,width:"100%",maxWidth:480,boxShadow:"0 -8px 40px rgba(0,0,0,0.3)"}}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
              <div style={{background:G.greenLight,borderRadius:"50%",width:52,height:52,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>
                📦
              </div>
              <div>
                <div style={{fontWeight:800,fontSize:18,color:G.dark}}>Nouvelle livraison !</div>
                <div style={{fontSize:12,color:G.gray,marginTop:2}}>Une commande vient de t'être assignée</div>
              </div>
            </div>

            {/* Détails commande */}
            <div style={{background:G.grayLight,borderRadius:14,padding:"14px 16px",marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:16,color:G.dark,marginBottom:10}}>{newAssignment.client}</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14}}>📍</span>
                  <span style={{fontSize:13,color:G.dark}}>{newAssignment.address}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14}}>📱</span>
                  <span style={{fontSize:13,color:G.dark}}>{newAssignment.phone}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14}}>📦</span>
                  <span style={{fontSize:13,color:G.dark}}>{newAssignment.product}</span>
                </div>
              </div>
              <div style={{background:G.green,borderRadius:10,padding:"10px 14px",marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,color:"rgba(255,255,255,0.8)",fontWeight:600}}>Montant COD</span>
                <span style={{fontSize:24,fontWeight:800,color:G.gold}}>{Number(newAssignment.price).toLocaleString("fr-FR")} CFA</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={()=>{
                upSt(newAssignment.id,"livreur_en_route");
                addToast("Livraison acceptée — Va récupérer le colis 🏍️","🏍️",G.green);
                setNewAssignment(null);
              }} style={{background:G.green,color:G.white,border:"none",borderRadius:14,padding:"16px 0",fontWeight:800,fontSize:17,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
                <span style={{fontSize:22}}>✅</span> Accepter le colis
              </button>
              <button onClick={()=>{
                // Refus — remet la commande sans livreur
                setOrders(o=>o.map(x=>x.id===newAssignment.id?{...x,livreur:null,status:"confirmado"}:x));
                addToast("Livraison refusée","❌",G.red);
                setNewAssignment(null);
              }} style={{background:G.redLight,color:G.red,border:"none",borderRadius:14,padding:"13px 0",fontWeight:700,fontSize:14,cursor:"pointer"}}>
                Refuser cette livraison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: WhatsApp ── */}
      {showWA&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:G.white,borderRadius:20,padding:24,maxWidth:320,width:"100%"}}>
            <div style={{fontSize:40,textAlign:"center",marginBottom:10}}>📲</div>
            <div style={{fontWeight:700,fontSize:15,textAlign:"center",marginBottom:4}}>Envoyer le message</div>
            <div style={{fontSize:12,color:G.gray,textAlign:"center",marginBottom:20}}>Choisissez comment envoyer la confirmation au client</div>

            {/* Option 1 — Ouvrir WhatsApp */}
            <a href={waUrl} target="_blank" rel="noreferrer"
              style={{display:"flex",alignItems:"center",gap:10,background:"#25D366",color:G.white,borderRadius:12,padding:"13px 16px",textDecoration:"none",fontWeight:700,fontSize:14,marginBottom:10}}>
              <span style={{fontSize:22}}>💬</span>
              <div>
                <div>Ouvrir WhatsApp</div>
                <div style={{fontSize:10,fontWeight:400,opacity:0.85}}>Ouvre l'app sur votre téléphone</div>
              </div>
            </a>

            {/* Option 2 — Copier le message */}
            <button onClick={()=>{
              const text = new URL(waUrl).searchParams.get("text")||"";
              navigator.clipboard?.writeText(decodeURIComponent(text))
                .then(()=>alert("✅ Message copié ! Colle-le dans WhatsApp."))
                .catch(()=>alert("Copie manuelle:\n\n"+decodeURIComponent(new URL(waUrl).searchParams.get("text")||"")));
            }} style={{width:"100%",background:"#F0FDF4",color:G.green,border:`1.5px solid ${G.green}`,borderRadius:12,padding:"11px 0",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:10}}>
              📋 Copier le message
            </button>

            <button onClick={()=>setShowWA(false)}
              style={{width:"100%",background:G.grayLight,color:G.gray,border:"none",borderRadius:10,padding:10,fontSize:13,cursor:"pointer"}}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: Modifier commande ── */}
      {editOrder&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:isDesktop?"center":"flex-end"}}>
          <div style={{background:G.white,borderRadius:isDesktop?20:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontWeight:700,fontSize:16,color:G.green,marginBottom:16}}>✏️ Modifier la commande #{editOrder.id}</div>

            {[
              {key:"client",   label:"👤 Nom client",        ph:"Moussa Diallo",   type:"text"},
              {key:"phone",    label:"📱 Téléphone",          ph:"77 123 45 67",    type:"text"},
              {key:"address",  label:"📍 Adresse du client",  ph:"Médina, Dakar",   type:"text"},
              {key:"product",  label:"📦 Produit",            ph:"Chaussures Nike", type:"text"},
              {key:"price",    label:"💰 Prix COD (CFA)",     ph:"25000",           type:"number"},
              {key:"fraisLiv", label:"🚚 Frais livraison (CFA)", ph:"1500",        type:"number"},
            ].map(f=>(
              <div key={f.key} style={{marginBottom:10}}>
                <div style={{fontSize:11,color:G.gray,marginBottom:3}}>{f.label}</div>
                <input type={f.type} value={editOrder[f.key]||""} onChange={e=>setEditOrder(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}
                  style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}

            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>🏙️ Ville du client</div>
              <CityComboBox
                value={editOrder.city||""}
                onCityChange={(cityName, zoneInfo)=>{
                  const autoFee = zoneInfo.type!=="unknown" ? String(zoneInfo.price) : (editOrder.fraisLiv||"");
                  setEditOrder(p=>({...p, city:cityName, fraisLiv:autoFee, deliveryZoneType:zoneInfo.type, deliveryZoneName:zoneInfo.name||""}));
                }}
                mainRegion={mainRegion} otherRegions={otherRegions}
                defaultDeliveryPrice={settings.defaultDeliveryPrice||3500} G={G} fmt={fmt}
              />
              {editOrder.city&&(()=>{
                const z=detectDeliveryZone(editOrder.city,mainRegion,otherRegions,settings.defaultDeliveryPrice||3500);
                return (
                  <div style={{marginTop:5}}>
                    {z.type==="main"   &&<span style={{background:"#DCFCE7",color:"#166534",borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700}}>🟢 {z.name||mainRegion?.name} · {fmt(z.price)} CFA</span>}
                    {z.type==="other"  &&<span style={{background:"#DBEAFE",color:"#1E40AF",borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700}}>🔵 {z.name} · {fmt(z.price)} CFA</span>}
                    {z.type==="senegal"&&<span style={{background:"#F3F4F6",color:"#374151",borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700}}>⚪ {z.name} · tarif par défaut</span>}
                    {z.type==="unknown"&&<span style={{background:"#FEF3C7",color:"#92400E",borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700}}>⚠️ Ville inconnue</span>}
                  </div>
                );
              })()}
            </div>

            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>📊 Statut</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {(()=>{
                  const OTHER_KEYS = ["en_attente_paiement","paiement_confirme","colis_en_main","en_route","remis_transporteur","entregado","rechazado","no_contesta","reprogramar"];
                  const MAIN_KEYS  = ["pendiente","confirmado","livreur_en_route","colis_pris","en_camino","chez_client","entregado","rechazado","no_contesta","reprogramar","boutique"];
                  const keys = editOrder.region_type==="other" ? OTHER_KEYS : MAIN_KEYS;
                  return keys.filter(k=>STATUS[k]).map(k=>{
                    const v=STATUS[k];
                    return (
                      <button key={k} onClick={()=>setEditOrder(p=>({...p,status:k}))}
                        style={{background:editOrder.status===k?v.bg:"#F4F4F4",color:editOrder.status===k?v.color:G.gray,border:`2px solid ${editOrder.status===k?v.color:G.grayLight}`,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                        {v.label}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>

            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>🏍️ Livreur</div>
              <select value={editOrder.livreur||""} onChange={e=>setEditOrder(p=>({...p,livreur:e.target.value||null}))}
                style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:G.dark,background:G.white,boxSizing:"border-box"}}>
                <option value="">Sans livreur</option>
                {teamMembers.filter(m=>m.role==="livreur").map(m=><option key={m.id} value={m.nom}>{m.nom}</option>)}
              </select>
            </div>

            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>📝 Note</div>
              <textarea value={editOrder.note||""} onChange={e=>setEditOrder(p=>({...p,note:e.target.value}))} placeholder="Note optionnelle..."
                style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:10,fontSize:13,outline:"none",minHeight:60,resize:"none",boxSizing:"border-box"}}/>
            </div>

            <div style={{display:"flex",gap:8}}>
              <button onClick={async()=>{
                const _fl=parseFloat(editOrder.fraisLiv)||editOrder.fraisLiv;
                const id=editOrder.id;
                const updated={...editOrder,price:parseInt(editOrder.price)||editOrder.price,fraisLiv:_fl,deliveryFee:_fl};
                const prevOrders=orders;
                setOrders(o=>o.map(x=>x.id===id?{...x,...updated}:x));
                setEditOrder(null);
                if(orgId&&!String(id).startsWith("tmp_")){
                  pendingOrderUpdates.current[id]=Date.now();
                  try {
                    await sbFetch(`orders?id=eq.${id}`,"PATCH",{
                      client:updated.client,phone:updated.phone,address:updated.address,
                      product:updated.product,price:updated.price,frais_liv:_fl||null,
                      status:updated.status,livreur:updated.livreur||null,note:updated.note||""
                    });
                    addToast("Commande mise à jour ✓","✅",G.green);
                  } catch(e){
                    console.error("edit save:",e);
                    setOrders(prevOrders);
                    addToast("Erreur sauvegarde — réessaie","⚠️",G.red,8000);
                  }
                }
                // Auto-save unknown city with manual fee
                if(orgId&&updated.city&&updated.deliveryZoneType==="unknown"&&_fl>0){
                  const cityName=fmtCity(updated.city);
                  const already=otherRegions.some(r=>_normCity(r.name)===_normCity(cityName));
                  if(!already) sbFetch("delivery_other_regions","POST",{org_id:orgId,name:cityName,price:_fl,interurbain_price:0,cities:[cityName]})
                    .then(res=>{const s=Array.isArray(res)?res[0]:res;if(s?.id)setOtherRegions(prev=>[...prev,s]);}).catch(()=>{});
                }
                // Alias-learning: if the order's note contains a raw city (from webhook ⚠️/~🏙️),
                // and admin has now assigned it to a known zone, register the raw city as an alias.
                if(orgId&&updated.city&&!String(id).startsWith("tmp_")){
                  const rawCityMatch=(updated.note||"").match(/[⚠️~]?🏙️([^\s\n]+)/);
                  const rawCity=rawCityMatch?rawCityMatch[1]:null;
                  if(rawCity&&_normCity(rawCity)!==_normCity(updated.city)){
                    const z=detectDeliveryZone(updated.city,mainRegion,otherRegions,settings.defaultDeliveryPrice||3500);
                    if(z.type==="main"&&mainRegion?.id){
                      const curr=mainRegion.aliases||[];
                      if(!curr.some(a=>_normCity(a)===_normCity(rawCity))){
                        const aliases=[...curr,rawCity];
                        sbFetch(`delivery_main_region?id=eq.${mainRegion.id}`,"PATCH",{aliases}).catch(()=>{});
                        setMainRegion(r=>({...r,aliases}));
                      }
                    } else if(z.type==="other"){
                      const zone=otherRegions.find(r=>_normCity(r.name)===_normCity(z.name||""));
                      if(zone?.id){
                        const curr=zone.aliases||[];
                        if(!curr.some(a=>_normCity(a)===_normCity(rawCity))){
                          const aliases=[...curr,rawCity];
                          sbFetch(`delivery_other_regions?id=eq.${zone.id}`,"PATCH",{aliases}).catch(()=>{});
                          setOtherRegions(prev=>prev.map(r=>r.id===zone.id?{...r,aliases}:r));
                        }
                      }
                    }
                  }
                }
              }} style={{flex:1,background:G.green,color:G.white,border:"none",borderRadius:10,padding:12,fontWeight:700,fontSize:13,cursor:"pointer"}}>
                ✅ Enregistrer
              </button>
              <button onClick={()=>setConfirmModal({
                  msg:"Supprimer cette commande définitivement ?",
                  sub:"Cette action est irréversible.",
                  danger:true,
                  onConfirm:async()=>{
                    const id = editOrder.id;
                    setEditOrder(null);
                    try {
                      await sbFetch(`orders?id=eq.${id}`,"PATCH",{archived:true});
                      setOrders(o=>o.filter(x=>x.id!==id));
                      console.log("DELETE order:", id, "→ archived:true ✓");
                    } catch(e) {
                      console.error("DELETE order failed:", id, e.message);
                      addToast("Erreur suppression: "+e.message.slice(0,80),"❌",G.red,8000);
                    }
                  }
                })} style={{background:"#FEE2E2",color:G.red,border:"none",borderRadius:10,padding:"12px 16px",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                🗑️
              </button>
              <button onClick={()=>setEditOrder(null)} style={{background:G.grayLight,color:G.gray,border:"none",borderRadius:10,padding:12,cursor:"pointer",fontSize:13}}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Modifier produit ── */}
      {editProd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:isDesktop?"center":"flex-end"}}>
          <div style={{background:G.white,borderRadius:isDesktop?20:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{fontWeight:700,fontSize:16,color:G.green,marginBottom:4}}>✏️ Modifier le produit</div>
            <div style={{fontSize:11,color:G.gray,marginBottom:16}}>{editProd.name}</div>

            {[
              {key:"name",  label:"📦 Nom du produit *",               type:"text",   ph:"Chaussures Nike"},
              {key:"cost",  label:"💰 Coût total du produit (CFA) *", type:"number", ph:"7000", sub:"Prix d'achat + import + douane + transport + emballage"},
              {key:"price", label:"💰 Prix de vente (CFA) *",          type:"number", ph:"25000"},
            ].map(f=>(
              <div key={f.key} style={{marginBottom:10}}>
                <div style={{fontSize:11,color:G.gray,marginBottom:f.sub?1:3}}>{f.label}</div>
                {f.sub&&<div style={{fontSize:10,color:"#9CA3AF",marginBottom:4}}>{f.sub}</div>}
                <input type={f.type} value={editProd[f.key]||""} onChange={e=>setEditProd(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}
                  style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}

            {/* Niche */}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>🎯 Niche de produit *</div>
              <input type="text" value={editProd.niche||""} onChange={e=>setEditProd(p=>({...p,niche:e.target.value}))} placeholder="Mode, Beauté..."
                style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:6}}>
                {["Mode & Vêtements","Chaussures","Beauté & Cosmétiques","Électronique","Téléphones","Maison & Déco","Sport & Fitness","Santé","Enfants & Jouets","Montres & Bijoux","Alimentation"].filter(n=>!editProd.niche||n.toLowerCase().includes((editProd.niche||"").toLowerCase())).slice(0,8).map(n=>(
                  <button key={n} onClick={()=>setEditProd(p=>({...p,niche:n}))}
                    style={{background:editProd.niche===n?G.green:G.grayLight,color:editProd.niche===n?G.white:G.dark,border:"none",borderRadius:20,padding:"3px 10px",fontSize:11,cursor:"pointer"}}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock direct */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>📦 Ajuster stock actuel</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type="number" min="0" value={editProd.stock||0} onChange={e=>setEditProd(p=>({...p,stock:e.target.value,stockInitial:e.target.value}))}
                  style={{flex:1,border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                <span style={{fontSize:11,color:G.gray}}>unités</span>
              </div>
            </div>

            {/* Aperçu marge */}
            {editProd.cost&&editProd.price&&(
              <div style={{background:G.greenLight,borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:12,color:G.gray}}>Marge / unité</span>
                <span style={{fontSize:14,fontWeight:700,color:G.green}}>
                  {fmt(parseInt(editProd.price||0)-parseInt(editProd.cost||0)-(settings.defaultDeliveryPrice||1500))} CFA
                </span>
              </div>
            )}

            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{
                const updProd = {
                  ...editProd,
                  name:editProd.name,
                  cost:parseInt(editProd.cost)||0,
                  price:parseInt(editProd.price)||0,
                  fraisLiv:parseInt(editProd.fraisLiv)||1500,
                  fraisLivExtra:parseInt(editProd.fraisLivExtra)||0,
                  niche:editProd.niche,
                  stock:parseInt(editProd.stock)||0,
                  stockInitial:parseInt(editProd.stock)||0,
                };
                setProducts(p=>p.map(x=>x.id===editProd.id?{...x,...updProd}:x));
                if(!String(editProd.id).startsWith("tmp_"))
                  sbFetch(`products?id=eq.${editProd.id}`,"PATCH",{
                    name:updProd.name,cost:updProd.cost,price:updProd.price,
                    frais_liv:updProd.fraisLiv,frais_liv_extra:updProd.fraisLivExtra,
                    niche:updProd.niche,stock:updProd.stock,stock_initial:updProd.stockInitial,
                  }).catch(e=>console.error("editProd save:",e.message));
                setEditProd(null);
              }} style={{flex:1,background:G.green,color:G.white,border:"none",borderRadius:10,padding:12,fontWeight:700,fontSize:13,cursor:"pointer"}}>
                ✅ Enregistrer
              </button>
              <button onClick={()=>{
                setConfirmModal({
                  msg:`Supprimer "${editProd.name}" ?`,
                  sub:"Stock et historique supprimés définitivement.",
                  danger:true,
                  onConfirm:()=>{ 
                    setProducts(p=>p.filter(x=>x.id!==editProd.id));
                    if(!String(editProd.id).startsWith("tmp_")) sbFetch(`products?id=eq.${editProd.id}`,"PATCH",{archived:true});
                    setEditProd(null);
                  }
                })
  }} style={{background:"#FEE2E2",color:G.red,border:"none",borderRadius:10,padding:"12px 14px",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                🗑️ Supprimer
              </button>
              <button onClick={()=>setEditProd(null)} style={{background:G.grayLight,color:G.gray,border:"none",borderRadius:10,padding:12,cursor:"pointer",fontSize:13}}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Détail commande ── */}
      {orderDetail&&(()=>{
        const o=orderDetail;
        const st=STATUS[o.status]||STATUS.pendiente;
        const isRejected=["rechazado","no_contesta","reprogramar"].includes(o.status);
        const PSTEPS=[
          {key:"pendiente",       label:"En attente",        sub:"Commande reçue",                  icon:"🕐", color:"#F0A500"},
          {key:"confirmado",      label:"Confirmé",          sub:"Client a confirmé",                icon:"✅", color:"#2E8B57"},
          {key:"livreur_en_route",label:"Livreur en route",  sub:"Se dirige vers le dépôt",          icon:"🏍️", color:"#7C3AED"},
          {key:"colis_pris",      label:"Colis en main",     sub:"Livreur a récupéré le colis",      icon:"📦", color:"#2563EB"},
          {key:"en_camino",       label:"En livraison",      sub:"En route vers le client",          icon:"🚀", color:"#0284C7"},
          {key:"chez_client",     label:"Chez le client",    sub:"Livreur est à destination",        icon:"📍", color:"#D97706"},
          {key:"entregado",       label:"Livré & Encaissé",  sub:"Paiement COD reçu ✓",             icon:"💰", color:"#1A5C38"},
        ];
        const activeIdx=PSTEPS.findIndex(s=>s.key===o.status);
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:400,display:"flex",alignItems:isDesktop?"center":"flex-end",justifyContent:"center"}} onClick={()=>setOrderDetail(null)}>
            <div onClick={e=>e.stopPropagation()} style={{background:G.white,borderRadius:isDesktop?24:"24px 24px 0 0",padding:24,width:"100%",maxWidth:480,maxHeight:"92vh",overflowY:"auto"}}>
              <div style={{width:40,height:4,background:G.grayLight,borderRadius:2,margin:"0 auto 20px"}}/>

              {/* Status badge */}
              <div style={{background:st.bg,borderRadius:14,padding:"14px 16px",textAlign:"center",marginBottom:20,border:`2px solid ${st.color}`}}>
                <div style={{fontSize:28,marginBottom:4}}>{isRejected?"❌":PSTEPS[Math.max(0,activeIdx)]?.icon||"📦"}</div>
                <div style={{fontSize:17,fontWeight:800,color:st.color}}>{st.label}</div>
                {o.status==="entregado"&&<div style={{fontSize:12,color:G.green,marginTop:3,fontWeight:600}}>💵 {Number(o.price).toLocaleString("fr-FR")} F encaissé</div>}
              </div>

              {/* Progress Tracker — vertical stepper */}
              {!isRejected&&(
                <div style={{marginBottom:20,padding:"16px",background:"#F8FAFC",borderRadius:16,border:"1px solid #E2E8F0"}}>
                  <div style={{fontSize:12,fontWeight:700,color:G.gray,marginBottom:14,textTransform:"uppercase",letterSpacing:0.5}}>📊 Suivi de commande</div>
                  {PSTEPS.map((step,i)=>{
                    const done = activeIdx>i || o.status==="entregado";
                    const active = activeIdx===i && o.status!=="entregado";
                    const isLast = i===PSTEPS.length-1;
                    return (
                      <div key={step.key} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                        {/* Left: circle + line */}
                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                          <div style={{
                            width:32,height:32,borderRadius:"50%",
                            background:done?G.green:active?step.color:"#E5E7EB",
                            display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:done?13:15,
                            border:`2px solid ${done?"#6EE7B7":active?step.color:"#D1D5DB"}`,
                            boxShadow:active?`0 0 0 4px ${step.color}22`:"none",
                            transition:"all 0.3s",
                            flexShrink:0,
                          }}>
                            {done ? <span style={{color:"#fff",fontWeight:800,fontSize:13}}>✓</span>
                                  : <span style={{fontSize:14}}>{step.icon}</span>}
                          </div>
                          {!isLast&&<div style={{width:2,flex:1,minHeight:20,background:done?"#6EE7B7":"#E5E7EB",marginTop:2,marginBottom:2,borderRadius:1}}/>}
                        </div>
                        {/* Right: text */}
                        <div style={{paddingBottom:isLast?0:16,paddingTop:4,flex:1}}>
                          <div style={{fontSize:13,fontWeight:active||done?700:500,color:done?G.green:active?step.color:"#9CA3AF"}}>
                            {step.label}
                            {active&&<span style={{marginLeft:6,background:step.color,color:"#fff",borderRadius:10,padding:"1px 8px",fontSize:10,fontWeight:700}}>EN COURS</span>}
                          </div>
                          <div style={{fontSize:11,color:done?"#6EE7B7":active?"#9CA3AF":"#C4B5A0",marginTop:1}}>{step.sub}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rejected state */}
              {isRejected&&(
                <div style={{background:"#FEF2F2",borderRadius:14,padding:14,marginBottom:16,border:"1px solid #FECACA",textAlign:"center"}}>
                  <div style={{fontSize:13,fontWeight:700,color:G.red,marginBottom:4}}>{STATUS[o.status]?.label||o.status}</div>
                  <div style={{fontSize:11,color:"#EF4444"}}>Relancer le client ou clôturer la commande</div>
                </div>
              )}
              <div style={{marginBottom:14}}>
                <div style={{fontWeight:800,fontSize:20,color:G.dark,marginBottom:8}}>{o.client}</div>
                <a href={`tel:+221${(o.phone||"").replace(/\s+/g,"")}`} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,textDecoration:"none"}}>
                  <span style={{fontSize:16}}>📱</span><span style={{fontSize:15,color:G.blue,fontWeight:700}}>{o.phone}</span>
                </a>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>📍</span><span style={{fontSize:14,color:G.dark}}>{fullAddr(o)}</span>
                </div>
              </div>
              {(()=>{
                const items=parseProd(o.product); const tot=items.reduce((s,p)=>s+p.qty,0);
                const isMulti=tot>1||items.length>1;
                const z=detectZone(o.address);
                return (
                  <>
                    {/* Packing summary */}
                    <div style={{background:"#F0FDF4",borderRadius:12,padding:"14px 16px",marginBottom:12,border:"1px solid #BBF7D0"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <div style={{fontSize:12,fontWeight:700,color:"#166534"}}>
                          {isMulti?"📦 Récapitulatif colis":"📦 Produit"}
                          {isMulti&&<span style={{marginLeft:6,background:"#FEF3C7",color:"#92400E",borderRadius:6,padding:"1px 8px",fontSize:10,fontWeight:800}}>BUNDLE · {tot} articles</span>}
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:10,color:G.gray}}>Montant COD</div>
                          <div style={{fontSize:20,fontWeight:800,color:G.green}}>{Number(o.price).toLocaleString("fr-FR")} CFA</div>
                        </div>
                      </div>
                      {items.map((p,pi)=>(
                        <div key={pi} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderTop:pi>0?"1px solid #D1FAE5":"none"}}>
                          <span style={{fontSize:13,fontWeight:700,color:G.dark,flex:1}}>{p.name}</span>
                          <span style={{background:p.qty>1?"#F0A500":"#22C55E",color:"#fff",borderRadius:8,padding:"3px 10px",fontSize:13,fontWeight:800,flexShrink:0}}>×{p.qty}</span>
                        </div>
                      ))}
                      {isMulti&&<div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #BBF7D0",display:"flex",justifyContent:"space-between",fontSize:12}}>
                        <span style={{color:"#166534",fontWeight:700}}>Total à préparer</span>
                        <span style={{fontWeight:800,color:"#166534"}}>{tot} unité{tot>1?"s":""}</span>
                      </div>}
                    </div>
                    {/* Zone + delivery cost + payment */}
                    <div style={{background:z.prepaid?"#FFF7ED":"#F8FAFC",borderRadius:12,padding:"12px 14px",marginBottom:14,border:`1px solid ${z.prepaid?"#FED7AA":"#E2E8F0"}`}}>
                      <div style={{fontSize:11,fontWeight:700,color:z.prepaid?"#92400E":G.gray,marginBottom:8,textTransform:"uppercase",letterSpacing:0.4}}>🗺️ Zone & Livraison</div>
                      {z.prepaid&&<div style={{background:"#FEF3C7",borderRadius:8,padding:"6px 10px",marginBottom:10,fontSize:11,fontWeight:700,color:"#92400E"}}>
                        ⚠️ PRÉPAIEMENT REQUIS — Livraison internationale {z.flag} {z.label}
                      </div>}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <span style={{fontSize:13,color:G.dark}}>{fullAddr(o)}</span>
                        <span style={{background:z.color+"18",color:z.color,borderRadius:6,padding:"3px 9px",fontSize:12,fontWeight:700}}>{z.flag} {z.label}</span>
                      </div>
                      {/* Payment method */}
                      {(()=>{
                        const pm = o.note?.match(/PM:\s*([^·\n]+)/)?.[1]?.trim();
                        const pmObj = pm ? PAYMENT_METHODS.find(p=>p.label.toLowerCase().includes(pm.toLowerCase())) : null;
                        return pm ? <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"5px 8px",background:"#EDE9FE",borderRadius:7}}>
                          <span style={{fontSize:12}}>{pmObj?.icon||"💳"}</span>
                          <span style={{fontSize:11,fontWeight:700,color:"#5B21B6"}}>Mode de paiement : {pm}</span>
                        </div> : null;
                      })()}
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:G.gray,paddingTop:6,borderTop:"1px solid #E2E8F0"}}>
                        <span>Produit COD</span><span style={{fontWeight:600,color:G.dark}}>{Number(o.price).toLocaleString("fr-FR")} CFA</span>
                      </div>
                      {(()=>{const f=fraisDisplay(o);return(<>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,color:G.gray,marginTop:3,gap:8}}>
                        <span>Frais livraison {z.prepaid?"(prépayé)":""}</span>
                        <span style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontWeight:600,color:z.color}}>{f.label}</span>
                          {f.warning&&<>
                            <span style={{color:G.gold,fontSize:11}}>⚠️ à config.</span>
                            <button onClick={()=>openFraisAndDismiss()} title="Configurer les zones" style={{background:G.gold,color:"#fff",border:"none",borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⚙️</button>
                          </>}
                        </span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:800,marginTop:6,paddingTop:6,borderTop:"1px solid #E2E8F0"}}>
                        <span style={{color:G.dark}}>Total client</span><span style={{color:G.green}}>{Number(o.price+f.fee).toLocaleString("fr-FR")} CFA</span>
                      </div>
                      </>);})()}
                    </div>
                  </>
                );
              })()}
              <div style={{display:"flex",gap:8,marginBottom:14}}>
                {o.closer&&<div style={{flex:1,background:"#EFF6FF",borderRadius:10,padding:"8px 12px",textAlign:"center"}}><div style={{fontSize:10,color:G.gray}}>Closer</div><div style={{fontSize:13,fontWeight:700,color:G.blue}}>📞 {o.closer}</div></div>}
                {o.livreur&&<div style={{flex:1,background:G.greenLight,borderRadius:10,padding:"8px 12px",textAlign:"center"}}><div style={{fontSize:10,color:G.gray}}>Livreur</div><div style={{fontSize:13,fontWeight:700,color:G.green}}>🏍️ {o.livreur}</div></div>}
              </div>
              {o.note&&<div style={{background:"#FFF8E7",borderRadius:10,padding:"10px 12px",marginBottom:14,fontSize:13,color:G.dark}}>📝 {o.note}</div>}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <a href={`tel:+221${(o.phone||"").replace(/\s+/g,"")}`}
                  style={{background:G.green,color:G.white,borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:16,textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  📞 Appeler le client
                </a>
                {(role==="admin"||role==="closer")&&(
                  <button onClick={()=>{setOrderDetail(null);setEditOrder({...o});}}
                    style={{width:"100%",background:"#EFF6FF",color:G.blue,border:"none",borderRadius:12,padding:"14px 0",fontWeight:700,fontSize:15,cursor:"pointer"}}>
                    ✏️ Modifier la commande
                  </button>
                )}
                {role==="admin"&&(
                  <button onClick={()=>{setOrderDetail(null);setConfirmModal({msg:`Supprimer la commande de ${o.client} ?`,sub:"Action irréversible.",danger:true,onConfirm:async()=>{
                    const id = o.id;
                    try {
                      await sbFetch(`orders?id=eq.${id}`,"PATCH",{archived:true});
                      setOrders(p=>p.filter(x=>x.id!==id));
                      console.log("DELETE order:", id, "→ archived:true ✓");
                    } catch(e) {
                      console.error("DELETE order failed:", id, e.message);
                      addToast("Erreur suppression: "+e.message.slice(0,80),"❌",G.red,8000);
                    }
                  }})}}
                    style={{width:"100%",background:"#FEE2E2",color:G.red,border:"none",borderRadius:12,padding:"13px 0",fontWeight:700,fontSize:14,cursor:"pointer"}}>
                    🗑️ Supprimer la commande
                  </button>
                )}
                <button onClick={()=>setOrderDetail(null)}
                  style={{width:"100%",background:G.grayLight,color:G.gray,border:"none",borderRadius:12,padding:"13px 0",fontWeight:600,fontSize:14,cursor:"pointer"}}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: Confirmation ── */}
      {confirmModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:G.white,borderRadius:20,padding:28,maxWidth:320,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:12}}>{confirmModal.danger?"🗑️":"❓"}</div>
            <div style={{fontWeight:800,fontSize:16,color:G.dark,marginBottom:6}}>{confirmModal.msg}</div>
            {confirmModal.sub&&<div style={{fontSize:12,color:G.gray,marginBottom:20,whiteSpace:"pre-line",textAlign:"left"}}>{confirmModal.sub}</div>}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={()=>{confirmModal.onConfirm();setConfirmModal(null);}}
                style={{background:confirmModal.danger?G.red:G.green,color:G.white,border:"none",borderRadius:12,padding:"13px 0",fontWeight:800,fontSize:15,cursor:"pointer"}}>
                {confirmModal.danger?"Oui, supprimer":"Confirmer"}
              </button>
              <button onClick={()=>setConfirmModal(null)}
                style={{background:G.grayLight,color:G.gray,border:"none",borderRadius:12,padding:"12px 0",fontWeight:600,fontSize:13,cursor:"pointer"}}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Note ── */}
      {noteModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:isDesktop?"center":"flex-end"}}>
          <div style={{background:G.white,borderRadius:isDesktop?20:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto"}}>
            <div style={{fontWeight:700,fontSize:15,color:G.green,marginBottom:10}}>📝 Note commande</div>
            <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Ex: Client demande livraison avant 14h..."
              style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:12,fontSize:13,outline:"none",minHeight:80,resize:"none",boxSizing:"border-box"}}/>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={()=>{setOrders(orders.map(o=>o.id===noteModal?{...o,note:noteText}:o));if(!String(noteModal).startsWith("tmp_"))sbFetch(`orders?id=eq.${noteModal}`,"PATCH",{note:noteText});setNoteModal(null);}} style={{flex:1,background:G.green,color:G.white,border:"none",borderRadius:10,padding:12,fontWeight:600,cursor:"pointer"}}>Sauvegarder</button>
              <button onClick={()=>setNoteModal(null)} style={{flex:1,background:G.grayLight,color:G.gray,border:"none",borderRadius:10,padding:12,cursor:"pointer"}}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PRICING DETECTION (ProductAnalysisPopup) ── */}
      {pricingPopup&&(()=>{
        const {orderId, order:pOrder, items:pItems, responses:pResp} = pricingPopup;
        const currentIdx = pResp.findIndex(r => !r.resolved);

        const persistAndAdvance = async (newResponses) => {
          // If still some unresolved → just update state and keep popup open
          if (newResponses.some(r => !r.resolved)) {
            setPricingPopup(p => ({...p, responses: newResponses}));
            return;
          }
          // All resolved — persist to product_pricing_rules then advance to assignLivreurModal
          for (let i = 0; i < pItems.length; i++) {
            const item = pItems[i]; const resp = newResponses[i];
            const existing = pricingRules.find(r => _normCity(r.product_name) === _normCity(item.name));
            if (item.case === 1) {
              const isBundle = resp.type === "bundle" && resp.bundleQty;
              const bq       = isBundle ? resp.bundleQty : null;
              const refUnit  = isBundle ? Math.round(item.price / Math.max(1, bq)) : item.price;
              const refBund  = isBundle ? item.price : null;
              const payload  = {org_id:orgId, product_name:item.name, type:resp.type||"unit", bundle_quantity:bq, reference_price_unit:refUnit, reference_price_bundle:refBund, discount_percentage:null, discount_type:null, updated_at:new Date().toISOString()};
              const res = await sbFetch("product_pricing_rules","POST",payload).catch(()=>null);
              const saved = Array.isArray(res)?res[0]:res; if (saved) setPricingRules(prev=>[...prev,saved]);
            } else if (item.case === 2 && resp.type === "bundle" && resp.bundleQty) {
              const bq      = resp.bundleQty;
              const refBund = item.price;
              const refUnit = Math.round(item.price / Math.max(1, bq));
              const patch = {type:"bundle", bundle_quantity:bq, reference_price_unit:refUnit, reference_price_bundle:refBund, updated_at:new Date().toISOString()};
              if (existing) { await sbFetch(`product_pricing_rules?id=eq.${existing.id}`,"PATCH",patch).catch(()=>{}); setPricingRules(prev=>prev.map(r=>r.id===existing.id?{...r,...patch}:r)); }
            } else if (item.case === 2 && resp.type === "acknowledged") {
              const patch = {reference_price_unit:item.pricePerUnit, updated_at:new Date().toISOString()};
              if (existing) { await sbFetch(`product_pricing_rules?id=eq.${existing.id}`,"PATCH",patch).catch(()=>{}); setPricingRules(prev=>prev.map(r=>r.id===existing.id?{...r,...patch}:r)); }
            } else if (item.case === 3 && resp.type === "discount") {
              const pct = item.expectedPrice > 0 ? Math.max(1, Math.round((1 - item.price / item.expectedPrice) * 100)) : 0;
              const patch = {type:"discount", discount_percentage:pct, discount_type:resp.discountType||"ponctuel", reference_price_unit:resp.discountType==="permanent"?item.pricePerUnit:(existing?.reference_price_unit||item.pricePerUnit), updated_at:new Date().toISOString()};
              if (existing) { await sbFetch(`product_pricing_rules?id=eq.${existing.id}`,"PATCH",patch).catch(()=>{}); setPricingRules(prev=>prev.map(r=>r.id===existing.id?{...r,...patch}:r)); }
            }
          }
          setPricingChecked(prev => new Set([...prev, orderId]));
          setPricingPopup(null);
          setAssignLivreurModal(pOrder);
        };

        const item = pItems[currentIdx] || pItems[0];
        const alert = item.case === 1
          ? { type: "new_product",  name: item.name, price: item.price }
          : item.case === 2
          ? { type: "price_rise",   name: item.name, oldPrice: item.expectedPrice, newPrice: item.price }
          : { type: "price_drop",   name: item.name, oldPrice: item.expectedPrice, newPrice: item.price };

        const onDone = (result) => {
          let upd = { resolved: true };
          if (item.case === 1) {
            upd.type = result?.pricingType === "bundle" ? "bundle" : "unit";
            upd.bundleQty = result?.bundleQuantity || null;
          } else if (item.case === 2) {
            if (result?.pricingType === "bundle") {
              upd.type = "bundle";
              upd.bundleQty = result?.bundleQuantity || null;
            } else {
              upd.type = "acknowledged";
            }
          } else if (item.case === 3) {
            if (result?.priceDropType === "discount") { upd.type = "discount"; upd.discountType = "ponctuel"; }
            else if (result?.priceDropType === "permanent") { upd.type = "discount"; upd.discountType = "permanent"; }
            else upd.type = "no_discount";
          }
          const newResponses = pResp.map((r,i) => i === currentIdx ? {...r, ...upd} : r);
          persistAndAdvance(newResponses);
        };

        const onSkip = () => {
          // Skip this item — mark resolved without writing a pricing rule
          const newResponses = pResp.map((r,i) => i === currentIdx ? {...r, resolved: true, type: "skipped"} : r);
          persistAndAdvance(newResponses);
        };

        // Multi-item progress hint
        const remaining = pItems.length - currentIdx;
        const showProgress = pItems.length > 1;

        return (
          <>
            {showProgress && (
              <div style={{position:"fixed",top:12,left:"50%",transform:"translateX(-50%)",background:"#0F1923",color:"#fff",borderRadius:20,padding:"6px 14px",fontSize:11,fontWeight:600,zIndex:3100,boxShadow:"0 4px 12px rgba(0,0,0,0.3)"}}>
                Produit {currentIdx + 1} / {pItems.length}
              </div>
            )}
            <ProductAnalysisPopup alert={alert} onDone={onDone} onSkip={onSkip}/>
          </>
        );

      })()}

      {/* ── MODAL ASSIGNER LIVREUR (Cmdes boutique → obligatoire) ── */}
      {assignLivreurModal&&(()=>{
        const o = assignLivreurModal;
        const livreurs = teamMembers.filter(m=>m.role==="livreur");
        const STATUS_OPTS = [
          {v:"confirmado",       label:"🔔 Aller récupérer le colis",       sub:"Le livreur n'a pas encore le colis"},
          {v:"livreur_en_route", label:"🏍️ En route pour récupérer",         sub:"Le livreur part chercher le colis"},
          {v:"colis_pris",       label:"📦 Colis en main — Prêt à livrer",   sub:"Le livreur a déjà le colis sur lui"},
          {v:"en_camino",        label:"🚀 En route vers le client",          sub:"Le livreur est en chemin pour livrer"},
          {v:"chez_client",      label:"📍 Déjà chez le client",              sub:"Livraison en cours maintenant"},
        ];
        const canConfirm = !!assignSelLiv && pricingChecked.has(o.id);
        return (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:isDesktop?"center":"flex-end",justifyContent:"center"}}
          onClick={()=>setAssignLivreurModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:G.white,borderRadius:isDesktop?20:"20px 20px 0 0",padding:20,width:"100%",maxWidth:480,maxHeight:"88vh",overflowY:"auto",paddingBottom:"calc(20px + env(safe-area-inset-bottom,0px))"}}>
            <div style={{width:36,height:4,background:"#E5E7EB",borderRadius:2,margin:"0 auto 16px"}}/>

            {/* Header commande */}
            <div style={{background:"#FFF8E7",borderRadius:12,padding:"12px 14px",marginBottom:16,borderLeft:"4px solid #F59E0B"}}>
              <div style={{fontWeight:700,fontSize:14,color:G.dark}}>{o.client}</div>
              <div style={{fontSize:12,color:G.gray,marginTop:2}}>📦 {o.product} · <b style={{color:"#D97706"}}>{Number(o.price).toLocaleString("fr-FR")} CFA</b></div>
              {(o.address||o.city)&&<div style={{fontSize:11,color:G.gray,marginTop:2}}>📍 {fullAddr(o)}</div>}
            </div>

            {/* Étape 1 — Sélectionner livreur (obligatoire) */}
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:assignSelLiv?G.green:"#E5E7EB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff",flexShrink:0}}>1</div>
                <div style={{fontWeight:700,fontSize:13,color:G.dark}}>Sélectionner le livreur <span style={{color:G.red}}>*</span></div>
              </div>
              {livreurs.length===0?(
                <div style={{textAlign:"center",padding:16,color:G.gray,fontSize:12,background:"#F9FAFB",borderRadius:10}}>Aucun livreur dans l'équipe</div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {livreurs.map(m=>{
                    const active = orders.filter(x=>x.livreur_id===m.id&&["confirmado","livreur_en_route","colis_pris","en_camino","chez_client"].includes(x.status));
                    const isSelected = assignSelLiv?.id===m.id;
                    const load = active.length;
                    const loadColor = load===0?"#10B981":load<=2?"#F59E0B":"#EF4444";
                    const loadLabel = load===0?"Disponible":`${load} livraison${load>1?"s":""} en cours`;
                    return (
                      <button key={m.id} onClick={()=>setAssignSelLiv(isSelected?null:m)}
                        style={{background:isSelected?G.greenLight:"#F9FAFB",border:`2px solid ${isSelected?G.green:"#E5E7EB"}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left",transition:"all .15s"}}>
                        <div style={{width:40,height:40,borderRadius:"50%",background:isSelected?G.green:"#E5E7EB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,transition:"all .15s"}}>🏍️</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,fontSize:14,color:G.dark}}>{m.nom}</div>
                          <div style={{fontSize:11,fontWeight:600,color:loadColor,marginTop:2}}>● {loadLabel}</div>
                          {active.length>0&&<div style={{fontSize:10,color:G.gray,marginTop:1}}>{active.slice(0,2).map(x=>x.client).join(", ")}{active.length>2?`…`:""}</div>}
                        </div>
                        {isSelected&&<div style={{color:G.green,fontSize:18}}>✓</div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Étape 2 — État du livreur (obligatoire) */}
            <div style={{marginBottom:20,opacity:assignSelLiv?1:0.4,pointerEvents:assignSelLiv?"auto":"none",transition:"opacity .2s"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:assignSelLiv?G.green:"#E5E7EB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff",flexShrink:0}}>2</div>
                <div style={{fontWeight:700,fontSize:13,color:G.dark}}>État actuel du livreur <span style={{color:G.red}}>*</span></div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {STATUS_OPTS.map(s=>(
                  <button key={s.v} onClick={()=>setAssignDelStatus(s.v)}
                    style={{background:assignDelStatus===s.v?G.greenLight:"#F9FAFB",border:`2px solid ${assignDelStatus===s.v?G.green:"#E5E7EB"}`,borderRadius:10,padding:"10px 14px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10,transition:"all .15s"}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13,color:G.dark}}>{s.label}</div>
                      <div style={{fontSize:11,color:G.gray,marginTop:1}}>{s.sub}</div>
                    </div>
                    {assignDelStatus===s.v&&<span style={{color:G.green,fontSize:16,flexShrink:0}}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Boutons confirmer */}
            {(()=>{
              const doConfirm = () => {
                // Update local state
                setOrders(prev=>prev.map(x=>x.id===o.id?{...x,livreur:assignSelLiv.nom,livreur_id:assignSelLiv.id,status:assignDelStatus}:x));
                pendingOrderUpdates.current[o.id]=Date.now();
                // Single PATCH ensures DB stays consistent (no race between two separate calls)
                if(!String(o.id).startsWith("tmp_"))
                  sbFetch(`orders?id=eq.${o.id}`,"PATCH",{status:assignDelStatus,livreur:assignSelLiv.nom,livreur_id:assignSelLiv.id}).catch(()=>{});
                addToast(`${o.client} → ${assignSelLiv.nom} ✅`,"✅",G.green);
                setAssignLivreurModal(null);
              };
              const sendWA = () => {
                // Nettoyer le numéro — garder uniquement les chiffres
                const digits = (o.phone||"").replace(/\D/g,"");
                if(digits.length < 8) {
                  addToast("Numéro de téléphone manquant — édite la commande pour l'ajouter","⚠️","#F59E0B");
                  return;
                }
                // Construire le numéro international
                let phoneWA;
                if(digits.startsWith("00")) phoneWA = digits.slice(2);
                else if(digits.startsWith("221")) phoneWA = digits;
                else if(digits.startsWith("0")) phoneWA = "221" + digits.slice(1);
                else phoneWA = "221" + digits;
                const msg = waTemplate
                  .replace(/{client}/g,  o.client||"")
                  .replace(/{produit}/g, o.product||"")
                  .replace(/{prix}/g,    Number(o.price).toLocaleString("fr-FR"))
                  .replace(/{adresse}/g, o.address||"")
                  .replace(/{boutique}/g, settings.boutique||"Teamly")
                  .replace(/{livreur}/g,  assignSelLiv?.nom||"notre livreur");
                window.open(`https://wa.me/${phoneWA}?text=${encodeURIComponent(msg)}`,"_blank");
              };
              return (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {/* Confirmer + WhatsApp (principal) */}
                  <button disabled={!canConfirm} onClick={()=>{ doConfirm(); sendWA(); }}
                    style={{width:"100%",background:canConfirm?"#25D366":"#D1D5DB",color:"#fff",border:"none",borderRadius:12,padding:"14px 0",fontWeight:700,fontSize:15,cursor:canConfirm?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"background .2s"}}>
                    {canConfirm?<>💬 Confirmer + WhatsApp client</>:"Sélectionne un livreur pour continuer"}
                  </button>
                  {/* Confirmer sans WhatsApp */}
                  {canConfirm&&(
                    <button onClick={doConfirm}
                      style={{width:"100%",background:G.green,color:"#fff",border:"none",borderRadius:12,padding:"12px 0",fontWeight:600,fontSize:13,cursor:"pointer"}}>
                      ✅ Confirmer sans WhatsApp
                    </button>
                  )}
                  {/* Sans livreur */}
                  <button onClick={()=>{
                    upSt(o.id,"confirmado");
                    addToast(`${o.client} → Cmd à traiter (sans livreur)`,"📦","#D97706");
                    setAssignLivreurModal(null);
                  }} style={{width:"100%",background:"none",color:G.gray,border:"none",padding:"10px 0",fontWeight:500,fontSize:12,cursor:"pointer"}}>
                    Confirmer sans livreur pour l'instant
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
        );
      })()}
      {/* Close main content wrapper */}
      </div>

      {/* ── BOTTOM TAB BAR — mobile uniquement ── */}
      {!isDesktop&&role&&sbReady&&!trialExpired&&(()=>{
        const boutiqueCnt  = orders.filter(o=>o.status==="boutique").length;
        const commandesCnt = orders.filter(o=>o.status==="confirmado"&&!o.livreur&&(role!=="closer"||o.closer_id!==currentUser.id)).length;
        const livraisonsCnt= myLiv.filter(o=>!["entregado","rechazado"].includes(o.status)).length;
        const canCompta    = role==="admin"||(role==="closer"&&pC.closerCompta);

        const ICONS = {
          livraisons: (c)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
          chat:       (c)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
          dashboard:  (c)=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
          equipe:     (c)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
          position:   (c)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
          boutique:   (c)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
          commandes:  (c)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
          compta:     (c)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
        };

        const allTabs = role==="livreur" ? [
          {k:"livraisons", label:"Livraisons", badge:livraisonsCnt, badgeColor:"#0284C7", badgeTxt:"#fff", icon:ICONS.livraisons},
          {k:"chat",       label:"Chat",       badge:chatUnread,    badgeColor:"#DC2626",  badgeTxt:"#fff", icon:ICONS.chat},
          {k:"dashboard",  label:"Dashboard",  badge:0,             badgeColor:"",         badgeTxt:"",     icon:ICONS.dashboard},
          {k:"equipe",     label:"Équipe",     badge:0,             badgeColor:"",         badgeTxt:"",     icon:ICONS.equipe},
          ...(trialExpired?[]:[{k:"position", label:"Position", badge:0, badgeColor:"", badgeTxt:"", icon:ICONS.position, locked:isGratuit}]),
        ] : role==="closer" ? [
          {k:"boutique",  label:"Boutique",  badge:isGratuit?0:boutiqueCnt,  badgeColor:G.gold,    badgeTxt:G.dark,  icon:ICONS.boutique,  show:!trialExpired, locked:isGratuit},
          {k:"commandes", label:"À traiter", badge:commandesCnt, badgeColor:"#EF4444", badgeTxt:"#fff",  icon:ICONS.commandes},
          {k:"dashboard", label:"Dashboard", badge:alertCount,   badgeColor:G.red,     badgeTxt:"#fff",  icon:ICONS.dashboard},
          {k:"chat",      label:"Messages",  badge:chatUnread,   badgeColor:"#DC2626", badgeTxt:"#fff",  icon:ICONS.chat},
          {k:"compta",    label:"Compta",    badge:0,            badgeColor:"",        badgeTxt:"",      icon:ICONS.compta,    show:!trialExpired&&canUseCompta},
        ] : [
          {k:"boutique",  label:"Boutique",  badge:isGratuit?0:boutiqueCnt,  badgeColor:G.gold,    badgeTxt:G.dark,  icon:ICONS.boutique,  show:!trialExpired, locked:isGratuit},
          {k:"commandes", label:"À traiter", badge:commandesCnt, badgeColor:"#EF4444", badgeTxt:"#fff",  icon:ICONS.commandes},
          {k:"dashboard", label:"Dashboard", badge:alertCount,   badgeColor:G.red,     badgeTxt:"#fff",  icon:ICONS.dashboard},
          {k:"compta",    label:"Compta",    badge:0,            badgeColor:"",        badgeTxt:"",      icon:ICONS.compta,    show:canCompta&&!trialExpired, locked:isGratuit},
          {k:"chat",      label:"Messages",  badge:chatUnread,   badgeColor:"#DC2626", badgeTxt:"#fff",  icon:ICONS.chat},
        ];
        const tabs = allTabs.filter(t=>t.show!==false);
        return (
          <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:G.white,borderTop:"1px solid #E5E7EB",boxShadow:"0 -4px 20px rgba(0,0,0,0.08)",display:"flex",alignItems:"flex-end",zIndex:150,paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
            {tabs.map((t,i)=>{
              const active = tab===t.k;
              const isCenter = t.k==="dashboard" && i===Math.floor(tabs.length/2);
              return (
                <button key={t.k} onClick={()=>t.locked?setShowPlanModal(true):setTab(t.k)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:isCenter?"0 0 10px":"8px 0 10px",background:"none",border:"none",cursor:"pointer",position:"relative",outline:"none"}}>
                  {isCenter ? (
                    <>
                      <div style={{width:54,height:54,borderRadius:"50%",background:active?"#0D3D25":G.green,display:"flex",alignItems:"center",justifyContent:"center",position:"absolute",top:-26,boxShadow:"0 4px 16px rgba(26,92,56,0.4)",border:"3px solid #fff",transition:"background .2s"}}>
                        {t.icon("#fff")}
                      </div>
                      <div style={{height:22}}/>
                      <span style={{fontSize:9,fontWeight:700,color:G.green,marginTop:2,letterSpacing:0.3}}>Dashboard</span>
                    </>
                  ) : (
                    <>
                      {t.badge>0&&<span style={{position:"absolute",top:3,right:"calc(50% - 20px)",background:t.badgeColor,color:t.badgeTxt,borderRadius:9,minWidth:18,height:18,padding:"0 4px",fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1,boxSizing:"border-box"}}>{t.badge>9?"9+":t.badge}</span>}
                      {t.locked&&<span style={{position:"absolute",top:3,right:"calc(50% - 20px)",fontSize:10,lineHeight:1}}>🔒</span>}
                      {t.icon(t.locked?"#C4B5A0":active?G.green:"#9CA3AF")}
                      <span style={{fontSize:9,fontWeight:active?700:400,color:t.locked?"#C4B5A0":active?G.green:"#9CA3AF",marginTop:3,letterSpacing:0.2}}>{t.label}</span>
                      {active&&<div style={{position:"absolute",bottom:0,width:24,height:2.5,background:G.green,borderRadius:2}}/>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ── AI ASSISTANT ── */}
      {/* Floating button */}
      {!aiOpen&&!trialExpired&&canUseAI&&(
        <button onClick={()=>setAiOpen(true)} style={{
          position:"fixed",bottom:isDesktop?28:tab==="chat"?210:180,right:18,zIndex:8000,
          width:52,height:52,borderRadius:"50%",border:"none",cursor:"pointer",
          background:"linear-gradient(135deg,#1A5C38,#0D9488)",
          boxShadow:"0 4px 16px rgba(0,0,0,0.25)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,
        }}>🧑‍💼</button>
      )}

      {/* Chat panel */}
      {aiOpen&&(
        <div style={{
          position:"fixed",bottom:isDesktop?28:0,right:isDesktop?18:0,
          width:isDesktop?380:"100%",
          height:isDesktop?560:"92dvh",
          zIndex:8000,background:"#FFF",
          borderRadius:isDesktop?20:"20px 20px 0 0",
          boxShadow:"0 8px 40px rgba(0,0,0,0.2)",
          display:"flex",flexDirection:"column",overflow:"hidden",
        }}>
          {/* Header */}
          <div style={{background:"linear-gradient(135deg,#1A5C38,#0D9488)",padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🧑‍💼</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:15,color:"#FFF"}}>Support Teamly</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.7)"}}>Assistant virtuel • répond en secondes</div>
            </div>
            {aiMsgs.length>0&&(
              <button onClick={()=>setAiMsgs([])} title="Effacer la conversation" style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:8,padding:"5px 9px",color:"rgba(255,255,255,0.85)",cursor:"pointer",fontSize:11,fontWeight:600,marginRight:4}}>🗑️</button>
            )}
            <button onClick={()=>setAiOpen(false)} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"50%",width:30,height:30,color:"#FFF",cursor:"pointer",fontSize:16}}>✕</button>
          </div>

          {/* Messages */}
          <div ref={aiScrollRef} style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10,background:"#F8FAFC"}}>
            {aiMsgs.length===0&&(()=>{
              const aiByRole = {
                livreur: {
                  intro: "Je suis là pour t'aider à utiliser l'app et gérer tes livraisons 🏍️",
                  questions: [
                    "Comment accepter une commande assignée ?",
                    "Comment mettre à jour le statut d'une livraison ?",
                    "Comment partager ma position GPS ?",
                    "Comment installer l'app sur mon téléphone ?",
                  ],
                },
                closer: {
                  intro: "Je suis là pour t'aider à enregistrer et confirmer tes commandes 📞",
                  questions: [
                    "Comment créer une commande manuellement ?",
                    "Comment confirmer une commande par WhatsApp ?",
                    "Comment enregistrer un refus client ?",
                    "Comment modifier une commande existante ?",
                  ],
                },
                admin: {
                  intro: "Je suis là pour t'aider à gérer ton business COD et ton équipe 🚀",
                  questions: [
                    "Comment connecter Shopify à Teamly ?",
                    "Comment créer une campagne COD efficace ?",
                    "Comment réduire les refus de livraison ?",
                    "Comment voir mes statistiques et marges ?",
                  ],
                },
              };
              const ctx = aiByRole[role] || aiByRole.admin;
              return (
                <div style={{textAlign:"center",padding:"24px 16px"}}>
                  <div style={{width:64,height:64,borderRadius:"50%",background:"linear-gradient(135deg,#1A5C38,#0D9488)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 12px"}}>🧑‍💼</div>
                  <div style={{fontWeight:700,fontSize:14,color:"#1A5C38",marginBottom:4}}>Bonjour {currentUser?.nom||""} !</div>
                  <div style={{fontSize:12,color:"#6B7280",marginBottom:16}}>{ctx.intro}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {ctx.questions.map(q=>(
                      <button key={q} onClick={()=>sendAiMessage(q)} style={{background:"#FFF",border:"1px solid #E5E7EB",borderRadius:10,padding:"8px 12px",fontSize:12,color:"#374151",cursor:"pointer",textAlign:"left",fontWeight:500}}>
                        💬 {q}
                      </button>
                    ))}
                    <div style={{marginTop:6,padding:"10px 12px",background:"#F0FDF4",borderRadius:10,border:"1px solid #BBF7D0",textAlign:"left"}}>
                      <div style={{fontSize:12,color:"#166534",fontWeight:700,marginBottom:4}}>💬 Besoin d'aide ?</div>
                      <div style={{fontSize:11,color:"#166534",marginBottom:8}}>Contactez-nous sur WhatsApp</div>
                      <a href="https://wa.me/34673318387?text=Bonjour%2C%20j%27ai%20besoin%20d%27aide%20avec%20Teamly" target="_blank" rel="noreferrer"
                        style={{display:"flex",alignItems:"center",gap:8,background:"#25D366",color:"#FFF",borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:700,textDecoration:"none",justifyContent:"center"}}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.52 5.845L0 24l6.335-1.489A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.502-5.178-1.381l-.371-.22-3.862.908.951-3.768-.241-.388A9.942 9.942 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                        Contacter sur WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              );
            })()}
            {aiMsgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                <div style={{
                  maxWidth:"82%",padding:"10px 13px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",
                  background:m.role==="user"?"linear-gradient(135deg,#1A5C38,#0D9488)":"#FFF",
                  color:m.role==="user"?"#FFF":"#1F2937",
                  fontSize:13,lineHeight:1.5,
                  boxShadow:"0 1px 4px rgba(0,0,0,0.08)",
                  whiteSpace:"pre-wrap",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {aiLoading&&(
              <div style={{display:"flex",justifyContent:"flex-start"}}>
                <div style={{background:"#FFF",borderRadius:"16px 16px 16px 4px",padding:"10px 14px",boxShadow:"0 1px 4px rgba(0,0,0,0.08)",display:"flex",gap:4,alignItems:"center"}}>
                  {[0,1,2].map(i=>(
                    <div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#9CA3AF",animation:`bounce 1s ease-in-out ${i*0.15}s infinite`}}/>
                  ))}
                </div>
              </div>
            )}
            <div ref={aiBottomRef}/>
          </div>

          {/* Input */}
          <div style={{padding:"10px 12px",borderTop:"1px solid #F3F4F6",background:"#FFF",display:"flex",gap:8,alignItems:"flex-end"}}>
            <textarea
              value={aiInput}
              onChange={e=>setAiInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAiMessage(aiInput);}}}
              placeholder="Pose ta question…"
              rows={1}
              style={{flex:1,border:"1px solid #E5E7EB",borderRadius:12,padding:"9px 12px",fontSize:13,resize:"none",outline:"none",fontFamily:"inherit",lineHeight:1.4,maxHeight:100,overflowY:"auto"}}
            />
            <button
              onClick={()=>sendAiMessage(aiInput)}
              disabled={!aiInput.trim()||aiLoading}
              style={{width:40,height:40,borderRadius:12,border:"none",background:aiInput.trim()&&!aiLoading?"linear-gradient(135deg,#1A5C38,#0D9488)":"#E5E7EB",color:"#FFF",cursor:aiInput.trim()&&!aiLoading?"pointer":"not-allowed",fontSize:16,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              ➤
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}@keyframes livFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* ── Conflit livraison en cours (livreur one-at-a-time) ── */}
      {conflictDelivery&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:3001,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
          onClick={e=>{if(e.target===e.currentTarget)setConflictDelivery(null);}}>
          <div style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:"28px 20px 36px",width:"100%",maxWidth:480,boxShadow:"0 -8px 32px rgba(0,0,0,0.18)"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:40,marginBottom:8}}>⚠️</div>
              <div style={{fontSize:18,fontWeight:800,color:"#D97706",marginBottom:8}}>Livraison en cours</div>
              <div style={{fontSize:13,color:"#6B7280",marginBottom:8}}>Vous êtes déjà en route pour :</div>
              <div style={{fontSize:16,fontWeight:700,color:"#111"}}>{conflictDelivery.client}</div>
              {conflictDelivery.address&&<div style={{fontSize:12,color:G.gray,marginTop:3}}>{conflictDelivery.address}</div>}
              <div style={{fontSize:12,color:"#D97706",fontWeight:600,marginTop:10,background:"#FFF8E7",borderRadius:8,padding:"8px 12px"}}>
                Terminez cette livraison avant d'en commencer une nouvelle.
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConflictDelivery(null)}
                style={{flex:1,background:"#F3F4F6",color:"#374151",border:"none",borderRadius:14,padding:"15px 0",fontWeight:700,fontSize:15,cursor:"pointer"}}>Annuler</button>
              <button onClick={()=>{setConflictDelivery(null);setTab("livraisons");}}
                style={{flex:1,background:"#0284C7",color:"#fff",border:"none",borderRadius:14,padding:"15px 0",fontWeight:700,fontSize:15,cursor:"pointer"}}>Voir la livraison</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation livraison finale (livreur) ── */}
      {livFinalConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:3000,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
          onClick={e=>{if(e.target===e.currentTarget){setLivFinalConfirm(null);setLivFinalNote("");}}}>
          <div style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:"28px 20px 36px",width:"100%",maxWidth:480,boxShadow:"0 -8px 32px rgba(0,0,0,0.18)"}}>
            {livFinalConfirm.type==="livre" ? (
              <>
                <div style={{textAlign:"center",marginBottom:16}}>
                  <div style={{fontSize:40,marginBottom:8}}>✅</div>
                  <div style={{fontSize:18,fontWeight:800,color:"#1A5C38",marginBottom:4}}>Confirmer la livraison</div>
                  <div style={{fontSize:13,color:"#6B7280"}}>{livFinalConfirm.client} · {fmt(livFinalConfirm.price)} CFA encaissé</div>
                </div>
                <div style={{display:"flex",gap:10,marginTop:8}}>
                  <button onClick={()=>{setLivFinalConfirm(null);setLivFinalNote("");}}
                    style={{flex:1,background:"#F3F4F6",color:"#374151",border:"none",borderRadius:14,padding:"15px 0",fontWeight:700,fontSize:15,cursor:"pointer"}}>Annuler</button>
                  <button disabled={livConfirming} onClick={async()=>{
                    if(livConfirming) return;
                    setLivConfirming(true);
                    const ordId = livFinalConfirm.orderId;
                    try {
                      // Primary: status update (always works)
                      await sbFetch(`orders?id=eq.${ordId}`,"PATCH",{status:"entregado"});
                      // Secondary: extra fields — best-effort (fails silently if columns missing)
                      sbFetch(`orders?id=eq.${ordId}`,"PATCH",{
                        delivered_at:new Date().toISOString(),
                        amount_collected:Number(livFinalConfirm.price)||0,
                        delivered_by:currentUser.id
                      }).catch(()=>{});
                      // Local state update (stock, notifications)
                      const ord = orders.find(x=>x.id===ordId);
                      setOrders(o=>o.map(x=>{
                        if(x.id!==ordId) return x;
                        if(x.status!=="entregado"){
                          setProducts(p=>p.map(pr=>pr.name===x.product?{...pr,stock:Math.max(0,pr.stock-1)}:pr));
                          sbFetch("stock_movements","POST",{org_id:orgId,product_id:x.product,user_id:currentUser?.id,source:"entregado",delta:-1,reason:"Livraison confirmée",order_id:x.id}).catch(()=>{});
                        }
                        return {...x,status:"entregado"};
                      }));
                      if(orgId&&ord) sbFetch("notifications","POST",{org_id:orgId,type:"delivered",title:`✅ Livré — ${ord.client} a payé ${fmt(ord.price)} CFA`,body:`${ord.product} · ${fmt(ord.price)} CFA`,role_target:"closer",read:false,data:{}}).catch(()=>{});
                      setLivFinalConfirm(null); setLivFinalNote("");
                      addToast("✅ Livraison confirmée","✅",G.green);
                    } catch(err) {
                      console.error("confirm livraison error:",err);
                      addToast("❌ Erreur — Réessayer","❌",G.red);
                    } finally {
                      setLivConfirming(false);
                    }
                  }} style={{flex:2,background:livConfirming?"#6B7280":"#1A5C38",color:"#fff",border:"none",borderRadius:14,padding:"15px 0",fontWeight:800,fontSize:16,cursor:livConfirming?"not-allowed":"pointer",transition:"background 150ms",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                    {livConfirming?<><div style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.4)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.75s linear infinite"}}/>Enregistrement…</>:<>✅ Confirmer — Livré</>}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{textAlign:"center",marginBottom:16}}>
                  <div style={{fontSize:40,marginBottom:8}}>❌</div>
                  <div style={{fontSize:18,fontWeight:800,color:"#DC2626",marginBottom:4}}>Échec de livraison</div>
                  <div style={{fontSize:13,color:"#6B7280"}}>{livFinalConfirm.client} · {fmt(livFinalConfirm.price)} CFA</div>
                </div>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,color:"#6B7280",fontWeight:600,marginBottom:6}}>Motif (optionnel)</div>
                  <input type="text" value={livFinalNote} onChange={e=>setLivFinalNote(e.target.value)}
                    placeholder="Ex: client absent, mauvaise adresse..."
                    style={{width:"100%",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"11px 14px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>{setLivFinalConfirm(null);setLivFinalNote("");}}
                    style={{flex:1,background:"#F3F4F6",color:"#374151",border:"none",borderRadius:14,padding:"15px 0",fontWeight:700,fontSize:15,cursor:"pointer"}}>Annuler</button>
                  <button onClick={()=>{
                    upSt(livFinalConfirm.orderId,"rechazado");
                    if(livFinalNote.trim()){
                      const note=livFinalNote.trim();
                      const cur=orders.find(x=>x.id===livFinalConfirm.orderId)?.note||"";
                      const newNote=(cur?cur+" | ":"")+`Motif: ${note}`;
                      setOrders(o=>o.map(x=>x.id===livFinalConfirm.orderId?{...x,note:newNote}:x));
                      sbFetch(`orders?id=eq.${livFinalConfirm.orderId}`,"PATCH",{note:newNote},_authToken).catch(()=>{});
                    }
                    setLivFinalConfirm(null);setLivFinalNote("");
                  }}
                    style={{flex:2,background:"#DC2626",color:"#fff",border:"none",borderRadius:14,padding:"15px 0",fontWeight:800,fontSize:16,cursor:"pointer"}}>❌ Confirmer — Non livré</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
    </AppContext.Provider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
