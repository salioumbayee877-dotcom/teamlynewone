import { useState, useEffect } from "react";

const G = {
  greenDark: "#1A5C38",
  greenMid: "#2E8B57",
  greenLight: "#E8F5EE",
  greenPale: "#f0faf4",
  gold: "#F0A500",
  goldLight: "#FFF8E7",
  dark: "#0f1f16",
  text: "#1e3a28",
  muted: "#5a7a65",
  white: "#FFFFFF",
  offwhite: "#F9F7F2",
  border: "rgba(30,58,40,0.12)",
  red: "#DC2626",
  blue: "#2563EB",
};

function Logo({ size = 26, light = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{
        width: size, height: size, background: G.gold, borderRadius: 7,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 900, fontSize: size * 0.55, color: G.greenDark,
        fontFamily: "'DM Sans', sans-serif",
      }}>T</div>
      <span style={{
        fontSize: size * 0.88, fontWeight: 800, letterSpacing: -0.5,
        color: light ? G.white : G.dark, fontFamily: "'DM Sans', sans-serif",
      }}>eamly</span>
    </div>
  );
}

function Check({ ok }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
      background: ok ? G.greenLight : "rgba(0,0,0,0.06)",
      color: ok ? G.greenDark : "#aaa", fontSize: 11, fontWeight: 800,
    }}>{ok ? "✓" : "✕"}</span>
  );
}

