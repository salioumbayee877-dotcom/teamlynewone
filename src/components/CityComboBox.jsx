import React, { useEffect, useRef, useState } from "react";
import { _normCity, _parseCity, SENEGAL_CITIES } from "../lib/senegal";

export function CityComboBox({value="", onCityChange, onConfig=null, mainRegion=null, otherRegions=[], defaultDeliveryPrice=3500, G, fmt}) {
  const [open, setOpen] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const wrapRef = useRef(null);

  // Tier 1: cities configured in main zone
  const mainOpts = (mainRegion?.cities||[]).map(s=>{
    const {name,price}=_parseCity(s);
    return {name, region:mainRegion?.name||"Région principale", type:"main", price:price??mainRegion?.price??defaultDeliveryPrice};
  });
  // Tier 2: configured other regions (each row = one city)
  const otherOpts = otherRegions.flatMap(r=>{
    const itb=r.interurbain_price||0;
    const rows=[{name:r.name, region:r.name, type:"other", price:(r.price??defaultDeliveryPrice)+itb}];
    (r.cities||[]).forEach(cs=>{const{name,price}=_parseCity(cs);if(name&&_normCity(name)!==_normCity(r.name))rows.push({name,region:r.name,type:"other",price:(price??r.price??defaultDeliveryPrice)+itb});});
    return rows;
  });
  const configuredNorms = new Set([...mainOpts,...otherOpts].map(o=>_normCity(o.name)));

  // Tier 3: all Sénégal cities not yet configured
  const mainNorm = _normCity(mainRegion?.name||"");
  const senegalOpts = SENEGAL_CITIES
    .filter(c=>!configuredNorms.has(_normCity(c.city)))
    .map(c=>{
      const rn=_normCity(c.region);
      const isMain=mainNorm&&(rn===mainNorm||rn.includes(mainNorm)||mainNorm.includes(rn));
      return {name:c.city, region:`Région ${c.region}`, department:c.department,
        type:isMain?"main":"senegal",
        price:isMain?(mainRegion?.price??defaultDeliveryPrice):defaultDeliveryPrice};
    });

  const allOpts = [...mainOpts,...otherOpts,...senegalOpts];
  const q = _normCity(value);
  const filtered = value.length>=1
    ? allOpts.filter(o=>
        _normCity(o.name).includes(q)||
        _normCity(o.region).includes(q)||
        _normCity(o.department||"").includes(q)
      ).slice(0,25)
    : [...mainOpts,...otherOpts]; // no query → only show configured cities

  useEffect(()=>{
    const h=e=>{if(wrapRef.current&&!wrapRef.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  const select = opt => {
    onCityChange(opt.name, {type:opt.type, name:opt.region, cityName:opt.name, price:opt.price});
    setOpen(false);
    setHoverIdx(-1);
  };

  const handleType = e => {
    const v = e.target.value;
    const match = allOpts.find(o=>_normCity(o.name)===_normCity(v));
    if(match) onCityChange(match.name, {type:match.type, name:match.region, cityName:match.name, price:match.price});
    else onCityChange(v, {type:"unknown", price:defaultDeliveryPrice});
    setOpen(true);
    setHoverIdx(-1);
  };

  const getBadgeStyle = type => {
    if(type==="main")    return {color:"#166534",icon:"🟢"};
    if(type==="other")   return {color:"#1E40AF",icon:"🔵"};
    if(type==="senegal") return {color:"#6B7280",icon:"⚪"};
    return {color:G.gray,icon:"❓"};
  };

  return (
    <div ref={wrapRef} style={{position:"relative"}}>
      <div style={{display:"flex",border:`1.5px solid ${G.grayLight}`,borderRadius:8,overflow:"hidden",background:"#fff"}}>
        <input type="text" value={value} onChange={handleType} onFocus={()=>setOpen(true)}
          placeholder="Dakar, Thiès, Saint-Louis..."
          style={{flex:1,border:"none",padding:"9px 12px",fontSize:13,outline:"none",background:"transparent"}}/>
        {onConfig&&<button type="button" onClick={onConfig} title="Configurer les frais de livraison"
          style={{background:"#F9FAFB",border:"none",borderLeft:`1px solid ${G.grayLight}`,padding:"0 10px",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center"}}>⚙️</button>}
        <button type="button" onClick={()=>setOpen(o=>!o)}
          style={{background:"#F9FAFB",border:"none",borderLeft:`1px solid ${G.grayLight}`,padding:"0 11px",cursor:"pointer",color:G.gray,fontSize:13,display:"flex",alignItems:"center"}}>
          {open?"▲":"▾"}
        </button>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 3px)",left:0,right:0,background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",maxHeight:230,overflowY:"auto",zIndex:600}}>
          {filtered.length===0&&value.length>=1&&(
            <div style={{padding:"10px 14px",fontSize:12,color:G.gray,fontStyle:"italic"}}>
              Ville non reconnue — saisir le frais manuellement
            </div>
          )}
          {filtered.length===0&&value.length===0&&(
            <div style={{padding:"10px 14px",fontSize:12,color:G.gray,fontStyle:"italic"}}>
              Tapez une ville pour rechercher…
            </div>
          )}
          {filtered.map((opt,i)=>{
            const {color,icon}=getBadgeStyle(opt.type);
            return (
              <div key={i}
                onMouseDown={e=>{e.preventDefault();select(opt);}}
                onMouseEnter={()=>setHoverIdx(i)} onMouseLeave={()=>setHoverIdx(-1)}
                style={{padding:"9px 14px",cursor:"pointer",borderBottom:i<filtered.length-1?"1px solid #F1F5F9":"none",
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  background:hoverIdx===i?"#F0F9FF":"#fff"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:G.dark}}>{opt.name}</div>
                  <div style={{fontSize:10,fontWeight:600,marginTop:1,color}}>
                    {icon} {opt.region}{opt.department&&opt.type==="senegal"?` · ${opt.department}`:""}
                  </div>
                </div>
                <div style={{fontSize:12,fontWeight:800,color,whiteSpace:"nowrap",marginLeft:8}}>
                  {opt.type==="senegal"?"~":""}{fmt(opt.price)} F
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CityAutocomplete({value="", onChange, placeholder="Ville (ex: Thiès)"}) {
  const [open, setOpen] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const wrapRef = useRef(null);
  const q = _normCity(value);
  const suggestions = value.length>=2
    ? SENEGAL_CITIES.filter(c=>
        _normCity(c.city).includes(q)||
        _normCity(c.region).includes(q)||
        _normCity(c.department||"").includes(q)
      ).slice(0,7)
    : [];

  useEffect(()=>{
    const h=e=>{if(wrapRef.current&&!wrapRef.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  return (
    <div ref={wrapRef} style={{position:"relative",flex:"1 1 110px"}}>
      <input type="text" value={value}
        onChange={e=>{onChange(e.target.value);setOpen(true);setHoverIdx(-1);}}
        onFocus={()=>setOpen(true)}
        onKeyDown={e=>{
          if(e.key==="ArrowDown"){setHoverIdx(i=>Math.min(i+1,suggestions.length-1));e.preventDefault();}
          else if(e.key==="ArrowUp"){setHoverIdx(i=>Math.max(i-1,0));e.preventDefault();}
          else if(e.key==="Enter"&&hoverIdx>=0&&suggestions[hoverIdx]){onChange(suggestions[hoverIdx].city);setOpen(false);}
          else if(e.key==="Escape"){setOpen(false);}
        }}
        placeholder={placeholder}
        style={{width:"100%",border:"1.5px solid #7DD3FC",borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
      {open&&(suggestions.length>0||value.length>=2)&&(
        <div style={{position:"absolute",top:"calc(100% + 2px)",left:0,right:0,background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:700,animation:"livFadeIn 100ms ease",overflow:"hidden"}}>
          {suggestions.length===0&&(
            <div style={{padding:"10px 14px",fontSize:12,color:"#6B7280",fontStyle:"italic"}}>Aucune ville trouvée</div>
          )}
          {suggestions.map((c,i)=>(
            <div key={i}
              onMouseDown={e=>{e.preventDefault();onChange(c.city);setOpen(false);setHoverIdx(-1);}}
              onMouseEnter={()=>setHoverIdx(i)} onMouseLeave={()=>setHoverIdx(-1)}
              style={{padding:"10px 14px",cursor:"pointer",borderBottom:i<suggestions.length-1?"1px solid #F1F5F9":"none",background:hoverIdx===i?"#EFF6FF":"#fff",minHeight:44,display:"flex",flexDirection:"column",justifyContent:"center"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#111827"}}>{c.city}</div>
              <div style={{fontSize:11,color:"#6B7280",marginTop:1}}>Région {c.region}{c.department?` · ${c.department}`:""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
