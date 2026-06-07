import React, { useState, useEffect, useRef } from "react";
import { useAppContext } from "../context/AppContext";
import { CityAutocomplete } from "./CityComboBox";
import { _normCity, _parseCity, SENEGAL_CITIES, detectDeliveryZone } from "../lib/senegal";
import {
  Truck, Globe, Settings as IcoSettings, BarChart3, FlaskConical, Check,
  Bike, Pencil, Coins, AlertTriangle, Bus, Search, FileText, Circle,
  Building2,
} from "lucide-react";

export const FraisPage = () => {
  const {
    G, fmt, fmtCity, sbFetch,
    role, settings, orgId, mainRegion, otherRegions,
    fraisConfigTab, fraisMainNameEdit, fraisEditCity, fraisNewMain, fraisNewOther,
    fraisTableauSearch, fraisTableauFilter, fraisTestCity,
    setMainRegion, setOtherRegions, setSettings, patchOrgSettings, setConfirmModal,
    setFraisConfigTab, setFraisMainNameEdit, setFraisEditCity, setFraisNewMain, setFraisNewOther,
    setFraisTableauSearch, setFraisTableauFilter, setFraisTestCity,
    addToast,
  } = useAppContext();

  const mainCities = (mainRegion?.cities||[]).map(s=>{ const {name,price}=_parseCity(s); return {name,price:price??mainRegion?.price??3500,raw:s}; });
  const defaultPrice = settings.defaultDeliveryPrice||3500;
  const allNames = [...mainCities.map(c=>c.name),...otherRegions.map(r=>r.name)];

  // Regroupe les villes de la zone principale par département (affichage visuel).
  // Le département vient de la base géo ; les villes inconnues → "Autres".
  const _DEPT_ORDER = ["Dakar","Pikine","Guediawaye","Rufisque","Keur Massar"];
  const cityDept = (name) => SENEGAL_CITIES.find(c=>_normCity(c.city)===_normCity(name))?.department || "Autres";
  const mainGrouped = (()=>{
    const groups={};
    mainCities.forEach((c,i)=>{ const d=cityDept(c.name); (groups[d]=groups[d]||[]).push({...c,idx:i}); });
    return Object.keys(groups).sort((a,b)=>{
      const ia=_DEPT_ORDER.indexOf(a), ib=_DEPT_ORDER.indexOf(b);
      if(ia!==-1||ib!==-1) return (ia===-1?99:ia)-(ib===-1?99:ib);
      return a.localeCompare(b);
    }).map(k=>({dept:k,cities:groups[k]}));
  })();

  // ── Local input state (isolated from context re-renders) ──
  // Keeps numeric inputs reactive to typing without losing focus / dropping
  // keystrokes on every appCtx rebuild. Synced from context only when the user
  // hasn't typed in the last 1500ms (so external bulk-applies still update UI).
  const [dakarPrice, setDakarPrice]       = useState(String(mainRegion?.price ?? ""));
  const [regLocalFee, setRegLocalFee]     = useState(String(settings.regional_local_fee ?? 1500));
  const [regTransportFee, setRegTransportFee] = useState(String(settings.regional_transport_fee ?? 2000));
  const lastTypeRef = useRef(0);
  const [openDepts, setOpenDepts] = useState({}); // départements dépliés (zone principale)

  useEffect(() => {
    if (Date.now() - lastTypeRef.current > 1500) {
      setDakarPrice(String(mainRegion?.price ?? ""));
    }
  }, [mainRegion?.id, mainRegion?.price]);
  useEffect(() => {
    if (Date.now() - lastTypeRef.current > 1500) {
      setRegLocalFee(String(settings.regional_local_fee ?? 1500));
      setRegTransportFee(String(settings.regional_transport_fee ?? 2000));
    }
  }, [settings.regional_local_fee, settings.regional_transport_fee]);

  const seedData = async() => {
    const DEFAULT_RATE = 2500;
    // All already-configured city norms (main + other regions)
    const configuredNorms = new Set([
      ...(mainRegion?.cities||[]).map(s=>_normCity(s.split("|")[0])),
      ...otherRegions.flatMap(r=>[_normCity(r.name),...(r.cities||[]).map(s=>_normCity(s.split("|")[0]))])
    ]);
    const mainRegNorm = _normCity(mainRegion?.name||"dakar");
    // Partition SENEGAL_CITIES into new vs already-configured
    const newCities = SENEGAL_CITIES.filter(c=>!configuredNorms.has(_normCity(c.city)));
    const skipped   = SENEGAL_CITIES.length - newCities.length;
    const forMain   = newCities.filter(c=>_normCity(c.region)===mainRegNorm);
    const forOthers = newCities.filter(c=>_normCity(c.region)!==mainRegNorm);
    // Update main zone
    if(forMain.length>0){
      const updatedCities=[...(mainRegion?.cities||[]),...forMain.map(c=>`${c.city}|${DEFAULT_RATE}`)];
      if(mainRegion?.id){await sbFetch(`delivery_main_region?id=eq.${mainRegion.id}`,"PATCH",{cities:updatedCities}).catch(()=>{}); setMainRegion(r=>({...r,cities:updatedCities}));}
      else{const res=await sbFetch("delivery_main_region","POST",{org_id:orgId,name:mainRegion?.name||"Dakar",price:DEFAULT_RATE,cities:updatedCities}).catch(()=>null);const s=Array.isArray(res)?res[0]:res;if(s)setMainRegion(s);}
    }
    // Group other cities by region and upsert
    const byRegion={};
    for(const c of forOthers){if(!byRegion[c.region])byRegion[c.region]=[];byRegion[c.region].push(c.city);}
    for(const [regionName,cities] of Object.entries(byRegion)){
      const cityEntries=cities.map(c=>`${c}|${DEFAULT_RATE}`);
      const existingR=otherRegions.find(r=>_normCity(r.name)===_normCity(regionName));
      if(existingR){
        const updated=[...(existingR.cities||[]),...cityEntries];
        await sbFetch(`delivery_other_regions?id=eq.${existingR.id}`,"PATCH",{cities:updated}).catch(()=>{});
        setOtherRegions(prev=>prev.map(r=>r.id===existingR.id?{...r,cities:updated}:r));
      } else {
        const res=await sbFetch("delivery_other_regions","POST",{org_id:orgId,name:regionName,price:DEFAULT_RATE,interurbain_price:0,cities:cityEntries}).catch(()=>null);
        const s=Array.isArray(res)?res[0]:res; if(s)setOtherRegions(prev=>[...prev,s]);
      }
    }
    const msg=skipped>0
      ? `${skipped} ville${skipped>1?"s":""} déjà configurée${skipped>1?"s":""} conservée${skipped>1?"s":""}. ${newCities.length} nouvelle${newCities.length>1?"s":""} ville${newCities.length>1?"s":""} ajoutée${newCities.length>1?"s":""}.`
      : `14 régions et ${newCities.length} villes ajoutées avec un tarif standard de 2 500 CFA. Vous pouvez modifier chaque tarif individuellement.`;
    addToast(msg,"🌍","#D97706");
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Page header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontWeight:800,fontSize:16,color:G.dark,display:"flex",alignItems:"center",gap:6}}><Truck size={17}/> Zones de livraison</div>
          <div style={{fontSize:11,color:G.gray,marginTop:2}}>Frais appliqués automatiquement selon la ville du client</div>
        </div>
        <button onClick={seedData} style={{background:"linear-gradient(135deg,#F59E0B,#D97706)",color:"#fff",border:"none",borderRadius:12,padding:"10px 18px",fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:8,boxShadow:"0 3px 10px rgba(217,119,6,0.4)"}}>
          <Globe size={22}/>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:13}}>Pré-remplir Sénégal</div>
            <div style={{fontSize:10,fontWeight:500,opacity:0.9,marginTop:1}}>120+ villes configurées automatiquement</div>
          </div>
        </button>
      </div>

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:0,background:"#F3F4F6",borderRadius:12,padding:3}}>
        {[["config","Config",IcoSettings],["tableau","Tableau",BarChart3],["test","Test",FlaskConical]].map(([k,l,Ico])=>(
          <button key={k} onClick={()=>setFraisConfigTab(k)} style={{flex:1,background:fraisConfigTab===k?"#fff":"transparent",border:"none",borderRadius:10,padding:"8px 0",fontSize:12,fontWeight:700,color:fraisConfigTab===k?G.dark:G.gray,cursor:"pointer",transition:"background 0.15s",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5}}><Ico size={13}/> {l}</button>
        ))}
      </div>

      {fraisConfigTab==="config"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Card A — Région principale de vente */}
          <div style={{background:"#F0FDF4",borderRadius:16,border:"1.5px solid #86EFAC",overflow:"hidden",boxShadow:"0 2px 8px rgba(134,239,172,0.25)"}}>
            <div style={{background:"#DCFCE7",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              {fraisMainNameEdit!==null
                ? <div style={{display:"flex",gap:6,flex:1}}>
                    <select value={fraisMainNameEdit} onChange={e=>setFraisMainNameEdit(e.target.value)}
                      style={{flex:1,border:"1.5px solid #86EFAC",borderRadius:8,padding:"6px 10px",fontSize:14,fontWeight:700,outline:"none",background:"#fff",color:"#14532D"}}>
                      {["Dakar","Thiès","Diourbel","Fatick","Kaolack","Kaffrine","Kolda","Ziguinchor","Sédhiou","Tambacounda","Kédougou","Louga","Matam","Saint-Louis"].map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={async()=>{
                      const name=(fraisMainNameEdit||"").trim();
                      if(!name){setFraisMainNameEdit(null);return;}
                      if(mainRegion?.id){ await sbFetch(`delivery_main_region?id=eq.${mainRegion.id}`,"PATCH",{name}).catch(()=>{}); setMainRegion(r=>({...r,name})); }
                      else { const res=await sbFetch("delivery_main_region","POST",{org_id:orgId,name,price:1500,cities:[]}).catch(()=>null); const s=Array.isArray(res)?res[0]:res; if(s)setMainRegion(s); }
                      setFraisMainNameEdit(null);
                    }} style={{background:G.green,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontSize:13,display:"inline-flex",alignItems:"center",gap:5}}><Check size={13}/> OK</button>
                    <button onClick={()=>setFraisMainNameEdit(null)} style={{background:"#F3F4F6",border:"1px solid #D1D5DB",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:13,color:G.gray}}>Annuler</button>
                  </div>
                : <>
                    <div>
                      <div style={{fontSize:12,color:"#166534",fontWeight:600,display:"flex",alignItems:"center",gap:5}}><Bike size={13}/> Zone principale · Livraison Locale (Moto)</div>
                      <div style={{fontSize:16,fontWeight:800,color:"#14532D"}}>{mainRegion?.name||"Non configurée"}</div>
                    </div>
                    <button onClick={()=>setFraisMainNameEdit(mainRegion?.name||"")}
                      style={{background:"#fff",color:"#166534",border:"1.5px solid #86EFAC",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
<Pencil size={11} style={{display:"inline",verticalAlign:"-1px"}}/> Renommer
                    </button>
                  </>
              }
            </div>
            <div style={{padding:"12px 16px"}}>
              {/* Dakar global rate — single source of truth for the region */}
              <div style={{background:"#fff",borderRadius:10,padding:"12px 14px",marginBottom:12,border:"1.5px solid #BBF7D0"}}>
                <div style={{fontSize:14,fontWeight:600,color:"#14532D",display:"flex",alignItems:"center",gap:6}}><Coins size={14}/> Frais de livraison locale (Dakar)</div>
                <div style={{fontSize:12,color:G.gray,marginBottom:8}}>Appliqué à toutes les villes de la région de Dakar (sauf si surchargé par ville)</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min="0"
                    value={dakarPrice}
                    onChange={e=>{
                      lastTypeRef.current = Date.now();
                      const raw = e.target.value;
                      setDakarPrice(raw);
                      if(window.__dakarSaveT) clearTimeout(window.__dakarSaveT);
                      window.__dakarSaveT = setTimeout(async()=>{
                        const v = parseInt(raw)||0;
                        setMainRegion(r => r ? {...r, price:v} : {id:null, name:"Dakar", price:v, cities:[], aliases:[]});
                        try {
                          if(mainRegion?.id) await sbFetch(`delivery_main_region?id=eq.${mainRegion.id}`,"PATCH",{price:v});
                          else { const res=await sbFetch("delivery_main_region","POST",{org_id:orgId,name:mainRegion?.name||"Dakar",price:v,cities:[]}); const s=Array.isArray(res)?res[0]:res; if(s) setMainRegion(s); }
                          addToast("✅ Tarif Dakar mis à jour","✅",G.green);
                        } catch(e){ addToast("❌ Erreur — réessayez","❌",G.red); }
                      }, 500);
                    }}
                    style={{flex:1,height:44,border:"1.5px solid #86EFAC",borderRadius:10,padding:"0 12px",fontSize:16,outline:"none",fontWeight:600}}/>
                  <span style={{fontSize:14,color:G.gray,fontWeight:600}}>CFA</span>
                </div>
                {/* Bulk apply Dakar */}
                {(()=>{
                  const cityCount = (mainRegion?.cities||[]).length;
                  const v = parseInt(mainRegion?.price)||0;
                  const disabled = role!=="admin" || cityCount===0 || !v;
                  const helper = cityCount===0
                    ? "Aucune ville à mettre à jour"
                    : `${cityCount} ville${cityCount>1?"s":""} ser${cityCount>1?"ont":"a"} mise${cityCount>1?"s":""} à jour`;
                  return (
                    <div style={{marginTop:10}}>
                      <button disabled={disabled}
                        onClick={()=>setConfirmModal({
                          msg:"⚠️ Confirmer l'application",
                          sub:`Vous allez appliquer le tarif de ${fmt(v)} CFA à toutes les villes de Dakar (${cityCount}). Cette action remplacera les tarifs individuels existants de chaque ville.`,
                          onConfirm: async()=>{
                            try {
                              const newCities = (mainRegion?.cities||[]).map(cs=>{ const i=cs.lastIndexOf("|"); const name=i===-1?cs:cs.slice(0,i); return `${name}|${v}`; });
                              await sbFetch(`delivery_main_region?id=eq.${mainRegion.id}`,"PATCH",{cities:newCities,price:v});
                              setMainRegion(r=>({...r,cities:newCities,price:v}));
                              addToast(`✅ Tarif appliqué à ${cityCount} ville${cityCount>1?"s":""} de Dakar`,"✅",G.green);
                            } catch(e){ addToast("❌ Erreur, réessayer","❌",G.red); }
                          }
                        })}
                        style={{width:"100%",height:48,background:disabled?"#9CA3AF":G.green,color:"#fff",border:"none",borderRadius:10,fontWeight:600,fontSize:15,cursor:disabled?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
<Check size={13} style={{display:"inline",verticalAlign:"-2px"}}/> Appliquer à toutes les villes de Dakar
                      </button>
                      <div style={{fontSize:11,color:G.gray,textAlign:"center",marginTop:6}}>{helper}</div>
                    </div>
                  );
                })()}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
                {mainGrouped.map((grp,gi)=>{ const isOpen=openDepts[grp.dept]??(gi===0); return (
                <div key={grp.dept} style={{border:"1.5px solid #BBF7D0",borderRadius:10,overflow:"hidden",background:"#fff"}}>
                  <button onClick={()=>setOpenDepts(p=>({...p,[grp.dept]:!isOpen}))}
                    style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"#F0FDF4",border:"none",cursor:"pointer",textAlign:"left"}}>
                    <div style={{fontSize:13,fontWeight:800,color:"#14532D",display:"flex",alignItems:"center",gap:6}}>
                      <Building2 size={13}/> {grp.dept} <span style={{fontSize:11,fontWeight:600,color:G.green}}>· {grp.cities.length} ville{grp.cities.length>1?"s":""}</span>
                    </div>
                    <span style={{fontSize:13,color:G.green,fontWeight:700}}>{isOpen?"▾":"▸"}</span>
                  </button>
                  {isOpen&&(
                  <div style={{display:"flex",flexDirection:"column",gap:5,padding:"8px 10px"}}>
                {grp.cities.map((c)=>{ const i=c.idx; return (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",background:"#fff",borderRadius:10,border:"1.5px solid #BBF7D0"}}>
                    {fraisEditCity?.isMain&&fraisEditCity?.idx===i
                      ? <div style={{display:"flex",gap:5,flex:1,flexWrap:"wrap"}}>
                          <input type="text" value={fraisEditCity.name} onChange={e=>setFraisEditCity(p=>({...p,name:e.target.value}))}
                            style={{flex:"1 1 100px",border:"1.5px solid #86EFAC",borderRadius:8,padding:"6px 10px",fontSize:13,outline:"none"}}/>
                          <input type="number" min="0" value={fraisEditCity.price} onChange={e=>setFraisEditCity(p=>({...p,price:e.target.value}))}
                            style={{width:80,border:"1.5px solid #86EFAC",borderRadius:8,padding:"6px 10px",fontSize:13,outline:"none"}}/>
                          <button onClick={async()=>{
                            const upd=[...mainCities]; upd[i]={name:fmtCity(fraisEditCity.name||""),price:parseInt(fraisEditCity.price)||0};
                            const raw=upd.map(x=>`${x.name}|${x.price}`);
                            await sbFetch(`delivery_main_region?id=eq.${mainRegion.id}`,"PATCH",{cities:raw}).catch(()=>{});
                            setMainRegion(r=>({...r,cities:raw})); setFraisEditCity(null);
                          }} style={{background:G.green,color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:12,display:"inline-flex",alignItems:"center",gap:5}}><Check size={12}/> Sauver</button>
                          <button onClick={()=>setFraisEditCity(null)} style={{background:"#F3F4F6",border:"1px solid #D1D5DB",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,color:G.gray}}>Annuler</button>
                        </div>
                      : <>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,color:G.dark}}>{c.name}</div>
                            <div style={{fontSize:11,color:G.green,fontWeight:600,display:"flex",alignItems:"center",gap:4}}><Bike size={12}/> Livraison Locale: {fmt(c.price)} CFA</div>
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>setFraisEditCity({isMain:true,idx:i,name:c.name,price:String(c.price)})}
                              style={{background:"#EFF6FF",color:"#2563EB",border:"1px solid #BFDBFE",borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
<Pencil size={11} style={{display:"inline",verticalAlign:"-1px"}}/> Modifier
                            </button>
                            <button onClick={async()=>{
                              const raw=mainCities.filter((_,j)=>j!==i).map(x=>`${x.name}|${x.price}`);
                              await sbFetch(`delivery_main_region?id=eq.${mainRegion.id}`,"PATCH",{cities:raw}).catch(()=>{});
                              setMainRegion(r=>({...r,cities:raw}));
                            }} style={{background:"#FEF2F2",color:G.red,border:"1px solid #FCA5A5",borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                              Supprimer
                            </button>
                          </div>
                        </>
                    }
                  </div>
                );})}
                  </div>
                  )}
                </div>
                );})}
                {mainCities.length===0&&<div style={{fontSize:12,color:G.gray,textAlign:"center",padding:"12px 0",fontStyle:"italic"}}>Aucune ville configurée</div>}
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <input list="frais-main-cities" type="text" value={fraisNewMain.city} onChange={e=>setFraisNewMain(p=>({...p,city:e.target.value}))} placeholder="Ville (ex: Plateau)"
                  style={{flex:"1 1 100px",border:"1.5px solid #86EFAC",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none"}}/>
                <input type="number" min="0" value={fraisNewMain.price} onChange={e=>setFraisNewMain(p=>({...p,price:e.target.value}))} placeholder="Prix CFA"
                  style={{width:90,border:"1.5px solid #86EFAC",borderRadius:8,padding:"9px 10px",fontSize:13,outline:"none"}}/>
                <button onClick={async()=>{
                  const city=fmtCity(fraisNewMain.city||""); const price=parseInt(fraisNewMain.price)||0;
                  if(!city||!price){addToast("Ville et prix requis","⚠️","#F59E0B");return;}
                  if(allNames.some(n=>_normCity(n)===_normCity(city))){addToast("Ville déjà configurée","⚠️","#F59E0B");return;}
                  const raw=[...(mainRegion?.cities||[]),`${city}|${price}`];
                  if(mainRegion?.id){ await sbFetch(`delivery_main_region?id=eq.${mainRegion.id}`,"PATCH",{cities:raw}).catch(()=>{}); setMainRegion(r=>({...r,cities:raw})); }
                  else { const res=await sbFetch("delivery_main_region","POST",{org_id:orgId,name:"Dakar",price:1500,cities:raw}).catch(()=>null); const s=Array.isArray(res)?res[0]:res; if(s)setMainRegion(s); }
                  setFraisNewMain({city:"",price:""}); addToast(`${city} ajouté ✅`,"✅",G.green);
                }} style={{background:G.green,color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Ajouter</button>
              </div>
            </div>
          </div>

          {/* Section separator */}
          <div style={{display:"flex",alignItems:"center",gap:10,margin:"2px 0"}}>
            <div style={{height:1,flex:1,background:"#E5E7EB"}}/>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,letterSpacing:"0.06em",padding:"3px 10px",background:"#F3F4F6",borderRadius:20,border:"1px solid #E5E7EB",display:"inline-flex",alignItems:"center",gap:5}}><Truck size={11}/> LIVRAISON RÉGIONALE</div>
            <div style={{height:1,flex:1,background:"#E5E7EB"}}/>
          </div>

          {/* Card B — Autres régions */}
          <div style={{background:"#EFF6FF",borderRadius:16,border:"1.5px solid #BFDBFE",overflow:"hidden",boxShadow:"0 2px 8px rgba(191,219,254,0.3)"}}>
            <div style={{background:"#DBEAFE",padding:"12px 16px"}}>
              <div style={{fontSize:12,color:"#1E40AF",fontWeight:600,display:"flex",alignItems:"center",gap:5}}><Truck size={13}/> Autres régions · Livraison Régionale (Voiture)</div>
              <div style={{fontSize:12,color:"#3B82F6",marginTop:4,lineHeight:1.5}}>
                Total = <strong style={{display:"inline-flex",alignItems:"center",gap:3}}><Bike size={12}/> Locale</strong> (livreur dans la ville du client) + <strong style={{display:"inline-flex",alignItems:"center",gap:3}}><Truck size={12}/> Régionale</strong> (transport interurbain). Le colis transite via transporteur privé.
              </div>
            </div>
            <div style={{padding:"12px 16px"}}>
              {/* Tarifs globaux Autres régions (locaux + transport + total auto) */}
              {(()=>{
                const lf = parseInt(regLocalFee)||0;
                const tf = parseInt(regTransportFee)||0;
                const total = lf + tf;
                const scheduleSave = (patch) => {
                  if(window.__regionalSaveT) clearTimeout(window.__regionalSaveT);
                  window.__regionalSaveT = setTimeout(async()=>{
                    const ok = await patchOrgSettings(patch);
                    if(ok) addToast("✅ Tarifs régionaux mis à jour","✅",G.green);
                    else addToast("❌ Erreur — réessayez","❌",G.red);
                  }, 500);
                };
                return (
                  <div style={{background:"#fff",borderRadius:10,padding:"14px",marginBottom:12,border:"1.5px solid #93C5FD"}}>
                    <div style={{fontSize:14,fontWeight:600,color:"#14213D",marginBottom:2,display:"flex",alignItems:"center",gap:6}}><Truck size={14}/> Tarifs globaux régionaux</div>
                    <div style={{fontSize:12,color:G.gray,marginBottom:12}}>Appliqués pour toute commande hors Dakar (modifiable par région ci-dessous)</div>
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:13,fontWeight:600,color:G.dark,marginBottom:2,display:"flex",alignItems:"center",gap:5}}><Bike size={13}/> Frais locaux destination</div>
                      <div style={{fontSize:11,color:G.gray,marginBottom:6}}>Livreur dans la ville du client</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <input type="number" min="0" value={regLocalFee}
                          onChange={e=>{
                            lastTypeRef.current = Date.now();
                            setRegLocalFee(e.target.value);
                            scheduleSave({regional_local_fee: parseInt(e.target.value)||0});
                          }}
                          style={{flex:1,height:44,border:"1.5px solid #93C5FD",borderRadius:10,padding:"0 12px",fontSize:16,outline:"none",fontWeight:600}}/>
                        <span style={{fontSize:14,color:G.gray,fontWeight:600}}>CFA</span>
                      </div>
                    </div>
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:13,fontWeight:600,color:G.dark,marginBottom:2,display:"flex",alignItems:"center",gap:5}}><Truck size={13}/> Frais transport interurbain</div>
                      <div style={{fontSize:11,color:G.gray,marginBottom:6}}>Transport via transporteur privé</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <input type="number" min="0" value={regTransportFee}
                          onChange={e=>{
                            lastTypeRef.current = Date.now();
                            setRegTransportFee(e.target.value);
                            scheduleSave({regional_transport_fee: parseInt(e.target.value)||0});
                          }}
                          style={{flex:1,height:44,border:"1.5px solid #93C5FD",borderRadius:10,padding:"0 12px",fontSize:16,outline:"none",fontWeight:600}}/>
                        <span style={{fontSize:14,color:G.gray,fontWeight:600}}>CFA</span>
                      </div>
                    </div>
                    <div style={{height:1,background:"#E5E7EB",margin:"12px 0"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:G.grayLight,borderRadius:10,padding:"12px 14px"}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:G.gray,display:"flex",alignItems:"center",gap:5}}><Coins size={12}/> Total régional (calculé)</div>
                        <div style={{fontSize:10,color:G.gray,marginTop:2}}>Locaux + Transport interurbain</div>
                      </div>
                      <div style={{fontSize:16,fontWeight:700,color:total>0?G.green:G.gray}}>{fmt(total)} CFA</div>
                    </div>
                    {/* Bulk apply Autres régions — single button for both rates */}
                    {(()=>{
                      const regionCount = (otherRegions||[]).length;
                      const disabled = role!=="admin" || regionCount===0 || lf<=0 || tf<=0;
                      const helper = regionCount===0
                        ? "Aucune région à mettre à jour"
                        : `${regionCount} région${regionCount>1?"s":""} ser${regionCount>1?"ont":"a"} mise${regionCount>1?"s":""} à jour avec les 2 tarifs ci-dessus`;
                      return (
                        <div style={{marginTop:12}}>
                          <button disabled={disabled}
                            onClick={()=>setConfirmModal({
                              msg:"⚠️ Confirmer l'application",
                              sub:`Vous allez appliquer ces tarifs à toutes les régions hors Dakar :\n🏍️ Frais locaux destination : ${fmt(lf)} CFA\n🚐 Frais transport interurbain : ${fmt(tf)} CFA\n💰 Total par région : ${fmt(total)} CFA\n\n${regionCount} région${regionCount>1?"s seront mises":" sera mise"} à jour. Cette action remplacera leurs tarifs individuels.`,
                              onConfirm: async()=>{
                                try {
                                  await Promise.all((otherRegions||[]).map(r => {
                                    const newCities = (r.cities||[]).map(cs=>{ const i=cs.lastIndexOf("|"); const name=i===-1?cs:cs.slice(0,i); return `${name}|${lf}`; });
                                    return sbFetch(`delivery_other_regions?id=eq.${r.id}`,"PATCH",{price:lf,interurbain_price:tf,cities:newCities});
                                  }));
                                  setOtherRegions(prev => prev.map(r => ({...r, price:lf, interurbain_price:tf, cities:(r.cities||[]).map(cs=>{ const i=cs.lastIndexOf("|"); const name=i===-1?cs:cs.slice(0,i); return `${name}|${lf}`; })})));
                                  addToast(`✅ Tarifs appliqués à ${regionCount} région${regionCount>1?"s":""}`,"✅",G.green);
                                } catch(e){ addToast("❌ Erreur, réessayer","❌",G.red); }
                              }
                            })}
                            style={{width:"100%",height:48,background:disabled?"#9CA3AF":G.green,color:"#fff",border:"none",borderRadius:10,fontWeight:600,fontSize:15,cursor:disabled?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
<Check size={13} style={{display:"inline",verticalAlign:"-2px"}}/> Appliquer à toutes les régions hors Dakar
                          </button>
                          <div style={{fontSize:11,color:G.gray,textAlign:"center",marginTop:6}}>{helper}</div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
              <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
                {otherRegions.map(r=>(
                  <div key={r.id} style={{background:"#fff",borderRadius:10,border:"1.5px solid #BFDBFE",overflow:"hidden"}}>
                    {fraisEditCity?.id===r.id
                      ? <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:6}}>
                          <input type="text" value={fraisEditCity.name} onChange={e=>setFraisEditCity(p=>({...p,name:e.target.value}))}
                            placeholder="Ville" style={{border:"1.5px solid #93C5FD",borderRadius:8,padding:"7px 10px",fontSize:13,outline:"none"}}/>
                          <div style={{display:"flex",gap:6}}>
                            <div style={{flex:1}}>
                              <div style={{fontSize:10,color:G.gray,marginBottom:3,display:"flex",alignItems:"center",gap:4}}><Bike size={11}/> Livraison Locale (Moto)</div>
                              <input type="number" min="0" value={fraisEditCity.price} onChange={e=>setFraisEditCity(p=>({...p,price:e.target.value}))}
                                placeholder="2000" style={{width:"100%",border:"1.5px solid #93C5FD",borderRadius:8,padding:"7px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                            </div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:10,color:G.gray,marginBottom:3,display:"flex",alignItems:"center",gap:4}}><Truck size={11}/> Livraison Régionale (Voiture)</div>
                              <input type="number" min="0" value={fraisEditCity.interurbain||""} onChange={e=>setFraisEditCity(p=>({...p,interurbain:e.target.value}))}
                                placeholder="1000" style={{width:"100%",border:"1.5px solid #93C5FD",borderRadius:8,padding:"7px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={async()=>{
                              const name=fmtCity(fraisEditCity.name||""); const price=parseInt(fraisEditCity.price)||0; const itb=parseInt(fraisEditCity.interurbain)||0;
                              if(!name){setFraisEditCity(null);return;}
                              await sbFetch(`delivery_other_regions?id=eq.${r.id}`,"PATCH",{name,price,interurbain_price:itb,cities:[name]}).catch(()=>{});
                              setOtherRegions(prev=>prev.map(x=>x.id===r.id?{...x,name,price,interurbain_price:itb}:x)); setFraisEditCity(null);
                            }} style={{flex:1,background:"#1E40AF",color:"#fff",border:"none",borderRadius:8,padding:"7px 0",fontWeight:700,cursor:"pointer",fontSize:13,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5}}><Check size={13}/> Enregistrer</button>
                            <button onClick={()=>setFraisEditCity(null)} style={{background:"#F3F4F6",border:"1px solid #D1D5DB",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:13,color:G.gray}}>Annuler</button>
                          </div>
                        </div>
                      : <div style={{padding:"9px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,color:G.dark}}>{r.name}</div>
                            <div style={{fontSize:11,color:"#1E40AF",marginTop:2}}>
                              <span style={{display:"inline-flex",alignItems:"center",gap:3}}><Bike size={11}/> Locale: {fmt(r.price||0)} CFA</span>
                              {(r.interurbain_price||0)>0&&<span style={{marginLeft:6,display:"inline-flex",alignItems:"center",gap:3}}>+ <Truck size={11}/> Régionale: {fmt(r.interurbain_price)} CFA</span>}
                              <span style={{marginLeft:6,fontWeight:800,display:"inline-flex",alignItems:"center",gap:3}}>= <Coins size={11}/> Total: {fmt((r.price||0)+(r.interurbain_price||0))} CFA</span>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>setFraisEditCity({id:r.id,name:r.name,price:String(r.price||0),interurbain:String(r.interurbain_price||0)})}
                              style={{background:"#EFF6FF",color:"#2563EB",border:"1px solid #BFDBFE",borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
<Pencil size={11} style={{display:"inline",verticalAlign:"-1px"}}/> Modifier
                            </button>
                            <button onClick={()=>setConfirmModal({msg:`Supprimer "${r.name}" ?`,danger:true,onConfirm:async()=>{
                              await sbFetch(`delivery_other_regions?id=eq.${r.id}`,"DELETE").catch(()=>{});
                              setOtherRegions(prev=>prev.filter(x=>x.id!==r.id)); addToast(`${r.name} supprimée`,"🗑️",G.gray);
                            }})}
                              style={{background:"#FEF2F2",color:G.red,border:"1px solid #FCA5A5",borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                              Supprimer
                            </button>
                          </div>
                        </div>
                    }
                  </div>
                ))}
                {otherRegions.length===0&&<div style={{fontSize:12,color:G.gray,textAlign:"center",padding:"12px 0",fontStyle:"italic"}}>Aucune ville hors zone configurée</div>}
              </div>
              {/* Add new other city */}
              <div id="frais-add-other-city" style={{background:"#F0F9FF",borderRadius:10,padding:"10px 12px",border:"1px solid #BAE6FD"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#0369A1",marginBottom:8}}>+ Ajouter une ville hors zone</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                  <CityAutocomplete value={fraisNewOther.city} onChange={v=>setFraisNewOther(p=>({...p,city:v}))} placeholder="Ville (ex: Thiès)"/>
                  <div style={{flex:"1 1 80px"}}>
                    <div style={{fontSize:9,color:G.gray,marginBottom:2,display:"flex",alignItems:"center",gap:3}}><Bike size={10}/> Locale (Moto)</div>
                    <input type="number" min="0" value={fraisNewOther.price} onChange={e=>setFraisNewOther(p=>({...p,price:e.target.value}))} placeholder="2000"
                      style={{width:"100%",border:"1.5px solid #7DD3FC",borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  <div style={{flex:"1 1 80px"}}>
                    <div style={{fontSize:9,color:G.gray,marginBottom:2,display:"flex",alignItems:"center",gap:3}}><Truck size={10}/> Régionale (Voiture)</div>
                    <input type="number" min="0" value={fraisNewOther.interurbain||""} onChange={e=>setFraisNewOther(p=>({...p,interurbain:e.target.value}))} placeholder="1000"
                      style={{width:"100%",border:"1.5px solid #7DD3FC",borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                </div>
                <button onClick={async()=>{
                  const city=fmtCity(fraisNewOther.city||""); const price=parseInt(fraisNewOther.price)||0; const itb=parseInt(fraisNewOther.interurbain)||0;
                  if(!city){addToast("Nom de la ville requis","⚠️","#F59E0B");return;}
                  if(allNames.some(n=>_normCity(n)===_normCity(city))){addToast("Ville déjà configurée","⚠️","#F59E0B");return;}
                  const res=await sbFetch("delivery_other_regions","POST",{org_id:orgId,name:city,price,interurbain_price:itb,cities:[city]}).catch(()=>null);
                  const s=Array.isArray(res)?res[0]:res;
                  if(s){setOtherRegions(prev=>[...prev,s]);addToast(`${city} ajouté ✅`,"✅",G.green);}
                  setFraisNewOther({city:"",price:"",interurbain:""});
                }} style={{width:"100%",background:"#0369A1",color:"#fff",border:"none",borderRadius:8,padding:"9px 0",fontWeight:700,fontSize:13,cursor:"pointer"}}>+ Ajouter cette ville</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {fraisConfigTab==="tableau"&&(()=>{
        // Build unified list
        const rows = [
          ...mainCities.map(c=>({ville:c.name,zone:mainRegion?.name||"Région principale",type:"main",fraisLocale:c.price,interurbain:0,total:c.price,date:null})),
          ...otherRegions.map(r=>({ville:r.name,zone:"Autre région",type:"other",fraisLocale:r.price||0,interurbain:r.interurbain_price||0,total:(r.price||0)+(r.interurbain_price||0),date:r.created_at})),
        ];
        const filtered = rows.filter(r=>{
          const q=fraisTableauSearch.toLowerCase();
          const matchQ=!q||r.ville.toLowerCase().includes(q)||r.zone.toLowerCase().includes(q);
          const matchF=fraisTableauFilter==="all"||(fraisTableauFilter==="main"&&r.type==="main")||(fraisTableauFilter==="other"&&r.type==="other");
          return matchQ&&matchF;
        });
        const exportCSV = () => {
          const BOM="﻿";
          const headers="Ville;Zone;Frais locale (CFA);Frais interurbain (CFA);Total (CFA);Date\n";
          const body=rows.map(r=>`${r.ville};${r.zone};${r.fraisLocale};${r.interurbain};${r.total};${r.date?new Date(r.date).toLocaleDateString("fr-FR"):"-"}`).join("\n");
          const blob=new Blob([BOM+headers+body],{type:"text/csv;charset=utf-8;"});
          const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="tarifs_livraison.csv"; a.click();
        };
        const exportExcel = () => {
          const BOM="﻿";
          const headers="Ville\tZone\tFrais locale (CFA)\tFrais interurbain (CFA)\tTotal (CFA)\tDate\n";
          const body=rows.map(r=>`${r.ville}\t${r.zone}\t${r.fraisLocale}\t${r.interurbain}\t${r.total}\t${r.date?new Date(r.date).toLocaleDateString("fr-FR"):"-"}`).join("\n");
          const blob=new Blob([BOM+headers+body],{type:"application/vnd.ms-excel;charset=utf-8;"});
          const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="tarifs_livraison.xls"; a.click();
        };
        return (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {/* Controls */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <input type="text" value={fraisTableauSearch} onChange={e=>setFraisTableauSearch(e.target.value)}
                placeholder="Rechercher une ville..."
                style={{flex:"1 1 150px",border:"1.5px solid #E2E8F0",borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none"}}/>
              <select value={fraisTableauFilter} onChange={e=>setFraisTableauFilter(e.target.value)}
                style={{border:"1.5px solid #E2E8F0",borderRadius:8,padding:"8px 10px",fontSize:12,background:"#fff",color:G.dark,outline:"none"}}>
                <option value="all">Toutes les zones</option>
                <option value="main">Région principale</option>
                <option value="other">Autres régions</option>
              </select>
              <button onClick={exportCSV} style={{background:"#F0FDF4",color:"#166534",border:"1.5px solid #86EFAC",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}>
                <FileText size={13}/> CSV
              </button>
              <button onClick={exportExcel} style={{background:"#EFF6FF",color:"#1E40AF",border:"1.5px solid #BFDBFE",borderRadius:8,padding:"8px 12px",fontSize:12,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}>
                <BarChart3 size={13}/> Excel
              </button>
            </div>
            <div style={{fontSize:11,color:G.gray}}>{filtered.length} ville{filtered.length!==1?"s":""} · {rows.length} au total</div>
            {/* Table */}
            <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #E2E8F0",overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto auto auto",gap:0,background:"#F8FAFC",borderBottom:"1px solid #E2E8F0",padding:"8px 14px"}}>
                {[["Ville",null],["Zone",null],["Locale",Bike],["Régionale",Truck],["Total",Coins]].map(([h,Ico])=>(
                  <div key={h} style={{fontSize:10,fontWeight:800,color:G.gray,textTransform:"uppercase",letterSpacing:"0.05em",textAlign:h==="Ville"||h==="Zone"?"left":"right",display:"flex",alignItems:"center",gap:3,justifyContent:h==="Ville"||h==="Zone"?"flex-start":"flex-end"}}>{Ico&&<Ico size={11}/>}{h}</div>
                ))}
              </div>
              {filtered.length===0&&<div style={{padding:"24px",textAlign:"center",fontSize:13,color:G.gray,fontStyle:"italic"}}>Aucun résultat</div>}
              {filtered.map((r,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto auto auto",gap:0,padding:"9px 14px",borderBottom:i<filtered.length-1?"1px solid #F1F5F9":"none",background:i%2===0?"#fff":"#FAFAFA",alignItems:"center"}}>
                  <div style={{fontWeight:700,fontSize:13,color:G.dark}}>{r.ville}</div>
                  <div>
                    <span style={{background:r.type==="main"?"#DCFCE7":"#DBEAFE",color:r.type==="main"?"#166534":"#1E40AF",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:600}}>{r.zone}</span>
                  </div>
                  <div style={{textAlign:"right",fontSize:12,color:G.gray}}>{fmt(r.fraisLocale)}</div>
                  <div style={{textAlign:"right",fontSize:12,color:r.interurbain>0?"#7C3AED":G.gray}}>{r.interurbain>0?fmt(r.interurbain):"—"}</div>
                  <div style={{textAlign:"right",fontSize:13,fontWeight:800,color:G.green}}>{fmt(r.total)} CFA</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {fraisConfigTab==="test"&&(()=>{
        const z=detectDeliveryZone(fraisTestCity,mainRegion,otherRegions,defaultPrice);
        return (
          <div style={{background:G.white,borderRadius:14,padding:16,border:"1.5px solid #E2E8F0"}}>
            <div style={{fontWeight:700,fontSize:13,color:G.dark,marginBottom:10,display:"flex",alignItems:"center",gap:6}}><Building2 size={14}/> Tester une ville</div>
            <input list="frais-test-cities" type="text" value={fraisTestCity} onChange={e=>setFraisTestCity(e.target.value)}
              placeholder="ex: Plateau, Thiès, Saint-Louis..."
              style={{width:"100%",border:`1.5px solid ${G.grayLight}`,borderRadius:9,padding:"10px 12px",fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
            <datalist id="frais-test-cities">{allNames.map(c=><option key={c} value={c}/>)}</datalist>
            {fraisTestCity&&(
              <div style={{padding:"14px 16px",borderRadius:12,border:"1.5px solid",
                background:z.type==="main"?"#DCFCE7":z.type==="other"?"#DBEAFE":z.type==="senegal"?"#F3F4F6":"#FEF3C7",
                borderColor:z.type==="main"?"#86EFAC":z.type==="other"?"#93C5FD":z.type==="senegal"?"#D1D5DB":"#FCD34D"}}>
                <div style={{fontSize:13,fontWeight:800,color:z.type==="main"?"#166534":z.type==="other"?"#1E40AF":z.type==="senegal"?"#374151":"#92400E",marginBottom:6,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  {z.type==="main"?<><Circle size={12} fill="#16a34a" stroke="#16a34a"/> Région principale</>:z.type==="other"?<><Circle size={12} fill="#2563eb" stroke="#2563eb"/> Autre région configurée</>:z.type==="senegal"?<><Circle size={12} stroke="#9CA3AF"/> Ville reconnue — Sénégal</>:<><AlertTriangle size={12}/> Ville non reconnue</>}
                  {z.type!=="unknown"&&` — ${z.cityName||z.name}`}
                </div>
                <div style={{fontSize:22,fontWeight:800,color:G.dark,marginBottom:4,display:"flex",alignItems:"center",gap:6}}><Truck size={20}/> {fmt(z.price)} FCFA</div>
                {z.type==="other"&&z.interurbain>0&&(
                  <div style={{fontSize:11,color:"#1E40AF",marginTop:4}}>
                    Frais locale: {fmt(z.fraisLocale||0)} F + Transport interurbain: {fmt(z.interurbain||0)} F
                  </div>
                )}
                {z.type==="senegal"&&<div style={{fontSize:11,color:"#6B7280",marginTop:4}}>Région : {z.name} · Tarif par défaut appliqué. Configurez dans Zones → Autres régions pour un tarif personnalisé.</div>}
                {z.type==="unknown"&&<div style={{fontSize:11,color:"#92400E",marginTop:4}}>Tarif par défaut appliqué : {fmt(defaultPrice)} CFA</div>}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