function CheckLine({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        background: G.greenLight, color: G.greenDark, fontSize: 12, fontWeight: 800,
      }}>✓</span>
      <span style={{ fontSize: 14, color: G.text, lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

function PhoneFrame({ children, width = 270 }) {
  return (
    <div style={{
      width, background: "#0a0f0c", borderRadius: 36, padding: "10px 8px 14px",
      boxShadow: "0 40px 100px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)",
      fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
    }}>
      <div style={{
        width: 80, height: 18, background: "#0a0f0c", borderRadius: 12,
        margin: "0 auto 6px", position: "relative", zIndex: 2,
      }} />
      <div style={{
        background: "#fff", borderRadius: 26, overflow: "hidden", marginTop: -22,
        minHeight: 560, display: "flex", flexDirection: "column",
      }}>
        <div style={{
          height: 28, background: G.greenDark, padding: "8px 22px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          <span>15:13</span>
          <span style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 10 }}>
            <span>●●</span><span>4G</span><span>▓</span>
          </span>
        </div>
        {children}
        <div style={{ flex: 1, background: "#fafafa", minHeight: 8 }} />
        <div style={{
          height: 4, width: 100, background: "#0a0f0c", borderRadius: 4,
          margin: "6px auto 8px", opacity: 0.85, flexShrink: 0,
        }} />
      </div>
    </div>
  );
}

function MockupDashboard() {
  return (
    <PhoneFrame>
      <div style={{
        background: G.greenDark, padding: "10px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Logo size={20} light />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{
            background: G.gold, color: G.greenDark, fontSize: 9, fontWeight: 800,
            padding: "4px 8px", borderRadius: 6,
          }}>+ Commande</span>
          <span style={{ fontSize: 14, position: "relative", color: "#fff" }}>
            🔔
            <span style={{
              position: "absolute", top: -3, right: -4,
              background: G.red, color: "#fff", fontSize: 7, fontWeight: 800,
              borderRadius: 8, padding: "1px 4px",
            }}>5</span>
          </span>
        </div>
      </div>
      <div style={{ padding: "12px 12px 14px", background: "#fafafa" }}>
        <div style={{ fontSize: 10, color: G.muted, marginBottom: 10 }}>
          Bonjour, <b style={{ color: G.dark }}>Saliou</b> 👋 · Ma Boutique
        </div>
        <div style={{
          background: `linear-gradient(135deg, ${G.greenDark}, ${G.greenMid})`,
          borderRadius: 12, padding: "12px 14px", color: "#fff", marginBottom: 10,
        }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>CA du Jour</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: G.gold, margin: "2px 0" }}>265 000 CFA</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.65)" }}>
            Bénéf. total : <b style={{ color: G.gold }}>163 640 CFA</b>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5, marginBottom: 10 }}>
          {[
            { i: "📦", v: "27", l: "Total", c: G.greenDark },
            { i: "✅", v: "12", l: "Livrées", c: G.greenMid },
            { i: "❌", v: "5", l: "Rejetées", c: G.red },
            { i: "🏍️", v: "1", l: "En route", c: G.blue },
          ].map(s => (
            <div key={s.l} style={{
              background: "#fff", borderRadius: 8, padding: "7px 4px",
              textAlign: "center", border: `1px solid ${G.border}`,
            }}>
              <div style={{ fontSize: 11 }}>{s.i}</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 7, color: G.muted, fontWeight: 600 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{
          background: "#fff", borderRadius: 8, padding: "8px 10px", marginBottom: 10,
          border: `1px solid ${G.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: G.muted, fontWeight: 600 }}>Taux de livraison</span>
            <span style={{ fontSize: 10, fontWeight: 900, color: G.greenDark }}>44%</span>
          </div>
          <div style={{ height: 4, background: G.greenLight, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: "44%", height: "100%", background: G.greenMid }} />
          </div>
        </div>
        <div style={{ fontSize: 9, fontWeight: 800, color: G.dark, marginBottom: 6 }}>💰 CA PAR PRODUIT</div>
        <div style={{
          background: "#fff", borderRadius: 8, padding: "8px 10px", marginBottom: 5,
          border: `1px solid ${G.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: G.dark }}>Sac à main</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: G.greenDark }}>250 000 CFA</span>
          </div>
          <div style={{ fontSize: 8, color: G.greenMid, fontWeight: 600, marginTop: 1 }}>
            Bénéfice : 165 000 CFA
          </div>
        </div>
        <div style={{
          background: "#fff", borderRadius: 8, padding: "8px 10px",
          border: `1px solid ${G.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: G.dark }}>Bouchon rotatif</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: G.dark }}>15 000 CFA</span>
          </div>
          <div style={{ fontSize: 8, color: G.red, fontWeight: 600, marginTop: 1 }}>
            Bénéfice : -1 360 CFA
          </div>
        </div>
      </div>
      <div style={{
        background: "#fff", borderTop: `1px solid ${G.border}`,
        display: "flex", justifyContent: "space-around", padding: "8px 0 10px",
      }}>
        {[
          ["🛍️", "Boutique", false],
          ["🚚", "À traiter", false],
          ["⊞", "Dashboard", true],
          ["$", "Compta", false],
          ["👥", "Équipe", false],
        ].map(([i, l, a]) => (
          <div key={l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, color: a ? G.greenDark : G.muted }}>{i}</div>
            <div style={{ fontSize: 7, fontWeight: a ? 800 : 500, color: a ? G.greenDark : G.muted, marginTop: 1 }}>{l}</div>
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

function MockupChat() {
  return (
    <PhoneFrame>
      <div style={{ background: G.greenDark, padding: "10px 14px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>👥</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800 }}>Chat de mon équipe</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)" }}>3 membres · Admin · 1 closer · 1 livreur</div>
          </div>
        </div>
      </div>
      <div style={{ background: "#f4f3ee", padding: "10px 8px", minHeight: 380 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "flex-start" }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: G.greenMid, color: "#fff", display: "flex",
            alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11,
          }}>S</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: G.greenDark, marginBottom: 2 }}>
              Saliou closeur <span style={{ background: G.gold, color: G.greenDark, fontSize: 7, padding: "1px 4px", borderRadius: 3, marginLeft: 3 }}>Closer</span>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, padding: "8px 10px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: G.greenDark }}>▶</span>
                <div style={{ flex: 1, height: 14, display: "flex", alignItems: "center", gap: 1 }}>
                  {[...Array(20)].map((_, i) => (
                    <div key={i} style={{ width: 2, height: 4 + (i % 5) * 2, background: G.greenMid, borderRadius: 1 }} />
                  ))}
                </div>
                <span style={{ fontSize: 8, color: G.muted, fontWeight: 600 }}>0:12</span>
              </div>
            </div>
            <div style={{ fontSize: 7, color: G.muted, marginTop: 2 }}>20:26</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "flex-start" }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: G.blue, color: "#fff", display: "flex",
            alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11,
          }}>I</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: G.blue, marginBottom: 2 }}>
              Ibou <span style={{ background: "#dbeafe", color: G.blue, fontSize: 7, padding: "1px 4px", borderRadius: 3, marginLeft: 3 }}>Livreur</span>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, padding: "7px 10px", fontSize: 11, color: G.dark, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>ça va Saliou 👍</div>
            <div style={{ fontSize: 7, color: G.muted, marginTop: 2 }}>15:09</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "flex-start" }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: G.blue, color: "#fff", display: "flex",
            alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11,
          }}>I</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: G.blue, marginBottom: 2 }}>
              Ibou <span style={{ background: "#dbeafe", color: G.blue, fontSize: 7, padding: "1px 4px", borderRadius: 3, marginLeft: 3 }}>Livreur</span>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, padding: "8px 10px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: G.blue }}>▶</span>
                <div style={{ flex: 1, height: 14, display: "flex", alignItems: "center", gap: 1 }}>
                  {[...Array(20)].map((_, i) => (
                    <div key={i} style={{ width: 2, height: 4 + ((i + 2) % 5) * 2, background: G.blue, borderRadius: 1 }} />
                  ))}
                </div>
                <span style={{ fontSize: 8, color: G.muted, fontWeight: 600 }}>0:12</span>
              </div>
            </div>
            <div style={{ fontSize: 7, color: G.muted, marginTop: 2 }}>15:10</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: G.greenMid, color: "#fff", display: "flex",
            alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11,
          }}>S</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: G.greenDark, marginBottom: 2 }}>
              Saliou closeur <span style={{ background: G.gold, color: G.greenDark, fontSize: 7, padding: "1px 4px", borderRadius: 3, marginLeft: 3 }}>Closer</span>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, padding: "7px 10px", fontSize: 11, color: G.dark, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>Salut la team 💪</div>
            <div style={{ fontSize: 7, color: G.muted, marginTop: 2 }}>15:11</div>
          </div>
        </div>
      </div>
      <div style={{
        background: "#fff", padding: "8px 10px",
        display: "flex", gap: 8, alignItems: "center",
        borderTop: `1px solid ${G.border}`,
      }}>
        <span style={{ fontSize: 16, color: G.muted }}>📷</span>
        <div style={{ flex: 1, background: "#f4f3ee", borderRadius: 16, padding: "6px 12px", fontSize: 10, color: G.muted }}>Message…</div>
        <span style={{ fontSize: 16, color: G.greenDark }}>🎤</span>
      </div>
    </PhoneFrame>
  );
}

function MockupGps() {
  return (
    <PhoneFrame>
      <div style={{ background: G.greenDark, padding: "10px 14px", color: "#fff" }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Teamly · GPS Live</div>
        <div style={{ display: "flex", gap: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: G.gold }}>4</div>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.6)" }}>Livraisons actives</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: G.gold }}>1</div>
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.6)" }}>Livreurs actifs</div>
          </div>
        </div>
      </div>
      <div style={{
        height: 140, background: "linear-gradient(135deg, #d4e8d8, #c9e1d6)",
        position: "relative", overflow: "hidden",
      }}>
        <svg viewBox="0 0 270 140" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <path d="M0 60 L270 70" stroke="#fff" strokeWidth="3" />
          <path d="M30 0 L40 140" stroke="#fff" strokeWidth="3" />
          <path d="M150 0 L170 140" stroke="#fff" strokeWidth="2" />
          <path d="M0 100 L270 110" stroke="#fff" strokeWidth="2" />
          <path d="M0 30 L270 35" stroke="#fff" strokeWidth="1.5" opacity="0.6" />
        </svg>
        <div style={{
          position: "absolute", top: 56, left: 110,
          background: G.gold, color: G.greenDark,
          borderRadius: "50%", width: 32, height: 32,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 900, boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          border: "3px solid #fff",
        }}>🏍️</div>
        <div style={{
          position: "absolute", top: 50, left: 104, width: 44, height: 44,
          borderRadius: "50%", background: G.gold + "44",
        }} />
        <div style={{
          position: "absolute", top: 8, left: 8,
          background: "rgba(255,255,255,0.95)", borderRadius: 6,
          padding: "3px 8px", fontSize: 8, fontWeight: 700, color: G.dark,
        }}>📍 Positions en temps réel</div>
        <div style={{
          position: "absolute", top: 8, right: 8,
          background: G.greenMid, color: "#fff", borderRadius: 6,
          padding: "3px 8px", fontSize: 8, fontWeight: 700,
        }}>1 actif</div>
        <div style={{
          position: "absolute", top: 92, left: 88,
          background: "#fff", borderRadius: 6,
          padding: "4px 8px", fontSize: 8, fontWeight: 700, color: G.dark,
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        }}>Ibou · Marbella → San Pedro</div>
      </div>
      <div style={{ padding: "10px 12px", background: "#fafafa" }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: G.dark, marginBottom: 6 }}>🏍️ LIVREURS</div>
        <div style={{
          background: "#fff", borderRadius: 8, padding: "8px 10px",
          marginBottom: 8, border: `1px solid ${G.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: G.dark }}>Ibou</div>
            <div style={{ fontSize: 8, color: G.greenMid, fontWeight: 600 }}>● GPS actif · Marbella</div>
          </div>
          <div style={{
            background: G.greenLight, color: G.greenDark, fontSize: 9,
            fontWeight: 800, padding: "3px 8px", borderRadius: 6,
          }}>5 liv.</div>
        </div>
        {[
          { n: "Saliou Mbaye", s: "Colis en main 📦", p: "20 000 CFA", c: G.gold },
          { n: "Saliou Mbaye", s: "Vers le client 🚀", p: "19 125 CFA", c: G.blue },
          { n: "Saliou Mbaye", s: "Chez le client 📍", p: "7 500 CFA", c: G.greenMid },
        ].map((o, i) => (
          <div key={i} style={{
            background: "#fff", borderRadius: 8, padding: "7px 10px",
            marginBottom: 4, border: `1px solid ${G.border}`,
            borderLeft: `3px solid ${o.c}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: G.dark }}>{o.n}</div>
              <div style={{ fontSize: 7, color: G.muted }}>{o.s}</div>
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, color: G.greenDark }}>{o.p}</div>
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

function MockupCompta() {
  return (
    <PhoneFrame>
      <div style={{ background: G.greenDark, padding: "10px 14px", color: "#fff" }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>Compta</div>
        <div style={{ fontSize: 7, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
          2026-04-01 → 2026-05-05 · Bénéfice net
        </div>
      </div>
      <div style={{ padding: 12, background: "#fafafa" }}>
        <div style={{
          background: `linear-gradient(135deg, ${G.greenDark}, ${G.greenMid})`,
          borderRadius: 12, padding: "14px 14px", color: "#fff",
          marginBottom: 10, textAlign: "center",
        }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>Bénéfice net</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: G.gold, margin: "2px 0" }}>163 640</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)" }}>CFA</div>
          <div style={{
            display: "inline-block", marginTop: 6, background: G.gold,
            color: G.greenDark, fontSize: 9, fontWeight: 800,
            padding: "3px 10px", borderRadius: 10,
          }}>Marge 61.8%</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
          {[
            ["CA", "265 000 CFA", G.greenDark],
            ["Coûts", "101 360 CFA", G.red],
            ["Pub", "0 CFA", G.muted],
            ["Livrées/Rej.", "12 / 0", G.greenMid],
          ].map(([l, v, c]) => (
            <div key={l} style={{
              background: "#fff", borderRadius: 8, padding: "8px 10px",
              border: `1px solid ${G.border}`,
            }}>
              <div style={{ fontSize: 8, color: G.muted, fontWeight: 600 }}>{l}</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: c, marginTop: 1 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, fontWeight: 800, color: G.dark, marginBottom: 6 }}>Produits</div>
        {[
          { n: "Sac à main", d: "10 livrés · 250 000 CFA", m: "66.0%", b: "165 000 CFA", c: G.greenDark, mc: G.greenMid },
          { n: "Bouchon rotatif", d: "2 livrés · 15 000 CFA", m: "-9.1%", b: "-1 360 CFA", c: G.red, mc: G.red },
          { n: "Adaptateur Carplay", d: "0 livrés", m: "—", b: "—", c: G.muted, mc: G.muted },
        ].map((p, i) => (
          <div key={i} style={{
            background: "#fff", borderRadius: 8, padding: "8px 10px",
            marginBottom: 4, border: `1px solid ${G.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: G.dark }}>{p.n}</div>
              <div style={{ fontSize: 7, color: G.muted, marginTop: 1 }}>{p.d}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: p.mc }}>{p.m}</div>
              <div style={{ fontSize: 8, color: p.c, fontWeight: 700 }}>{p.b}</div>
            </div>
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}

function MockupLivreur() {
  return (
    <PhoneFrame>
      <div style={{ background: G.greenDark, padding: "10px 14px", color: "#fff" }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>Mes Livraisons</div>
      </div>
      <div style={{ padding: 12, background: "#fafafa" }}>
        <div style={{
          background: "#fff", borderRadius: 12, padding: "12px",
          marginBottom: 10, border: `2px solid ${G.greenMid}`,
          boxShadow: "0 4px 12px rgba(46,139,87,0.15)",
        }}>
          <div style={{
            background: G.greenLight, color: G.greenDark, fontSize: 9,
            fontWeight: 800, padding: "4px 8px", borderRadius: 6,
            display: "inline-block", marginBottom: 8,
          }}>📍 Livreur chez le client · 17:12</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: G.gold, marginBottom: 4 }}>7 500 CFA</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: G.dark }}>Saliou Mbaye</div>
          <div style={{ fontSize: 9, color: G.muted, marginBottom: 10 }}>📦 Bouchon rotatif 360° · 🏍️ Ibou</div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            marginBottom: 10, padding: "6px 0",
            borderTop: `1px dashed ${G.border}`, borderBottom: `1px dashed ${G.border}`,
          }}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{
                width: 22, height: 22, borderRadius: "50%",
                background: G.greenMid, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800,
              }}>✓</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            <div style={{
              background: G.greenMid, color: "#fff", fontSize: 9,
              fontWeight: 800, padding: "6px", borderRadius: 6, textAlign: "center",
            }}>✅ Livré — Cash</div>
            <div style={{
              background: G.red, color: "#fff", fontSize: 9,
              fontWeight: 800, padding: "6px", borderRadius: 6, textAlign: "center",
            }}>❌ Rejeté</div>
            <div style={{
              background: G.muted, color: "#fff", fontSize: 9,
              fontWeight: 800, padding: "6px", borderRadius: 6, textAlign: "center",
            }}>⛔ Absent</div>
            <div style={{
              background: G.gold, color: G.greenDark, fontSize: 9,
              fontWeight: 800, padding: "6px", borderRadius: 6, textAlign: "center",
            }}>↩️ Report</div>
          </div>
        </div>
        <div style={{
          background: "#fff", borderRadius: 12, padding: "12px",
          border: `1px solid ${G.border}`, borderLeft: `3px solid ${G.gold}`,
        }}>
          <div style={{
            background: G.goldLight, color: "#854F0B", fontSize: 9,
            fontWeight: 800, padding: "4px 8px", borderRadius: 6,
            display: "inline-block", marginBottom: 8,
          }}>📦 Colis en main · Étape 3</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: G.gold, marginBottom: 4 }}>25 000 CFA</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: G.dark }}>Diallo</div>
          <div style={{ fontSize: 9, color: G.muted, marginBottom: 10 }}>📦 Sac à main · Keur Massar</div>
          <div style={{
            background: G.blue, color: "#fff", fontSize: 10,
            fontWeight: 800, padding: "8px", borderRadius: 8, textAlign: "center",
          }}>🚀 Je pars vers le client</div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function MockupWhatsApp() {
  return (
    <div style={{
      background: "#fff", borderRadius: 24, padding: "26px 22px",
      boxShadow: "0 30px 80px rgba(26,92,56,.18)", width: 290,
      fontFamily: "'DM Sans', sans-serif", border: `1px solid ${G.border}`,
    }}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 38, marginBottom: 10 }}>📱➡️📱</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: G.dark }}>Envoyer le message</div>
        <div style={{ fontSize: 12, color: G.muted, marginTop: 4, lineHeight: 1.4 }}>
          Choisissez comment envoyer la confirmation au client
        </div>
      </div>
      <div style={{
        background: "#25D366", borderRadius: 12, padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 11, marginBottom: 10, cursor: "pointer",
      }}>
        <span style={{ fontSize: 22 }}>💬</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Ouvrir WhatsApp</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.8)" }}>Ouvre l'app sur votre téléphone</div>
        </div>
      </div>
      <div style={{
        border: `1.5px solid ${G.greenLight}`, borderRadius: 12, padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 11, marginBottom: 10, cursor: "pointer",
      }}>
        <span style={{ fontSize: 17 }}>📋</span>
        <div style={{ fontSize: 14, fontWeight: 700, color: G.greenDark }}>Copier le message</div>
      </div>
      <div style={{
        background: "rgba(0,0,0,.05)", borderRadius: 10, padding: "10px",
        textAlign: "center", fontSize: 13, color: G.muted, fontWeight: 600, cursor: "pointer",
      }}>Fermer</div>
    </div>
  );
}

