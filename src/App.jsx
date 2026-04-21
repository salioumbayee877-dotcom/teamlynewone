import { useState, useEffect, useRef } from "react";
import { supabase, fromDb, toDb } from './lib/supabase';

const PRODUCTS = [
  { id: 1, name: "Bouton de volant", sku: "BV-001", price: 8500, cost: 2200, stock: 45, bundles: [{ qty: 2, price: 15000 }] },
  { id: 2, name: "Organisateur bijoux", sku: "OB-002", price: 6000, cost: 1500, stock: 30, bundles: [{ qty: 3, price: 15000 }] },
  { id: 3, name: "Vernis à ongles (set)", sku: "VN-003", price: 4500, cost: 1200, stock: 80, bundles: [{ qty: 4, price: 16000 }] },
  { id: 4, name: "Ceinture LED", sku: "CL-004", price: 7000, cost: 1800, stock: 20, bundles: [] },
];
const CLOSERS = ["Fatou Ba", "Ibrahima Sow", "Aminata Diallo", "Serigne Mbaye"];
const LIVREURS = ["Moussa Fall", "Cheikh Ndiaye", "Omar Sarr"];
const CITIES = ["Dakar", "Pikine", "Guédiawaye", "Rufisque", "Thiès", "Mbour", "Ziguinchor"];
const DELIVERY_COST = 1500;
const STATUSES = {
  pending:   { label: "En attente",  color: "bg-yellow-100 text-yellow-700" },
  confirmed: { label: "Confirmé",    color: "bg-blue-100 text-blue-700" },
  shipped:   { label: "Expédié",     color: "bg-purple-100 text-purple-700" },
  delivered: { label: "Livré",       color: "bg-green-100 text-green-700" },
  returned:  { label: "Retourné",    color: "bg-orange-100 text-orange-700" },
  cancelled: { label: "Annulé",      color: "bg-red-100 text-red-700" },
};

const mkO = (id, client, phone, prodId, qty, city, status, closer, livreur, date, adSpend, isBundle) => {
  const p = PRODUCTS.find(x => x.id === prodId);
  const b = isBundle && p.bundles[0];
  const price = b ? b.price : p.price * qty;
  return { id: `CMD-${String(id).padStart(3,"0")}`, client, phone, prodId, qty: b ? b.qty : qty, price, city, status, closer, livreur, date, adSpend, isBundle: !!b, note: "" };
};

const INIT_ORDERS = [
  mkO(1,"Mamadou Diallo","77 231 4512",1,1,"Dakar","delivered","Fatou Ba","Moussa Fall","2026-04-14",800,false),
  mkO(2,"Awa Ndiaye","78 456 7890",2,1,"Pikine","delivered","Ibrahima Sow","Cheikh Ndiaye","2026-04-14",600,false),
  mkO(3,"Ousmane Faye","76 123 9988",1,2,"Dakar","delivered","Fatou Ba","Moussa Fall","2026-04-15",900,true),
  mkO(4,"Mariama Bâ","77 888 1234",3,4,"Thiès","shipped","Aminata Diallo","Omar Sarr","2026-04-16",500,true),
  mkO(5,"Ibou Thiam","78 321 6543",2,1,"Dakar","confirmed","Serigne Mbaye",null,"2026-04-17",400,false),
  mkO(6,"Rokhaya Seck","77 999 0012",4,1,"Mbour","pending","Fatou Ba",null,"2026-04-18",700,false),
  mkO(7,"Abdou Cissé","76 777 3456",1,1,"Rufisque","returned","Ibrahima Sow","Cheikh Ndiaye","2026-04-16",800,false),
  mkO(8,"Ndeye Diop","77 543 2109",3,1,"Dakar","pending","Aminata Diallo",null,"2026-04-18",300,false),
  mkO(9,"Lamine Koné","78 112 3344",2,1,"Guédiawaye","confirmed","Fatou Ba",null,"2026-04-19",550,false),
  mkO(10,"Coumba Gaye","77 654 3210",1,1,"Dakar","delivered","Serigne Mbaye","Omar Sarr","2026-04-19",650,false),
];
let oCnt = INIT_ORDERS.length + 1;

const IC = ({ n, c = "w-5 h-5" }) => {
  const d = {
    dashboard: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    orders:    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    stock:     "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    compta:    "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
    delivery:  "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0",
    plus:      "M12 4v16m8-8H4",
    logout:    "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
    check:     "M5 13l4 4L19 7",
    x:         "M6 18L18 6M6 6l12 12",
    edit:      "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    clients:   "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  };
  return <svg xmlns="http://www.w3.org/2000/svg" className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={d[n]} /></svg>;
};

const Badge = ({ status }) => {
  const s = STATUSES[status] || STATUSES.pending;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
};

const KpiCard = ({ label, value, sub, col = "green" }) => {
  const bg = { green:"bg-emerald-500", indigo:"bg-emerald-500", yellow:"bg-yellow-500", red:"bg-red-500" };
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className={`w-7 h-7 rounded-lg ${bg[col]} mb-3`} />
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
};

