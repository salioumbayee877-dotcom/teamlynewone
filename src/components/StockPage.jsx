import React, { useState } from "react";
import { useAppContext } from "../context/AppContext";
import { Package, AlertTriangle, TrendingUp, Coins, Pencil, Gift, Plus, Check, ClipboardList, Truck, Info } from "lucide-react";

export const StockPage = () => {
  const {
    G, fmt, FRAIS_LIV, ST, Tbl, sbFetch,
    role, products, orders,
    expandedProd, stockAjout,
    setEditProd, setExpandedProd, setStockAjout, setShowAddProd, setProducts,
    setTab, addToast,
  } = useAppContext();
  const [costEdit, setCostEdit] = useState({});

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontWeight:700,fontSize:15,color:G.dark,display:"flex",alignItems:"center",gap:6}}><Package size={16}/> Gestion des produits</div>
          <div style={{fontSize:11,color:G.gray,marginTop:2}}>Stock = initial − commandes livrées (automatique)</div>
        </div>
        {(role==="admin"||role==="closer")&&<button onClick={()=>setShowAddProd(true)} style={{background:G.gold,border:"none",borderRadius:9,padding:"8px 12px",fontSize:12,fontWeight:700,color:G.dark,cursor:"pointer"}}>+ Produit</button>}
      </div>

      {/* Alerte stock bas */}
      {products.filter(p=>p.stock<5).length>0&&(
        <div style={{background:"#FEF2F2",borderRadius:12,padding:"10px 14px",border:`1px solid #FCA5A5`}}>
          <div style={{fontSize:12,color:G.red,fontWeight:700,display:"flex",alignItems:"center",gap:5}}><AlertTriangle size={13}/> Stock bas !</div>
          {products.filter(p=>p.stock<5).map(p=><div key={p.id} style={{fontSize:11,color:G.red}}>· {p.name} : {p.stock} restants</div>)}
        </div>
      )}

      {/* Alerte coûts non configurés */}
      {products.filter(p=>!p.cost||p.cost===0).length>0&&(
        <div style={{background:"#FFFBEB",borderRadius:12,padding:"12px 14px",border:"1px solid #FCD34D"}}>
          <div style={{fontSize:12,color:"#92400E",fontWeight:700,display:"flex",alignItems:"center",gap:5,marginBottom:6}}><AlertTriangle size={13}/> Coûts non configurés</div>
          <div style={{fontSize:11,color:"#A16207",marginBottom:8}}>Sans coût, la comptabilité ne peut pas calculer ton bénéfice.</div>
          {products.filter(p=>!p.cost||p.cost===0).map(p=>(
            <button key={p.id} onClick={()=>{setExpandedProd(p.id);setCostEdit(s=>({...s,[p.id]:s[p.id]||{cost:""}}));}}
              style={{display:"block",width:"100%",textAlign:"left",background:"#fff",border:"0.5px solid #FCD34D",borderRadius:8,padding:"6px 10px",fontSize:11,color:"#92400E",fontWeight:600,cursor:"pointer",marginTop:4}}>
              · {p.name} → Configurer
            </button>
          ))}
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

        const nTot  = orders.filter(o=>o.product?.startsWith(prod.name)).length;
        const nCours= orders.filter(o=>o.product?.startsWith(prod.name)&&["confirmado","livreur_en_route","colis_pris","en_camino","chez_client"].includes(o.status)).length;
        const caTotal = orders.filter(o=>o.product?.startsWith(prod.name)&&o.status==="entregado").reduce((a,o)=>a+o.price,0);
        const tauxLiv = nTot>0?Math.round(nLiv/nTot*100):0;
        const margeU  = prod.price-(prod.cost||0);
        const isExpanded = expandedProd===prod.id;

        return (
          <div key={prod.id} style={{background:G.white,borderRadius:14,overflow:"hidden",borderLeft:`4px solid ${stockColor}`,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>

            {/* Header cliquable */}
            <div onClick={()=>setExpandedProd(isExpanded?null:prod.id)} style={{padding:15,cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:15,color:G.dark,marginBottom:4}}>{prod.name}</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  <span style={{background:stockReel<5?"#FEE2E2":stockReel<15?"#FFF8E7":G.greenLight,borderRadius:6,padding:"2px 7px",fontSize:10,color:stockColor,fontWeight:600,display:"inline-flex",alignItems:"center",gap:3}}>
                    <Package size={11}/> {stockReel} restants
                  </span>
                  <span style={{background:"#EFF6FF",color:G.blue,borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:600,display:"inline-flex",alignItems:"center",gap:3}}>
                    <TrendingUp size={11}/> {tauxLiv}% livraison
                  </span>
                  <span style={{background:G.greenLight,color:G.green,borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:600,display:"inline-flex",alignItems:"center",gap:3}}>
                    <Coins size={11}/> {fmt(caTotal)} F CA
                  </span>
                </div>
              </div>
              <div style={{display:"flex",gap:5,marginLeft:8,flexShrink:0,alignItems:"center"}}>
                <button onClick={e=>{e.stopPropagation();setEditProd({...prod,nLiv,stockReel});}}
                  style={{background:"#EFF6FF",color:G.blue,border:"none",borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center"}}>
                  <Pencil size={13}/>
                </button>
                <span style={{color:G.gray,fontSize:14}}>{isExpanded?"▲":"▼"}</span>
              </div>
            </div>

            {/* Barre stock */}
            <div style={{marginBottom:4}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontSize:10,color:G.gray}}>Stock: {stockReel} / {stockInitial}</span>
                <span style={{fontSize:10,color:stockColor,fontWeight:600}}>{pct100}%</span>
              </div>
              <div style={{background:G.grayLight,borderRadius:4,height:5,overflow:"hidden"}}>
                <div style={{background:stockColor,height:5,width:`${pct100}%`,borderRadius:4,transition:"width 0.4s"}}/>
              </div>
            </div>
            </div>{/* end header cliquable */}

            {/* ── Vue 360° — visible si expanded ── */}
            {isExpanded&&(
              <div style={{borderTop:`1px solid ${G.grayLight}`,padding:"14px 15px",display:"flex",flexDirection:"column",gap:14}}>

                {/* Modifier les coûts (form inline) */}
                {(()=>{
                  const notConfigured = !prod.cost||prod.cost===0;
                  const edit = costEdit[prod.id];
                  const open = notConfigured || !!edit;
                  if(!open) return (
                    <button onClick={()=>setCostEdit(s=>({...s,[prod.id]:{cost:prod.cost||""}}))}
                      style={{alignSelf:"flex-start",background:"#FFFBEB",color:"#92400E",border:"0.5px solid #FCD34D",borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}>
                      <Pencil size={12}/> Modifier le coût
                    </button>
                  );
                  const liveCost = parseFloat(String(edit?.cost??"").replace(",","."))||0;
                  const liveMarge = (prod.price||0) - liveCost;
                  const isSaving = edit?.saving===true;
                  return (
                    <div style={{background:"#FFFBEB",borderRadius:10,padding:14,border:"0.5px solid #FCD34D"}}>
                      <div style={{fontSize:13,color:"#92400E",fontWeight:700,marginBottom:2,display:"flex",alignItems:"center",gap:6}}>
                        {notConfigured?<><AlertTriangle size={14}/> Coûts non configurés</>:<><Pencil size={14}/> Modifier les coûts</>}
                      </div>
                      <div style={{fontSize:11,color:"#A16207",marginBottom:12}}>{prod.name}</div>

                      {/* Field — Coût total */}
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#92400E",marginBottom:2,display:"flex",alignItems:"center",gap:5}}><Coins size={12}/> Coût total du produit</div>
                        <div style={{fontSize:10,color:"#A16207",marginBottom:6}}>Prix d'achat + import + douane + transport + emballage</div>
                        <div style={{position:"relative"}}>
                          <input type="number" min="0" placeholder="Ex: 7000"
                            value={edit?.cost??""} onChange={e=>setCostEdit(s=>({...s,[prod.id]:{...edit,cost:e.target.value}}))}
                            style={{width:"100%",border:"0.5px solid #FCD34D",borderRadius:8,padding:"9px 28px 9px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                          <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#A16207",fontWeight:600,pointerEvents:"none"}}>F</span>
                        </div>
                      </div>

                      {/* Section — Frais de livraison (lien zones, sin input) */}
                      <div style={{marginBottom:12,background:"#FFF",borderRadius:8,padding:"10px 12px",border:"0.5px solid #FDE68A"}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#92400E",marginBottom:2,display:"flex",alignItems:"center",gap:5}}><Truck size={12}/> Frais de livraison</div>
                        <div style={{fontSize:10,color:"#A16207",marginBottom:8,display:"flex",alignItems:"flex-start",gap:4}}>
                          <Info size={11} style={{marginTop:1,flexShrink:0}}/>
                          <span>Les frais de livraison sont <strong>payés par le client</strong> et <strong>ne sont pas inclus dans ton bénéfice</strong>. Ils se gèrent par zone.</span>
                        </div>
                        <button onClick={()=>setTab("frais")}
                          style={{width:"100%",background:"#EFF6FF",color:"#1E40AF",border:"1px solid #BFDBFE",borderRadius:8,padding:"8px 0",fontSize:12,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}}>
                          <Truck size={13}/> Configurer les zones de livraison →
                        </button>
                      </div>

                      {/* Marge calculée */}
                      <div style={{background:"#F3F4F6",borderRadius:8,padding:"10px 12px",border:"0.5px solid #E5E7EB",marginBottom:12}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontSize:11,color:"#6B7280",fontWeight:600,display:"inline-flex",alignItems:"center",gap:5}}><Coins size={12}/> Marge par unité (calculée)</span>
                          <span style={{fontSize:15,fontWeight:800,color:liveMarge>=0?G.green:"#DC2626"}}>{fmt(liveMarge)} CFA</span>
                        </div>
                        <div style={{fontSize:10,color:"#9CA3AF",marginTop:3}}>Prix de vente − Coût produit (livraison non incluse)</div>
                      </div>

                      <div style={{display:"flex",gap:6}}>
                        <button disabled={isSaving} onClick={async()=>{
                          const newCost = parseFloat(String(edit?.cost||"").replace(",","."));
                          if(!newCost||newCost<=0){addToast&&addToast("Entre le coût du produit","⚠️","#F59E0B");return;}
                          setCostEdit(s=>({...s,[prod.id]:{...edit,saving:true}}));
                          try {
                            await sbFetch(`products?id=eq.${prod.id}`,"PATCH",{cost:newCost});
                            setProducts(prev=>prev.map(x=>x.id===prod.id?{...x,cost:newCost}:x));
                            setCostEdit(s=>({...s,[prod.id]:undefined}));
                            addToast&&addToast("Coût mis à jour","✅",G.green);
                          } catch(e) {
                            setCostEdit(s=>({...s,[prod.id]:{...edit,saving:false}}));
                            addToast&&addToast("Erreur — réessayer","❌",G.red);
                          }
                        }} style={{flex:1,background:isSaving?"#9CA3AF":G.green,color:"#fff",border:"none",borderRadius:8,padding:"10px 0",fontWeight:700,fontSize:13,cursor:isSaving?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}}>
                          {isSaving?"Enregistrement…":<><Check size={14}/> Enregistrer</>}
                        </button>
                        {!notConfigured&&<button disabled={isSaving} onClick={()=>setCostEdit(s=>({...s,[prod.id]:undefined}))}
                          style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#6B7280",cursor:"pointer"}}>Annuler</button>}
                      </div>
                    </div>
                  );
                })()}

                {/* Finances */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:G.gray,letterSpacing:0.5,marginBottom:8,display:"flex",alignItems:"center",gap:5}}><Coins size={12}/> FINANCES</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    {[
                      {l:"Prix de vente",   v:`${fmt(prod.price)} F`,   c:G.dark},
                      {l:"Coût produit",    v:`${fmt(prod.cost||0)} F`, c:"#DC2626"},
                    ].map((s,i)=>(
                      <div key={i} style={{background:G.grayLight,borderRadius:9,padding:"8px 10px"}}>
                        <div style={{fontSize:13,fontWeight:700,color:s.c}}>{s.v}</div>
                        <div style={{fontSize:10,color:G.gray,marginTop:2}}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{background:margeU>=0?G.greenLight:"#FEE2E2",borderRadius:9,padding:"8px 12px",marginTop:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:12,color:G.gray}}>% Marge brute</span>
                    <span style={{fontSize:15,fontWeight:800,color:margeU>=0?G.green:G.red}}>
                      {prod.price>0?Math.round(margeU/prod.price*100):0}%
                    </span>
                  </div>
                </div>

                {/* Performance */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:G.gray,letterSpacing:0.5,marginBottom:8,display:"flex",alignItems:"center",gap:5}}><TrendingUp size={12}/> PERFORMANCE RÉELLE</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:6}}>
                    {[
                      {l:"Total",    v:nTot,  c:G.dark},
                      {l:"Livrées",  v:nLiv,  c:G.green},
                      {l:"Rejetées", v:nRej,  c:G.red},
                      {l:"En cours", v:nCours,c:G.blue},
                      {l:"Taux livr",v:`${tauxLiv}%`,c:tauxLiv>=70?G.green:tauxLiv>=50?"#D97706":G.red},
                      {l:"CA encaissé",v:`${fmt(caTotal)}F`,c:G.green},
                    ].map((s,i)=>(
                      <div key={i} style={{background:G.grayLight,borderRadius:9,padding:"8px 6px",textAlign:"center"}}>
                        <div style={{fontSize:13,fontWeight:700,color:s.c}}>{s.v}</div>
                        <div style={{fontSize:9,color:G.gray,marginTop:2}}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bundles */}
                {(prod.bundles||[]).length>0&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:G.gray,letterSpacing:0.5,marginBottom:6,display:"flex",alignItems:"center",gap:5}}><Gift size={12}/> BUNDLES</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {prod.bundles.map(b=><span key={b.id} style={{background:"#FFF8E7",color:G.gold,borderRadius:7,padding:"3px 9px",fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",gap:4}}><Gift size={11}/> {b.label} — {fmt(b.prixVente)} CFA</span>)}
                    </div>
                  </div>
                )}

                {/* Ajouter stock */}
                <div style={{background:G.greenLight,borderRadius:9,padding:"10px 12px"}}>
                  <div style={{fontSize:11,color:G.green,fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:5}}><Plus size={12}/> Ajouter du stock</div>
                  <div style={{display:"flex",gap:7,alignItems:"center"}}>
                    <input type="number" min="1" value={qty}
                      onChange={e=>setStockAjout(p=>({...p,[prod.id]:e.target.value}))}
                      placeholder="Quantité..."
                      style={{flex:1,border:`1.5px solid ${G.green}`,borderRadius:7,padding:"7px 10px",fontSize:13,outline:"none",boxSizing:"border-box",fontWeight:600}}/>
                    <button onClick={()=>{
                      const q=parseInt(qty||0); if(q<=0) return;
                      setProducts(p=>p.map(x=>x.id===prod.id?{...x,stockInitial:(x.stockInitial||x.stock+nLiv)+q,stock:x.stock+q}:x));
                      if(!String(prod.id).startsWith("tmp_")) sbFetch(`products?id=eq.${prod.id}`,"PATCH",{stock:prod.stock+q,stock_initial:(prod.stockInitial||prod.stock+nLiv)+q});
                      setStockAjout(p=>({...p,[prod.id]:""}));
                    }} style={{background:G.green,color:G.white,border:"none",borderRadius:7,padding:"8px 14px",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:5}}>
                      <Check size={14}/> OK
                    </button>
                  </div>
                  {qty&&parseInt(qty)>0&&<div style={{fontSize:10,color:G.green,marginTop:4}}>→ Nouveau total: <strong>{stockReel+parseInt(qty)}</strong> unités</div>}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Tableau récap */}
      <div style={{background:G.white,borderRadius:14,padding:14}}>
        <ST><span style={{display:"inline-flex",alignItems:"center",gap:5}}><ClipboardList size={13}/> RÉCAP STOCK GLOBAL</span></ST>
        <Tbl headers={["Produit","Restants","Livrés","Coût","Vente","Marge"]} align={["left","right","right","right","right","right"]}
          rows={products.map(p=>{
            const nL=orders.filter(o=>o.product?.startsWith(p.name)&&o.status==="entregado").length;
            const si=p.stockInitial||p.stock+nL;
            const sr=Math.max(0,si-nL);
            return [p.name,<span style={{fontWeight:700,color:sr<5?G.red:G.green}}>{sr}</span>,<span style={{color:G.greenMid,fontWeight:600}}>{nL}</span>,`${fmt(p.cost)} CFA`,`${fmt(p.price)} CFA`,<span style={{color:G.green,fontWeight:700}}>{fmt(p.price-p.cost-p.fraisLiv)} CFA</span>];
          })}
        />
      </div>
    </div>
  );
};
