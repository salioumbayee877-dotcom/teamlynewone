import React, { useState, useEffect, useRef, useCallback } from "react";
// ── Supabase REST client (no SDK needed) ──────────────────────────────────
const SB_URL = "https://rddtislrbbkjpoqpdcry.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkZHRpc2xyYmJranBvcXBkY3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzcwMDIsImV4cCI6MjA5MTkxMzAwMn0.2G6eiQyih1h3PTDbYU757hGW7ScRqHhyyqsolEO-Rzc";

// User JWT stored after login — all data requests use this so RLS is enforced
let _authToken = null;

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

const sbFetch = async (path, method="GET", body=null, token=null) => {
  try {
    const res = await fetchWithTimeout(`${SB_URL}/rest/v1/${path}`, {
      method,
      headers: sbHeaders(token),
      body: body ? JSON.stringify(body) : undefined,
    }, 8000);
    if(!res.ok) { const e=await res.text(); throw new Error(e); }
    if(method==="DELETE") return null;
    const text = await res.text();
    if(!text||text.trim()==="") return null;
    try { return JSON.parse(text); } catch(e) { return null; }
  } catch(e) {
    if(e.name==="AbortError") throw new Error("Délai dépassé — vérifie ta connexion");
    console.error("sbFetch error:", path, e.message);
    throw e;
  }
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
const fmt = n => Number(n||0).toLocaleString("fr-FR");
const pct = n => (Number(n||0)*100).toFixed(1)+"%";
const TODAY = new Date().toISOString().split("T")[0];
const FRAIS_LIV = 1500;

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
  pendiente:        {label:"En attente",        color:"#F0A500",bg:"#FFF8E7"},
  confirmado:       {label:"Client confirmé ✅", color:"#2E8B57",bg:"#E8F5EE"},
  livreur_en_route: {label:"Livreur en route 🏍️",color:"#7C3AED",bg:"#EDE9FE"},
  colis_pris:       {label:"Colis en main 📦",         color:"#2563EB",bg:"#DBEAFE"},
  en_camino:        {label:"Vers le client 🚀",        color:"#0284C7",bg:"#E0F2FE"},
  chez_client:      {label:"Livreur chez le client 📍",color:"#D97706",bg:"#FEF3C7"},
  entregado:        {label:"✅ Encaissé",          color:"#1A5C38",bg:"#D1FAE5"},
  rechazado:        {label:"Rejeté",             color:"#DC2626",bg:"#FEE2E2"},
  no_contesta:      {label:"Absent",             color:"#6B7280",bg:"#F3F4F6"},
  reprogramar:      {label:"Reporter",           color:"#7C3AED",bg:"#EDE9FE"},
  boutique:         {label:"Boutique Shopify 🛒", color:"#96BF48",bg:"#F0F7E6"},
};

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


function makeMarkerIcon(L, name) {
  return L.divIcon({
    html:`<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="background:#1A5C38;border:2px solid #F0A500;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 10px rgba(0,0,0,0.35)">🏍️</div>
      <div style="background:#1A5C38;color:#F0A500;font-size:10px;font-weight:800;padding:2px 7px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);letter-spacing:0.3px">${name}</div>
    </div>`,
    className:"", iconSize:[80,58], iconAnchor:[40,48]
  });
}

function MapView({positions, role}) {
  const containerRef = useRef(null);
  const stateRef     = useRef({map:null, markers:{}, loaded:false});

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
      const map = L.map(containerRef.current, {zoomControl:true, scrollWheelZoom:false, attributionControl:false})
                   .setView(center, 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
      stateRef.current.map = map;
      stateRef.current.loaded = true;
      Object.entries(positions).forEach(([name,pos])=>{
        if(!pos?.lat) return;
        const popup = `<div style="font-size:13px"><b>🏍️ ${name}</b>${pos.city?`<br><span style="color:#666;font-size:11px">📍 ${pos.city}</span>`:""}</div>`;
        stateRef.current.markers[name] = L.marker([pos.lat,pos.lng],{icon:makeMarkerIcon(L,name)}).addTo(map).bindPopup(popup);
      });
      if(entries.length>1) {
        const group = L.featureGroup(Object.values(stateRef.current.markers));
        map.fitBounds(group.getBounds().pad(0.2));
      }
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
      } else {
        markers[name] = L.marker([pos.lat,pos.lng],{icon:makeMarkerIcon(L,name)}).addTo(map).bindPopup(popup);
      }
    });
    const active = Object.values(positions).filter(p=>p?.lat);
    if(active.length===1) map.setView([active[0].lat,active[0].lng],15);
    else if(active.length>1) {
      const group = L.featureGroup(Object.values(markers).filter(m=>m));
      map.fitBounds(group.getBounds().pad(0.2));
    }
  },[positions]);

  return (
    <div style={{position:"relative",isolation:"isolate",borderRadius:12,overflow:"hidden"}}>
      <div ref={containerRef} style={{height:300,width:"100%",background:"#E8F4F8"}}/>
    </div>
  );
}

