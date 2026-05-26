import React from "react";
import { useAppContext } from "../context/AppContext";
import { fullAddr } from "../lib/senegal";
import {
  Pin, Gift, Smartphone, MapPin, Bike, Check, Package, Bus, Rocket,
  Phone, Pencil, StickyNote, MessageCircle, Send, X, RotateCcw, PhoneOff,
  Lock, AlertTriangle, Coins, Clock, ChevronUp, Star, StarOff,
} from "lucide-react";

const StepIcon = ({ Ico, size = 11, color = "#fff" }) => <Ico size={size} color={color} strokeWidth={2.5}/>;

export const OCard = ({ o, showPrendre = false }) => {
  const {
    G, fmt, STATUS, parseProd, sbFetch,
    role, currentUser, settings, orders, orderItems, products,
    openModifId, pinnedOrderIds, waSentIds,
    setOpenModifId, setOrderDetail, setWaSentIds, setConflictDelivery, setOrders,
    setLivFinalNote, setLivFinalConfirm, setTransporterModal, setNoteModal, setNoteText, setEditOrder,
    upSt, addToast, togglePin,
  } = useAppContext();

  // Match product photo by first product name (for thumbnail in card)
  const firstProdName = ((parseProd(o.product)||[])[0]?.name || "").toLowerCase();
  const productPhoto = (products||[]).find(p =>
    (p.name||"").toLowerCase() === firstProdName ||
    (o.product||"").toLowerCase().includes((p.name||"").toLowerCase())
  )?.photo_url;
  const canPin = role==="admin"||role==="closer";

  const showModif = openModifId === o.id;
  const setShowModif = (val) => setOpenModifId(typeof val === "function" ? (val(showModif) ? o.id : null) : (val ? o.id : null));
  const st = STATUS[o.status] || STATUS.pendiente;

  const isPinned = pinnedOrderIds.includes(o.id);
  // Préférer les order_items (qty + pack réels) si disponibles, sinon parseProd legacy
  const myItems = (orderItems||[]).filter(it=>it.order_id===o.id);
  const items = myItems.length
    ? myItems.map(it=>({ name: it.product_name||"Produit", qty: it.quantity||1, packQty: it.pack_quantity||1 }))
    : parseProd(o.product);
  const totalQty = items.reduce((s, p) => s + (p.qty * (p.packQty||1)), 0);
  const prodLine = items.map(p => {
    const pq = p.packQty||1;
    if (pq > 1) return `${p.name} ×${p.qty} (Pack ×${pq})`;
    return `${p.name}${p.qty > 1 ? ` ×${p.qty}` : ""}`;
  }).join(" + ");

  // ── Flux régions hors zone principale (prépayé) ─────────────────────────
  const isOtherFlow = o.region_type === "other";
  const OTHER_STATUSES = new Set(["en_attente_paiement","paiement_confirme","livreur_en_route","colis_en_main","en_route","remis_transporteur"]);
  const inOtherFlow = isOtherFlow && (OTHER_STATUSES.has(o.status) || o.status === "entregado");

  return (
    <div style={{position:"relative",borderRadius:10,background:"#fff",border:`1px solid #E9ECEF`,borderLeft:`3px solid ${st.color}`,marginBottom:8,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>

      {/* ── Bouton épingle (admin/closer uniquement) ── */}
      {canPin&&(
        <button
          onClick={(e)=>{e.stopPropagation(); togglePin(o.id);}}
          title={isPinned?"Désépingler":"Épingler cette commande"}
          aria-label={isPinned?"Désépingler":"Épingler"}
          style={{position:"absolute",top:8,right:8,zIndex:3,background:isPinned?"#FEF3C7":"#F4F4F5",border:`1px solid ${isPinned?"#F0A500":"#E5E7EB"}`,borderRadius:8,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13,padding:0,lineHeight:1}}>
          <Pin size={14} fill={isPinned?"#F0A500":"none"} color={isPinned?"#F0A500":"#9CA3AF"}/>
        </button>
      )}

      {/* ── Corps cliquable ── */}
      <div onClick={()=>setOrderDetail(o)} style={{padding:`11px ${canPin?44:12}px 8px 12px`,cursor:"pointer"}}>
        {/* Row 1: Client + Price (with optional product thumbnail) */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:4}}>
          {productPhoto && (
            <div style={{flexShrink:0,width:42,height:42,borderRadius:8,overflow:"hidden",background:G.grayLight,border:`1px solid ${G.grayLight}`}}>
              <img src={productPhoto} alt={o.product} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.currentTarget.style.display="none"}/>
            </div>
          )}
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontWeight:800,fontSize:15,color:"#111",lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{o.client}</div>
            <div style={{fontSize:11,color:"#6B7280",marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{prodLine||"—"}{totalQty>1&&<span style={{marginLeft:5,background:"#FEF3C7",color:"#92400E",borderRadius:4,padding:"0 5px",fontSize:10,fontWeight:700,display:"inline-flex",alignItems:"center",gap:3}}><Gift size={10}/> {totalQty}</span>}</div>
          </div>
          <div style={{flexShrink:0,textAlign:"right"}}>
            <div style={{fontWeight:800,fontSize:15,color:G.green,whiteSpace:"nowrap"}}>{fmt(o.price)} CFA</div>
            <span style={{display:"inline-block",marginTop:3,background:st.color+"22",color:st.color,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{st.label}</span>
          </div>
        </div>
        {/* Row 2: meta */}
        <div style={{display:"flex",gap:10,fontSize:11,color:"#9CA3AF",alignItems:"center",flexWrap:"wrap"}}>
          {o.phone&&<span style={{display:"inline-flex",alignItems:"center",gap:3}}><Smartphone size={11}/> {o.phone}</span>}
          {(o.address||o.city||o.deliveryZoneName||o.unmatched_city)&&(()=>{
            const city=(o.city||o.deliveryZoneName||o.unmatched_city||"").trim();
            const addr=(o.address||"").trim();
            const _norm=s=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
            const quartier=city&&_norm(addr).includes(_norm(city))?addr.replace(new RegExp(city,"i"),"").replace(/^[\s,·-]+|[\s,·-]+$/g,"").trim():addr;
            const display=[city,quartier].filter(Boolean).join(" · ")||addr||city;
            return <span title={fullAddr(o)} style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:240,fontWeight:city?600:400,color:city?"#374151":"#9CA3AF",display:"inline-flex",alignItems:"center",gap:3}}><MapPin size={11}/> {display}</span>;
          })()}
          {o.livreur&&<span style={{background:"#EFF6FF",color:"#1D4ED8",borderRadius:8,padding:"1px 7px",fontWeight:600,fontSize:10,display:"inline-flex",alignItems:"center",gap:3}}><Bike size={11}/> {o.livreur}</span>}
          {o.created_at&&<span style={{marginLeft:"auto",flexShrink:0}}>{new Date(o.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</span>}
        </div>
      </div>

      {/* ── Actions zone ── */}
      <div onClick={e=>e.stopPropagation()} style={{padding:"6px 12px 10px",borderTop:"1px solid #F3F4F6"}}>

      {/* ── Flux régions hors zone principale (prépayé) ── */}
      {inOtherFlow&&(()=>{
        const OFLOW_FULL = [
          {Ico:Clock,   label:"Paiement",     keys:["en_attente_paiement"], color:"#F0A500"},
          {Ico:Check,   label:"Confirmé",     keys:["paiement_confirme"],   color:"#2E8B57"},
          {Ico:Bike,    label:"Livreur",      keys:["livreur_en_route"],    color:"#7C3AED"},
          {Ico:Package, label:"Colis",        keys:["colis_en_main"],       color:"#2563EB"},
          {Ico:Bike,    label:"Transport",    keys:["en_route"],            color:"#7C3AED"},
          {Ico:Bus,     label:"Remis",        keys:["remis_transporteur"],  color:"#0891B2"},
          {Ico:Check,   label:"Livré",        keys:["entregado"],           color:G.green},
        ];
        // Stepper unifié pour tous les rôles : 5 pas actionnables (paiement_confirme → remis_transporteur)
        const OFLOW = OFLOW_FULL.filter(s=>!s.keys.includes("en_attente_paiement")&&!s.keys.includes("entregado"));
        const OORDER = ["en_attente_paiement","paiement_confirme","livreur_en_route","colis_en_main","en_route","remis_transporteur","entregado"];
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
                      <div className={active?"soft-pulse":undefined} style={{width:22,height:22,borderRadius:"50%",background:col,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`2px solid ${col}`}}>
                        {done?<Check size={12} color="#fff" strokeWidth={3}/>:<step.Ico size={11} color={active?"#fff":"#9CA3AF"} strokeWidth={2.5}/>}
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
            {isAdminOrCloser && o.status==="en_attente_paiement" && (()=>{
              const buildMsg = (token) => {
                const suiviLine = token ? `\n\n🔗 *Suis ta commande en direct :*\nhttps://www.teamlyecom.com/track/${token}` : "";
                return `Cher(e) ${o.client} 👋\n\n✅ *Paiement bien reçu — merci !*\n\n📦 *${o.product}*\n💰 *${fmt(o.price)} CFA* encaissé\n📍 Destination : ${o.address||"adresse à confirmer"}\n\n🚌 *Ton colis va voyager avec un transporteur* jusqu'à ta région. Tu pourras le suivre en direct ci-dessous.${suiviLine}\n\nMerci 🙏 — *${settings.boutique||"Notre boutique"}*`;
              };
              const confirmAndWA = async () => {
                upSt(o.id,"paiement_confirme");
                if(!o.phone){ return; }
                let token = o.tracking_token;
                if(!token){
                  try{
                    const rows = await sbFetch(`orders?id=eq.${o.id}&select=tracking_token`,"GET");
                    token = rows?.[0]?.tracking_token || null;
                    if(!token){
                      const upd = await sbFetch(`orders?id=eq.${o.id}`,"PATCH",{tracking_token: crypto.randomUUID()});
                      token = (Array.isArray(upd)?upd[0]:upd)?.tracking_token || null;
                    }
                    if(token) setOrders(prev=>prev.map(x=>x.id===o.id?{...x,tracking_token:token}:x));
                  }catch(e){}
                }
                const phoneWA = `221${o.phone.replace(/\s+/g,"").replace(/^221/,"").replace(/^0/,"")}`;
                window.open(`https://wa.me/${phoneWA}?text=${encodeURIComponent(buildMsg(token))}`,"_blank","noopener,noreferrer");
              };
              return (
                <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:6}}>
                  {o.phone && (
                    <button onClick={confirmAndWA}
                      style={{width:"100%",background:"#25D366",color:"#fff",border:"none",borderRadius:12,padding:"14px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 3px 10px rgba(37,211,102,0.35)"}}>
                      <MessageCircle size={18}/> Confirmer paiement + WhatsApp
                    </button>
                  )}
                  <button onClick={()=>upSt(o.id,"paiement_confirme")}
                    style={{width:"100%",background:o.phone?"#F3F4F6":"#2E8B57",color:o.phone?"#374151":"#fff",border:"none",borderRadius:12,padding:o.phone?"10px 0":"13px 0",fontWeight:o.phone?600:800,fontSize:o.phone?13:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                    <Check size={o.phone?14:18}/> {o.phone?"Confirmer sans WhatsApp":"Confirmer le paiement reçu"}
                  </button>
                </div>
              );
            })()}
            {isAdminOrCloser && o.status==="paiement_confirme" && (
              <div style={{background:"#E8F5EE",borderRadius:10,padding:"9px 12px",fontSize:11,color:"#1A5C38",fontWeight:600,marginTop:6,display:"flex",alignItems:"center",gap:6}}>
                <Clock size={13}/> En attente que le livreur prenne le colis en main
              </div>
            )}
            {role==="livreur" && o.status==="paiement_confirme" && (
              <button onClick={()=>upSt(o.id,"livreur_en_route")}
                style={{width:"100%",background:"#7C3AED",color:"#fff",border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:6}}>
                <Bike size={20}/> Je pars récupérer
              </button>
            )}
            {role==="livreur" && o.status==="livreur_en_route" && (
              <button onClick={()=>upSt(o.id,"colis_en_main")}
                style={{width:"100%",background:"#2563EB",color:"#fff",border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:6}}>
                <Package size={20}/> Colis en main
              </button>
            )}
            {role==="livreur" && o.status==="colis_en_main" && (
              <button onClick={()=>upSt(o.id,"en_route")}
                style={{width:"100%",background:"#7C3AED",color:"#fff",border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:6}}>
                <Bike size={20}/> Aller vers le transporteur
              </button>
            )}
            {role==="livreur" && o.status==="en_route" && (
              <button onClick={()=>setTransporterModal({orderId:o.id, client:o.client})}
                style={{width:"100%",background:"#0891B2",color:"#fff",border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:6}}>
                <Bus size={20}/> Remis au transporteur
              </button>
            )}
            {role==="livreur" && o.status==="remis_transporteur" && (
              <div style={{background:"#CFFAFE",border:"1px solid #0891B2",borderRadius:10,padding:"10px 12px",marginTop:6,display:"flex",alignItems:"center",gap:10}}>
                <Bus size={22} color="#0891B2"/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:800,color:"#0891B2",display:"flex",alignItems:"center",gap:5}}><Check size={14}/> Livré au transporteur</div>
                  {o.transporter_phone && (
                    <div style={{fontSize:12,color:"#0E7490",marginTop:3,display:"flex",alignItems:"center",gap:4,fontWeight:600}}>
                      <Phone size={11}/> {o.transporter_phone}
                    </div>
                  )}
                  <div style={{fontSize:11,color:"#0E7490",marginTop:2,display:"flex",alignItems:"center",gap:4}}><Lock size={11}/> Ta mission est terminée — Admin/Closer confirme la livraison finale</div>
                </div>
              </div>
            )}
            {isAdminOrCloser && o.status==="remis_transporteur" && (
              <>
                {o.transporter_phone && (
                  <div style={{background:"#CFFAFE",border:"1px solid #0891B2",borderRadius:10,padding:"9px 12px",marginTop:6,display:"flex",alignItems:"center",gap:8}}>
                    <Bus size={16} color="#0891B2"/>
                    <div style={{fontSize:12,color:"#0E7490",fontWeight:600,flex:1,minWidth:0}}>Transporteur</div>
                    <a href={`tel:${(o.transporter_phone||"").replace(/\s+/g,"")}`}
                      style={{fontSize:13,fontWeight:700,color:"#0891B2",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>
                      <Phone size={12}/> {o.transporter_phone}
                    </a>
                  </div>
                )}
                <button onClick={()=>upSt(o.id,"entregado")}
                  style={{width:"100%",background:G.green,color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:6}}>
                  <Check size={18}/> Marquer comme livré
                </button>
              </>
            )}
            {o.status==="entregado" && (
              <>
                <div style={{background:G.greenLight,borderRadius:10,padding:"9px 12px",fontSize:12,color:G.green,fontWeight:700,marginTop:6,display:"flex",alignItems:"center",gap:8}}>
                  <Check size={16}/> Livraison confirmée
                </div>
                {settings?.reviewsEnabled !== false && (o.rating || o.rating_product || o.rating_livreur || o.rating_closer) && (
                  <div style={{marginTop:8,background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:"#92400E",fontWeight:700,letterSpacing:0.5,marginBottom:6}}>AVIS CLIENT</div>
                    {(o.rating_product || o.rating_livreur || o.rating_closer) ? (
                      <div style={{display:"flex",justifyContent:"space-between",gap:6,marginBottom:o.review?6:0}}>
                        {[
                          {l:"📦 Produit",v:o.rating_product},
                          {l:"🛵 Livreur",v:o.rating_livreur},
                          {l:"📞 Appel",  v:o.rating_closer},
                        ].map((r,i)=> r.v ? (
                          <div key={i} style={{flex:1,textAlign:"center"}}>
                            <div style={{fontSize:11,color:"#F59E0B",letterSpacing:0.5}}>
                              {"★".repeat(r.v)}<span style={{color:"#D1D5DB"}}>{"★".repeat(5-r.v)}</span>
                            </div>
                            <div style={{fontSize:9,color:"#78350F",marginTop:2}}>{r.l}</div>
                          </div>
                        ) : null)}
                      </div>
                    ) : (
                      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",marginBottom:o.review?6:0}}>
                        <div style={{fontSize:14,color:"#F59E0B",letterSpacing:1}}>
                          {"★".repeat(o.rating)}<span style={{color:"#D1D5DB"}}>{"★".repeat(5-o.rating)}</span>
                        </div>
                      </div>
                    )}
                    {o.review && (
                      <div style={{fontSize:12,color:"#78350F",lineHeight:1.4,fontStyle:"italic"}}>« {o.review} »</div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Modifier statut — livreur (interurbain) */}
            {role==="livreur"&&o.status!=="entregado"&&(
              <div style={{marginTop:8}}>
                <button onClick={()=>setOpenModifId(prev=>prev===o.id?null:o.id)}
                  style={{width:"100%",background:showModif?"#1E3A5F":"#F1F5F9",color:showModif?"#fff":"#374151",border:"none",borderRadius:10,padding:"9px 0",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <span style={{display:"inline-flex",alignItems:"center"}}>{showModif?<ChevronUp size={13}/>:<Pencil size={13}/>}</span>
                  <span>{showModif?"Fermer la correction":"Corriger le statut"}</span>
                </button>
                {showModif&&(
                  <div style={{marginTop:6,padding:"10px",background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0"}}>
                    <div style={{fontSize:10,color:G.gray,fontWeight:700,letterSpacing:0.5,marginBottom:7}}>CHANGER STATUT</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {[
                        {s:"paiement_confirme",  Ico:Check,   l:"Paiement confirmé"},
                        {s:"livreur_en_route",   Ico:Bike,    l:"Livreur en route"},
                        {s:"colis_en_main",      Ico:Package, l:"Colis en main"},
                        {s:"en_route",           Ico:Bike,    l:"Aller vers le transporteur"},
                        {s:"remis_transporteur", Ico:Bus,     l:"Remis au transporteur"},
                      ].map(({s,Ico,l})=>(
                        <button key={s} onClick={()=>{
                          if(s==="remis_transporteur"){ setTransporterModal({orderId:o.id, client:o.client}); setOpenModifId(null); return; }
                          upSt(o.id,s); setOpenModifId(null);
                        }}
                          style={{background:o.status===s?"#1A5C38":"#fff",color:o.status===s?"#fff":G.dark,border:`1.5px solid ${o.status===s?"#1A5C38":"#E2E8F0"}`,borderRadius:8,padding:"5px 9px",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                          <Ico size={12}/><span>{l}</span>
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
                <Phone size={12}/> Appeler
              </a>
              <button onClick={()=>{setNoteModal(o.id);setNoteText(o.note||"");}}
                style={{flex:1,background:o.note?"#FFFBEB":"#F9FAFB",color:o.note?"#92400E":"#6B7280",border:`1px solid ${o.note?"#FDE68A":"#E5E7EB"}`,borderRadius:8,padding:"8px 0",fontSize:11,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5}}>
                <StickyNote size={12}/> {o.note?"Note ●":"+ Note"}
              </button>
              {isAdminOrCloser&&(
                <button onClick={()=>setEditOrder({...o})}
                  style={{flex:1,background:"#F9FAFB",color:"#374151",border:"1px solid #E5E7EB",borderRadius:8,padding:"8px 0",fontSize:11,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5}}>
                  <Pencil size={12}/> Modifier
                </button>
              )}
            </div>
          </>
        );
      })()}

      {/* ── Stepper COD complet (admin / closer) ── */}
      {!inOtherFlow&&role!=="livreur"&&(()=>{
        const FLOW = [
          {Ico:Check,  label:"Confirmé",keys:["confirmado"],            color:"#2E8B57"},
          {Ico:Bike,   label:"Livreur", keys:["livreur_en_route","colis_pris"], color:"#7C3AED"},
          {Ico:Rocket, label:"En route",keys:["en_camino"],             color:"#0284C7"},
          {Ico:MapPin, label:"Client",  keys:["chez_client"],           color:"#D97706"},
          {Ico:Coins,  label:"Encaissé",keys:["entregado"],             color:G.green},
        ];
        const ORDER = ["boutique","pendiente","confirmado","livreur_en_route","colis_pris","en_camino","chez_client","entregado"];
        const curOrd = ORDER.indexOf(o.status);
        const isTerminal = ["rechazado","no_contesta","reprogramar"].includes(o.status);
        if(isTerminal) return (
          <div style={{display:"flex",alignItems:"center",gap:8,background:o.status==="rechazado"?"#FEE2E2":o.status==="reprogramar"?"#EDE9FE":"#F3F4F6",borderRadius:8,padding:"7px 10px",marginBottom:6}}>
            {o.status==="rechazado"?<X size={14}/>:o.status==="reprogramar"?<RotateCcw size={14}/>:<PhoneOff size={14}/>}
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
                  <div className={active?"soft-pulse":undefined} style={{width:22,height:22,borderRadius:"50%",background:col,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`2px solid ${col}`,boxShadow:"none",transition:"all .2s"}}>
                    {done?<Check size={12} color="#fff" strokeWidth={3}/>:<step.Ico size={11} color={active?"#fff":"#9CA3AF"} strokeWidth={2.5}/>}
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
        const buildMsg = (token) => {
          const suiviLine = token ? `\n\n🔗 *Suis ta commande en direct :*\nhttps://www.teamlyecom.com/track/${token}` : "";
          return `Cher(e) ${o.client} 👋\n\n✅ *Commande confirmée !*\n\n📦 *${o.product}*\n💰 *${fmt(o.price)} CFA* (paiement à la livraison)\n📍 ${o.address||"adresse à confirmer"}\n\n📲 *Enregistrez notre numéro pour ne rater aucune promo !*\nNos meilleures offres sont publiées dans nos *statuts WhatsApp* 🔥\n\n🏍️ Le livreur vous appellera avant de passer${suiviLine}\n\nMerci 🙏 — *${settings.boutique||"Notre boutique"}*`;
        };
        const openWA = async (e) => {
          let token = o.tracking_token;
          if (!token) {
            try {
              const rows = await sbFetch(`orders?id=eq.${o.id}&select=tracking_token`,"GET");
              token = rows?.[0]?.tracking_token || null;
              if (!token) {
                const updated = await sbFetch(`orders?id=eq.${o.id}`,"PATCH",{tracking_token: crypto.randomUUID()});
                token = (Array.isArray(updated)?updated[0]:updated)?.tracking_token || null;
              }
              if (token) setOrders(prev=>prev.map(x=>x.id===o.id?{...x,tracking_token:token}:x));
            } catch(err) { /* sigue sin link si falla */ }
          }
          setWaSentIds(prev=>new Set([...prev,o.id]));
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildMsg(token))}`,"_blank","noopener,noreferrer");
        };
        return (
          <button onClick={openWA}
            style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,background:"#fff",color:"#111",borderRadius:9,padding:"9px 0",fontSize:12,fontWeight:700,marginBottom:6,border:"1.5px solid #111",cursor:"pointer",width:"100%"}}>
            {waSent?<><Check size={13}/> Renvoyer confirmation WA</>:<><Send size={13}/> Confirmer par WhatsApp</>}
          </button>
        );
      })()}

      {/* Livreur — statut final bloqué (entregado / rechazado) */}
      {!inOtherFlow&&role==="livreur"&&(o.status==="entregado"||o.status==="rechazado")&&(
        <div style={{marginTop:8,background:o.status==="entregado"?G.greenLight:"#FEF2F2",borderRadius:10,padding:"9px 12px",display:"flex",alignItems:"center",gap:8}}>
          {o.status==="entregado"?<Check size={18} color={G.green}/>:<X size={18} color={G.red}/>}
          <div>
            <div style={{fontSize:12,fontWeight:700,color:o.status==="entregado"?G.green:G.red}}>
              {o.status==="entregado"?"Livraison terminée — Cash encaissé":"Rejeté — Colis retourné"}
            </div>
            <div style={{fontSize:10,color:G.gray,marginTop:1,display:"flex",alignItems:"center",gap:4}}>
              <Lock size={11}/> Statut final — Contacte l'Admin pour toute correction
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
                {[Check, Bike, Package, Rocket, MapPin, Check].map((Ico,i)=>{
                  const isEntregado=o.status==="entregado";
                  const done = isEntregado || i<cur;
                  const active = !isEntregado && i===cur;
                  const bg = done ? G.green : active ? "#F0A500" : G.grayLight;
                  const tc = done || active ? G.white : "#9CA3AF";
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",flex:i<5?1:0}}>
                      <div className={active?"step-active":undefined} style={{"--sc":"rgba(240,165,0,0.7)",width:26,height:26,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",color:tc,flexShrink:0,border:`2px solid ${done?"#6EE7B7":active?"#F0A500":"#E5E7EB"}`,fontWeight:800,boxShadow:active?"0 0 0 3px rgba(240,165,0,0.25)":done?"0 0 0 2px rgba(26,92,56,0.15)":"none"}}>
                        <Ico size={13} color={tc} strokeWidth={i===5?3:2.5}/>
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
              <div style={{background:"#EDE9FE",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#7C3AED",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                <Bike size={14}/> Étape 2 — En route vers l'Admin pour récupérer
              </div>
              <button onClick={()=>upSt(o.id,"colis_pris")}
                style={{width:"100%",background:"#7C3AED",color:G.white,border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <Package size={20}/> J'ai récupéré le colis
              </button>
            </>
          )}

          {/* Étape: colis pris → partir vers client */}
          {o.status==="colis_pris"&&(
            <>
              <div style={{background:"#DBEAFE",borderRadius:10,padding:"10px 12px",fontSize:12,color:G.blue,fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                <Package size={14}/> Étape 3 — Colis en main, pars vers le client
              </div>
              {/* Prévenir le client par WhatsApp — colis_pris */}
              {o.phone&&(()=>{
                const buildMsg = (token) => {
                  const suiviLine = token ? `\n\n🔗 Suis-moi en direct :\nhttps://www.teamlyecom.com/track/${token}` : "";
                  return `Salut ${o.client} 👋\n\nJe suis *${currentUser.nom}*, ton livreur.\n📦 J'ai ton colis *${o.product}* en main, je pars maintenant vers chez toi 🛵💨\n\n💵 Prépare *${fmt(o.price)} CFA* en cash pour gagner du temps${suiviLine}`;
                };
                const openWA = async () => {
                  let token = o.tracking_token;
                  if (!token) {
                    try {
                      const rows = await sbFetch(`orders?id=eq.${o.id}&select=tracking_token`,"GET");
                      token = rows?.[0]?.tracking_token || null;
                      if (!token) {
                        const upd = await sbFetch(`orders?id=eq.${o.id}`,"PATCH",{tracking_token: crypto.randomUUID()});
                        token = (Array.isArray(upd)?upd[0]:upd)?.tracking_token || null;
                      }
                      if (token) setOrders(prev=>prev.map(x=>x.id===o.id?{...x,tracking_token:token}:x));
                    } catch(err) {}
                  }
                  window.open(`https://wa.me/221${o.phone.replace(/\s+/g,"")}?text=${encodeURIComponent(buildMsg(token))}`,"_blank","noopener,noreferrer");
                };
                return (
                  <button onClick={openWA}
                    style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25D366",color:"#fff",borderRadius:11,padding:"13px 0",fontSize:14,fontWeight:700,boxShadow:"0 3px 10px rgba(37,211,102,0.35)",border:"none",cursor:"pointer",width:"100%"}}>
                    <MessageCircle size={20}/> Prévenir le client maintenant
                  </button>
                );
              })()}
              <button onClick={()=>{
                const activeDelivery=orders.find(x=>String(x.livreur_id)===String(currentUser.id)&&(x.status==="en_camino"||x.status==="chez_client")&&x.id!==o.id);
                if(activeDelivery){ setConflictDelivery(activeDelivery); return; }
                upSt(o.id,"en_camino");
              }}
                style={{width:"100%",background:G.blue,color:G.white,border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <Rocket size={20}/> Je pars vers le client
              </button>
            </>
          )}

          {/* Étape: en route → arrivé chez client */}
          {o.status==="en_camino"&&(
            <>
              <div style={{background:"#E0F2FE",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#0284C7",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                <Rocket size={14}/> Étape 4 — En route vers {o.client}
              </div>
              {/* Prévenir le client par WhatsApp — en_camino */}
              {o.phone&&(()=>{
                const buildMsg = (token) => {
                  const suiviLine = token ? `\n\n🔗 Suis-moi en direct :\nhttps://www.teamlyecom.com/track/${token}` : "";
                  return `Salut ${o.client} 🚨\n\nJe suis *${currentUser.nom}*, ton livreur — je suis *en route vers chez toi maintenant* 🏍️💨\n\nTa commande *${o.product}* arrive dans quelques minutes !\n\n💵 Prépare *${fmt(o.price)} CFA* en cash s'il te plaît\n📞 Garde ton téléphone à portée${suiviLine}`;
                };
                const openWA = async () => {
                  let token = o.tracking_token;
                  if (!token) {
                    try {
                      const rows = await sbFetch(`orders?id=eq.${o.id}&select=tracking_token`,"GET");
                      token = rows?.[0]?.tracking_token || null;
                      if (!token) {
                        const upd = await sbFetch(`orders?id=eq.${o.id}`,"PATCH",{tracking_token: crypto.randomUUID()});
                        token = (Array.isArray(upd)?upd[0]:upd)?.tracking_token || null;
                      }
                      if (token) setOrders(prev=>prev.map(x=>x.id===o.id?{...x,tracking_token:token}:x));
                    } catch(err) {}
                  }
                  window.open(`https://wa.me/221${o.phone.replace(/\s+/g,"")}?text=${encodeURIComponent(buildMsg(token))}`,"_blank","noopener,noreferrer");
                };
                return (
                  <button onClick={openWA}
                    style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25D366",color:"#fff",borderRadius:11,padding:"13px 0",fontSize:14,fontWeight:700,boxShadow:"0 3px 10px rgba(37,211,102,0.35)",border:"none",cursor:"pointer",width:"100%"}}>
                    <MessageCircle size={20}/> Prévenir le client maintenant
                  </button>
                );
              })()}
              <button onClick={()=>upSt(o.id,"chez_client")}
                style={{width:"100%",background:"#0284C7",color:G.white,border:"none",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <MapPin size={20}/> Je suis arrivé chez le client
              </button>
            </>
          )}

          {/* Étape finale: chez client → résultat */}
          {o.status==="chez_client"&&(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{background:"#FEF3C7",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#D97706",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                <MapPin size={14}/> Étape 5 — Vous êtes chez {o.client}. Comment ça s'est passé ?
              </div>
              {/* Prévenir le client par WhatsApp — chez_client */}
              {o.phone&&(()=>{
                const msg = `Salut ${o.client} 🚪\n\nJe suis *${currentUser.nom}*, ton livreur — *je suis à ta porte maintenant !* 📍\n\nTu peux descendre récupérer ta commande ?\n💵 N'oublie pas *${fmt(o.price)} CFA* en cash 🙏\n\nSi tu ne peux pas, réponds vite stp !`;
                return (
                  <a href={`https://wa.me/221${o.phone.replace(/\s+/g,"")}?text=${encodeURIComponent(msg)}`}
                    target="_blank" rel="noreferrer"
                    style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25D366",color:"#fff",borderRadius:11,padding:"13px 0",fontSize:14,fontWeight:700,textDecoration:"none",boxShadow:"0 3px 10px rgba(37,211,102,0.35)"}}>
                    <MessageCircle size={20}/> Prévenir le client — je suis là
                  </a>
                );
              })()}
              <button onClick={()=>{setLivFinalNote("");setLivFinalConfirm({orderId:o.id,type:"livre",client:o.client,price:o.price});}}
                style={{width:"100%",background:"#D1FAE5",color:"#1A5C38",border:"2px solid #6EE7B7",borderRadius:12,padding:"15px 0",fontWeight:800,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <Check size={22}/> Livré — Cash encaissé
              </button>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                <button onClick={()=>{setLivFinalNote("");setLivFinalConfirm({orderId:o.id,type:"rejete",client:o.client,price:o.price});}} style={{background:"#FEE2E2",color:"#DC2626",border:"2px solid #FCA5A5",borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <X size={18}/><span>Rejeté</span>
                </button>
                <button onClick={()=>upSt(o.id,"no_contesta")} style={{background:"#F3F4F6",color:"#6B7280",border:"2px solid #D1D5DB",borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <PhoneOff size={18}/><span>Absent</span>
                </button>
                <button onClick={()=>upSt(o.id,"reprogramar")} style={{background:"#EDE9FE",color:"#7C3AED",border:"2px solid #C4B5FD",borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <RotateCcw size={18}/><span>Reporter</span>
                </button>
              </div>
              {o.phone&&<a href={`tel:+221${o.phone.replace(/\s+/g,"")}`} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"none",color:G.gray,borderRadius:8,padding:"6px 0",fontSize:11,textDecoration:"none",border:`1px solid ${G.grayLight}`}}><Phone size={12}/> Rappeler le client</a>}
            </div>
          )}

          {/* Statuts bloqués */}
          {!["confirmado","livreur_en_route","colis_pris","en_camino","chez_client"].includes(o.status)&&(
            <button onClick={()=>upSt(o.id,"en_camino")} style={{width:"100%",background:G.grayLight,color:G.gray,border:"none",borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <RotateCcw size={13}/> Reprendre la livraison
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
<Pencil size={11} style={{display:"inline",verticalAlign:"-1px"}}/> {prev.l}
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
            <span style={{display:"inline-flex",alignItems:"center"}}>{showModif?<ChevronUp size={13}/>:<Pencil size={13}/>}</span>
            <span>{showModif?"Fermer la correction":"Corriger le statut"}</span>
          </button>
          {showModif&&(
            <div style={{marginTop:6,padding:"10px",background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0"}}>
              <div style={{fontSize:10,color:G.gray,fontWeight:700,letterSpacing:0.5,marginBottom:7}}>CHANGER STATUT</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {[
                  {s:"confirmado",      Ico:Check,    l:"Confirmé"},
                  {s:"livreur_en_route",Ico:Bike,     l:"En route"},
                  {s:"colis_pris",      Ico:Package,  l:"Colis pris"},
                  {s:"en_camino",       Ico:Rocket,   l:"Vers client"},
                  {s:"chez_client",     Ico:MapPin,   l:"Chez client"},
                  {s:"entregado",       Ico:Check,    l:"Livré"},
                  {s:"rechazado",       Ico:X,        l:"Rejeté"},
                  {s:"no_contesta",     Ico:PhoneOff, l:"Absent"},
                  {s:"reprogramar",     Ico:RotateCcw,l:"Reporter"},
                ].map(({s,Ico,l})=>(
                  <button key={s} onClick={()=>{
                    if(s==="entregado"){setLivFinalNote("");setLivFinalConfirm({orderId:o.id,type:"livre",client:o.client,price:o.price});setOpenModifId(null);return;}
                    if(s==="rechazado"){setLivFinalNote("");setLivFinalConfirm({orderId:o.id,type:"rejete",client:o.client,price:o.price});setOpenModifId(null);return;}
                    if(s==="en_camino"){
                      const active=orders.find(x=>String(x.livreur_id)===String(currentUser.id)&&x.status==="en_camino"&&x.id!==o.id);
                      if(active){addToast(`Termine la livraison de ${active.client} d'abord !`,"⚠️","#F0A500");return;}
                    }
                    upSt(o.id,s);
                    setOpenModifId(null);
                  }}
                    style={{background:o.status===s?"#1A5C38":"#fff",color:o.status===s?"#fff":G.dark,border:`1.5px solid ${o.status===s?"#1A5C38":"#E2E8F0"}`,borderRadius:8,padding:"5px 9px",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                    <Ico size={12}/><span>{l}</span>
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
          <Phone size={12}/> Appeler
        </a>
        <button onClick={()=>{setNoteModal(o.id);setNoteText(o.note||"");}}
          style={{flex:1,background:o.note?"#FFFBEB":"#F9FAFB",color:o.note?"#92400E":"#6B7280",border:`1px solid ${o.note?"#FDE68A":"#E5E7EB"}`,borderRadius:8,padding:"8px 0",fontSize:11,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5}}>
          <StickyNote size={12}/> {o.note?"Note ●":"+ Note"}
        </button>
        {(role==="admin"||role==="closer")&&(
          <button onClick={()=>setEditOrder({...o})}
            style={{flex:1,background:"#F9FAFB",color:"#374151",border:"1px solid #E5E7EB",borderRadius:8,padding:"8px 0",fontSize:11,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <Pencil size={12}/> Modifier
          </button>
        )}
      </div>
      )}
      </div>{/* end actions zone */}

      {/* Avis client — visible une fois la commande livrée et notée
          (caché si l'admin a désactivé globalement les avis via Paramètres) */}
      {!inOtherFlow && o.status === "entregado" && settings?.reviewsEnabled !== false && (o.rating || o.rating_product || o.rating_livreur || o.rating_closer) && (
        <div style={{
          marginTop:10,background:"#FFFBEB",border:"1px solid #FDE68A",
          borderRadius:10,padding:"10px 12px",
        }}>
          <div style={{fontSize:10,color:"#92400E",fontWeight:700,letterSpacing:0.5,marginBottom:6}}>AVIS CLIENT</div>
          {(o.rating_product || o.rating_livreur || o.rating_closer) ? (
            <div style={{display:"flex",justifyContent:"space-between",gap:6,marginBottom:o.review?6:0}}>
              {[
                {l:"📦 Produit",v:o.rating_product},
                {l:"🛵 Livreur",v:o.rating_livreur},
                {l:"📞 Appel",  v:o.rating_closer},
              ].map((r,i)=> r.v ? (
                <div key={i} style={{flex:1,textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#F59E0B",letterSpacing:0.5}}>
                    {"★".repeat(r.v)}<span style={{color:"#D1D5DB"}}>{"★".repeat(5-r.v)}</span>
                  </div>
                  <div style={{fontSize:9,color:"#78350F",marginTop:2}}>{r.l}</div>
                </div>
              ) : null)}
            </div>
          ) : (
            <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",marginBottom:o.review?6:0}}>
              <div style={{fontSize:14,color:"#F59E0B",letterSpacing:1}}>
                {"★".repeat(o.rating)}<span style={{color:"#D1D5DB"}}>{"★".repeat(5-o.rating)}</span>
              </div>
            </div>
          )}
          {o.review && (
            <div style={{fontSize:12,color:"#78350F",lineHeight:1.4,fontStyle:"italic"}}>
              « {o.review} »
            </div>
          )}
        </div>
      )}
    </div>
  );
};