function MockupDesktopCommandes() {
  return (
    <div style={{
      width: "100%", maxWidth: 720, background: "#0d1f18",
      borderRadius: 14, overflow: "hidden",
      boxShadow: "0 50px 120px rgba(0,0,0,0.55)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ background: "#162a1f", padding: "10px 14px", display: "flex", alignItems: "center", gap: 7 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map(c => (
          <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
        ))}
        <div style={{
          flex: 1, textAlign: "center", fontSize: 10,
          color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)",
          borderRadius: 6, padding: "3px 12px", maxWidth: 220, margin: "0 auto",
        }}>teamlyecom.com</div>
      </div>
      <div style={{ display: "flex", height: 380 }}>
        <div style={{ width: 150, background: "#111f17", padding: "14px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          <Logo size={16} light />
          <div style={{ marginTop: 12, fontSize: 8, color: "rgba(255,255,255,0.4)", padding: "0 6px", fontWeight: 700, letterSpacing: 1 }}>NAVIGATION</div>
          {[
            ["⊞", "Dashboard", false],
            ["✓", "Cmdes à confirmer", false, "5"],
            ["🚚", "Cmdes à traiter", true, "3"],
            ["$", "Compta", false],
            ["📍", "Livreurs", false],
          ].map(([i, l, a, b]) => (
            <div key={l} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "6px 8px", borderRadius: 8,
              background: a ? `${G.greenDark}88` : "transparent",
              fontSize: 10, color: a ? G.gold : "rgba(255,255,255,0.55)",
              fontWeight: a ? 800 : 500, justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 11 }}>{i}</span>{l}
              </div>
              {b && <span style={{
                background: G.gold, color: G.greenDark, fontSize: 8,
                fontWeight: 800, padding: "1px 5px", borderRadius: 8,
              }}>{b}</span>}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: "14px 14px", overflow: "hidden", background: "#0d1f18" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>Commandes à traiter</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>Ma Boutique</div>
            </div>
            <div style={{
              fontSize: 10, color: G.greenDark, background: G.gold,
              padding: "5px 11px", borderRadius: 7, fontWeight: 800,
            }}>+ Commande</div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 4 }}>Statut de livraison</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
              {["Tout", "En attente", "En route 🚚", "Colis main 📦", "Vers client 🚀", "Chez client 📍"].map((t, i) => (
                <div key={t} style={{
                  fontSize: 8, padding: "3px 7px", borderRadius: 5,
                  background: i === 0 ? G.greenDark : "rgba(255,255,255,0.06)",
                  color: i === 0 ? G.gold : "rgba(255,255,255,0.55)",
                  fontWeight: i === 0 ? 800 : 500,
                }}>{t}</div>
              ))}
            </div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 4 }}>Résultat</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {["Encaissé ✅", "Rejeté ❌", "Absent 🚫"].map(t => (
                <div key={t} style={{
                  fontSize: 8, padding: "3px 7px", borderRadius: 5,
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.55)", fontWeight: 500,
                }}>{t}</div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {[
              { n: "Saliou Mbaye", p: "Adaptateur Carplay", price: "20 000 CFA" },
              { n: "Hhhhhh", p: "Sac à main", price: "25 000 CFA" },
              { n: "Saliou", p: "Sac à main", price: "25 000 CFA" },
            ].map((o, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.05)", borderRadius: 7,
                padding: "8px 10px", borderLeft: `3px solid ${G.greenMid}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{
                    fontSize: 8, color: G.greenMid, background: `${G.greenMid}22`,
                    padding: "2px 6px", borderRadius: 4, fontWeight: 800,
                  }}>Client confirmé ✅</span>
                  <span style={{ fontSize: 11, color: G.gold, fontWeight: 800 }}>{o.price}</span>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{o.n}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 5 }}>{o.p}</div>
                <div style={{
                  background: "#25D366", color: "#fff", fontSize: 8,
                  fontWeight: 800, padding: "4px 8px", borderRadius: 5,
                  display: "inline-block",
                }}>📱 Confirmer par WhatsApp</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MockupDesktopDashboard() {
  return (
    <div style={{
      width: "100%", maxWidth: 720, background: "#0d1f18",
      borderRadius: 14, overflow: "hidden",
      boxShadow: "0 50px 120px rgba(0,0,0,0.55)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ background: "#162a1f", padding: "10px 14px", display: "flex", alignItems: "center", gap: 7 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map(c => (
          <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
        ))}
        <div style={{
          flex: 1, textAlign: "center", fontSize: 10,
          color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)",
          borderRadius: 6, padding: "3px 12px", maxWidth: 220, margin: "0 auto",
        }}>teamlyecom.com</div>
      </div>
      <div style={{ display: "flex", height: 400 }}>
        <div style={{ width: 150, background: "#111f17", padding: "14px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          <Logo size={16} light />
          <div style={{ marginTop: 12, fontSize: 8, color: "rgba(255,255,255,0.4)", padding: "0 6px", fontWeight: 700, letterSpacing: 1 }}>NAVIGATION</div>
          {[
            ["⊞", "Dashboard", true],
            ["✓", "À confirmer"],
            ["🚚", "À traiter", false, "3"],
            ["$", "Compta"],
            ["📍", "Livreurs"],
            ["👥", "Clients"],
            ["💬", "Équipe Chat"],
            ["📦", "Produits"],
          ].map(([i, l, a, b]) => (
            <div key={l} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "5px 8px", borderRadius: 7,
              background: a ? `${G.greenDark}88` : "transparent",
              fontSize: 9, color: a ? G.gold : "rgba(255,255,255,0.55)",
              fontWeight: a ? 800 : 500, justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10 }}>{i}</span>{l}
              </div>
              {b && <span style={{
                background: G.gold, color: G.greenDark, fontSize: 7,
                fontWeight: 800, padding: "1px 5px", borderRadius: 8,
              }}>{b}</span>}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: "14px 14px", background: "#0d1f18", overflow: "hidden" }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>Dashboard</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>
              Bonjour, <b style={{ color: G.gold }}>Saliou Mbaye</b> 👋 · Ma Boutique · mardi 5 mai
            </div>
          </div>
          <div style={{
            background: `linear-gradient(135deg, ${G.greenDark}, ${G.greenMid})`,
            borderRadius: 8, padding: "10px 14px", marginBottom: 10,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.65)", fontWeight: 700, letterSpacing: 1 }}>CA DU JOUR</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: G.gold }}>265 000 CFA</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)" }}>Bénéf. total</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: G.gold }}>163 640 CFA</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5, marginBottom: 8 }}>
            {[
              { i: "📦", v: "27", l: "Total", c: G.greenDark },
              { i: "✅", v: "12", l: "Livrées", c: G.greenMid },
              { i: "❌", v: "5", l: "Rejetées", c: G.red },
              { i: "🏍️", v: "1", l: "En route", c: G.blue },
            ].map(s => (
              <div key={s.l} style={{
                background: "rgba(255,255,255,0.04)", borderRadius: 6,
                padding: "6px 8px", textAlign: "center",
              }}>
                <div style={{ fontSize: 10 }}>{s.i}</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 7, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "8px", marginBottom: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.55)" }}>Taux de livraison</span>
                  <span style={{ fontSize: 9, color: G.gold, fontWeight: 800 }}>44%</span>
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 3, marginTop: 4 }}>
                  <div style={{ width: "44%", height: "100%", background: G.gold, borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "8px" }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", fontWeight: 800, marginBottom: 4 }}>💰 CA PAR PRODUIT</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>Sac à main</span>
                  <span style={{ fontSize: 9, color: G.gold, fontWeight: 800 }}>250 000 CFA</span>
                </div>
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "8px" }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", fontWeight: 800, marginBottom: 6 }}>⚡ ACTIONS RAPIDES</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {["+ Commande", "+ Produit", "Clients", "Tracking"].map(a => (
                  <div key={a} style={{
                    background: G.gold, color: G.greenDark, fontSize: 8,
                    fontWeight: 800, padding: "4px 6px", borderRadius: 4, textAlign: "center",
                  }}>{a}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockupTracking() {
  return (
    <PhoneFrame>
      <div style={{ background: "#fff", padding: "12px 14px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 7, color: G.muted, fontWeight: 700, letterSpacing: 1.5 }}>SUIVI</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: G.dark }}>Ma Boutique</div>
          </div>
          <div style={{ fontSize: 8, color: G.greenMid, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: G.greenMid }}/> EN LIGNE
          </div>
        </div>
        <div style={{ background: G.goldLight, borderRadius: 10, padding: "12px", textAlign: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 18, marginBottom: 4 }}>📦</div>
          <div style={{ fontSize: 11, fontWeight: 900, color: G.gold }}>Colis récupéré</div>
          <div style={{ fontSize: 8, color: "#92400E", marginTop: 2 }}>Le livreur a ton colis · Direction chez toi</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, padding: "0 4px" }}>
          {[
            { l: "Confirmée", on: true },
            { l: "Préparée", on: true },
            { l: "En route", on: true },
            { l: "À ta porte", on: false },
            { l: "Livrée", on: false },
          ].map((s, i, arr) => (
            <div key={i} style={{ flex: 1, textAlign: "center", position: "relative" }}>
              {i < arr.length - 1 && (
                <div style={{ position: "absolute", top: 7, left: "55%", right: "-45%", height: 2, background: arr[i+1].on ? G.greenMid : "#E5E7EB" }}/>
              )}
              <div style={{
                width: 14, height: 14, borderRadius: "50%", margin: "0 auto",
                background: s.on ? G.greenMid : "#fff",
                border: `2px solid ${s.on ? G.greenMid : "#E5E7EB"}`,
                color: "#fff", fontSize: 8, fontWeight: 900,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", zIndex: 1,
              }}>{s.on ? "✓" : ""}</div>
              <div style={{ fontSize: 6, fontWeight: 700, color: s.on ? G.greenMid : G.muted, marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ background: G.dark, color: "#fff", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ fontSize: 7, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: 1 }}>MONTANT À PRÉPARER</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginTop: 2 }}>8 500 <span style={{ fontSize: 9, color: "rgba(255,255,255,0.7)" }}>CFA</span></div>
          <div style={{ fontSize: 7, color: "rgba(255,255,255,0.5)" }}>Paiement en liquide à la livraison</div>
        </div>
        <div style={{ background: G.greenPale, borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: G.greenMid, color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>I</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: G.dark }}>Ibou · Ton livreur</div>
            <div style={{ fontSize: 7, color: G.muted }}>46 55 65 64</div>
          </div>
          <div style={{ background: G.greenMid, color: "#fff", fontSize: 9, fontWeight: 800, padding: "4px 7px", borderRadius: 6 }}>📞</div>
          <div style={{ background: "#25D366", color: "#fff", fontSize: 9, fontWeight: 800, padding: "4px 7px", borderRadius: 6 }}>💬</div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function MockupReviews() {
  return (
    <PhoneFrame>
      <div style={{ background: "#fff", padding: "16px 16px 18px", textAlign: "center" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", margin: "0 auto 8px",
          border: `2.5px solid ${G.greenMid}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, color: G.greenMid,
        }}>✓</div>
        <div style={{ fontSize: 14, fontWeight: 900, color: G.dark, marginBottom: 3 }}>Commande livrée</div>
        <div style={{ fontSize: 8, color: G.muted, marginBottom: 14 }}>Merci ! Ton avis nous aide à nous améliorer.</div>
        {[
          { icon: "📦", title: "Le produit", desc: "Es-tu satisfait du produit ?", fill: 5 },
          { icon: "🚴", title: "La livraison", desc: "Le livreur a-t-il été aimable ?", fill: 4 },
          { icon: "📞", title: "L'appel", desc: "Comment s'est passé l'appel ?", fill: 5 },
        ].map((r, idx) => (
          <div key={idx} style={{ textAlign: "left", paddingBottom: 10, marginBottom: 10, borderBottom: idx<2?`1px solid ${G.border}`:"none" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: G.dark, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 11 }}>{r.icon}</span> {r.title}
            </div>
            <div style={{ fontSize: 7, color: G.muted, marginBottom: 4 }}>{r.desc}</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[1,2,3,4,5].map(i=>(
                <span key={i} style={{ fontSize: 14, color: i<=r.fill ? G.gold : "#E5E7EB" }}>★</span>
              ))}
            </div>
          </div>
        ))}
        <div style={{ background: G.greenMid, color: "#fff", borderRadius: 8, padding: "8px 0", fontSize: 10, fontWeight: 800, marginTop: 4 }}>
          Envoyer mon avis
        </div>
      </div>
    </PhoneFrame>
  );
}

