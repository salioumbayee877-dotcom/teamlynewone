import { useState, useEffect } from "react";

const G = {
  green:"#1A5C38",greenMid:"#2E8B57",greenLight:"#E8F5EE",
  greenDark:"#0F3D24",gold:"#F0A500",goldLight:"#FFF8E7",
  dark:"#111827",gray:"#6B7280",grayLight:"#F7F9F8",
  white:"#FFFFFF",red:"#DC2626",redLight:"#FEF2F2",
  wa:"#25D366",border:"#E2E8F0",purple:"#7C3AED",purpleLight:"#EDE9FE",
};

/* ─── LOGO ─── */
function Logo({light=false}) {
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:6,
      padding:"5px 13px 5px 5px",background:light?"rgba(255,255,255,0.12)":G.green,
      borderRadius:12,border:light?"1px solid rgba(255,255,255,0.15)":"none"}}>
      <div style={{width:28,height:28,background:G.gold,borderRadius:7,display:"flex",
        alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16,
        color:G.green,fontFamily:"Georgia,serif",lineHeight:1}}>T</div>
      <span style={{color:G.white,fontWeight:700,fontSize:17,fontFamily:"Georgia,serif"}}>eamly</span>
    </div>
  );
}

/* ─── PHONE MOCKUP ─── */
function Phone({children}) {
  return (
    <div style={{position:"relative",width:300,height:600,flexShrink:0,
      boxShadow:"0 32px 72px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.08)"}}>
      {/* Frame */}
      <div style={{position:"absolute",inset:0,background:"#16162a",borderRadius:44,
        boxShadow:"inset 0 0 0 1.5px rgba(255,255,255,0.07)"}}/>
      {/* Side button */}
      <div style={{position:"absolute",top:130,right:-3,width:4,height:70,background:"#2a2a40",borderRadius:2}}/>
      <div style={{position:"absolute",top:100,left:-3,width:4,height:45,background:"#2a2a40",borderRadius:2}}/>
      <div style={{position:"absolute",top:155,left:-3,width:4,height:45,background:"#2a2a40",borderRadius:2}}/>
      {/* Screen */}
      <div style={{position:"absolute",top:12,left:10,right:10,bottom:12,
        background:G.white,borderRadius:34,overflow:"hidden"}}>
        {/* Status bar */}
        <div style={{background:G.green,height:28,display:"flex",alignItems:"center",
          justifyContent:"space-between",padding:"0 16px",
          fontSize:10,color:"rgba(255,255,255,0.9)",fontWeight:600,letterSpacing:0.2}}>
          <span>15:13</span><span>●● 4G ▓</span>
        </div>
        {/* Content */}
        <div style={{height:"calc(100% - 28px)",overflow:"hidden",
          fontFamily:"system-ui,-apple-system,sans-serif"}}>
          {children}
        </div>
      </div>
      {/* Notch */}
      <div style={{position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",
        width:64,height:18,background:"#16162a",borderRadius:9,zIndex:5}}/>
      {/* Home bar */}
      <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",
        width:88,height:5,background:"rgba(255,255,255,0.28)",borderRadius:3}}/>
    </div>
  );
}

