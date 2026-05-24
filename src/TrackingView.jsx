import React, { useEffect, useState, useRef } from 'react';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const G = {
  green: "#1A5C38", gold: "#F0A500", red: "#DC2626",
  dark: "#1F2937", gray: "#6B7280", white: "#FFFFFF",
  greenLight: "#D1FAE5", grayLight: "#F3F4F6",
};

// Engaging status messages — focused on what the client should DO/feel at each step
const STATUS = {
  pendiente: {
    title: "En attente de confirmation",
    sub: "Ta commande sera bientôt confirmée par la boutique 📞",
    color: "#FEF3C7", text: "#92400E",
    icon: "⏳", step: 0, tip: null,
  },
  confirmado: {
    title: "Commande confirmée ✅",
    sub: "C'est parti ! Ton colis va être préparé puis envoyé chez toi",
    color: "#DBEAFE", text: "#1E40AF",
    icon: "✅", step: 1,
    tip: "📋 Prépare l'argent exact en liquide pour gagner du temps à la livraison",
  },
  livreur_en_route: {
    title: "🛵 Le livreur prend ton colis",
    sub: "Notre livreur est en route pour récupérer ton article",
    color: "#FEF3C7", text: "#92400E",
    icon: "🛵", step: 2,
    tip: "⏱ Plus que quelques minutes avant le départ vers chez toi",
  },
  colis_pris: {
    title: "📦 Colis récupéré !",
    sub: "Le livreur a ton colis en main. Direction : chez toi 🏠",
    color: "#FEF3C7", text: "#92400E",
    icon: "📦", step: 3,
    tip: "💵 C'est le moment de préparer l'argent en liquide",
  },
  paiement_confirme: {
    title: "💰 Paiement confirmé",
    sub: "Ton paiement est validé. On prépare ton colis maintenant",
    color: "#DBEAFE", text: "#1E40AF",
    icon: "💰", step: 1, tip: null,
  },
  colis_en_main: {
    title: "📦 Colis en main du livreur",
    sub: "Le livreur a ton colis et va te l'apporter très bientôt",
    color: "#FEF3C7", text: "#92400E",
    icon: "📦", step: 3,
    tip: "💵 Prépare ton argent en liquide pour la livraison",
  },
  en_route: {
    title: "🚚 En route vers toi !",
    sub: "Le livreur arrive — reste joignable au téléphone 📱",
    color: "#FED7AA", text: "#9A3412",
    icon: "🚚", step: 4,
    tip: "📞 Garde ton téléphone à portée — le livreur va t'appeler en arrivant",
  },
  en_camino: {
    title: "🚚 En route vers toi !",
    sub: "Le livreur arrive — reste joignable au téléphone 📱",
    color: "#FED7AA", text: "#9A3412",
    icon: "🚚", step: 4,
    tip: "📞 Garde ton téléphone à portée — le livreur va t'appeler en arrivant",
  },
  chez_client: {
    title: "🏠 Le livreur est à ta porte !",
    sub: "Sors récupérer ton colis maintenant 🎉",
    color: "#FEE2E2", text: "#991B1B",
    icon: "🚪", step: 5,
    tip: "🚪 Le livreur t'attend — descends ou ouvre vite la porte",
  },
  no_contesta: {
    title: "📞 On essaie de te joindre",
    sub: "Le livreur a essayé de t'appeler. Rappelle-le dès que tu peux",
    color: "#FEE2E2", text: "#991B1B",
    icon: "📞", step: 4,
    tip: "⚠️ Sans réponse, ta commande peut être reprogrammée. Rappelle vite !",
  },
  reprogramar: {
    title: "🔁 Livraison reprogrammée",
    sub: "La livraison sera tentée à nouveau bientôt",
    color: "#FEF3C7", text: "#92400E",
    icon: "🔁", step: 4,
    tip: "📅 Choisis un créneau où tu seras disponible — contacte la boutique",
  },
  remis_transporteur: {
    title: "🚛 Remis au transporteur",
    sub: "Ton colis voyage maintenant vers ta région",
    color: "#DBEAFE", text: "#1E40AF",
    icon: "🚛", step: 5,
    tip: "📍 Le délai dépend de ta région — la boutique te tiendra informé",
  },
  entregado: {
    title: "🎉 Livré avec succès !",
    sub: "Merci pour ta confiance — à très bientôt pour une prochaine commande",
    color: "#D1FAE5", text: "#065F46",
    icon: "✅", step: 6,
    tip: "⭐ N'hésite pas à recommander la boutique à tes amis !",
  },
  rechazado: {
    title: "❌ Commande annulée",
    sub: "Cette commande a été annulée. Contacte la boutique si tu as une question",
    color: "#FEE2E2", text: "#991B1B",
    icon: "❌", step: 6, tip: null,
  },
};