function FeatureSection({ id, kicker, title, titleAccent, desc, points, mockup, reverse, bg }) {
  return (
    <section id={id} style={{ padding: "84px 28px", background: bg || G.offwhite }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div className="feat-row" style={{
          display: "flex", alignItems: "center", gap: 64,
          flexDirection: reverse ? "row-reverse" : "row",
          flexWrap: "wrap", justifyContent: "center",
        }}>
          <div className="feat-text" style={{ flex: 1, minWidth: 280, maxWidth: 480 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: G.greenMid,
              letterSpacing: 2, marginBottom: 12, textTransform: "uppercase",
            }}>{kicker}</div>
            <h2 style={{
              fontSize: 34, fontWeight: 900, color: G.dark,
              letterSpacing: -1, marginBottom: 16, lineHeight: 1.15,
            }}>
              {title}{titleAccent && <><br /><span style={{ color: G.greenMid }}>{titleAccent}</span></>}
            </h2>
            <p style={{ fontSize: 16, color: G.muted, lineHeight: 1.65, marginBottom: 24 }}>{desc}</p>
            <div className="check-list" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {points.map(p => <CheckLine key={p}>{p}</CheckLine>)}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
            {mockup}
          </div>
        </div>
      </div>
    </section>
  );
}

const PRICE_TABLE = {
  XOF: { unit: "CFA / mois", basic: "13 000", pro: "20 000", scale: "36 000" },
  EUR: { unit: "€ / mois",   basic: "20",     pro: "30",     scale: "55" },
  USD: { unit: "$ / mois",   basic: "22",     pro: "33",     scale: "60" },
};

// Detección de moneda por timezone del navegador (sin API externa, sin permisos)
function detectCurrencyByTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    // Países de la zona Franco CFA (BCEAO + BEAC) → XOF
    const cfaZones = ["Dakar","Abidjan","Bamako","Ouagadougou","Niamey","Lome","Cotonou","Bissau","Conakry","Nouakchott","Douala","Libreville","Brazzaville","Bangui","Ndjamena","Malabo","Sao_Tome"];
    if (cfaZones.some(z => tz.includes(z))) return "XOF";
    if (tz.startsWith("Europe/")) return "EUR";
    return "USD";
  } catch (e) {
    return "XOF";
  }
}

