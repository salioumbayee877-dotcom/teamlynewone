import React, { useState } from "react";

const C = {
  green:      "#1A5C38",
  greenLight: "#E8F3EC",
  red:        "#DC2626",
  redLight:   "#FEE2E2",
  gray:       "#6B7280",
  grayLight:  "#F3F4F6",
  dark:       "#0D1F14",
  amber:      "#D97706",
  amberLight: "#FEF3C7",
  border:     "#E5E7EB",
};

const fmtF = n => Number(n||0).toLocaleString("fr-FR") + " CFA";

const BUNDLE_OPTS = [
  { qty: 1, label: "Pack x1", emoji: "1️⃣📦" },
  { qty: 2, label: "Pack x2", emoji: "2️⃣📦📦" },
  { qty: 3, label: "Pack x3", emoji: "3️⃣📦📦📦" },
  { qty: 5, label: "Pack x5", emoji: "5️⃣📦📦📦📦📦" },
];

export default function ProductAnalysisPopup({ alert, onDone, onSkip, onClose }) {
  const [step, setStep]               = useState("main"); // main | bundle | success
  const [mainChoice, setMainChoice]   = useState(null);
  const [bundleQty, setBundleQty]     = useState(null);
  const [successMsg, setSuccessMsg]   = useState("");

  if (!alert) return null;
  const isNew  = alert.type === "new_product";
  const isDrop = alert.type === "price_drop";
  const isRise = alert.type === "price_rise";
  if (!isNew && !isDrop && !isRise) return null;

  // Tag styling per case
  const tag = isNew
    ? { bg: C.amberLight, fg: C.amber, label: "NOUVEAU PRODUIT", emoji: "🆕" }
    : isDrop
    ? { bg: C.greenLight, fg: C.green, label: "PRIX EN BAISSE",  emoji: "📉" }
    : { bg: C.redLight,   fg: C.red,   label: "PRIX EN HAUSSE",  emoji: "📈" };

  // Price diff for change cases
  const showCompare = isDrop || isRise;
  const diff    = showCompare ? alert.newPrice - alert.oldPrice : 0;
  const diffPct = showCompare && alert.oldPrice
    ? Math.abs(diff / alert.oldPrice) * 100
    : 0;

  const finish = (payload, msg) => {
    setSuccessMsg(msg);
    setStep("success");
    setTimeout(() => { onDone && onDone(payload); }, 1000);
  };

  const goBack = () => { setStep("main"); setBundleQty(null); };

  // ── Main choices per case ────────────────────────────────────────────────
  const mainOptions =
    isNew ? [
      { id: "unit",   emoji: "📦", label: "Prix unitaire",     sub: "Vendu à l'unité" },
      { id: "bundle", emoji: "🎁", label: "Bundle / Pack",     sub: "Vendu par lot" },
    ]
    : isDrop ? [
      { id: "discount",  emoji: "🏷️", label: "Promotion temporaire", sub: "Badge PROMO + ancien prix barré" },
      { id: "permanent", emoji: "📉", label: "Baisse définitive",     sub: "Nouveau prix de référence" },
    ]
    : /* isRise */ [
      { id: "bundle",  emoji: "🎁", label: "Devenu bundle",          sub: "Vendu par lot maintenant" },
      { id: "variant", emoji: "📏", label: "Différente taille",      sub: "Variante du même produit (taille / couleur)" },
      { id: "unit",    emoji: "📦", label: "Toujours prix unitaire", sub: "Nouveau prix de référence" },
    ];

  const question = isNew
    ? "Comment vendez-vous ce produit ?"
    : isDrop
    ? "Quelle est la nature de cette baisse de prix ?"
    : "Quelle est la nature de cette hausse de prix ?";

  // ── Submit handlers ──────────────────────────────────────────────────────
  const handleMainCTA = () => {
    if (!mainChoice) return;
    if (isDrop) {
      const msg = mainChoice === "discount" ? "Promo enregistrée" : "Nouveau prix enregistré";
      finish({ priceDropType: mainChoice }, msg);
      return;
    }
    // new_product or price_rise
    if (mainChoice === "unit") {
      finish({ pricingType: "unit" }, "Prix unitaire enregistré");
    } else if (mainChoice === "variant") {
      finish({ pricingType: "variant" }, "Variante enregistrée");
    } else {
      setStep("bundle");
    }
  };

  const handleBundleCTA = () => {
    if (!bundleQty) return;
    finish(
      { pricingType: "bundle", bundleQuantity: bundleQty },
      `Bundle x${bundleQty} enregistré`
    );
  };

  // ── Reusable pieces ──────────────────────────────────────────────────────
  const HandleBar = (
    <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 14px"}} />
  );

  const Tag = (
    <div style={{display:"inline-flex",alignItems:"center",gap:6,background:tag.bg,color:tag.fg,fontSize:10,fontWeight:800,letterSpacing:0.6,padding:"5px 10px",borderRadius:999}}>
      <span style={{fontSize:12}}>{tag.emoji}</span>
      <span>{tag.label}</span>
    </div>
  );

  const ProductCard = (
    <div style={{background:C.grayLight,borderRadius:12,padding:"12px 14px",marginBottom:18,border:`1px solid ${C.border}`}}>
      <div style={{fontSize:10,color:C.gray,fontWeight:700,letterSpacing:0.6,marginBottom:6}}>PRODUIT</div>
      <div style={{fontSize:15,fontWeight:700,color:C.dark,marginBottom:10,wordBreak:"break-word"}}>{alert.name}</div>

      {isNew && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,borderTop:`1px solid ${C.border}`}}>
          <span style={{fontSize:12,color:C.gray,fontWeight:600}}>Prix</span>
          <span style={{fontSize:18,fontWeight:800,color:tag.fg}}>{fmtF(alert.price)}</span>
        </div>
      )}

      {showCompare && (
        <div style={{paddingTop:10,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:12,color:C.gray,fontWeight:600}}>Ancien prix</span>
            <span style={{fontSize:13,color:C.gray,textDecoration:"line-through"}}>{fmtF(alert.oldPrice)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:12,color:C.gray,fontWeight:600}}>Nouveau prix</span>
            <span style={{fontSize:18,fontWeight:800,color:tag.fg}}>{fmtF(alert.newPrice)}</span>
          </div>
          {alert.pricePerUnit != null && (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:C.gray,fontWeight:600}}>Prix unitaire{alert.qty>1?` (×${alert.qty})`:""}</span>
              <span style={{fontSize:13,color:C.dark,fontWeight:700}}>{fmtF(alert.pricePerUnit)}</span>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:4,background:tag.bg,color:tag.fg,borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700}}>
              <span>{isRise ? "▲" : "▼"}</span>
              <span>{diffPct.toFixed(1)}%</span>
              <span style={{opacity:0.7,fontWeight:600}}>({isRise?"+":""}{fmtF(diff)})</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const RadioOption = ({ active, emoji, label, sub, onClick }) => (
    <button onClick={onClick}
      style={{display:"flex",alignItems:"center",gap:12,width:"100%",textAlign:"left",
              background:active?tag.bg:"#fff",border:`2px solid ${active?tag.fg:C.border}`,
              borderRadius:12,padding:"12px 14px",cursor:"pointer",transition:"all .15s"}}>
      <div style={{fontSize:22,lineHeight:1,flexShrink:0}}>{emoji}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:700,color:C.dark}}>{label}</div>
        {sub && <div style={{fontSize:11,color:C.gray,marginTop:2}}>{sub}</div>}
      </div>
      <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${active?tag.fg:C.border}`,
                   display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:"#fff"}}>
        {active && <div style={{width:10,height:10,borderRadius:"50%",background:tag.fg}}/>}
      </div>
    </button>
  );

  const CTA = ({ enabled, label, onClick }) => (
    <button onClick={enabled ? onClick : undefined} disabled={!enabled}
      style={{width:"100%",background:enabled?tag.fg:C.grayLight,color:enabled?"#fff":C.gray,
              border:"none",borderRadius:14,padding:"14px 0",fontWeight:700,fontSize:14,
              cursor:enabled?"pointer":"not-allowed",
              boxShadow:enabled?`0 2px 8px ${tag.fg}33`:"none",transition:"all .15s"}}>
      {label}
    </button>
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div onClick={step === "success" ? undefined : (onClose || onSkip)}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:3000,
              display:"flex",alignItems:"flex-end",justifyContent:"center",
              animation:"papFade 180ms ease"}}>
      <style>{`@keyframes papFade{from{opacity:0}to{opacity:1}}@keyframes papSlide{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes papPop{0%{transform:scale(0.6);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}`}</style>
      <div onClick={e=>e.stopPropagation()}
        style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:"14px 20px 24px",
                width:"100%",maxWidth:480,boxShadow:"0 -8px 32px rgba(0,0,0,0.2)",
                animation:"papSlide 220ms ease",
                paddingBottom:"calc(24px + env(safe-area-inset-bottom,0px))"}}>

        {HandleBar}

        {step === "success" ? (
          <div style={{textAlign:"center",padding:"28px 0 12px"}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:C.greenLight,
                         display:"flex",alignItems:"center",justifyContent:"center",
                         margin:"0 auto 14px",animation:"papPop 360ms ease"}}>
              <span style={{fontSize:34}}>✅</span>
            </div>
            <div style={{fontSize:16,fontWeight:800,color:C.dark,marginBottom:4}}>C'est noté !</div>
            <div style={{fontSize:12,color:C.gray}}>{successMsg}</div>
          </div>
        ) : step === "bundle" ? (
          <>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <button onClick={goBack}
                style={{background:C.grayLight,border:"none",width:32,height:32,borderRadius:"50%",
                        cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>
                ←
              </button>
              <div>
                <div style={{fontSize:10,color:C.gray,fontWeight:700,letterSpacing:0.6}}>ÉTAPE 2 / 2</div>
                <div style={{fontSize:15,fontWeight:800,color:C.dark}}>Quelle taille de bundle ?</div>
              </div>
            </div>

            <div style={{fontSize:12,color:C.gray,marginBottom:14}}>
              <b style={{color:C.dark}}>{alert.name}</b> est vendu par lot — choisissez la quantité.
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
              {BUNDLE_OPTS.map(o => (
                <RadioOption key={o.qty}
                  active={bundleQty === o.qty}
                  emoji={o.emoji}
                  label={o.label}
                  sub={null}
                  onClick={() => setBundleQty(o.qty)} />
              ))}
            </div>

            <CTA enabled={!!bundleQty} label="✓ Confirmer" onClick={handleBundleCTA} />
            <button onClick={onSkip}
              style={{display:"block",width:"100%",background:"none",color:C.gray,border:"none",
                      padding:"10px 0 0",fontWeight:600,fontSize:13,cursor:"pointer"}}>
              Ignorer
            </button>
          </>
        ) : (
          <>
            <div style={{textAlign:"center",marginBottom:14}}>{Tag}</div>

            {ProductCard}

            <div style={{fontSize:14,fontWeight:700,color:C.dark,marginBottom:10}}>{question}</div>

            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
              {mainOptions.map(o => (
                <RadioOption key={o.id}
                  active={mainChoice === o.id}
                  emoji={o.emoji}
                  label={o.label}
                  sub={o.sub}
                  onClick={() => setMainChoice(o.id)} />
              ))}
            </div>

            <CTA
              enabled={!!mainChoice}
              label={(mainChoice === "bundle") ? "Suivant →" : "✓ Confirmer"}
              onClick={handleMainCTA}
            />
            <button onClick={onSkip}
              style={{display:"block",width:"100%",background:"none",color:C.gray,border:"none",
                      padding:"10px 0 0",fontWeight:600,fontSize:13,cursor:"pointer"}}>
              Ignorer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
