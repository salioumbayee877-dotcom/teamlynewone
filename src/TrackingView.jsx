import React, { useEffect, useState, useRef } from 'react';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const G = {
  green: "#1A5C38", gold: "#F0A500", red: "#DC2626",
  dark: "#1F2937", gray: "#6B7280", white: "#FFFFFF",
  greenLight: "#D1FAE5", grayLight: "#F3F4F6",
};

const STATUS_LABEL = {
  pendiente:         { fr: "En attente de confirmation",     step: 0, icon: "⏳" },
  confirmado:        { fr: "Commande confirmée",              step: 1, icon: "✅" },
  livreur_en_route:  { fr: "Le livreur vient chercher votre colis", step: 2, icon: "🛵" },
  colis_pris:        { fr: "Colis récupéré par le livreur",   step: 3, icon: "📦" },
  paiement_confirme: { fr: "Paiement confirmé",               step: 1, icon: "💰" },
  colis_en_main:     { fr: "Colis en main du livreur",        step: 3, icon: "📦" },
  en_route:          { fr: "En route vers vous",              step: 4, icon: "🚚" },
  en_camino:         { fr: "En route vers vous",              step: 4, icon: "🚚" },
  chez_client:       { fr: "Le livreur est à votre porte",    step: 5, icon: "🏠" },
  entregado:         { fr: "Livré ✓",                          step: 6, icon: "✅" },
  rechazado:         { fr: "Commande annulée",                 step: 6, icon: "❌" },
  no_contesta:       { fr: "Tentative de contact en cours",   step: 4, icon: "📞" },
  reprogramar:       { fr: "Livraison reprogrammée",          step: 4, icon: "🔁" },
  remis_transporteur:{ fr: "Remis au transporteur",            step: 5, icon: "🚛" },
};

const STEPS = [
  { k: "confirmado", label: "Confirmée" },
  { k: "colis_pris", label: "Colis pris" },
  { k: "en_camino",  label: "En route" },
  { k: "chez_client",label: "Chez vous" },
  { k: "entregado",  label: "Livré" },
];

function fmt(n) {
  return Number(n||0).toLocaleString("fr-FR");
}

function digits(s) {
  return String(s||"").replace(/\D/g,"");
}

function installPromptInit() {
  const ref = { event: null };
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    ref.event = e;
  });
  return ref;
}

