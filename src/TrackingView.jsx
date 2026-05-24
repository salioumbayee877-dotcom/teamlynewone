import React, { useEffect, useState, useRef } from 'react';
import {
  CheckCircle2, Package, Truck, Home, Clock, Phone, MessageCircle,
  Banknote, MapPin, Share2, Download, AlertCircle, Star, Bike,
  CircleCheck, CircleDot, XCircle,
} from 'lucide-react';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Minimal palette
const C = {
  bg:        "#FAFAFA",
  card:      "#FFFFFF",
  border:    "#E5E7EB",
  text:      "#111827",
  textSoft:  "#6B7280",
  textMuted: "#9CA3AF",
  accent:    "#1A5C38", // Teamly green
  accentSoft:"#ECFDF5",
  warn:      "#92400E",
  warnSoft:  "#FEF3C7",
  alert:     "#B91C1C",
  alertSoft: "#FEE2E2",
};

const STATUS = {
  pendiente:         { title: "En attente de confirmation",       sub: "Ta commande sera bientôt confirmée",          Ico: Clock,         tone:"warn",  step: 0 },
  confirmado:        { title: "Commande confirmée",                sub: "Ton colis va être préparé",                    Ico: CheckCircle2,  tone:"accent",step: 1 },
  livreur_en_route:  { title: "Le livreur prend ton colis",        sub: "En route pour récupérer ton article",          Ico: Bike,          tone:"warn",  step: 2 },
  colis_pris:        { title: "Colis récupéré",                    sub: "Le livreur a ton colis. Direction : chez toi", Ico: Package,       tone:"warn",  step: 3 },
  paiement_confirme: { title: "Paiement confirmé",                  sub: "On prépare ton colis",                         Ico: CheckCircle2,  tone:"accent",step: 1 },
  colis_en_main:     { title: "Colis en main du livreur",          sub: "Le livreur va te l'apporter",                  Ico: Package,       tone:"warn",  step: 3 },
  en_route:          { title: "En route",                          sub: "Le livreur arrive — reste joignable",          Ico: Truck,         tone:"warn",  step: 4 },
  en_camino:         { title: "En route vers toi",                 sub: "Le livreur arrive — reste joignable",          Ico: Truck,         tone:"warn",  step: 4 },
  chez_client:       { title: "Le livreur est à ta porte",         sub: "Sors récupérer ton colis",                     Ico: Home,          tone:"alert", step: 5 },
  no_contesta:       { title: "On essaie de te joindre",            sub: "Rappelle le livreur dès que possible",         Ico: Phone,         tone:"alert", step: 4 },
  reprogramar:       { title: "Livraison reprogrammée",            sub: "Nouvelle tentative bientôt",                   Ico: Clock,         tone:"warn",  step: 4 },
  remis_transporteur:{ title: "Remis au transporteur",              sub: "En voyage vers ta région",                     Ico: Truck,         tone:"accent",step: 5 },
  entregado:         { title: "Livré",                              sub: "Merci pour ta confiance",                      Ico: CheckCircle2,  tone:"accent",step: 6 },
  rechazado:         { title: "Commande annulée",                   sub: "Contacte la boutique si besoin",               Ico: XCircle,       tone:"alert", step: 6 },
};

const STEPS = [
  { k:"confirmado",  label:"Confirmée" },
  { k:"colis_pris",  label:"Préparée" },
  { k:"en_camino",   label:"En route" },
  { k:"chez_client", label:"À ta porte" },
  { k:"entregado",   label:"Livrée" },
];

const TIPS = {
  confirmado:  "Prépare l'argent exact en liquide pour gagner du temps à la livraison.",
  colis_pris:  "C'est le moment de préparer ton paiement en cash.",
  en_camino:   "Garde ton téléphone à portée — le livreur va t'appeler.",
  chez_client: "Le livreur t'attend — descends ou ouvre vite.",
  no_contesta: "Sans réponse, ta commande peut être reprogrammée. Rappelle vite.",
  reprogramar: "Choisis un créneau où tu seras disponible — contacte la boutique.",
};

const TONE_BG = { accent:C.accentSoft, warn:C.warnSoft, alert:C.alertSoft };
const TONE_TX = { accent:C.accent,     warn:C.warn,     alert:C.alert };

