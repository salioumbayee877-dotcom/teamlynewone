import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Banknote, Package, Phone, MapPin } from "lucide-react";

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const C = {
  bg: "#FAFAFA", card: "#FFFFFF", border: "#E5E7EB",
  text: "#111827", textSoft: "#6B7280", textMuted: "#9CA3AF",
  wave: "#1A8FE3", waveDark: "#0E6EB8",
  accent: "#1A5C38", accentSoft: "#ECFDF5",
  warn: "#92400E", warnSoft: "#FEF3C7",
};

function fmt(n) { return Number(n||0).toLocaleString("fr-FR"); }

export default function WavePayment({ token }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SB_URL}/rest/v1/rpc/get_order_tracking`, {
          method: "POST",
          headers: { "Content-Type":"application/json", "apikey":SB_KEY, "Authorization":`Bearer ${SB_KEY}` },
          body: JSON.stringify({ p_token: token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Erreur");
        if (!data || data.length === 0) { setError("Commande introuvable"); return; }
        setOrder(data[0]);
      } catch (e) {
        setError(e.message || "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const copyAmount = () => {
    if (!order) return;
    navigator.clipboard.writeText(String(order.price||0)).then(()=>{
      setCopied(true);
      setTimeout(()=>setCopied(false), 2000);
    });
  };

  if (loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{textAlign:"center",color:C.textSoft,fontSize:14}}>Chargement…</div>
    </div>
  );

  if (error || !order) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"system-ui,sans-serif"}}>
      <div style={{background:C.card,borderRadius:14,padding:24,maxWidth:420,width:"100%",textAlign:"center",border:`1px solid ${C.border}`}}>
        <AlertCircle size={36} color="#B91C1C" style={{marginBottom:10}}/>
        <div style={{fontSize:15,fontWeight:700,color:C.text}}>Commande introuvable</div>
        <div style={{fontSize:12,color:C.textSoft,marginTop:6}}>{error}</div>
      </div>
    </div>
  );

  const alreadyPaid = order.status && !["en_attente_paiement","pendiente"].includes(order.status);
  const waveLink = order.wave_payment_link;

  return (
    <div style={{minHeight:"100vh",background:C.bg,padding:"20px 16px 40px",fontFamily:"system-ui,sans-serif"}}>
      <div style={{maxWidth:460,margin:"0 auto"}}>

        {/* Header */}
        <div style={{textAlign:"center",marginBottom:18}}>
          <div style={{fontSize:11,color:C.textMuted,letterSpacing:2,fontWeight:700,marginBottom:4}}>PAIEMENT SÉCURISÉ</div>
          <div style={{fontSize:20,fontWeight:800,color:C.text}}>{order.boutique_name || "Teamly"}</div>
        </div>

        {alreadyPaid && (
          <div style={{background:C.accentSoft,border:`1px solid ${C.accent}`,borderRadius:12,padding:"14px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
            <CheckCircle2 size={24} color={C.accent}/>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:C.accent}}>Paiement déjà confirmé</div>
              <div style={{fontSize:11,color:C.accent,marginTop:2}}>Ta commande est en cours de traitement</div>
            </div>
          </div>
        )}

        {/* Récap commande */}
        <div style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,padding:"16px 18px",marginBottom:14}}>
          <div style={{fontSize:10,color:C.textMuted,letterSpacing:1,fontWeight:700,marginBottom:10}}>RÉSUMÉ DE TA COMMANDE</div>
          <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8}}>
            <Package size={16} color={C.textSoft} style={{marginTop:2,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,color:C.textSoft}}>Produit</div>
              <div style={{fontSize:14,fontWeight:600,color:C.text,wordBreak:"break-word"}}>{order.product}</div>
            </div>
          </div>
          {order.client && (
            <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8}}>
              <Phone size={16} color={C.textSoft} style={{marginTop:2,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,color:C.textSoft}}>Client</div>
                <div style={{fontSize:14,fontWeight:600,color:C.text}}>{order.client}</div>
              </div>
            </div>
          )}
          {order.address && (
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <MapPin size={16} color={C.textSoft} style={{marginTop:2,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,color:C.textSoft}}>Adresse de livraison</div>
                <div style={{fontSize:13,color:C.text}}>{order.address}</div>
              </div>
            </div>
          )}
        </div>

        {/* Montant à payer */}
        <div style={{background:`linear-gradient(135deg,${C.wave},${C.waveDark})`,borderRadius:16,padding:"22px 20px",marginBottom:14,color:"#fff",boxShadow:"0 6px 24px rgba(26,143,227,0.25)"}}>
          <div style={{fontSize:11,letterSpacing:1.5,opacity:0.8,fontWeight:600,marginBottom:6}}>MONTANT À PAYER</div>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:10}}>
            <div style={{fontSize:36,fontWeight:800,letterSpacing:-0.5}}>{fmt(order.price)}<span style={{fontSize:18,marginLeft:6,opacity:0.85}}>CFA</span></div>
            <button onClick={copyAmount}
              style={{background:"rgba(255,255,255,0.18)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>
              {copied ? "✓ Copié" : "Copier"}
            </button>
          </div>
        </div>

        {!alreadyPaid && waveLink && (
          <>
            <a href={waveLink} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,background:C.wave,color:"#fff",borderRadius:14,padding:"18px 0",fontSize:17,fontWeight:800,textDecoration:"none",marginBottom:10,boxShadow:"0 4px 16px rgba(26,143,227,0.4)"}}>
              <Banknote size={22}/> Payer {fmt(order.price)} CFA via Wave
            </a>
            <div style={{background:C.warnSoft,border:`1px solid #FDE68A`,borderRadius:12,padding:"12px 14px",fontSize:12,color:C.warn,lineHeight:1.5}}>
              <div style={{fontWeight:700,marginBottom:4}}>⚠ Important</div>
              Saisis exactement <b>{fmt(order.price)} CFA</b> dans Wave. Une fois payé, nous confirmerons ta commande sous quelques minutes.
            </div>
          </>
        )}

        {!alreadyPaid && !waveLink && (
          <div style={{background:"#FEE2E2",border:`1px solid #FCA5A5`,borderRadius:12,padding:"14px 16px",color:"#991B1B",fontSize:13,lineHeight:1.5}}>
            <div style={{fontWeight:700,marginBottom:4,display:"flex",alignItems:"center",gap:6}}><AlertCircle size={16}/> Lien de paiement non configuré</div>
            Contacte la boutique pour finaliser le paiement.
            {order.whatsapp && (
              <a href={`https://wa.me/${order.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                style={{display:"inline-block",marginTop:8,color:"#991B1B",fontWeight:700,textDecoration:"underline"}}>
                Contacter la boutique
              </a>
            )}
          </div>
        )}

        <div style={{textAlign:"center",fontSize:10,color:C.textMuted,marginTop:18,letterSpacing:0.3}}>
          Propulsé par <b style={{color:C.accent}}>Teamly</b> · Paiement traité par Wave
        </div>
      </div>
    </div>
  );
}