export default function TrackingView({ token }) {
  const [order, setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const installRef = useRef(null);
  const [canInstall, setCanInstall] = useState(false);

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
      setOrder(data[0]);
      setError(null);
    } catch (e) {
      setError(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const id = setInterval(fetchOrder, 12000);
    return () => clearInterval(id);
  }, [token]);

  const handleInstall = async () => {
    const e = installRef.current?.event;
    if (!e) return;
    e.prompt();
    await e.userChoice;
    installRef.current.event = null;
    setCanInstall(false);
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{textAlign:"center",padding:"40px 0",color:G.gray}}>Chargement…</div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{textAlign:"center",padding:"30px 16px"}}>
            <div style={{fontSize:48,marginBottom:12}}>🔍</div>
            <div style={{fontSize:18,fontWeight:700,color:G.dark,marginBottom:6}}>Commande introuvable</div>
            <div style={{fontSize:13,color:G.gray}}>Le lien est invalide ou a expiré. Contacte la boutique.</div>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABEL[order.status] || { fr: order.status, step: 0, icon: "📋" };
  const currentStep = statusInfo.step;
  const isCancelled = order.status === "rechazado";
  const isDelivered = order.status === "entregado";

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{textAlign:"center",marginBottom:18}}>
          <div style={{fontSize:11,color:G.gray,letterSpacing:1.5,fontWeight:600,marginBottom:4}}>SUIVI DE COMMANDE</div>
          <div style={{fontSize:18,fontWeight:800,color:G.green}}>{order.boutique_name || "Teamly"}</div>
        </div>

        {/* Big status block */}
        <div style={{
          background: isCancelled ? "#FEE2E2" : isDelivered ? G.greenLight : "#FEF3C7",
          borderRadius: 14, padding: "20px 16px", textAlign:"center", marginBottom: 18,
        }}>
          <div style={{fontSize:46,marginBottom:6}}>{statusInfo.icon}</div>
          <div style={{
            fontSize:16,fontWeight:800,
            color: isCancelled ? G.red : isDelivered ? G.green : "#92400E",
          }}>{statusInfo.fr}</div>
          <div style={{fontSize:12,color:G.gray,marginTop:6}}>
            Bonjour {order.client?.split(" ")[0] || ""}, voici l'état de ta commande
          </div>
        </div>

        {/* Stepper */}
        {!isCancelled && (
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:22,position:"relative"}}>
            <div style={{position:"absolute",top:12,left:14,right:14,height:2,background:"#E5E7EB",zIndex:0}}/>
            <div style={{
              position:"absolute",top:12,left:14,
              width:`calc(${Math.min(currentStep, STEPS.length) / STEPS.length * 100}% - 14px)`,
              height:2,background:G.green,zIndex:1,transition:"width 0.4s ease",
            }}/>
            {STEPS.map((s, i) => {
              const reached = currentStep >= i + 1;
              return (
                <div key={s.k} style={{flex:1,textAlign:"center",position:"relative",zIndex:2}}>
                  <div style={{
                    width:26,height:26,borderRadius:"50%",
                    background: reached ? G.green : "#fff",
                    border: `2px solid ${reached ? G.green : "#E5E7EB"}`,
                    display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",
                    color:"#fff",fontSize:11,fontWeight:800,
                  }}>{reached ? "✓" : i+1}</div>
                  <div style={{fontSize:9,color:reached?G.green:G.gray,marginTop:4,fontWeight:reached?700:500}}>{s.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Order details */}
        <div style={{background:G.grayLight,borderRadius:12,padding:"14px",marginBottom:14}}>
          <Row label="📦 Produit" value={order.product}/>
          <Row label="💰 Montant" value={`${fmt(order.price)} CFA`} bold/>
          {order.address && <Row label="📍 Adresse" value={order.address}/>}
        </div>

        {/* Livreur info */}
        {order.livreur && currentStep >= 2 && currentStep < 6 && (
          <div style={{background:"#EFF6FF",borderRadius:12,padding:"14px",marginBottom:14}}>
            <div style={{fontSize:11,color:G.gray,marginBottom:6,fontWeight:600}}>VOTRE LIVREUR</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:G.dark}}>🛵 {order.livreur}</div>
                {order.livreur_phone && <div style={{fontSize:11,color:G.gray,marginTop:2}}>{order.livreur_phone}</div>}
              </div>
              {order.livreur_phone && (
                <a href={`tel:${digits(order.livreur_phone)}`} style={{
                  background:G.green,color:"#fff",borderRadius:10,padding:"10px 16px",
                  textDecoration:"none",fontWeight:700,fontSize:13,whiteSpace:"nowrap",
                }}>📞 Appeler</a>
              )}
            </div>
          </div>
        )}

        {/* Shop contact */}
        {order.whatsapp && (
          <a href={`https://wa.me/${digits(order.whatsapp)}`} target="_blank" rel="noreferrer"
            style={{
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              background:"#25D366",color:"#fff",borderRadius:12,padding:"13px",
              fontSize:14,fontWeight:700,textDecoration:"none",marginBottom:10,
            }}>
            💬 Contacter la boutique
          </a>
        )}

        {/* Install PWA */}
        {canInstall && (
          <button onClick={handleInstall} style={{
            width:"100%",background:G.gold,color:G.dark,border:"none",borderRadius:12,
            padding:"13px",fontSize:13,fontWeight:800,cursor:"pointer",marginBottom:10,
          }}>📲 Installer l'app pour suivre toutes mes commandes</button>
        )}

        <div style={{textAlign:"center",fontSize:10,color:G.gray,marginTop:14,letterSpacing:0.5}}>
          Powered by <span style={{fontWeight:700,color:G.green}}>Teamly</span> · Mise à jour automatique
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"5px 0",gap:10}}>
      <div style={{fontSize:11,color:G.gray,fontWeight:500,flexShrink:0}}>{label}</div>
      <div style={{fontSize:13,color:G.dark,fontWeight:bold?700:500,textAlign:"right",wordBreak:"break-word"}}>{value}</div>
    </div>
  );
}

const pageStyle = {
  minHeight:"100vh",background:"#F9FAFB",display:"flex",alignItems:"center",justifyContent:"center",
  padding:"16px",fontFamily:"sans-serif",
};

const cardStyle = {
  background:"#fff",borderRadius:18,padding:"22px 18px",width:"100%",maxWidth:440,
  boxShadow:"0 4px 24px rgba(0,0,0,0.06)",
};
