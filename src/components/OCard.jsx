import React from "react";
import { useAppContext } from "../context/AppContext";
import { fullAddr } from "../lib/senegal";

export const OCard = ({ o, showPrendre = false }) => {
  const {
    G, fmt, STATUS, parseProd,
    role, currentUser, settings, orders,
    openModifId, pinnedOrderIds, waSentIds,
    setOpenModifId, setOrderDetail, setWaSentIds, setConflictDelivery,
    setLivFinalNote, setLivFinalConfirm, setNoteModal, setNoteText, setEditOrder,
    upSt, addToast,
  } = useAppContext();

  const showModif = openModifId === o.id;
  const setShowModif = (val) => setOpenModifId(typeof val === "function" ? (val(showModif) ? o.id : null) : (val ? o.id : null));
  const st = STATUS[o.status] || STATUS.pendiente;

  const isPinned = pinnedOrderIds.includes(o.id);
  const items = parseProd(o.product);
  const totalQty = items.reduce((s, p) => s + p.qty, 0);
  const prodLine = items.map(p => `${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""}`).join(" + ");

  // ── Flux régions hors zone principale (prépayé) ─────────────────────────
  const isOtherFlow = o.region_type === "other";
  const OTHER_STATUSES = new Set(["en_attente_paiement","paiement_confirme","colis_en_main","en_route","remis_transporteur"]);
  const inOtherFlow = isOtherFlow && (OTHER_STATUSES.has(o.status) || o.status === "entregado");

  return (
    <div style={{borderRadius:12,background:"#fff",border:`1px solid #E9ECEF`,borderLeft:`3px solid ${st.color}`,marginBottom:8,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>

      {/* ── Corps cliquable ── */}
      <div onClick={()=>setOrderDetail(o)} style={{padding:"11px 12px 8px",cursor:"pointer"}}>
        {/* Row 1: Client + Price */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:4}}>
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontWeight:800,fontSize:15,color:"#111",lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{o.client}</div>
            <div style={{fontSize:11,color:"#6B7280",marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{prodLine||"—"}{totalQty>1&&<span style={{marginLeft:5,background:"#FEF3C7",color:"#92400E",borderRadius:4,padding:"0 5px",fontSize:10,fontWeight:700}}>🎁 {totalQty}</span>}</div>
          </div>
          <div style={{flexShrink:0,textAlign:"right"}}>
            <div style={{fontWeight:800,fontSize:15,color:G.green,whiteSpace:"nowrap"}}>{fmt(o.price)} CFA</div>
            <span style={{display:"inline-block",marginTop:3,background:st.color+"22",color:st.color,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{st.label}</span>
          </div>
        </div>
        {/* Row 2: meta */}
        <div style={{display:"flex",gap:10,fontSize:11,color:"#9CA3AF",alignItems:"center",flexWrap:"wrap"}}>
          {o.phone&&<span>📱 {o.phone}</span>}
          {(o.address||o.city)&&<span title={fullAddr(o)} style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:240}}>📍 {fullAddr(o)}</span>}
          {o.livreur&&<span style={{background:"#EFF6FF",color:"#1D4ED8",borderRadius:8,padding:"1px 7px",fontWeight:600,fontSize:10}}>🏍️ {o.livreur}</span>}
          {o.created_at&&<span style={{marginLeft:"auto",flexShrink:0}}>{new Date(o.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</span>}
        </div>
      </div>

      {/* ── Actions zone ── */}
      <div onClick={e=>e.stopPropagation()} style={{padding:"6px 12px 10px",borderTop:"1px solid #F3F4F6"}}>

      {/* ── Flux régions hors zone principale (prépayé) ── */}
      {inOtherFlow&&(()=>{
        const OFLOW = [
          {icon:"⏳", label:"Paiement",     keys:["en_attente_paiement"], color:"#F0A500"},
          {icon:"✅", label:"Confirmé",     keys:["paiement_confirme"],   color:"#2E8B57"},
          {icon:"📦", label:"Colis",        keys:["colis_en_main"],       color:"#2563EB"},
          {icon:"🏍️", label:"En route",     keys:["en_route"],            color:"#7C3AED"},
          {icon:"🚌", label:"Transporteur", keys:["remis_transporteur"],  color:"#0891B2"},
          {icon:"✅", label:"Livré",        keys:["entregado"],           color:G.green},
        ];
        const OORDER = ["en_attente_paiement","paiement_confirme","colis_en_main","en_route","remis_transporteur","entregado"];
        const curOrd = OORDER.indexOf(o.status);
        const isAdminOrCloser = role==="admin"||role==="closer";
        return (
          <>
            {/* Stepper visuel */}
            <div style={{marginBottom:8,marginTop:8}}>
              <div style={{display:"flex",alignItems:"center"}}>
                {OFLOW.map((step,i)=>{
                  const stepOrd = OORDER.indexOf(step.keys[0]);
                  const done = stepOrd < curOrd;
                  const active = step.keys.includes(o.status);
                  const col = done||active ? step.color : "#E5E7EB";
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",flex:i<OFLOW.length-1?1:0}}>
                      <div className={active?"soft-pulse":undefined} style={{width:22,height:22,borderRadius:"50%",background:col,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,flexShrink:0,border:`2px solid ${col}`}}>
                        {done?"✓":step.icon}
                      </div>
                      {i<OFLOW.length-1&&<div style={{flex:1,height:2,background:stepOrd<curOrd?step.color:"#E5E7EB"}}/>}
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                {OFLOW.map((step,i)=>{
                  const stepOrd = OORDER.indexOf(step.keys[0]);
                  const done = stepOrd < curOrd;
                  const active = step.keys.includes(o.status);
                  return (
                    <div key={i} style={{flex:1,textAlign:"center",fontSize:8,fontWeight:active?700:500,color:active?step.color:done?"#9CA3AF":"#D1D5DB",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",minWidth:0}}>
                      {step.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Boutons d'action selon rôle + statut */}
            {isAdminOrCloser && o.status==="en_attente_paiement" && (
              <button onClick={()=>upSt(o.id,"paiement_confirme")}
                style={{width:"100%",background:"#2E8B57",color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:6}}>
                <span style={{fontSize:18}}>✅</span> Confirmer le paiement reçu
              </button>
            )}
            {isAdminOrCloser && o.status==="paiement_confirme" && (
              <div style={{background:"#E8F5EE",borderRadius:10,padding:"9px 12px",fontSize:11,color:"#1A5C38",fontWeight:600,marginTop:6}}>
                ⏱️ En attente que le livreur prenne le colis en main
              </div>
            )}
            {role==="livreur" && o.status==="paiement_confirme" && (
              <button onClick={()=>upSt(o.id,"colis_en_main")}
                style={{width:"100%",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:6}}>
                <span style={{fontSize:20}}>📦</span> Colis en main
              </button>
            )}
            {role==="livreur" && o.status==="colis_en_main" && (
              <button onClick={()=>upSt(o.id,"en_route")}
                style={{width:"100%",background:"#7C3AED",color:"#fff",border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:6}}>
                <span style={{fontSize:20}}>🏍️</span> En route
              </button>
            )}
            {role==="livreur" && o.status==="en_route" && (
              <button onClick={()=>upSt(o.id,"remis_transporteur")}
                style={{width:"100%",background:"#0891B2",color:"#fff",border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:6}}>
                <span style={{fontSize:20}}>🚌</span> Remis au transporteur
              </button>
            )}
            {role==="livreur" && o.status==="remis_transporteur" && (
              <div style={{background:"#CFFAFE",border:"1px solid #0891B2",borderRadius:10,padding:"10px 12px",marginTop:6,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:22}}>🚌</span>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:"#0891B2"}}>✅ Livré au transporteur</div>
                  <div style={{fontSize:11,color:"#0E7490",marginTop:2}}>🔒 Ta mission est terminée — Admin/Closer confirme la livraison finale</div>
                </div>
              </div>
            )}
            {isAdminOrCloser && o.status==="remis_transporteur" && (
              <button onClick={()=>upSt(o.id,"entregado")}
                style={{width:"100%",background:G.green,color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:6}}>
                <span style={{fontSize:18}}>✅</span> Marquer comme livré
              </button>
            )}
            {o.status==="entregado" && (
              <div style={{background:G.greenLight,borderRadius:10,padding:"9px 12px",fontSize:12,color:G.green,fontWeight:700,marginTop:6,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:16}}>✅</span> Livraison confirmée
              </div>
            )}

            {/* Modifier statut — livreur (interurbain) */}
            {role==="livreur"&&o.status!=="entregado"&&(
              <div style={{marginTop:8}}>
                <button onClick={()=>setOpenModifId(prev=>prev===o.id?null:o.id)}
                  style={{width:"100%",background:showModif?"#1E3A5F":"#F1F5F9",color:showModif?"#fff":"#374151",border:"none",borderRadius:10,padding:"9px 0",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <span>{showModif?"▲":"✏️"}</span>
                  <span>{showModif?"Fermer la correction":"Corriger le statut"}</span>
                </button>
                {showModif&&(
                  <div style={{marginTop:6,padding:"10px",background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0"}}>
                    <div style={{fontSize:10,color:G.gray,fontWeight:700,letterSpacing:0.5,marginBottom:7}}>CHANGER STATUT</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {[
                        {s:"paiement_confirme",  ico:"✅", l:"Paiement confirmé"},
                        {s:"colis_en_main",      ico:"📦", l:"Colis en main"},
                        {s:"en_route",           ico:"🏍️", l:"En route"},
                        {s:"remis_transporteur", ico:"🚌", l:"Remis au transporteur"},
                      ].map(({s,ico,l})=>(
                        <button key={s} onClick={()=>{ upSt(o.id,s); setOpenModifId(null); }}
                          style={{background:o.status===s?"#1A5C38":"#fff",color:o.status===s?"#fff":G.dark,border:`1.5px solid ${o.status===s?"#1A5C38":"#E2E8F0"}`,borderRadius:8,padding:"5px 9px",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                          <span>{ico}</span><span>{l}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions rapides — bas de carte */}
            <div style={{display:"flex",gap:5,marginTop:8}}>
              <a href={`tel:+221${(o.phone||"").replace(/\s+/g,"")}`}
                style={{flex:1,background:"#F0F6FF",color:"#1D4ED8",borderRadius:8,padding:"8px 0",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:4,textDecoration:"none"}}>
                📞 Appeler
              </a>
              <button onClick={()=>{setNoteModal(o.id);setNoteText(o.note||"");}}
                style={{flex:1,background:o.note?"#FFFBEB":"#F9FAFB",color:o.note?"#92400E":"#6B7280",border:`1px solid ${o.note?"#FDE68A":"#E5E7EB"}`,borderRadius:8,padding:"8px 0",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                📝 {o.note?"Note ●":"+ Note"}
              </button>
              {isAdminOrCloser&&(
                <button onClick={()=>setEditOrder({...o})}
                  style={{flex:1,background:"#F9FAFB",color:"#374151",border:"1px solid #E5E7EB",borderRadius:8,padding:"8px 0",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                  ✏️ Modifier
                </button>
              )}
            </div>
          </>
        );
      })()}

      {/* ── Stepper COD complet (admin / closer) ── */}
      {!inOtherFlow&&role!=="livreur"&&(()=>{
        const FLOW = [
          {icon:"✅",label:"Confirmé",keys:["confirmado"],            color:"#2E8B57"},
          {icon:"🏍️",label:"Livreur", keys:["livreur_en_route","colis_pris"], color:"#7C3AED"},
          {icon:"🚀",label:"En route",keys:["en_camino"],             color:"#0284C7"},
          {icon:"📍",label:"Client",  keys:["chez_client"],           color:"#D97706"},
          {icon:"💰",label:"Encaissé",keys:["entregado"],             color:G.green},
        ];
        const ORDER = ["boutique","pendiente","confirmado","livreur_en_route","colis_pris","en_camino","chez_client","entregado"];
        const curOrd = ORDER.indexOf(o.status);
        const isTerminal = ["rechazado","no_contesta","reprogramar"].includes(o.status);
        if(isTerminal) return (
          <div style={{display:"flex",alignItems:"center",gap:8,background:o.status==="rechazado"?"#FEE2E2":o.status==="reprogramar"?"#EDE9FE":"#F3F4F6",borderRadius:8,padding:"7px 10px",marginBottom:6}}>
            <span style={{fontSize:14}}>{o.status==="rechazado"?"❌":o.status==="reprogramar"?"🔄":"📵"}</span>
            <span style={{fontSize:11,fontWeight:700,color:o.status==="rechazado"?"#DC2626":o.status==="reprogramar"?"#7C3AED":"#6B7280"}}>{st.label}</span>
          </div>
        );
        return (
        <div style={{marginBottom:8,marginTop:8}}>
          <div style={{display:"flex",alignItems:"center"}}>
            {FLOW.map((step,i)=>{
              const stepMaxOrd = Math.max(...step.keys.map(k=>ORDER.indexOf(k)));
              const done = stepMaxOrd < curOrd;
              const active = step.keys.includes(o.status);
              const col = done||active ? step.color : "#E5E7EB";
              return (
                <div key={i} style={{display:"flex",alignItems:"center",flex:i<FLOW.length-1?1:0}}>
                  <div className={active?"soft-pulse":undefined} style={{width:22,height:22,borderRadius:"50%",background:col,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,flexShrink:0,border:`2px solid ${col}`,boxShadow:"none",transition:"all .2s"}}>
                    {done?"✓":step.icon}
                  </div>
                  {i<FLOW.length-1&&<div style={{flex:1,height:2,background:stepMaxOrd<curOrd?step.color:"#E5E7EB",transition:"background .2s"}}/>}
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            {FLOW.map((step,i)=>{
              const stepMaxOrd = Math.max(...step.keys.map(k=>ORDER.indexOf(k)));
              const done = stepMaxOrd < curOrd;
              const active = step.keys.includes(o.status);
              return (
                <div key={i} style={{flex:1,textAlign:"center",fontSize:8,fontWeight:active?700:500,color:active?step.color:done?"#9CA3AF":"#D1D5DB",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",minWidth:0}}>
                  {step.label}
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

      {/* WhatsApp — admin et closer */}
      {!inOtherFlow&&(role==="admin"||role==="closer")&&o.phone&&(()=>{
        const waSent = waSentIds.has(o.id);
        const phone = `221${o.phone.replace(/\s+/g,"")}`;
        const msgConf=`Cher(e) ${o.client} 👋\n\n✅ *Commande confirmée !*\n\n📦 *${o.product}*\n💰 *${fmt(o.price)} CFA* (paiement à la livraison)\n📍 ${o.address||"adresse à confirmer"}\n\n📲 *Enregistrez notre numéro pour ne rater aucune promo !*\nNos meilleures offres sont publiées dans nos *statuts WhatsApp* 🔥\n\n🏍️ Le livreur vous appellera avant de passer\n\nMerci 🙏 — *${settings.boutique||"Notre boutique"}*`;
        return (
          <a href={`https://wa.me/${phone}?text=${encodeURIComponent(msgConf)}`}
            target="_blank" rel="noreferrer"
            onClick={()=>setWaSentIds(prev=>new Set([...prev,o.id]))}
            style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,background:waSent?"#16A34A":"#25D366",color:"#fff",borderRadius:9,padding:"9px 0",fontSize:12,fontWeight:700,textDecoration:"none",marginBottom:6}}>
            {waSent?"✓ Renvoyer confirmation WA":"📲 Confirmer par WhatsApp"}
          </a>
        );
      })()}

      {/* Livreur — statut final bloqué (entregado / rechazado) */}
      {!inOtherFlow&&role==="livreur"&&(o.status==="entregado"||o.status==="rechazado")&&(
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
      {!inOtherFlow&&role==="livreur"&&o.status!=="entregado"&&o.status!=="rechazado"&&(
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
                      <div className={active?"step-active":undefined} style={{"--sc":"rgba(240,165,0,0.7)",width:26,height:26,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:i===5?13:10,color:tc,flexShrink:0,border:`2px solid ${done?"#6EE7B7":active?"#F0A500":"#E5E7EB"}`,fontWeight:800,boxShadow:active?"0 0 0 3px rgba(240,165,0,0.25)":done?"0 0 0 2px rgba(26,92,56,0.15)":"none"}}>
                        {i===5?"✓":ico}
                      </div>
                      {i<5&&<div style={{flex:1,height:3,background:done?G.green:G.grayLight,borderRadius:2}}/>}
                    </div>
                  );
                })}
              </div>
            );
          })()}

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
              <button onClick={()=>{
                const activeDelivery=orders.find(x=>String(x.livreur_id)===String(currentUser.id)&&(x.status==="en_camino"||x.status==="chez_client")&&x.id!==o.id);
                if(activeDelivery){ setConflictDelivery(activeDelivery); return; }
                upSt(o.id,"en_camino");
              }}
                style={{width:"100%",background:G.blue,color:G.white,border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{fontSize:20}}>🚀</span> Je pars vers le client
              </button>
            </>
          )}

          {/* Étape: en route → arrivé chez client */}
          {o.status==="en_camino"&&(
            <>
              <div style={{background:"#E0F2FE",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#0284C7",fontWeight:600}}>
                🚀 Étape 4 — En route vers {o.client}
              </div>
              {/* Rappel WhatsApp personnalisé */}
              {o.phone&&(()=>{
                const msg=`Bonjour ${o.client} ! 🚨\n\nJe suis *${currentUser.nom}*, votre livreur — *je suis juste à côté de chez vous !* 🏍️💨\n\nVotre commande *${o.product}* arrive dans quelques minutes !\n\n💰 Préparez *${fmt(o.price)} CFA* maintenant s'il vous plaît\n\n⚠️ *Soyez disponible, je sonne dans un instant !*`;
                return (
                  <a href={`https://wa.me/221${o.phone.replace(/\s+/g,"")}?text=${encodeURIComponent(msg)}`}
                    target="_blank" rel="noreferrer"
                    style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25D366",color:"#fff",borderRadius:11,padding:"13px 0",fontSize:14,fontWeight:700,textDecoration:"none",boxShadow:"0 3px 10px rgba(37,211,102,0.35)"}}>
                    <span style={{fontSize:20}}>💬</span> Rappeler le client par WhatsApp
                  </a>
                );
              })()}
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
              <button onClick={()=>{setLivFinalNote("");setLivFinalConfirm({orderId:o.id,type:"livre",client:o.client,price:o.price});}}
                style={{width:"100%",background:"#D1FAE5",color:"#1A5C38",border:"2px solid #6EE7B7",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span style={{fontSize:22}}>✅</span> Livré — Cash encaissé
              </button>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                <button onClick={()=>{setLivFinalNote("");setLivFinalConfirm({orderId:o.id,type:"rejete",client:o.client,price:o.price});}} style={{background:"#FEE2E2",color:"#DC2626",border:"2px solid #FCA5A5",borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
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

      {/* Modifier statut — livreur (toggle) */}
      {!inOtherFlow&&role==="livreur"&&(
        <div style={{marginTop:8}}>
          <button onClick={()=>setOpenModifId(prev=>prev===o.id?null:o.id)}
            style={{width:"100%",background:showModif?"#1E3A5F":"#F1F5F9",color:showModif?"#fff":"#374151",border:"none",borderRadius:10,padding:"9px 0",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <span>{showModif?"▲":"✏️"}</span>
            <span>{showModif?"Fermer la correction":"Corriger le statut"}</span>
          </button>
          {showModif&&(
            <div style={{marginTop:6,padding:"10px",background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0"}}>
              <div style={{fontSize:10,color:G.gray,fontWeight:700,letterSpacing:0.5,marginBottom:7}}>CHANGER STATUT</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {[
                  {s:"confirmado",     ico:"✅", l:"Confirmé"},
                  {s:"livreur_en_route",ico:"🏍️",l:"En route"},
                  {s:"colis_pris",     ico:"📦", l:"Colis pris"},
                  {s:"en_camino",      ico:"🚀", l:"Vers client"},
                  {s:"chez_client",    ico:"📍", l:"Chez client"},
                  {s:"entregado",      ico:"✅", l:"Livré"},
                  {s:"rechazado",      ico:"❌", l:"Rejeté"},
                  {s:"no_contesta",    ico:"📵", l:"Absent"},
                  {s:"reprogramar",    ico:"🔄", l:"Reporter"},
                ].map(({s,ico,l})=>(
                  <button key={s} onClick={()=>{
                    if(s==="entregado"){setLivFinalNote("");setLivFinalConfirm({orderId:o.id,type:"livre",client:o.client,price:o.price});setOpenModifId(null);return;}
                    if(s==="rechazado"){setLivFinalNote("");setLivFinalConfirm({orderId:o.id,type:"rejete",client:o.client,price:o.price});setOpenModifId(null);return;}
                    if(s==="en_camino"){
                      const active=orders.find(x=>String(x.livreur_id)===String(currentUser.id)&&x.status==="en_camino"&&x.id!==o.id);
                      if(active){addToast(`⚠️ Termine la livraison de ${active.client} d'abord !`,"⚠️","#F0A500");return;}
                    }
                    upSt(o.id,s);
                    setOpenModifId(null);
                  }}
                    style={{background:o.status===s?"#1A5C38":"#fff",color:o.status===s?"#fff":G.dark,border:`1.5px solid ${o.status===s?"#1A5C38":"#E2E8F0"}`,borderRadius:8,padding:"5px 9px",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                    <span>{ico}</span><span>{l}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions rapides — bas de carte */}
      {!inOtherFlow&&(
      <div style={{display:"flex",gap:5,marginTop:6}}>
        <a href={`tel:+221${(o.phone||"").replace(/\s+/g,"")}`}
          style={{flex:1,background:"#F0F6FF",color:"#1D4ED8",borderRadius:8,padding:"8px 0",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:4,textDecoration:"none"}}>
          📞 Appeler
        </a>
        <button onClick={()=>{setNoteModal(o.id);setNoteText(o.note||"");}}
          style={{flex:1,background:o.note?"#FFFBEB":"#F9FAFB",color:o.note?"#92400E":"#6B7280",border:`1px solid ${o.note?"#FDE68A":"#E5E7EB"}`,borderRadius:8,padding:"8px 0",fontSize:11,fontWeight:600,cursor:"pointer"}}>
          📝 {o.note?"Note ●":"+ Note"}
        </button>
        {(role==="admin"||role==="closer")&&(
          <button onClick={()=>setEditOrder({...o})}
            style={{flex:1,background:"#F9FAFB",color:"#374151",border:"1px solid #E5E7EB",borderRadius:8,padding:"8px 0",fontSize:11,fontWeight:600,cursor:"pointer"}}>
            ✏️ Modifier
          </button>
        )}
      </div>
      )}
      </div>{/* end actions zone */}
    </div>
  );
};
