import { useState } from "react";
import {
  Home,
  DollarSign,
  Monitor,
  ShoppingCart,
  Tag,
  BarChart3,
  Users,
  ChevronDown,
  ChevronsRight,
  TrendingUp,
  Activity,
  Package,
  Bell,
  Settings,
  HelpCircle,
  User,
  Zap,
  MessageSquare,
} from "lucide-react";
import { useLocation } from "wouter";

const GOLD = "#d4af37";
const LOGO = "https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/99dcde2e-c976-4379-999c-7de3e02359e1/1777617002176-878b9477/LITHOVEX_LOGO.png";

export default function AdminDashboard() {
  return (
    <div className="flex min-h-screen w-full" style={{ background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Maple Mono', 'Fira Mono', monospace" }}>
      <Sidebar />
      <MainContent />
    </div>
  );
}

function Sidebar() {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState("Dashboard");
  const [, navigate] = useLocation();

  return (
    <nav
      style={{
        width: open ? 260 : 64,
        transition: "width 0.3s ease",
        background: "rgba(16,16,26,0.95)",
        borderRight: "1px solid rgba(212,175,55,0.12)",
        backdropFilter: "blur(20px)",
        flexShrink: 0,
      }}
      className="sticky top-0 h-screen overflow-hidden flex flex-col relative"
    >
      {/* Logo */}
      <div style={{ borderBottom: "1px solid rgba(212,175,55,0.12)", padding: "20px 12px 16px" }}>
        <div className="flex items-center gap-3 cursor-pointer rounded-xl p-2" style={{ background: "rgba(212,175,55,0.04)" }}>
          <img src={LOGO} alt="LITHOVEX" style={{ height: 36, width: 36, objectFit: "contain", flexShrink: 0 }} />
          {open && (
            <div style={{ opacity: 1, transition: "opacity 0.2s" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: GOLD, fontFamily: "'Oxanium', sans-serif", textTransform: "uppercase" }}>
                LITHOVEX
              </span>
              <span style={{ display: "block", fontSize: 10, color: "rgba(212,175,55,0.5)", letterSpacing: "0.1em", marginTop: 1 }}>
                Pro Plan
              </span>
            </div>
          )}
          {open && <ChevronDown size={14} style={{ color: "rgba(212,175,55,0.4)", marginLeft: "auto" }} />}
        </div>
      </div>

      {/* Nav Items */}
      <div style={{ padding: "12px 8px", flex: 1, overflowY: "auto" }}>
        <div style={{ marginBottom: 8 }}>
          {open && (
            <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(212,175,55,0.35)", textTransform: "uppercase", padding: "4px 12px 8px" }}>
              Main
            </span>
          )}
          <NavItem icon={Home} label="Dashboard" selected={selected} setSelected={setSelected} open={open} />
          <NavItem icon={DollarSign} label="Sales" selected={selected} setSelected={setSelected} open={open} badge={3} />
          <NavItem icon={MessageSquare} label="AI Chat" selected={selected} setSelected={setSelected} open={open} onClick={() => navigate("/chat")} />
          <NavItem icon={Monitor} label="View Site" selected={selected} setSelected={setSelected} open={open} />
          <NavItem icon={ShoppingCart} label="Products" selected={selected} setSelected={setSelected} open={open} />
          <NavItem icon={Tag} label="Tags" selected={selected} setSelected={setSelected} open={open} />
          <NavItem icon={BarChart3} label="Analytics" selected={selected} setSelected={setSelected} open={open} />
          <NavItem icon={Users} label="Members" selected={selected} setSelected={setSelected} open={open} badge={12} />
        </div>

        {open && (
          <div style={{ marginTop: 8 }}>
            <span style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(212,175,55,0.35)", textTransform: "uppercase", padding: "4px 12px 8px" }}>
              Account
            </span>
            <NavItem icon={Settings} label="Settings" selected={selected} setSelected={setSelected} open={open} />
            <NavItem icon={HelpCircle} label="Help & Support" selected={selected} setSelected={setSelected} open={open} />
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "transparent",
          border: "none",
          borderTop: "1px solid rgba(212,175,55,0.12)",
          cursor: "pointer",
          width: "100%",
          display: "flex",
          alignItems: "center",
          padding: "14px 12px",
          color: "rgba(212,175,55,0.5)",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,175,55,0.06)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ width: 40, display: "grid", placeContent: "center" }}>
          <ChevronsRight size={16} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s" }} />
        </div>
        {open && <span style={{ fontSize: 12, fontWeight: 600 }}>Hide</span>}
      </button>
    </nav>
  );
}

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  selected: string;
  setSelected: (s: string) => void;
  open: boolean;
  badge?: number;
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, selected, setSelected, open, badge, onClick }: NavItemProps) {
  const isSelected = selected === label;
  return (
    <button
      onClick={() => { setSelected(label); onClick?.(); }}
      title={!open ? label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        height: 42,
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        position: "relative",
        marginBottom: 2,
        transition: "all 0.2s",
        background: isSelected ? "rgba(212,175,55,0.1)" : "transparent",
        color: isSelected ? GOLD : "rgba(160,160,180,0.8)",
        borderLeft: isSelected ? `2px solid ${GOLD}` : "2px solid transparent",
        paddingLeft: isSelected ? 10 : 12,
      }}
      onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.background = "rgba(212,175,55,0.05)"; e.currentTarget.style.color = "#e2e8f0"; } }}
      onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(160,160,180,0.8)"; } }}
    >
      <div style={{ width: 40, display: "grid", placeContent: "center", flexShrink: 0 }}>
        <Icon size={15} />
      </div>
      {open && (
        <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, whiteSpace: "nowrap" }}>{label}</span>
      )}
      {badge && open && (
        <span style={{
          position: "absolute", right: 10,
          height: 18, minWidth: 18, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 9, background: GOLD, color: "#0a0a0f", fontSize: 9, fontWeight: 800, padding: "0 4px",
        }}>{badge}</span>
      )}
    </button>
  );
}

