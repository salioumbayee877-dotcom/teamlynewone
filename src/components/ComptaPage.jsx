import React from "react";
import { useAppContext } from "../context/AppContext";
import { _parseCity } from "../lib/senegal";
import {
  X, Check, Bike, Truck, PhoneOff, RotateCcw, MapPin, AlertTriangle,
  Pencil, Coins, Package, Megaphone, Ban, Banknote, FileText, BarChart3,
  Download, Circle,
} from "lucide-react";

const _IcoWrap = ({ children, gap = 4 }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap, verticalAlign: "middle" }}>{children}</span>
);

export const ComptaPage = () => {
  const {
    G, fmt, pct, FRAIS_LIV, TODAY, sbFetch,
    _COMPTA_FILTERS_DEFAULT,
    orgId, setSettings, patchOrgSettings,
    products, teamMembers, mainRegion, otherRegions, settings,
    comptaFilters, comptaFiltersOpen, comptaPeriodMode, comptaShortcut,
    dateFrom, dateTo, comptaExpandedProd, comptaCostEdit, comptaExportOpen,
    adSpend, livraisonsEchouees, cashRemis,
    comptaOrders, comptaCalcProd, comptaCA, comptaBen, comptaCamv, comptaFrais,
    comptaPub, comptaMarge,
    setProducts,
    setComptaFilters, setComptaFiltersOpen, setComptaPeriodMode, setComptaShortcut,
    setDateFrom, setDateTo, setComptaExpandedProd, setComptaCostEdit, setComptaExportOpen,
    setAdSpend, setLivraisonsEchouees, setCashRemis,
    setTab, setExpandedProd,
    addToast, setConfirmModal,
  } = useAppContext();

  const [savingCompta, setSavingCompta] = React.useState(false);

  const _doSaveComptaInputs = async () => {
    if (!orgId) { addToast("Erreur : organisation introuvable","❌","#DC2626"); return; }
    setSavingCompta(true);
    const compta_inputs = {
      adSpend:  adSpend  || {},
      echouees: livraisonsEchouees || {},
      cashRemis: cashRemis || "",
    };
    const ok = await patchOrgSettings({ compta_inputs });
    if (ok) {
      try {
        localStorage.setItem("teamly_ad_spend", JSON.stringify(adSpend));
        localStorage.setItem("teamly_echecs",   JSON.stringify(livraisonsEchouees));
      } catch(e) {}
      addToast("Saisies enregistrées ✅","✅","#16a34a");
    } else {
      addToast("Erreur de sauvegarde — réessaie","❌","#DC2626");
    }
    setSavingCompta(false);
  };

  const saveComptaInputs = async () => {
    // Confirmation popup when saving on a past single day (yesterday, before yesterday…) —
    // user is rewriting historical data and needs to acknowledge it.
    const isToday = comptaPeriodMode==="jour" || (comptaPeriodMode==="plage" && dateFrom===TODAY && dateTo===TODAY);
    const isMultiDay = comptaPeriodMode==="semaine" || comptaPeriodMode==="mois" || (comptaPeriodMode==="plage" && dateFrom!==dateTo);
    const isPastSingle = !isToday && !isMultiDay;
    if (isPastSingle) {
      const dayLabel = new Date((dateFrom||TODAY)+"T12:00:00Z").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
      if (typeof setConfirmModal === "function") {
        setConfirmModal({
          msg: `Modifier les saisies du ${dayLabel} ?`,
          sub: `Tu n'es PAS sur Aujourd'hui.\nCes valeurs (Pub, Frais extra…) seront enregistrées pour ce jour passé et écraseront les valeurs précédentes.\n\nContinuer ?`,
          danger: true,
          onConfirm: ()=>{ setConfirmModal(null); _doSaveComptaInputs(); },
        });
        return;
      }
      // Fallback if confirmModal isn't wired
      if (!window.confirm(`Tu modifies les saisies du ${dayLabel}. Continuer ?`)) return;
    }
    _doSaveComptaInputs();
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:10,maxWidth:600,margin:"0 auto",width:"100%"}}>

      {/* ── Filter bar ── */}
      {(()=>{
        const cf = comptaFilters;
        // Treat the default {entregado,rechazado} (or legacy {entregado}) as
        // "no status filter active" — only count when the user changed it.
        const _statutsDefault = (cf.statuts.length<=2)
          && cf.statuts.every(s=>s==="entregado"||s==="rechazado");
        const activeCount = cf.produits.length+(cf.livraisonType!=="all"?1:0)+(cf.source!=="all"?1:0)+cf.livreurs.length+(cf.region?1:0)+(_statutsDefault?0:1);
        const resetFilters = ()=>{ setComptaFilters(_COMPTA_FILTERS_DEFAULT); setComptaFiltersOpen(false); };
        const livTeam = teamMembers.filter(m=>m.role==="livreur");
        const _mainC  = (mainRegion?.cities||[]).map(s=>{const{name}=_parseCity(s);return name;}).filter(Boolean);
        return (
          <div style={{background:"#fff",borderRadius:12,border:"0.5px solid #E5E7EB",overflow:"visible"}}>
            {/* Header row */}
            <div onClick={()=>setComptaFiltersOpen(o=>!o)} style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",userSelect:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:13,fontWeight:500,color:"#374151"}}>Filtres</span>
                {activeCount>0&&<span style={{background:"#1E40AF",color:"#fff",borderRadius:10,padding:"1px 8px",fontSize:11,fontWeight:500,minWidth:20,textAlign:"center"}}>{activeCount}</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {activeCount>0&&<button onClick={e=>{e.stopPropagation();resetFilters();}} style={{background:"none",border:"none",color:"#9CA3AF",fontSize:11,cursor:"pointer",padding:0}}>Effacer tout</button>}
                <span style={{color:"#9CA3AF",fontSize:11}}>{comptaFiltersOpen?"▲":"▾"}</span>
              </div>
            </div>

            {/* Expanded panels */}
            {comptaFiltersOpen&&(
              <div style={{borderTop:"0.5px solid #F3F4F6",padding:"12px 14px",display:"flex",flexDirection:"column",gap:12}}>

                {/* Produits */}
                {products.length>0&&(
                  <div>
                    <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.06em",marginBottom:6}}>PRODUITS</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {products.map(p=>{
                        const active=cf.produits.includes(p.name);
                        return <button key={p.id} onClick={()=>setComptaFilters(f=>({...f,produits:active?f.produits.filter(x=>x!==p.name):[...f.produits,p.name]}))}
                          style={{background:active?"#1E40AF":"#F3F4F6",color:active?"#fff":"#374151",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:active?500:400,display:"inline-flex",alignItems:"center",gap:4}}>{p.name}{active&&<X size={12}/>}</button>;
                      })}
                    </div>
                  </div>
                )}

                {/* Type livraison */}
                <div>
                  <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.06em",marginBottom:6}}>TYPE DE LIVRAISON</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {[["all","Tous",null],["locale_moto","Locale Moto",Bike],["regionale_voiture","Régionale Voiture",Truck]].map(([k,l,Ico])=>(
                      <button key={k} onClick={()=>setComptaFilters(f=>({...f,livraisonType:k}))}
                        style={{background:cf.livraisonType===k?"#111827":"#F3F4F6",color:cf.livraisonType===k?"#fff":"#374151",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:cf.livraisonType===k?500:400,display:"inline-flex",alignItems:"center",gap:5}}>{Ico&&<Ico size={13}/>}{l}</button>
                    ))}
                  </div>
                </div>

                {/* Statut */}
                <div>
                  <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.06em",marginBottom:6}}>STATUT COMMANDE</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {[["entregado","Livré",Check],["rechazado","Rejeté",X],["no_contesta","Échec",PhoneOff],["reprogramar","Retourné",RotateCcw]].map(([k,l,Ico])=>{
                      const active=cf.statuts.includes(k);
                      return <button key={k} onClick={()=>setComptaFilters(f=>({...f,statuts:active?f.statuts.filter(x=>x!==k):[...f.statuts,k]}))}
                        style={{background:active?"#111827":"#F3F4F6",color:active?"#fff":"#374151",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:active?500:400,display:"inline-flex",alignItems:"center",gap:5}}><Ico size={13}/>{l}</button>;
                    })}
                  </div>
                </div>

                {/* Source */}
                <div>
                  <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.06em",marginBottom:6}}>SOURCE</div>
                  <div style={{display:"flex",gap:4}}>
                    {[["all","Tous"],["shopify","Shopify"],["manual","Manuel"]].map(([k,l])=>(
                      <button key={k} onClick={()=>setComptaFilters(f=>({...f,source:k}))}
                        style={{background:cf.source===k?"#111827":"#F3F4F6",color:cf.source===k?"#fff":"#374151",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:cf.source===k?500:400}}>{l}</button>
                    ))}
                  </div>
                </div>

                {/* Livreur */}
                {livTeam.length>0&&(
                  <div>
                    <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.06em",marginBottom:6}}>LIVREUR</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {livTeam.map(m=>{
                        const active=cf.livreurs.includes(m.nom);
                        return <button key={m.id} onClick={()=>setComptaFilters(f=>({...f,livreurs:active?f.livreurs.filter(x=>x!==m.nom):[...f.livreurs,m.nom]}))}
                          style={{background:active?"#1E40AF":"#F3F4F6",color:active?"#fff":"#374151",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:active?500:400,display:"inline-flex",alignItems:"center",gap:5}}><Bike size={13}/>{m.nom}{active&&<X size={12}/>}</button>;
                      })}
                    </div>
                  </div>
                )}

                {/* Zone de livraison (cascading) */}
                <div>
                  <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.06em",marginBottom:6}}>ZONE DE LIVRAISON</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <select value={cf.region} onChange={e=>setComptaFilters(f=>({...f,region:e.target.value,ville:""}))}
                      style={{flex:"1 1 140px",border:"0.5px solid #E5E7EB",borderRadius:8,padding:"7px 8px",fontSize:12,outline:"none",background:"#FAFAFA"}}>
                      <option value="">Toutes les régions</option>
                      {mainRegion?.name&&<option value={mainRegion.name}>{mainRegion.name} (principale)</option>}
                      {otherRegions.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                    {cf.region&&(
                      <select value={cf.ville} onChange={e=>setComptaFilters(f=>({...f,ville:e.target.value}))}
                        style={{flex:"1 1 140px",border:"0.5px solid #E5E7EB",borderRadius:8,padding:"7px 8px",fontSize:12,outline:"none",background:"#FAFAFA"}}>
                        <option value="">Toutes les villes</option>
                        {cf.region===mainRegion?.name
                          ?_mainC.map(c=><option key={c} value={c}>{c}</option>)
                          :otherRegions.filter(r=>r.name===cf.region).map(r=><option key={r.id} value={r.name}>{r.name}</option>)
                        }
                      </select>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Active filter chips */}
            {activeCount>0&&(
              <div style={{padding:"8px 14px",borderTop:"0.5px solid #F3F4F6",display:"flex",gap:5,flexWrap:"wrap"}}>
                {cf.produits.map(p=><span key={p} onClick={()=>setComptaFilters(f=>({...f,produits:f.produits.filter(x=>x!==p)}))}
                  style={{background:"#DBEAFE",color:"#1E40AF",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>{p} <X size={11}/></span>)}
                {cf.livraisonType!=="all"&&<span onClick={()=>setComptaFilters(f=>({...f,livraisonType:"all"}))}
                  style={{background:"#F0FDF4",color:"#16a34a",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>{cf.livraisonType==="locale_moto"?<><Bike size={12}/> Locale</>:<><Truck size={12}/> Régionale</>} <X size={11}/></span>}
                {cf.source!=="all"&&<span onClick={()=>setComptaFilters(f=>({...f,source:"all"}))}
                  style={{background:"#FEF3C7",color:"#92400E",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>{cf.source==="shopify"?"Shopify":"Manuel"} <X size={11}/></span>}
                {cf.livreurs.map(l=><span key={l} onClick={()=>setComptaFilters(f=>({...f,livreurs:f.livreurs.filter(x=>x!==l)}))}
                  style={{background:"#EDE9FE",color:"#5B21B6",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}><Bike size={12}/> {l} <X size={11}/></span>)}
                {cf.ville&&<span onClick={()=>setComptaFilters(f=>({...f,ville:"",region:""}))}
                  style={{background:"#FEF9C3",color:"#713F12",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}><MapPin size={12}/> {cf.ville} <X size={11}/></span>}
                {!cf.ville&&cf.region&&<span onClick={()=>setComptaFilters(f=>({...f,region:""}))}
                  style={{background:"#FEF9C3",color:"#713F12",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}><MapPin size={12}/> {cf.region} <X size={11}/></span>}
                {!(cf.statuts.length===1&&cf.statuts[0]==="entregado")&&<span onClick={()=>setComptaFilters(f=>({...f,statuts:["entregado"]}))}
                  style={{background:"#F3F4F6",color:"#374151",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>Statuts <X size={11}/></span>}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Section 1: Period selector ── */}
      {(()=>{
        const _iso=d=>{ const z=new Date(d); z.setHours(12,0,0,0); return `${z.getFullYear()}-${String(z.getMonth()+1).padStart(2,"0")}-${String(z.getDate()).padStart(2,"0")}`; };
        const setPeriod=k=>{
          setComptaPeriodMode(k);
          if(k==="jour"){setDateFrom(TODAY);setDateTo(TODAY);setComptaShortcut("today");}
          else if(k==="hier"){const y=new Date();y.setDate(y.getDate()-1);const ys=_iso(y);setDateFrom(ys);setDateTo(ys);setComptaShortcut("yesterday");}
          else if(k==="semaine"){const n=new Date();const dow=(n.getDay()+6)%7;/* lundi=0 */ const m=new Date(n);m.setDate(n.getDate()-dow);setDateFrom(_iso(m));setDateTo(TODAY);setComptaShortcut("thisweek");}
          else if(k==="mois"){setDateFrom(TODAY.slice(0,7)+"-01");setDateTo(TODAY);setComptaShortcut("thismonth");}
        };
        return (
          <>
            <div style={{display:"flex",background:"#F3F4F6",borderRadius:10,padding:3,gap:2,flexWrap:"wrap"}}>
              {[["jour","Aujourd'hui"],["hier","Hier"],["semaine","Cette semaine"],["mois","Ce mois"],["plage","Plage"]].map(([k,l])=>(
                <button key={k} onClick={()=>setPeriod(k)} style={{flex:"1 1 auto",minWidth:0,background:comptaPeriodMode===k?"#fff":"transparent",border:"none",borderRadius:8,padding:"9px 6px",fontSize:12,fontWeight:comptaPeriodMode===k?500:400,color:comptaPeriodMode===k?"#111827":"#6B7280",cursor:"pointer",boxShadow:comptaPeriodMode===k?"0 1px 4px rgba(0,0,0,0.08)":"none",transition:"all 0.15s",whiteSpace:"nowrap"}}>{l}</button>
              ))}
            </div>
            {comptaPeriodMode==="plage"&&(
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setComptaShortcut(null);}} style={{flex:1,border:"0.5px solid #E5E7EB",borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none",background:"#fff"}}/>
                <span style={{color:"#9CA3AF",fontSize:12,flexShrink:0}}>→</span>
                <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setComptaShortcut(null);}} style={{flex:1,border:"0.5px solid #E5E7EB",borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none",background:"#fff"}}/>
              </div>
            )}
          </>
        );
      })()}

      {/* ── Section 2: Global summary card ── */}
      {(()=>{
        const _fmtDay = d => new Date(d+"T12:00:00Z").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
        const periodLabel = comptaPeriodMode==="jour"
          ? `Aujourd'hui · ${_fmtDay(dateFrom||TODAY)}`
          : comptaPeriodMode==="hier"
            ? `Hier · ${_fmtDay(dateFrom||TODAY)}`
            : comptaPeriodMode==="semaine"
              ? `Cette semaine · ${_fmtDay(dateFrom||TODAY)} → ${_fmtDay(dateTo||TODAY)}`
              : comptaPeriodMode==="mois"
                ? new Date((dateFrom||TODAY)+"T12:00:00Z").toLocaleDateString("fr-FR",{month:"long",year:"numeric"})
                : `${dateFrom||"—"} → ${dateTo||"—"}`;
        const nLivrees  = comptaOrders.filter(o=>o.status==="entregado").length;
        const nRejetees = comptaOrders.filter(o=>o.status==="rechazado").length;
        const totalCouts= comptaCamv+comptaFrais+comptaPub+comptaCalcProd.reduce((a,x)=>a+x.echouees,0);
        return (
          <div style={{background:"#fff",borderRadius:12,border:"0.5px solid #E5E7EB",padding:"16px 16px 14px"}}>
            <div style={{fontSize:11,color:"#9CA3AF",marginBottom:2}}>{periodLabel}</div>
            <div style={{fontSize:12,color:"#6B7280",marginBottom:6}}>Bénéfice net de la période</div>
            <div style={{fontSize:28,fontWeight:500,color:comptaBen>=0?"#16a34a":"#dc2626",marginBottom:4,lineHeight:1.1}}>
              {fmt(comptaBen)} <span style={{fontSize:13,color:"#9CA3AF",fontWeight:400}}>CFA</span>
            </div>
            <div style={{fontSize:12,color:"#9CA3AF",marginBottom:14}}>Marge {pct(comptaMarge)}</div>
            <div style={{height:"0.5px",background:"#F3F4F6",margin:"0 -16px",marginBottom:14}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 20px"}}>
              {[
                {l:"CA",          v:`${fmt(comptaCA)} CFA`},
                {l:"Coûts",       v:`${fmt(totalCouts)} CFA`},
                {l:"Pub",         v:`${fmt(comptaPub)} CFA`},
                {l:"Livraison",   v:`${fmt(comptaFrais)} CFA`},
                {l:"Livrées / Rejetées", v:`${nLivrees} / ${nRejetees}`},
              ].map(({l,v},i)=>(
                <div key={i}>
                  <div style={{fontSize:11,color:"#9CA3AF",marginBottom:2}}>{l}</div>
                  <div style={{fontSize:14,fontWeight:500,color:"#111827"}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:10,fontSize:11,color:"#9CA3AF",textAlign:"right"}}>
              {comptaOrders.length} commande{comptaOrders.length!==1?"s":""}
            </div>
          </div>
        );
      })()}

      {/* ── Section 4: Product rows (compact, expandable) ── */}
      <div>
        <div style={{fontSize:11,fontWeight:600,color:"#4B5563",letterSpacing:"0.07em",marginBottom:8,paddingLeft:2}}>PRODUITS</div>
        {comptaCalcProd.map(({prod,nLiv,nRej,ca,camv,frais,echouees,pub,ben,marge,zoneBreakdown,totalUnits})=>{
          const isExpanded    = comptaExpandedProd===prod.id;
          const hasSales      = nLiv>0;
          const isNegative    = hasSales&&ben<0;
          const badgeColor    = !hasSales?"#4B5563":ben<0?"#991B1B":marge<0.3?"#92400E":"#166534";
          const badgeBg       = !hasSales?"#F3F4F6":ben<0?"#FEF2F2":marge<0.3?"#FFFBEB":"#F0FDF4";
          const costEdit      = comptaCostEdit[prod.id]||{};
          const notConfigured = !prod.cost||prod.cost===0;
          return (
            <div key={prod.id} style={{background:"#fff",borderRadius:12,border:"0.5px solid #E5E7EB",marginBottom:8,opacity:hasSales||isNegative?1:0.6,overflow:"hidden"}}>
              <div onClick={()=>setComptaExpandedProd(isExpanded?null:prod.id)}
                style={{padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,userSelect:"none"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:500,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prod.name}</div>
                  <div style={{fontSize:12,color:"#6B7280",marginTop:2}}>
                    {nLiv} livré{nLiv!==1?"s":""}
                    {totalUnits>nLiv && <> · <span style={{color:"#92400E",fontWeight:600}}>{totalUnits} unité{totalUnits!==1?"s":""}</span></>}
                    {" · "}{fmt(ca)} CFA
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                  <span style={{background:badgeBg,color:badgeColor,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:500,display:"inline-block"}}>
                    {hasSales?pct(marge):"—"}
                  </span>
                  {hasSales&&<div style={{fontSize:12,color:badgeColor}}>{fmt(ben)} CFA</div>}
                </div>
                <span style={{color:"#D1D5DB",fontSize:11,flexShrink:0}}>{isExpanded?"▲":"▾"}</span>
              </div>
              {isExpanded&&(
                <div style={{borderTop:"0.5px solid #F3F4F6",background:"#FAFAFA",padding:"12px 14px",display:"flex",flexDirection:"column",gap:8}}>
                  {notConfigured&&(
                    <div style={{background:"#FFFBEB",borderRadius:10,padding:"10px 12px",border:"0.5px solid #FCD34D",marginBottom:4,display:"flex",alignItems:"center",gap:10}}>
                      <AlertTriangle size={16} color="#92400E" style={{flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:"#92400E"}}>Coûts non configurés</div>
                        <div style={{fontSize:11,color:"#A16207",marginTop:1}}>Configure le coût depuis la page Produits pour voir les bénéfices</div>
                      </div>
                      <button onClick={()=>{setExpandedProd(prod.id);setTab("stock");}}
                        style={{background:"#92400E",color:"#fff",border:"none",borderRadius:8,padding:"7px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,display:"inline-flex",alignItems:"center",gap:5}}>
                        <Package size={12}/> Configurer →
                      </button>
                    </div>
                  )}
                  {[
                    {l:"Chiffre d'affaires",   v:`${fmt(ca)} F`,         c:"#111827"},
                    {l:"Coût livraison",       v:`− ${fmt(frais)} F`,    c:"#DC2626"},
                    {l:"Coût produits (CAMV)", v:`− ${fmt(camv)} F`,     c:"#DC2626"},
                    {l:"Coût pub",             v:`− ${fmt(pub)} F`,      c:"#DC2626"},
                    {l:"Frais additionnels",   v:`− ${fmt(echouees)} F`, c:"#DC2626"},
                  ].map(({l,v,c},i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"0.5px solid #F3F4F6"}}>
                      <span style={{fontSize:12,color:"#6B7280"}}>{l}</span>
                      <span style={{fontSize:13,fontWeight:500,color:c}}>{v}</span>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:ben>=0?"#F0FDF4":"#FEF2F2",borderRadius:8,marginTop:4}}>
                    <span style={{fontSize:12,fontWeight:700,color:ben>=0?"#166534":"#991B1B"}}>Bénéfice total</span>
                    <span style={{fontSize:14,fontWeight:800,color:ben>=0?"#166534":"#991B1B"}}>{fmt(ben)} F</span>
                  </div>
                  {nRej>0&&(
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"0.5px solid #F3F4F6"}}>
                      <span style={{fontSize:12,color:"#6B7280"}}>Commandes rejetées</span>
                      <span style={{background:"#FEF2F2",color:"#dc2626",borderRadius:12,padding:"2px 8px",fontSize:12,fontWeight:500}}>{nRej}</span>
                    </div>
                  )}
                  {!notConfigured&&(
                    <button onClick={()=>{setExpandedProd(prod.id);setTab("stock");}}
                      style={{alignSelf:"flex-start",background:"#F3F4F6",color:"#374151",border:"none",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:500,cursor:"pointer",marginTop:2,display:"inline-flex",alignItems:"center",gap:5}}>
                      <Pencil size={12}/> Modifier dans Produits →
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Section 5: Daily inputs (Pub, Échecs, Cash livreurs) ── */}
      {(()=>{
        const recu = parseInt(cashRemis||0);
        const diff = comptaCA - recu;
        const _fmtDay = d => new Date(d+"T12:00:00Z").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
        const isToday      = comptaPeriodMode==="jour" || (comptaPeriodMode==="plage" && dateFrom===TODAY && dateTo===TODAY);
        const isMultiDay   = comptaPeriodMode==="semaine" || comptaPeriodMode==="mois" || (comptaPeriodMode==="plage" && dateFrom!==dateTo);
        const isPastSingle = !isToday && !isMultiDay;
        const readOnly     = isMultiDay;
        const sectionTitle = isToday ? "SAISIES DU JOUR"
          : isPastSingle ? `SAISIES DU ${_fmtDay(dateFrom||TODAY).toUpperCase()}`
          : "SAISIES";
        const inputBaseStyle = {border:"0.5px solid #E5E7EB",borderRadius:8,padding:"5px 8px",fontSize:13,outline:"none",textAlign:"right",background:"#FAFAFA"};
        const inputStyle = readOnly ? {...inputBaseStyle,background:"#F3F4F6",color:"#9CA3AF",cursor:"not-allowed"} : inputBaseStyle;
        return (
          <div>
            <div style={{fontSize:11,fontWeight:600,color:"#4B5563",letterSpacing:"0.07em",marginBottom:8,paddingLeft:2}}>{sectionTitle}</div>
            {isPastSingle && (
              <div style={{background:"#FFFBEB",borderLeft:"3px solid #F59E0B",borderRadius:8,padding:"10px 12px",marginBottom:8,display:"flex",alignItems:"flex-start",gap:8}}>
                <AlertTriangle size={16} color="#92400E" style={{flexShrink:0,marginTop:1}}/>
                <div style={{flex:1,minWidth:0,fontSize:12,color:"#92400E",lineHeight:1.45}}>
                  <div style={{fontWeight:700,marginBottom:2}}>Tu modifies les saisies du {_fmtDay(dateFrom||TODAY)}</div>
                  <div style={{fontSize:11,color:"#A16207"}}>Ces valeurs ont déjà été enregistrées. Toute modification écrasera les données précédentes de ce jour.</div>
                </div>
              </div>
            )}
            {isMultiDay && (
              <div style={{background:"#F3F4F6",borderLeft:"3px solid #9CA3AF",borderRadius:8,padding:"10px 12px",marginBottom:8,display:"flex",alignItems:"flex-start",gap:8}}>
                <AlertTriangle size={16} color="#4B5563" style={{flexShrink:0,marginTop:1}}/>
                <div style={{flex:1,minWidth:0,fontSize:12,color:"#374151",lineHeight:1.45}}>
                  <div style={{fontWeight:700,marginBottom:2}}>Saisies en lecture seule</div>
                  <div style={{fontSize:11,color:"#6B7280"}}>Sélectionne un jour précis (Aujourd'hui ou Hier) pour modifier les saisies.</div>
                </div>
              </div>
            )}
            <div style={{background:"#fff",borderRadius:12,border:"0.5px solid #E5E7EB",overflow:"hidden"}}>
              {comptaCalcProd.map(({prod,nLiv,nRej},idx)=>{
                const notConfigured = !prod.cost||prod.cost===0;
                return (
                <div key={prod.id} style={{borderBottom:idx<comptaCalcProd.length-1?"1px solid #E5E7EB":"none"}}>
                  {/* Product section header (warning state if no cost) */}
                  {notConfigured ? (
                    <div style={{padding:"10px 14px",background:"#FFFBEB",borderBottom:"0.5px solid #FCD34D",display:"flex",alignItems:"center",gap:10}}>
                      <AlertTriangle size={16} color="#92400E" style={{flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#92400E"}}>Coûts non configurés</div>
                        <div style={{fontSize:12,color:"#92400E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prod.name}</div>
                      </div>
                      <button onClick={()=>{setExpandedProd(prod.id);setTab("stock");}}
                        style={{background:"#FEF3C7",color:"#92400E",border:"0.5px solid #FCD34D",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,display:"inline-flex",alignItems:"center",gap:4}}>
                        <Package size={11}/> Configurer →
                      </button>
                    </div>
                  ) : (
                    <div style={{padding:"9px 14px 7px",background:"#F9FAFB",borderBottom:"0.5px solid #F3F4F6",display:"flex",alignItems:"center",gap:8}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prod.name}</div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <span style={{background:"#F0FDF4",color:"#166534",borderRadius:12,padding:"2px 8px",fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",gap:3}}><Check size={12}/> {nLiv}</span>
                        <span style={{background:"#FEF2F2",color:"#991B1B",borderRadius:12,padding:"2px 8px",fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",gap:3}}><X size={12}/> {nRej}</span>
                      </div>
                    </div>
                  )}
                  {/* Pub input */}
                  <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                    <Megaphone size={15} color="#4B5563" style={{flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:"#4B5563"}}>Pub</div>
                      <div style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>Meta · TikTok · Google Ads · Influencer · SMS/WhatsApp</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                      <input type="number" min="0" value={adSpend[prod.id]||""}
                        onChange={e=>setAdSpend(p=>({...p,[prod.id]:e.target.value}))}
                        onBlur={()=>localStorage.setItem("teamly_ad_spend",JSON.stringify(adSpend))}
                        placeholder="0" readOnly={readOnly}
                        style={{...inputStyle,width:84}}/>
                      {adSpend[prod.id]&&<div style={{fontSize:10,color:"#6B7280"}}>= {fmt(parseFloat(adSpend[prod.id]||0))} CFA</div>}
                    </div>
                  </div>
                  {/* Frais échecs input */}
                  <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,borderTop:"0.5px solid #F3F4F6"}}>
                    <Ban size={15} color="#4B5563" style={{flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:"#4B5563"}}>Frais extra</div>
                      <div style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>Échec livraison · Produit endommagé · Frais transfert (Wave/Orange Money)</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                      <input type="number" min="0" value={livraisonsEchouees[prod.id]||""}
                        onChange={e=>setLivraisonsEchouees(p=>({...p,[prod.id]:e.target.value}))}
                        onBlur={()=>localStorage.setItem("teamly_echecs",JSON.stringify(livraisonsEchouees))}
                        placeholder="0" readOnly={readOnly}
                        style={{...inputStyle,width:84}}/>
                      {livraisonsEchouees[prod.id]&&<div style={{fontSize:10,color:"#6B7280"}}>= {fmt(parseFloat(livraisonsEchouees[prod.id]||0))} CFA</div>}
                    </div>
                  </div>
                </div>
                );
              })}
              <div style={{padding:"12px 14px",display:"flex",alignItems:"flex-start",gap:10}}>
                <Banknote size={15} color="#4B5563" style={{flexShrink:0,marginTop:2}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,color:"#111827"}}>Cash livreurs</div>
                  <div style={{fontSize:11,color:"#9CA3AF",marginTop:1}}>Total reçu en main propre</div>
                  {cashRemis&&(
                    <div style={{fontSize:11,marginTop:4,color:diff>0?"#dc2626":diff<0?"#d97706":"#16a34a"}}>
                      Diff. CA: {diff===0?<><Check size={11} style={{display:"inline",verticalAlign:"-2px"}}/> En ordre</>:`${diff>0?"−":"+"}${fmt(Math.abs(diff))} F`}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                  <input type="number" min="0" value={cashRemis||""} onChange={e=>setCashRemis(e.target.value)} placeholder="0" readOnly={readOnly}
                    style={{...inputStyle,width:100}}/>
                  {cashRemis&&<div style={{fontSize:10,color:"#9CA3AF"}}>{fmt(parseInt(cashRemis||0))} CFA</div>}
                </div>
              </div>
            </div>
            <button onClick={saveComptaInputs} disabled={savingCompta||readOnly}
              style={{width:"100%",background:(savingCompta||readOnly)?"#9CA3AF":G.green,color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontSize:14,fontWeight:600,cursor:(savingCompta||readOnly)?"not-allowed":"pointer",marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {savingCompta ? <>⏳ Enregistrement…</> : readOnly ? <>Lecture seule</> : <><Check size={15}/> Enregistrer les saisies</>}
            </button>
            <div style={{fontSize:10,color:"#9CA3AF",textAlign:"center",marginTop:6,fontStyle:"italic"}}>
              Les valeurs sont partagées avec le Closer si la Compta lui est accessible.
            </div>
          </div>
        );
      })()}

      {/* ── Section 6: Export button ── */}
      {(()=>{
        const doExport=(type)=>{
          const period=dateFrom===dateTo?dateFrom:`${dateFrom||"debut"}_${dateTo||"fin"}`;
          const bn=(settings.boutique||"Teamly").replace(/[^\w]/g,"_");
          const STATUS_FR={pendiente:"En attente",confirmado:"Confirmé",livreur_en_route:"Livreur en route",colis_pris:"Colis pris",en_camino:"En route",chez_client:"Chez client",entregado:"Livré",rechazado:"Rejeté",no_contesta:"Absent",reprogramar:"Reporté"};
          const rows=[
            [`Rapport Comptabilité — ${settings.boutique||"Teamly"}`,`Période : ${period}`,"","","","","","","",""],
            [],
            ["RÉSUMÉ GLOBAL"],
            ["CA Total (CFA)",comptaCA,"Bénéfice Net (CFA)",comptaBen,"Marge",Math.round(comptaMarge*100)+"%"],
            ["CAMV Total (CFA)",comptaCamv,"Frais Livraison (CFA)",comptaFrais,"Pub Total (CFA)",comptaPub],
            [],
            ["PAR PRODUIT"],
            ["Produit","Livrés","Rejetés","CA (CFA)","CAMV (CFA)","Frais (CFA)","Pub (CFA)","Échouées (CFA)","Bénéfice (CFA)","Marge %"],
            ...comptaCalcProd.map(({prod,nLiv,nRej,ca,camv,frais,echouees,pub,ben,marge})=>[prod.name,nLiv,nRej,ca,camv,frais,pub,echouees,ben,Math.round(marge*100)+"%"]),
            ["TOTAL","","",comptaCA,comptaCamv,comptaFrais,comptaPub,"",comptaBen,Math.round(comptaMarge*100)+"%"],
            [],
            ["COMMANDES"],
            ["Date","Client","Téléphone","Produit","Prix (CFA)","Statut","Livreur","Closer"],
            ...comptaOrders.map(o=>[o.created_at?.slice(0,10)||"",o.client||"",o.phone||"",o.product||"",o.price||0,STATUS_FR[o.status]||o.status||"",o.livreur||"",o.closer||""]),
          ];
          if(type==="csv"){
            const csv="﻿"+rows.map(r=>r.map(c=>`"${String(c==null?"":c).replace(/"/g,'""')}"`).join(";")).join("\r\n");
            const a=Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),download:`compta_${bn}_${period}.csv`});
            document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
          } else {
            const tr=r=>`<tr>${r.map(c=>`<td>${String(c==null?"":c).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</td>`).join("")}</tr>`;
            const xls=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Compta</x:Name><x:WorksheetOptions/></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml></head><body><table>${rows.map(tr).join("")}</table></body></html>`;
            const a=Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([xls],{type:"application/vnd.ms-excel;charset=utf-8"})),download:`compta_${bn}_${period}.xls`});
            document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
          }
          setComptaExportOpen(false);
        };
        return (
          <div style={{position:"relative",paddingBottom:4}}>
            <button onClick={()=>setComptaExportOpen(o=>!o)}
              style={{width:"100%",background:"#fff",color:"#374151",border:"0.5px solid #E5E7EB",borderRadius:12,padding:"13px 0",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Download size={14}/> Exporter le rapport
            </button>
            {comptaExportOpen&&(
              <div style={{position:"absolute",bottom:"calc(100% + 6px)",left:0,right:0,background:"#fff",border:"0.5px solid #E5E7EB",borderRadius:12,boxShadow:"0 4px 16px rgba(0,0,0,0.10)",overflow:"hidden",zIndex:300}}>
                {[["csv","CSV (.csv)",FileText],["xls","Excel (.xls)",BarChart3]].map(([t,l,Ico])=>(
                  <button key={t} onClick={()=>doExport(t)}
                    style={{width:"100%",background:"transparent",border:"none",borderBottom:t==="csv"?"0.5px solid #F3F4F6":"none",padding:"12px 16px",fontSize:13,color:"#374151",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
                    <Ico size={14}/> {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
};