const AVG_DELIVERY_MIN = 25;

function fmt(n)   { return Number(n||0).toLocaleString("fr-FR"); }
function digits(s){ return String(s||"").replace(/\D/g,""); }
function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff/3600)} h`;
  return `il y a ${Math.floor(diff/86400)} j`;
}
function computeETA(en_camino_at) {
  if (!en_camino_at) return null;
  const elapsed = (Date.now() - new Date(en_camino_at).getTime()) / 60000;
  const remaining = AVG_DELIVERY_MIN - elapsed;
  if (remaining <= 1) return "Arrive d'un instant à l'autre";
  return `Arrive dans ~${Math.ceil(remaining)} min`;
}

function installPromptInit() {
  const ref = { event: null };
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); ref.event = e; });
  return ref;
}

export default function TrackingView({ token }) {
  const [order, setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [statusChanged, setStatusChanged] = useState(false);
  const [ratingState, setRatingState] = useState({
    product: 0, livreur: 0, closer: 0,
    hoveredAxis: null, hoveredStar: 0,
    review: "", submitting: false, justSubmitted: false,
  });
  const installRef = useRef(null);
  const [canInstall, setCanInstall] = useState(false);
  const [, forceTick] = useState(0);
  useEffect(() => { const id = setInterval(()=>forceTick(t=>t+1), 30000); return ()=>clearInterval(id); }, []);

  useEffect(() => {
    if (!installRef.current) installRef.current = installPromptInit();
    const interval = setInterval(() => {
      if (installRef.current?.event) setCanInstall(true);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`${SB_URL}/rest/v1/rpc/get_order_tracking`, {
        method: "POST",
        headers: { "Content-Type":"application/json", "apikey":SB_KEY, "Authorization":`Bearer ${SB_KEY}` },
        body: JSON.stringify({ p_token: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur");
      if (!data || data.length === 0) { setError("Commande introuvable"); return; }
      const newOrder = data[0];
      setOrder(prev => {
        if (prev && prev.status !== newOrder.status) {
          setStatusChanged(true);
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              const s = STATUS[newOrder.status];
              if (s) new Notification(s.title, { body: s.sub, icon: "/icon.svg", tag: "teamly-tracking" });
            }
          } catch(e){}
          setTimeout(() => setStatusChanged(false), 1500);
        }
        return newOrder;
      });
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const id = setInterval(fetchOrder, 3500);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      const t = setTimeout(() => Notification.requestPermission(), 2500);
      return () => clearTimeout(t);
    }
  }, []);

  const handleInstall = async () => {
    const e = installRef.current?.event; if (!e) return;
    e.prompt(); await e.userChoice;
    installRef.current.event = null; setCanInstall(false);
  };
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: "Suivi de ma commande", url }); } catch(e){} }
    else { try { await navigator.clipboard.writeText(url); alert("Lien copié"); } catch(e){} }
  };

  const allRatingsSet = ratingState.product && ratingState.livreur && ratingState.closer;
  const submitRating = async () => {
    if (!allRatingsSet || ratingState.submitting) return;
    setRatingState(r=>({...r, submitting:true}));
    try {
      const res = await fetch(`${SB_URL}/rest/v1/rpc/submit_order_rating`, {
        method:"POST",
        headers:{"Content-Type":"application/json","apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}`},
        body: JSON.stringify({
          p_token: token,
          p_rating_product: ratingState.product,
          p_rating_livreur: ratingState.livreur,
          p_rating_closer:  ratingState.closer,
          p_review: ratingState.review||null,
        }),
      });
      const data = await res.json();
      if (res.ok && data === true) {
        setRatingState(r=>({...r, submitting:false, justSubmitted:true}));
        fetchOrder();
      } else { setRatingState(r=>({...r, submitting:false})); }
    } catch(e) { setRatingState(r=>({...r, submitting:false})); }
  };

  if (loading) {
    return (
      <div style={pageStyle}><div style={cardStyle}>
        <div style={{textAlign:"center",padding:"40px 0",color:C.textSoft,fontSize:13}}>Chargement…</div>
      </div></div>
    );
  }

  if (error || !order) {
    return (
      <div style={pageStyle}><div style={cardStyle}>
        <div style={{textAlign:"center",padding:"40px 16px"}}>
          <AlertCircle size={40} color={C.alert} style={{marginBottom:12}}/>
          <div style={{fontSize:16,fontWeight:600,color:C.text,marginBottom:6}}>Commande introuvable</div>
          <div style={{fontSize:13,color:C.textSoft}}>Le lien est invalide ou a expiré.</div>
        </div>
      </div></div>
    );
  }

  const s = STATUS[order.status] || { title: order.status, sub: "", Ico: Package, tone:"warn", step: 0 };
  const Ico = s.Ico;
  const tone = s.tone;
  const currentStep = s.step;
  const isCancelled = order.status === "rechazado";
  const isDelivered = order.status === "entregado";
  const firstName = (order.client || "").split(" ")[0];
  const eta = (order.status === "en_camino") ? computeETA(order.en_camino_at) : null;
  const alreadyRated = !!order.rated_at;
  const reviewsEnabled = order.reviews_enabled !== false; // default true
  const shouldShowRating = isDelivered && reviewsEnabled && !alreadyRated && !ratingState.justSubmitted;

  // FULLSCREEN REVIEW MODAL — appears when delivered + reviews enabled + not yet rated
  if (shouldShowRating) {
    return <ReviewFullscreen
      order={order} firstName={firstName}
      ratingState={ratingState} setRatingState={setRatingState}
      allRatingsSet={allRatingsSet} submit={submitRating}
    />;
  }

  return (
    <div style={pageStyle}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes flash { 0%{box-shadow:0 0 0 0 rgba(26,92,56,0.35)} 100%{box-shadow:0 0 0 12px rgba(26,92,56,0)} }
      `}</style>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div>
            <div style={{fontSize:10,color:C.textMuted,letterSpacing:1.5,fontWeight:600,marginBottom:2}}>SUIVI</div>
            <div style={{fontSize:16,fontWeight:700,color:C.text}}>{order.boutique_name || "Teamly"}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:C.accent,fontWeight:600}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:C.accent,animation:"pulse 1.6s infinite"}}/>
            EN LIGNE
          </div>
        </div>

        {/* Product photo if available */}
        {order.product_photo && (
          <div style={{
            width:"100%",borderRadius:14,overflow:"hidden",marginBottom:14,
            background:C.bg,aspectRatio:"4/3",display:"flex",alignItems:"center",justifyContent:"center",
            border:`1px solid ${C.border}`,
          }}>
            <img src={order.product_photo} alt={order.product}
              style={{width:"100%",height:"100%",objectFit:"cover"}}
              onError={e=>e.currentTarget.style.display="none"}/>
          </div>
        )}

        {/* Big status block */}
        <div key={order.status} style={{
          background: TONE_BG[tone],
          borderRadius: 14, padding: "22px 16px", textAlign:"center", marginBottom: 16,
          animation: statusChanged ? "flash 1.2s ease-out, slideIn 0.3s ease" : "slideIn 0.3s ease",
        }}>
          <Ico size={42} color={TONE_TX[tone]} strokeWidth={1.8} style={{marginBottom:8}}/>
          <div style={{fontSize:17,fontWeight:700,color:TONE_TX[tone]}}>{s.title}</div>
          <div style={{fontSize:13,color:TONE_TX[tone],marginTop:6,opacity:0.85,lineHeight:1.4}}>
            {firstName ? `${firstName}, ${s.sub.charAt(0).toLowerCase()+s.sub.slice(1)}` : s.sub}
          </div>
        </div>

        {/* Stepper */}
        {!isCancelled && (
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:18,position:"relative"}}>
            <div style={{position:"absolute",top:12,left:14,right:14,height:2,background:C.border,zIndex:0}}/>
            <div style={{
              position:"absolute",top:12,left:14,
              width:`calc(${Math.min(currentStep, STEPS.length) / STEPS.length * 100}% - 14px)`,
              height:2,background:C.accent,zIndex:1,transition:"width 0.5s ease",
            }}/>
            {STEPS.map((step, i) => {
              const reached = currentStep >= i + 1;
              const isCurrent = currentStep === i + 1;
              return (
                <div key={step.k} style={{flex:1,textAlign:"center",position:"relative",zIndex:2}}>
                  <div style={{
                    width:26,height:26,borderRadius:"50%",
                    background: reached ? C.accent : "#fff",
                    border: `2px solid ${reached ? C.accent : C.border}`,
                    display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",
                    boxShadow: isCurrent ? `0 0 0 3px ${C.accentSoft}` : "none",
                    transition:"all 0.3s",
                  }}>
                    {reached ? <Check6 size={13} color="#fff"/> : <CircleDot size={10} color={C.textMuted}/>}
                  </div>
                  <div style={{fontSize:9,color:reached?C.accent:C.textMuted,marginTop:5,fontWeight:reached?600:500}}>{step.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tip card */}
        {TIPS[order.status] && !isCancelled && (
          <Tip text={TIPS[order.status]}/>
        )}

        {/* ETA */}
        {eta && (
          <Row Ico={Clock} label="Temps d'arrivée estimé" value={eta} tone="warn"/>
        )}

        {/* Cash to prepare */}
        {!isCancelled && !isDelivered && order.price && (
          <div style={{
            background:C.text,borderRadius:14,padding:"16px",
            color:"#fff",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",
          }}>
            <div>
              <div style={{fontSize:10,letterSpacing:1.2,opacity:0.65,fontWeight:600}}>MONTANT À PRÉPARER</div>
              <div style={{fontSize:22,fontWeight:700,marginTop:2}}>{fmt(order.price)} <span style={{fontSize:12,opacity:0.7}}>CFA</span></div>
              <div style={{fontSize:10,opacity:0.55,marginTop:2}}>Paiement en liquide à la livraison</div>
            </div>
            <Banknote size={32} color="#fff" strokeWidth={1.5} style={{opacity:0.85}}/>
          </div>
        )}

        {/* Order details */}
        <div style={{background:C.bg,borderRadius:12,padding:"12px 14px",marginBottom:14,border:`1px solid ${C.border}`}}>
          <DetailRow Ico={Package} label="Produit" value={order.product}/>
          {order.address && <DetailRow Ico={MapPin} label="Adresse" value={order.address}/>}
          <DetailRow Ico={Clock} label="Commandée" value={timeAgo(order.created_at)}/>
          {order.delivered_at && <DetailRow Ico={CheckCircle2} label="Livrée" value={timeAgo(order.delivered_at)}/>}
        </div>

        {/* Livreur */}
        {order.livreur && currentStep >= 2 && currentStep < 6 && (
          <div style={{background:C.bg,borderRadius:12,padding:"12px",marginBottom:14,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:8,fontWeight:700,letterSpacing:1}}>TON LIVREUR</div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{
                width:42,height:42,borderRadius:"50%",background:C.accent,color:"#fff",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,flexShrink:0,
              }}>{(order.livreur||"?")[0].toUpperCase()}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:C.text}}>{order.livreur}</div>
                {order.livreur_phone && <div style={{fontSize:11,color:C.textSoft,marginTop:1}}>{order.livreur_phone}</div>}
              </div>
              {order.livreur_phone && (
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <a href={`tel:${digits(order.livreur_phone)}`} style={iconBtn(C.accent)}><Phone size={15}/></a>
                  <a href={`https://wa.me/${digits(order.livreur_phone)}`} target="_blank" rel="noreferrer" style={iconBtn("#25D366")}><MessageCircle size={15}/></a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rated thank-you (already rated) */}
        {isDelivered && (alreadyRated || ratingState.justSubmitted) && (
          <div style={{
            background:C.accentSoft,borderRadius:14,padding:"14px",marginBottom:14,textAlign:"center",
            border:`1px solid ${C.accent}33`,
          }}>
            <CheckCircle2 size={26} color={C.accent} style={{marginBottom:4}}/>
            <div style={{fontSize:13,fontWeight:600,color:C.accent}}>Merci pour ton avis</div>
            <div style={{display:"flex",justifyContent:"space-around",gap:6,marginTop:8}}>
              {[
                {l:"Produit",  v: order.rating_product || ratingState.product, Ico: Package},
                {l:"Livreur",  v: order.rating_livreur || ratingState.livreur, Ico: Bike},
                {l:"Appel",    v: order.rating_closer  || ratingState.closer,  Ico: Phone},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <r.Ico size={14} color={C.text} strokeWidth={1.6}/>
                  <div style={{fontSize:10,color:C.textSoft,marginTop:3,marginBottom:2}}>{r.l}</div>
                  <Stars value={r.v} size={11}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shop contact */}
        {order.whatsapp && (
          <a href={`https://wa.me/${digits(order.whatsapp)}`} target="_blank" rel="noreferrer" style={{
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            background:C.text,color:"#fff",borderRadius:12,padding:"13px",
            fontSize:13,fontWeight:600,textDecoration:"none",marginBottom:8,
          }}>
            <MessageCircle size={15}/> Contacter la boutique
          </a>
        )}

        {/* Share + Install */}
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <button onClick={handleShare} style={secondaryBtn}>
            <Share2 size={13}/> Partager
          </button>
          {canInstall && (
            <button onClick={handleInstall} style={{...secondaryBtn, background:C.accent, color:"#fff"}}>
              <Download size={13}/> Installer
            </button>
          )}
        </div>

        <div style={{textAlign:"center",fontSize:10,color:C.textMuted,marginTop:14,letterSpacing:0.5}}>
          {lastUpdate && `Mis à jour ${timeAgo(lastUpdate.toISOString())} · `}
          <span style={{fontWeight:600,color:C.text}}>Teamly</span>
        </div>
      </div>
    </div>
  );
}

// ── Fullscreen review modal ─────────────────────────────────────────────
function ReviewFullscreen({ order, firstName, ratingState, setRatingState, allRatingsSet, submit }) {
  return (
    <div style={{
      position:"fixed",inset:0,background:C.bg,overflowY:"auto",padding:"24px 16px",
      fontFamily:"sans-serif",
    }}>
      <div style={{...cardStyle, margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:18}}>
          <CheckCircle2 size={48} color={C.accent} style={{marginBottom:8}}/>
          <div style={{fontSize:18,fontWeight:700,color:C.text}}>Commande livrée</div>
          <div style={{fontSize:13,color:C.textSoft,marginTop:4}}>
            {firstName ? `Merci ${firstName} !` : "Merci !"} Ton avis nous aide à nous améliorer.
          </div>
        </div>

        <StarRow axis="product" Ico={Package} label="Le produit" sub="Es-tu satisfait du produit ?"
          ratingState={ratingState} setRatingState={setRatingState}/>
        <StarRow axis="livreur" Ico={Bike} label="La livraison" sub="Le livreur a-t-il été aimable et ponctuel ?"
          ratingState={ratingState} setRatingState={setRatingState}/>
        <StarRow axis="closer"  Ico={Phone} label="L'appel téléphonique" sub="Comment s'est passé l'appel de confirmation ?"
          ratingState={ratingState} setRatingState={setRatingState}/>

        {allRatingsSet && (
          <>
            <textarea
              value={ratingState.review}
              onChange={e=>setRatingState(r=>({...r,review:e.target.value}))}
              maxLength={500}
              placeholder="Laisse un commentaire (optionnel)"
              style={{
                width:"100%",borderRadius:10,border:`1px solid ${C.border}`,padding:"10px",
                fontSize:13,fontFamily:"inherit",resize:"vertical",minHeight:70,boxSizing:"border-box",
                background:C.bg,color:C.text,outline:"none",marginTop:10,
              }}/>
            <button onClick={submit} disabled={ratingState.submitting}
              style={{
                width:"100%",background:C.accent,color:"#fff",border:"none",borderRadius:12,
                padding:"14px",fontSize:14,fontWeight:700,marginTop:12,cursor:"pointer",
                opacity:ratingState.submitting?0.6:1,
              }}>{ratingState.submitting ? "Envoi…" : "Envoyer mon avis"}</button>
          </>
        )}
        {!allRatingsSet && (
          <div style={{textAlign:"center",fontSize:11,color:C.textMuted,marginTop:14}}>
            Note les 3 critères pour valider
          </div>
        )}
      </div>
    </div>
  );
}

function StarRow({ axis, Ico, label, sub, ratingState, setRatingState }) {
  return (
    <div style={{marginBottom:18,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
        <Ico size={16} color={C.text} strokeWidth={1.8}/>
        <div style={{fontSize:13,fontWeight:600,color:C.text}}>{label}</div>
      </div>
      {sub && <div style={{fontSize:11,color:C.textSoft,marginBottom:8,marginLeft:24}}>{sub}</div>}
      <div style={{display:"flex",gap:6,marginLeft:24}}>
        {[1,2,3,4,5].map(n=>{
          const isHov = ratingState.hoveredAxis === axis && ratingState.hoveredStar >= n;
          const isSel = ratingState[axis] >= n;
          const active = isHov || isSel;
          return (
            <button key={n}
              onMouseEnter={()=>setRatingState(r=>({...r,hoveredAxis:axis,hoveredStar:n}))}
              onMouseLeave={()=>setRatingState(r=>({...r,hoveredAxis:null,hoveredStar:0}))}
              onClick={()=>setRatingState(r=>({...r,[axis]:n}))}
              style={{
                background:"none",border:"none",cursor:"pointer",padding:4,lineHeight:0,
                transition:"transform 0.15s",transform: isHov?"scale(1.15)":"scale(1)",
              }}>
              <Star size={30} fill={active?"#F59E0B":"none"} color={active?"#F59E0B":C.textMuted} strokeWidth={1.4}/>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Tip({ text }) {
  return (
    <div style={{
      background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",
      marginBottom:12,fontSize:12,color:C.text,lineHeight:1.4,
      display:"flex",alignItems:"flex-start",gap:8,
    }}>
      <AlertCircle size={14} color={C.warn} style={{flexShrink:0,marginTop:1}}/>
      <span>{text}</span>
    </div>
  );
}

function Row({ Ico, label, value, tone="accent" }) {
  return (
    <div style={{
      background:TONE_BG[tone],borderRadius:12,padding:"12px 14px",marginBottom:14,
      display:"flex",alignItems:"center",gap:12,
    }}>
      <Ico size={22} color={TONE_TX[tone]} strokeWidth={1.6}/>
      <div style={{flex:1}}>
        <div style={{fontSize:10,letterSpacing:1.2,color:TONE_TX[tone],fontWeight:700,opacity:0.85}}>{label.toUpperCase()}</div>
        <div style={{fontSize:15,fontWeight:700,color:TONE_TX[tone],marginTop:2}}>{value}</div>
      </div>
    </div>
  );
}

function DetailRow({ Ico, label, value }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"5px 0",gap:10}}>
      <div style={{fontSize:11,color:C.textSoft,fontWeight:500,flexShrink:0,display:"flex",alignItems:"center",gap:6}}>
        <Ico size={12} color={C.textSoft} strokeWidth={1.8}/> {label}
      </div>
      <div style={{fontSize:13,color:C.text,fontWeight:500,textAlign:"right",wordBreak:"break-word"}}>{value}</div>
    </div>
  );
}

function Stars({ value, size=12 }) {
  return (
    <div style={{display:"flex",gap:1}}>
      {[1,2,3,4,5].map(n=>(
        <Star key={n} size={size} fill={n<=value?"#F59E0B":"none"} color={n<=value?"#F59E0B":C.textMuted} strokeWidth={1.4}/>
      ))}
    </div>
  );
}

function Check6({ size=14, color="#fff" }) {
  return <CheckCircle2 size={size} color={color} strokeWidth={2.5} fill="none"/>;
}

const iconBtn = (bg) => ({
  background:bg,color:"#fff",borderRadius:10,width:36,height:36,
  display:"flex",alignItems:"center",justifyContent:"center",
  textDecoration:"none",cursor:"pointer",
});

const secondaryBtn = {
  flex:1,background:C.bg,color:C.text,border:`1px solid ${C.border}`,borderRadius:12,
  padding:"11px",fontSize:12,fontWeight:600,cursor:"pointer",
  display:"flex",alignItems:"center",justifyContent:"center",gap:6,
};

const pageStyle = {
  minHeight:"100vh",background:C.bg,display:"flex",alignItems:"flex-start",justifyContent:"center",
  padding:"20px 16px",fontFamily:"sans-serif",
};

const cardStyle = {
  background:C.card,borderRadius:18,padding:"22px 18px",width:"100%",maxWidth:440,
  boxShadow:"0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
  border:`1px solid ${C.border}`,
};
