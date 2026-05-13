import React from "react";
import { useAppContext } from "../context/AppContext";
import { Calendar, User, Smartphone, MapPin, Phone } from "lucide-react";

export const ClientsPage = () => {
  const {
    G, fmt, STATUS, localDateStr,
    orders, canUseExport,
    clientCat, clientDate, clientLoading, showClientDetail,
    setClientCat, setClientDate, setClientLoading, setShowClientDetail, setShowPlanModal,
    addToast,
  } = useAppContext();

  const _tdc = new Date();
  const TODAY     = localDateStr(_tdc);
  const _ydc = new Date(_tdc); _ydc.setDate(_tdc.getDate()-1);
  const YESTERDAY = localDateStr(_ydc);
  const _wdc = new Date(_tdc); _wdc.setDate(_tdc.getDate()-7);
  const WEEK_AGO  = localDateStr(_wdc);

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
    const d = o.created_at ? localDateStr(o.created_at) : "";
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
        <div style={{fontSize:10,color:G.gray,fontWeight:700,marginBottom:8,letterSpacing:0.5,display:"flex",alignItems:"center",gap:5}}><Calendar size={11}/> FILTRER PAR DATE</div>
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
        <button onClick={()=>{ if(!canUseExport){addToast("Export disponible à partir du plan Pro","🔒","#7C3AED");setShowPlanModal(true);return;} exportFile('excel'); }}
          style={{flex:1,background:canUseExport?G.green:"#9CA3AF",color:'#fff',border:'none',borderRadius:10,padding:'10px 0',fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
          {!canUseExport&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
          Excel (.csv)
        </button>
        <button onClick={()=>{ if(!canUseExport){addToast("Export disponible à partir du plan Pro","🔒","#7C3AED");setShowPlanModal(true);return;} exportFile('csv'); }}
          style={{flex:1,background:canUseExport?'#0284C7':"#9CA3AF",color:'#fff',border:'none',borderRadius:10,padding:'10px 0',fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
          {!canUseExport&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
          CSV
        </button>
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
          <div style={{marginBottom:10,display:"flex",justifyContent:"center"}}><User size={40} color={G.gray}/></div>
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
                    <div style={{fontSize:11,color:G.gray,marginTop:3,display:"flex",alignItems:"center",gap:4}}><Smartphone size={11}/> {c.phone}</div>
                    {c.address&&<div style={{fontSize:11,color:G.gray,display:"flex",alignItems:"center",gap:4}}><MapPin size={11}/> {c.address}</div>}
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
                            {d&&<div style={{fontSize:10,color:G.gray,display:"flex",alignItems:"center",gap:3}}><Calendar size={10}/> {d}</div>}
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:13,fontWeight:800,color:G.green}}>{fmt(o.price)} CFA</div>
                            <span style={{background:st.bg,color:st.color,borderRadius:5,padding:'2px 7px',fontSize:10,fontWeight:600}}>{st.label}</span>
                          </div>
                        </div>
                      );
                    })}
                    <a href={`tel:${c.phone}`} style={{marginTop:10,background:G.greenLight,color:G.green,borderRadius:9,padding:'9px 0',fontSize:12,fontWeight:700,textAlign:'center',textDecoration:'none',display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><Phone size={13}/> Appeler {c.name}</a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