/* ─── BROWSER MOCKUP (PC) ─── */
function Browser({children}) {
  return (
    <div style={{width:"100%",maxWidth:680,borderRadius:14,overflow:"hidden",
      boxShadow:"0 28px 70px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)"}}>
      {/* Browser chrome */}
      <div style={{background:"#2d2d2d",padding:"10px 16px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{display:"flex",gap:7}}>
          <div style={{width:12,height:12,borderRadius:"50%",background:"#FF5F57"}}/>
          <div style={{width:12,height:12,borderRadius:"50%",background:"#FFBD2E"}}/>
          <div style={{width:12,height:12,borderRadius:"50%",background:"#28C840"}}/>
        </div>
        <div style={{flex:1,background:"#3d3d3d",borderRadius:7,padding:"5px 14px",
          display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:G.green,flexShrink:0}}/>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.65)",fontFamily:"system-ui,sans-serif"}}>teamlyecom.com</span>
        </div>
      </div>
      {/* Screen */}
      <div style={{background:G.white,overflow:"hidden",fontFamily:"system-ui,-apple-system,sans-serif"}}>
        {children}
      </div>
    </div>
  );
}

/* ─── SCREEN: DASHBOARD ─── */
function DashboardScreen() {
  return (
    <div style={{background:G.grayLight,height:"100%",display:"flex",flexDirection:"column",fontSize:12}}>
      <div style={{background:G.green,padding:"9px 14px",display:"flex",
        alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:22,height:22,background:G.gold,borderRadius:5,display:"flex",
            alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,
            color:G.green,fontFamily:"Georgia,serif"}}>T</div>
          <span style={{color:G.white,fontWeight:700,fontSize:15,fontFamily:"Georgia,serif"}}>eamly</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{background:G.gold,color:G.dark,fontWeight:700,fontSize:10,
            padding:"4px 10px",borderRadius:8}}>+ Commande</span>
          <div style={{position:"relative"}}>
            <span style={{fontSize:15}}>🔔</span>
            <div style={{position:"absolute",top:-3,right:-3,width:10,height:10,
              background:G.red,borderRadius:"50%",fontSize:7,color:G.white,
              display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>5</div>
          </div>
        </div>
      </div>
      {/* CA card */}
      <div style={{margin:"9px 10px 0",background:`linear-gradient(135deg,${G.greenDark},${G.green})`,
        borderRadius:12,padding:"11px 14px",flexShrink:0}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.65)",marginBottom:2}}>Bonjour, Saliou 👋 · Ma Boutique</div>
        <div style={{fontSize:9,fontWeight:700,color:G.gold,letterSpacing:1.2,marginBottom:2,textTransform:"uppercase"}}>CA du Jour</div>
        <div style={{fontSize:24,fontWeight:900,color:G.white,lineHeight:1}}>265 000 <span style={{fontSize:13}}>CFA</span></div>
        <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",marginTop:3}}>Bénéf. total: 163 640 CFA</div>
      </div>
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,margin:"8px 10px 0",flexShrink:0}}>
        {[{ico:"📦",n:"27",l:"Total commandes",bg:G.white,tc:G.dark},
          {ico:"✅",n:"12",l:"Livrées",bg:G.greenLight,tc:G.green},
          {ico:"❌",n:"5",l:"Rejetées",bg:G.redLight,tc:G.red},
          {ico:"🏍️",n:"1",l:"En route",bg:"#EFF6FF",tc:"#2563EB"}
        ].map((s,i)=>(
          <div key={i} style={{background:s.bg,borderRadius:10,padding:"9px 11px"}}>
            <div style={{fontSize:16}}>{s.ico}</div>
            <div style={{fontSize:20,fontWeight:900,color:s.tc,lineHeight:1.1}}>{s.n}</div>
            <div style={{fontSize:9,color:G.gray,marginTop:1}}>{s.l}</div>
          </div>
        ))}
      </div>
      {/* Taux livraison */}
      <div style={{margin:"7px 10px 0",background:G.white,borderRadius:10,padding:"9px 12px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:10,fontWeight:700,color:G.dark}}>Taux de livraison</span>
          <span style={{fontSize:10,fontWeight:700,color:G.green}}>44%</span>
        </div>
        <div style={{height:6,background:"#E5E7EB",borderRadius:3}}>
          <div style={{width:"44%",height:"100%",background:`linear-gradient(90deg,${G.red},#F59E0B)`,borderRadius:3}}/>
        </div>
      </div>
      {/* CA produit */}
      <div style={{margin:"7px 10px",background:G.white,borderRadius:10,padding:"9px 12px",flex:1}}>
        <div style={{fontSize:11,fontWeight:700,color:G.dark,marginBottom:7}}>💰 CA PAR PRODUIT</div>
        {[{n:"Sac a main",v:"250 000 F",pct:85,b:"165 000 CFA",pos:true},
          {n:"Bouchon rotatif 360°",v:"15 000 F",pct:20,b:"-1 360 CFA",pos:false}
        ].map((p,i)=>(
          <div key={i} style={{marginBottom:i===0?8:0}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:10,color:G.dark,fontWeight:600}}>{p.n}</span>
              <span style={{fontSize:10,fontWeight:700,color:G.dark}}>{p.v}</span>
            </div>
            <div style={{height:4,background:p.pos?G.greenLight:G.redLight,borderRadius:2,margin:"3px 0"}}>
              <div style={{width:`${p.pct}%`,height:"100%",background:p.pos?G.green:G.red,borderRadius:2}}/>
            </div>
            <div style={{fontSize:9,color:p.pos?G.green:G.red}}>Bénéfice: {p.b}</div>
          </div>
        ))}
        <div style={{marginTop:8,background:G.greenLight,borderRadius:8,padding:"6px 10px",
          display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:10,fontWeight:700,color:G.green}}>CA Total</span>
          <span style={{fontSize:11,fontWeight:900,color:G.green}}>265 000 CFA</span>
        </div>
      </div>
      {/* Bottom nav */}
      <div style={{background:G.white,borderTop:`1px solid ${G.border}`,
        display:"flex",padding:"7px 0 4px",flexShrink:0}}>
        {["🛍️\nBoutique","🚚\nÀ traiter","⊞\nDashboard","$\nCompta","👥\nÉquipe"].map((t,i)=>(
          <div key={i} style={{flex:1,textAlign:"center",color:i===2?G.green:G.gray,fontWeight:i===2?700:400}}>
            <div style={{fontSize:i===2?17:13,marginBottom:1}}>{t.split("\n")[0]}</div>
            <div style={{fontSize:8}}>{t.split("\n")[1]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── SCREEN: CHAT ─── */
function ChatScreen() {
  const msgs = [
    {init:"S",bg:G.purple,name:"Saliou closeur",role:"Closer",roleBg:G.purpleLight,roleC:G.purple,audio:true,sent:false,time:"20:26"},
    {sent:true,audio:true,time:"00:25"},
    {init:"I",bg:"#059669",name:"Ibou",role:"Livreur",roleBg:G.greenLight,roleC:G.green,msg:"ca va saliou 👍",sent:false,time:"15:09"},
    {init:"I",bg:"#059669",name:"Ibou",role:"Livreur",roleBg:G.greenLight,roleC:G.green,audio:true,sent:false,time:"15:10"},
    {init:"S",bg:G.purple,name:"Saliou closeur",role:"Closer",roleBg:G.purpleLight,roleC:G.purple,msg:"Salut la team 💪",sent:false,time:"15:11"},
  ];
  return (
    <div style={{background:"#f0f2f5",height:"100%",display:"flex",flexDirection:"column",fontSize:12}}>
      <div style={{background:G.green,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{width:32,height:32,background:"rgba(255,255,255,0.18)",borderRadius:"50%",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👥</div>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:G.white}}>Chat de mon équipe</div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.65)"}}>3 membres · Admin · 1 closer · 1 livreur</div>
        </div>
      </div>
      <div style={{flex:1,padding:"10px",display:"flex",flexDirection:"column",gap:8,overflow:"hidden"}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.sent?"flex-end":"flex-start",gap:7,alignItems:"flex-end"}}>
            {!m.sent&&m.init&&(
              <div style={{width:26,height:26,background:m.bg,borderRadius:"50%",display:"flex",
                alignItems:"center",justifyContent:"center",fontSize:10,color:"white",fontWeight:700,flexShrink:0}}>{m.init}</div>
            )}
            <div style={{maxWidth:150}}>
              {!m.sent&&m.name&&(
                <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                  <span style={{fontSize:9,fontWeight:700,color:m.bg}}>{m.name}</span>
                  <span style={{fontSize:8,background:m.roleBg,color:m.roleC,padding:"1px 5px",borderRadius:4,fontWeight:600}}>{m.role}</span>
                </div>
              )}
              <div style={{background:m.sent?"#DCF8C6":G.white,
                borderRadius:m.sent?"14px 14px 0 14px":"14px 14px 14px 0",padding:"7px 11px"}}>
                {m.audio?(
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:20,height:20,background:m.sent?"#a0d9a0":G.wa,borderRadius:"50%",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"white"}}>▶</div>
                    <div style={{fontSize:9,color:G.gray}}>━━━━━━ 0:12</div>
                  </div>
                ):<div style={{fontSize:11,color:G.dark}}>{m.msg}</div>}
                <div style={{fontSize:8,color:G.gray,marginTop:2,textAlign:"right"}}>{m.time}{m.sent?" ✓✓":""}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{background:G.white,padding:"8px 12px",display:"flex",alignItems:"center",
        gap:8,borderTop:`1px solid ${G.border}`,flexShrink:0}}>
        <span style={{fontSize:14}}>📷</span>
        <div style={{flex:1,background:G.grayLight,borderRadius:20,padding:"6px 12px",
          fontSize:11,color:G.gray}}>Message...</div>
        <div style={{width:28,height:28,background:G.wa,borderRadius:"50%",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>🎤</div>
      </div>
    </div>
  );
}

/* ─── SCREEN: GPS ─── */
function GPSScreen() {
  return (
    <div style={{background:G.grayLight,height:"100%",display:"flex",flexDirection:"column",fontSize:12}}>
      <div style={{background:G.green,padding:"9px 14px",flexShrink:0}}>
        <div style={{fontSize:14,fontWeight:700,color:G.white}}>Teamly · GPS Live</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,margin:"9px 10px 0",flexShrink:0}}>
        <div style={{background:G.white,borderRadius:"9px 0 0 9px",padding:"9px",textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:900,color:G.green}}>4</div>
          <div style={{fontSize:9,color:G.gray}}>Livraisons actives</div>
        </div>
        <div style={{background:G.white,borderRadius:"0 9px 9px 0",padding:"9px",textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:900,color:"#2563EB"}}>1</div>
          <div style={{fontSize:9,color:G.gray}}>Livreurs actifs</div>
        </div>
      </div>
      <div style={{margin:"8px 10px",background:G.white,borderRadius:11,overflow:"hidden",flexShrink:0}}>
        <div style={{padding:"7px 11px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,fontWeight:700,color:G.red}}>📍 Positions en temps réel</span>
          <span style={{fontSize:9,background:G.greenLight,color:G.green,padding:"2px 7px",borderRadius:8,fontWeight:600}}>1 actif</span>
        </div>
        <div style={{height:130,background:"#dce8d0",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:"46%",left:0,right:0,height:6,background:"#c0d0b0",transform:"rotate(-3deg)"}}/>
          <div style={{position:"absolute",top:"26%",left:0,right:0,height:3,background:"#ccdec0"}}/>
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:36,background:"#90b8d0"}}/>
          <div style={{position:"absolute",top:"36%",left:"32%",transform:"translate(-50%,-50%)"}}>
            <div style={{width:30,height:30,background:G.green,borderRadius:"50%",border:"2.5px solid white",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,
              boxShadow:"0 3px 10px rgba(0,0,0,0.28)"}}>🏍️</div>
            <div style={{background:G.white,borderRadius:5,padding:"2px 6px",fontSize:8,fontWeight:700,
              textAlign:"center",marginTop:2,boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>Ibou</div>
          </div>
          <div style={{position:"absolute",top:"50%",right:"16%",fontSize:9,fontWeight:700,color:"#3a4a3a"}}>Marbella</div>
          <div style={{position:"absolute",top:"30%",left:"6%",fontSize:7.5,color:"#556655"}}>San Pedro</div>
        </div>
      </div>
      <div style={{margin:"0 10px",background:G.white,borderRadius:11,padding:"9px 12px",flex:1}}>
        <div style={{fontSize:11,fontWeight:700,color:G.dark,marginBottom:7}}>🏍️ LIVREURS</div>
        <div style={{paddingBottom:7,marginBottom:7,borderBottom:`1px solid ${G.border}`}}>
          <div style={{fontSize:12,fontWeight:700,color:G.dark}}>Ibou</div>
          <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:G.green}}/>
            <span style={{fontSize:9,color:G.gray}}>GPS actif · Marbella</span>
            <span style={{fontSize:8.5,background:G.greenLight,color:G.green,padding:"1px 6px",borderRadius:5,fontWeight:600}}>5 liv.</span>
          </div>
        </div>
        {[{c:"Saliou Mbaye",s:"Colis en main 📦",a:"20 000 F"},
          {c:"Saliou Mbaye",s:"Vers le client 🚀",a:"19 125 F"},
          {c:"Saliou Mbaye",s:"Chez le client 📍",a:"7 500 F"}
        ].map((l,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",
            paddingBottom:5,marginBottom:5,borderBottom:i<2?`1px solid ${G.border}`:"none"}}>
            <div>
              <div style={{fontSize:10,fontWeight:600,color:G.dark}}>{l.c}</div>
              <div style={{fontSize:8.5,color:G.gray}}>{l.s}</div>
            </div>
            <div style={{fontSize:10,fontWeight:700,color:G.dark}}>{l.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── SCREEN: COMPTA ─── */
function ComptaScreen() {
  return (
    <div style={{background:G.grayLight,height:"100%",display:"flex",flexDirection:"column",fontSize:12}}>
      <div style={{background:G.green,padding:"9px 14px",flexShrink:0}}>
        <span style={{fontSize:14,fontWeight:700,color:G.white}}>Compta</span>
      </div>
      <div style={{margin:"9px 10px 7px",background:G.white,borderRadius:12,padding:"14px",flexShrink:0}}>
        <div style={{fontSize:9,color:G.gray,marginBottom:3}}>2026-04-01 → 2026-05-05 · Bénéfice net</div>
        <div style={{fontSize:34,fontWeight:900,color:G.green,lineHeight:1}}>163 640</div>
        <div style={{fontSize:11,fontWeight:700,color:G.green}}>CFA</div>
        <div style={{fontSize:9.5,color:G.gray,marginTop:2}}>Marge 61.8%</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
          {[{l:"CA",v:"265 000 F"},{l:"Coûts",v:"101 360 F"},{l:"Pub",v:"0 F"},{l:"Livrées/Rej.",v:"12 / 0"}].map((x,i)=>(
            <div key={i}>
              <div style={{fontSize:8,color:G.gray}}>{x.l}</div>
              <div style={{fontSize:12,fontWeight:700,color:G.dark}}>{x.v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{margin:"0 10px",background:G.white,borderRadius:11,padding:"10px 12px",flex:1}}>
        <div style={{fontSize:11,fontWeight:700,color:G.dark,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Produits</div>
        {[{n:"Sac a main",s:"10 livrés · 250 000 F",pct:"66.0%",v:"165 000 F",pos:true},
          {n:"Bouchon rotatif 360°",s:"2 livrés · 15 000 F",pct:"-9.1%",v:"-1 360 F",pos:false},
          {n:"Adaptateur Carplay",s:"0 livrés",pct:"—",v:"—",pos:null}
        ].map((p,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            borderBottom:i<2?`1px solid ${G.border}`:"none",
            paddingBottom:i<2?7:0,paddingTop:i>0?7:0}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:G.dark}}>{p.n}</div>
              <div style={{fontSize:8.5,color:G.gray}}>{p.s}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,fontWeight:700,color:p.pos===true?G.green:p.pos===false?G.red:G.gray}}>{p.pct}</div>
              <div style={{fontSize:9,color:p.pos===true?G.green:p.pos===false?G.red:G.gray}}>{p.v}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── SCREEN: LIVREUR ─── */
function LivreurScreen() {
  return (
    <div style={{background:G.grayLight,height:"100%",display:"flex",flexDirection:"column",fontSize:12}}>
      <div style={{background:G.green,padding:"9px 14px",flexShrink:0}}>
        <span style={{fontSize:14,fontWeight:700,color:G.white}}>Mes Livraisons</span>
      </div>
      <div style={{flex:1,padding:"9px",display:"flex",flexDirection:"column",gap:7,overflow:"hidden"}}>
        {/* Card 1 */}
        <div style={{background:G.white,borderRadius:12,overflow:"hidden",flexShrink:0}}>
          <div style={{background:"#F59E0B",padding:"7px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:10,fontWeight:700,color:"white"}}>📍 Livreur chez le client · 17:12</span>
            <span style={{fontSize:11,fontWeight:700,color:"white"}}>7 500 F</span>
          </div>
          <div style={{padding:"10px 12px"}}>
            <div style={{fontSize:14,fontWeight:900,color:G.dark}}>Saliou Mbaye</div>
            <div style={{fontSize:9,color:G.gray,marginBottom:9}}>📦 Bouchon rotatif 360° · 🏍️ Ibou</div>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:9}}>
              {[G.green,G.green,G.green,G.green,"#F59E0B","#DDD"].map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{width:i===5?10:16,height:i===5?10:16,borderRadius:"50%",background:c,
                    border:i===4?`2.5px solid #F59E0B`:"none",display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:7,color:"white",fontWeight:700}}>{i<4?"✓":""}</div>
                  {i<5&&<div style={{width:10,height:2.5,background:i<4?G.green:"#DDD"}}/>}
                </div>
              ))}
            </div>
            <div style={{background:G.green,borderRadius:9,padding:"9px",textAlign:"center",marginBottom:7}}>
              <span style={{fontSize:12,fontWeight:700,color:"white"}}>✅ Livré — Cash encaissé</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
              <div style={{background:G.redLight,borderRadius:7,padding:"5px",textAlign:"center",fontSize:9,fontWeight:600,color:G.red}}>❌ Rejeté</div>
              <div style={{background:"#F3F4F6",borderRadius:7,padding:"5px",textAlign:"center",fontSize:9,fontWeight:600,color:G.dark}}>⛔ Absent</div>
              <div style={{background:G.purpleLight,borderRadius:7,padding:"5px",textAlign:"center",fontSize:9,fontWeight:600,color:G.purple}}>↩️ Report</div>
            </div>
          </div>
        </div>
        {/* Card 2 */}
        <div style={{background:G.white,borderRadius:12,overflow:"hidden",flexShrink:0}}>
          <div style={{background:"#2563EB",padding:"7px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:10,fontWeight:700,color:"white"}}>📦 Colis en main · Étape 3</span>
            <span style={{fontSize:11,fontWeight:700,color:"white"}}>25 000 F</span>
          </div>
          <div style={{padding:"10px 12px"}}>
            <div style={{fontSize:13,fontWeight:900,color:G.dark}}>Diallo</div>
            <div style={{fontSize:9,color:G.gray,marginBottom:8}}>📦 Sac a main · Keur massar</div>
            <div style={{background:"#2563EB",borderRadius:8,padding:"9px",textAlign:"center"}}>
              <span style={{fontSize:11,fontWeight:700,color:"white"}}>🚀 Je pars vers le client</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── DESKTOP SCREEN: DASHBOARD ─── */
function DesktopDashboard() {
  return (
    <div style={{display:"flex",height:380,fontSize:12}}>
      {/* Sidebar */}
      <div style={{width:180,background:G.green,padding:"14px 0",flexShrink:0}}>
        <div style={{padding:"0 14px 16px",display:"flex",alignItems:"center",gap:6,borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
          <div style={{width:22,height:22,background:G.gold,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:12,color:G.green}}>T</div>
          <span style={{color:G.white,fontWeight:700,fontSize:14,fontFamily:"Georgia,serif"}}>eamly</span>
        </div>
        <div style={{padding:"10px 10px 0"}}>
          {[{ico:"⊞",l:"Dashboard",active:true},{ico:"✓",l:"Cmdes à confirmer"},{ico:"🚚",l:"Cmdes à traiter",badge:3},{ico:"$",l:"Compta"},{ico:"📍",l:"Livreurs"},{ico:"👥",l:"Clients"},{ico:"💬",l:"Équipe Chat"},{ico:"📦",l:"Produits"}].map((it,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",
              borderRadius:8,marginBottom:2,background:it.active?"rgba(255,255,255,0.15)":"transparent",
              cursor:"pointer"}}>
              <span style={{fontSize:12,width:16,textAlign:"center"}}>{it.ico}</span>
              <span style={{fontSize:11,color:it.active?G.white:"rgba(255,255,255,0.7)",fontWeight:it.active?700:400}}>{it.l}</span>
              {it.badge&&<span style={{marginLeft:"auto",background:G.red,color:G.white,fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:10}}>{it.badge}</span>}
            </div>
          ))}
        </div>
      </div>
      {/* Main */}
      <div style={{flex:1,background:G.grayLight,overflow:"hidden",padding:"14px"}}>
        <div style={{fontSize:16,fontWeight:800,color:G.dark,marginBottom:12}}>Dashboard</div>
        {/* CA card */}
        <div style={{background:`linear-gradient(135deg,${G.greenDark},${G.green})`,borderRadius:12,padding:"12px 16px",marginBottom:10}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.65)"}}>Bonjour, Saliou mbaye 👋 · Ma Boutique · mardi 5 mai</div>
          <div style={{fontSize:9,fontWeight:700,color:G.gold,letterSpacing:1,margin:"4px 0"}}>CA DU JOUR</div>
          <div style={{fontSize:28,fontWeight:900,color:G.white,lineHeight:1}}>265 000 <span style={{fontSize:13}}>CFA</span></div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",marginTop:2}}>Bénéf. total: 163 640 CFA</div>
        </div>
        {/* Stats grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10}}>
          {[{ico:"📦",n:"27",l:"Total commandes",bg:G.white,tc:G.dark},
            {ico:"✅",n:"12",l:"Livrées",bg:G.greenLight,tc:G.green},
            {ico:"❌",n:"5",l:"Rejetées",bg:G.redLight,tc:G.red},
            {ico:"🏍️",n:"1",l:"En route",bg:"#EFF6FF",tc:"#2563EB"}
          ].map((s,i)=>(
            <div key={i} style={{background:s.bg,borderRadius:9,padding:"10px",border:`1px solid ${G.border}`}}>
              <div style={{fontSize:16}}>{s.ico}</div>
              <div style={{fontSize:20,fontWeight:900,color:s.tc}}>{s.n}</div>
              <div style={{fontSize:9,color:G.gray}}>{s.l}</div>
            </div>
          ))}
        </div>
        {/* Taux + CA */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div style={{background:G.white,borderRadius:9,padding:"10px",border:`1px solid ${G.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:10,fontWeight:700,color:G.dark}}>Taux de livraison</span>
              <span style={{fontSize:10,fontWeight:700,color:G.green}}>44%</span>
            </div>
            <div style={{height:5,background:"#E5E7EB",borderRadius:3}}>
              <div style={{width:"44%",height:"100%",background:G.green,borderRadius:3}}/>
            </div>
            <div style={{marginTop:10,fontSize:9,fontWeight:700,color:G.dark}}>💰 CA PAR PRODUIT</div>
            <div style={{marginTop:5,fontSize:9,color:G.dark,display:"flex",justifyContent:"space-between"}}>
              <span>Sac a main</span><span style={{fontWeight:700}}>250 000 F</span>
            </div>
            <div style={{height:4,background:G.greenLight,borderRadius:2,margin:"3px 0"}}>
              <div style={{width:"85%",height:"100%",background:G.green,borderRadius:2}}/>
            </div>
          </div>
          <div style={{background:G.white,borderRadius:9,padding:"10px",border:`1px solid ${G.border}`}}>
            <div style={{fontSize:10,fontWeight:700,color:G.dark,marginBottom:8}}>⚡ ACTIONS RAPIDES</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
              {[{l:"+ Commande",bg:"#F0FDF4",c:G.green},{l:"+ Produit",bg:G.grayLight,c:G.dark},{l:"Clients",bg:"#FFF7ED",c:"#D97706"},{l:"Tracking",bg:G.purpleLight,c:G.purple}].map((a,i)=>(
                <div key={i} style={{background:a.bg,borderRadius:8,padding:"8px 6px",textAlign:"center",fontSize:9,fontWeight:600,color:a.c}}>{a.l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── DESKTOP SCREEN: ORDERS ─── */
function DesktopOrders() {
  return (
    <div style={{display:"flex",height:380,fontSize:11}}>
      <div style={{width:180,background:G.green,padding:"14px 0",flexShrink:0}}>
        <div style={{padding:"0 14px 16px",display:"flex",alignItems:"center",gap:6,borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
          <div style={{width:22,height:22,background:G.gold,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:12,color:G.green}}>T</div>
          <span style={{color:G.white,fontWeight:700,fontSize:14,fontFamily:"Georgia,serif"}}>eamly</span>
        </div>
        {[{ico:"⊞",l:"Dashboard"},{ico:"✓",l:"Cmdes à confirmer"},{ico:"🚚",l:"Cmdes à traiter",active:true,badge:3},{ico:"$",l:"Compta"},{ico:"📍",l:"Livreurs"}].map((it,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 14px",margin:"2px 10px 0",
            borderRadius:8,background:it.active?"rgba(255,255,255,0.15)":"transparent"}}>
            <span style={{fontSize:11,width:14,textAlign:"center"}}>{it.ico}</span>
            <span style={{fontSize:10,color:it.active?G.white:"rgba(255,255,255,0.7)",fontWeight:it.active?700:400,flex:1}}>{it.l}</span>
            {it.badge&&<span style={{background:G.red,color:G.white,fontSize:8,fontWeight:700,padding:"1px 5px",borderRadius:10}}>{it.badge}</span>}
          </div>
        ))}
      </div>
      <div style={{flex:1,background:G.grayLight,padding:"14px",overflow:"hidden"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:G.dark}}>Commandes à traiter</div>
            <div style={{fontSize:9,color:G.gray}}>Ma Boutique</div>
          </div>
          <span style={{background:G.gold,color:G.dark,fontWeight:700,fontSize:10,padding:"6px 14px",borderRadius:8}}>+ Commande</span>
        </div>
        {/* Filters */}
        <div style={{background:G.white,borderRadius:10,padding:"10px 12px",marginBottom:10,border:`1px solid ${G.border}`}}>
          <div style={{fontSize:8,fontWeight:700,color:G.gray,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Statut de livraison</div>
          <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
            {["Tout","En attente","Livreur en route 🚚","Colis en main 📦","Vers le client 🚀","Chez le client 📍"].map((f,i)=>(
              <span key={i} style={{fontSize:9,fontWeight:600,padding:"4px 10px",borderRadius:20,
                background:i===0?G.dark:"rgba(0,0,0,0.06)",color:i===0?G.white:G.dark,cursor:"pointer"}}>{f}</span>
            ))}
          </div>
          <div style={{fontSize:8,fontWeight:700,color:G.gray,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Résultat</div>
          <div style={{display:"flex",gap:6}}>
            {["Encaissé ✅","Rejeté ❌","Absent 🚫"].map((f,i)=>(
              <span key={i} style={{fontSize:9,fontWeight:600,padding:"4px 10px",borderRadius:20,
                background:i===0?"#DCFCE7":i===1?"#FEE2E2":"#F3F4F6",
                color:i===0?G.green:i===1?G.red:G.gray,cursor:"pointer",
                border:`1px solid ${i===0?"#86EFAC":i===1?"#FCA5A5":"#E5E7EB"}`}}>{f}</span>
            ))}
          </div>
        </div>
        {/* Order cards grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{name:"Saliou Mbaye",prod:"Adaptateur Carplay",status:"Client confirmé ✅",color:"#22C55E",val:"20 000 F"},
            {name:"Hhhhhh",prod:"Sac a main",status:"Client confirmé ✅",color:"#22C55E",val:"25 000 F"},
            {name:"Saliou",prod:"Sac a main",status:"Client confirmé ✅",color:"#22C55E",val:"25 000 F"}
          ].map((o,i)=>(
            <div key={i} style={{background:G.white,borderRadius:10,overflow:"hidden",border:`1px solid ${G.border}`}}>
              <div style={{background:o.color,padding:"5px 8px",display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:8,fontWeight:700,color:"white"}}>{o.status}</span>
                <span style={{fontSize:9,fontWeight:700,color:"white"}}>{o.val}</span>
              </div>
              <div style={{padding:"8px"}}>
                <div style={{fontSize:11,fontWeight:800,color:G.dark}}>{o.name}</div>
                <div style={{fontSize:8,color:G.gray,marginBottom:7}}>{o.prod}</div>
                <div style={{background:"#22C55E",borderRadius:6,padding:"5px",textAlign:"center",fontSize:8.5,fontWeight:700,color:"white"}}>
                  📱 Confirmer par WhatsApp
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── PRICING PLANS ─── */
const PLANS = [
  {name:"Gratuit",badge:"14 JOURS D'ESSAI",badgeC:"#2563EB",badgeBg:"#EFF6FF",
    price:null,priceLbl:"Gratuit",sub:"Pour découvrir Teamly",
    features:["2 membres (Admin + 1)","30 commandes / mois","Création manuelle de commandes","Gestion des produits & stock","Chat équipe interne","Dashboard & statistiques basiques"],
    cta:"Essayer gratuitement",ctaBg:G.dark,ctaC:G.white,popular:false},
  {name:"Basic",badge:"LE PLUS POPULAIRE",badgeC:G.dark,badgeBg:G.gold,
    price:"8 000",sub:"Pour les boutiques qui démarrent",
    features:["3 membres (Admin + Closer + Livreur)","100 commandes / mois","1 boutique connectée (Shopify, WooCommerce, YouCan)","Confirmation WhatsApp automatique","GPS livreur temps réel","Comptabilité & marges","Assistant IA"],
    cta:"Activer Basic",ctaBg:G.green,ctaC:G.white,popular:true},
  {name:"Pro",badge:"POUR LES ÉQUIPES",badgeC:G.green,badgeBg:G.greenLight,
    price:"14 000",sub:"Pour les boutiques en croissance",
    features:["5 membres — 3 rôles","2 000 commandes / mois","2 boutiques connectées","Toutes les fonctions Basic","Rapports & stats avancés","Export Excel clients"],
    cta:"Activer Pro",ctaBg:G.green,ctaC:G.white,popular:false},
  {name:"Scale",badge:"GRANDES ÉQUIPES",badgeC:G.purple,badgeBg:G.purpleLight,
    price:"25 000",sub:"Croissance sans limites",
    features:["Membres illimités","Commandes illimitées","4 boutiques connectées","Toutes les fonctions Pro","Support prioritaire 24/7"],
    cta:"Activer Scale",ctaBg:"linear-gradient(135deg,#7C3AED,#5B21B6)",ctaC:G.white,popular:false},
];

/* ─── FEATURE SECTION ─── */
function FeatureSection({tag,title,desc,bullets,phone,reverse,bg=G.white}) {
  const screens = {dashboard:<DashboardScreen/>,chat:<ChatScreen/>,gps:<GPSScreen/>,compta:<ComptaScreen/>,livreur:<LivreurScreen/>};
  return (
    <section className={`feature-section ${reverse?"reverse":""}`}
      style={{background:bg,padding:"80px 0"}}>
      <div className="feature-inner" style={{maxWidth:1100,margin:"0 auto",padding:"0 48px",
        display:"flex",alignItems:"center",gap:56,
        flexDirection:reverse?"row-reverse":"row"}}>
        <div className="phone-wrap" style={{display:"flex",justifyContent:reverse?"flex-start":"flex-end",flex:1}}>
          <Phone>{screens[phone]}</Phone>
        </div>
        <div style={{flex:1,maxWidth:420}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:7,background:G.greenLight,
            padding:"5px 14px",borderRadius:22,marginBottom:18}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:G.green}}/>
            <span style={{fontSize:11,fontWeight:700,color:G.green,letterSpacing:0.8,textTransform:"uppercase"}}>{tag}</span>
          </div>
          <h2 style={{fontSize:33,fontWeight:900,color:G.dark,lineHeight:1.14,
            margin:"0 0 16px",letterSpacing:-0.6}}>{title}</h2>
          <p style={{fontSize:15,color:G.gray,lineHeight:1.72,margin:"0 0 26px"}}>{desc}</p>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {bullets.map((b,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:G.greenLight,flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{fontSize:14,color:G.dark}}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── MAIN ─── */
export default function TeamlyLanding() {
  const [scrolled,setScrolled]=useState(false);
  useEffect(()=>{
    const fn=()=>setScrolled(window.scrollY>60);
    window.addEventListener("scroll",fn);
    return()=>window.removeEventListener("scroll",fn);
  },[]);

  return (
    <div style={{fontFamily:"system-ui,-apple-system,sans-serif",overflowX:"hidden",background:G.white}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;}
        body{margin:0;}
        h1,h2,h3{font-family:'Plus Jakarta Sans',Georgia,serif;}
        a{cursor:pointer;-webkit-tap-highlight-color:transparent;}
        nav{left:0;right:0;}
        @media(max-width:900px){
          .hero-inner{flex-direction:column !important;padding:100px 24px 60px !important;gap:40px !important;}
          .hero-text{max-width:100% !important;}
          .hero-h1{font-size:38px !important;}
          .hero-phone{display:flex;justify-content:center;}
          .hero-btns{flex-wrap:wrap;}
          .hero-stats{gap:24px !important;}
          .feature-inner{flex-direction:column !important;padding:0 24px !important;gap:40px !important;}
          .phone-wrap{justify-content:center !important;}
          .desktop-section .inner{flex-direction:column !important;padding:0 24px !important;gap:32px !important;}
          .desktop-section .browser-wrap{width:100% !important;}
          .nav-links{display:none !important;}
          .nav-login{display:none !important;}
          .pricing-grid{grid-template-columns:1fr !important;padding:0 24px !important;}
          .roles-grid{grid-template-columns:1fr !important;padding:0 24px !important;}
          .cta-btns{flex-direction:column !important;align-items:center !important;}
          .footer-inner{flex-direction:column !important;gap:20px !important;text-align:center !important;padding:28px 24px !important;}
          .social-proof{padding:14px 24px !important;gap:20px !important;}
        }
        @media(max-width:600px){
          .hero-h1{font-size:32px !important;}
          .nav-inner{padding:14px 20px !important;}
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{position:"fixed",top:0,zIndex:200,width:"100%",
        background:scrolled?"rgba(255,255,255,0.97)":"transparent",
        backdropFilter:scrolled?"blur(14px)":"none",
        boxShadow:scrolled?"0 1px 24px rgba(0,0,0,0.07)":"none",
        transition:"all 0.3s"}}>
        <div className="nav-inner" style={{maxWidth:1200,margin:"0 auto",padding:"16px 48px",
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <Logo light={!scrolled}/>
          <div className="nav-links" style={{display:"flex",alignItems:"center",gap:32}}>
            {["Fonctionnalités","Rôles","Tarifs","Support"].map(l=>(
              <a key={l} href="#" style={{fontSize:14,fontWeight:600,textDecoration:"none",
                color:scrolled?G.dark:G.white}}>{l}</a>
            ))}
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <a className="nav-login" href="/dashboard"
              style={{fontSize:14,fontWeight:600,textDecoration:"none",
                color:scrolled?G.dark:"rgba(255,255,255,0.85)"}}>Se connecter</a>
            <a href="/dashboard"
              style={{fontSize:14,fontWeight:800,background:G.gold,color:G.dark,
                textDecoration:"none",padding:"10px 22px",borderRadius:11,
                boxShadow:"0 4px 14px rgba(240,165,0,0.3)"}}>Commencer →</a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{background:`linear-gradient(160deg,${G.greenDark} 0%,${G.green} 58%,${G.greenMid} 100%)`,
        minHeight:"100vh",display:"flex",alignItems:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-100,right:-100,width:500,height:500,borderRadius:"50%",background:"rgba(255,255,255,0.025)"}}/>
        <div style={{position:"absolute",bottom:-80,left:-80,width:380,height:380,borderRadius:"50%",background:"rgba(255,255,255,0.02)"}}/>
        <div className="hero-inner" style={{maxWidth:1200,margin:"0 auto",padding:"130px 48px 90px",
          display:"flex",alignItems:"center",gap:60,width:"100%"}}>
          <div className="hero-text" style={{flex:1,maxWidth:520}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,
              background:"rgba(255,255,255,0.11)",border:"1px solid rgba(255,255,255,0.15)",
              backdropFilter:"blur(8px)",padding:"7px 16px",borderRadius:24,marginBottom:24}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:G.gold}}/>
              <span style={{fontSize:12,fontWeight:600,color:G.white}}>Plateforme SaaS COD · Afrique de l'Ouest</span>
            </div>
            <h1 className="hero-h1" style={{fontSize:54,fontWeight:900,color:G.white,
              lineHeight:1.08,margin:"0 0 16px",letterSpacing:-1.5}}>
              Enfin, votre équipe<br/>e-commerce<br/>
              <span style={{color:G.gold}}>synchronisée.</span>
            </h1>
            <a href="/dashboard"
              style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:13,fontWeight:600,
                color:"rgba(255,255,255,0.55)",textDecoration:"none",marginBottom:16,
                borderBottom:"1px solid rgba(255,255,255,0.22)",paddingBottom:2}}>
              🔗 www.teamlyecom.com
            </a>
            <p style={{fontSize:16,color:"rgba(255,255,255,0.78)",lineHeight:1.72,margin:"0 0 34px"}}>
              Admin, Closer et Livreur — une seule plateforme.<br/>
              Chaque commande confirmée, livrée et encaissée{" "}
              <strong style={{color:G.gold}}>plus vite</strong>.
            </p>
            <div className="hero-btns" style={{display:"flex",gap:14,marginBottom:44}}>
              <a href="/dashboard"
                style={{display:"inline-flex",alignItems:"center",background:G.gold,color:G.dark,
                  fontWeight:800,fontSize:15,padding:"15px 26px",borderRadius:12,textDecoration:"none",
                  boxShadow:"0 8px 28px rgba(240,165,0,0.35)"}}>Commencer gratuitement →</a>
              <a href="https://wa.me/34643164129?text=Bonjour%2C%20je%20veux%20essayer%20Teamly" target="_blank" rel="noreferrer"
                style={{display:"inline-flex",alignItems:"center",gap:8,
                  background:"rgba(255,255,255,0.11)",border:"1px solid rgba(255,255,255,0.2)",
                  color:G.white,fontWeight:700,fontSize:15,padding:"15px 20px",
                  borderRadius:12,textDecoration:"none"}}>💬 WhatsApp</a>
            </div>
            <div className="hero-stats" style={{display:"flex",gap:40}}>
              {[{n:"500+",l:"Boutiques actives"},{n:"+30%",l:"Taux de livraison"},{n:"3",l:"Rôles intégrés"}].map((s,i)=>(
                <div key={i}>
                  <div style={{fontSize:26,fontWeight:900,color:G.gold}}>{s.n}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-phone" style={{flex:1,display:"flex",justifyContent:"center"}}>
            <Phone><DashboardScreen/></Phone>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ── */}
      <section className="social-proof" style={{background:G.white,borderBottom:`1px solid ${G.border}`,
        padding:"18px 48px",display:"flex",alignItems:"center",justifyContent:"center",gap:40,flexWrap:"wrap"}}>
        <span style={{fontSize:13,color:G.gray}}>Vendeurs actifs en :</span>
        {["🇸🇳 Sénégal","🇨🇮 Côte d'Ivoire","🇲🇱 Mali","🇲🇦 Maroc","🇪🇸 Espagne"].map(c=>(
          <span key={c} style={{fontSize:14,fontWeight:600,color:G.dark}}>{c}</span>
        ))}
      </section>

      {/* ── FEATURES ── */}
      {[
        {tag:"Chat d'équipe",title:"Toute votre équipe dans un seul endroit.",
          desc:"Fini les groupes WhatsApp désorganisés. Admin, Closer et Livreur communiquent dans un chat interne structuré par rôle, directement dans l'app.",
          bullets:["Messages texte, audio et photos","Rôles visibles en temps réel","Notifications instantanées","Historique complet des conversations"],
          phone:"chat",reverse:false,bg:G.white},
        {tag:"GPS Livreur",title:"Suivez vos livreurs en temps réel.",
          desc:"Voyez sur une carte live où se trouve chaque livreur, quelles commandes il transporte et leur valeur. Zéro appel, zéro confusion.",
          bullets:["Position GPS en direct sur carte","Statut de chaque livraison","Alerte automatique au client à l'approche","Valeur totale en transit visible"],
          phone:"gps",reverse:true,bg:G.grayLight},
        {tag:"Comptabilité automatique",title:"Vos marges, calculées toutes seules.",
          desc:"La section Compta se remplit automatiquement à partir des commandes. Vous n'entrez que votre budget pub. Tout le reste est calculé.",
          bullets:["Bénéfice net en temps réel","Marge par produit calculée","CA / Coûts / Pub automatique","Rapport livraisons / rejections"],
          phone:"compta",reverse:false,bg:G.white},
        {tag:"Espace Livreur",title:"Le livreur sait toujours quoi faire.",
          desc:"Chaque livreur voit ses commandes, le statut étape par étape et peut encaisser ou rejeter en un seul tap. Zéro erreur possible.",
          bullets:["Flux guidé étape par étape","Encaisser / Rejeter / Absent en 1 tap","Contact client direct depuis l'app","Synchro temps réel avec l'Admin"],
          phone:"livreur",reverse:true,bg:G.grayLight},
      ].map((f,i)=><FeatureSection key={i} {...f}/>)}

      {/* ── DISPONIBLE SUR PC ── */}
      <section className="desktop-section" style={{background:G.white,padding:"80px 0"}}>
        <div className="inner" style={{maxWidth:1100,margin:"0 auto",padding:"0 48px",
          display:"flex",alignItems:"center",gap:56}}>
          <div style={{flex:1,maxWidth:380}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:7,background:G.greenLight,
              padding:"5px 14px",borderRadius:22,marginBottom:18}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:G.green}}/>
              <span style={{fontSize:11,fontWeight:700,color:G.green,letterSpacing:0.8,textTransform:"uppercase"}}>Disponible sur PC</span>
            </div>
            <h2 style={{fontSize:33,fontWeight:900,color:G.dark,lineHeight:1.14,margin:"0 0 16px",letterSpacing:-0.6}}>
              Gérez tout depuis votre ordinateur.
            </h2>
            <p style={{fontSize:15,color:G.gray,lineHeight:1.72,margin:"0 0 26px"}}>
              Teamly est accessible sur navigateur web — PC, Mac, tablette. La vue desktop offre un dashboard étendu, une gestion des commandes en colonnes et des filtres avancés.
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {["Sidebar de navigation complète","Grille de commandes multi-colonnes","Filtres avancés : statut + résultat","Accessible sur tous les navigateurs","Aucune installation requise"].map((b,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:G.greenLight,flexShrink:0,
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span style={{fontSize:14,color:G.dark}}>{b}</span>
                </div>
              ))}
            </div>
            <a href="/dashboard"
              style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:28,
                background:G.green,color:G.white,fontWeight:700,fontSize:14,
                padding:"13px 24px",borderRadius:11,textDecoration:"none"}}>
              Ouvrir sur PC →
            </a>
          </div>
          <div className="browser-wrap" style={{flex:1,display:"flex",justifyContent:"flex-end"}}>
            <Browser><DesktopOrders/></Browser>
          </div>
        </div>
      </section>

      {/* ── SECOND DESKTOP SECTION: DASHBOARD PC ── */}
      <section className="desktop-section" style={{background:G.grayLight,padding:"80px 0"}}>
        <div className="inner" style={{maxWidth:1100,margin:"0 auto",padding:"0 48px",
          display:"flex",alignItems:"center",gap:56,flexDirection:"row-reverse"}}>
          <div style={{flex:1,maxWidth:380}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:7,background:G.greenLight,
              padding:"5px 14px",borderRadius:22,marginBottom:18}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:G.green}}/>
              <span style={{fontSize:11,fontWeight:700,color:G.green,letterSpacing:0.8,textTransform:"uppercase"}}>Dashboard Admin</span>
            </div>
            <h2 style={{fontSize:33,fontWeight:900,color:G.dark,lineHeight:1.14,margin:"0 0 16px",letterSpacing:-0.6}}>
              Vision complète de votre boutique.
            </h2>
            <p style={{fontSize:15,color:G.gray,lineHeight:1.72,margin:"0 0 26px"}}>
              Le dashboard Admin centralise CA du jour, bénéfice, taux de livraison, CA par produit et alertes en temps réel. Tout sur une seule page.
            </p>
            {["CA du jour et bénéfice net","Taux de livraison en temps réel","CA par produit avec marges","Alertes commandes sans livreur","Commandes récentes en un coup d'œil"].map((b,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:G.greenLight,flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{fontSize:14,color:G.dark}}>{b}</span>
              </div>
            ))}
          </div>
          <div className="browser-wrap" style={{flex:1}}>
            <Browser><DesktopDashboard/></Browser>
          </div>
        </div>
      </section>

      {/* ── ROLES ── */}
      <section style={{background:G.greenDark,padding:"80px 0"}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"0 48px",textAlign:"center",marginBottom:52}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.08)",
            padding:"5px 14px",borderRadius:22,marginBottom:16}}>
            <span style={{fontSize:11,fontWeight:700,color:G.gold,letterSpacing:0.8,textTransform:"uppercase"}}>3 rôles · 1 plateforme</span>
          </div>
          <h2 style={{fontSize:36,fontWeight:900,color:G.white,lineHeight:1.15,margin:0,letterSpacing:-0.5}}>
            Chaque membre a sa propre vue<br/><span style={{color:G.gold}}>dans l'application.</span>
          </h2>
        </div>
        <div className="roles-grid" style={{maxWidth:1100,margin:"0 auto",padding:"0 48px",
          display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20}}>
          {[{ico:"👑",role:"Admin",color:G.gold,
            desc:"Vision complète : dashboard, commandes, équipe, stock, compta, GPS livreurs.",
            items:["Dashboard live","GPS des livreurs","Comptabilité automatique","Gestion de l'équipe","Stocks & produits"]},
            {ico:"📞",role:"Closer",color:"#818CF8",
            desc:"Confirme les commandes, contacte les clients et envoie les confirmations WhatsApp.",
            items:["File de commandes","WhatsApp automatique","Fiche client complète","Chat interne","Suivi des livraisons"]},
            {ico:"🏍️",role:"Livreur",color:G.greenMid,
            desc:"Voit ses livraisons, l'adresse GPS, peut encaisser ou rejeter en un tap.",
            items:["Livraisons assignées","GPS & adresse client","Encaisser / Rejeter","Appel direct client","Chat interne"]},
          ].map((r,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:18,padding:"28px 24px"}}>
              <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,255,255,0.08)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:16}}>{r.ico}</div>
              <div style={{fontSize:22,fontWeight:900,color:r.color,marginBottom:8}}>{r.role}</div>
              <p style={{fontSize:13,color:"rgba(255,255,255,0.6)",lineHeight:1.65,marginBottom:20}}>{r.desc}</p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {r.items.map((it,j)=>(
                  <div key={j} style={{display:"flex",alignItems:"center",gap:9}}>
                    <div style={{width:16,height:16,borderRadius:"50%",background:"rgba(255,255,255,0.08)",
                      flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={r.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span style={{fontSize:13,color:"rgba(255,255,255,0.8)"}}>{it}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="plans" style={{background:G.grayLight,padding:"80px 0"}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"0 48px",textAlign:"center",marginBottom:48}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:7,background:G.greenLight,
            padding:"5px 14px",borderRadius:22,marginBottom:16}}>
            <span style={{fontSize:11,fontWeight:700,color:G.green,letterSpacing:0.8,textTransform:"uppercase"}}>Tarifs</span>
          </div>
          <h2 style={{fontSize:36,fontWeight:900,color:G.dark,lineHeight:1.15,margin:"0 0 12px",letterSpacing:-0.5}}>
            Des plans adaptés à votre croissance
          </h2>
          <p style={{fontSize:15,color:G.gray,margin:0}}>14 jours gratuits · Sans carte bancaire · Sans engagement</p>
        </div>
        <div className="pricing-grid" style={{maxWidth:1100,margin:"0 auto",padding:"0 48px",
          display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18}}>
          {PLANS.map((plan,i)=>(
            <div key={i} style={{borderRadius:20,border:plan.popular?`2px solid ${G.green}`:`1.5px solid ${G.border}`,
              overflow:"hidden",background:G.white,
              boxShadow:plan.popular?"0 12px 40px rgba(26,92,56,0.14)":"0 2px 12px rgba(0,0,0,0.04)"}}>
              {/* Header */}
              <div style={{background:plan.popular?`linear-gradient(135deg,${G.greenDark},${G.green})`:G.grayLight,
                padding:"22px 22px 20px"}}>
                <span style={{display:"inline-block",background:plan.badgeBg,color:plan.badgeC,
                  fontWeight:700,fontSize:9,letterSpacing:1.2,textTransform:"uppercase",
                  padding:"3px 10px",borderRadius:20,marginBottom:12}}>{plan.badge}</span>
                <div style={{fontSize:22,fontWeight:900,color:plan.popular?G.white:G.dark,
                  letterSpacing:-0.3,marginBottom:4}}>{plan.name}</div>
                <div style={{fontSize:11,color:plan.popular?"rgba(255,255,255,0.6)":G.gray,marginBottom:14}}>{plan.sub}</div>
                {plan.price?(
                  <div style={{display:"flex",alignItems:"baseline",gap:3}}>
                    <span style={{fontSize:30,fontWeight:900,color:plan.popular?G.gold:G.dark,lineHeight:1}}>{plan.price}</span>
                    <span style={{fontSize:12,color:plan.popular?"rgba(255,255,255,0.55)":G.gray,fontWeight:600}}>CFA / mois</span>
                  </div>
                ):(
                  <div style={{fontSize:30,fontWeight:900,color:G.dark,lineHeight:1}}>Gratuit <span style={{fontSize:13,color:G.gray,fontWeight:500}}>14 jours</span></div>
                )}
              </div>
              {/* Body */}
              <div style={{padding:"18px 20px 22px"}}>
                <a href="/dashboard"
                  style={{display:"block",textAlign:"center",background:plan.ctaBg,color:plan.ctaC,
                    fontWeight:700,fontSize:13,padding:"12px 16px",borderRadius:11,
                    textDecoration:"none",marginBottom:18}}>
                  {plan.cta}
                </a>
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {plan.features.map((f,j)=>(
                    <div key={j} style={{display:"flex",alignItems:"flex-start",gap:9}}>
                      <div style={{width:17,height:17,borderRadius:"50%",background:G.greenLight,flexShrink:0,
                        display:"flex",alignItems:"center",justifyContent:"center",marginTop:1}}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <span style={{fontSize:12,color:G.dark,lineHeight:1.45}}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{background:`linear-gradient(160deg,${G.greenDark},${G.green})`,
        padding:"96px 48px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-80,right:-80,width:320,height:320,borderRadius:"50%",background:"rgba(255,255,255,0.02)"}}/>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <h2 style={{fontSize:44,fontWeight:900,color:G.white,lineHeight:1.1,margin:"0 0 18px",letterSpacing:-1}}>
            Prêt à synchroniser<br/><span style={{color:G.gold}}>votre équipe ?</span>
          </h2>
          <p style={{fontSize:16,color:"rgba(255,255,255,0.7)",margin:"0 0 36px",lineHeight:1.7}}>
            14 jours gratuits, sans carte bancaire.<br/>
            Disponible sur mobile et PC · <a href="/dashboard"
              style={{color:G.gold,fontWeight:700,textDecoration:"none"}}>teamlyecom.com</a>
          </p>
          <div className="cta-btns" style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
            <a href="/dashboard"
              style={{display:"inline-flex",alignItems:"center",background:G.gold,color:G.dark,
                fontWeight:800,fontSize:16,padding:"16px 32px",borderRadius:12,textDecoration:"none",
                boxShadow:"0 8px 28px rgba(240,165,0,0.35)"}}>Commencer gratuitement →</a>
            <a href="https://wa.me/34643164129" target="_blank" rel="noreferrer"
              style={{display:"inline-flex",alignItems:"center",gap:8,background:G.wa,
                color:G.white,fontWeight:700,fontSize:15,padding:"16px 24px",borderRadius:12,textDecoration:"none"}}>💬 WhatsApp</a>
          </div>
          <div style={{marginTop:24,fontSize:13,color:"rgba(255,255,255,0.32)"}}>
            Mobile · PC · Tablette · Disponible 7j/7 · Support WhatsApp inclus
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{background:G.greenDark}}>
        <div className="footer-inner" style={{maxWidth:1200,margin:"0 auto",padding:"32px 48px",
          display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
          <Logo/>
          <div style={{display:"flex",gap:28,flexWrap:"wrap"}}>
            {["Fonctionnalités","Tarifs","Support","Confidentialité"].map(l=>(
              <a key={l} href="#" style={{fontSize:13,color:"rgba(255,255,255,0.45)",textDecoration:"none"}}>{l}</a>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <a href="https://wa.me/34643164129" style={{fontSize:13,color:"rgba(255,255,255,0.55)",textDecoration:"none"}}>+34 643 16 41 29</a>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.25)"}}>© 2026 Teamly · Tous droits réservés</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