const STEPS = [
  { k: "confirmado", label: "Confirmée" },
  { k: "colis_pris", label: "Colis pris" },
  { k: "en_camino",  label: "En route" },
  { k: "chez_client",label: "Chez toi" },
  { k: "entregado",  label: "Livré" },
];

function fmt(n) { return Number(n||0).toLocaleString("fr-FR"); }
function digits(s) { return String(s||"").replace(/\D/g,""); }
function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff/3600)} h`;
  return `il y a ${Math.floor(diff/86400)} j`;
}

// Average delivery time once en_camino — based on Dakar urban traffic
const AVG_DELIVERY_MIN = 25;

function computeETA(en_camino_at) {
  if (!en_camino_at) return null;
  const elapsed = (Date.now() - new Date(en_camino_at).getTime()) / 60000; // min
  const remaining = AVG_DELIVERY_MIN - elapsed;
  if (remaining <= 0) return { mins: 0, label: "Le livreur arrive d'un instant à l'autre" };
  if (remaining < 1)  return { mins: 1, label: "Moins d'1 min" };
  if (remaining < 5)  return { mins: Math.ceil(remaining), label: `Arrive dans ~${Math.ceil(remaining)} min` };
  return { mins: Math.ceil(remaining), label: `Arrive dans ~${Math.ceil(remaining)} min` };
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
  const [previousStatus, setPreviousStatus] = useState(null);
  const [statusChanged, setStatusChanged] = useState(false);
  const installRef = useRef(null);
  const [canInstall, setCanInstall] = useState(false);
  const [ratingState, setRatingState] = useState({ stars: 0, hovered: 0, review: "", submitting: false, justSubmitted: false });
  const [, forceTick] = useState(0); // re-render every 30s for ETA countdown
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
        headers: {
          "Content-Type": "application/json",
          "apikey": SB_KEY,
          "Authorization": `Bearer ${SB_KEY}`,
        },
        body: JSON.stringify({ p_token: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erreur");
      if (!data || data.length === 0) { setError("Commande introuvable"); return; }
      const newOrder = data[0];
      setOrder(prev => {
        if (prev && prev.status !== newOrder.status) {
          setStatusChanged(true);
          // Browser notification when status changes
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              const s = STATUS[newOrder.status];
              if (s) new Notification(s.title, { body: s.sub, icon: "/icon.svg", tag: "teamly-tracking" });
            }
          } catch(e){}
          setTimeout(() => setStatusChanged(false), 2000);
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

  // Ask notification permission once on first load
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      // delay 2s so it doesn't fire on page load
      const t = setTimeout(() => Notification.requestPermission(), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  const handleInstall = async () => {
    const e = installRef.current?.event;
    if (!e) return;
    e.prompt();
    await e.userChoice;
    installRef.current.event = null;
    setCanInstall(false);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: "Suivi de ma commande", text: "Suis ma commande en direct", url }); } catch(e){}
    } else {
      try { await navigator.clipboard.writeText(url); alert("Lien copié !"); } catch(e){}
    }
  };

  if (loading) {
    return (
      <div style={pageStyle}><div style={cardStyle}>
        <div style={{textAlign:"center",padding:"40px 0",color:G.gray}}>Chargement…</div>
      </div></div>
    );
  }

  if (error || !order) {
    return (
      <div style={pageStyle}><div style={cardStyle}>
        <div style={{textAlign:"center",padding:"30px 16px"}}>
          <div style={{fontSize:48,marginBottom:12}}>🔍</div>
          <div style={{fontSize:18,fontWeight:700,color:G.dark,marginBottom:6}}>Commande introuvable</div>
          <div style={{fontSize:13,color:G.gray}}>Le lien est invalide ou a expiré. Contacte la boutique.</div>
        </div>
      </div></div>
    );
  }

  const s = STATUS[order.status] || { title: order.status, sub: "", icon: "📋", step: 0, color: G.grayLight, text: G.dark, tip: null };
  const currentStep = s.step;
  const isCancelled = order.status === "rechazado";
  const isDelivered = order.status === "entregado";
  const firstName = (order.client || "").split(" ")[0];
  const eta = (order.status === "en_camino") ? computeETA(order.en_camino_at) : null;
  const alreadyRated = !!order.rated_at;

  const submitRating = async () => {
    if (!ratingState.stars || ratingState.submitting) return;
    setRatingState(r=>({...r, submitting:true}));
    try {
      const res = await fetch(`${SB_URL}/rest/v1/rpc/submit_order_rating`, {
        method:"POST",
        headers:{"Content-Type":"application/json","apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}`},
        body: JSON.stringify({ p_token: token, p_rating: ratingState.stars, p_review: ratingState.review||null }),
      });
      const data = await res.json();
      if (res.ok && data === true) {
        setRatingState(r=>({...r, submitting:false, justSubmitted:true}));
        fetchOrder();
      } else {
        setRatingState(r=>({...r, submitting:false}));
      }
    } catch(e) { setRatingState(r=>({...r, submitting:false})); }
  };

  return (
    <div style={pageStyle}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }
        @keyframes flash { 0%{box-shadow:0 0 0 0 rgba(26,92,56,0.6)} 100%{box-shadow:0 0 0 14px rgba(26,92,56,0)} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <div style={cardStyle}>
        {/* Header with live indicator */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <div>
            <div style={{fontSize:10,color:G.gray,letterSpacing:1.5,fontWeight:600,marginBottom:2}}>SUIVI EN DIRECT</div>
            <div style={{fontSize:17,fontWeight:800,color:G.green}}>{order.boutique_name || "Teamly"}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:G.green,fontWeight:600}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:"#10B981",animation:"pulse 1.6s infinite"}}/>
            EN LIGNE
          </div>
        </div>

        {/* Big status block */}
        <div key={order.status} style={{
          background: s.color,
          borderRadius: 14, padding: "22px 16px", textAlign:"center", marginBottom: 16,
          animation: statusChanged ? "flash 1.2s ease-out, slideIn 0.3s ease" : "slideIn 0.3s ease",
        }}>
          <div style={{fontSize:50,marginBottom:6}}>{s.icon}</div>
          <div style={{fontSize:17,fontWeight:800,color:s.text}}>{s.title}</div>
          <div style={{fontSize:13,color:s.text,marginTop:6,opacity:0.85,lineHeight:1.4}}>
            {firstName ? `${firstName}, ${s.sub.charAt(0).toLowerCase()+s.sub.slice(1)}` : s.sub}
          </div>
        </div>

        {/* Stepper */}
        {!isCancelled && (
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:18,position:"relative"}}>
            <div style={{position:"absolute",top:13,left:14,right:14,height:2,background:"#E5E7EB",zIndex:0}}/>
            <div style={{
              position:"absolute",top:13,left:14,
              width:`calc(${Math.min(currentStep, STEPS.length) / STEPS.length * 100}% - 14px)`,
              height:2,background:G.green,zIndex:1,transition:"width 0.5s ease",
            }}/>
            {STEPS.map((step, i) => {
              const reached = currentStep >= i + 1;
              const isCurrent = currentStep === i + 1;
              return (
                <div key={step.k} style={{flex:1,textAlign:"center",position:"relative",zIndex:2}}>
                  <div style={{
                    width:28,height:28,borderRadius:"50%",
                    background: reached ? G.green : "#fff",
                    border: `2px solid ${reached ? G.green : "#E5E7EB"}`,
                    display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",
                    color:"#fff",fontSize:11,fontWeight:800,
                    boxShadow: isCurrent ? "0 0 0 4px rgba(26,92,56,0.15)" : "none",
                    transition:"all 0.3s",
                  }}>{reached ? "✓" : i+1}</div>
                  <div style={{fontSize:9,color:reached?G.green:G.gray,marginTop:5,fontWeight:reached?700:500}}>{step.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Smart tip for current status */}
        {s.tip && !isCancelled && (
          <div style={{
            background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,padding:"10px 12px",
            marginBottom:14,fontSize:12,color:"#92400E",fontWeight:500,lineHeight:1.4,
          }}>
            {s.tip}
          </div>
        )}

        {/* ETA countdown — when en_camino vers le client */}
        {eta && (
          <div style={{
            background:"linear-gradient(135deg,#FFEDD5,#FED7AA)",borderRadius:14,padding:"14px 16px",
            marginBottom:14,display:"flex",alignItems:"center",gap:12,
            animation:"slideIn 0.3s ease",
          }}>
            <div style={{fontSize:34}}>⏱</div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,letterSpacing:1.2,color:"#9A3412",fontWeight:700}}>TEMPS D'ARRIVÉE ESTIMÉ</div>
              <div style={{fontSize:18,fontWeight:800,color:"#7C2D12",marginTop:2}}>{eta.label}</div>
              <div style={{fontSize:10,color:"#9A3412",opacity:0.7,marginTop:2}}>Estimation basée sur le trafic moyen à Dakar</div>
            </div>
          </div>
        )}

        {/* Rating UI — appears after delivery */}
        {isDelivered && !alreadyRated && !ratingState.justSubmitted && (
          <div style={{
            background:"linear-gradient(135deg,#FEF3C7,#FCD34D)",borderRadius:14,padding:"16px",
            marginBottom:14,animation:"slideIn 0.3s ease",
          }}>
            <div style={{textAlign:"center",fontSize:13,fontWeight:700,color:"#7C2D12",marginBottom:10}}>
              Comment s'est passée ta livraison ?
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:10}}>
              {[1,2,3,4,5].map(n=>(
                <button key={n}
                  onMouseEnter={()=>setRatingState(r=>({...r,hovered:n}))}
                  onMouseLeave={()=>setRatingState(r=>({...r,hovered:0}))}
                  onClick={()=>setRatingState(r=>({...r,stars:n}))}
                  style={{
                    background:"none",border:"none",cursor:"pointer",fontSize:36,padding:0,lineHeight:1,
                    color: ((ratingState.hovered||ratingState.stars)>=n) ? "#F59E0B" : "#D1D5DB",
                    transition:"transform 0.15s",transform: (ratingState.hovered===n)?"scale(1.2)":"scale(1)",
                  }}>★</button>
              ))}
            </div>
            {ratingState.stars > 0 && (
              <>
                <textarea
                  value={ratingState.review}
                  onChange={e=>setRatingState(r=>({...r,review:e.target.value}))}
                  maxLength={500}
                  placeholder={ratingState.stars>=4 ? "Qu'est-ce qui t'a plu ? (optionnel)" : "Comment peut-on s'améliorer ? (optionnel)"}
                  style={{
                    width:"100%",borderRadius:10,border:"1px solid #FCD34D",padding:"10px",
                    fontSize:12,fontFamily:"inherit",resize:"vertical",minHeight:60,boxSizing:"border-box",
                    background:"#FFFBEB",color:G.dark,outline:"none",
                  }}/>
                <button onClick={submitRating} disabled={ratingState.submitting}
                  style={{
                    width:"100%",background:G.green,color:"#fff",border:"none",borderRadius:10,
                    padding:"12px",fontSize:13,fontWeight:800,marginTop:8,cursor:"pointer",
                    opacity:ratingState.submitting?0.6:1,
                  }}>{ratingState.submitting ? "Envoi…" : "Envoyer mon avis"}</button>
              </>
            )}
          </div>
        )}

        {/* Already rated — thank you */}
        {isDelivered && (alreadyRated || ratingState.justSubmitted) && (
          <div style={{
            background:G.greenLight,borderRadius:14,padding:"14px",marginBottom:14,textAlign:"center",
            animation:"slideIn 0.3s ease",
          }}>
            <div style={{fontSize:26,marginBottom:4}}>🙏</div>
            <div style={{fontSize:13,fontWeight:700,color:G.green}}>Merci pour ton avis !</div>
            {(order.rating || ratingState.stars) > 0 && (
              <div style={{fontSize:18,color:"#F59E0B",marginTop:4,letterSpacing:2}}>
                {"★".repeat(order.rating || ratingState.stars)}{"☆".repeat(5 - (order.rating || ratingState.stars))}
              </div>
            )}
          </div>
        )}

        {/* Cash to prepare — prominent for COD */}
        {!isCancelled && !isDelivered && order.price && (
          <div style={{
            background:"linear-gradient(135deg,#1A5C38,#0F2412)",borderRadius:14,padding:"16px",
            color:"#fff",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",
          }}>
            <div>
              <div style={{fontSize:10,letterSpacing:1.2,opacity:0.8,fontWeight:600}}>MONTANT À PRÉPARER</div>
              <div style={{fontSize:22,fontWeight:800,marginTop:2}}>{fmt(order.price)} <span style={{fontSize:13,opacity:0.85}}>CFA</span></div>
              <div style={{fontSize:10,opacity:0.7,marginTop:2}}>Paiement en liquide à la livraison</div>
            </div>
            <div style={{fontSize:36}}>💵</div>
          </div>
        )}

        {/* Order details */}
        <div style={{background:G.grayLight,borderRadius:12,padding:"12px 14px",marginBottom:14}}>
          <Row label="📦 Produit" value={order.product}/>
          {order.address && <Row label="📍 Adresse" value={order.address}/>}
          <Row label="🕐 Commande" value={timeAgo(order.created_at)}/>
          {order.delivered_at && <Row label="✅ Livrée" value={timeAgo(order.delivered_at)}/>}
        </div>

        {/* Livreur info — visible from step 2 onwards (livreur en route → chez client) */}
        {order.livreur && currentStep >= 2 && currentStep < 6 && (
          <div style={{background:"#EFF6FF",borderRadius:12,padding:"14px",marginBottom:14}}>
            <div style={{fontSize:10,color:G.gray,marginBottom:8,fontWeight:700,letterSpacing:1}}>TON LIVREUR</div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{
                width:48,height:48,borderRadius:"50%",background:G.green,color:"#fff",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,flexShrink:0,
              }}>{(order.livreur||"?")[0].toUpperCase()}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:G.dark}}>{order.livreur}</div>
                {order.livreur_phone && <div style={{fontSize:11,color:G.gray,marginTop:1}}>{order.livreur_phone}</div>}
              </div>
              {order.livreur_phone && (
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <a href={`tel:${digits(order.livreur_phone)}`} style={contactBtn(G.green)}>📞</a>
                  <a href={`https://wa.me/${digits(order.livreur_phone)}`} target="_blank" rel="noreferrer" style={contactBtn("#25D366")}>💬</a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shop contact */}
        {order.whatsapp && (
          <a href={`https://wa.me/${digits(order.whatsapp)}`} target="_blank" rel="noreferrer" style={{
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            background:"#25D366",color:"#fff",borderRadius:12,padding:"13px",
            fontSize:14,fontWeight:700,textDecoration:"none",marginBottom:8,
          }}>💬 Contacter la boutique</a>
        )}

        {/* Share + Install row */}
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <button onClick={handleShare} style={secondaryBtn}>📤 Partager</button>
          {canInstall && (
            <button onClick={handleInstall} style={{...secondaryBtn, background:G.gold, color:G.dark, fontWeight:800}}>📲 Installer</button>
          )}
        </div>

        <div style={{textAlign:"center",fontSize:10,color:G.gray,marginTop:14,letterSpacing:0.5}}>
          {lastUpdate && `Mis à jour ${timeAgo(lastUpdate.toISOString())} · `}
          Powered by <span style={{fontWeight:700,color:G.green}}>Teamly</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"5px 0",gap:10}}>
      <div style={{fontSize:11,color:G.gray,fontWeight:500,flexShrink:0}}>{label}</div>
      <div style={{fontSize:13,color:G.dark,fontWeight:600,textAlign:"right",wordBreak:"break-word"}}>{value}</div>
    </div>
  );
}

const contactBtn = (bg) => ({
  background:bg,color:"#fff",borderRadius:10,width:38,height:38,
  display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,
  textDecoration:"none",cursor:"pointer",
});

const secondaryBtn = {
  flex:1,background:"#F3F4F6",color:G.dark,border:"none",borderRadius:12,
  padding:"11px",fontSize:12,fontWeight:700,cursor:"pointer",
};

const pageStyle = {
  minHeight:"100vh",background:"#F9FAFB",display:"flex",alignItems:"center",justifyContent:"center",
  padding:"16px",fontFamily:"sans-serif",
};

const cardStyle = {
  background:"#fff",borderRadius:18,padding:"22px 18px",width:"100%",maxWidth:440,
  boxShadow:"0 4px 24px rgba(0,0,0,0.06)",
};
