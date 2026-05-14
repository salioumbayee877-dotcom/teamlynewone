import React, { useState, useEffect } from "react";
import { CityComboBox } from "./CityComboBox";
import { detectDeliveryZone, WA_ZONES } from "../lib/senegal";
import {
  Package, User, Smartphone, MapPin, Bike, Pencil, Hash, Percent,
  Gift, Check, Truck, Coins, Bell, Rocket, Bus, MessageCircle, Send,
  AlertTriangle, Pin, Building2, Circle, Hourglass,
} from "lucide-react";

export function OrderModal({products, orders, newOrder, setNewOrder, addOrder, onClose, G, fmt, FRAIS_LIV, livreurs=[], waTemplate="", setWaTemplate, boutique="Teamly", mainRegion=null, otherRegions=[], defaultDeliveryPrice=3500, onOpenFraisConfig=null}) {
  const [showWAPreview, setShowWAPreview] = useState(false);
  // Auto-asignación: si solo hay un livreur, seleccionarlo automáticamente
  useEffect(()=>{
    if(livreurs.length===1 && !newOrder.livreur){
      setNewOrder({...newOrder, livreur: livreurs[0]});
    }
  },[livreurs.length]);
  const prod = products.find(p=>p.name===newOrder.product);
  const qty  = parseInt(newOrder.qty||1);
  const disc = parseFloat(newOrder.discount||0);
  const basePrice = prod ? prod.price * qty : 0;
  const bundleSelected = prod?.bundles?.find(b=>String(b.id)===newOrder.bundle);
  const finalPrice = bundleSelected ? bundleSelected.prixVente : (disc>0 ? Math.round(basePrice*(1-disc/100)) : basePrice);
  const fraisZone  = parseInt(newOrder.deliveryFee||0) || newOrder.fraisLiv || prod?.fraisLiv || FRAIS_LIV;
  const margeTotal = prod ? finalPrice - prod.cost*qty - fraisZone : 0;
  const zoneInfo   = detectDeliveryZone(newOrder.city||"", mainRegion, otherRegions, defaultDeliveryPrice);
  const clientSuggestions = newOrder.phone?.length>=3
    ? [...new Map(orders.filter(o=>o.phone?.includes(newOrder.phone)||o.client?.toLowerCase().includes((newOrder.phone||"").toLowerCase())).map(o=>[o.phone,o])).values()].slice(0,3)
    : [];
  const TN={quantite:"Pack Qté",bxgyf:"Buy X Get Y",kit:"Kit"};
  const TL={quantite:"#2563EB",bxgyf:"#7C3AED",kit:"#D97706"};
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:window.innerWidth>=900?"center":"flex-end"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:G.white,borderRadius:window.innerWidth>=900?20:"20px 20px 0 0",padding:22,width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{fontWeight:700,fontSize:16,color:G.green,marginBottom:14,display:"flex",alignItems:"center",gap:6}}><Package size={17}/> Nouvelle commande confirmée</div>
        <div style={{marginBottom:9}}>
          <div style={{fontSize:11,color:G.gray,marginBottom:3,display:"flex",alignItems:"center",gap:4}}><User size={11}/> Nom client *</div>
          <input type="text" value={newOrder.client||""} onChange={e=>setNewOrder({...newOrder,client:e.target.value})} placeholder="Moussa Diallo"
            style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:9}}>
          <div style={{fontSize:11,color:G.gray,marginBottom:3,display:"flex",alignItems:"center",gap:4}}><Smartphone size={11}/> Téléphone *</div>
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
                  <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Circle size={10} fill={sc>=80?"#16a34a":sc>=50?"#f59e0b":"#dc2626"} stroke={sc>=80?"#16a34a":sc>=50?"#f59e0b":"#dc2626"}/> {sc}%</span>
                </button>;
              })}
            </div>
          )}
        </div>
        {/* ── Localisation client (Ville + Quartier/Rue regroupés) ── */}
        <div style={{marginBottom:9,background:"#F9FAFB",border:`1px solid ${G.grayLight}`,borderRadius:10,padding:"10px 12px"}}>
          <div style={{fontSize:10,fontWeight:700,color:G.gray,letterSpacing:0.5,textTransform:"uppercase",marginBottom:8,display:"flex",alignItems:"center",gap:5}}><Pin size={11}/> Localisation client</div>

          <div style={{marginBottom:9}}>
            <div style={{fontSize:11,color:G.gray,marginBottom:3,display:"flex",alignItems:"center",gap:4}}><Building2 size={11}/> Ville du client</div>
            <CityComboBox
              value={newOrder.city||""}
              onCityChange={(cityName, zoneInfo)=>{
                const autoFee = zoneInfo.type!=="unknown" ? String(zoneInfo.price) : "";
                const OTHER = ["en_attente_paiement","paiement_confirme","livreur_en_route","colis_en_main","en_route","remis_transporteur"];
                const MAIN  = ["confirmado","livreur_en_route","colis_pris","en_camino","chez_client"];
                setNewOrder(p=>{
                  let ds = p.deliveryStatus;
                  if (zoneInfo.type === "other" && MAIN.includes(ds)) ds = "en_attente_paiement";
                  else if (zoneInfo.type !== "other" && OTHER.includes(ds)) ds = "confirmado";
                  return {
                    ...p, city:cityName,
                    deliveryZoneType: zoneInfo.type,
                    deliveryZoneName: zoneInfo.name||"",
                    deliveryFee: p.deliveryFeeOverridden ? p.deliveryFee : autoFee,
                    deliveryFeeOverridden: zoneInfo.type!=="unknown" ? false : p.deliveryFeeOverridden,
                    deliveryStatus: ds,
                  };
                });
              }}
              onConfig={onOpenFraisConfig ? ()=>{onClose();onOpenFraisConfig();} : null}
              mainRegion={mainRegion} otherRegions={otherRegions}
              defaultDeliveryPrice={defaultDeliveryPrice} G={G} fmt={fmt}
            />
            {newOrder.city&&(
              <div style={{marginTop:5}}>
                {zoneInfo.type==="main"   &&<span style={{background:"#DCFCE7",color:"#166534",borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}><Circle size={10} fill="#16a34a" stroke="#16a34a"/> {zoneInfo.name} · {fmt(zoneInfo.price)} CFA</span>}
                {zoneInfo.type==="other"  &&<span style={{background:"#DBEAFE",color:"#1E40AF",borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}><Circle size={10} fill="#2563eb" stroke="#2563eb"/> {zoneInfo.name} · {fmt(zoneInfo.price)} CFA</span>}
                {zoneInfo.type==="senegal"&&<span style={{background:"#F3F4F6",color:"#374151",borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}><Circle size={10} stroke="#9CA3AF"/> {zoneInfo.name} · tarif par défaut</span>}
                {zoneInfo.type==="unknown"&&<span style={{background:"#FEF3C7",color:"#92400E",borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}><AlertTriangle size={11}/> Ville inconnue — frais à saisir</span>}
              </div>
            )}
          </div>

          <div>
            <div style={{fontSize:11,color:G.gray,marginBottom:3,display:"flex",alignItems:"center",gap:4}}><MapPin size={11}/> Quartier ou rue</div>
            <input type="text" value={newOrder.address||""} onChange={e=>setNewOrder(p=>({...p,address:e.target.value}))} placeholder="Médina, rue 10"
              style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box",background:G.white}}/>
          </div>
        </div>

        {/* ── Frais de livraison (auto-rempli, modifiable) ── */}
        <div style={{marginBottom:9}}>
          <div style={{fontSize:11,color:G.gray,marginBottom:3,display:"flex",alignItems:"center",gap:4}}><Bike size={11}/> Frais de livraison (CFA)</div>
          <input type="number" min="0" value={newOrder.deliveryFee||""} onChange={e=>{
            setNewOrder(p=>({...p,deliveryFee:e.target.value,deliveryFeeOverridden:true}));
          }} placeholder="ex: 1500"
            style={{width:"100%",border:`1.5px solid ${newOrder.deliveryFeeOverridden?"#F59E0B":G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          {newOrder.deliveryFeeOverridden && <div style={{fontSize:10,color:"#92400E",marginTop:3,display:"flex",alignItems:"center",gap:4}}><Pencil size={10}/> Modifié manuellement — ville inconnue sera enregistrée automatiquement</div>}
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,color:G.gray,marginBottom:3,display:"flex",alignItems:"center",gap:4}}><Package size={11}/> Produit *</div>
          <select value={newOrder.product||""} onChange={e=>setNewOrder({...newOrder,product:e.target.value,bundle:"",qty:"1",discount:""})}
            style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:G.dark,background:G.white,boxSizing:"border-box"}}>
            <option value="">Sélectionner un produit...</option>
            {products.map(p=><option key={p.id} value={p.name}>{p.name} — {fmt(p.price)} CFA · stock: {p.stock}</option>)}
          </select>
        </div>
        {prod&&!bundleSelected&&(
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3,display:"flex",alignItems:"center",gap:4}}><Hash size={11}/> Quantité</div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <button onClick={()=>setNewOrder(p=>({...p,qty:String(Math.max(1,parseInt(p.qty||1)-1))}))} style={{background:G.grayLight,border:"none",borderRadius:6,width:32,height:36,cursor:"pointer",fontSize:18,fontWeight:700}}>−</button>
                <div style={{flex:1,textAlign:"center",fontSize:18,fontWeight:700,background:G.white,border:`1.5px solid ${G.grayLight}`,borderRadius:8,padding:"5px 0"}}>{qty}</div>
                <button onClick={()=>setNewOrder(p=>({...p,qty:String(parseInt(p.qty||1)+1)}))} style={{background:G.greenLight,border:"none",borderRadius:6,width:32,height:36,cursor:"pointer",fontSize:18,fontWeight:700,color:G.green}}>+</button>
              </div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:G.gray,marginBottom:3,display:"flex",alignItems:"center",gap:4}}><Percent size={11}/> Réduction %</div>
              <div style={{position:"relative"}}>
                <input type="number" min="0" max="100" value={newOrder.discount||""} onChange={e=>setNewOrder({...newOrder,discount:e.target.value})} placeholder="0"
                  style={{width:"100%",border:`1.5px solid ${disc>0?"#FCA5A5":G.grayLight}`,borderRadius:8,padding:"8px 28px 8px 12px",fontSize:14,outline:"none",boxSizing:"border-box",fontWeight:600}}/>
                <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:G.gray}}>%</span>
              </div>
              {disc>0&&<div style={{fontSize:10,color:G.red,marginTop:2}}>−{fmt(Math.round(basePrice*disc/100))} CFA</div>}
            </div>
          </div>
        )}
        {prod&&(
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,color:G.gray,marginBottom:6,fontWeight:600,display:"flex",alignItems:"center",gap:4}}><Gift size={11}/> Option bundle</div>
            <button onClick={()=>setNewOrder({...newOrder,bundle:""})}
              style={{width:"100%",background:!newOrder.bundle?G.greenLight:"#F9F9F9",border:`2px solid ${!newOrder.bundle?G.green:G.grayLight}`,borderRadius:10,padding:"9px 14px",cursor:"pointer",textAlign:"left",marginBottom:5,display:"flex",justifyContent:"space-between"}}>
              <div><div style={{fontWeight:600,fontSize:13,color:!newOrder.bundle?G.green:G.gray,display:"flex",alignItems:"center",gap:5}}><Package size={13}/> Sans bundle</div><div style={{fontSize:11,color:G.gray}}>Qté et réduction libres</div></div>
              {!newOrder.bundle&&<Check size={14} color={G.green}/>}
            </button>
            {(prod.bundles||[]).length>0?(prod.bundles||[]).map(b=>{
              const qr=b.type==="bxgyf"?(b.qte+(b.qteOfferte||0)):b.qte,cout=prod.cost*qr,fl=b.livraisonOfferte?0:(prod.fraisLiv||FRAIS_LIV),m=b.prixVente-cout-fl,isSel=newOrder.bundle===String(b.id);
              return <button key={b.id} onClick={()=>setNewOrder({...newOrder,bundle:String(b.id),qty:"1",discount:""})}
                style={{width:"100%",background:isSel?"#FFF8E7":"#F9F9F9",border:`2px solid ${isSel?G.gold:G.grayLight}`,borderRadius:10,padding:"9px 14px",cursor:"pointer",textAlign:"left",marginBottom:5,display:"flex",justifyContent:"space-between"}}>
                <div>
                  <div style={{display:"flex",gap:5,marginBottom:2}}>
                    <span style={{fontWeight:700,fontSize:13,color:isSel?G.gold:G.dark}}>{b.label}</span>
                    <span style={{background:"#F3F4F6",color:TL[b.type]||"#666",borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:700}}>{TN[b.type]||b.type}</span>
                    {b.livraisonOfferte&&<span style={{background:G.greenLight,color:G.green,borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:700,display:"inline-flex",alignItems:"center"}}><Truck size={11}/></span>}
                  </div>
                  <div style={{fontSize:11,color:G.gray}}>{b.qte}u{b.type==="bxgyf"?` + ${b.qteOfferte} offert`:""} · marge: <strong style={{color:m>=0?G.green:G.red}}>{fmt(m)} CFA</strong></div>
                </div>
                <div style={{fontWeight:700,fontSize:14,color:isSel?G.gold:G.gray,whiteSpace:"nowrap",marginLeft:8}}>{fmt(b.prixVente)} CFA</div>
              </button>;
            }):<div style={{background:G.grayLight,borderRadius:10,padding:"8px 12px",fontSize:11,color:G.gray,textAlign:"center"}}>Aucun bundle — <span style={{color:G.green,fontWeight:600}}>à créer dans Stock</span></div>}
          </div>
        )}
        {prod&&(
          <div style={{background:margeTotal>=0?G.greenLight:"#FEE2E2",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontSize:13,color:G.gray,fontWeight:600,display:"inline-flex",alignItems:"center",gap:5}}><Coins size={13}/> Prix COD</span>
              <span style={{fontSize:24,fontWeight:700,color:G.green}}>{fmt(finalPrice)} CFA</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
              <span style={{fontSize:11,color:G.gray,display:"inline-flex",alignItems:"center",gap:4}}><Truck size={11}/> Livraison ({(WA_ZONES.find(z=>z.key===(newOrder.zone||"sn_dakar"))||WA_ZONES[0]).label})</span>
              <span style={{fontSize:11,color:G.gray}}>−{fmt(fraisZone)} CFA</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:11,color:G.gray}}>Marge estimée</span>
              <span style={{fontSize:13,fontWeight:700,color:margeTotal>=0?G.green:G.red}}>{fmt(margeTotal)} CFA</span>
            </div>
            {qty>1&&!bundleSelected&&<div style={{fontSize:11,color:G.gray,marginTop:2}}>×{qty}{disc>0?` · −${disc}%`:""}</div>}
          </div>
        )}
        {/* Situation du colis — TOUJOURS obligatoire */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:G.gray,marginBottom:5,fontWeight:600,display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
            <Package size={11}/> Situation du colis <span style={{color:"#EF4444",fontWeight:700}}>*</span>
            {zoneInfo.type==="other"&&<span style={{marginLeft:6,background:"#DBEAFE",color:"#1E40AF",borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700,display:"inline-flex",alignItems:"center",gap:3}}><Bus size={10}/> Hors zone — prépayé</span>}
          </div>
          <select value={newOrder.deliveryStatus||""} onChange={e=>setNewOrder({...newOrder,deliveryStatus:e.target.value})}
            style={{width:"100%",border:`1.5px solid ${!newOrder.deliveryStatus?"#FCA5A5":G.green}`,borderRadius:8,padding:"9px 12px",fontSize:13,color:newOrder.deliveryStatus?G.dark:"#9CA3AF",background:G.white,boxSizing:"border-box"}}>
            <option value="" disabled>— Sélectionner la situation —</option>
            {zoneInfo.type==="other"?(
              <>
                <option value="en_attente_paiement">En attente de paiement</option>
                <option value="paiement_confirme">Paiement confirmé</option>
                <option value="livreur_en_route">Livreur en route</option>
                <option value="colis_en_main">Colis en main</option>
                <option value="en_route">Aller vers le transporteur</option>
                <option value="remis_transporteur">Remis au transporteur</option>
                <option value="entregado">Livré</option>
              </>
            ):(
              <>
                <option value="confirmado">Client confirmé — Prêt pour livraison</option>
                <option value="livreur_en_route">En route pour récupérer le colis</option>
                <option value="colis_pris">Colis en main — Prêt à livrer</option>
                <option value="en_camino">En route vers le client</option>
                <option value="chez_client">Déjà chez le client</option>
                <option value="entregado">Payé — Livraison encaissée</option>
              </>
            )}
          </select>
          {!newOrder.deliveryStatus&&<div style={{fontSize:10,color:"#EF4444",marginTop:4,display:"flex",alignItems:"center",gap:4}}><AlertTriangle size={11}/> Champ obligatoire — sans ça, impossible d'enregistrer</div>}
        </div>

        {/* Assigner livreur — auto si un seul, manuel si plusieurs */}
        {livreurs.length>1&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:G.gray,marginBottom:5,fontWeight:600,display:"flex",alignItems:"center",gap:4}}><Bike size={11}/> Livreur</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {livreurs.map(l=>(
                <button key={l} onClick={()=>setNewOrder({...newOrder,livreur:l})}
                  style={{background:newOrder.livreur===l?G.greenLight:"#F9FAFB",color:newOrder.livreur===l?G.green:G.gray,border:`1.5px solid ${newOrder.livreur===l?G.green:"#E5E7EB"}`,borderRadius:8,padding:"6px 11px",fontSize:12,fontWeight:newOrder.livreur===l?700:400,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>
                  <Bike size={12}/> {l}
                </button>
              ))}
            </div>
          </div>
        )}
        {livreurs.length===1&&newOrder.livreur&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:G.gray,marginBottom:5,fontWeight:600,display:"flex",alignItems:"center",gap:4}}><Bike size={11}/> Livreur</div>
            <div style={{display:"inline-flex",alignItems:"center",gap:4,background:G.greenLight,color:G.green,border:`1.5px solid ${G.green}`,borderRadius:8,padding:"6px 11px",fontSize:12,fontWeight:700}}>
              <Bike size={12}/> {newOrder.livreur} <Check size={12}/>
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
                  <MessageCircle size={16} color="#92400E"/>
                  <span style={{fontSize:12,fontWeight:700,color:"#92400E"}}>Message WhatsApp</span>
                  {hasData&&<span style={{background:"#FDE68A",borderRadius:6,padding:"1px 7px",fontSize:10,color:"#92400E",fontWeight:700,display:"inline-flex",alignItems:"center",gap:3}}>Aperçu <Check size={10}/></span>}
                </div>
                <span style={{fontSize:12,color:G.gray}}>{showWAPreview?"▲":"▼"}</span>
              </button>

              {showWAPreview&&(
                <div style={{background:"#F9F9F9",borderRadius:"0 0 10px 10px",border:"1px solid #FDE68A",borderTop:"none",padding:14}}>

                  {/* Aperçu du message tel qu'il sera envoyé */}
                  <div style={{fontSize:11,color:G.gray,fontWeight:600,marginBottom:8,display:"flex",alignItems:"center",gap:4}}><Smartphone size={11}/> APERÇU DU MESSAGE</div>
                  <div style={{background:G.white,borderRadius:10,padding:12,marginBottom:12,border:"1px solid #E5E7EB",fontFamily:"monospace",fontSize:12,color:"#111",lineHeight:1.6,whiteSpace:"pre-wrap",maxHeight:140,overflowY:"auto"}}>
                    {previewMsg}
                  </div>

                  {/* Variables disponibles */}
                  <div style={{fontSize:10,color:G.gray,marginBottom:8}}>
                    Variables disponibles : <span style={{color:"#7C3AED",fontWeight:600}}>{"{client}"} {"{produit}"} {"{prix}"} {"{adresse}"} {"{boutique}"} {"{livreur}"}</span>
                  </div>

                  {/* Éditeur de template */}
                  <div style={{fontSize:11,color:G.gray,fontWeight:600,marginBottom:5,display:"flex",alignItems:"center",gap:4}}><Pencil size={11}/> MODIFIER LE MESSAGE</div>
                  <textarea value={waTemplate} onChange={e=>setWaTemplate&&setWaTemplate(e.target.value)}
                    style={{width:"100%",border:"1.5px solid #FDE68A",borderRadius:8,padding:10,fontSize:12,outline:"none",minHeight:110,resize:"vertical",boxSizing:"border-box",fontFamily:"monospace",lineHeight:1.5}}/>
                  <button onClick={()=>setWaTemplate&&setWaTemplate(`✅ Commande confirmée !\n\n📦 {produit}\n💰 {prix} CFA (paiement à la livraison)\n📍 {adresse}\n📲 Enregistrez notre numéro pour ne pas rater aucune promotion !\nNos meilleures offres sont publiées dans nos statuts WhatsApp 🔥`)}
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
            style={{flex:1,background:newOrder.deliveryStatus?G.green:"#D1D5DB",color:"#fff",border:"none",borderRadius:10,padding:12,fontWeight:600,fontSize:13,cursor:newOrder.deliveryStatus?"pointer":"not-allowed",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}}>
            + WhatsApp <Send size={13}/>
          </button>
        </div>
        <button onClick={onClose} style={{width:"100%",background:"none",border:"none",color:G.gray,padding:10,cursor:"pointer",fontSize:13}}>Annuler</button>
      </div>
    </div>
  );
}