function OrderModal({products, orders, newOrder, setNewOrder, addOrder, onClose, G, fmt, FRAIS_LIV, livreurs=[], waTemplate="", setWaTemplate, boutique="Teamly"}) {
  const [showWAPreview, setShowWAPreview] = useState(false);
  const prod = products.find(p=>p.name===newOrder.product);
  const qty  = parseInt(newOrder.qty||1);
  const disc = parseFloat(newOrder.discount||0);
  const basePrice = prod ? prod.price * qty : 0;
  const bundleSelected = prod?.bundles?.find(b=>String(b.id)===newOrder.bundle);
  const finalPrice = bundleSelected ? bundleSelected.prixVente : (disc>0 ? Math.round(basePrice*(1-disc/100)) : basePrice);
  const margeTotal = prod ? finalPrice - prod.cost*qty - (prod.fraisLiv||FRAIS_LIV) : 0;
  const clientSuggestions = newOrder.phone?.length>=3
    ? [...new Map(orders.filter(o=>o.phone?.includes(newOrder.phone)||o.client?.toLowerCase().includes((newOrder.phone||"").toLowerCase())).map(o=>[o.phone,o])).values()].slice(0,3)
    : [];
  const TN={quantite:"Pack Qté",bxgyf:"Buy X Get Y",kit:"Kit"};
  const TL={quantite:"#2563EB",bxgyf:"#7C3AED",kit:"#D97706"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:G.white,borderRadius:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{fontWeight:700,fontSize:16,color:G.green,marginBottom:14}}>📦 Nouvelle commande confirmée</div>
        <div style={{marginBottom:9}}>
          <div style={{fontSize:11,color:G.gray,marginBottom:3}}>👤 Nom client *</div>
          <input type="text" value={newOrder.client||""} onChange={e=>setNewOrder({...newOrder,client:e.target.value})} placeholder="Moussa Diallo"
            style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:9}}>
          <div style={{fontSize:11,color:G.gray,marginBottom:3}}>📱 Téléphone *</div>
          <input type="tel" inputMode="numeric" value={newOrder.phone||""} onChange={e=>setNewOrder({...newOrder,phone:e.target.value})} placeholder="77 123 45 67"
            style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          {clientSuggestions.length>0&&(
            <div style={{marginTop:4,display:"flex",flexDirection:"column",gap:3}}>
              {clientSuggestions.map((o,i)=>{
                const cO=orders.filter(x=>x.phone===o.phone);
                const sc=cO.length>0?Math.round(cO.filter(x=>x.status==="entregado").length/cO.length*100):0;
                return <button key={i} onClick={()=>setNewOrder({...newOrder,phone:o.phone,client:o.client,address:o.address})}
                  style={{background:G.greenLight,border:`1px solid ${G.greenMid}`,borderRadius:8,padding:"6px 10px",cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between"}}>
                  <div><span style={{fontSize:12,fontWeight:600,color:G.green}}>{o.client}</span><span style={{fontSize:11,color:G.gray}}> · {o.phone}</span></div>
                  <span>{sc>=80?"🟢":sc>=50?"🟡":"🔴"} {sc}%</span>
                </button>;
              })}
            </div>
          )}
        </div>
        <div style={{marginBottom:9}}>
          <div style={{fontSize:11,color:G.gray,marginBottom:3}}>📍 Adresse</div>
          <input type="text" value={newOrder.address||""} onChange={e=>setNewOrder({...newOrder,address:e.target.value})} placeholder="Médina, Dakar"
            style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,color:G.gray,marginBottom:3}}>📦 Produit *</div>
          <select value={newOrder.product||""} onChange={e=>setNewOrder({...newOrder,product:e.target.value,bundle:"",qty:"1",discount:""})}
            style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:G.dark,background:G.white,boxSizing:"border-box"}}>
            <option value="">Sélectionner un produit...</option>
            {products.map(p=><option key={p.id} value={p.name}>{p.name} — {fmt(p.price)} FCFA · stock: {p.stock}</option>)}
          </select>
        </div>
        {prod&&!bundleSelected&&(
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>🔢 Quantité</div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <button onClick={()=>setNewOrder(p=>({...p,qty:String(Math.max(1,parseInt(p.qty||1)-1))}))} style={{background:G.grayLight,border:"none",borderRadius:6,width:32,height:36,cursor:"pointer",fontSize:18,fontWeight:700}}>−</button>
                <div style={{flex:1,textAlign:"center",fontSize:18,fontWeight:700,background:G.white,border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"5px 0"}}>{qty}</div>
                <button onClick={()=>setNewOrder(p=>({...p,qty:String(parseInt(p.qty||1)+1)}))} style={{background:G.greenLight,border:"none",borderRadius:6,width:32,height:36,cursor:"pointer",fontSize:18,fontWeight:700,color:G.green}}>+</button>
              </div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>💸 Réduction %</div>
              <div style={{position:"relative"}}>
                <input type="number" min="0" max="100" value={newOrder.discount||""} onChange={e=>setNewOrder({...newOrder,discount:e.target.value})} placeholder="0"
                  style={{width:"100%",border:`1.5px solid ${disc>0?"#FCA5A5":G.grayLight}`,borderRadius:8,padding:"8px 28px 8px 12px",fontSize:14,outline:"none",boxSizing:"border-box",fontWeight:600}}/>
                <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:G.gray}}>%</span>
              </div>
              {disc>0&&<div style={{fontSize:10,color:G.red,marginTop:2}}>−{fmt(Math.round(basePrice*disc/100))} FCFA</div>}
            </div>
          </div>
        )}
        {prod&&(
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,color:G.gray,marginBottom:6,fontWeight:600}}>🎁 Option bundle</div>
            <button onClick={()=>setNewOrder({...newOrder,bundle:""})}
              style={{width:"100%",background:!newOrder.bundle?G.greenLight:"#F9F9F9",border:`2px solid ${!newOrder.bundle?G.green:G.grayLight}`,borderRadius:10,padding:"9px 14px",cursor:"pointer",textAlign:"left",marginBottom:5,display:"flex",justifyContent:"space-between"}}>
              <div><div style={{fontWeight:600,fontSize:13,color:!newOrder.bundle?G.green:G.gray}}>📦 Sans bundle</div><div style={{fontSize:11,color:G.gray}}>Qté et réduction libres</div></div>
              {!newOrder.bundle&&<span style={{color:G.green}}>✓</span>}
            </button>
            {(prod.bundles||[]).length>0?(prod.bundles||[]).map(b=>{
              const qr=b.type==="bxgyf"?(b.qte+(b.qteOfferte||0)):b.qte,cout=prod.cost*qr,fl=b.livraisonOfferte?0:(prod.fraisLiv||FRAIS_LIV),m=b.prixVente-cout-fl,isSel=newOrder.bundle===String(b.id);
              return <button key={b.id} onClick={()=>setNewOrder({...newOrder,bundle:String(b.id),qty:"1",discount:""})}
                style={{width:"100%",background:isSel?"#FFF8E7":"#F9F9F9",border:`2px solid ${isSel?G.gold:G.grayLight}`,borderRadius:10,padding:"9px 14px",cursor:"pointer",textAlign:"left",marginBottom:5,display:"flex",justifyContent:"space-between"}}>
                <div>
                  <div style={{display:"flex",gap:5,marginBottom:2}}>
                    <span style={{fontWeight:700,fontSize:13,color:isSel?G.gold:G.dark}}>{b.label}</span>
                    <span style={{background:"#F3F4F6",color:TL[b.type]||"#666",borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:700}}>{TN[b.type]||b.type}</span>
                    {b.livraisonOfferte&&<span style={{background:G.greenLight,color:G.green,borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:700}}>🚚</span>}
                  </div>
                  <div style={{fontSize:11,color:G.gray}}>{b.qte}u{b.type==="bxgyf"?` + ${b.qteOfferte} offert`:""} · marge: <strong style={{color:m>=0?G.green:G.red}}>{fmt(m)} FCFA</strong></div>
                </div>
                <div style={{fontWeight:700,fontSize:14,color:isSel?G.gold:G.gray,whiteSpace:"nowrap",marginLeft:8}}>{fmt(b.prixVente)} FCFA</div>
              </button>;
            }):<div style={{background:G.grayLight,borderRadius:10,padding:"8px 12px",fontSize:11,color:G.gray,textAlign:"center"}}>Aucun bundle — <span style={{color:G.green,fontWeight:600}}>à créer dans Stock</span></div>}
          </div>
        )}
        {prod&&(
          <div style={{background:margeTotal>=0?G.greenLight:"#FEE2E2",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontSize:13,color:G.gray,fontWeight:600}}>💰 Prix COD</span>
              <span style={{fontSize:24,fontWeight:700,color:G.green}}>{fmt(finalPrice)} FCFA</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:11,color:G.gray}}>Marge estimée</span>
              <span style={{fontSize:13,fontWeight:700,color:margeTotal>=0?G.green:G.red}}>{fmt(margeTotal)} FCFA</span>
            </div>
            {qty>1&&!bundleSelected&&<div style={{fontSize:11,color:G.gray,marginTop:2}}>×{qty}{disc>0?` · −${disc}%`:""}</div>}
          </div>
        )}
        {/* Situation du colis — TOUJOURS obligatoire */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:G.gray,marginBottom:5,fontWeight:600}}>
            📦 Situation du colis <span style={{color:"#EF4444",fontWeight:700}}>*</span>
          </div>
          <select value={newOrder.deliveryStatus||""} onChange={e=>setNewOrder({...newOrder,deliveryStatus:e.target.value})}
            style={{width:"100%",border:`1.5px solid ${!newOrder.deliveryStatus?"#FCA5A5":G.green}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:newOrder.deliveryStatus?G.dark:"#9CA3AF",background:G.white,boxSizing:"border-box"}}>
            <option value="" disabled>— Sélectionner la situation —</option>
            <option value="confirmado">🔔 Aller récupérer le colis</option>
            <option value="livreur_en_route">🏍️ En route pour récupérer le colis</option>
            <option value="colis_pris">📦 Colis en main — Prêt à livrer</option>
            <option value="en_camino">🚀 En route vers le client</option>
            <option value="chez_client">📍 Déjà chez le client</option>
            <option value="entregado">💰 Payé — Livraison encaissée</option>
          </select>
          {!newOrder.deliveryStatus&&<div style={{fontSize:10,color:"#EF4444",marginTop:4}}>⚠️ Champ obligatoire — sans ça, impossible d'enregistrer</div>}
        </div>

        {/* Assigner livreur */}
        {livreurs.length>0&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:G.gray,marginBottom:5,fontWeight:600}}>🏍️ Livreur</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              <button onClick={()=>setNewOrder({...newOrder,livreur:""})}
                style={{background:!newOrder.livreur?G.grayLight:G.white,color:G.gray,border:`1.5px solid ${!newOrder.livreur?"#9CA3AF":"#E5E7EB"}`,borderRadius:8,padding:"6px 11px",fontSize:12,fontWeight:!newOrder.livreur?700:400,cursor:"pointer"}}>
                Pas encore
              </button>
              {livreurs.map(l=>(
                <button key={l} onClick={()=>setNewOrder({...newOrder,livreur:l})}
                  style={{background:newOrder.livreur===l?G.greenLight:"#F9FAFB",color:newOrder.livreur===l?G.green:G.gray,border:`1.5px solid ${newOrder.livreur===l?G.green:"#E5E7EB"}`,borderRadius:8,padding:"6px 11px",fontSize:12,fontWeight:newOrder.livreur===l?700:400,cursor:"pointer"}}>
                  🏍️ {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* WhatsApp — Aperçu + Template éditable */}
        {(()=>{
          const hasData = newOrder.client||newOrder.phone||newOrder.product;
          const previewMsg = waTemplate
            .replace(/{client}/g, newOrder.client||"[Nom client]")
            .replace(/{produit}/g, newOrder.product||"[Produit]")
            .replace(/{prix}/g, prod?(prod.price*parseInt(newOrder.qty||1)).toLocaleString("fr-FR"):"[Prix]")
            .replace(/{adresse}/g, newOrder.address||"[Adresse]")
            .replace(/{boutique}/g, boutique||"Teamly")
            .replace(/{livreur}/g, newOrder.livreur||"notre livreur");
          return (
            <div style={{marginBottom:12}}>
              {/* Toggle aperçu */}
              <button onClick={()=>setShowWAPreview(v=>!v)}
                style={{width:"100%",background:"#FFF8E7",border:"1px solid #FDE68A",borderRadius:10,padding:"8px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontSize:16}}>💬</span>
                  <span style={{fontSize:12,fontWeight:700,color:"#92400E"}}>Message WhatsApp</span>
                  {hasData&&<span style={{background:"#FDE68A",borderRadius:6,padding:"1px 7px",fontSize:10,color:"#92400E",fontWeight:700}}>Aperçu ✓</span>}
                </div>
                <span style={{fontSize:12,color:G.gray}}>{showWAPreview?"▲":"▼"}</span>
              </button>

              {showWAPreview&&(
                <div style={{background:"#F9F9F9",borderRadius:"0 0 10px 10px",border:"1px solid #FDE68A",borderTop:"none",padding:14}}>

                  {/* Aperçu du message tel qu'il sera envoyé */}
                  <div style={{fontSize:11,color:G.gray,fontWeight:600,marginBottom:8}}>📱 APERÇU DU MESSAGE</div>
                  <div style={{background:G.white,borderRadius:10,padding:12,marginBottom:12,border:"1px solid #E5E7EB",fontFamily:"monospace",fontSize:12,color:"#111",lineHeight:1.6,whiteSpace:"pre-wrap",maxHeight:140,overflowY:"auto"}}>
                    {previewMsg}
                  </div>

                  {/* Variables disponibles */}
                  <div style={{fontSize:10,color:G.gray,marginBottom:8}}>
                    Variables disponibles : <span style={{color:"#7C3AED",fontWeight:600}}>{"{client}"} {"{produit}"} {"{prix}"} {"{adresse}"} {"{boutique}"} {"{livreur}"}</span>
                  </div>

                  {/* Éditeur de template */}
                  <div style={{fontSize:11,color:G.gray,fontWeight:600,marginBottom:5}}>✏️ MODIFIER LE MESSAGE</div>
                  <textarea value={waTemplate} onChange={e=>setWaTemplate&&setWaTemplate(e.target.value)}
                    style={{width:"100%",border:"1.5px solid #FDE68A",borderRadius:8,padding:10,fontSize:12,outline:"none",minHeight:110,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",lineHeight:1.5}}/>
                  <button onClick={()=>setWaTemplate&&setWaTemplate(`Cher(e) {client} 👋\n\n✅ Votre commande est *confirmée* !\n\n📦 Produit: {produit}\n💰 Montant COD: *{prix} FCFA*\n📍 Livraison à: {adresse}\n🏍️ Notre livreur vous contactera avant de passer.\n\nMerci pour votre confiance 🙏\n_— {boutique}_`)}
                    style={{marginTop:6,background:"none",border:"none",color:G.gray,fontSize:10,cursor:"pointer",padding:0,textDecoration:"underline"}}>
                    Réinitialiser le message par défaut
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>addOrder(false)} disabled={!newOrder.deliveryStatus}
            style={{flex:1,background:newOrder.deliveryStatus?G.greenLight:"#F3F4F6",color:newOrder.deliveryStatus?G.green:"#9CA3AF",border:"none",borderRadius:10,padding:12,fontWeight:600,fontSize:13,cursor:newOrder.deliveryStatus?"pointer":"not-allowed"}}>
            Ajouter
          </button>
          <button onClick={()=>addOrder(true)} disabled={!newOrder.deliveryStatus}
            style={{flex:1,background:newOrder.deliveryStatus?G.green:"#D1D5DB",color:"#fff",border:"none",borderRadius:10,padding:12,fontWeight:600,fontSize:13,cursor:newOrder.deliveryStatus?"pointer":"not-allowed"}}>
            + WhatsApp 📲
          </button>
        </div>
        <button onClick={onClose} style={{width:"100%",background:"none",border:"none",color:G.gray,padding:10,cursor:"pointer",fontSize:13}}>Annuler</button>
      </div>
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
          <div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>FCFA total</div>
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
              <div style={{fontWeight:700,fontSize:13,color:accent,flexShrink:0}}>{fmt(o.price)}F</div>
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
  const [orders,setOrders]   = useState([]);
  const [products,setProducts] = useState([]);
  const [bundles,setBundles] = useState(INIT_BUNDLES);
  const [chat,setChat]       = useState([]);
  const [chatMsg,setChatMsg] = useState("");
  const [tab,setTab]         = useState(()=>{
    try { return localStorage.getItem("teamly_tab")||"dashboard"; } catch(e){ return "dashboard"; }
  });
  const [comptaView,setComptaView] = useState("produits");
  const [showAdd,setShowAdd] = useState(false);
  const [showWA,setShowWA]   = useState(false);
  const [waUrl,setWaUrl]     = useState("");
  const [showAddProd,setShowAddProd]   = useState(false);
  const [showAddBundle,setShowAddBundle] = useState(false);
  const [noteModal,setNoteModal] = useState(null);
  const [noteText,setNoteText]   = useState("");
  const [newOrder,setNewOrder]   = useState({client:"",phone:"",address:"",product:"",bundle:"",price:"",qty:"1",discount:"",livreur:"",deliveryStatus:""});
  const [newProd,setNewProd]     = useState({name:"",cost:"",price:"",stock:"",fraisLiv:"1500",niche:"",bundles:[]});
  const [newBundleForm,setNewBundleForm] = useState({label:"",type:"quantite",qte:"2",qteOfferte:"1",prixVente:"",livraisonOfferte:false});
  const [newBundle,setNewBundle] = useState({name:"",type:"quantite",prodNom:"",prodQte:"2",qteOfferte:"1",remisePct:"",prixVente:"",livraisonOfferte:false});
  const [adSpend,setAdSpend]           = useState({});
  const [livraisonsEchouees,setLivraisonsEchouees] = useState({});
  const [cashRemis,setCashRemis]       = useState("");
  const [toasts,setToasts]             = useState([]); // [{id,msg,color,icon}]
  const [dateFrom,setDateFrom]         = useState("");
  const [dateTo,setDateTo]             = useState("");
  const [newAssignment,setNewAssignment] = useState(null);
  const [showGpsPrompt,setShowGpsPrompt] = useState(false);
  const [showIosInstall,setShowIosInstall] = useState(false);
  const [confirmModal,setConfirmModal]   = useState(null);
  const [assignLivreurModal,setAssignLivreurModal] = useState(null); // {order}
  const [assignSelLiv,setAssignSelLiv]             = useState(null); // selected livreur member
  const [assignDelStatus,setAssignDelStatus]       = useState("confirmado");
  const [sbToken,setSbToken]             = useState(null);  // JWT token
  const [orgId,setOrgId]                 = useState(null);
  const [sbReady,setSbReady]             = useState(false);
  const [dataReady,setDataReady]         = useState(false);
  const [currentUser,setCurrentUser]     = useState({id:"",nom:"",email:"",role:"admin"});
  const [teamMembers,setTeamMembers]     = useState([]);
  const [dbNotifs,setDbNotifs]           = useState([]); // from Supabase notifications table
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
  const [selDate,setSelDate]   = useState(TODAY);
  const [selMonth,   setSelMonth]       = useState(new Date().toISOString().slice(0,7));
  const [showClientDetail, setShowClientDetail] = useState(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate,   setFilterDate]   = useState("all");
  const [filterLivreur, setFilterLivreur] = useState("all");
  const [showSearch, setShowSearch]     = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [editOrder, setEditOrder]       = useState(null);
  const [showArchived, setShowArchived]   = useState(false);
  const [orderDetail, setOrderDetail]     = useState(null);
  const [dismissedNotifs,setDismissedNotifs] = useState(new Set());
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
  const chatScrollRef                      = useRef(null);
  const tabRef                             = useRef(tab);
  const currentUserRef                     = useRef(currentUser);
  const [chatShowNew, setChatShowNew]      = useState(false);
  const [chatLoading, setChatLoading]      = useState(true);
  const [authStep, setAuthStep]   = useState(()=>{
    const params = new URLSearchParams(window.location.search);
    if(params.get("org") && params.get("role")) return "join";
    return "login";
  });
  const [authMode, setAuthMode]   = useState("login");
  const [authForm, setAuthForm]   = useState(()=>{
    const params = new URLSearchParams(window.location.search);
    const org  = params.get("org")  || "";
    const role = params.get("role") || "";
    const tok  = params.get("token")|| "";
    return {email:"",password:"",boutique:"",whatsapp:"",nom:"",phone:"",adresse:"",
      inviteOrg:org, inviteRole:role, inviteToken:tok,
      inviteUrl: org ? window.location.href : ""
    };
  });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [dragIdx,setDragIdx]               = useState(null);
  const [showNotifSettings,setShowNotifSettings] = useState(false);
  const [settings, setSettings]         = useState({boutique:"Ma Boutique", whatsapp:"221771234567", nom:"Admin", plan:"starter", notifStock:true, notifRejet:true, notifSansLivreur:true, notifLivre:true, notifRetour:true, notifChat:true, closerCompta:false, closerSettings:false, closerFullControl:false, closerDeleteOrder:false, closerManageTeam:false, closerManageProducts:false});
  const [showSettings, setShowSettings] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [stockAjout, setStockAjout]     = useState({});
  const [editProd,   setEditProd]       = useState(null);
  const [waTemplate, setWaTemplate]     = useState(`Cher(e) {client} 👋\n\n✅ Votre commande est *confirmée* !\n\n📦 Produit: {produit}\n💰 Montant COD: *{prix} FCFA*\n📍 Livraison à: {adresse}\n🏍️ Notre livreur vous contactera avant de passer.\n\nMerci pour votre confiance 🙏\n_— {boutique}_`); // produit en cours d'édition
  const [gpsActive, setGpsActive]     = useState(false);
  const [gpsPos, setGpsPos]           = useState(null);
  const [gpsError, setGpsError]       = useState("");
  const [livreurPositions, setLivreurPositions] = useState({
    "Ibou":    {lat:14.7167, lng:-17.4677, name:"Ibou",    order:"Commande #4 — Yoff"},
    "Mamadou": {lat:14.7255, lng:-17.4530, name:"Mamadou", order:"Commande #2 — Plateau"},
    "Cheikh":  {lat:14.6953, lng:-17.4439, name:"Cheikh",  order:"Commande #5 — Ngor"},
  });
  const gpsWatchRef = useRef(null);

  // ── Export Excel/CSV ──
  const exportExcel = () => {
    const cols = ["Date","Client","Téléphone","Adresse","Produit","Prix","Statut","Livreur","Closer","Note"];
    const rows = orders.map(o=>[
      o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR") : "",
      o.client||"", o.phone||"", o.address||"", o.product||"",
      o.price||0, STATUS[o.status]?.label||o.status||"",
      o.livreur||"", o.closer||"", o.note||""
    ]);
    const csv = [cols, ...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";")).join("\n");
    const bom = "﻿"; // UTF-8 BOM pour Excel
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
    setOrders(o=>o.map(x=>{
      if(x.id!==id) return x;
      if(s==="entregado"&&x.status!=="entregado") {
        setProducts(p=>p.map(pr=>pr.name===x.product?{...pr,stock:Math.max(0,pr.stock-1)}:pr));
      }
      return {...x,status:s};
    }));
    const order = orders.find(x=>x.id===id);
    if(order) addToast(`${order.client} → ${LABELS[s]||s}`, ICONS[s]||"📦", COLORS[s]||G.green);
    // Save to Supabase
    if(!String(id).startsWith("tmp_")) sbFetch(`orders?id=eq.${id}`,"PATCH",{status:s}).catch(e=>console.error("upSt error:",e));
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
  const addToast = (msg, icon="ℹ️", color=G.green) => {
    const id = Date.now();
    setToasts(t=>[...t,{id,msg,icon,color}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4000);
  };

  // Show GPS prompt when livreur first logs in
  useEffect(()=>{
    if(role==="livreur" && !gpsActive) {
      const t = setTimeout(()=>setShowGpsPrompt(true), 800);
      return ()=>clearTimeout(t);
    }
  },[role]);

  // hCaptcha desactivado

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

  // ── Restore session from localStorage on startup ───────────────────────
  useEffect(()=>{
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
      if(tok) { setSbToken(tok); _authToken = tok; }
      // Safety timeout: never stay on loading screen more than 5 seconds
      const safetyTimer = setTimeout(()=>setAppLoading(false), 5000);
      // Restore immediately from cache so dashboard shows data while verifying
      if(savedOrg && savedRole && savedId) {
        setOrgId(savedOrg);
        setCurrentUser({id:savedId,nom:savedNom||"",email,role:savedRole});
        setRole(savedRole);
        setSbReady(true);
        setAppLoading(false);
      }
      // Verify & refresh profile in background using stored JWT
      sbFetch(`profiles?email=eq.${encodeURIComponent(email)}&limit=1`,"GET")
        .then(async profiles=>{
          clearTimeout(safetyTimer);
          if(profiles&&profiles.length>0){
            const p=profiles[0];
            setOrgId(p.org_id);
            setSbReady(true);
            try {
              const orgs = await sbFetch(`organizations?id=eq.${p.org_id}&limit=1`,"GET");
              const orgName = (orgs&&orgs.length>0)?orgs[0].name:"Ma Boutique";
              const orgPhone = (orgs&&orgs.length>0)?orgs[0].whatsapp:"";
              setSettings(s=>({...s,nom:p.nom||s.nom,whatsapp:p.phone||orgPhone||s.whatsapp,boutique:orgName}));
              if(orgs&&orgs[0]?.plan) setSettings(s=>({...s,plan:orgs[0].plan||s.plan}));
            } catch(e){}
            setCurrentUser({id:p.id||"",nom:p.nom||"",email:p.email||"",role:p.role||"admin",phone:p.phone||"",birthday:p.birthday||""});
            setRole(p.role||"admin");
            try {
              localStorage.setItem("teamly_org",p.org_id);
              localStorage.setItem("teamly_role",p.role||"admin");
              localStorage.setItem("teamly_userId",p.id||"");
              localStorage.setItem("teamly_nom",p.nom||"");
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

    const mapOrders = (ords) => ords.map(o=>({...o,isBundle:o.is_bundle,fraisLiv:o.frais_liv,closer_id:o.closer_id,livreur_id:o.livreur_id}));
    const mapProds  = (prods) => prods.map(p=>({...p,fraisLiv:p.frais_liv,stockInitial:p.stock_initial}));
    const mapMsgs   = (msgs) => msgs.map(m=>{
      const t=m.text||"";
      const isImg=t.startsWith("IMG:");
      const isAud=t.startsWith("AUD:");
      let audioUrl=null,dur="0:00";
      if(isAud){const rest=t.slice(4);const sep=rest.indexOf("|");dur=sep>-1?rest.slice(0,sep):"0:00";audioUrl=sep>-1?rest.slice(sep+1):null;}
      return {id:m.id,from:m.from_user,role:m.role,text:isImg?"":isAud?"🎤":t,type:isImg?"image":null,imgSrc:isImg?t.slice(4):null,audio:isAud||!!m.audio,audioUrl,duration:dur,created_at:m.created_at,time:new Date(m.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})};
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
    const loadMain = async() => {
      const reqId = ++mainReqId;
      try {
        const [ords, prods, mems] = await Promise.all([
          sbFetch(`orders?org_id=eq.${orgId}&archived=eq.false&order=created_at.desc`),
          sbFetch(`products?org_id=eq.${orgId}&archived=eq.false`),
          sbFetch(`profiles?org_id=eq.${orgId}&role=in.(closer,livreur)`),
        ]);
        if(reqId !== mainReqId) return; // discard stale parallel response
        clearTimeout(readyFallback);
        const mappedOrds  = ords  ? mapOrders(ords)  : null;
        const mappedProds = prods ? mapProds(prods)   : null;
        if(mappedOrds)  setOrders(mappedOrds);
        if(mappedProds) setProducts(mappedProds);
        if(mems) {
          setTeamMembers(mems);
          // Actualizar posiciones reales de los livreurs
          const pos = {};
          mems.filter(m=>m.role==="livreur"&&m.lat&&m.lng).forEach(m=>{
            pos[m.nom] = {lat:m.lat, lng:m.lng, name:m.nom, city:m.city||""};
          });
          if(Object.keys(pos).length>0) setLivreurPositions(pos);
        }
        setDataReady(true);
        // Guardar en caché (sin mensajes porque son demasiado grandes)
        try {
          localStorage.setItem(`teamly_cache_${orgId}`, JSON.stringify({
            orders: mappedOrds, products: mappedProds, members: mems
          }));
        } catch(e){}
      } catch(e) { console.error("Supabase load error:", e.message, e); }
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
            merged = mapMsgs([...msgs].reverse());
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
              return true;
            })];
          }
          // Update lastMsgTime using created_at (works with UUID ids)
          if(merged.length > 0) lastMsgTime = merged[merged.length-1].created_at||null;
          // Unread badge — use tabRef.current to avoid stale closure
          const currentTab = tabRef.current;
          if(prev.length === 0 && merged.length > 0 && currentTab !== "chat") {
            // Use timestamp: only count messages newer than when user last had chat open
            const lastReadTime = (() => { try { return localStorage.getItem(lastReadKey); } catch(e) { return null; } })();
            let unread = 0;
            if(lastReadTime) {
              unread = merged.filter(m=>m.from!==myNom && m.created_at && m.created_at > lastReadTime).length;
            }
            // Cap at 99, don't show anything if 0
            if(unread > 0) setChatUnread(Math.min(unread, 99));
          } else if(merged.length > prev.length && prev.length > 0) {
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

    loadMain();
    loadChat(true);
    const intervalMain = setInterval(loadMain, 5000);
    // Polling toutes les 8s si le WebSocket est lent ou indisponible
    const intervalChat = setInterval(()=>loadChat(false), 8000);

    // ── Supabase Realtime WebSocket — chat en temps réel ─────────────────
    let ws = null, wsRef = 0, wsHeartbeat = null, wsReconnect = null;
    const setupWS = () => {
      try {
        ws = new WebSocket(`wss://rddtislrbbkjpoqpdcry.supabase.co/realtime/v1/websocket?apikey=${SB_KEY}&vsn=1.0.0`);
        ws.onopen = () => {
          ws.send(JSON.stringify({
            topic: `realtime:chat_${orgId}`,
            event: "phx_join",
            payload: {
              config: {
                broadcast: {self: false},
                postgres_changes: [{event:"INSERT", schema:"public", table:"messages", filter:`org_id=eq.${orgId}`}]
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
              loadChat(false);
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
    const order = {id:tempId,client:newOrder.client,phone:newOrder.phone,address:newOrder.address,product:productLabel,price,status:deliveryStatus,livreur:newOrder.livreur||null,livreur_id:closerLivId,closer:role==="closer"?currentUser.nom:null,closer_id:role==="closer"?currentUser.id:null,note:"",isBundle:!!bund};
    setOrders(o=>[...o,order]);
    if(orgId) {
      sbFetch("orders","POST",{org_id:orgId,client:order.client,phone:order.phone,address:order.address,product:order.product,price:order.price,status:order.status,livreur:order.livreur||null,livreur_id:order.livreur_id||null,closer:order.closer||null,closer_id:order.closer_id||null,note:order.note||"",is_bundle:order.isBundle||false})
        .then(res=>{
          const saved = Array.isArray(res)?res[0]:res;
          if(saved?.id) setOrders(o=>o.map(x=>x.id===tempId?{...x,id:saved.id}:x));
          // Envoyer notification au livreur selon le statut choisi
          if(newOrder.livreur && orgId) {
            const NOTIF_MSG = {
              confirmado:       "🔔 Nouveau colis — Aller récupérer chez l'Admin",
              livreur_en_route: "🏍️ Tu es en route pour récupérer le colis",
              colis_pris:       "📦 Colis en main — Partir vers le client",
              en_camino:        "🚀 Livraison directe — En route vers le client",
              chez_client:      "📍 Déjà chez le client — Finaliser la livraison",
            };
            sbFetch("notifications","POST",{org_id:orgId,type:"nouveau_colis",title:NOTIF_MSG[deliveryStatus]||"🔔 Nouveau colis",body:`${newOrder.client} — ${productLabel} · ${Number(price).toLocaleString("fr-FR")} FCFA`,role_target:"livreur",livreur_name:newOrder.livreur,read:false,data:{}}).catch(()=>{});
          }
        })
        .catch(e=>console.error("addOrder Supabase error:",e));
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

    setNewOrder({client:"",phone:"",address:"",product:"",bundle:"",price:"",qty:"1",discount:"",livreur:"",deliveryStatus:""});
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
    if(!newProd.fraisLiv) errors.fraisLiv = true;
    if(!newProd.niche)   errors.niche    = true;
    if(Object.keys(errors).length>0) { setProdErrors(errors); return; }
    setProdErrors({});
    const tempProdId = "tmp_" + Date.now();
    const newProduct = {id:tempProdId,name:newProd.name,cost:parseInt(newProd.cost)||0,price:parseInt(newProd.price)||0,stock:parseInt(newProd.stock)||0,stockInitial:parseInt(newProd.stock)||0,fraisLiv:parseInt(newProd.fraisLiv)||1500,niche:newProd.niche||"Autre",bundles:newProd.bundles||[]};
    setProducts(p=>[...p,newProduct]);
    if(orgId) { console.log("Saving product to org:", orgId);
      sbFetch("products","POST",{org_id:orgId,name:newProduct.name,cost:newProduct.cost,price:newProduct.price,stock:newProduct.stock,stock_initial:newProduct.stock,frais_liv:newProduct.fraisLiv,niche:newProduct.niche,archived:false})
        .then(res=>{
          const saved=Array.isArray(res)?res[0]:res;
          if(saved?.id) setProducts(p=>p.map(x=>x.id===tempProdId?{...x,id:saved.id}:x));
          else console.error("addProduct: no id returned", res);
        }).catch(e=>console.error("addProduct error:",e.message));
    }
    setNewProd({name:"",cost:"",price:"",stock:"",fraisLiv:"1500",niche:"",bundles:[]});
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

  const uploadMedia = async (blob, ext, mime) => {
    const path = `${orgId}/${Date.now()}.${ext}`;
    const res = await fetch(`${SB_URL}/storage/v1/object/chat-media/${path}`, {
      method: "POST",
      headers: {"Authorization":`Bearer ${_authToken||SB_KEY}`,"Content-Type":mime,"x-upsert":"false"},
      body: blob,
    });
    if(!res.ok) throw new Error("upload failed");
    return `${SB_URL}/storage/v1/object/public/chat-media/${path}`;
  };

  const sendPhoto = async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    e.target.value = "";
    try {
      const url = await uploadMedia(file, "jpg", file.type||"image/jpeg");
      sendChat("", {type:"image", text:"IMG:"+url, imgSrc:url});
    } catch {
      // fallback a base64 si el bucket no existe
      const reader = new FileReader();
      reader.onload = ev => sendChat("", {type:"image", text:"IMG:"+ev.target.result, imgSrc:ev.target.result});
      reader.readAsDataURL(file);
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
    const nRej    = op.filter(o=>o.status==="rechazado").length; // info seulement — pas dans la formule
    const ca      = nLiv*prod.price;
    const camv    = nLiv*prod.cost;
    const frais   = nLiv*(prod.fraisLiv||FRAIS_LIV);
    const echouees = parseFloat(livraisonsEchouees[prod.id]||0);
    const pub     = parseFloat(adSpend[prod.id]||0);
    const ben     = ca-camv-frais-echouees-pub; // rejets exclus de la formule
    const marge   = ca>0?ben/ca:0;
    return {prod,nLiv,nRej,ca,camv,frais,echouees,pub,ben,marge};
  });
  const tCA   = calcProd.reduce((a,x)=>a+x.ca,0);
  const tBen  = calcProd.reduce((a,x)=>a+x.ben,0);
  const caJour= orders.filter(o=>o.status==="entregado"&&o.created_at?.slice(0,10)===TODAY).reduce((a,o)=>a+o.price,0);
  const tCamv = calcProd.reduce((a,x)=>a+x.camv,0);
  const tFrais= calcProd.reduce((a,x)=>a+x.frais,0);
  const tPub  = calcProd.reduce((a,x)=>a+x.pub,0);
  const tMarge= tCA>0?tBen/tCA:0;

  // ── OCard ──
  const OCard = ({o,showPrendre=false}) => {
    const st=STATUS[o.status]||STATUS.pendiente;
    const clientOrders = orders.filter(x=>x.phone===o.phone);
    const cScore = clientOrders.length>0?Math.round(clientOrders.filter(x=>x.status==="entregado").length/clientOrders.length*100):null;
    const cBadge = cScore===null?null:cScore>=80?"🟢":cScore>=50?"🟡":"🔴";
    return (
      <div style={{background:G.white,borderRadius:13,boxShadow:"0 1px 5px rgba(0,0,0,0.06)",borderLeft:`4px solid ${st.color}`,marginBottom:10,overflow:"hidden"}}>

        {/* Zone cliquable — info client → ouvre détail */}
        <div onClick={()=>setOrderDetail(o)} style={{padding:"13px 13px 10px",cursor:"pointer",userSelect:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:15,color:G.dark}}>{o.client}</div>
              <div style={{fontSize:12,color:G.dark,fontWeight:600,marginTop:2}}>📦 {o.product}</div>
              <div style={{fontSize:11,color:G.gray,marginTop:1}}>📍 {o.address} · 📱 {o.phone}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,marginLeft:8,flexShrink:0}}>
              <div style={{background:st.bg,color:st.color,borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{st.label}</div>
              {o.isBundle&&<div style={{background:"#FFF8E7",color:G.gold,borderRadius:6,padding:"2px 6px",fontSize:10,fontWeight:700}}>🎁 Bundle</div>}
              <div style={{fontWeight:800,color:G.green,fontSize:15}}>{fmt(o.price)} F</div>
            </div>
          </div>
        </div>

        {/* Actions zone — pas de propagation vers détail */}
        <div onClick={e=>e.stopPropagation()} style={{padding:"0 13px 13px"}}>

        {/* Produit + Prix — ligne séparatrice */}
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,display:"none"}}>
          <span style={{fontSize:13,color:G.dark}}>{o.product}</span>
          <span style={{fontWeight:700,color:G.green,fontSize:14}}>{fmt(o.price)} FCFA</span>
        </div>

        {/* Barre progression tracking — pour admin/closer */}
        {role!=="livreur"&&(()=>{
          const steps=["confirmado","livreur_en_route","colis_pris","en_camino","chez_client","entregado"];
          const icons=["✅","🏍️","📦","🚀","📍","✓"];
          const STEP_COLORS=["#6EE7B7","#C4B5FD","#93C5FD","#7DD3FC","#FCD34D","#86EFAC"];
          const cur=steps.indexOf(o.status);
          if(cur<0) return null;
          return (
            <div style={{display:"flex",alignItems:"center",marginBottom:8}}>
              {icons.map((ico,i)=>{
                const col=STEP_COLORS[i];
                const done=i<cur, active=i===cur, future=i>cur;
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",flex:i<5?1:0}}>
                    <div
                      className={active&&o.status!=="entregado"?"step-active":undefined}
                      style={{
                        width:24,height:24,borderRadius:"50%",
                        background:done?col:active?col:G.grayLight,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:10,flexShrink:0,
                        border:`2px solid ${future?"#E5E7EB":col}`,
                        opacity:future?0.35:1,
                        '--sc':col+'BB',
                      }}>
                      <span style={{fontSize:10}}>{ico}</span>
                    </div>
                    {i<5&&<div style={{flex:1,height:2,background:done?col:G.grayLight,opacity:future?0.3:1}}/>}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Chaîne Admin/Closer → Livreur */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,flexWrap:"wrap"}}>
          {o.closer ? (
            <span style={{background:G.greenLight,color:G.green,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>📞 {o.closer}</span>
          ) : (
            <span style={{background:G.grayLight,color:G.gray,borderRadius:6,padding:"2px 8px",fontSize:11}}>📞 Sans closer</span>
          )}
          {(o.closer||o.livreur)&&<span style={{fontSize:10,color:G.gray}}>→</span>}
          {o.livreur ? (
            <span style={{background:"#EFF6FF",color:G.blue,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>🏍️ {o.livreur}</span>
          ) : (
            <span style={{background:G.grayLight,color:G.gray,borderRadius:6,padding:"2px 8px",fontSize:11}}>🏍️ Sans livreur</span>
          )}
        </div>

        {o.note&&<div style={{fontSize:11,color:G.gray,background:G.grayLight,borderRadius:6,padding:"3px 8px",marginBottom:8}}>📝 {o.note}</div>}



        {/* Livreur — statut final bloqué (entregado / rechazado) */}
        {role==="livreur"&&(o.status==="entregado"||o.status==="rechazado")&&(
          <div style={{marginTop:8,background:o.status==="entregado"?G.greenLight:"#FEF2F2",borderRadius:10,padding:"9px 12px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>{o.status==="entregado"?"✅":"❌"}</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:o.status==="entregado"?G.green:G.red}}>
                {o.status==="entregado"?"Livraison terminée — Cash encaissé":"Rejeté — Colis retourné"}
              </div>
              <div style={{fontSize:10,color:G.gray,marginTop:1}}>
                🔒 Statut final — Contacte l'Admin pour toute correction
              </div>
            </div>
          </div>
        )}

        {/* Livreur — tracking complet 6 étapes */}
        {role==="livreur"&&o.status!=="entregado"&&o.status!=="rechazado"&&(
          <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>

            {/* Barre de progression visuelle */}
            {(()=>{
              const steps=["confirmado","livreur_en_route","colis_pris","en_camino","chez_client","entregado"];
              const cur=steps.indexOf(o.status);
              return (
                <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:4}}>
                  {["✅","🏍️","📦","🚀","📍","✓"].map((ico,i)=>{
                    const isEntregado=o.status==="entregado";
                    const done = isEntregado || i<cur;
                    const active = !isEntregado && i===cur;
                    const bg = done ? G.green : active ? "#F0A500" : G.grayLight;
                    const tc = done || active ? G.white : "#9CA3AF";
                    return (
                      <div key={i} style={{display:"flex",alignItems:"center",flex:i<5?1:0}}>
                        <div style={{width:26,height:26,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:i===5?13:10,color:tc,flexShrink:0,border:`2px solid ${done?"#6EE7B7":active?"#F0A500":"#E5E7EB"}`,fontWeight:800,boxShadow:active?"0 0 0 3px rgba(240,165,0,0.25)":done?"0 0 0 2px rgba(26,92,56,0.15)":"none"}}>
                          {i===5?"✓":ico}
                        </div>
                        {i<5&&<div style={{flex:1,height:3,background:done?G.green:G.grayLight,borderRadius:2}}/>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Étape: confirmado → livreur accepte la livraison */}
            {o.status==="confirmado"&&(
              <>
                <div style={{background:"#EDE9FE",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#7C3AED",fontWeight:600}}>
                  📋 Étape 1 — Accepter la livraison
                </div>
                <button onClick={()=>upSt(o.id,"livreur_en_route")}
                  style={{width:"100%",background:G.green,color:G.white,border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:`0 4px 12px ${G.green}44`}}>
                  <span style={{fontSize:20}}>✅</span> Accepter le colis
                </button>
                {o.phone&&<a href={`tel:+221${o.phone.replace(/\s+/g,"")}`} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",color:G.gray,borderRadius:8,padding:"7px 0",fontSize:12,textDecoration:"none",border:`1px solid ${G.grayLight}`}}><span>📞</span> Appeler le client avant</a>}
              </>
            )}

            {/* Étape: livreur en route → arrive chez admin */}
            {o.status==="livreur_en_route"&&(
              <>
                <div style={{background:"#EDE9FE",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#7C3AED",fontWeight:600}}>
                  🏍️ Étape 2 — En route vers l'Admin pour récupérer
                </div>
                <button onClick={()=>upSt(o.id,"colis_pris")}
                  style={{width:"100%",background:"#7C3AED",color:G.white,border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <span style={{fontSize:20}}>📦</span> J'ai récupéré le colis
                </button>
              </>
            )}

            {/* Étape: colis pris → partir vers client */}
            {o.status==="colis_pris"&&(
              <>
                <div style={{background:"#DBEAFE",borderRadius:10,padding:"10px 12px",fontSize:12,color:G.blue,fontWeight:600}}>
                  📦 Étape 3 — Colis en main, pars vers le client
                </div>
                <button onClick={()=>upSt(o.id,"en_camino")}
                  style={{width:"100%",background:G.blue,color:G.white,border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <span style={{fontSize:20}}>🚀</span> Je pars vers le client
                </button>
                {o.phone&&<a href={`tel:+221${o.phone.replace(/\s+/g,"")}`} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",color:G.gray,borderRadius:8,padding:"7px 0",fontSize:12,textDecoration:"none",border:`1px solid ${G.grayLight}`}}><span>📞</span> Prévenir le client</a>}
              </>
            )}

            {/* Étape: en route → arrivé chez client */}
            {o.status==="en_camino"&&(
              <>
                <div style={{background:"#E0F2FE",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#0284C7",fontWeight:600}}>
                  🚀 Étape 4 — En route vers {o.client}
                </div>
                <button onClick={()=>upSt(o.id,"chez_client")}
                  style={{width:"100%",background:"#0284C7",color:G.white,border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <span style={{fontSize:20}}>📍</span> Je suis arrivé chez le client
                </button>
              </>
            )}

            {/* Étape finale: chez client → résultat */}
            {o.status==="chez_client"&&(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{background:"#FEF3C7",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#D97706",fontWeight:600}}>
                  📍 Étape 5 — Vous êtes chez {o.client}. Comment ça s'est passé ?
                </div>
                <button onClick={()=>upSt(o.id,"entregado")}
                  style={{width:"100%",background:"#D1FAE5",color:"#1A5C38",border:"2px solid #6EE7B7",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <span style={{fontSize:22}}>✅</span> Livré — Cash encaissé
                </button>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <button onClick={()=>upSt(o.id,"rechazado")} style={{background:"#FEE2E2",color:"#DC2626",border:"2px solid #FCA5A5",borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span style={{fontSize:18}}>❌</span><span>Rejeté</span>
                  </button>
                  <button onClick={()=>upSt(o.id,"no_contesta")} style={{background:"#F3F4F6",color:"#6B7280",border:"2px solid #D1D5DB",borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span style={{fontSize:18}}>📵</span><span>Absent</span>
                  </button>
                  <button onClick={()=>upSt(o.id,"reprogramar")} style={{background:"#EDE9FE",color:"#7C3AED",border:"2px solid #C4B5FD",borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span style={{fontSize:18}}>🔄</span><span>Reporter</span>
                  </button>
                </div>
                {o.phone&&<a href={`tel:+221${o.phone.replace(/\s+/g,"")}`} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",color:G.gray,borderRadius:8,padding:"6px 0",fontSize:11,textDecoration:"none",border:`1px solid ${G.grayLight}`}}><span>📞</span> Rappeler le client</a>}
              </div>
            )}

            {/* Statuts bloqués */}
            {!["confirmado","livreur_en_route","colis_pris","en_camino","chez_client"].includes(o.status)&&(
              <button onClick={()=>upSt(o.id,"en_camino")} style={{width:"100%",background:G.grayLight,color:G.gray,border:"none",borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                🔄 Reprendre la livraison
              </button>
            )}

            {/* Bouton correction — revenir étape précédente */}
            {(()=>{
              const PREV = {
                "livreur_en_route": {s:"confirmado",         l:"← Annuler le départ"},
                "colis_pris":       {s:"livreur_en_route",   l:"← Colis pas encore pris"},
                "en_camino":        {s:"colis_pris",         l:"← Pas encore parti vers le client"},
                "chez_client":      {s:"en_camino",          l:"← Pas encore chez le client"},
                "no_contesta":      {s:"chez_client",        l:"← Retenter la livraison"},
                "reprogramar":      {s:"chez_client",        l:"← Retenter la livraison"},
              };
              const prev = PREV[o.status];
              if(!prev) return null;
              return (
                <button onClick={()=>{
                  upSt(o.id, prev.s);
                  addToast("Étape corrigée ✏️","✏️",G.gray);
                }}
                  style={{width:"100%",background:"none",border:"none",color:"#9CA3AF",fontSize:11,cursor:"pointer",padding:"5px 0",textDecoration:"underline dotted",marginTop:2}}>
                  ✏️ {prev.l}
                </button>
              );
            })()}
          </div>
        )}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:7}}>
          <button onClick={()=>{setNoteModal(o.id);setNoteText(o.note);}} style={{background:"none",border:"none",color:G.gray,fontSize:11,cursor:"pointer",padding:0}}>
            📝 {o.note?"Modifier note":"Ajouter note"}
          </button>
          {(role==="admin"||(role==="closer"&&pC.closerFullControl))&&(
            <button onClick={()=>setEditOrder({...o})} style={{background:G.grayLight,border:"none",borderRadius:6,padding:"3px 10px",fontSize:11,color:G.dark,cursor:"pointer",fontWeight:600}}>
              ✏️ Modifier
            </button>
          )}
        </div>
        </div>{/* end actions zone */}
      </div>
    );
  };

  const [org, setOrg]             = useState(null);
  const [inviteLink, setInviteLink] = useState({closer:"",livreur:""});

  const PLANS = [
    {key:"starter", name:"Starter", price:"7.500",  maxMembers:3, maxOrders:100,  color:G.green, bg:G.greenLight, icon:"🟢",
     features:[
       "✅ 3 membres max (Admin + 2 membres)",
       "✅ 100 commandes / mois",
       "✅ Chat groupe interne",
       "✅ Localisation livreur GPS temps réel",
       "✅ 1 boutique connectée (Shopify / WooCommerce / YouCan)",
       "✅ Suivi stock produits",
       "✅ Suivi livraisons en temps réel",
       "✅ Comptabilité boutique",
       "✅ Confirmation commande WhatsApp auto",
       "✅ Export Excel & Google Sheets",
     ]},
    {key:"pro",     name:"Pro",     price:"13.000", maxMembers:5, maxOrders:200,  color:G.blue,  bg:"#EFF6FF",    icon:"🔵",
     features:[
       "✅ 5 membres (Admin + équipe)",
       "✅ 200 commandes / mois",
       "✅ Chat groupe interne",
       "✅ Localisation livreur GPS",
       "✅ 3 boutiques connectées",
       "✅ Suivi stock produits",
       "✅ Suivi livraisons en temps réel",
       "✅ Comptabilité boutique",
       "✅ Rapports avancés",
     ]},
    {key:"scale",   name:"Scale",   price:"25.000", maxMembers:null, maxOrders:null, color:"#7C3AED", bg:"#EDE9FE", icon:"🟣",
     features:[
       "✅ Membres illimités",
       "✅ Commandes illimitées",
       "✅ Chat groupe interne",
       "✅ Localisation livreur GPS",
       "✅ Boutiques illimitées",
       "✅ Suivi stock produits",
       "✅ Suivi livraisons en temps réel",
       "✅ Comptabilité boutique",
       "✅ Support prioritaire 24/7",
     ]},
  ];

  const genToken = () => Math.random().toString(36).substring(2,10).toUpperCase();

  const handleRegister = () => {
    if(!authForm.email||!authForm.password||!authForm.boutique||!authForm.nom||!authForm.phone) { setAuthError("Remplis tous les champs obligatoires *"); return; }
    if(authForm.password.length<6) { setAuthError("Mot de passe: 6 caractères minimum"); return; }
    setAuthError("");
    sbAuth(authForm.email, authForm.password, "register")
      .then(async(data)=>{
        const tok=data.access_token; _authToken=tok; setSbToken(tok);
        // Generate org UUID client-side so we don't need to read it back
        const newOrgId = crypto.randomUUID ? crypto.randomUUID() : `org_${Date.now()}`;
        await sbFetch("organizations","POST",{id:newOrgId,name:authForm.boutique||"Ma Boutique",whatsapp:authForm.phone||""});
        await sbFetch("profiles","POST",{id:data.user.id,org_id:newOrgId,nom:authForm.nom||"Admin",phone:authForm.phone||"",email:authForm.email,role:"admin"});
        // Set REAL UUID - critical for invite links
        setOrgId(newOrgId);
        setSbReady(true);
        setCurrentUser({id:data.user.id,nom:authForm.nom,email:authForm.email,role:"admin"});
        setSettings(s=>(({...s,nom:authForm.nom,whatsapp:authForm.phone,boutique:authForm.boutique})));
        setOrg({id:newOrgId,name:authForm.boutique,whatsapp:authForm.phone,plan:null});
        try{localStorage.setItem("teamly_org",newOrgId);localStorage.setItem("teamly_token",tok);localStorage.setItem("teamly_email",authForm.email);localStorage.setItem("teamly_role","admin");localStorage.setItem("teamly_userId",data.user.id);localStorage.setItem("teamly_nom",authForm.nom||"Admin");}catch(e){}
        setAuthStep("plan"); // Move to plan AFTER org is created
      }).catch(e=>setAuthError(e.message||"Erreur inscription — email déjà utilisé ?"));
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
      closer:  `https://admirable-gingersnap-0038d8.netlify.app?org=${realOrgId}&role=closer&token=${closerToken}`,
      livreur: `https://admirable-gingersnap-0038d8.netlify.app?org=${realOrgId}&role=livreur&token=${livreurToken}`,
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
            {[{k:"login",l:"Se connecter"},{k:"register",l:"Créer un compte"}].map(m=>(
              <button key={m.k} onClick={()=>setAuthMode(m.k)}
                style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:"sans-serif",background:authMode===m.k?G.gold:"none",color:authMode===m.k?G.dark:"rgba(255,255,255,0.7)"}}>
                {m.l}
              </button>
            ))}
          </div>

          {/* Login */}
          {authMode==="login"&&(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
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
                  // Fetch profile using user JWT (RLS-enforced, by user ID from auth response)
                  const profiles = await sbFetch(`profiles?id=eq.${data.user.id}&limit=1`).catch(()=>null);
                  if(profiles&&profiles.length>0){
                    const p=profiles[0];
                    const orgs = await sbFetch(`organizations?id=eq.${p.org_id}&limit=1`).catch(()=>null);
                    const orgName  = orgs?.[0]?.name  || "Ma Boutique";
                    const orgPhone = orgs?.[0]?.whatsapp || "";
                    setOrgId(p.org_id); setSbReady(true);
                    setSettings(s=>({...s,nom:p.nom||s.nom,whatsapp:p.phone||orgPhone||s.whatsapp,boutique:orgName,...(orgs?.[0]?.plan?{plan:orgs[0].plan}:{})}));
                    setCurrentUser({id:p.id||"",nom:p.nom||"",email:p.email||authForm.email,role:p.role||"admin",phone:p.phone||"",birthday:p.birthday||""});
                    setRole(p.role||"admin"); setTab("dashboard");
                    try {
                      localStorage.setItem("teamly_token", tok);
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
              {[
                {key:"boutique",  label:"🏪 Nom de ta boutique *",  ph:"Ma Boutique Dakar",  type:"text",     ac:"organization"},
                {key:"nom",       label:"👤 Ton prénom & nom *",     ph:"Cheikh Diallo",      type:"text",     ac:"name"},
                {key:"email",     label:"📧 Email *",                ph:"vous@boutique.sn",   type:"email",    ac:"email"},
                {key:"phone",     label:"📱 Téléphone *",            ph:"77 123 45 67",       type:"tel",      ac:"tel"},
                {key:"password",  label:"🔒 Mot de passe *",         ph:"6 caractères min",   type:"password", ac:"new-password"},
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
                  <div style={{fontWeight:700,fontSize:15,color:G.white,fontFamily:"sans-serif"}}>{p.price} <span style={{fontSize:10,opacity:0.7}}>FCFA/mois</span></div>
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
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                    <div>
                      <div style={{fontSize:12,color:G.white,fontFamily:"sans-serif",fontWeight:600}}>📊 Voir la Comptabilité</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontFamily:"sans-serif",marginTop:2}}>Revenus, bénéfices, CA par produit</div>
                    </div>
                    <button onClick={()=>setSettings(s=>({...s,closerCompta:!s.closerCompta}))}
                      style={{background:settings.closerCompta?"#22C55E":"rgba(255,255,255,0.15)",border:"none",borderRadius:20,width:46,height:26,cursor:"pointer",position:"relative",flexShrink:0,transition:"background 0.2s"}}>
                      <div style={{position:"absolute",top:3,left:settings.closerCompta?22:3,width:20,height:20,background:G.white,borderRadius:"50%",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.3)"}}/>
                    </button>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0"}}>
                    <div>
                      <div style={{fontSize:12,color:G.white,fontFamily:"sans-serif",fontWeight:600}}>🛍️ Modifier les produits</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontFamily:"sans-serif",marginTop:2}}>Accès au stock et aux produits</div>
                    </div>
                    <div style={{background:"#22C55E",border:"none",borderRadius:20,width:46,height:26,position:"relative",flexShrink:0}}>
                      <div style={{position:"absolute",top:3,left:22,width:20,height:20,background:G.white,borderRadius:"50%",boxShadow:"0 1px 3px rgba(0,0,0,0.3)"}}/>
                    </div>
                  </div>
                  {settings.closerCompta&&(
                    <div style={{background:"rgba(34,197,94,0.15)",borderRadius:8,padding:"6px 10px",marginTop:6,border:"1px solid rgba(34,197,94,0.3)"}}>
                      <div style={{fontSize:11,color:"#86EFAC",fontFamily:"sans-serif"}}>✅ Le Closer verra un onglet Compta dans son dashboard</div>
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
                const [orgRes, membersRes] = await Promise.all([
                  fetch(`${SB_URL}/rest/v1/organizations?id=eq.${detectedOrg}&select=plan`, {headers:{"apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}`}}),
                  fetch(`${SB_URL}/rest/v1/profiles?org_id=eq.${detectedOrg}&select=id`, {headers:{"apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}`}}),
                ]);
                const orgData   = await orgRes.json();
                const membersData = await membersRes.json();
                const planKey   = orgData?.[0]?.plan || "starter";
                const maxMap    = {starter:3, pro:5, business:null};
                const maxM      = maxMap[planKey] ?? 3;
                const currentCount = Array.isArray(membersData) ? membersData.length : 0;
                if(maxM && currentCount >= maxM) {
                  setAuthError(`❌ Cette équipe a atteint sa limite (${maxM} membres). Demande à l'Admin de passer au plan supérieur.`);
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

    </div>
  );

  const pC = settings; // permisos closer
  const canEditStock        = role==="admin" || (role==="closer" && (pC.closerFullControl||pC.closerManageProducts));
  const canDeleteOrder      = role==="admin" || (role==="closer" && (pC.closerFullControl||pC.closerDeleteOrder));
  const canManageTeam       = role==="admin" || (role==="closer" && (pC.closerFullControl||pC.closerManageTeam));
  const canEditOrders = role==="admin" || role==="closer";
  const canSeeCompta  = role==="admin" || (role==="closer" && (pC.closerFullControl||pC.closerCompta));

  const tabDefBase = {
    admin:   [{k:"dashboard",icon:"dashboard",l:"Dashboard"},{k:"boutique",icon:"boutique",l:"Cmdes à confirmer"},{k:"commandes",icon:"commandes",l:"Cmdes à traiter"},{k:"compta",icon:"compta",l:"Compta"},{k:"tracking",icon:"tracking",l:"Livreurs"},{k:"clients",icon:"clients",l:"Clients"},{k:"chat",icon:"chat",l:"Équipe Chat"},{k:"equipe",icon:"equipe",l:"Équipe"},{k:"stock",icon:"stock",l:"Produits"}],
    closer:  [{k:"dashboard",icon:"dashboard",l:"Dashboard"},{k:"boutique",icon:"boutique",l:"Cmdes à confirmer"},{k:"commandes",icon:"commandes",l:"Cmdes à traiter"},{k:"tracking",icon:"tracking",l:"Livreurs"},{k:"clients",icon:"clients",l:"Clients"},...((pC.closerFullControl||pC.closerManageProducts)?[{k:"stock",icon:"stock",l:"Produits"}]:[]),...((pC.closerFullControl||pC.closerCompta)?[{k:"compta",icon:"compta",l:"Compta"}]:[]),{k:"chat",icon:"chat",l:"Équipe Chat"},{k:"equipe",icon:"equipe",l:"Équipe"}],
    livreur: [{k:"livraisons",icon:"livraisons",l:"Livraisons"},{k:"dashboard",icon:"dashboard",l:"Dashboard"},{k:"position",icon:"position",l:"Ma Position"},{k:"chat",icon:"chat",l:"Équipe Chat"},{k:"equipe",icon:"equipe",l:"Équipe"}],
  };
  const tabDef = tabDefBase;
  const rlabel={admin:`👑 ${settings.nom||currentUser.nom}`,closer:`📞 ${currentUser.nom||"Closer"} · ${settings.boutique||""}`,livreur:`🏍️ ${currentUser.nom||"Livreur"} · ${settings.boutique||""}`};



  // ── Notifications ──
  // Alerts — séparées par rôle
  const adminAlerts = [
    // Commandes sans livreur
    ...orders.filter(o=>!o.livreur&&o.status==="confirmado").map(o=>({type:"sans_livreur",msg:`${o.client} — sans livreur`,sub:"Assigne un livreur pour cette commande",id:o.id,color:"#F0A500",bg:"#FFF8E7",icon:"🏍️",phone:o.phone})),
    // Livrées récemment
    ...orders.filter(o=>o.status==="entregado").slice(-3).map(o=>({type:"livre",msg:`${o.client} — Livré ✅`,sub:`${Number(o.price).toLocaleString("fr-FR")} FCFA encaissé`,id:o.id,color:G.green,bg:G.greenLight,icon:"✅",phone:o.phone})),
    // Rejetées
    ...orders.filter(o=>o.status==="rechazado").map(o=>({type:"rejet",msg:`${o.client} — Rejeté ❌`,sub:"Relancer le client ou clôturer",id:o.id,color:G.red,bg:"#FEE2E2",icon:"❌",phone:o.phone})),
    // Stock bas
    ...products.filter(p=>p.stock<5).map(p=>({type:"stock",msg:`Stock bas: ${p.name}`,sub:`${p.stock} unités restantes`,id:p.id,color:G.red,bg:"#FEE2E2",icon:"📦"})),
  ];
  const livreurAlerts = [
    ...myLiv.filter(o=>o.status==="colis_pris").map(o=>({type:"recuperer",msg:`📦 ${o.client}`,sub:`Prêt à livrer — ${fmt(o.price)} FCFA`,address:o.address,phone:o.phone,price:o.price,product:o.product,id:o.id,color:G.green,bg:G.greenLight,icon:"📦"})),
    ...myLiv.filter(o=>o.status==="en_camino").map(o=>({type:"pedido",msg:`🚀 ${o.client}`,sub:`En route — ${fmt(o.price)} FCFA`,address:o.address,phone:o.phone,price:o.price,product:o.product,id:o.id,color:"#0284C7",bg:"#EFF6FF",icon:"🚀"})),
    ...myLiv.filter(o=>o.status==="confirmado").map(o=>({type:"nouveau",msg:`🔔 Nouveau colis : ${o.client}`,sub:`${o.product} — ${fmt(o.price)} FCFA`,address:o.address,phone:o.phone,price:o.price,product:o.product,id:o.id,color:G.gold,bg:"#FFF8E7",icon:"🔔"})),
    ...myLiv.filter(o=>o.status==="livreur_en_route").map(o=>({type:"route",msg:`🏍️ ${o.client}`,sub:`Je pars récupérer — ${o.address}`,address:o.address,phone:o.phone,price:o.price,product:o.product,id:o.id,color:"#7C3AED",bg:"#EDE9FE",icon:"🏍️"})),
  ];
  const alerts = role==="livreur" ? livreurAlerts : adminAlerts;
  const alertCount = alerts.length + dbNotifs.length;

  // ── Filtered orders ──
  const allOrders = showArchived ? orders.filter(o=>o.archived) : orders.filter(o=>!o.archived);
  const baseOrders = role==="livreur" ? allOrders.filter(o=>o.livreur_id===currentUser.id) : allOrders;
  const YESTERDAY = new Date(Date.now()-86400000).toISOString().slice(0,10);
  const WEEK_AGO  = new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const filteredOrders = baseOrders.filter(o=>{
    const matchSearch = !searchQuery || o.client?.toLowerCase().includes(searchQuery.toLowerCase()) || o.phone?.includes(searchQuery) || o.product?.toLowerCase().includes(searchQuery.toLowerCase());
    const LIVRAISON_STATUTS = ["livreur_en_route","colis_pris","en_camino","chez_client"];
    const matchStatus = filterStatus==="all" ||
      (filterStatus==="livraison" ? LIVRAISON_STATUTS.includes(o.status) : o.status===filterStatus);
    const matchLivreur = filterLivreur==="all" || o.livreur===filterLivreur;
    const d = o.created_at?.slice(0,10)||"";
    const matchDate = filterDate==="all" || (filterDate==="today"&&d===TODAY) || (filterDate==="yesterday"&&d===YESTERDAY) || (filterDate==="week"&&d>=WEEK_AGO);
    return matchSearch && matchStatus && matchLivreur && matchDate;
  });

  return (
    <div style={{minHeight:"100vh",background:G.grayLight,fontFamily:"'Helvetica Neue',sans-serif",maxWidth:480,margin:"0 auto"}}>
      <style>{`@keyframes stepPulse{0%{transform:scale(1);box-shadow:0 0 0 0 var(--sc,rgba(46,139,87,0.7))}16.67%{transform:scale(1.4);box-shadow:0 0 0 10px rgba(0,0,0,0)}33.33%{transform:scale(1);box-shadow:0 0 0 0 rgba(0,0,0,0)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(0,0,0,0)}}.step-active{animation:stepPulse 6s ease-in-out infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Sidebar overlay */}
      {sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200}}/>}

      {/* Sidebar */}
      <div style={{position:"fixed",top:0,left:0,bottom:0,width:260,background:G.green,zIndex:201,transform:sidebarOpen?"translateX(0)":"translateX(-100%)",transition:"transform 0.28s ease",display:"flex",flexDirection:"column",boxShadow:"4px 0 20px rgba(0,0,0,0.3)"}}>
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

      {/* Header */}
      <div style={{background:G.green,padding:"13px 18px",paddingTop:"calc(13px + env(safe-area-inset-top, 0px))",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setSidebarOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",flexDirection:"column",gap:4}}>
            <div style={{width:20,height:2,background:G.white,borderRadius:2}}/>
            <div style={{width:20,height:2,background:G.white,borderRadius:2}}/>
            <div style={{width:14,height:2,background:G.white,borderRadius:2}}/>
          </button>
          <TeamlyLogo size={0.85}/>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {(role==="admin"||role==="closer")&&tab==="commandes"&&(
            <button onClick={()=>setShowAdd(true)} style={{background:G.gold,border:"none",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:12,color:G.dark}}>+ Commande</button>
          )}
          {role==="admin"&&tab==="stock"&&(
            <button onClick={()=>setShowAddProd(true)} style={{background:G.gold,border:"none",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:12,color:G.dark}}>+ Produit</button>
          )}
          <button onClick={()=>setShowSearch(s=>!s)} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:8,padding:"7px 9px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg viewBox="0 0 24 24" width={17} height={17} stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
          </button>
          <div style={{position:"relative"}}>
            <button onClick={()=>setTab("notifications")} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:8,padding:"7px 9px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <NavIcon name="notifications" size={17} color="#fff"/>
            </button>
            {alertCount>0&&<div style={{position:"absolute",top:-4,right:-4,background:G.red,color:G.white,borderRadius:"50%",width:16,height:16,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{alertCount}</div>}
          </div>
        </div>
      </div>

      {/* Search bar */}
      {showSearch&&(
        <div style={{background:G.white,padding:"10px 14px",borderBottom:`1px solid ${G.grayLight}`,display:"flex",flexDirection:"column",gap:8}}>
          <input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="🔍 Rechercher client, téléphone, produit..."
            style={{width:"100%",border:`1.5px solid ${G.green}`,borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>

          {role==="admin"&&(
            <div style={{display:"flex",gap:6,overflowX:"auto"}}>
              {["all",...teamMembers.filter(m=>m.role==="livreur").map(m=>m.nom)].map(l=>(
                <button key={l} onClick={()=>setFilterLivreur(l)}
                  style={{background:filterLivreur===l?G.greenMid:"#F4F4F4",color:filterLivreur===l?G.white:G.gray,border:"none",borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                  {l==="all"?"Tous livreurs":"🏍️ "+l}
                </button>
              ))}
            </div>
          )}
          {(searchQuery||filterStatus!=="all"||filterLivreur!=="all")&&(
            <div style={{fontSize:11,color:G.gray}}>{filteredOrders.length} résultat{filteredOrders.length!==1?"s":""} trouvé{filteredOrders.length!==1?"s":""}</div>
          )}
        </div>
      )}


      <div style={{padding:14,paddingBottom:(role==="admin"||(role==="closer"&&sbReady))?90:40}}>

        {/* ── LEADS SHOPIFY (pedidos sin confirmar) ── */}
        {tab==="boutique"&&(role==="admin"||role==="closer")&&(()=>{
          const leads = orders.filter(o=>o.status==="boutique");
          const webhookUrl = `${window.location.origin}/.netlify/functions/shopify-webhook?org=${orgId}`;
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
                            <div style={{fontWeight:700,fontSize:15,color:G.dark}}>{o.client}</div>
                            <div style={{fontSize:12,marginTop:3,display:"flex",alignItems:"center",gap:5}}>
                              <span style={{color:G.gray}}>📦 {o.product}</span>
                              {isMatched||catalogMatch
                                ? <span style={{background:"#D1FAE5",color:"#065F46",borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:700,flexShrink:0}}>✓ Reconnu</span>
                                : isAutoCreated
                                  ? <span style={{background:"#EDE9FE",color:"#5B21B6",borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:700,flexShrink:0}}>★ Ajouté — Ajoute le coût</span>
                                  : <span style={{background:"#FEF3C7",color:"#92400E",borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:700,flexShrink:0}}>⚠ Inconnu</span>
                              }
                            </div>
                            <div style={{fontSize:12,color:G.gray,marginTop:1}}>📍 {o.address||"—"}</div>
                            <div style={{fontSize:12,color:G.gray,marginTop:1}}>📱 {o.phone||"—"}</div>
                            {o.note&&!o.note.startsWith("Commande Shopify")&&<div style={{fontSize:10,color:"#92400E",background:"#FEF3C7",borderRadius:5,padding:"2px 6px",marginTop:4,display:"inline-block"}}>{o.note.replace(" ✓","")}</div>}
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontWeight:800,fontSize:17,color:"#D97706"}}>{Number(o.price).toLocaleString("fr-FR")}</div>
                            <div style={{fontSize:10,color:G.gray}}>FCFA</div>
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
                        <button onClick={()=>{setAssignLivreurModal(o);setAssignSelLiv(null);setAssignDelStatus("confirmado");}}
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

                {/* URL à copier */}
                <div style={{background:"#F8F8F8",borderRadius:9,padding:"10px 12px",marginBottom:10}}>
                  <div style={{fontSize:10,fontWeight:700,color:G.gray,marginBottom:5,letterSpacing:0.5}}>TON URL WEBHOOK (à copier)</div>
                  <div style={{fontSize:9,color:"#374151",wordBreak:"break-all",fontFamily:"monospace",lineHeight:1.6,marginBottom:8}}>{webhookUrl}</div>
                  <button onClick={()=>navigator.clipboard?.writeText(webhookUrl).then(()=>addToast("URL copiée ✅","✅",G.green))}
                    style={{width:"100%",background:G.green,color:"#fff",border:"none",borderRadius:8,padding:"9px 0",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    📋 Copier l'URL
                  </button>
                </div>

                {/* Shopify */}
                <div style={{borderRadius:10,border:"1px solid #E5E7EB",overflow:"hidden",marginBottom:8}}>
                  <div style={{background:"#F9FAFB",padding:"8px 12px",fontWeight:700,fontSize:12,color:G.dark,display:"flex",alignItems:"center",gap:6}}>
                    🛒 Shopify
                  </div>
                  <div style={{padding:"10px 12px",fontSize:11,color:G.gray,lineHeight:1.7}}>
                    1. Va dans ton admin Shopify<br/>
                    2. <b>Settings → Notifications → Webhooks</b><br/>
                    3. Clique <b>"Create webhook"</b><br/>
                    4. Event: <b>Order payment</b> · Format: <b>JSON</b><br/>
                    5. Colle l'URL ci-dessus → <b>Save</b>
                  </div>
                </div>

                {/* YouCan */}
                <div style={{borderRadius:10,border:"1px solid #E5E7EB",overflow:"hidden",marginBottom:8}}>
                  <div style={{background:"#F9FAFB",padding:"8px 12px",fontWeight:700,fontSize:12,color:G.dark,display:"flex",alignItems:"center",gap:6}}>
                    ⚡ YouCan
                  </div>
                  <div style={{padding:"10px 12px",fontSize:11,color:G.gray,lineHeight:1.7}}>
                    1. Va dans ton panel YouCan<br/>
                    2. <b>Settings → Webhooks</b><br/>
                    3. Clique <b>"Add webhook"</b><br/>
                    4. Event: <b>Order created</b> · Format: <b>JSON</b><br/>
                    5. Colle l'URL ci-dessus → <b>Save</b>
                  </div>
                </div>

                {/* WooCommerce */}
                <div style={{borderRadius:10,border:"1px solid #E5E7EB",overflow:"hidden"}}>
                  <div style={{background:"#F9FAFB",padding:"8px 12px",fontWeight:700,fontSize:12,color:G.dark,display:"flex",alignItems:"center",gap:6}}>
                    🔧 WooCommerce
                  </div>
                  <div style={{padding:"10px 12px",fontSize:11,color:G.gray,lineHeight:1.7}}>
                    1. Va dans ton admin WordPress<br/>
                    2. <b>WooCommerce → Settings → Advanced → Webhooks</b><br/>
                    3. Clique <b>"Add webhook"</b><br/>
                    4. Topic: <b>Order created</b> · Format: <b>JSON</b><br/>
                    5. Colle l'URL ci-dessus → <b>Save</b>
                  </div>
                </div>
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
        {dataReady&&tab==="dashboard"&&role==="admin"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* Salutation */}
            <div style={{background:`linear-gradient(135deg,${G.green},#0D3D25)`,borderRadius:16,padding:"16px 18px",color:G.white}}>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>Bonjour, {settings.nom} 👋</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2}}>{settings.boutique} · {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:12}}>
                <div>
                  <div style={{fontSize:10,color:G.gold,fontWeight:700,letterSpacing:1}}>CA DU JOUR</div>
                  <div style={{fontSize:30,fontWeight:700,color:G.gold,marginTop:2}}>{fmt(caJour)} <span style={{fontSize:14}}>FCFA</span></div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginTop:3}}>Bénéf. total: {fmt(tBen)} FCFA</div>
                </div>
                <button onClick={()=>setTab("compta")} style={{background:"rgba(240,165,0,0.2)",color:G.gold,border:"1px solid rgba(240,165,0,0.4)",borderRadius:9,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  Voir Compta →
                </button>
              </div>
            </div>

            {/* KPIs */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <SC icon="📦" label="Total commandes" value={orders.length} onClick={()=>setTab("commandes")}/>
              <SC icon="✅" label="Livrées" value={livres} color={G.green} bg={G.greenLight} onClick={()=>{setFilterStatus("entregado");setTab("commandes");}}/>
              <SC icon="❌" label="Rejetées" value={rejetes} color={G.red} bg="#FEE2E2" onClick={()=>{setFilterStatus("rechazado");setTab("commandes");}}/>
              <SC icon="🏍️" label="En route" value={enRoute} color={G.blue} bg="#EFF6FF" onClick={()=>{setFilterStatus("livraison");setTab("commandes");}}/>
            </div>

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
                          <span style={{fontSize:12,fontWeight:700,color:G.green}}>{fmt(ca)} FCFA</span>
                          <span style={{fontSize:10,color:G.gray,marginLeft:6}}>({nLiv} livrées)</span>
                        </div>
                      </div>
                      <div style={{background:G.grayLight,borderRadius:4,height:8}}>
                        <div style={{background:G.green,borderRadius:4,height:8,width:`${pctBar}%`,transition:"width 0.5s"}}/>
                      </div>
                      <div style={{fontSize:10,color:ben>=0?G.greenMid:G.red,marginTop:2}}>Bénéfice: {fmt(ben)} FCFA</div>
                    </div>
                  );
                })}
                <div style={{background:G.greenLight,borderRadius:10,padding:"8px 12px",marginTop:6,display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,fontWeight:700,color:G.green}}>CA Total</span>
                  <span style={{fontSize:14,fontWeight:700,color:G.green}}>{fmt(tCA)} FCFA</span>
                </div>
              </div>
            )}

            {/* Actions rapides */}
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <ST>⚡ ACTIONS RAPIDES</ST>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  {icon:"📦",label:"+ Commande",action:()=>setShowAdd(true),bg:G.greenLight,color:G.green},
                  {icon:"📦",label:"+ Produit",action:()=>setShowAddProd(true),bg:"#EFF6FF",color:G.blue},
                  {icon:"👤",label:"Clients",action:()=>setTab("clients"),bg:"#FFF8E7",color:G.gold},
                  {icon:"🗺️",label:"Tracking",action:()=>setTab("tracking"),bg:"#EDE9FE",color:"#7C3AED"},
                ].map((a,i)=>(
                  <button key={i} onClick={a.action} style={{background:a.bg,border:"none",borderRadius:10,padding:"12px 8px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                    <span style={{fontSize:22}}>{a.icon}</span>
                    <span style={{fontSize:11,fontWeight:700,color:a.color}}>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Alertes urgentes — seulement sans livreur, rejetées, stock bas */}
            {(()=>{
              const urgentAlerts = adminAlerts.filter(a=>a.type!=="livre");
              return urgentAlerts.length>0?(
                <div style={{background:"#FEF2F2",borderRadius:14,padding:14,border:"1px solid #FCA5A5"}}>
                  <ST>⚠️ ALERTES ({urgentAlerts.length})</ST>
                  {urgentAlerts.slice(0,3).map((a,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:i<2?"1px solid #FEE2E2":"none"}}>
                      <div style={{fontSize:12,color:G.dark}}>{a.icon} {a.msg}</div>
                      <button onClick={()=>setTab("commandes")} style={{background:"none",border:`1px solid ${a.color}`,borderRadius:6,padding:"3px 8px",fontSize:10,color:a.color,cursor:"pointer"}}>Voir</button>
                    </div>
                  ))}
                </div>
              ):null;
            })()}

            {/* Commandes récentes */}
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontWeight:700,fontSize:13,color:G.green}}>📋 COMMANDES RÉCENTES</div>
                <button onClick={()=>setTab("commandes")} style={{background:"none",border:"none",color:G.green,fontSize:11,cursor:"pointer",fontWeight:600}}>Voir tout →</button>
              </div>
              {orders.slice(0,4).map(o=>{const st=STATUS[o.status]||STATUS.pendiente;return(
                <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${G.grayLight}`}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:G.dark}}>{o.client}</div>
                    <div style={{fontSize:11,color:G.gray}}>{o.product}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:12,fontWeight:700,color:G.green}}>{fmt(o.price)} F</div>
                    <span style={{background:st.bg,color:st.color,borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:600}}>{st.label}</span>
                  </div>
                </div>
              );})}
            </div>

            {/* Perf équipe */}
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <ST>👥 PERFORMANCE ÉQUIPE</ST>
              <Tbl headers={["Nom","Rôle","Cmd","Livrées","Rejetées"]} align={["left","left","right","right","right"]}
                rows={[...teamMembers.filter(m=>m.role==="closer").map(m=>{const all=orders.filter(o=>o.closer_id===m.id);return [m.nom,"📞",all.length,<span style={{color:G.green,fontWeight:700}}>{all.filter(o=>o.status==="entregado").length}</span>,<span style={{color:G.red,fontWeight:700}}>{all.filter(o=>o.status==="rechazado").length}</span>];}),
                       ...teamMembers.filter(m=>m.role==="livreur").map(m=>{const all=orders.filter(o=>o.livreur_id===m.id);return [m.nom,"🏍️",all.length,<span style={{color:G.green,fontWeight:700}}>{all.filter(o=>o.status==="entregado").length}</span>,<span style={{color:G.red,fontWeight:700}}>{all.filter(o=>o.status==="rechazado").length}</span>];})]}
              />
            </div>
          </div>
        )}

        {/* ── CLOSER DASHBOARD ── */}
        {dataReady&&tab==="dashboard"&&role==="closer"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",gap:8}}><SC icon="📦" label="Mes commandes" value={myClo.length}/><SC icon="✅" label="Livrées" value={myClo.filter(o=>o.status==="entregado").length} color={G.green} bg={G.greenLight}/></div>
            <div style={{display:"flex",gap:8}}><SC icon="❌" label="Rejetées" value={myClo.filter(o=>o.status==="rechazado").length} color={G.red} bg="#FEE2E2"/><SC icon="⏳" label="En attente" value={myClo.filter(o=>o.status==="pendiente").length} color={G.gold} bg="#FFF8E7"/></div>
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <ST>🔥 À TRAITER EN PRIORITÉ</ST>
              {myClo.filter(o=>["pendiente","no_contesta","reprogramar"].includes(o.status)).length===0?<div style={{fontSize:13,color:G.gray}}>Rien ✓</div>:myClo.filter(o=>["pendiente","no_contesta","reprogramar"].includes(o.status)).map(o=>{const st=STATUS[o.status];return <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${G.grayLight}`}}><div><div style={{fontSize:13,fontWeight:600}}>{o.client}</div><div style={{fontSize:11,color:G.gray}}>📱 {o.phone}</div></div><span style={{background:st.bg,color:st.color,borderRadius:8,padding:"3px 9px",fontSize:11,fontWeight:600}}>{st.label}</span></div>;})}
            </div>
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <ST>🏍️ LIVREURS</ST>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>{teamMembers.filter(m=>m.role==="livreur").map(m=>{const busy=orders.filter(o=>o.livreur_id===m.id&&o.status==="en_camino").length;return <div key={m.id} style={{background:busy>0?"#FFF8E7":G.greenLight,borderRadius:10,padding:"7px 11px",fontSize:12,fontWeight:600,color:busy>0?G.gold:G.green}}>🏍️ {m.nom} {busy>0?`(${busy} en route)`:"· Dispo"}</div>;})}</div>
            </div>
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <ST>📋 MES COMMANDES</ST>
              <Tbl headers={["Client","Produit","Prix","Statut"]} align={["left","left","right","left"]}
                rows={myClo.map(o=>{const st=STATUS[o.status]||STATUS.pendiente;return [<span style={{fontWeight:600}}>{o.client}</span>,o.product,<span style={{fontWeight:700,color:G.green}}>{fmt(o.price)}</span>,<span style={{background:st.bg,color:st.color,borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:600}}>{st.label}</span>];})}
              />
            </div>
          </div>
        )}

        {/* ── LIVREUR DASHBOARD ── */}
        {dataReady&&tab==="dashboard"&&role==="livreur"&&(()=>{
          const aRecuperer = myLiv.filter(o=>o.status==="confirmado"||o.status==="livreur_en_route");
          const aLivrer    = myLiv.filter(o=>o.status==="colis_pris");
          const enRoute    = myLiv.filter(o=>o.status==="en_camino"||o.status==="chez_client");
          return (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* Alertes Supabase temps réel */}
            {dbNotifs.slice(0,3).map(n=>(
              <div key={n.id} style={{background:"linear-gradient(135deg,#F0A500,#D97706)",borderRadius:14,padding:14,display:"flex",gap:12,alignItems:"center"}}>
                <div style={{fontSize:26,flexShrink:0}}>{n.type==="nouveau_colis"?"🔔":n.type==="livraison_directe"?"🚀":"📦"}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:14,color:"#FFF"}}>{n.title}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.9)",marginTop:2}}>{n.body}</div>
                </div>
                <button onClick={()=>{
                  sbFetch(`notifications?id=eq.${n.id}`,"PATCH",{read:true});
                  setDbNotifs(p=>p.filter(x=>x.id!==n.id));
                }} style={{background:"rgba(0,0,0,0.2)",border:"none",borderRadius:"50%",width:28,height:28,color:"#FFF",cursor:"pointer",fontSize:14,flexShrink:0}}>✕</button>
              </div>
            ))}

            {/* Colis en attente d'acceptation */}
            {myLiv.filter(o=>o.status==="confirmado").length>0&&(
              <div style={{background:"#FFF8E7",border:"1px solid #FDE68A",borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:20}}>🔔</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#92400E"}}>{myLiv.filter(o=>o.status==="confirmado").length} colis à accepter</div>
                  <div style={{fontSize:11,color:"#92400E",marginTop:1}}>Va dans Livraisons pour accepter</div>
                </div>
                <button onClick={()=>setTab("livraisons")} style={{background:"#F0A500",color:"#FFF",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Voir →</button>
              </div>
            )}

            {/* ── BLOC TOURNÉE — colis à récupérer ── */}
            {aRecuperer.length>0&&(
              <TourneeBlock
                orders={aRecuperer}
                mode="recuperer"
                onConfirm={(ids)=>{
                  ids.forEach(id=>upSt(id,"livreur_en_route"));
                  addToast(`${ids.length} colis — Je pars récupérer 🏍️`,"🏍️",G.green);
                }}
                G={G} fmt={fmt}
              />
            )}

            {/* ── BLOC DÉPART CLIENTS — colis récupérés, prêt à livrer ── */}
            {aLivrer.length>0&&(
              <TourneeBlock
                orders={aLivrer}
                mode="livrer"
                onConfirm={(ids)=>{
                  ids.forEach(id=>upSt(id,"en_camino"));
                  addToast(`${ids.length} colis — En route vers les clients 🚀`,"🚀","#0284C7");
                }}
                G={G} fmt={fmt}
              />
            )}

            {myLiv.length===0&&orders.length>0&&(
              <div style={{background:"#FFF8E7",borderRadius:12,padding:14,fontSize:12,color:"#92400E",border:"1px solid #FDE68A"}}>
                ⚠️ Aucune livraison assignée à <strong>{currentUser.nom}</strong>. Demande à l'Admin de t'assigner des commandes.
              </div>
            )}
            <div style={{display:"flex",gap:8}}><SC icon="📦" label="Assignées" value={myLiv.length}/><SC icon="✅" label="Livrées" value={myLiv.filter(o=>o.status==="entregado").length} color={G.green} bg={G.greenLight}/></div>
            <div style={{display:"flex",gap:8}}><SC icon="🏍️" label="En route" value={myLiv.filter(o=>o.status==="en_camino").length} color={G.blue} bg="#EFF6FF"/><SC icon="❌" label="Rejetées" value={myLiv.filter(o=>o.status==="rechazado").length} color={G.red} bg="#FEE2E2"/></div>
            <div style={{background:G.greenLight,borderRadius:14,padding:18,textAlign:"center"}}>
              <div style={{fontSize:11,color:G.gray,fontWeight:700,letterSpacing:1}}>CASH COLLECTÉ</div>
              <div style={{fontSize:28,fontWeight:700,color:G.green,marginTop:4}}>{fmt(myLiv.filter(o=>o.status==="entregado").reduce((a,o)=>a+o.price,0))} FCFA</div>
            </div>
            {myLiv.filter(o=>o.status==="en_camino").length>0&&(
              <div style={{background:G.white,borderRadius:14,padding:14}}>
                <ST>🚀 EN COURS</ST>
                {myLiv.filter(o=>o.status==="en_camino").map(o=>(
                  <div key={o.id} style={{padding:"8px 0",borderBottom:`1px solid ${G.grayLight}`}}>
                    <div style={{fontWeight:700,fontSize:14}}>{o.client}</div>
                    <div style={{fontSize:12,color:G.gray}}>📍 {o.address} · 📱 {o.phone}</div>
                    <div style={{fontSize:13,fontWeight:700,color:G.green,marginTop:2}}>{fmt(o.price)} FCFA</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <ST>📋 MES LIVRAISONS</ST>
              <Tbl headers={["Client","Produit","Prix","Statut"]} align={["left","left","right","left"]}
                rows={myLiv.map(o=>{const st=STATUS[o.status]||STATUS.pendiente;return [<span style={{fontWeight:600}}>{o.client}</span>,o.product,<span style={{fontWeight:700,color:G.green}}>{fmt(o.price)}</span>,<span style={{background:st.bg,color:st.color,borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:600}}>{st.label}</span>];})}
              />
            </div>
          </div>
          );
        })()}

        {/* ── COMMANDES / LIVRAISONS ── */}
        {dataReady&&(tab==="commandes"||tab==="livraisons")&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>

            {/* ── Filtre par date (commandes seulement) ── */}
            {tab==="commandes"&&(
              <div style={{background:G.white,borderRadius:12,padding:"10px 12px"}}>
                <div style={{fontSize:10,color:G.gray,fontWeight:700,marginBottom:8,letterSpacing:0.5}}>📅 FILTRER PAR DATE</div>
                <div style={{display:"flex",gap:6}}>
                  {[{k:"today",l:"Aujourd'hui"},{k:"yesterday",l:"Hier"},{k:"week",l:"Semaine"},{k:"all",l:"Tout"}].map(d=>(
                    <button key={d.k} onClick={()=>setFilterDate(d.k)}
                      style={{flex:1,background:filterDate===d.k?G.green:"#F3F4F6",color:filterDate===d.k?"#fff":G.gray,border:"none",borderRadius:8,padding:"7px 0",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
            )}


            {filteredOrders.length===0&&(
              <div style={{textAlign:"center",padding:40,color:G.gray,background:G.white,borderRadius:14}}>
                <div style={{fontSize:32,marginBottom:8}}>🔍</div>
                <div style={{fontSize:14,fontWeight:600}}>Aucun résultat</div>
                <div style={{fontSize:12,marginTop:4}}>Modifie ta recherche ou tes filtres</div>
              </div>
            )}
            {filteredOrders.map(o=><OCard key={o.id} o={o} showPrendre={true}/>)}
          </div>
        )}

        {/* ── CLIENTS ── */}
        {dataReady&&tab==="clients"&&(role==="admin"||role==="closer")&&(()=>{
          const TODAY     = new Date().toISOString().slice(0,10);
          const YESTERDAY = new Date(Date.now()-86400000).toISOString().slice(0,10);
          const WEEK_AGO  = new Date(Date.now()-7*86400000).toISOString().slice(0,10);

          // Categories
          const CATS = [
            {k:"boutique",  label:"En boutique",  color:"#D97706", bg:"#FFF8E7", statuses:["boutique"]},
            {k:"confirme",  label:"Confirmés",    color:G.blue,    bg:"#EFF6FF", statuses:["confirmado","livreur_en_route","colis_pris","en_camino","chez_client"]},
            {k:"livre",     label:"Livrés",       color:G.green,   bg:G.greenLight, statuses:["entregado"]},
          ];
          const changeFilter = (setCat, setDate, catVal, dateVal) => {
            setClientLoading(true);
            if(catVal!==undefined) setClientCat(catVal);
            if(dateVal!==undefined) setClientDate(dateVal);
            setTimeout(()=>setClientLoading(false), 300);
          };
          const cat = CATS.find(c=>c.k===clientCat)||CATS[1];

          const matchDate = (o) => {
            const d = o.created_at?.slice(0,10)||"";
            if(clientDate==="today")     return d===TODAY;
            if(clientDate==="yesterday") return d===YESTERDAY;
            if(clientDate==="week")      return d>=WEEK_AGO;
            return true;
          };

          const filteredOrd = orders.filter(o=>cat.statuses.includes(o.status)&&matchDate(o));

          // Build unique clients from filtered orders
          const clientMap = {};
          filteredOrd.forEach(o=>{
            const key = o.phone||o.client;
            if(!clientMap[key]) clientMap[key]={name:o.client,phone:o.phone,address:o.address,orders:[]};
            clientMap[key].orders.push(o);
          });
          const clients = Object.values(clientMap).sort((a,b)=>b.orders.length-a.orders.length);

          const exportFile = (type) => {
            const header = ["Nom client","Téléphone","Adresse","Produit","Prix","Statut","Date"];
            const rows = filteredOrd.map(o=>{
              const d = o.created_at?new Date(o.created_at).toLocaleDateString("fr-FR"):"";
              return [o.client||"",o.phone||"",o.address||"",o.product||"",o.price||0,(STATUS[o.status]||{label:o.status}).label,d];
            });
            const csv = [header,...rows].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(";")).join("\n");
            const blob = new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href=url; a.download=`clients_${cat.k}_${TODAY}.${type==="excel"?"csv":type}`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
          };

          return (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>

              {/* 3 onglets */}
              <div style={{display:'flex',gap:6}}>
                {CATS.map(c=>(
                  <button key={c.k} onClick={()=>changeFilter(null,null,c.k,undefined)}
                    style={{flex:1,background:clientCat===c.k?c.color:'#F3F4F6',color:clientCat===c.k?'#fff':'#6B7280',border:'none',borderRadius:10,padding:'9px 4px',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .15s'}}>
                    {c.label}
                    <div style={{fontSize:18,fontWeight:800,marginTop:2,color:clientCat===c.k?'rgba(255,255,255,0.9)':c.color}}>
                      {orders.filter(o=>c.statuses.includes(o.status)).length}
                    </div>
                  </button>
                ))}
              </div>

              {/* Filtre date */}
              <div style={{background:G.white,borderRadius:12,padding:'10px 12px'}}>
                <div style={{fontSize:10,color:G.gray,fontWeight:700,marginBottom:8,letterSpacing:0.5}}>📅 FILTRER PAR DATE</div>
                <div style={{display:'flex',gap:6}}>
                  {[{k:"today",l:"Aujourd'hui"},{k:"yesterday",l:"Hier"},{k:"week",l:"Semaine"},{k:"all",l:"Tout"}].map(d=>(
                    <button key={d.k} onClick={()=>changeFilter(null,null,undefined,d.k)}
                      style={{flex:1,background:clientDate===d.k?G.green:'#F3F4F6',color:clientDate===d.k?'#fff':G.gray,border:'none',borderRadius:8,padding:'7px 0',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exports */}
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>exportFile('excel')} style={{flex:1,background:G.green,color:'#fff',border:'none',borderRadius:10,padding:'10px 0',fontSize:12,fontWeight:700,cursor:'pointer'}}>📊 Excel (.csv)</button>
                <button onClick={()=>exportFile('csv')} style={{flex:1,background:'#0284C7',color:'#fff',border:'none',borderRadius:10,padding:'10px 0',fontSize:12,fontWeight:700,cursor:'pointer'}}>📄 CSV</button>
              </div>

              {/* Compteur */}
              <div style={{display:'flex',justifyContent:'space-between',padding:'2px'}}>
                <span style={{fontSize:12,color:G.gray}}>{clients.length} client{clients.length!==1?'s':''} · {filteredOrd.length} commande{filteredOrd.length!==1?'s':''}</span>
                <span style={{fontSize:11,fontWeight:700,color:cat.color}}>{cat.label}</span>
              </div>

              {/* Loading */}
              {clientLoading&&(
                <div style={{background:G.white,borderRadius:14,padding:30,textAlign:"center"}}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="2.5" strokeLinecap="round" style={{animation:"spin 0.8s linear infinite"}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  <div style={{fontSize:12,color:G.gray,marginTop:8,fontWeight:600}}>Chargement...</div>
                </div>
              )}

              {/* Liste */}
              {!clientLoading&&clients.length===0&&(
                <div style={{background:G.white,borderRadius:14,padding:40,textAlign:'center',color:G.gray}}>
                  <div style={{fontSize:40,marginBottom:10}}>👤</div>
                  <div style={{fontWeight:700,fontSize:14}}>Aucun client dans cette catégorie</div>
                </div>
              )}
              {!clientLoading&&clients.length>0&&(
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {clients.map(c=>{
                    const open = showClientDetail===c.phone;
                    return (
                      <div key={c.phone} style={{background:G.white,borderRadius:14,overflow:'hidden',border:`1.5px solid ${open?cat.color:G.grayLight}`}}>
                        <button onClick={()=>setShowClientDetail(open?null:c.phone)}
                          style={{width:'100%',background:'none',border:'none',padding:'12px 14px',cursor:'pointer',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:14,color:G.dark}}>{c.name}</div>
                            <div style={{fontSize:11,color:G.gray,marginTop:3}}>📱 {c.phone}</div>
                            {c.address&&<div style={{fontSize:11,color:G.gray}}>📍 {c.address}</div>}
                          </div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div style={{background:cat.bg,color:cat.color,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700,marginBottom:4}}>
                              {c.orders.length} cmde{c.orders.length>1?'s':''}
                            </div>
                            <div style={{fontSize:10,color:G.gray}}>{open?'▲ Fermer':'▼ Détails'}</div>
                          </div>
                        </button>
                        {open&&(
                          <div style={{borderTop:`1px solid ${G.grayLight}`,padding:'10px 14px 14px'}}>
                            {c.orders.map(o=>{
                              const st=STATUS[o.status]||{label:o.status,color:G.gray,bg:G.grayLight};
                              const d=o.created_at?new Date(o.created_at).toLocaleDateString('fr-FR'):'';
                              return (
                                <div key={o.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${G.grayLight}`}}>
                                  <div>
                                    <div style={{fontSize:12,fontWeight:600,color:G.dark}}>{o.product}</div>
                                    {d&&<div style={{fontSize:10,color:G.gray}}>📅 {d}</div>}
                                  </div>
                                  <div style={{textAlign:'right'}}>
                                    <div style={{fontSize:13,fontWeight:800,color:G.green}}>{fmt(o.price)} F</div>
                                    <span style={{background:st.bg,color:st.color,borderRadius:5,padding:'2px 7px',fontSize:10,fontWeight:600}}>{st.label}</span>
                                  </div>
                                </div>
                              );
                            })}
                            <a href={`tel:${c.phone}`} style={{display:'block',marginTop:10,background:G.greenLight,color:G.green,borderRadius:9,padding:'9px 0',fontSize:12,fontWeight:700,textAlign:'center',textDecoration:'none'}}>📞 Appeler {c.name}</a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

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
              {Object.keys(livreurPositions).filter(k=>livreurPositions[k]?.lat).length===0
                ? <div style={{padding:30,textAlign:"center",color:G.gray,fontSize:13}}>
                    Aucun livreur GPS actif pour le moment
                  </div>
                : <MapView positions={livreurPositions} role="admin"/>
              }
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
                        <span style={{float:"right",fontWeight:700,color:G.green}}>{Number(o.price).toLocaleString("fr-FR")} F</span>
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

            {/* Bouton partager position réelle */}
            <button onClick={()=>{
              if(!navigator.geolocation){alert("GPS non disponible sur cet appareil");return;}
              navigator.geolocation.getCurrentPosition(
                (pos)=>{
                  setGpsPos({lat:pos.coords.latitude, lng:pos.coords.longitude});
                  setLivreurPositions(p=>({...p,[currentUser.nom]:{lat:pos.coords.latitude,lng:pos.coords.longitude,name:currentUser.nom,order:"En livraison"}}));
                  addToast("📍 Position partagée avec l'Admin !","📍",G.green);
                },
                ()=>alert("Impossible d'obtenir votre position. Activez le GPS.")
              );
            }} style={{background:G.green,color:G.white,border:"none",borderRadius:14,padding:"16px 0",fontWeight:800,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
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
                        // Guardar en Supabase
                        sbFetch(`profiles?id=eq.${currentUser.id}`,"PATCH",{lat,lng,city}).catch(()=>{});
                        setLivreurPositions(p=>({...p,[currentUser.nom]:{lat,lng,name:currentUser.nom,city,order:"En livraison"}}));
                      },
                      err => {
                        const msgs={1:"Accès refusé — autorisez la localisation dans votre navigateur",2:"Signal GPS faible",3:"Délai dépassé — réessayez"};
                        setGpsError(msgs[err.code]||"Erreur GPS");
                        setGpsActive(false);
                      },
                      {enableHighAccuracy:true,timeout:15000,maximumAge:10000}
                    );
                    setGpsActive(true);
                  } catch(e) { setGpsError("GPS non disponible dans cet environnement"); }
                }
              }} style={{width:"100%",background:gpsActive?"#DC2626":G.green,color:G.white,border:"none",borderRadius:12,padding:"14px 0",fontWeight:700,fontSize:15,cursor:"pointer"}}>
                {gpsActive?"⏹️ Arrêter le GPS":"▶️ Activer le GPS"}
              </button>
            </div>

            {/* Carte position livreur */}
            {gpsPos&&(
              <div style={{background:G.white,borderRadius:14,overflow:"hidden"}}>
                <div style={{padding:"10px 14px",borderBottom:`1px solid ${G.grayLight}`,fontWeight:700,fontSize:13,color:G.green}}>📍 Ta position actuelle</div>
                <MapView positions={{[currentUser.nom]:{...gpsPos,name:currentUser.nom,order:"Ma position"}}} role="livreur"/>
              </div>
            )}

            {/* Livraisons en cours */}
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <div style={{fontWeight:700,fontSize:13,color:G.green,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${G.grayLight}`}}>📦 MES LIVRAISONS</div>
              {myLiv.filter(o=>["en_camino","chez_client","colis_pris"].includes(o.status)).length===0
                ?<div style={{fontSize:13,color:G.gray,textAlign:"center",padding:"16px 0"}}>Aucune livraison en cours</div>
                :myLiv.filter(o=>["en_camino","chez_client","colis_pris"].includes(o.status)).map(o=>(
                  <div key={o.id} style={{padding:"9px 0",borderBottom:`1px solid ${G.grayLight}`}}>
                    <div style={{fontWeight:700,fontSize:13}}>{o.client}</div>
                    <div style={{fontSize:11,color:G.gray}}>📍 {o.address}</div>
                    <div style={{fontSize:12,fontWeight:700,color:G.green,marginTop:2}}>{fmt(o.price)} FCFA</div>
                  </div>
                ))
              }
            </div>
          </div>
        )}


        {/* ── ÉQUIPE ── */}
        {dataReady&&tab==="equipe"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* Bouton Chat de groupe */}
            <button onClick={()=>setTab("chat")} style={{background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",border:"none",borderRadius:14,padding:"14px 18px",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:"0 4px 14px rgba(37,211,102,0.3)"}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Ouvrir le Chat de groupe
            </button>

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
                        {m.id!==currentUser.id&&m.email!==currentUser.email&&<div style={{fontSize:11,color:G.gray,marginTop:2}}>📱 {m.phone}</div>}
                      </div>
                      {m.id!==currentUser.id&&m.email!==currentUser.email&&(
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
                        <div style={{fontWeight:700,fontSize:13,color:m.id===currentUser.id?G.green:G.dark}}>
                          🏍️ {m.nom} {m.id===currentUser.id&&<span style={{fontSize:10,color:G.green,fontWeight:600}}>(toi)</span>}
                        </div>
                        {m.id!==currentUser.id&&m.email!==currentUser.email&&<div style={{fontSize:11,color:G.gray,marginTop:2}}>📱 {m.phone}</div>}
                      </div>
                      {m.id!==currentUser.id&&m.email!==currentUser.email&&(
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
                        <div style={{fontSize:11,color:G.gray,marginTop:2}}>{m.id!==currentUser.id&&m.email!==currentUser.email&&`📱 ${m.phone} · `}📧 {m.email}</div>
                      </div>
                      <div style={{display:"flex",gap:5,alignItems:"center"}}>
                        {m.id!==currentUser.id&&m.email!==currentUser.email&&<a href={`tel:+221${m.phone}`} style={{background:G.greenLight,color:G.green,borderRadius:8,padding:"5px 9px",fontSize:14,textDecoration:"none"}}>📞</a>}
                        {m.id!==currentUser.id&&m.email!==currentUser.email&&<a href={`https://wa.me/221${m.phone?.replace(/\s+/g,"")}`} target="_blank" rel="noreferrer" style={{background:"#25D366",color:"#FFF",borderRadius:8,padding:"5px 9px",fontSize:14,textDecoration:"none"}}>💬</a>}
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
                        <div style={{fontWeight:700,fontSize:14,color:m.id===currentUser.id?G.green:G.dark}}>🏍️ {m.nom}{m.id===currentUser.id&&<span style={{fontSize:10,color:G.green,marginLeft:6}}>(moi)</span>}</div>
                        {m.id!==currentUser.id&&m.email!==currentUser.email&&<div style={{fontSize:11,color:G.gray,marginTop:2}}>📱 {m.phone} · 📧 {m.email}</div>}
                      </div>
                      {m.id!==currentUser.id&&m.email!==currentUser.email&&<div style={{display:"flex",gap:5,alignItems:"center"}}>
                        <a href={`tel:+221${m.phone}`} style={{background:G.greenLight,color:G.green,borderRadius:8,padding:"5px 9px",fontSize:14,textDecoration:"none"}}>📞</a>
                        <a href={`https://wa.me/221${m.phone?.replace(/\s+/g,"")}`} target="_blank" rel="noreferrer" style={{background:"#25D366",color:"#FFF",borderRadius:8,padding:"5px 9px",fontSize:14,textDecoration:"none"}}>💬</a>
                      </div>}
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:G.green,marginBottom:6}}>{fmt(gains)} FCFA encaissés</div>
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
              const curPlan = PLANS.find(p=>p.key===settings.plan)||PLANS[0];
              const membersUsed = orgMemberCount !== null ? orgMemberCount : (teamMembers.length + 1);
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
                        const link=`https://admirable-gingersnap-0038d8.netlify.app?org=${orgId}&role=${r.role}&token=${token}`;
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

        {/* ── COMPTA ── */}
        {dataReady&&tab==="compta"&&canSeeCompta&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* Sélecteurs — Jour / Mois / Plage */}
            <div style={{background:G.white,borderRadius:12,padding:"12px 14px"}}>
              <div style={{fontSize:11,color:G.gray,fontWeight:600,marginBottom:10}}>📅 PÉRIODE D'ANALYSE</div>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                {[{k:"jour",l:"Jour"},{k:"mois",l:"Mois"},{k:"plage",l:"Plage"}].map(t=>{
                  const active=(t.k==="jour"&&selDate!=="plage"&&selDate!=="mois")||(t.k===selDate);
                  return <button key={t.k} onClick={()=>setSelDate(t.k==="jour"?TODAY:t.k)} style={{flex:1,background:active?G.green:G.grayLight,color:active?G.white:G.gray,border:"none",borderRadius:8,padding:"7px 0",fontSize:11,fontWeight:600,cursor:"pointer"}}>{t.l}</button>;
                })}
              </div>
              {selDate==="plage"&&<div style={{display:"flex",gap:8,alignItems:"center"}}><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{flex:1,border:`1px solid ${G.grayLight}`,borderRadius:8,padding:"7px 10px",fontSize:12,outline:"none"}}/><span style={{fontSize:11,color:G.gray}}>→</span><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{flex:1,border:`1px solid ${G.grayLight}`,borderRadius:8,padding:"7px 10px",fontSize:12,outline:"none"}}/></div>}
              {selDate==="mois"&&<input type="month" value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={{width:"100%",border:`1px solid ${G.grayLight}`,borderRadius:8,padding:"7px 10px",fontSize:12,outline:"none"}}/>}
              {selDate!=="plage"&&selDate!=="mois"&&<input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} style={{width:"100%",border:`1px solid ${G.grayLight}`,borderRadius:8,padding:"7px 10px",fontSize:12,outline:"none"}}/>}
            </div>

            {/* Rapport mensuel */}
            <div style={{background:"linear-gradient(135deg,#1A5C38,#0D3D25)",borderRadius:16,padding:18,color:G.white}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",fontWeight:600,letterSpacing:1,marginBottom:6}}>RAPPORT — {new Date(selMonth+"-01").toLocaleDateString("fr-FR",{month:"long",year:"numeric"}).toUpperCase()}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:700,letterSpacing:1,marginBottom:2}}>BÉNÉFICE NET</div>
              <div style={{fontSize:36,fontWeight:800,color:tBen>=0?G.gold:"#FCA5A5",marginBottom:2}}>{fmt(tBen)} <span style={{fontSize:14,fontWeight:400,opacity:0.8}}>FCFA</span></div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>Marge: {pct(tMarge)} · CA: {fmt(tCA)} FCFA</div>
              <div style={{display:"flex",gap:14,marginTop:14,flexWrap:"wrap"}}>
                {[{l:"CA",v:fmt(tCA)},{l:"CAMV",v:fmt(tCamv)},{l:"Frais",v:fmt(tFrais)},{l:"Pub",v:fmt(tPub)}].map((s,i)=>(
                  <div key={i}><div style={{fontSize:12,fontWeight:700,color:i===0?"rgba(255,255,255,0.9)":G.gold}}>{s.v} F</div><div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>{s.l}</div></div>
                ))}
              </div>
            </div>



            <div style={{background:"#EFF6FF",borderRadius:10,padding:"8px 12px",border:"1px solid #BFDBFE",fontSize:11,color:"#3B82F6"}}>
              ℹ️ CA, CAMV et frais calculés automatiquement. Saisis uniquement pub et livraisons échouées.
            </div>

            {calcProd.map(({prod,nLiv,nRej,ca,camv,frais,echouees,pub,ben,marge})=>(
              <div key={prod.id} style={{background:G.white,borderRadius:14,padding:15,borderLeft:`4px solid ${ben>=0?G.green:G.red}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:G.dark}}>{prod.name}</div>
                    <div style={{display:"flex",gap:6,marginTop:3}}>
                      <span style={{background:G.grayLight,borderRadius:6,padding:"2px 7px",fontSize:10,color:G.gray}}>{prod.niche||prod.categorie}</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:10,color:G.gray}}>Frais livr.</div>
                    <div style={{fontSize:12,fontWeight:600,color:G.gray}}>{fmt(prod.fraisLiv||FRAIS_LIV)} F/cmd</div>
                  </div>
                </div>

                {[
                  {l:"Commandes livrées",        v:nLiv,                c:G.green},
                  {l:"Chiffre d'Affaires",        v:`${fmt(ca)} FCFA`,  c:G.dark},
                  {l:"CAMV (coût produits)",      v:`${fmt(camv)} FCFA`,c:G.dark},
                  {l:"Frais livraison (livrés)",  v:`${fmt(frais)} FCFA`,c:G.dark},
                ].map((r,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${G.grayLight}`}}>
                    <span style={{fontSize:12,color:G.gray}}>{r.l}</span>
                    <span style={{fontSize:12,fontWeight:700,color:r.c}}>{r.v}</span>
                  </div>
                ))}

                {/* Rejetées — info seulement, pas dans la formule */}
                {nRej>0&&(
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${G.grayLight}`}}>
                    <div>
                      <span style={{fontSize:12,color:G.gray}}>Commandes rejetées</span>
                      <div style={{fontSize:10,color:"#9CA3AF",fontStyle:"italic"}}>💡 Info seulement — produit récupéré, non calculé</div>
                    </div>
                    <span style={{background:"#FEE2E2",color:G.red,borderRadius:8,padding:"2px 10px",fontSize:12,fontWeight:700}}>{nRej}</span>
                  </div>
                )}

                {/* Pub du jour */}
                <div style={{marginTop:10,marginBottom:8}}>
                  <div style={{fontSize:11,color:G.gray,marginBottom:4}}>📣 Pub du jour (FCFA)</div>
                  <input type="number" value={adSpend[prod.id]||""} onChange={e=>setAdSpend(p=>({...p,[prod.id]:e.target.value}))} placeholder="0"
                    style={{width:"100%",border:`2px solid ${G.gold}`,borderRadius:8,padding:"8px 12px",fontSize:14,outline:"none",boxSizing:"border-box",fontWeight:600}}/>
                </div>

                {/* Livraisons échouées — champ manuel */}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:G.gray,marginBottom:4}}>🚫 Livraisons échouées — frais supplémentaires (FCFA)
                    <span style={{fontSize:10,color:"#9CA3AF",marginLeft:4}}>ex: re-livraisons, frais retour...</span>
                  </div>
                  <input type="number" value={livraisonsEchouees[prod.id]||""} onChange={e=>setLivraisonsEchouees(p=>({...p,[prod.id]:e.target.value}))} placeholder="0"
                    style={{width:"100%",border:`2px solid ${G.red}`,borderRadius:8,padding:"8px 12px",fontSize:14,outline:"none",boxSizing:"border-box",fontWeight:600,background:livraisonsEchouees[prod.id]?"#FFF5F5":G.white}}/>
                  {livraisonsEchouees[prod.id]&&(
                    <div style={{fontSize:11,color:G.red,marginTop:3}}>
                      💡 Frais échoués déduits du bénéfice: <strong>−{fmt(parseInt(livraisonsEchouees[prod.id]||0))} FCFA</strong>
                    </div>
                  )}
                </div>

                <div style={{background:ben>=0?G.greenLight:"#FEE2E2",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:10,color:G.gray,fontWeight:700}}>BÉNÉFICE NET</div>
                    <div style={{fontSize:22,fontWeight:700,color:ben>=0?G.green:G.red}}>{fmt(ben)} FCFA</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:10,color:G.gray}}>Marge</div>
                    <div style={{fontSize:18,fontWeight:700,color:ben>=0?G.green:G.red}}>{pct(marge)}</div>
                  </div>
                </div>
              </div>
            ))}

            {/* 💵 Cash remis par les livreurs */}
            <div style={{background:G.white,borderRadius:14,padding:16,border:`2px solid ${G.green}`}}>
              <div style={{fontWeight:700,fontSize:14,color:G.green,marginBottom:4}}>💵 Cash remis par les livreurs</div>
              <div style={{fontSize:11,color:G.gray,marginBottom:12}}>Montant total reçu en main propre de tes livreurs aujourd'hui. La différence avec le CA = argent manquant.</div>
              <input type="number" value={cashRemis} onChange={e=>setCashRemis(e.target.value)} placeholder="0"
                style={{width:"100%",border:`2px solid ${G.green}`,borderRadius:10,padding:"12px 14px",fontSize:18,outline:"none",boxSizing:"border-box",fontWeight:700,color:G.dark}}/>
              {cashRemis&&(()=>{
                const recu  = parseInt(cashRemis||0);
                const theo  = calcProd.reduce((a,x)=>a+x.ca,0); // = tCA: somme CA de tous les produits livrés
                const diff  = theo - recu;
                return (
                  <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${G.grayLight}`}}>
                      <span style={{fontSize:12,color:G.gray}}>CA théorique (commandes livrées)</span>
                      <span style={{fontSize:13,fontWeight:700,color:G.dark}}>{fmt(theo)} FCFA</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${G.grayLight}`}}>
                      <span style={{fontSize:12,color:G.gray}}>Cash effectivement reçu</span>
                      <span style={{fontSize:13,fontWeight:700,color:G.green}}>{fmt(recu)} FCFA</span>
                    </div>
                    <div style={{background:diff===0?G.greenLight:diff>0?"#FEE2E2":"#FEF9C3",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:diff===0?G.green:diff>0?G.red:"#854D0E"}}>
                          {diff===0?"✅ Tout est en ordre":diff>0?"⚠️ Montant manquant":"💡 Excédent"}
                        </div>
                        <div style={{fontSize:11,color:G.gray,marginTop:2}}>
                          {diff===0?"Les livreurs ont tout remis":diff>0?"À vérifier avec les livreurs":"Vérifier les commandes"}
                        </div>
                      </div>
                      <div style={{fontSize:20,fontWeight:700,color:diff===0?G.green:diff>0?G.red:"#854D0E"}}>
                        {diff===0?"✓":`${diff>0?"-":"+"}${fmt(Math.abs(diff))} F`}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Total du jour */}
            <div style={{background:tBen>=0?G.green:"#7F1D1D",borderRadius:14,padding:20,textAlign:"center"}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",fontWeight:700,letterSpacing:1}}>BÉNÉFICE NET TOTAL DU JOUR</div>
              <div style={{fontSize:34,fontWeight:700,color:G.white,marginTop:6}}>{fmt(tBen)} FCFA</div>
              <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:10,flexWrap:"wrap"}}>
                {[{l:"CA",v:fmt(tCA)},{l:"CAMV",v:fmt(tCamv)},{l:"Livr.",v:fmt(tFrais)},{l:"Pub",v:fmt(tPub)}].map((s,i)=>(
                  <div key={i} style={{textAlign:"center"}}>
                    <div style={{fontSize:12,fontWeight:700,color:G.white}}>{s.v}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:8,fontSize:13,color:"rgba(255,255,255,0.8)",fontWeight:600}}>Marge globale: {pct(tMarge)}</div>
            </div>

            {/* TABLE EN BAS */}
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <ST>📊 TABLEAU RÉCAP PAR PRODUIT</ST>
              <Tbl
                headers={["Produit","Niche","Livrés","CA","Pub","Bénéfice","Marge"]}
                align={["left","left","right","right","right","right","right"]}
                rows={calcProd.map(({prod,nLiv,ca,pub,ben,marge})=>[
                  <span style={{fontWeight:600,fontSize:11}}>{prod.name}</span>,
                  <span style={{fontSize:10,color:G.gray}}>{prod.niche||prod.categorie}</span>,
                  <span style={{color:G.green,fontWeight:700}}>{nLiv}</span>,
                  fmt(ca),
                  fmt(pub),
                  <span style={{fontWeight:700,color:ben>=0?G.green:G.red}}>{fmt(ben)}</span>,
                  <span style={{fontWeight:700,color:ben>=0?G.green:G.red}}>{pct(marge)}</span>,
                ])}
              />
            </div>

          </div>
        )}

        {/* ── STOCK ── */}
        {dataReady&&tab==="stock"&&(canEditStock)&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:G.dark}}>📦 Gestion des produits</div>
                <div style={{fontSize:11,color:G.gray,marginTop:2}}>Stock = initial − commandes livrées (automatique)</div>
              </div>
              {role==="admin"&&<button onClick={()=>setShowAddProd(true)} style={{background:G.gold,border:"none",borderRadius:9,padding:"8px 12px",fontSize:12,fontWeight:700,color:G.dark,cursor:"pointer"}}>+ Produit</button>}
            </div>

            {/* Alerte stock bas */}
            {products.filter(p=>p.stock<5).length>0&&(
              <div style={{background:"#FEF2F2",borderRadius:12,padding:"10px 14px",border:`1px solid #FCA5A5`}}>
                <div style={{fontSize:12,color:G.red,fontWeight:700}}>⚠️ Stock bas !</div>
                {products.filter(p=>p.stock<5).map(p=><div key={p.id} style={{fontSize:11,color:G.red}}>· {p.name} : {p.stock} restants</div>)}
              </div>
            )}

            {products.map(prod=>{
              const nLiv = orders.filter(o=>o.product?.startsWith(prod.name)&&o.status==="entregado").length;
              const nRej = orders.filter(o=>o.product?.startsWith(prod.name)&&o.status==="rechazado").length;
              const stockInitial = prod.stockInitial||prod.stock+nLiv;
              const stockReel    = Math.max(0, stockInitial - nLiv);
              const pct100 = stockInitial>0?Math.round(stockReel/stockInitial*100):0;
              const qty = stockAjout[prod.id]||"";
              const stockColor = stockReel<5?G.red:stockReel<15?G.gold:G.green;

              return (
                <div key={prod.id} style={{background:G.white,borderRadius:14,padding:15,borderLeft:`4px solid ${stockColor}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>

                  {/* Header: nom + actions */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:15,color:G.dark,marginBottom:2}}>{prod.name}</div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        <span style={{background:G.grayLight,borderRadius:6,padding:"2px 7px",fontSize:10,color:G.gray}}>🎯 {prod.niche||prod.categorie||"—"}</span>
                        <span style={{background:stockReel<5?"#FEE2E2":stockReel<15?"#FFF8E7":G.greenLight,borderRadius:6,padding:"2px 7px",fontSize:10,color:stockColor,fontWeight:600}}>
                          {stockReel} restants
                        </span>
                        {stockReel<5&&<span style={{background:"#FEE2E2",borderRadius:6,padding:"2px 7px",fontSize:10,color:G.red,fontWeight:700}}>⚠️ Stock bas</span>}
                      </div>
                    </div>
                    {/* Boutons modifier/supprimer */}
                    <div style={{display:"flex",gap:5,marginLeft:8,flexShrink:0}}>
                      <button onClick={()=>setEditProd({...prod, nLiv, stockReel})}
                        style={{background:"#EFF6FF",color:G.blue,border:"none",borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                        ✏️ Modifier
                      </button>
                      {/* 🗑️ supprimé de la carte — supprimer via le modal ✏️ Modifier */}
                    </div>
                  </div>

                  {/* Barre stock — discrète */}
                  <div style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:10,color:G.gray}}>Stock: {stockReel} / {stockInitial}</span>
                      <span style={{fontSize:10,color:stockColor,fontWeight:600}}>{pct100}%</span>
                    </div>
                    <div style={{background:G.grayLight,borderRadius:4,height:5,overflow:"hidden"}}>
                      <div style={{background:stockColor,height:5,width:`${pct100}%`,borderRadius:4,transition:"width 0.4s"}}/>
                    </div>
                  </div>

                  {/* Métriques compactes */}
                  <div style={{display:"flex",gap:6,marginBottom:12}}>
                    {[
                      {l:"Livrés",   v:nLiv,    c:G.green},
                      {l:"Coût",     v:`${fmt(prod.cost)}F`,  c:G.gray},
                      {l:"Vente",    v:`${fmt(prod.price)}F`, c:G.dark},
                      {l:"Marge/u",  v:`${fmt(prod.price-prod.cost-(prod.fraisLiv||FRAIS_LIV))}F`, c:G.greenMid},
                    ].map((s,i)=>(
                      <div key={i} style={{flex:1,background:G.grayLight,borderRadius:8,padding:"5px 3px",textAlign:"center"}}>
                        <div style={{fontSize:11,fontWeight:700,color:s.c}}>{s.v}</div>
                        <div style={{fontSize:9,color:G.gray}}>{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Bundles */}
                  {(prod.bundles||[]).length>0&&(
                    <div style={{marginBottom:10,display:"flex",gap:5,flexWrap:"wrap"}}>
                      {prod.bundles.map(b=><span key={b.id} style={{background:"#FFF8E7",color:G.gold,borderRadius:7,padding:"2px 8px",fontSize:10,fontWeight:600}}>🎁 {b.label} — {fmt(b.prixVente)}F</span>)}
                    </div>
                  )}

                  {/* Ajouter stock */}
                  <div style={{background:G.greenLight,borderRadius:9,padding:"9px 12px"}}>
                    <div style={{fontSize:11,color:G.green,fontWeight:700,marginBottom:6}}>➕ Ajouter du stock</div>
                    <div style={{display:"flex",gap:7,alignItems:"center"}}>
                      <input type="number" min="1" value={qty}
                        onChange={e=>setStockAjout(p=>({...p,[prod.id]:e.target.value}))}
                        placeholder="Quantité..."
                        style={{flex:1,border:`1.5px solid ${G.green}`,borderRadius:7,padding:"7px 10px",fontSize:13,outline:"none",boxSizing:"border-box",fontWeight:600}}/>
                      <button onClick={()=>{
                        const q=parseInt(qty||0);
                        if(q<=0) return;
                        setProducts(p=>p.map(x=>x.id===prod.id?{...x,stockInitial:(x.stockInitial||x.stock+nLiv)+q,stock:x.stock+q}:x));
                        if(!String(prod.id).startsWith("tmp_")) sbFetch(`products?id=eq.${prod.id}`,"PATCH",{stock:prod.stock+q,stock_initial:(prod.stockInitial||prod.stock+nLiv)+q});
                        setStockAjout(p=>({...p,[prod.id]:""}));
                      }} style={{background:G.green,color:G.white,border:"none",borderRadius:7,padding:"8px 14px",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}>
                        ✅ OK
                      </button>
                    </div>
                    {qty&&parseInt(qty)>0&&(
                      <div style={{fontSize:10,color:G.green,marginTop:4}}>→ Nouveau total: <strong>{stockReel+parseInt(qty)}</strong> unités</div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Tableau récap */}
            <div style={{background:G.white,borderRadius:14,padding:14}}>
              <ST>📋 RÉCAP STOCK GLOBAL</ST>
              <Tbl headers={["Produit","Restants","Livrés","Coût","Vente","Marge"]} align={["left","right","right","right","right","right"]}
                rows={products.map(p=>{
                  const nL=orders.filter(o=>o.product?.startsWith(p.name)&&o.status==="entregado").length;
                  const si=p.stockInitial||p.stock+nL;
                  const sr=Math.max(0,si-nL);
                  return [p.name,<span style={{fontWeight:700,color:sr<5?G.red:G.green}}>{sr}</span>,<span style={{color:G.greenMid,fontWeight:600}}>{nL}</span>,`${fmt(p.cost)}F`,`${fmt(p.price)}F`,<span style={{color:G.green,fontWeight:700}}>{fmt(p.price-p.cost-p.fraisLiv)}F</span>];
                })}
              />
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {tab==="notifications"&&(()=>{
          // Build grouped notifications
          const NOTIFS_ADMIN = [
            ...orders.filter(o=>o.status==="confirmado"&&!o.livreur).map(o=>({key:`noLiv_${o.id}`,type:"noLiv",icon:"🏍️",title:"Sans livreur",body:o.client,color:"#F0A500",bg:"#FFF8E7",id:o.id,phone:o.phone,time:"à l'instant"})),
            ...orders.filter(o=>o.status==="entregado").slice(-5).map(o=>({key:`liv_${o.id}`,type:"livre",icon:"✅",title:"Encaissé",body:`${o.client} — ${Number(o.price).toLocaleString("fr-FR")} FCFA`,color:G.green,bg:"#D1FAE5",id:o.id,phone:o.phone,time:"aujourd'hui"})),
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
                            {n.price&&<div style={{fontSize:12,color:G.green,fontWeight:700,marginTop:1}}>{Number(n.price).toLocaleString("fr-FR")} FCFA</div>}
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

          const hasBottomBar = role === "admin" || role === "closer";
          // Header ~54px, tab bar ~54px; margin cancels parent padding (14px top, 90/40px bottom)
          const chatH = hasBottomBar ? "calc(100vh - 54px - 54px)" : "calc(100vh - 54px)";
          const chatMargin = hasBottomBar ? "-14px -14px -90px" : "-14px -14px -40px";

          return (
          <div style={{display:"flex",flexDirection:"column",margin:chatMargin,height:chatH,position:"relative"}}>

            {/* Header groupe style WhatsApp */}
            <div style={{background:G.green,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
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
              style={{flex:1,overflowY:"auto",padding:"10px 12px",display:"flex",flexDirection:"column",gap:1,background:"#ECE5DD"}}>
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
                <div style={{textAlign:"center",padding:40,color:"#8a9a8a"}}>
                  <div style={{fontSize:36,marginBottom:8}}>💬</div>
                  <div style={{fontSize:13,fontWeight:600}}>Aucun message</div>
                  <div style={{fontSize:11,marginTop:4}}>Soyez le premier à écrire !</div>
                </div>
              )}
              {chat.map((msg,i)=>{
                // Skip garbled old messages (raw base64 without proper prefix)
                if(!msg.type&&!msg.audio&&msg.text&&(msg.text.startsWith("data:")||(msg.text.length>400&&!/\s/.test(msg.text.slice(0,80))))) return null;
                const isMe = msg.from===myName;
                const canDel = isMe || role==="admin";
                const prevFrom = i>0?chat[i-1].from:null;
                const showAvatar = !isMe && msg.from!==prevFrom;
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
                      {!isMe&&showAvatar&&<div style={{fontSize:11,fontWeight:700,color:rc,marginBottom:3}}>{msg.from}</div>}
                      {msg.type==="image"?(
                        <img src={msg.imgSrc||msg.text} alt="" style={{maxWidth:"100%",maxHeight:200,borderRadius:8,display:"block",objectFit:"cover"}}/>
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
                      ):(
                        <div style={{fontSize:13,lineHeight:1.5,wordBreak:"break-word"}}>{msg.text}</div>
                      )}
                      <div style={{fontSize:10,color:"#8a9a8a",textAlign:"right",marginTop:msg.type==="image"?4:2}}>
                        {msg.time}{isMe&&" ✓✓"}
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
              <div style={{background:G.white,padding:"8px 10px",display:"flex",gap:6,alignItems:"flex-end",flexShrink:0,borderTop:`1px solid #DDD`}}>
                {/* Photo */}
                <label style={{width:38,height:38,borderRadius:"50%",background:"#F3F4F6",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,fontSize:18}}>
                  📷<input type="file" accept="image/*" capture="environment" onChange={sendPhoto} style={{display:"none"}}/>
                </label>
                {/* Input texte */}
                <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendChat()}
                  placeholder="Message…"
                  style={{flex:1,border:"none",borderRadius:22,background:"#F3F4F6",padding:"10px 14px",fontSize:13,outline:"none",resize:"none"}}/>
                {/* Envoyer ou micro */}
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
            )}
          </div>
          );
        })()}
      </div>

      {/* ── MODAL: Ajouter commande ── */}
      {showAdd&&<OrderModal
        products={products} orders={orders} newOrder={newOrder} setNewOrder={setNewOrder}
        addOrder={addOrder} onClose={()=>setShowAdd(false)} G={G} fmt={fmt} FRAIS_LIV={FRAIS_LIV}
        livreurs={teamMembers.filter(m=>m.role==="livreur").map(m=>m.nom).filter(Boolean)} waTemplate={waTemplate} setWaTemplate={setWaTemplate}
        boutique={settings.boutique}
      />}

      {/* ── MODAL: Ajouter produit ── */}
      {showAddProd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:G.white,borderRadius:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"92vh",overflowY:"auto"}}>
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
              {key:"name",      label:"📦 Nom du produit *",             ph:"Chaussures Nike",  type:"text",   req:true},
              {key:"cost",      label:"💰 Prix de revient (FCFA) *",     ph:"7000",             type:"number", req:true},
              {key:"price",     label:"💰 Prix de vente (FCFA) *",       ph:"25000",            type:"number", req:true},
              {key:"stock",     label:"📦 Stock initial *",              ph:"50",               type:"number", req:true},
              {key:"fraisLiv",  label:"🏍️ Frais livraison/cmd (FCFA) *", ph:"1500",             type:"number", req:true},
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
                  <span style={{fontSize:14,fontWeight:700,color:G.green}}>{fmt(parseInt(newProd.price||0)-parseInt(newProd.cost||0)-parseInt(newProd.fraisLiv||1500))} FCFA &nbsp;({pct(parseInt(newProd.price||0)>0?(parseInt(newProd.price||0)-parseInt(newProd.cost||0)-parseInt(newProd.fraisLiv||1500))/parseInt(newProd.price||0):0)})</span>
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
                    const fl=b.livraisonOfferte?0:parseInt(newProd.fraisLiv||1500);
                    const m=b.prixVente-cout-fl;
                    const TN={quantite:"Pack Qté",bxgyf:"Buy X Get Y",kit:"Kit"};
                    return (
                      <div key={i} style={{background:G.grayLight,borderRadius:10,padding:"10px 12px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div>
                          <div style={{fontWeight:600,fontSize:13,color:G.dark}}>{b.label} <span style={{fontSize:10,color:G.gray,fontWeight:400}}>({TN[b.type]||b.type})</span></div>
                          <div style={{fontSize:11,color:G.gray,marginTop:2}}>
                            {b.qte}u{b.type==="bxgyf"?` + ${b.qteOfferte} offert`:""} · {fmt(b.prixVente)} FCFA
                            {b.livraisonOfferte?" · 🚚 offerte":""}
                          </div>
                          <div style={{fontSize:11,fontWeight:600,color:m>=0?G.green:G.red,marginTop:2}}>Marge: {fmt(m)} FCFA</div>
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
                      <div style={{fontSize:11,color:bundleErrors.prixVente?G.red:G.gray,fontWeight:bundleErrors.prixVente?700:400}}>Prix vente (FCFA) *</div>
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
                  return <div style={{fontSize:12,color:m>=0?G.green:G.red,fontWeight:600,marginBottom:8}}>Marge estimée: {fmt(m)} FCFA ({pct(parseInt(newBundleForm.prixVente||0)>0?m/parseInt(newBundleForm.prixVente):0)})</div>;
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
              <button onClick={()=>{setShowAddProd(false);setNewProd({name:"",cost:"",price:"",stock:"",fraisLiv:"1500",niche:"",bundles:[]});setProdErrors({});}} style={{flex:1,background:G.grayLight,color:G.gray,border:"none",borderRadius:10,padding:12,cursor:"pointer",fontSize:13}}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Créer bundel ── */}
      {showAddBundle&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:G.white,borderRadius:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"90vh",overflowY:"auto"}}>
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
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>💰 Prix de vente bundel (FCFA)</div>
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
                <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}><span style={{fontSize:12,color:G.gray}}>Coût ({qr} unités)</span><span style={{fontWeight:700}}>{fmt(c)} FCFA</span></div>
                <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:G.gray}}>Frais livraison</span><span style={{fontWeight:700}}>{newBundle.livraisonOfferte?"Offerte":fmt(fl)+" FCFA"}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",paddingTop:6,borderTop:`1px solid ${m>=0?"#BBF7D0":"#FCA5A5"}`,marginTop:4}}><span style={{fontSize:13,fontWeight:700}}>Marge nette</span><span style={{fontSize:16,fontWeight:700,color:m>=0?G.green:G.red}}>{fmt(m)} FCFA ({pct(parseInt(newBundle.prixVente||0)>0?m/parseInt(newBundle.prixVente):0)})</span></div>
              </div>;
            })()}
            <button onClick={addBundle} style={{width:"100%",background:G.green,color:G.white,border:"none",borderRadius:10,padding:12,fontWeight:700,fontSize:14,cursor:"pointer",marginBottom:8}}>Créer le bundel</button>
            <button onClick={()=>setShowAddBundle(false)} style={{width:"100%",background:"none",border:"none",color:G.gray,padding:8,cursor:"pointer",fontSize:13}}>Annuler</button>
          </div>
        </div>
      )}

      {/* ── MODAL: Paramètres ── */}
      {showSettings&&(
        <div onClick={()=>setShowSettings(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:G.white,borderRadius:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"90vh",overflowY:"auto"}}>
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
              const curPlan = PLANS.find(p=>p.key===settings.plan)||PLANS[0];
              const membersUsed = orgMemberCount !== null ? orgMemberCount : (teamMembers.length + 1);
              const atLimit = curPlan.maxMembers && membersUsed >= curPlan.maxMembers;
              return (
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:12,fontWeight:700,color:G.gray,marginBottom:10,letterSpacing:0.5}}>MON PLAN</div>
                  <div style={{background:curPlan.bg,borderRadius:12,padding:"14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                      <div>
                        <div style={{fontWeight:800,fontSize:15,color:curPlan.color}}>{curPlan.name}</div>
                        <div style={{fontSize:12,color:G.gray,marginTop:2}}>{curPlan.price} FCFA / mois</div>
                      </div>
                      <button onClick={()=>setShowPlanModal(true)} style={{background:curPlan.color,color:G.white,border:"none",borderRadius:8,padding:"7px 13px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Changer →</button>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {curPlan.features.map((f,i)=><div key={i} style={{fontSize:11,color:G.gray}}>✓ {f}</div>)}
                    </div>
                    <div style={{marginTop:10,background:"rgba(0,0,0,0.05)",borderRadius:8,padding:"8px 10px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span style={{fontSize:11,color:G.gray,fontWeight:600}}>Membres</span>
                        <span style={{fontSize:11,fontWeight:700,color:atLimit?G.red:curPlan.color}}>{membersUsed} / {curPlan.maxMembers||"∞"}</span>
                      </div>
                      {curPlan.maxMembers&&<div style={{background:"rgba(0,0,0,0.08)",borderRadius:4,height:5}}><div style={{background:atLimit?G.red:curPlan.color,borderRadius:4,height:5,width:`${Math.min(100,membersUsed/curPlan.maxMembers*100)}%`,transition:"width 0.4s"}}/></div>}
                      {atLimit&&<div style={{fontSize:10,color:G.red,marginTop:4,fontWeight:600}}>⚠️ Limite atteinte — passe au plan supérieur</div>}
                    </div>
                  </div>
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
                      <button onClick={()=>setConfirmModal({msg:`Retirer ${m.nom} de l'équipe ?`,sub:"Le membre perdra l'accès immédiatement.",danger:true,onConfirm:()=>{sbFetch(`profiles?id=eq.${m.id}`,"DELETE").catch(()=>{});setTeamMembers(p=>p.filter(x=>x.id!==m.id));addToast(`${m.nom} retiré de l'équipe`,"✅",G.green);}})}
                        style={{background:"#FEE2E2",color:G.red,border:"none",borderRadius:8,padding:"5px 10px",fontSize:13,cursor:"pointer",fontWeight:700}}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
              {(()=>{
                const curPlan = PLANS.find(p=>p.key===settings.plan)||PLANS[0];
                const membersUsed = orgMemberCount !== null ? orgMemberCount : (teamMembers.length + 1);
                const atLimit = curPlan.maxMembers && membersUsed >= curPlan.maxMembers;
                const canInvite = orgMemberCount !== null && !atLimit;
                return (<>
                  {canInvite&&<div style={{marginTop:10,display:"flex",gap:6}}>
                    {[{role:"closer",label:"📞 Inviter Closer"},{role:"livreur",label:"🏍️ Inviter Livreur"}].map(r=>(
                      <button key={r.role} onClick={()=>{const token=Math.random().toString(36).substring(2,10).toUpperCase();const link=`https://admirable-gingersnap-0038d8.netlify.app?org=${orgId}&role=${r.role}&token=${token}`;window.open(`https://wa.me/?text=${encodeURIComponent(`Bonjour ! Rejoins mon équipe sur Teamly:\n${link}`)}`,"_blank");}}
                        style={{flex:1,background:"#25D366",color:G.white,border:"none",borderRadius:9,padding:"9px 0",fontSize:11,fontWeight:700,cursor:"pointer"}}>{r.label} 📲</button>
                    ))}
                  </div>}
                </>);
              })()}
            </div>

            {/* Permissions Closer */}
            <div style={{marginBottom:18}}>
              <div style={{fontSize:12,fontWeight:700,color:G.gray,marginBottom:4,letterSpacing:0.5}}>🔐 PERMISSIONS CLOSER</div>
              <div style={{fontSize:11,color:G.gray,marginBottom:12}}>Définit ce que les Closers peuvent faire par défaut</div>
              <div style={{background:settings.closerFullControl?"#FEF3C7":"#F9FAFB",borderRadius:12,padding:"12px 14px",marginBottom:10,border:`1.5px solid ${settings.closerFullControl?"#F59E0B":G.grayLight}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:13,fontWeight:700,color:G.dark}}>👑 Contrôle total</div><div style={{fontSize:11,color:G.gray,marginTop:1}}>Le Closer a les mêmes droits que l'Admin</div></div>
                  <button onClick={()=>setSettings(s=>({...s,closerFullControl:!s.closerFullControl,closerCompta:!s.closerFullControl,closerSettings:!s.closerFullControl,closerDeleteOrder:!s.closerFullControl,closerManageTeam:!s.closerFullControl,closerManageProducts:!s.closerFullControl}))}
                    style={{background:settings.closerFullControl?"#F59E0B":G.grayLight,border:"none",borderRadius:20,width:44,height:24,cursor:"pointer",position:"relative",flexShrink:0,transition:"background 0.2s"}}>
                    <div style={{position:"absolute",top:2,left:settings.closerFullControl?22:2,width:20,height:20,background:G.white,borderRadius:"50%",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
                  </button>
                </div>
              </div>
              {[{key:"closerCompta",label:"📊 Voir la comptabilité",desc:"Revenus, bénéfices, statistiques"},{key:"closerManageProducts",label:"📦 Gérer produits & stock",desc:"Ajouter, modifier, supprimer des produits"},{key:"closerDeleteOrder",label:"🗑️ Supprimer des commandes",desc:"Effacer définitivement une commande"},{key:"closerManageTeam",label:"👥 Gérer l'équipe",desc:"Inviter et supprimer des membres"},{key:"closerSettings",label:"⚙️ Accès aux paramètres",desc:"Modifier les paramètres de la boutique"}].map(n=>(
                <div key={n.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${G.grayLight}`,opacity:settings.closerFullControl?0.5:1}}>
                  <div><div style={{fontSize:13,fontWeight:600,color:G.dark}}>{n.label}</div><div style={{fontSize:11,color:G.gray,marginTop:1}}>{n.desc}</div></div>
                  <button onClick={()=>!settings.closerFullControl&&setSettings(s=>({...s,[n.key]:!s[n.key]}))}
                    style={{background:settings[n.key]||settings.closerFullControl?G.green:G.grayLight,border:"none",borderRadius:20,width:44,height:24,cursor:settings.closerFullControl?"default":"pointer",position:"relative",flexShrink:0,transition:"background 0.2s"}}>
                    <div style={{position:"absolute",top:2,left:(settings[n.key]||settings.closerFullControl)?22:2,width:20,height:20,background:G.white,borderRadius:"50%",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
                  </button>
                </div>
              ))}
              <div style={{background:G.greenLight,borderRadius:10,padding:"10px 12px",marginTop:10,fontSize:11,color:G.green}}>✅ Par défaut le Closer peut toujours : créer des commandes, confirmer boutique → traiter, assigner un livreur, modifier une commande</div>
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
            <button onClick={()=>setShowSettings(false)} style={{width:"100%",background:G.green,color:G.white,border:"none",borderRadius:10,padding:12,fontWeight:600,fontSize:13,cursor:"pointer"}}>
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
              setCurrentUser(u=>({...u,nom:profileEdit.nom,phone:profileEdit.phone,birthday:profileEdit.birthday}));
              try{localStorage.setItem("teamly_nom",profileEdit.nom);}catch(e){}
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
          </div>
        </div>
      )}

      {/* ── MODAL: Changer de plan ── */}
      {showPlanModal&&(
        <div onClick={()=>setShowPlanModal(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:600,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:G.white,borderRadius:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
              <div style={{width:40,height:4,borderRadius:2,background:G.grayLight}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontWeight:800,fontSize:16,color:G.dark}}>Changer de plan</div>
              <button onClick={()=>setShowPlanModal(false)} style={{background:"none",border:"none",fontSize:20,color:G.gray,cursor:"pointer",lineHeight:1,padding:"0 4px"}}>×</button>
            </div>
            <div style={{fontSize:12,color:G.gray,marginBottom:18}}>Choisis le plan adapté à ton équipe</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
              {PLANS.map(p=>{
                const isCurrent = settings.plan===p.key;
                return (
                  <button key={p.key} onClick={()=>{
                    setSettings(s=>({...s,plan:p.key}));
                    if(orgId) sbFetch(`organizations?id=eq.${orgId}`,"PATCH",{plan:p.key}).catch(()=>{});
                    setShowPlanModal(false);
                    addToast(`Plan ${p.name} activé ✅`,"✅",p.color);
                  }} style={{background:isCurrent?p.bg:G.white,border:`2px solid ${isCurrent?p.color:G.grayLight}`,borderRadius:14,padding:"14px 16px",cursor:"pointer",textAlign:"left",position:"relative"}}>
                    {isCurrent&&<div style={{position:"absolute",top:12,right:12,background:p.color,color:"#FFF",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>ACTUEL</div>}
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <div>
                        <div style={{fontWeight:800,fontSize:15,color:p.color}}>{p.name}</div>
                        <div style={{fontSize:13,fontWeight:700,color:G.dark}}>{p.price} FCFA <span style={{fontSize:11,color:G.gray,fontWeight:400}}>/ mois</span></div>
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {p.features.map((f,i)=><div key={i} style={{fontSize:11,color:G.gray}}>✓ {f}</div>)}
                      <div style={{fontSize:11,color:p.color,fontWeight:700,marginTop:4}}>
                        👥 {p.maxMembers?`${p.maxMembers} membres max`:"Membres illimités"} · 📦 {p.maxOrders?`${p.maxOrders} commandes/mois`:"Commandes illimitées"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={()=>setShowPlanModal(false)}
              style={{width:"100%",background:G.grayLight,color:G.gray,border:"none",borderRadius:10,padding:12,fontWeight:600,fontSize:13,cursor:"pointer"}}>
              Annuler
            </button>
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

      {/* ── MODAL: GPS Prompt Livreur ── */}
      {showGpsPrompt&&role==="livreur"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:G.white,borderRadius:"20px 20px 0 0",padding:28,width:"100%",maxWidth:480}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:52,marginBottom:10}}>📍</div>
              <div style={{fontWeight:800,fontSize:18,color:G.dark,marginBottom:6}}>Activer le GPS ?</div>
              <div style={{fontSize:13,color:G.gray,lineHeight:1.6}}>
                L'Admin peut suivre vos livraisons en temps réel.<br/>
                Votre position ne sera partagée que pendant les livraisons.
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={()=>{
                setShowGpsPrompt(false);
                setTab("position");
              }} style={{width:"100%",background:G.green,color:G.white,border:"none",borderRadius:14,padding:"15px 0",fontWeight:800,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{fontSize:20}}>📍</span> Activer le GPS
              </button>
              <button onClick={()=>setShowGpsPrompt(false)}
                style={{width:"100%",background:G.grayLight,color:G.gray,border:"none",borderRadius:14,padding:"12px 0",fontWeight:600,fontSize:13,cursor:"pointer"}}>
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Nouvelle livraison assignée (Livreur) ── */}
      {newAssignment&&role==="livreur"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:G.white,borderRadius:"24px 24px 0 0",padding:28,width:"100%",maxWidth:480,boxShadow:"0 -8px 40px rgba(0,0,0,0.3)"}}>
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
                <span style={{fontSize:24,fontWeight:800,color:G.gold}}>{Number(newAssignment.price).toLocaleString("fr-FR")} FCFA</span>
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
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:G.white,borderRadius:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontWeight:700,fontSize:16,color:G.green,marginBottom:16}}>✏️ Modifier la commande #{editOrder.id}</div>

            {[
              {key:"client",  label:"👤 Nom client",  ph:"Moussa Diallo",    type:"text"},
              {key:"phone",   label:"📱 Téléphone",    ph:"77 123 45 67",     type:"text"},
              {key:"address", label:"📍 Adresse",      ph:"Médina, Dakar",    type:"text"},
              {key:"product", label:"📦 Produit",      ph:"Chaussures Nike",  type:"text"},
              {key:"price",   label:"💰 Prix COD (FCFA)", ph:"25000",         type:"number"},
            ].map(f=>(
              <div key={f.key} style={{marginBottom:10}}>
                <div style={{fontSize:11,color:G.gray,marginBottom:3}}>{f.label}</div>
                <input type={f.type} value={editOrder[f.key]||""} onChange={e=>setEditOrder(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}
                  style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}

            <div style={{marginBottom:10}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3}}>📊 Statut</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {Object.entries(STATUS).map(([k,v])=>(
                  <button key={k} onClick={()=>setEditOrder(p=>({...p,status:k}))}
                    style={{background:editOrder.status===k?v.bg:"#F4F4F4",color:editOrder.status===k?v.color:G.gray,border:`2px solid ${editOrder.status===k?v.color:G.grayLight}`,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    {v.label}
                  </button>
                ))}
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
              <button onClick={()=>{
                setOrders(o=>o.map(x=>x.id===editOrder.id?{...x,...editOrder,price:parseInt(editOrder.price)||x.price}:x));
                setEditOrder(null);
              }} style={{flex:1,background:G.green,color:G.white,border:"none",borderRadius:10,padding:12,fontWeight:700,fontSize:13,cursor:"pointer"}}>
                ✅ Enregistrer
              </button>
              <button onClick={()=>setConfirmModal({
                  msg:"Supprimer cette commande définitivement ?",
                  sub:"Cette action est irréversible.",
                  danger:true,
                  onConfirm:()=>{ setOrders(o=>o.filter(x=>x.id!==editOrder.id)); setEditOrder(null); }
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
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:G.white,borderRadius:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{fontWeight:700,fontSize:16,color:G.green,marginBottom:4}}>✏️ Modifier le produit</div>
            <div style={{fontSize:11,color:G.gray,marginBottom:16}}>{editProd.name}</div>

            {[
              {key:"name",     label:"📦 Nom du produit *",           type:"text",   ph:"Chaussures Nike"},
              {key:"cost",     label:"💰 Prix de revient (FCFA) *",   type:"number", ph:"7000"},
              {key:"price",    label:"💰 Prix de vente (FCFA) *",     type:"number", ph:"25000"},
              {key:"fraisLiv", label:"🏍️ Frais livraison (FCFA) *",  type:"number", ph:"1500"},
            ].map(f=>(
              <div key={f.key} style={{marginBottom:10}}>
                <div style={{fontSize:11,color:G.gray,marginBottom:3}}>{f.label}</div>
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
                  {fmt(parseInt(editProd.price||0)-parseInt(editProd.cost||0)-(parseInt(editProd.fraisLiv||1500)))} FCFA
                </span>
              </div>
            )}

            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{
                setProducts(p=>p.map(x=>x.id===editProd.id?{
                  ...x,
                  name:editProd.name||x.name,
                  cost:parseInt(editProd.cost)||x.cost,
                  price:parseInt(editProd.price)||x.price,
                  fraisLiv:parseInt(editProd.fraisLiv)||x.fraisLiv,
                  niche:editProd.niche||x.niche,
                  stock:parseInt(editProd.stock)||x.stock,
                  stockInitial:parseInt(editProd.stock)||x.stockInitial,
                }:x));
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
        const steps=["confirmado","livreur_en_route","colis_pris","en_camino","chez_client","entregado"];
        const icons=["✅","🏍️","📦","🚀","📍","✓"];
        const cur=steps.indexOf(o.status);
        const isEntregado=o.status==="entregado";
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setOrderDetail(null)}>
            <div onClick={e=>e.stopPropagation()} style={{background:G.white,borderRadius:"24px 24px 0 0",padding:24,width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto"}}>
              <div style={{width:40,height:4,background:G.grayLight,borderRadius:2,margin:"0 auto 20px"}}/>
              <div style={{background:st.bg,borderRadius:14,padding:16,textAlign:"center",marginBottom:16,border:`2px solid ${st.color}`}}>
                <div style={{fontSize:32,marginBottom:4}}>{isEntregado?"✅":o.status==="rechazado"?"❌":o.status==="en_camino"?"🚀":o.status==="chez_client"?"📍":"📦"}</div>
                <div style={{fontSize:18,fontWeight:800,color:st.color}}>{st.label}</div>
                {isEntregado&&<div style={{fontSize:13,color:G.green,marginTop:4,fontWeight:600}}>💵 Cash encaissé</div>}
              </div>
              {cur>=0&&(
                <div style={{display:"flex",alignItems:"center",marginBottom:16}}>
                  {icons.map((ico,i)=>{
                    const done=isEntregado||i<cur; const active=!isEntregado&&i===cur;
                    return (
                      <div key={i} style={{display:"flex",alignItems:"center",flex:i<5?1:0}}>
                        <div style={{width:30,height:30,borderRadius:"50%",background:done?G.green:active?"#F0A500":G.grayLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:i===5?14:11,color:done||active?G.white:"#9CA3AF",flexShrink:0,fontWeight:800,border:`2px solid ${done?"#6EE7B7":active?"#F0A500":"#E5E7EB"}`}}>
                          {i===5?"✓":ico}
                        </div>
                        {i<5&&<div style={{flex:1,height:3,background:done?G.green:G.grayLight,borderRadius:2}}/>}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{marginBottom:14}}>
                <div style={{fontWeight:800,fontSize:20,color:G.dark,marginBottom:8}}>{o.client}</div>
                <a href={`tel:+221${(o.phone||"").replace(/\s+/g,"")}`} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,textDecoration:"none"}}>
                  <span style={{fontSize:16}}>📱</span><span style={{fontSize:15,color:G.blue,fontWeight:700}}>{o.phone}</span>
                </a>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>📍</span><span style={{fontSize:14,color:G.dark}}>{o.address}</span>
                </div>
              </div>
              <div style={{background:G.greenLight,borderRadius:12,padding:"14px 16px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:11,color:G.gray}}>📦 Produit</div>
                  <div style={{fontSize:15,fontWeight:700,color:G.dark,marginTop:2}}>{o.product}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:11,color:G.gray}}>Montant COD</div>
                  <div style={{fontSize:24,fontWeight:800,color:G.green}}>{Number(o.price).toLocaleString("fr-FR")} F</div>
                </div>
              </div>
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
                {(role==="admin"||(role==="closer"&&(pC.closerFullControl||settings.closerModify)))&&(
                  <button onClick={()=>{setOrderDetail(null);setEditOrder({...o});}}
                    style={{width:"100%",background:"#EFF6FF",color:G.blue,border:"none",borderRadius:12,padding:"14px 0",fontWeight:700,fontSize:15,cursor:"pointer"}}>
                    ✏️ Modifier la commande
                  </button>
                )}
                {role==="admin"&&(
                  <button onClick={()=>{setOrderDetail(null);setConfirmModal({msg:`Supprimer la commande de ${o.client} ?`,sub:"Action irréversible.",danger:true,onConfirm:()=>setOrders(p=>p.filter(x=>x.id!==o.id))});}}
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
            {confirmModal.sub&&<div style={{fontSize:12,color:G.gray,marginBottom:20}}>{confirmModal.sub}</div>}
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
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:G.white,borderRadius:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto"}}>
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
        const canConfirm = !!assignSelLiv;
        return (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
          onClick={()=>setAssignLivreurModal(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:G.white,borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxWidth:480,maxHeight:"88vh",overflowY:"auto",paddingBottom:"calc(20px + env(safe-area-inset-bottom,0px))"}}>
            <div style={{width:36,height:4,background:"#E5E7EB",borderRadius:2,margin:"0 auto 16px"}}/>

            {/* Header commande */}
            <div style={{background:"#FFF8E7",borderRadius:12,padding:"12px 14px",marginBottom:16,borderLeft:"4px solid #F59E0B"}}>
              <div style={{fontWeight:700,fontSize:14,color:G.dark}}>{o.client}</div>
              <div style={{fontSize:12,color:G.gray,marginTop:2}}>📦 {o.product} · <b style={{color:"#D97706"}}>{Number(o.price).toLocaleString("fr-FR")} FCFA</b></div>
              {o.address&&<div style={{fontSize:11,color:G.gray,marginTop:2}}>📍 {o.address}</div>}
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

            {/* Bouton confirmer */}
            <button disabled={!canConfirm} onClick={()=>{
              upSt(o.id, assignDelStatus);
              upLiv(o.id, assignSelLiv.id);
              addToast(`${o.client} → ${assignSelLiv.nom} ✅`,"✅",G.green);
              setAssignLivreurModal(null);
            }} style={{width:"100%",background:canConfirm?G.green:"#D1D5DB",color:"#fff",border:"none",borderRadius:12,padding:"14px 0",fontWeight:700,fontSize:15,cursor:canConfirm?"pointer":"not-allowed",transition:"background .2s"}}>
              {canConfirm?`✅ Confirmer → ${assignSelLiv.nom}`:"Sélectionne un livreur pour continuer"}
            </button>

            {/* Sans livreur (secondaire) */}
            <button onClick={()=>{
              upSt(o.id,"confirmado");
              addToast(`${o.client} → Cmd à traiter (sans livreur)`,"📦","#D97706");
              setAssignLivreurModal(null);
            }} style={{width:"100%",background:"none",color:G.gray,border:"none",padding:"12px 0",fontWeight:500,fontSize:12,cursor:"pointer",marginTop:4}}>
              Confirmer sans livreur pour l'instant
            </button>
          </div>
        </div>
        );
      })()}
      {/* ── BOTTOM TAB BAR (admin / closer) ── */}
      {(role==="admin"||(role==="closer"))&&sbReady&&(()=>{
        const boutiqueCnt = orders.filter(o=>o.status==="boutique").length;
        const commandesCnt = orders.filter(o=>o.status==="confirmado"&&!o.livreur&&(role!=="closer"||o.closer_id!==currentUser.id)).length;
        const canCompta = role==="admin"||(role==="closer"&&(pC.closerCompta||pC.closerFullControl));
        const allTabs=[
          {k:"boutique",  label:"Boutique",  badge:boutiqueCnt,  badgeColor:G.gold,    badgeTxt:G.dark,
            icon:(c)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>},
          {k:"commandes", label:"À traiter", badge:commandesCnt, badgeColor:"#EF4444", badgeTxt:"#fff",
            icon:(c)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>},
          {k:"dashboard", label:"Dashboard", badge:alertCount,   badgeColor:G.red,     badgeTxt:"#fff",
            icon:(c)=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>},
          {k:"compta",    label:"Compta",    badge:0,            badgeColor:"",         badgeTxt:"", show:canCompta,
            icon:(c)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>},
          {k:"equipe",    label:"Équipe",    badge:0,            badgeColor:"",         badgeTxt:"",
            icon:(c)=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>},
        ];
        const tabs = allTabs.filter(t=>t.show!==false);
        return (
          <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:G.white,borderTop:"1px solid #E5E7EB",boxShadow:"0 -4px 20px rgba(0,0,0,0.08)",display:"flex",alignItems:"flex-end",zIndex:150,paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
            {tabs.map((t,i)=>{
              const active = tab===t.k;
              const isCenter = t.k==="dashboard" && i===Math.floor(tabs.length/2);
              return (
                <button key={t.k} onClick={()=>setTab(t.k)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:isCenter?"0 0 10px":"8px 0 10px",background:"none",border:"none",cursor:"pointer",position:"relative",outline:"none"}}>
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
                      {t.badge>0&&<span style={{position:"absolute",top:4,right:"calc(50% - 18px)",background:t.badgeColor,color:t.badgeTxt,borderRadius:"50%",width:16,height:16,fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",zIndex:1}}>{t.badge}</span>}
                      {t.icon(active?G.green:"#9CA3AF")}
                      <span style={{fontSize:9,fontWeight:active?700:400,color:active?G.green:"#9CA3AF",marginTop:3,letterSpacing:0.2}}>{t.label}</span>
                      {active&&<div style={{position:"absolute",bottom:0,width:24,height:2.5,background:G.green,borderRadius:2}}/>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
