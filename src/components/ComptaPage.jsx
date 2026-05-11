import React from "react";
import { useAppContext } from "../context/AppContext";
import { _parseCity } from "../lib/senegal";

export const ComptaPage = () => {
  const {
    G, fmt, pct, FRAIS_LIV, TODAY, sbFetch,
    _COMPTA_FILTERS_DEFAULT,
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
    addToast,
  } = useAppContext();

  return (
    <div style={{display:"flex",flexDirection:"column",gap:10,maxWidth:600,margin:"0 auto",width:"100%"}}>

      {/* ── Filter bar ── */}
      {(()=>{
        const cf = comptaFilters;
        const activeCount = cf.produits.length+(cf.livraisonType!=="all"?1:0)+(cf.source!=="all"?1:0)+cf.livreurs.length+(cf.region?1:0)+(!(cf.statuts.length===1&&cf.statuts[0]==="entregado")?1:0);
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
                          style={{background:active?"#1E40AF":"#F3F4F6",color:active?"#fff":"#374151",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:active?500:400}}>{p.name}{active?" ✕":""}</button>;
                      })}
                    </div>
                  </div>
                )}

                {/* Type livraison */}
                <div>
                  <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.06em",marginBottom:6}}>TYPE DE LIVRAISON</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {[["all","Tous"],["locale_moto","🏍️ Locale Moto"],["regionale_voiture","🚐 Régionale Voiture"]].map(([k,l])=>(
                      <button key={k} onClick={()=>setComptaFilters(f=>({...f,livraisonType:k}))}
                        style={{background:cf.livraisonType===k?"#111827":"#F3F4F6",color:cf.livraisonType===k?"#fff":"#374151",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:cf.livraisonType===k?500:400}}>{l}</button>
                    ))}
                  </div>
                </div>

                {/* Statut */}
                <div>
                  <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.06em",marginBottom:6}}>STATUT COMMANDE</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {[["entregado","✅ Livré"],["rechazado","❌ Rejeté"],["no_contesta","📵 Échec"],["reprogramar","🔄 Retourné"]].map(([k,l])=>{
                      const active=cf.statuts.includes(k);
                      return <button key={k} onClick={()=>setComptaFilters(f=>({...f,statuts:active?f.statuts.filter(x=>x!==k):[...f.statuts,k]}))}
                        style={{background:active?"#111827":"#F3F4F6",color:active?"#fff":"#374151",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:active?500:400}}>{l}</button>;
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
                          style={{background:active?"#1E40AF":"#F3F4F6",color:active?"#fff":"#374151",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:active?500:400}}>🏍️ {m.nom}{active?" ✕":""}</button>;
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
                      {mainRegion?.name&&<option value={mainRegion.name}>🟢 {mainRegion.name} (principale)</option>}
                      {otherRegions.map(r=><option key={r.id} value={r.name}>🔵 {r.name}</option>)}
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
                  style={{background:"#DBEAFE",color:"#1E40AF",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer"}}>{p} ✕</span>)}
                {cf.livraisonType!=="all"&&<span onClick={()=>setComptaFilters(f=>({...f,livraisonType:"all"}))}
                  style={{background:"#F0FDF4",color:"#16a34a",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer"}}>{cf.livraisonType==="locale_moto"?"🏍️ Locale":"🚐 Régionale"} ✕</span>}
                {cf.source!=="all"&&<span onClick={()=>setComptaFilters(f=>({...f,source:"all"}))}
                  style={{background:"#FEF3C7",color:"#92400E",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer"}}>{cf.source==="shopify"?"Shopify":"Manuel"} ✕</span>}
                {cf.livreurs.map(l=><span key={l} onClick={()=>setComptaFilters(f=>({...f,livreurs:f.livreurs.filter(x=>x!==l)}))}
                  style={{background:"#EDE9FE",color:"#5B21B6",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer"}}>🏍️ {l} ✕</span>)}
                {cf.ville&&<span onClick={()=>setComptaFilters(f=>({...f,ville:"",region:""}))}
                  style={{background:"#FEF9C3",color:"#713F12",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer"}}>📍 {cf.ville} ✕</span>}
                {!cf.ville&&cf.region&&<span onClick={()=>setComptaFilters(f=>({...f,region:""}))}
                  style={{background:"#FEF9C3",color:"#713F12",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer"}}>📍 {cf.region} ✕</span>}
                {!(cf.statuts.length===1&&cf.statuts[0]==="entregado")&&<span onClick={()=>setComptaFilters(f=>({...f,statuts:["entregado"]}))}
                  style={{background:"#F3F4F6",color:"#374151",borderRadius:10,padding:"2px 9px",fontSize:11,cursor:"pointer"}}>Statuts ✕</span>}
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
                {l:"CA",        v:`${fmt(comptaCA)} F`},
                {l:"Coûts",     v:`${fmt(totalCouts)} F`},
                {l:"Pub",       v:`${fmt(comptaPub)} F`},
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

      {/* ── Section 3: Alerts for products with missing cost config ── */}
      {comptaCalcProd.filter(x=>!x.prod.cost||x.prod.cost===0).map(({prod})=>(
        <div key={prod.id} style={{background:"#FFFBEB",border:"0.5px solid #FCD34D",borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16,flexShrink:0}}>⚠️</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:500,color:"#92400E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prod.name}</div>
            <div style={{fontSize:11,color:"#A16207"}}>Coûts non configurés</div>
          </div>
          <button onClick={()=>{setComptaExpandedProd(prod.id);setComptaCostEdit(p=>({...p,[prod.id]:p[prod.id]||{cost:prod.cost||"",fraisLiv:prod.fraisLiv||""}}));}}
            style={{background:"#FEF3C7",color:"#92400E",border:"0.5px solid #FCD34D",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
            Config
          </button>
        </div>
      ))}

      {/* ── Section 4: Product rows (compact, expandable) ── */}
      <div>
        <div style={{fontSize:11,fontWeight:600,color:"#4B5563",letterSpacing:"0.07em",marginBottom:8,paddingLeft:2}}>PRODUITS</div>
        {comptaCalcProd.map(({prod,nLiv,nRej,ca,camv,frais,echouees,pub,ben,marge,zoneBreakdown})=>{
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
                  <div style={{fontSize:12,color:"#6B7280",marginTop:2}}>{nLiv} livré{nLiv!==1?"s":""} · {fmt(ca)} CFA</div>
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
                  {(notConfigured||!!comptaCostEdit[prod.id])&&(()=>{
                    const liveCost  = parseFloat(String(costEdit.cost||"").replace(",","."))||0;
                    const liveFrais = parseInt(costEdit.fraisLiv||0)||0;
                    const liveMarge = (prod.price||0) - liveCost - liveFrais;
                    const isSaving  = costEdit.saving === true;
                    return (
                    <div style={{background:"#FFFBEB",borderRadius:10,padding:"14px",border:"0.5px solid #FCD34D",marginBottom:4}}>
                      <div style={{fontSize:13,color:"#92400E",fontWeight:700,marginBottom:2}}>{notConfigured?"⚠️ Coûts non configurés":"✏️ Modifier les coûts"}</div>
                      <div style={{fontSize:11,color:"#A16207",marginBottom:12}}>{prod.name}</div>
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        {/* Field 1 — Coût total */}
                        <div>
                          <div style={{fontSize:11,fontWeight:700,color:"#92400E",marginBottom:2}}>💰 Coût total du produit</div>
                          <div style={{fontSize:10,color:"#A16207",marginBottom:2}}>Inclure: prix d'achat + import + douane + transport + emballage</div>
                          <div style={{fontSize:10,color:"#A16207",marginBottom:4,fontStyle:"italic"}}>Synchronisé avec 📦 Gestion de produit</div>
                          <div style={{position:"relative"}}>
                            <input type="number" min="0" placeholder="Ex: 7000"
                              value={costEdit.cost??""} onChange={e=>setComptaCostEdit(p=>({...p,[prod.id]:{...costEdit,cost:e.target.value}}))}
                              style={{width:"100%",border:"0.5px solid #FCD34D",borderRadius:8,padding:"8px 28px 8px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                            <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#A16207",fontWeight:600,pointerEvents:"none"}}>F</span>
                          </div>
                        </div>
                        {/* Field 2 — Frais de livraison */}
                        <div>
                          <div style={{fontSize:11,fontWeight:700,color:"#92400E",marginBottom:2}}>🚚 Frais de livraison</div>
                          <div style={{fontSize:10,color:"#A16207",marginBottom:4}}>Synchronisé avec 🚚 Zones de livraison</div>
                          <div style={{position:"relative"}}>
                            <input type="number" min="0" placeholder="Ex: 1500"
                              value={costEdit.fraisLiv??""} onChange={e=>setComptaCostEdit(p=>({...p,[prod.id]:{...costEdit,fraisLiv:e.target.value}}))}
                              style={{width:"100%",border:"0.5px solid #FCD34D",borderRadius:8,padding:"8px 28px 8px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                            <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#A16207",fontWeight:600,pointerEvents:"none"}}>F</span>
                          </div>
                        </div>
                        {/* Read-only — Marge calculée */}
                        <div style={{background:"#F3F4F6",borderRadius:8,padding:"10px 12px",border:"0.5px solid #E5E7EB"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span style={{fontSize:11,color:"#6B7280",fontWeight:600}}>💰 Marge par unité (calculée)</span>
                            <span style={{fontSize:15,fontWeight:800,color:liveMarge>=0?G.green:"#DC2626"}}>{fmt(liveMarge)} CFA</span>
                          </div>
                          <div style={{fontSize:10,color:"#9CA3AF",marginTop:3}}>Prix de vente − CAMV − Livraison</div>
                        </div>
                        <div style={{display:"flex",gap:6,marginTop:4}}>
                          <button disabled={isSaving} onClick={async()=>{
                            const newCost=parseFloat(String(costEdit.cost||"").replace(",","."));
                            const newFrais=parseInt(costEdit.fraisLiv||0)||0;
                            if(!newCost||newCost<=0){addToast("Entre le coût du produit","⚠️","#F59E0B");return;}
                            setComptaCostEdit(p=>({...p,[prod.id]:{...costEdit,saving:true}}));
                            try {
                              await sbFetch(`products?id=eq.${prod.id}`,"PATCH",{cost:newCost,frais_liv:newFrais});
                              setProducts(prev=>prev.map(x=>x.id===prod.id?{...x,cost:newCost,fraisLiv:newFrais}:x));
                              setComptaCostEdit(p=>({...p,[prod.id]:undefined}));
                              addToast("✅ Coûts mis à jour","✅",G.green);
                            } catch(e) {
                              console.error("cost save:",e.message);
                              setComptaCostEdit(p=>({...p,[prod.id]:{...costEdit,saving:false}}));
                              addToast("❌ Erreur — réessayer","❌",G.red);
                            }
                          }} style={{flex:1,background:isSaving?"#9CA3AF":"#16a34a",color:"#fff",border:"none",borderRadius:8,padding:"10px 0",fontWeight:600,fontSize:13,cursor:isSaving?"not-allowed":"pointer"}}>
                            {isSaving?"Enregistrement…":"✅ Enregistrer"}
                          </button>
                          {!notConfigured&&<button disabled={isSaving} onClick={()=>setComptaCostEdit(p=>({...p,[prod.id]:undefined}))}
                            style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#6B7280",cursor:"pointer"}}>Annuler</button>}
                        </div>
                      </div>
                    </div>
                    );
                  })()}
                  {[
                    {l:"CAMV (coûts produits)", v:`${fmt(camv)} F`},
                    {l:"Frais livraison",        v:`${fmt(frais)} F`},
                    {l:"Marge par unité",        v:`${fmt(prod.price-(prod.cost||0)-(prod.fraisLiv||FRAIS_LIV))} F`},
                  ].map(({l,v},i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"0.5px solid #F3F4F6"}}>
                      <span style={{fontSize:12,color:"#6B7280"}}>{l}</span>
                      <span style={{fontSize:13,fontWeight:500,color:"#111827"}}>{v}</span>
                    </div>
                  ))}
                  {zoneBreakdown.length>0&&(
                    <div style={{background:"#F8FAFC",borderRadius:8,padding:"8px 10px",border:"0.5px solid #E2E8F0",marginTop:2}}>
                      <div style={{fontSize:10,color:"#9CA3AF",letterSpacing:"0.06em",marginBottom:6}}>RÉPARTITION PAR ZONE</div>
                      {zoneBreakdown.map(({zone:z,count})=>(
                        <div key={z.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                          <div style={{display:"flex",alignItems:"center",gap:5}}>
                            <span style={{fontSize:11}}>{z.flag}</span>
                            <span style={{fontSize:12,color:"#374151"}}>{z.label}</span>
                            {z.prepaid&&<span style={{background:"#FEF3C7",color:"#92400E",borderRadius:4,padding:"0 5px",fontSize:9}}>PRÉPAYÉ</span>}
                          </div>
                          <span style={{fontSize:12,color:"#6B7280"}}>{count} · {fmt(count*z.price)} CFA</span>
                        </div>
                      ))}
                      <div style={{display:"flex",justifyContent:"space-between",paddingTop:5,marginTop:4,borderTop:"0.5px solid #E2E8F0"}}>
                        <span style={{fontSize:12,color:"#374151"}}>Total livraison</span>
                        <span style={{fontSize:12,fontWeight:500,color:"#111827"}}>{fmt(frais)} CFA</span>
                      </div>
                    </div>
                  )}
                  {nRej>0&&(
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"0.5px solid #F3F4F6"}}>
                      <span style={{fontSize:12,color:"#6B7280"}}>Commandes rejetées</span>
                      <span style={{background:"#FEF2F2",color:"#dc2626",borderRadius:12,padding:"2px 8px",fontSize:12,fontWeight:500}}>{nRej}</span>
                    </div>
                  )}
                  {!notConfigured&&!comptaCostEdit[prod.id]&&(
                    <button onClick={()=>setComptaCostEdit(p=>({...p,[prod.id]:{cost:prod.cost||"",fraisLiv:prod.fraisLiv||""}}))}
                      style={{alignSelf:"flex-start",background:"#F3F4F6",color:"#374151",border:"none",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:500,cursor:"pointer",marginTop:2}}>
                      ✏️ Modifier coûts
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
        return (
          <div>
            <div style={{fontSize:11,fontWeight:600,color:"#4B5563",letterSpacing:"0.07em",marginBottom:8,paddingLeft:2}}>SAISIES DU JOUR</div>
            <div style={{background:"#fff",borderRadius:12,border:"0.5px solid #E5E7EB",overflow:"hidden"}}>
              {comptaCalcProd.map(({prod},idx)=>(
                <div key={prod.id} style={{borderBottom:idx<comptaCalcProd.length-1?"1px solid #E5E7EB":"none"}}>
                  {/* Product section header */}
                  <div style={{padding:"9px 14px 6px",background:"#F9FAFB",borderBottom:"0.5px solid #F3F4F6"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prod.name}</div>
                  </div>
                  {/* Pub input */}
                  <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:15,flexShrink:0}}>📣</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:"#4B5563"}}>Pub</div>
                      <div style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>Meta · TikTok · Google Ads · Influencer · SMS/WhatsApp</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                      <input type="number" min="0" value={adSpend[prod.id]||""}
                        onChange={e=>setAdSpend(p=>({...p,[prod.id]:e.target.value}))}
                        onBlur={()=>localStorage.setItem("teamly_ad_spend",JSON.stringify(adSpend))}
                        placeholder="0"
                        style={{width:84,border:"0.5px solid #E5E7EB",borderRadius:8,padding:"5px 8px",fontSize:13,outline:"none",textAlign:"right",background:"#FAFAFA"}}/>
                      {adSpend[prod.id]&&<div style={{fontSize:10,color:"#6B7280"}}>= {fmt(parseFloat(adSpend[prod.id]||0))} CFA</div>}
                    </div>
                  </div>
                  {/* Frais échecs input */}
                  <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,borderTop:"0.5px solid #F3F4F6"}}>
                    <span style={{fontSize:15,flexShrink:0}}>🚫</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:"#4B5563"}}>Frais extra</div>
                      <div style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>Échec livraison · Produit endommagé · Frais transfert (Wave/Orange Money)</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                      <input type="number" min="0" value={livraisonsEchouees[prod.id]||""}
                        onChange={e=>setLivraisonsEchouees(p=>({...p,[prod.id]:e.target.value}))}
                        onBlur={()=>localStorage.setItem("teamly_echecs",JSON.stringify(livraisonsEchouees))}
                        placeholder="0"
                        style={{width:84,border:"0.5px solid #E5E7EB",borderRadius:8,padding:"5px 8px",fontSize:13,outline:"none",textAlign:"right",background:"#FAFAFA"}}/>
                      {livraisonsEchouees[prod.id]&&<div style={{fontSize:10,color:"#6B7280"}}>= {fmt(parseFloat(livraisonsEchouees[prod.id]||0))} CFA</div>}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{padding:"12px 14px",display:"flex",alignItems:"flex-start",gap:10}}>
                <span style={{fontSize:15,flexShrink:0,marginTop:2}}>💵</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,color:"#111827"}}>Cash livreurs</div>
                  <div style={{fontSize:11,color:"#9CA3AF",marginTop:1}}>Total reçu en main propre</div>
                  {cashRemis&&(
                    <div style={{fontSize:11,marginTop:4,color:diff>0?"#dc2626":diff<0?"#d97706":"#16a34a"}}>
                      Diff. CA: {diff===0?"✓ En ordre":`${diff>0?"−":"+"}${fmt(Math.abs(diff))} F`}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                  <input type="number" min="0" value={cashRemis||""} onChange={e=>setCashRemis(e.target.value)} placeholder="0"
                    style={{width:100,border:"0.5px solid #E5E7EB",borderRadius:8,padding:"5px 8px",fontSize:13,outline:"none",textAlign:"right",background:"#FAFAFA"}}/>
                  {cashRemis&&<div style={{fontSize:10,color:"#9CA3AF"}}>{fmt(parseInt(cashRemis||0))} CFA</div>}
                </div>
              </div>
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
              ⬇️ Exporter le rapport
            </button>
            {comptaExportOpen&&(
              <div style={{position:"absolute",bottom:"calc(100% + 6px)",left:0,right:0,background:"#fff",border:"0.5px solid #E5E7EB",borderRadius:12,boxShadow:"0 4px 16px rgba(0,0,0,0.10)",overflow:"hidden",zIndex:300}}>
                {[["csv","📄 CSV (.csv)"],["xls","📊 Excel (.xls)"]].map(([t,l])=>(
                  <button key={t} onClick={()=>doExport(t)}
                    style={{width:"100%",background:"transparent",border:"none",borderBottom:t==="csv"?"0.5px solid #F3F4F6":"none",padding:"12px 16px",fontSize:13,color:"#374151",cursor:"pointer",textAlign:"left",display:"block"}}>
                    {l}
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