const PLANS = [
  {
    name: "Gratuit", badge: "14 JOURS D'ESSAI", priceKey: null,
    tagline: "Pour découvrir Teamly", summary: "30 cmd · 2 membres",
    highlight: false, cta: "Activer Gratuit",
    features: [
      { ok: true, label: "2 membres" },
      { ok: true, label: "30 commandes / mois" },
      { ok: true, label: "Suivi des livraisons" },
      { ok: true, label: "Chat équipe interne" },
      { ok: false, label: "GPS livreur temps réel" },
      { ok: false, label: "Boutique connectée" },
      { ok: false, label: "WhatsApp automatique" },
      { ok: false, label: "Comptabilité & marges" },
    ],
  },
  {
    name: "Basic", badge: "LE PLUS POPULAIRE", priceKey: "basic",
    tagline: "Pour démarrer", summary: "100 cmd · 3 membres · 1 boutique",
    highlight: true, cta: "Choisir Basic",
    features: [
      { ok: true, label: "3 membres (Admin + Closer + Livreur)" },
      { ok: true, label: "100 commandes / mois" },
      { ok: true, label: "1 boutique connectée" },
      { ok: true, label: "Suivi commande par le client" },
      { ok: true, label: "Avis client après livraison" },
      { ok: true, label: "Confirmation WhatsApp auto" },
      { ok: true, label: "GPS livreur temps réel" },
      { ok: true, label: "Comptabilité & marges" },
    ],
  },
  {
    name: "Pro", badge: "POUR LES ÉQUIPES", priceKey: "pro",
    tagline: "En croissance", summary: "2000 cmd · 5 membres · 2 boutiques",
    highlight: false, cta: "Activer Pro",
    features: [
      { ok: true, label: "5 membres · 3 rôles" },
      { ok: true, label: "2 000 commandes / mois" },
      { ok: true, label: "2 boutiques connectées" },
      { ok: true, label: "Toutes les fonctions Basic" },
      { ok: true, label: "Suivi commande par le client" },
      { ok: true, label: "Avis client après livraison" },
      { ok: true, label: "Rapports avancés" },
      { ok: true, label: "Export Excel clients" },
    ],
  },
  {
    name: "Scale", badge: "GRANDES ÉQUIPES", priceKey: "scale",
    tagline: "Sans limites", summary: "Illimité · 4 boutiques",
    highlight: false, cta: "Activer Scale",
    features: [
      { ok: true, label: "Membres illimités" },
      { ok: true, label: "Commandes illimitées" },
      { ok: true, label: "4 boutiques connectées" },
      { ok: true, label: "Toutes les fonctions Pro" },
      { ok: true, label: "Suivi commande par le client" },
      { ok: true, label: "Avis client après livraison" },
      { ok: true, label: "Support prioritaire 24/7" },
      { ok: true, label: "Multi-pays" },
    ],
  },
];