function MainContent() {
  const [, navigate] = useLocation();

  const stats = [
    { icon: DollarSign, label: "Total Revenue", value: "$24,567", change: "+12% from last month", iconBg: "rgba(212,175,55,0.12)", iconColor: GOLD },
    { icon: Users, label: "Active Users", value: "1,234", change: "+5% from last week", iconBg: "rgba(52,211,153,0.1)", iconColor: "#34d399" },
    { icon: ShoppingCart, label: "Orders", value: "456", change: "+8% from yesterday", iconBg: "rgba(139,92,246,0.1)", iconColor: "#8b5cf6" },
    { icon: Package, label: "Products", value: "89", change: "+3 new this week", iconBg: "rgba(251,146,60,0.1)", iconColor: "#fb923c" },
  ];

  const activities = [
    { icon: DollarSign, title: "New sale recorded", desc: "Order #1234 completed", time: "2 min ago", color: GOLD },
    { icon: Users, title: "New user registered", desc: "john.doe@example.com joined", time: "5 min ago", color: "#34d399" },
    { icon: Package, title: "Product updated", desc: "iPhone 15 Pro stock updated", time: "10 min ago", color: "#8b5cf6" },
    { icon: Activity, title: "System maintenance", desc: "Scheduled backup completed", time: "1 hour ago", color: "#fb923c" },
    { icon: Bell, title: "New notification", desc: "Marketing campaign results", time: "2 hours ago", color: "#f87171" },
  ];

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#0a0a0f", padding: "32px 36px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "'Oxanium', sans-serif", letterSpacing: "-0.02em", margin: 0 }}>
            Admin Dashboard
          </h1>
          <p style={{ fontSize: 13, color: "rgba(160,160,180,0.7)", marginTop: 4 }}>Welcome back, your empire at a glance</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            style={{
              position: "relative", padding: 10, borderRadius: 10,
              background: "rgba(16,16,26,0.9)", border: "1px solid rgba(212,175,55,0.15)",
              color: "rgba(160,160,180,0.8)", cursor: "pointer", display: "flex", alignItems: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(212,175,55,0.15)")}
          >
            <Bell size={16} />
            <span style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, background: "#f87171", borderRadius: "50%", border: "1px solid #0a0a0f" }} />
          </button>
          <button
            onClick={() => navigate("/chat")}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "9px 18px", borderRadius: 10,
              background: "linear-gradient(135deg, #d4af37, #8a6d1f)",
              border: "none", color: "#0a0a0f",
              fontSize: 12, fontWeight: 800, letterSpacing: "0.1em",
              cursor: "pointer", fontFamily: "'Oxanium', sans-serif", textTransform: "uppercase",
            }}
          >
            <Zap size={13} />
            Launch AI
          </button>
          <button
            style={{
              padding: 10, borderRadius: 10,
              background: "rgba(16,16,26,0.9)", border: "1px solid rgba(212,175,55,0.15)",
              color: "rgba(160,160,180,0.8)", cursor: "pointer", display: "flex", alignItems: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(212,175,55,0.15)")}
          >
            <User size={16} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 36 }}>
        {stats.map((s, i) => (
          <div key={i}
            style={{
              padding: "24px 22px",
              borderRadius: 16,
              background: "rgba(16,16,26,0.8)",
              border: "1px solid rgba(212,175,55,0.1)",
              backdropFilter: "blur(12px)",
              transition: "border-color 0.3s, transform 0.3s",
              cursor: "default",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(212,175,55,0.3)";
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(212,175,55,0.1)";
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ padding: 10, borderRadius: 10, background: s.iconBg }}>
                <s.icon size={18} style={{ color: s.iconColor }} />
              </div>
              <TrendingUp size={14} style={{ color: "#34d399" }} />
            </div>
            <div style={{ fontSize: 12, color: "rgba(160,160,180,0.65)", marginBottom: 4, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: "'Oxanium', sans-serif", letterSpacing: "-0.02em" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#34d399", marginTop: 4 }}>{s.change}</div>
          </div>
        ))}
      </div>

      {/* Gold divider */}
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.3), transparent)", marginBottom: 36 }} />

      {/* Content Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        {/* Recent Activity */}
        <div style={{ borderRadius: 16, background: "rgba(16,16,26,0.8)", border: "1px solid rgba(212,175,55,0.1)", padding: "24px 22px", backdropFilter: "blur(12px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Oxanium', sans-serif", margin: 0, letterSpacing: "-0.01em" }}>Recent Activity</h3>
            <button style={{ fontSize: 11, color: GOLD, fontWeight: 700, background: "transparent", border: "none", cursor: "pointer", letterSpacing: "0.08em" }}>VIEW ALL</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {activities.map((a, i) => (
              <div key={i}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 10px", borderRadius: 10, transition: "background 0.2s", cursor: "pointer" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "rgba(212,175,55,0.04)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
              >
                <div style={{ padding: 9, borderRadius: 9, background: `${a.color}15`, flexShrink: 0 }}>
                  <a.icon size={14} style={{ color: a.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</p>
                  <p style={{ fontSize: 11, color: "rgba(160,160,180,0.6)", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.desc}</p>
                </div>
                <span style={{ fontSize: 10, color: "rgba(160,160,180,0.4)", whiteSpace: "nowrap" }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Quick Stats */}
          <div style={{ borderRadius: 16, background: "rgba(16,16,26,0.8)", border: "1px solid rgba(212,175,55,0.1)", padding: "24px 22px", backdropFilter: "blur(12px)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Oxanium', sans-serif", margin: "0 0 18px", letterSpacing: "-0.01em" }}>Quick Stats</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Conversion Rate", value: "3.2%", pct: 32, color: GOLD },
                { label: "Bounce Rate", value: "45%", pct: 45, color: "#fb923c" },
                { label: "Page Views", value: "8.7k", pct: 87, color: "#34d399" },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "rgba(160,160,180,0.65)" }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{s.value}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                    <div style={{ height: "100%", borderRadius: 2, width: `${s.pct}%`, background: `linear-gradient(90deg, ${s.color}99, ${s.color})`, boxShadow: `0 0 8px ${s.color}40` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Models (themed for LITHOVEX) */}
          <div style={{ borderRadius: 16, background: "rgba(16,16,26,0.8)", border: "1px solid rgba(212,175,55,0.1)", padding: "24px 22px", backdropFilter: "blur(12px)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Oxanium', sans-serif", margin: "0 0 18px", letterSpacing: "-0.01em" }}>Top AI Models</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { name: "GPT-4o", uses: "12,430" },
                { name: "Claude 3.5 Sonnet", uses: "8,219" },
                { name: "Gemini 1.5 Pro", uses: "6,041" },
                { name: "Llama 3.3 70B", uses: "3,882" },
              ].map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(212,175,55,0.4)", width: 16 }}>0{i + 1}</span>
                    <span style={{ fontSize: 13, color: "#c8c8d4", fontWeight: 500 }}>{m.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{m.uses}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom glow line */}
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.15), transparent)", marginTop: 48 }} />
    </div>
  );
}