// ── Utilidad: exportar array a CSV y descargarlo ──────────────────────────
const exportCSV = (rows, filename) => {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(';'),
    ...rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(';')),
  ].join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
};

// ── Notificaciones toast ──────────────────────────────────────────────────
function ToastContainer({ toasts }) {
  const bg = { success:'bg-emerald-500', error:'bg-red-500', info:'bg-emerald-600', warning:'bg-yellow-500' };
  if (!toasts.length) return null;
  return (
    <div className="fixed top-4 right-4 z-[400] flex flex-col gap-2 pointer-events-none w-72">
      {toasts.map(t => (
        <div key={t.id} className={`${bg[t.type] || bg.info} text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium flex items-start gap-2`}>
          <span className="mt-0.5">{t.icon || '🔔'}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message === "Invalid login credentials" ? "Email ou mot de passe incorrect" : err.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-green-900 to-emerald-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-1">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center"><span className="text-emerald-700 font-black text-lg">T</span></div>
            <span className="text-white text-3xl font-black">Teamly</span>
          </div>
          <p className="text-emerald-300 text-sm">Plateforme e-commerce COD · Sénégal</p>
        </div>
        <div className="bg-white/10 border border-white/20 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-200 rounded-lg px-3 py-2.5 text-sm flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}
          <div>
            <label className="text-emerald-200 text-xs font-medium mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="admin@teamly.sn"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="text-emerald-200 text-xs font-medium mb-1.5 block">Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="••••••••"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <button onClick={handleSubmit} disabled={!email || !password || loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all mt-2">
            {loading ? "Connexion en cours..." : "Se connecter →"}
          </button>
        </div>
        <p className="text-white/30 text-center text-xs mt-6">Accès réservé à l'équipe Teamly</p>
      </div>
    </div>
  );
}

function Sidebar({ role, view, setView, usr, onLogout, pendingCount = 0 }) {
  const nav = {
    admin:   [{id:"dashboard",label:"Dashboard",icon:"dashboard"},{id:"orders",label:"Commandes",icon:"orders"},{id:"stock",label:"Stock",icon:"stock"},{id:"compta",label:"Compta",icon:"compta"},{id:"clients",label:"Clients",icon:"clients"}],
    closer:  [{id:"dashboard",label:"Dashboard",icon:"dashboard"},{id:"new_order",label:"Nouvelle commande",icon:"plus"},{id:"orders",label:"Mes commandes",icon:"orders"}],
    livreur: [{id:"dashboard",label:"Dashboard",icon:"dashboard"},{id:"deliveries",label:"Mes livraisons",icon:"delivery"}],
  };
  const rCol = { admin:"from-emerald-600 to-green-600", closer:"from-emerald-500 to-teal-500", livreur:"from-green-600 to-emerald-600" };
  const rLbl = { admin:"Admin", closer:"Closer", livreur:"Livreur" };
  return (
    <div className="w-52 bg-gray-900 flex flex-col h-screen flex-shrink-0">
      <div className="p-4 border-b border-gray-800 flex items-center gap-2">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center"><span className="text-white font-black text-sm">T</span></div>
        <span className="text-white font-black text-lg">Teamly</span>
      </div>
      <div className="p-3 border-b border-gray-800">
        <div className={`bg-gradient-to-r ${rCol[role]} rounded-lg p-3`}>
          <p className="text-white/70 text-xs">{rLbl[role]}</p>
          <p className="text-white text-sm font-semibold truncate">{usr}</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav[role].map(item => (
          <button key={item.id} onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${view === item.id ? "bg-emerald-600 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}>
            <IC n={item.icon} c="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            {item.id === 'orders' && pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-800">
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-all">
          <IC n="logout" c="w-4 h-4" />Déconnexion
        </button>
      </div>
    </div>
  );
}

function AdminDashboard({ orders, products }) {
  const dlv = orders.filter(o => o.status === "delivered");
  const pnd = orders.filter(o => ["pending","confirmed","shipped"].includes(o.status));
  const rev = dlv.reduce((s,o) => s+o.price, 0);
  const costs = dlv.reduce((s,o) => { const p=products.find(x=>x.id===o.prodId); return s+(p?p.cost*o.qty:0)+DELIVERY_COST+o.adSpend; },0);
  const margin = rev - costs;
  const bad = orders.filter(o=>["returned","cancelled"].includes(o.status)).length;
  const rate = dlv.length+bad > 0 ? (dlv.length/(dlv.length+bad)*100).toFixed(0) : 0;
  const recent = [...orders].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-800">Dashboard</h1><p className="text-gray-500 text-sm mt-1">Vue d'ensemble de l'activité</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Chiffre d'affaires" value={`${(rev/1000).toFixed(0)}K F`} sub="Commandes livrées" col="indigo" />
        <KpiCard label="Marge nette" value={`${(margin/1000).toFixed(0)}K F`} sub={`${rev>0?((margin/rev)*100).toFixed(0):0}% du CA`} col="green" />
        <KpiCard label="En cours" value={pnd.length} sub="À traiter" col="yellow" />
        <KpiCard label="Taux livraison" value={`${rate}%`} sub="Livrées / Total" col="indigo" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(STATUSES).map(([k]) => (
          <div key={k} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center justify-between">
            <Badge status={k} /><span className="font-bold text-gray-800">{orders.filter(o=>o.status===k).length}</span>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100"><h2 className="font-semibold text-gray-800">Commandes récentes</h2></div>
        <div className="divide-y divide-gray-50">
          {recent.map(o => {
            const p = products.find(x=>x.id===o.prodId);
            return (
              <div key={o.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 text-xs font-bold">{o.client[0]}</div>
                  <div><p className="text-sm font-medium text-gray-800">{o.client}</p><p className="text-xs text-gray-400">{p?.name} · {o.city}</p></div>
                </div>
                <div className="text-right"><p className="text-sm font-semibold text-gray-800">{o.price.toLocaleString()} F</p><Badge status={o.status} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OrdersView({ orders, products, setOrderStatus, role, filterCloser }) {
  const [flt, setFlt] = useState("all");
  const [q, setQ] = useState("");
  const [editO, setEditO] = useState(null);
  let rows = orders;
  if (filterCloser) rows = rows.filter(o=>o.closer===filterCloser);
  if (flt !== "all") rows = rows.filter(o=>o.status===flt);
  if (q) rows = rows.filter(o=>o.client.toLowerCase().includes(q.toLowerCase())||o.id.includes(q));
  rows = [...rows].sort((a,b)=>b.date.localeCompare(a.date));
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Commandes</h1><p className="text-gray-500 text-sm mt-1">{rows.length} commande(s)</p></div>
        <button onClick={() => exportCSV(rows.map(o => {
          const p = products.find(x => x.id === o.prodId);
          return { 'Référence':o.id,'Client':o.client,'Téléphone':o.phone||'','Produit':p?.name||'','Quantité':o.qty,'Prix (FCFA)':o.price,'Ville':o.city,'Statut':STATUSES[o.status]?.label||o.status,'Closer':o.closer||'','Livreur':o.livreur||'','Date':o.date,'Pub (FCFA)':o.adSpend };
        }), `commandes-${new Date().toISOString().slice(0,10)}.csv`)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all">
          ⬇ Exporter CSV
        </button>
      </div>
      <div className="flex gap-3 flex-wrap">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-32 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        <select value={flt} onChange={e=>setFlt(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUSES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Réf</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Produit</th>
                <th className="px-4 py-3 text-left">Ville</th>
                <th className="px-4 py-3 text-right">Prix</th>
                <th className="px-4 py-3 text-center">Statut</th>
                {role==="admin" && <th className="px-4 py-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(o => {
                const p = products.find(x=>x.id===o.prodId);
                return (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{o.id}</td>
                    <td className="px-4 py-3"><div className="font-medium text-gray-800">{o.client}</div><div className="text-xs text-gray-400">{o.phone}</div></td>
                    <td className="px-4 py-3"><div className="text-gray-700">{p?.name}</div>{o.isBundle && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">Bundle ×{o.qty}</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{o.city}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{o.price.toLocaleString()} F</td>
                    <td className="px-4 py-3 text-center"><Badge status={o.status} /></td>
                    {role==="admin" && <td className="px-4 py-3 text-center"><button onClick={()=>setEditO(o)} className="text-emerald-400 hover:text-emerald-600"><IC n="edit" c="w-4 h-4" /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length===0 && <div className="text-center py-12 text-gray-400 text-sm">Aucune commande trouvée</div>}
        </div>
      </div>
      {editO && <EditModal order={editO} onClose={()=>setEditO(null)} onSave={(id,st,lv)=>{ setOrderStatus(id,st,lv); setEditO(null); }} />}
    </div>
  );
}

function EditModal({ order, onClose, onSave }) {
  const [st, setSt] = useState(order.status);
  const [lv, setLv] = useState(order.livreur||"");
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Modifier {order.id}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><IC n="x" c="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Statut</label>
            <select value={st} onChange={e=>setSt(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
              {Object.entries(STATUSES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Livreur assigné</label>
            <select value={lv} onChange={e=>setLv(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
              <option value="">Non assigné</option>
              {LIVREURS.map(l=><option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="p-5 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">Annuler</button>
          <button onClick={()=>onSave(order.id, st, lv||null)} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function StockView({ products, setProducts, onSaveStock }) {
  const [editId, setEditId] = useState(null);
  const [val, setVal] = useState("");
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold text-gray-800">Stock</h1><p className="text-gray-500 text-sm mt-1">{products.length} produits</p></div>
      <div className="grid gap-4">
        {products.map(p => {
          const lvl = p.stock>20?"green":p.stock>5?"yellow":"red";
          const lc = {green:"bg-green-100 text-green-700",yellow:"bg-yellow-100 text-yellow-700",red:"bg-red-100 text-red-700"};
          return (
            <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800">{p.name}</h3>
                    <span className="text-xs text-gray-400 font-mono">{p.sku}</span>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-500 flex-wrap">
                    <span>Prix: <strong className="text-gray-800">{p.price.toLocaleString()} F</strong></span>
                    <span>Coût: <strong className="text-gray-800">{p.cost.toLocaleString()} F</strong></span>
                    <span>Marge: <strong className="text-green-600">{(((p.price-p.cost)/p.price)*100).toFixed(0)}%</strong></span>
                  </div>
                  {p.bundles.length>0 && <div className="mt-2 flex gap-2 flex-wrap">{p.bundles.map((b,i)=><span key={i} className="bg-purple-100 text-purple-600 text-xs px-2 py-0.5 rounded-full">Bundle ×{b.qty} → {b.price.toLocaleString()} F</span>)}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className={`text-xl font-bold px-3 py-1 rounded-lg ${lc[lvl]}`}>{p.stock}</p>
                    <p className="text-xs text-gray-400 mt-1">unités</p>
                  </div>
                  <button onClick={()=>{ setEditId(p.id); setVal(String(p.stock)); }} className="text-emerald-400 hover:text-emerald-600 p-1"><IC n="edit" c="w-4 h-4" /></button>
                </div>
              </div>
              {editId===p.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2 items-center">
                  <input type="number" value={val} onChange={e=>setVal(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                  <button onClick={()=>{ (onSaveStock||((id,s)=>setProducts(ps=>ps.map(x=>x.id===id?{...x,stock:s}:x))))(p.id,Number(val)); setEditId(null); }} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-emerald-700">Sauvegarder</button>
                  <button onClick={()=>setEditId(null)} className="text-gray-400 text-sm hover:text-gray-600">Annuler</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComptaView({ orders, setOrders, products }) {
  const [ase, setAse] = useState({});
  const dlv = orders.filter(o=>o.status==="delivered");
  const save = (id, v) => { setOrders(os=>os.map(x=>x.id===id?{...x,adSpend:Number(v)}:x)); setAse(e=>{const n={...e};delete n[id];return n;}); };
  const prodStats = products.map(p => {
    const po = dlv.filter(o=>o.prodId===p.id);
    const rev = po.reduce((s,o)=>s+o.price,0);
    const cost = po.reduce((s,o)=>s+p.cost*o.qty+DELIVERY_COST,0);
    const ads = po.reduce((s,o)=>s+o.adSpend,0);
    const mg = rev-cost-ads;
    return {...p, cnt:po.length, rev, cost, ads, mg, mgPct:rev>0?(mg/rev*100).toFixed(1):0};
  }).filter(p=>p.cnt>0);
  const getWk = d => { const dt=new Date(d); const j1=new Date(dt.getFullYear(),0,1); return Math.ceil((((dt-j1)/86400000)+j1.getDay()+1)/7); };
  const wkData = {};
  dlv.forEach(o => {
    const k=`Sem. ${getWk(o.date)}`;
    if(!wkData[k]) wkData[k]={rev:0,cost:0,ads:0,cnt:0};
    const p=products.find(x=>x.id===o.prodId);
    wkData[k].rev+=o.price; wkData[k].cost+=(p?p.cost*o.qty:0)+DELIVERY_COST; wkData[k].ads+=o.adSpend; wkData[k].cnt++;
  });
  const totRev=prodStats.reduce((s,p)=>s+p.rev,0);
  const totMg=prodStats.reduce((s,p)=>s+p.mg,0);
  const totAds=prodStats.reduce((s,p)=>s+p.ads,0);
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Comptabilité</h1><p className="text-gray-500 text-sm mt-1">Analyse de rentabilité</p></div>
        <button onClick={() => exportCSV(prodStats.map(p => ({'Produit':p.name,'Commandes livrées':p.cnt,'CA (FCFA)':p.rev,'Coûts+Livr. (FCFA)':p.cost,'Pub (FCFA)':p.ads,'Marge (FCFA)':p.mg,'Marge %':p.mgPct+'%'})), `compta-${new Date().toISOString().slice(0,10)}.csv`)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all">
          ⬇ Exporter CSV
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Revenus" value={`${(totRev/1000).toFixed(0)}K F`} col="indigo" />
        <KpiCard label="Dépense pub" value={`${(totAds/1000).toFixed(0)}K F`} col="yellow" />
        <KpiCard label="Marge nette" value={`${(totMg/1000).toFixed(0)}K F`} sub={`${totRev>0?((totMg/totRev)*100).toFixed(1):0}%`} col="green" />
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-emerald-50"><h2 className="font-bold text-emerald-800">📦 Point Produit</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr><th className="px-4 py-3 text-left">Produit</th><th className="px-4 py-3 text-right">Cmds</th><th className="px-4 py-3 text-right">CA</th><th className="px-4 py-3 text-right">Coûts</th><th className="px-4 py-3 text-right">Pub</th><th className="px-4 py-3 text-right">Marge</th><th className="px-4 py-3 text-right">%</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {prodStats.map(p=>(
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.cnt}</td>
                  <td className="px-4 py-3 text-right">{p.rev.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-red-500">{p.cost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-yellow-600">{p.ads.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">{p.mg.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right"><span className={`font-bold ${p.mgPct>=20?"text-green-600":p.mgPct>=0?"text-yellow-600":"text-red-500"}`}>{p.mgPct}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-purple-50"><h2 className="font-bold text-purple-800">📅 Point Hebdomadaire</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr><th className="px-4 py-3 text-left">Semaine</th><th className="px-4 py-3 text-right">Cmds</th><th className="px-4 py-3 text-right">CA</th><th className="px-4 py-3 text-right">Coûts+Livr.</th><th className="px-4 py-3 text-right">Pub</th><th className="px-4 py-3 text-right">Marge</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Object.entries(wkData).map(([wk,d])=>{
                const m=d.rev-d.cost-d.ads;
                return <tr key={wk} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium text-gray-800">{wk}</td><td className="px-4 py-3 text-right text-gray-600">{d.cnt}</td><td className="px-4 py-3 text-right">{d.rev.toLocaleString()}</td><td className="px-4 py-3 text-right text-red-500">{d.cost.toLocaleString()}</td><td className="px-4 py-3 text-right text-yellow-600">{d.ads.toLocaleString()}</td><td className={`px-4 py-3 text-right font-semibold ${m>=0?"text-green-600":"text-red-500"}`}>{m.toLocaleString()}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h2 className="font-semibold text-gray-800">Modifier dépense pub</h2><p className="text-xs text-gray-400 mt-0.5">Seule saisie manuelle dans la Compta</p></div>
        <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
          {dlv.map(o=>{
            const p=products.find(x=>x.id===o.prodId);
            const v=ase[o.id]!==undefined?ase[o.id]:o.adSpend;
            return (
              <div key={o.id} className="px-4 py-2.5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0"><span className="text-xs font-mono text-gray-400">{o.id}</span><span className="text-sm text-gray-700 ml-2">{o.client}</span><span className="text-xs text-gray-400 ml-2 hidden sm:inline">{p?.name}</span></div>
                <div className="flex items-center gap-2">
                  <input type="number" value={v} onChange={e=>setAse(ed=>({...ed,[o.id]:e.target.value}))} className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-20 text-right focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                  <span className="text-xs text-gray-400">F</span>
                  {ase[o.id]!==undefined && <button onClick={()=>save(o.id,v)} className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600">✓</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ClientsView({ orders }) {
  const map = {};
  orders.forEach(o=>{
    if(!map[o.client]) map[o.client]={name:o.client,phone:o.phone,total:0,delivered:0,returned:0,orders:0};
    map[o.client].orders++; map[o.client].total+=o.price;
    if(o.status==="delivered") map[o.client].delivered++;
    if(o.status==="returned") map[o.client].returned++;
  });
  const list = Object.values(map).map(c=>({...c,score:c.orders>0?Math.round(c.delivered/c.orders*100):0})).sort((a,b)=>b.score-a.score);
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold text-gray-800">Clients</h1><p className="text-gray-500 text-sm mt-1">Score de fiabilité COD</p></div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr><th className="px-4 py-3 text-left">Client</th><th className="px-4 py-3 text-right">Cmds</th><th className="px-4 py-3 text-right">Livrées</th><th className="px-4 py-3 text-right">Retours</th><th className="px-4 py-3 text-right">CA</th><th className="px-4 py-3 text-center">Score</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map(c=>{
                const cc=c.score>=80?"bg-green-100 text-green-700":c.score>=50?"bg-yellow-100 text-yellow-700":"bg-red-100 text-red-700";
                return <tr key={c.name} className="hover:bg-gray-50"><td className="px-4 py-3"><div className="font-medium text-gray-800">{c.name}</div><div className="text-xs text-gray-400">{c.phone}</div></td><td className="px-4 py-3 text-right text-gray-600">{c.orders}</td><td className="px-4 py-3 text-right text-green-600">{c.delivered}</td><td className="px-4 py-3 text-right text-red-500">{c.returned}</td><td className="px-4 py-3 text-right font-semibold">{c.total.toLocaleString()} F</td><td className="px-4 py-3 text-center"><span className={`px-3 py-1 rounded-full text-xs font-bold ${cc}`}>{c.score}%</span></td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CloserDashboard({ orders, usr, products }) {
  const mine = orders.filter(o=>o.closer===usr);
  const dlv = mine.filter(o=>o.status==="delivered");
  const pnd = mine.filter(o=>["pending","confirmed"].includes(o.status));
  const rev = dlv.reduce((s,o)=>s+o.price,0);
  const rate = mine.length>0?(dlv.length/mine.length*100).toFixed(0):0;
  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-800">Bonjour, {usr.split(" ")[0]} 👋</h1><p className="text-gray-500 text-sm mt-1">Tableau de bord closer</p></div>
      <div className="grid grid-cols-2 gap-4">
        <KpiCard label="Total commandes" value={mine.length} col="indigo" />
        <KpiCard label="Livrées" value={dlv.length} col="green" />
        <KpiCard label="En attente" value={pnd.length} col="yellow" />
        <KpiCard label="CA généré" value={`${(rev/1000).toFixed(0)}K F`} col="indigo" />
      </div>
      <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white">
        <p className="text-blue-100 text-sm">Taux de conversion</p>
        <p className="text-4xl font-black mt-1">{rate}%</p>
        <div className="mt-3 bg-white/20 rounded-full h-2">
          <div className="bg-white rounded-full h-2 transition-all" style={{width:`${rate}%`}} />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100"><h2 className="font-semibold text-gray-800">Commandes récentes</h2></div>
        <div className="divide-y divide-gray-50">
          {[...mine].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(o=>{
            const p=products.find(x=>x.id===o.prodId);
            return <div key={o.id} className="px-4 py-3 flex items-center justify-between"><div><p className="text-sm font-medium text-gray-800">{o.client}</p><p className="text-xs text-gray-400">{p?.name}</p></div><div className="text-right"><p className="text-sm font-semibold">{o.price.toLocaleString()} F</p><Badge status={o.status} /></div></div>;
          })}
        </div>
      </div>
    </div>
  );
}

function NewOrderView({ products, closer, addOrder }) {
  const [f, setF] = useState({ client:"", phone:"", prodId:products[0].id, qty:1, city:CITIES[0], isBundle:false, adSpend:500, note:"", pay:"cod" });
  const [ok, setOk] = useState(false);
  const set = (k,v) => setF(x=>({...x,[k]:v}));
  const prod = products.find(p=>p.id===Number(f.prodId));
  const bnd = prod?.bundles[0];
  const eff = f.isBundle && bnd;
  const qty = eff ? bnd.qty : Number(f.qty);
  const price = eff ? bnd.price : prod.price*qty;
  const cost = prod.cost*qty + DELIVERY_COST;
  const margin = price - cost - Number(f.adSpend);
  const mgPct = price>0?((margin/price)*100).toFixed(1):0;
  const submit = () => {
    if(!f.client||!f.phone) return;
    addOrder({ id:`CMD-${String(oCnt++).padStart(3,"0")}`, client:f.client, phone:f.phone, prodId:Number(f.prodId), qty, price, city:f.city, status:"pending", closer, livreur:null, date:new Date().toISOString().split("T")[0], adSpend:Number(f.adSpend), isBundle:!!eff, note:f.note });
    setF({ client:"", phone:"", prodId:products[0].id, qty:1, city:CITIES[0], isBundle:false, adSpend:500, note:"", pay:"cod" });
    setOk(true); setTimeout(()=>setOk(false),3000);
  };
  return (
    <div className="p-6 max-w-lg">
      <div className="mb-6"><h1 className="text-2xl font-bold text-gray-800">Nouvelle commande</h1><p className="text-gray-500 text-sm mt-1">Saisir les informations client</p></div>
      {ok && <div className="bg-green-100 border border-green-200 text-green-700 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm"><IC n="check" c="w-4 h-4" /> Commande enregistrée !</div>}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500 font-medium mb-1 block">Nom client *</label><input value={f.client} onChange={e=>set("client",e.target.value)} placeholder="Mamadou Diallo" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" /></div>
          <div><label className="text-xs text-gray-500 font-medium mb-1 block">Téléphone *</label><input value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="77 000 0000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" /></div>
        </div>
        <div><label className="text-xs text-gray-500 font-medium mb-1 block">Produit</label>
          <select value={f.prodId} onChange={e=>{set("prodId",e.target.value);set("isBundle",false);set("qty",1);}} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
            {products.map(p=><option key={p.id} value={p.id}>{p.name} — {p.price.toLocaleString()} F</option>)}
          </select>
        </div>
        {bnd && (
          <div className="flex items-center justify-between bg-purple-50 rounded-xl p-3">
            <div><p className="text-sm font-medium text-purple-800">Bundle disponible</p><p className="text-xs text-purple-600">{bnd.qty} unités pour {bnd.price.toLocaleString()} F</p></div>
            <button onClick={()=>set("isBundle",!f.isBundle)} className={`w-12 h-6 rounded-full transition-all relative ${f.isBundle?"bg-purple-500":"bg-gray-200"}`}>
              <div className="w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all" style={{left:f.isBundle?"26px":"2px"}} />
            </button>
          </div>
        )}
        {!eff && <div><label className="text-xs text-gray-500 font-medium mb-1 block">Quantité</label><input type="number" min="1" value={f.qty} onChange={e=>set("qty",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" /></div>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500 font-medium mb-1 block">Ville</label>
            <select value={f.city} onChange={e=>set("city",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
              {CITIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500 font-medium mb-1 block">Paiement</label>
            <select value={f.pay} onChange={e=>set("pay",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
              <option value="cod">Paiement à la livraison</option>
              <option value="wave">Wave</option>
              <option value="orange">Orange Money</option>
            </select>
          </div>
        </div>
        <div><label className="text-xs text-gray-500 font-medium mb-1 block">Dépense pub attribuée (FCFA)</label><input type="number" value={f.adSpend} onChange={e=>set("adSpend",e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" /></div>
        <div><label className="text-xs text-gray-500 font-medium mb-1 block">Note (optionnel)</label><input value={f.note} onChange={e=>set("note",e.target.value)} placeholder="Instruction spéciale..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" /></div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Aperçu marge en temps réel</p>
          {[["Prix de vente",price.toLocaleString()+" F","text-gray-800"],["Coût produit","−"+(prod.cost*qty).toLocaleString()+" F","text-red-400"],["Livraison","−"+DELIVERY_COST.toLocaleString()+" F","text-red-400"],["Pub","−"+Number(f.adSpend).toLocaleString()+" F","text-yellow-500"]].map(([l,v,c])=>(
            <div key={l} className="flex justify-between text-sm"><span className="text-gray-500">{l}</span><span className={`font-semibold ${c}`}>{v}</span></div>
          ))}
          <div className="border-t border-gray-200 pt-2 flex justify-between items-end">
            <span className="font-bold text-gray-800">Marge nette</span>
            <span className={`font-black text-lg ${margin>=0?"text-green-600":"text-red-500"}`}>{margin.toLocaleString()} F <span className="text-sm">({mgPct}%)</span></span>
          </div>
        </div>
        <button onClick={submit} disabled={!f.client||!f.phone} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl transition-all">
          Enregistrer la commande
        </button>
      </div>
    </div>
  );
}

function LivreurDashboard({ orders, usr, updSt }) {
  const mine = orders.filter(o=>o.livreur===usr);
  const ship = mine.filter(o=>o.status==="shipped");
  const dlv = mine.filter(o=>o.status==="delivered");
  const ret = mine.filter(o=>o.status==="returned");
  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-800">Bonjour, {usr.split(" ")[0]} 👋</h1><p className="text-gray-500 text-sm mt-1">Vos livraisons</p></div>
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="À livrer" value={ship.length} col="yellow" />
        <KpiCard label="Livrées" value={dlv.length} col="green" />
        <KpiCard label="Retours" value={ret.length} col="red" />
      </div>
      {ship.length>0 ? (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800">À livrer maintenant</h2>
          {ship.map(o=><DelivCard key={o.id} order={o} updSt={updSt} />)}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center">
          <p className="text-2xl mb-2">✅</p><p className="font-semibold text-green-700">Toutes les livraisons sont à jour !</p>
        </div>
      )}
    </div>
  );
}

function LivreurDeliveries({ orders, usr, updSt }) {
  const [flt, setFlt] = useState("shipped");
  const mine = orders.filter(o=>o.livreur===usr&&(flt==="all"||o.status===flt));
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-2xl font-bold text-gray-800">Mes livraisons</h1><p className="text-gray-500 text-sm mt-1">{mine.length} commande(s)</p></div>
      <div className="flex gap-2 flex-wrap">
        {[["all","Toutes"],["shipped","Expédiées"],["delivered","Livrées"],["returned","Retours"]].map(([k,v])=>(
          <button key={k} onClick={()=>setFlt(k)} className={`px-3 py-1.5 rounded-lg text-sm transition-all ${flt===k?"bg-emerald-600 text-white":"bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{v}</button>
        ))}
      </div>
      <div className="space-y-3">
        {mine.map(o=><DelivCard key={o.id} order={o} updSt={updSt} />)}
        {mine.length===0 && <div className="text-center py-12 text-gray-400">Aucune livraison</div>}
      </div>
    </div>
  );
}

function DelivCard({ order, updSt }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2"><span className="font-mono text-xs text-gray-400">{order.id}</span><Badge status={order.status} /></div>
          <p className="font-semibold text-gray-800 mt-1">{order.client}</p>
          <p className="text-sm text-gray-500">{order.phone} · {order.city}</p>
        </div>
        <p className="font-bold text-emerald-600">{order.price.toLocaleString()} F</p>
      </div>
      <div className="text-xs text-gray-400 mb-3">💳 Paiement à la livraison{order.note&&` · 📝 ${order.note}`}</div>
      {order.status==="shipped" && (
        <div className="flex gap-2">
          <button onClick={()=>updSt(order.id,"delivered")} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1"><IC n="check" c="w-4 h-4" /> Livré ✓</button>
          <button onClick={()=>updSt(order.id,"returned")} className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1"><IC n="x" c="w-4 h-4" /> Retour</button>
        </div>
      )}
    </div>
  );
}

export default function Teamly() {
  const [role, setRole] = useState(null);
  const [usr, setUsr] = useState(null);
  const [view, setView] = useState("dashboard");
  const [products, setProducts] = useState(PRODUCTS);
  const [orders, setOrders] = useState(INIT_ORDERS);
  const [toasts, setToasts] = useState([]);
  const toastRef = useRef(null);
  const addToast = (msg, type = 'info', icon = '🔔') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type, icon }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  };
  toastRef.current = addToast;

  // Sesión persistente: restaurar login al recargar la página
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadProfile(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadProfile(session.user.id);
      else { setRole(null); setUsr(null); }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('role, name').eq('id', userId).single();
    if (data) { setRole(data.role); setUsr(data.name); setView('dashboard'); }
  };

  // Carga inicial de datos + suscripciones en tiempo real
  useEffect(() => {
    async function load() {
      const [{ data: ord }, { data: prod }] = await Promise.all([
        supabase.from('orders').select('*').order('date', { ascending: false }),
        supabase.from('products').select('*').order('id'),
      ]);
      if (ord?.length)  setOrders(ord.map(fromDb));
      if (prod?.length) setProducts(prod);
    }
    load();

    // Realtime: pedidos
    const STATUS_TOASTS = {
      delivered: { type: 'success', icon: '✅', msg: (r) => `Livré: ${r.client} · ${r.city}` },
      returned:  { type: 'error',   icon: '↩️', msg: (r) => `Retour: ${r.client} · ${r.city}` },
      shipped:   { type: 'info',    icon: '🚚', msg: (r) => `Expédié: ${r.client} → ${r.livreur || '?'}` },
      confirmed: { type: 'info',    icon: '📞', msg: (r) => `Confirmé: ${r.client} · ${r.city}` },
    };
    const ordChannel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
        ({ new: row }) => {
          setOrders(prev => [fromDb(row), ...prev]);
          toastRef.current(`📦 Nouveau: ${row.client} · ${row.city}`, 'info', '📦');
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
        ({ new: row }) => {
          setOrders(prev => prev.map(o => o.id === row.id ? fromDb(row) : o));
          const t = STATUS_TOASTS[row.status];
          if (t) toastRef.current(t.msg(row), t.type, t.icon);
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' },
        ({ old: row }) => setOrders(prev => prev.filter(o => o.id !== row.id))
      )
      .subscribe();

    // Realtime: productos (stock)
    const prodChannel = supabase
      .channel('products-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' },
        ({ new: row }) => {
          setProducts(prev => prev.map(p => p.id === row.id ? row : p));
          if (row.stock <= 5) toastRef.current(`⚠️ Stock bas: ${row.name} (${row.stock} restants)`, 'warning', '⚠️');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordChannel);
      supabase.removeChannel(prodChannel);
    };
  }, []);

  const updSt = async (id, st, lv) => {
    setOrders(os => os.map(x => x.id === id ? { ...x, status: st, ...(lv !== undefined ? { livreur: lv } : {}) } : x));
    const upd = { status: st };
    if (lv !== undefined) upd.livreur = lv;
    await supabase.from('orders').update(upd).eq('id', id);
  };

  const addOrder = async (o) => {
    setOrders(prev => [o, ...prev]);
    await supabase.from('orders').insert([toDb(o)]);
  };

  const saveStock = async (id, stock) => {
    setProducts(ps => ps.map(x => x.id === id ? { ...x, stock } : x));
    await supabase.from('products').update({ stock }).eq('id', id);
  };

  if (!role) return <Login />;

  const renderView = () => {
    if (role==="admin") {
      if (view==="dashboard") return <AdminDashboard orders={orders} products={products} />;
      if (view==="orders") return <OrdersView orders={orders} products={products} setOrderStatus={updSt} role="admin" />;
      if (view==="stock") return <StockView products={products} setProducts={setProducts} onSaveStock={saveStock} />;
      if (view==="compta") return <ComptaView orders={orders} setOrders={setOrders} products={products} />;
      if (view==="clients") return <ClientsView orders={orders} />;
    }
    if (role==="closer") {
      if (view==="dashboard") return <CloserDashboard orders={orders} usr={usr} products={products} />;
      if (view==="new_order") return <NewOrderView products={products} closer={usr} addOrder={addOrder} />;
      if (view==="orders") return <OrdersView orders={orders} products={products} setOrderStatus={()=>{}} role="closer" filterCloser={usr} />;
    }
    if (role==="livreur") {
      if (view==="dashboard") return <LivreurDashboard orders={orders} usr={usr} updSt={updSt} />;
      if (view==="deliveries") return <LivreurDeliveries orders={orders} usr={usr} updSt={updSt} />;
    }
    return null;
  };

  const pendingCount = orders.filter(o => ['pending', 'confirmed'].includes(o.status)).length;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <ToastContainer toasts={toasts} />
      <Sidebar role={role} view={view} setView={setView} usr={usr} pendingCount={pendingCount}
        onLogout={async () => { await supabase.auth.signOut(); }} />
      <main className="flex-1 overflow-y-auto">{renderView()}</main>
    </div>
  );
}
