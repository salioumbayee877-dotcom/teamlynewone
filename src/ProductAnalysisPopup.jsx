import React from "react";

const C = {
  green:      "#1A5C38",
  greenLight: "#E8F3EC",
  red:        "#DC2626",
  redLight:   "#FEE2E2",
  gray:       "#6B7280",
  grayLight:  "#F3F4F6",
  dark:       "#0D1F14",
  amber:      "#D97706",
};

const fmt = n => Number(n||0).toLocaleString("fr-FR");

export default function ProductAnalysisPopup({ alert, onDone, onSkip }) {
  if (!alert) return null;
  const isNew    = alert.type === "new_product";
  const isChange = alert.type === "price_change";
  if (!isNew && !isChange) return null;

  const diff    = isChange ? alert.newPrice - alert.oldPrice : 0;
  const diffPct = isChange && alert.oldPrice ? (diff / alert.oldPrice) * 100 : 0;
  const up      = diff > 0;

  return (
    <div onClick={onSkip}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:3000,display:"flex",alignItems:"flex-end",justifyContent:"center",animation:"papFade 180ms ease"}}>
      <style>{`@keyframes papFade{from{opacity:0}to{opacity:1}}@keyframes papSlide{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div onClick={e=>e.stopPropagation()}
        style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:"24px 20px 28px",width:"100%",maxWidth:480,boxShadow:"0 -8px 32px rgba(0,0,0,0.2)",animation:"papSlide 220ms ease"}}>

        {/* Header */}
        <div style={{textAlign:"center",marginBottom:18}}>
          <div style={{fontSize:38,lineHeight:1,marginBottom:8}}>{isNew ? "🆕" : "💰"}</div>
          <div style={{fontSize:17,fontWeight:800,color:C.dark,marginBottom:4}}>
            {isNew ? "Nouveau produit" : "Changement de prix"}
          </div>
          <div style={{fontSize:12,color:C.gray}}>
            {isNew ? "Un nouveau produit vient d'être ajouté" : "Le prix d'un produit a été modifié"}
          </div>
        </div>

        {/* Card produit */}
        <div style={{background:C.greenLight,borderRadius:12,padding:"14px 14px",marginBottom:18,border:`1px solid ${C.green}22`}}>
          <div style={{fontSize:10,color:C.green,fontWeight:700,letterSpacing:0.6,marginBottom:6}}>PRODUIT</div>
          <div style={{fontSize:15,fontWeight:700,color:C.dark,marginBottom:12,wordBreak:"break-word"}}>{alert.name}</div>

          {isNew && (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,borderTop:`1px solid ${C.green}22`}}>
              <span style={{fontSize:12,color:C.gray,fontWeight:600}}>Prix</span>
              <span style={{fontSize:18,fontWeight:800,color:C.green}}>{fmt(alert.price)} CFA</span>
            </div>
          )}

          {isChange && (
            <div style={{paddingTop:10,borderTop:`1px solid ${C.green}22`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:12,color:C.gray,fontWeight:600}}>Ancien prix</span>
                <span style={{fontSize:13,color:C.gray,textDecoration:"line-through"}}>{fmt(alert.oldPrice)} CFA</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:C.gray,fontWeight:600}}>Nouveau prix</span>
                <span style={{fontSize:18,fontWeight:800,color:up?C.red:C.green}}>{fmt(alert.newPrice)} CFA</span>
              </div>
              <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:6,marginTop:6}}>
                <span style={{display:"inline-flex",alignItems:"center",gap:3,background:up?C.redLight:C.greenLight,color:up?C.red:C.green,borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700}}>
                  <span>{up?"▲":"▼"}</span>
                  <span>{Math.abs(diffPct).toFixed(1)}%</span>
                  <span style={{opacity:0.65,fontWeight:600}}>({up?"+":""}{fmt(diff)} CFA)</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Boutons */}
        <div style={{display:"flex",gap:10}}>
          <button onClick={onSkip}
            style={{flex:1,background:C.grayLight,color:"#374151",border:"none",borderRadius:14,padding:"14px 0",fontWeight:700,fontSize:14,cursor:"pointer"}}>
            Ignorer
          </button>
          <button onClick={onDone}
            style={{flex:1.4,background:C.green,color:"#fff",border:"none",borderRadius:14,padding:"14px 0",fontWeight:700,fontSize:14,cursor:"pointer",boxShadow:"0 2px 8px rgba(26,92,56,0.3)"}}>
            ✓ Marquer résolu
          </button>
        </div>
      </div>
    </div>
  );
}