export default function TeamlyLanding() {
  const [scrolled, setScrolled] = useState(false);
  const [currency, setCurrency] = useState(() => detectCurrencyByTimezone());
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);
  const prices = PRICE_TABLE[currency];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: G.offwhite, color: G.text, overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        .btn-gold{background:${G.gold};color:${G.greenDark};font-weight:800;border:none;border-radius:12px;padding:13px 26px;font-size:14px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:transform .15s,box-shadow .15s;}
        .btn-gold:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(240,165,0,.35);}
        .btn-outline{background:transparent;color:${G.white};font-weight:700;border:2px solid rgba(255,255,255,.3);border-radius:12px;padding:11px 22px;font-size:14px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;}
        .btn-outline:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.6);}
        @media(max-width:900px){
          .hero-grid{flex-direction:column!important;text-align:center!important;}
          .hero-ctas{justify-content:center!important;}
          .pricing-grid{grid-template-columns:1fr 1fr!important;}
          .roles-grid{grid-template-columns:1fr!important;}
          .nav-links{display:none!important;}
          .hero-title{font-size:36px!important;}
          .feat-row{flex-direction:column!important;text-align:center!important;}
          .feat-text{text-align:center!important;}
          .check-list{align-items:center!important;}
        }
        @media(max-width:540px){
          .pricing-grid{grid-template-columns:1fr!important;}
          .hero-title{font-size:28px!important;}
          .stats-row{gap:24px!important;}
          .countries-row{gap:14px!important;font-size:12px!important;}
        }
      `}</style>

      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: scrolled ? `${G.greenDark}f5` : G.greenDark,
        backdropFilter: "blur(14px)",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,.08)" : "none",
        transition: "all .3s",
      }}>
        <div style={{
          maxWidth: 1180, margin: "0 auto", padding: "0 28px", height: 62,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <Logo size={25} light />
          <div className="nav-links" style={{ display: "flex", gap: 26 }}>
            {[["Fonctionnalités", "#chat"], ["WhatsApp", "#whatsapp"], ["PC", "#desktop"], ["Tarifs", "#tarifs"]].map(([l, h]) => (
              <a key={l} href={h} style={{
                fontSize: 14, color: "rgba(255,255,255,.7)",
                textDecoration: "none", fontWeight: 500,
              }}>{l}</a>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="/dashboard" style={{
              fontSize: 13, color: "rgba(255,255,255,.65)",
              textDecoration: "none", fontWeight: 500,
            }}>Connexion</a>
            <a href="/dashboard?signup=1" style={{ textDecoration: "none" }}><button className="btn-gold" style={{ padding: "9px 18px", fontSize: 13 }}>Commencer →</button></a>
          </div>
        </div>
      </nav>

      <section style={{
        background: `linear-gradient(155deg, ${G.greenDark} 0%, #0d3320 55%, #091f14 100%)`,
        padding: "70px 28px 90px", position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, right: -100, width: 480, height: 480,
          borderRadius: "50%", background: `radial-gradient(circle,${G.gold}15 0%,transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -60, left: -40, width: 280, height: 280,
          borderRadius: "50%", background: `radial-gradient(circle,${G.greenMid}20 0%,transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div className="hero-grid" style={{
          maxWidth: 1180, margin: "0 auto",
          display: "flex", alignItems: "center", gap: 56, position: "relative",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 18,
              background: `${G.gold}20`, borderRadius: 20, padding: "5px 14px",
              border: `1px solid ${G.gold}40`,
            }}>
              <span style={{ fontSize: 12, color: G.gold, fontWeight: 700 }}>
                Plateforme SaaS COD · Afrique de l'Ouest
              </span>
            </div>
            <h1 className="hero-title" style={{
              fontSize: 50, fontWeight: 900, color: "#fff",
              lineHeight: 1.07, letterSpacing: -1.5, marginBottom: 18,
            }}>
              Enfin, votre équipe<br />
              <span style={{ color: G.gold }}>e-commerce</span><br />
              synchronisée.
            </h1>
            <div style={{
              display: "inline-block", fontSize: 13, color: "rgba(255,255,255,0.5)",
              background: "rgba(255,255,255,0.06)", borderRadius: 6,
              padding: "4px 12px", marginBottom: 20, fontWeight: 600,
            }}>🔗 www.teamlyecom.com</div>
            <p style={{
              fontSize: 17, color: "rgba(255,255,255,.65)", lineHeight: 1.65,
              maxWidth: 460, marginBottom: 28,
            }}>
              Admin, Closer et Livreur — une seule plateforme. Chaque commande confirmée, livrée et encaissée plus vite.
            </p>
            <div className="hero-ctas" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a href="/dashboard?signup=1" style={{ textDecoration: "none" }}><button className="btn-gold" style={{ fontSize: 15, padding: "14px 28px" }}>
                Commencer gratuitement →
              </button></a>
              <a href="https://wa.me/34643164129" style={{ textDecoration: "none" }}>
                <button className="btn-outline">💬 WhatsApp</button>
              </a>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <MockupDashboard />
          </div>
        </div>
      </section>

      <div style={{
        background: G.greenDark, padding: "20px 28px",
        borderBottom: "1px solid rgba(255,255,255,.07)",
      }}>
        <div className="stats-row" style={{
          maxWidth: 1180, margin: "0 auto",
          display: "flex", justifyContent: "center", gap: 64, flexWrap: "wrap",
        }}>
          {[["500+", "Boutiques actives"], ["+30%", "Taux de livraison"], ["3", "Rôles intégrés"]].map(([v, l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: G.gold }}>{v}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 2, fontWeight: 500 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: G.greenPale, padding: "28px 28px", borderBottom: `1px solid ${G.border}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: G.greenMid,
            letterSpacing: 2, marginBottom: 14, textTransform: "uppercase",
          }}>Vendeurs actifs en</div>
          <div className="countries-row" style={{
            display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap",
          }}>
            {[["🇸🇳", "Sénégal"], ["🇨🇮", "Côte d'Ivoire"], ["🇲🇱", "Mali"], ["🇲🇦", "Maroc"], ["🇪🇸", "Espagne"]].map(([f, n]) => (
              <div key={n} style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 15, fontWeight: 700, color: G.dark,
              }}>
                <span style={{ fontSize: 22 }}>{f}</span>{n}
              </div>
            ))}
          </div>
        </div>
      </div>

      <FeatureSection
        id="chat"
        kicker="Chat d'équipe"
        title="Toute votre équipe"
        titleAccent="dans un seul endroit."
        desc="Fini les groupes WhatsApp désorganisés. Admin, Closer et Livreur communiquent dans un chat interne structuré par rôle, directement dans l'app."
        points={[
          "Messages texte, audio et photos",
          "Rôles visibles en temps réel",
          "Notifications instantanées",
          "Historique complet des conversations",
        ]}
        mockup={<MockupChat />}
        bg={G.offwhite}
      />

      <FeatureSection
        id="gps"
        kicker="GPS Livreur"
        title="Suivez vos livreurs"
        titleAccent="en temps réel."
        desc="Voyez sur une carte live où se trouve chaque livreur, quelles commandes il transporte et leur valeur. Zéro appel, zéro confusion."
        points={[
          "Position GPS en direct sur carte",
          "Statut de chaque livraison",
          "Alerte automatique au client à l'approche",
          "Valeur totale en transit visible",
        ]}
        mockup={<MockupGps />}
        reverse
        bg={G.greenPale}
      />

      <FeatureSection
        id="compta"
        kicker="Comptabilité automatique"
        title="Vos marges,"
        titleAccent="calculées toutes seules."
        desc="La section Compta se remplit automatiquement à partir des commandes. Vous n'entrez que votre budget pub. Tout le reste est calculé."
        points={[
          "Bénéfice net en temps réel",
          "Marge par produit calculée",
          "CA / Coûts / Pub automatique",
          "Rapport livraisons / rejections",
        ]}
        mockup={<MockupCompta />}
        bg={G.offwhite}
      />

      <FeatureSection
        id="livreur"
        kicker="Espace Livreur"
        title="Le livreur sait"
        titleAccent="toujours quoi faire."
        desc="Chaque livreur voit ses commandes, le statut étape par étape et peut encaisser ou rejeter en un seul tap. Zéro erreur possible."
        points={[
          "Flux guidé étape par étape",
          "Encaisser / Rejeter / Absent en 1 tap",
          "Contact client direct depuis l'app",
          "Synchro temps réel avec l'Admin",
        ]}
        mockup={<MockupLivreur />}
        reverse
        bg={G.greenPale}
      />

      <FeatureSection
        id="whatsapp"
        kicker="WhatsApp intégré"
        title="Confirmation client en"
        titleAccent="1 tap, sans copier-coller."
        desc="Dès qu'une commande est confirmée, un message WhatsApp personnalisé est prêt pour le client. Tu ouvres WhatsApp ou tu copies le message — c'est tout."
        points={[
          "Message personnalisé avec nom, produit, prix",
          "Ouvre WhatsApp directement sur le numéro",
          "Option « copier le message » si préféré",
          "Disponible pour Admin et Closer",
        ]}
        mockup={<MockupWhatsApp />}
        bg={G.offwhite}
      />

      <FeatureSection
        id="tracking"
        kicker="Suivi client"
        title="Le client voit sa commande"
        titleAccent="en temps réel."
        desc="Chaque client reçoit un lien de suivi unique. Il voit l'étape actuelle de sa livraison, le montant à préparer et peut appeler le livreur directement — sans appel à ton équipe."
        points={[
          "Page de suivi avec barre de progression live",
          "Montant exact à préparer en cash affiché",
          "Contact direct livreur (appel + WhatsApp)",
          "Rassure le client, réduit les appels entrants",
        ]}
        mockup={<MockupTracking />}
        reverse
        bg={G.greenPale}
      />

      <FeatureSection
        id="avis"
        kicker="Avis & réputation"
        title="Récolte des avis"
        titleAccent="après chaque livraison."
        desc="À la livraison, un mini-formulaire propose au client de noter le produit, la livraison et l'appel de confirmation. Tu identifies en un coup d'œil ce qui marche et ce qui freine tes ventes."
        points={[
          "Note 1 à 5 étoiles sur 3 critères clés",
          "Affichage public optionnel sur la boutique",
          "Détecte les livreurs ou closers à former",
          "Preuves sociales pour booster la conversion",
        ]}
        mockup={<MockupReviews />}
        bg={G.offwhite}
      />

      <section id="desktop" style={{ padding: "84px 28px", background: G.greenPale }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: G.greenMid,
            letterSpacing: 2, marginBottom: 12, textTransform: "uppercase",
          }}>Disponible sur PC</div>
          <h2 style={{
            fontSize: 36, fontWeight: 900, color: G.dark,
            letterSpacing: -1, marginBottom: 16, lineHeight: 1.15,
          }}>
            Gérez tout depuis<br />
            <span style={{ color: G.greenMid }}>votre ordinateur.</span>
          </h2>
          <p style={{
            fontSize: 16, color: G.muted, maxWidth: 580,
            margin: "0 auto 28px", lineHeight: 1.6,
          }}>
            Teamly est accessible sur navigateur web — PC, Mac, tablette. La vue desktop offre un dashboard étendu, une gestion des commandes en colonnes et des filtres avancés.
          </p>
          <div style={{
            display: "flex", justifyContent: "center", flexWrap: "wrap",
            gap: 20, marginBottom: 32, maxWidth: 720, margin: "0 auto 32px",
          }}>
            {[
              "Sidebar de navigation complète",
              "Filtres avancés : statut + résultat",
              "Accessible sur tous les navigateurs",
              "Aucune installation requise",
            ].map(p => (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: G.greenMid, fontWeight: 800 }}>✓</span>
                <span style={{ fontSize: 13, color: G.muted }}>{p}</span>
              </div>
            ))}
          </div>
          <a href="/dashboard?signup=1" style={{ textDecoration: "none" }}><button className="btn-gold" style={{ marginBottom: 40 }}>Ouvrir sur PC →</button></a>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <MockupDesktopCommandes />
          </div>
        </div>
      </section>

      <section style={{ padding: "84px 28px", background: G.offwhite }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div className="feat-row" style={{
            display: "flex", alignItems: "center", gap: 64, flexWrap: "wrap", justifyContent: "center",
          }}>
            <div className="feat-text" style={{ flex: 1, minWidth: 280, maxWidth: 480 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: G.greenMid,
                letterSpacing: 2, marginBottom: 12, textTransform: "uppercase",
              }}>Dashboard Admin</div>
              <h2 style={{
                fontSize: 34, fontWeight: 900, color: G.dark,
                letterSpacing: -1, marginBottom: 16, lineHeight: 1.15,
              }}>
                Vision complète<br />
                <span style={{ color: G.greenMid }}>de votre boutique.</span>
              </h2>
              <p style={{ fontSize: 16, color: G.muted, lineHeight: 1.65, marginBottom: 24 }}>
                Le dashboard Admin centralise CA du jour, bénéfice, taux de livraison, CA par produit et alertes en temps réel. Tout sur une seule page.
              </p>
              <div className="check-list" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  "CA du jour et bénéfice net",
                  "Taux de livraison en temps réel",
                  "CA par produit avec marges",
                  "Alertes commandes sans livreur",
                  "Commandes récentes en un coup d'œil",
                ].map(p => <CheckLine key={p}>{p}</CheckLine>)}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
              <MockupDesktopDashboard />
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "84px 28px", background: G.greenPale }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: G.greenMid,
              letterSpacing: 2, marginBottom: 12, textTransform: "uppercase",
            }}>3 rôles · 1 plateforme</div>
            <h2 style={{
              fontSize: 36, fontWeight: 900, color: G.dark,
              letterSpacing: -1, lineHeight: 1.15,
            }}>
              Chaque membre a sa propre vue<br />
              <span style={{ color: G.greenMid }}>dans l'application.</span>
            </h2>
          </div>
          <div className="roles-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20,
          }}>
            {[
              {
                icon: "👑", title: "Admin", color: G.gold,
                desc: "Vision complète : dashboard, commandes, équipe, stock, compta, GPS livreurs.",
                points: ["Dashboard live", "GPS des livreurs", "Comptabilité automatique", "Gestion de l'équipe", "Stocks & produits"],
              },
              {
                icon: "📞", title: "Closer", color: G.greenMid,
                desc: "Confirme les commandes, contacte les clients et envoie les confirmations WhatsApp.",
                points: ["File de commandes", "WhatsApp automatique", "Fiche client complète", "Chat interne", "Suivi des livraisons"],
              },
              {
                icon: "🏍️", title: "Livreur", color: G.blue,
                desc: "Voit ses livraisons, l'adresse GPS, peut encaisser ou rejeter en un tap.",
                points: ["Livraisons assignées", "GPS & adresse client", "Encaisser / Rejeter", "Appel direct client", "Chat interne"],
              },
            ].map(r => (
              <div key={r.title} style={{
                background: "#fff", borderRadius: 16, padding: "28px 24px",
                border: `1px solid ${G.border}`,
                boxShadow: "0 4px 12px rgba(26,92,56,0.04)",
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: r.color + "22", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 28, marginBottom: 18,
                }}>{r.icon}</div>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: G.dark, marginBottom: 8 }}>{r.title}</h3>
                <p style={{ fontSize: 14, color: G.muted, lineHeight: 1.6, marginBottom: 18 }}>{r.desc}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {r.points.map(p => (
                    <div key={p} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: r.color, fontWeight: 800, fontSize: 13 }}>✓</span>
                      <span style={{ fontSize: 13, color: G.text }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tarifs" style={{ padding: "96px 28px", background: G.offwhite }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: G.greenMid,
              letterSpacing: 2, marginBottom: 10, textTransform: "uppercase",
            }}>Tarifs</div>
            <h2 style={{
              fontSize: 38, fontWeight: 900, color: G.dark,
              letterSpacing: -1, marginBottom: 14,
            }}>Simple et transparent</h2>
            <p style={{ fontSize: 16, color: G.muted }}>
              {currency === "XOF"
                ? "Payez en CFA via Wave ou Orange Money. Sans engagement."
                : "Paiement par carte bancaire. Sans engagement."}
            </p>
          </div>
          <div className="pricing-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(4,1fr)",
            gap: 14, alignItems: "start",
          }}>
            {PLANS.map((plan, i) => (
              <div key={i} style={{
                background: plan.highlight ? G.greenDark : G.white,
                borderRadius: 20, padding: "28px 20px",
                border: plan.highlight ? "none" : `1px solid ${G.border}`,
                position: "relative",
                transform: plan.highlight ? "scale(1.03)" : "none",
                boxShadow: plan.highlight ? `0 24px 64px rgba(26,92,56,.28)` : "none",
              }}>
                {plan.badge && (
                  <div style={{
                    position: "absolute", top: -11, left: "50%",
                    transform: "translateX(-50%)",
                    background: plan.highlight ? G.gold : G.greenDark,
                    color: plan.highlight ? G.greenDark : G.white,
                    fontSize: 9, fontWeight: 900, padding: "4px 12px",
                    borderRadius: 20, whiteSpace: "nowrap",
                  }}>{plan.badge}</div>
                )}
                <div style={{
                  fontSize: 18, fontWeight: 900,
                  color: plan.highlight ? G.white : G.dark, marginBottom: 4,
                }}>{plan.name}</div>
                <div style={{
                  fontSize: 11,
                  color: plan.highlight ? "rgba(255,255,255,.55)" : G.muted,
                  marginBottom: 14,
                }}>{plan.tagline}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 32, fontWeight: 900,
                    color: plan.highlight ? G.gold : G.dark,
                  }}>{plan.priceKey ? prices[plan.priceKey] : "0"}</span>
                  {plan.priceKey && <span style={{
                    fontSize: 11,
                    color: plan.highlight ? "rgba(255,255,255,.5)" : G.muted,
                  }}>{prices.unit}</span>}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  color: plan.highlight ? G.gold : G.greenMid,
                  background: plan.highlight ? `${G.gold}18` : G.greenLight,
                  borderRadius: 8, padding: "4px 8px",
                  marginBottom: 18, display: "inline-block",
                }}>{plan.summary}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
                  {plan.features.map((f, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                      <Check ok={f.ok} />
                      <span style={{
                        fontSize: 12,
                        color: plan.highlight
                          ? (f.ok ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.3)")
                          : (f.ok ? G.text : "#bbb"),
                        lineHeight: 1.4,
                      }}>{f.label}</span>
                    </div>
                  ))}
                </div>
                <a href="/dashboard?signup=1" style={{ textDecoration: "none", display: "block" }}>
                  <button style={{
                    width: "100%", padding: "12px", borderRadius: 12,
                    fontSize: 13, fontWeight: 800, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif", border: "none",
                    background: plan.highlight ? G.gold : G.greenDark,
                    color: plan.highlight ? G.greenDark : G.white,
                    transition: "opacity .15s",
                  }}>{plan.cta}</button>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{
        background: `linear-gradient(155deg, ${G.greenDark} 0%, #0d3320 100%)`,
        padding: "80px 28px", textAlign: "center",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{
            fontSize: 36, fontWeight: 900, color: G.white,
            letterSpacing: -1, marginBottom: 16,
          }}>Prêt à scaler ton business ?</h2>
          <p style={{
            fontSize: 16, color: "rgba(255,255,255,.6)", marginBottom: 32,
          }}>
            Rejoins les 500+ boutiques qui gèrent leurs équipes avec Teamly. 14 jours gratuits, sans carte bancaire.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/dashboard?signup=1" style={{ textDecoration: "none" }}><button className="btn-gold" style={{ fontSize: 16, padding: "15px 32px" }}>
              Commencer gratuitement
            </button></a>
            <a href="https://wa.me/34643164129" style={{ textDecoration: "none" }}>
              <button className="btn-outline" style={{ fontSize: 15, padding: "13px 24px" }}>
                💬 WhatsApp
              </button>
            </a>
          </div>
          <div style={{ marginTop: 24, fontSize: 13, color: "rgba(255,255,255,.3)" }}>
            Mobile · PC · Tablette · Support WhatsApp inclus
          </div>
        </div>
      </section>

      <footer style={{ background: G.dark }}>
        <div style={{
          maxWidth: 1180, margin: "0 auto", padding: "28px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 14,
        }}>
          <Logo size={22} light />
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {["Fonctionnalités", "Tarifs", "Support", "Confidentialité"].map(l => (
              <a key={l} href="#" style={{
                fontSize: 12, color: "rgba(255,255,255,.35)", textDecoration: "none",
              }}>{l}</a>
            ))}
          </div>
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "flex-end", gap: 3,
          }}>
            <a href="https://wa.me/34643164129" style={{
              fontSize: 12, color: "rgba(255,255,255,.45)", textDecoration: "none",
            }}>+34 643 16 41 29</a>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,.2)" }}>
              © 2026 Teamly · Tous droits réservés
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
