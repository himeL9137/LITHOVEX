import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import "@/styles/landing.css";
import { ProviderLogo } from "@/components/SettingsPanel";

export default function LandingPage() {
  const [, navigate] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const goToApp = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate("/chat");
  };

  const [activeSlide, setActiveSlide] = useState(0);

  // ── Marquee hover tooltip ─────────────────────────────────────────────────
  interface ModelTooltip {
    label: string;
    provider: string;
    tier: "Free" | "Premium";
    context: string;
    specialty: string;
    desc: string;
  }
  const [hoveredModel, setHoveredModel] = useState<ModelTooltip | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const MODEL_DETAILS: Record<string, Omit<ModelTooltip, "label">> = {
    "GPT-4o":         { provider:"OpenAI",              tier:"Free",    context:"128K tokens", specialty:"Multimodal · Reasoning · Speed",       desc:"OpenAI's flagship model. Best for coding, analysis, images, and complex multi-step tasks." },
    "Claude 3.5":     { provider:"Anthropic",           tier:"Premium", context:"200K tokens", specialty:"Long Context · Coding · Analysis",      desc:"Best-in-class reasoning and coding with a massive context window for long documents." },
    "Gemini 1.5 Pro": { provider:"Google DeepMind",     tier:"Free",    context:"1M tokens",   specialty:"Deep Research · Multi-document",        desc:"1 million token context window. Perfect for analyzing enormous codebases and documents." },
    "Llama 3.3":      { provider:"Meta (Open Source)",  tier:"Free",    context:"128K tokens", specialty:"Creative · Multilingual · Open",         desc:"Meta's powerful open-source model. Excellent for creative writing and multilingual tasks." },
    "DeepSeek R1":    { provider:"DeepSeek",            tier:"Free",    context:"64K tokens",  specialty:"Math · Chain-of-Thought · Logic",        desc:"Advanced chain-of-thought reasoning. Exceptional at math, logic, and step-by-step problem solving." },
    "Mistral Large":  { provider:"Mistral AI",          tier:"Free",    context:"128K tokens", specialty:"Speed · Function Calling · EU",          desc:"European frontier model. Fast, efficient, and excellent at structured outputs and tool use." },
    "Grok-3":         { provider:"xAI",                 tier:"Premium", context:"131K tokens", specialty:"Real-Time Data · Current Events",        desc:"xAI's latest with real-time data access. Best for up-to-date information and live search." },
    "o1 Pro":         { provider:"OpenAI",              tier:"Premium", context:"128K tokens", specialty:"Deep Reasoning · Science · Math",        desc:"OpenAI's most powerful reasoning model. Best for complex science and graduate-level problems." },
    "FLUX.1":         { provider:"Black Forest Labs",   tier:"Free",    context:"Image Gen",   specialty:"Text-to-Image · Photorealistic",         desc:"State-of-the-art image synthesis. Generates stunning photorealistic visuals in seconds." },
    "Qwen 2.5":       { provider:"Alibaba Cloud",       tier:"Free",    context:"128K tokens", specialty:"Coding · Chinese · Structured Data",     desc:"Alibaba's flagship model. Exceptional at code generation, multilingual tasks, and data analysis." },
  };

  const handleModelHover = (e: React.MouseEvent<HTMLDivElement>, label: string) => {
    const details = MODEL_DETAILS[label];
    if (!details) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
    setHoveredModel({ label, ...details });
  };
  const SLIDES = [
    {
      tag: "Unified Workflow",
      title: "Unified AI Orchestration",
      subtitle: "replaces fragmented chat workflows",
      items: [
        { icon: "⊘", label: "No Scattered Tabs", desc: "One terminal for all AI models" },
        { icon: "⚙", label: "No Code Glue", desc: "Automatic routing & synchronization" },
        { icon: "🔗", label: "No Context Loss", desc: "Persistent memory across sessions" },
      ],
      stats: [
        { value: "200+", label: "Models" },
        { value: "1", label: "Interface" },
        { value: "Zero", label: "Code Required" },
      ],
    },
    {
      tag: "Parallel Execution",
      title: "LITHOVEX Co-Work",
      subtitle: "Chained parallel models build production pipelines automatically",
      items: [
        { icon: "🤖", label: "Model A", desc: "First reasoning layer" },
        { icon: "⚡", label: "Model B", desc: "Parallel synthesis" },
        { icon: "🧠", label: "Model C", desc: "Final orchestration" },
      ],
      stats: [
        { value: "3×", label: "Parallel Agents" },
        { value: "∞", label: "Pipelines" },
        { value: "Auto", label: "Sync" },
      ],
    },
    {
      tag: "60s Deploy",
      title: "Instant Production",
      subtitle: "Transform raw concepts into live apps in 60 seconds",
      items: [
        { icon: "💬", label: "Prompt", desc: "Describe your idea" },
        { icon: "⚙️", label: "Build", desc: "Auto-generate code" },
        { icon: "🚀", label: "Deploy", desc: "Ship to production" },
      ],
      stats: [
        { value: "60s", label: "To Production" },
        { value: "Auto", label: "Parallel Chains" },
        { value: "0", label: "Manual Steps" },
      ],
    },
    {
      tag: "Persistent Memory",
      title: "Neural Memory",
      subtitle: "locks persistent context across every session",
      items: [
        { icon: "👤", label: "User Preferences", desc: "Remembered across every chat" },
        { icon: "📁", label: "Project Context", desc: "Full history always available" },
        { icon: "📋", label: "Decision History", desc: "Every choice preserved" },
      ],
      stats: [
        { value: "99.9%", label: "Context Accuracy" },
        { value: "∞", label: "History" },
        { value: "0ms", label: "Recall Time" },
      ],
    },
    {
      tag: "Real-Time Analytics",
      title: "Transparent Usage Tracking",
      subtitle: "scales free tiers to elite plans with full visibility",
      items: [
        { icon: "📊", label: "2.4M Tokens Used", desc: "this month" },
        { icon: "💰", label: "$1,247 Saved", desc: "vs fragmented tools" },
        { icon: "🤖", label: "47 Models Accessed", desc: "this week" },
      ],
      stats: [
        { value: "$40", label: "Starting /mo" },
        { value: "Auto", label: "Scale" },
        { value: "Full", label: "API Logs" },
      ],
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % 5);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // ── INJECT FONTS ──
    const fontLinks = [
      "https://fonts.googleapis.com/css2?family=Oxanium:wght@300;400;500;600;700;800&display=swap",
      "https://fonts.googleapis.com/css2?family=Maple+Mono:wght@300;400;500;600;700&display=swap",
    ];
    fontLinks.forEach((href) => {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }
    });

    // ── INJECT ICONIFY ──
    if (!document.querySelector('script[src*="iconify-icon"]')) {
      const script = document.createElement("script");
      script.src = "https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js";
      document.head.appendChild(script);
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = rootRef.current;
    if (!root) return;

    // ── PARTICLE CANVAS ──
    const canvas = canvasRef.current;
    let animFrame: number;
    if (canvas && !prefersReducedMotion) {
      const ctx = canvas.getContext("2d");
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const PARTICLE_COUNT = 35;
      const CONNECT_DIST = 100;
      const CELL = CONNECT_DIST;
      const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; opacity: number }> = [];
      const GOLD = "139,92,246";
      let mouseX = canvas.width / 2;
      let mouseY = canvas.height / 2;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.4 + 0.1,
        });
      }

      let lastMouseTime = 0;
      const onMouseMove = (e: MouseEvent) => {
        const now = Date.now();
        if (now - lastMouseTime < 16) return;
        lastMouseTime = now;
        mouseX = e.clientX;
        mouseY = e.clientY;
      };
      window.addEventListener("mousemove", onMouseMove, { passive: true });

      const onResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
      window.addEventListener("resize", onResize, { passive: true });

      const drawParticles = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Build spatial grid for O(n) connection checks
        const grid = new Map<string, number[]>();
        particles.forEach((p, i) => {
          const key = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key)!.push(i);
        });

        particles.forEach((p, i) => {
          const dx = mouseX - p.x;
          const dy = mouseY - p.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 22500) {
            p.vx += dx * 0.00005;
            p.vy += dy * 0.00005;
          }
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.99;
          p.vy *= 0.99;
          if (p.x < 0) p.x = canvas.width;
          if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          if (p.y > canvas.height) p.y = 0;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${GOLD},${p.opacity})`;
          ctx.fill();

          // Draw connections via spatial grid — only adjacent cells
          const cx = Math.floor(p.x / CELL);
          const cy = Math.floor(p.y / CELL);
          for (let gx = cx - 1; gx <= cx + 1; gx++) {
            for (let gy = cy - 1; gy <= cy + 1; gy++) {
              const neighbors = grid.get(`${gx},${gy}`);
              if (!neighbors) continue;
              for (const j of neighbors) {
                if (j <= i) continue;
                const dx2 = p.x - particles[j].x;
                const dy2 = p.y - particles[j].y;
                const d2 = dx2 * dx2 + dy2 * dy2;
                if (d2 < CELL * CELL) {
                  const d = Math.sqrt(d2);
                  ctx.beginPath();
                  ctx.strokeStyle = `rgba(${GOLD},${0.05 * (1 - d / CELL)})`;
                  ctx.lineWidth = 0.5;
                  ctx.moveTo(p.x, p.y);
                  ctx.lineTo(particles[j].x, particles[j].y);
                  ctx.stroke();
                }
              }
            }
          }
        });
        animFrame = requestAnimationFrame(drawParticles);
      };
      drawParticles();

      return () => {
        cancelAnimationFrame(animFrame);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("resize", onResize);
      };
    }
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = rootRef.current;
    if (!root) return;

    // ── SCROLL REVEAL (combined observer — reduces observer count) ──
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
            if (entry.target.classList.contains("word-reveal")) {
              const words = entry.target.querySelectorAll<HTMLElement>(".word");
              words.forEach((word, i) => {
                if (!word.style.animationDelay) {
                  word.style.animationDelay = `${i * 0.08}s`;
                }
              });
            }
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -20px 0px" }
    );

    root.querySelectorAll(".reveal, .reveal-blur, .reveal-scale, .reveal-left, .word-reveal").forEach((el) => {
      if (prefersReducedMotion) el.classList.add("active");
      else revealObserver.observe(el);
    });

    // ── COUNTER ANIMATION ──
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const target = parseInt(el.dataset.target || "0", 10);
          const suffix = el.dataset.suffix || "";
          const duration = 1800;
          const steps = 60;
          const stepTime = duration / steps;
          let current = 0;
          const increment = target / steps;
          const updateCounter = () => {
            current += increment;
            if (current >= target) {
              el.textContent = target + suffix;
              el.classList.add("pop");
              setTimeout(() => el.classList.remove("pop"), 400);
            } else {
              el.textContent = Math.floor(current) + suffix;
              setTimeout(updateCounter, stepTime);
            }
          };
          if (!prefersReducedMotion) updateCounter();
          else el.textContent = target + suffix;
          counterObserver.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );

    root.querySelectorAll(".counter-animated").forEach((el) => counterObserver.observe(el));

    // ── PARALLAX ORBS (rAF-throttled scroll) ──
    const orbs = root.querySelectorAll<HTMLElement>(".parallax-orb");
    let scrollTicking = false;
    const onScroll = () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        const scrollY = window.pageYOffset;
        orbs.forEach((orb) => {
          const speed = parseFloat(orb.dataset.speed || "0.02");
          orb.style.transform = `translateZ(0) translateY(${scrollY * speed * -50}px)`;
        });
        scrollTicking = false;
      });
    };
    if (!prefersReducedMotion) window.addEventListener("scroll", onScroll, { passive: true });

    // ── 2D TILT (GPU-friendly — replaces expensive 3D rotateX/rotateY) ──
    const cards = root.querySelectorAll<HTMLElement>(".glass-card");
    const tiltHandlers: Array<{ el: HTMLElement; mm: () => void; ml: () => void }> = [];
    if (!prefersReducedMotion) {
      cards.forEach((card) => {
        const mm = () => {
          card.style.willChange = "transform";
          card.style.transform = "translateZ(0) translateY(-8px) scale(1.01)";
        };
        const ml = () => {
          card.style.transform = "";
          card.style.willChange = "";
        };
        card.addEventListener("mouseenter", mm);
        card.addEventListener("mouseleave", ml);
        tiltHandlers.push({ el: card, mm, ml });
      });
    }

    return () => {
      revealObserver.disconnect();
      counterObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      tiltHandlers.forEach(({ el, mm, ml }) => {
        el.removeEventListener("mouseenter", mm);
        el.removeEventListener("mouseleave", ml);
      });
    };
  }, []);

  const LOGO = "https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/99dcde2e-c976-4379-999c-7de3e02359e1/1777617002176-878b9477/LITHOVEX_LOGO.png";

  return (
    <div ref={rootRef} className="landing-root">
      {/* PARTICLE CANVAS */}
      <canvas ref={canvasRef} style={{ position:"fixed", top:0, left:0, zIndex:0, pointerEvents:"none", width:"100%", height:"100%" }} />

      {/* ── MODEL HOVER TOOLTIP (fixed — escapes overflow:hidden) ── */}
      {hoveredModel && (
        <div
          style={{
            position: "fixed",
            left: Math.min(tooltipPos.x, window.innerWidth - 300),
            top: tooltipPos.y - 12,
            transform: "translateX(-50%) translateY(-100%)",
            zIndex: 99999,
            pointerEvents: "none",
          }}
        >
          <div className="bg-[#12121e] border border-violet-500/30 rounded-2xl p-4 w-72 shadow-2xl shadow-violet-900/40"
            style={{ backdropFilter: "blur(20px)" }}>
            {/* Top accent */}
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-violet-500 to-transparent mb-3" />
            {/* Header row */}
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[15px] font-extrabold text-white tracking-tight">{hoveredModel.label}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                hoveredModel.tier === "Premium"
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
              }`}>{hoveredModel.tier}</span>
            </div>
            {/* Provider */}
            <p className="text-[11px] text-slate-500 mb-2.5 font-medium">{hoveredModel.provider}</p>
            {/* Description */}
            <p className="text-[12px] text-slate-300 leading-relaxed mb-3">{hoveredModel.desc}</p>
            {/* Stats row */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white/4 rounded-lg px-2.5 py-1.5">
                <div className="text-[9px] text-slate-600 uppercase tracking-[0.12em] mb-0.5">Context</div>
                <div className="text-[11px] font-bold text-violet-300">{hoveredModel.context}</div>
              </div>
              <div className="flex-1 bg-white/4 rounded-lg px-2.5 py-1.5">
                <div className="text-[9px] text-slate-600 uppercase tracking-[0.12em] mb-0.5">Best For</div>
                <div className="text-[10px] font-semibold text-slate-300 leading-tight">{hoveredModel.specialty.split(" · ")[0]}</div>
              </div>
            </div>
            {/* Specialty tags */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {hoveredModel.specialty.split(" · ").map((tag, i) => (
                <span key={i} className="text-[9px] text-violet-400/80 bg-violet-500/8 border border-violet-500/15 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
            {/* Bottom arrow */}
            <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-full w-0 h-0"
              style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid rgba(139,92,246,0.3)" }} />
          </div>
        </div>
      )}

      {/* PARALLAX ORBS */}
      <div className="parallax-orb" data-speed="0.02" style={{ width:500, height:500, background:"rgba(120,0,255,0.12)", top:-100, left:"30%", zIndex:0 }} />
      <div className="parallax-orb" data-speed="0.04" style={{ width:350, height:350, background:"rgba(139,92,246,0.08)", top:600, right:"5%", zIndex:0 }} />
      <div className="parallax-orb" data-speed="0.03" style={{ width:250, height:250, background:"rgba(124,58,237,0.07)", top:1800, left:"5%", zIndex:0 }} />
      <div className="parallax-orb" data-speed="0.025" style={{ width:400, height:400, background:"rgba(139,92,246,0.05)", top:3200, right:"15%", zIndex:0 }} />

      <div style={{ position:"relative", zIndex:10 }}>

        {/* ── NAV ── */}
        <nav style={{ backdropFilter:"blur(20px)", background:"rgba(10,10,15,0.88)" }}
          className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f] border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={LOGO} alt="LITHOVEX" className="h-9 logo-float" />
              <span className="text-lg font-bold tracking-[0.2em] gold-morph-text uppercase hidden md:block" style={{ WebkitTextFillColor: "unset", background: "none", color: "#c4b5fd" }}>LITHOVEX</span>
            </div>
            <div className="hidden lg:flex items-center gap-8">
              <a href="#models" className="nav-link text-[13px] font-medium text-slate-400 hover:text-white transition-colors duration-300">Models</a>
              <a href="#features" className="nav-link text-[13px] font-medium text-slate-400 hover:text-white transition-colors duration-300">Features</a>
              <a href="#pricing" className="nav-link text-[13px] font-medium text-slate-400 hover:text-white transition-colors duration-300">Pricing</a>
              <a href="#workflow" className="nav-link text-[13px] font-medium text-slate-400 hover:text-white transition-colors duration-300">Workflow</a>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={goToApp} className="text-[13px] font-semibold text-slate-400 hover:text-white transition-colors duration-300 hidden sm:block bg-transparent border-none cursor-pointer">Log In</button>
              <button onClick={goToApp} className="btn-shimmer bg-violet-600 text-white px-6 py-2.5 rounded-lg text-[13px] font-bold transition-all hover:-translate-y-0.5 relative cursor-pointer border-none">
                LAUNCH APP
              </button>
            </div>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className="pt-36 pb-20 md:pt-52 md:pb-36 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 text-center relative">
            <div className="reveal stagger-1 inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-violet-500/25 text-violet-400 text-[11px] font-bold tracking-[0.15em] uppercase mb-10"
              style={{ background:"rgba(139,92,246,0.08)" }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
              200+ Premium AI Models · Now Live
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-extrabold mb-8 leading-[1.05] tracking-tight">
              <span className="word-reveal reveal" id="hero-title">
                <span className="word" style={{ animationDelay:"0s" }}>The</span>{" "}
                <span className="word gold-morph-text" style={{ animationDelay:"0.08s" }}>Luxury</span>{" "}
                <span className="word" style={{ animationDelay:"0.16s" }}>Workspace</span>
                <br />
                <span className="word" style={{ animationDelay:"0.24s" }}>Built</span>{" "}
                <span className="word" style={{ animationDelay:"0.32s" }}>for</span>{" "}
                <span className="word gold-morph-text" style={{ animationDelay:"0.4s" }}>Builders</span>
              </span>
            </h1>

            <p className="reveal-blur stagger-2 text-base md:text-lg text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              One terminal for GPT-5.5, Claude Opus 4.7, Grok-4 Heavy, Gemini 2.5 Ultra, o3 Pro, and every frontier model that matters — all in a single, high-performance workspace.
            </p>

            <div className="reveal stagger-3 flex flex-col sm:flex-row items-center justify-center gap-5">
              <button onClick={goToApp}
                className="btn-shimmer w-full sm:w-auto px-10 py-4 rounded-xl bg-violet-600 text-white text-base font-bold transition-all hover:scale-105 relative z-10 border-none cursor-pointer">
                Start Free Forever
              </button>
              <a href="#models"
                className="gradient-border w-full sm:w-auto px-10 py-4 rounded-xl border border-white/15 hover:border-violet-500/40 text-base font-semibold hover:bg-white/5 transition-all duration-500 text-center">
                Explore 200+ Models
              </a>
            </div>

            {/* STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 max-w-4xl mx-auto border-t border-white/8 pt-14" style={{ borderTopColor:"rgba(255,255,255,0.08)" }}>
              <div className="reveal stagger-1 flex flex-col items-center">
                <span className="counter-animated text-3xl md:text-4xl font-bold gold-morph-text" data-target="200" data-suffix="+">0</span>
                <span className="text-[11px] text-slate-500 uppercase tracking-[0.2em] mt-2">AI Models</span>
              </div>
              <div className="reveal stagger-2 flex flex-col items-center">
                <span className="text-3xl md:text-4xl font-bold gold-morph-text">∞</span>
                <span className="text-[11px] text-slate-500 uppercase tracking-[0.2em] mt-2">Free Messages</span>
              </div>
              <div className="reveal stagger-3 flex flex-col items-center">
                <span className="counter-animated text-3xl md:text-4xl font-bold gold-morph-text" data-target="1" data-suffix="-Tap">0</span>
                <span className="text-[11px] text-slate-500 uppercase tracking-[0.2em] mt-2">Deployment</span>
              </div>
              <div className="reveal stagger-4 flex flex-col items-center">
                <span className="counter-animated text-3xl md:text-4xl font-bold gold-morph-text" data-target="60" data-suffix="s">0</span>
                <span className="text-[11px] text-slate-500 uppercase tracking-[0.2em] mt-2">Onboarding</span>
              </div>
            </div>

            {/* ── PDF SLIDES CAROUSEL ── */}
            <div className="mt-20 max-w-4xl mx-auto">
              {/* Slide card */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden">
                {/* Purple top accent bar */}
                <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

                {SLIDES.map((slide, i) => (
                  <div key={i}
                    className="px-6 sm:px-8 py-8 sm:py-10 flex flex-col gap-6"
                    style={{ display: activeSlide === i ? "flex" : "none" }}>
                    {/* Tag + title */}
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full border border-violet-500/30 text-violet-400 text-[10px] font-bold tracking-[0.15em] uppercase mb-4"
                        style={{ background: "rgba(139,92,246,0.08)" }}>
                        {slide.tag}
                      </span>
                      <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-1">{slide.title}</h3>
                      <p className="text-sm text-slate-400 mb-6">{slide.subtitle}</p>

                      {/* Feature items */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {slide.items.map((item, j) => (
                          <div key={j} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-4">
                            <span className="text-xl mt-0.5 shrink-0">{item.icon}</span>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white">{item.label}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom stats */}
                    <div className="flex items-center justify-center gap-8 sm:gap-10 pt-6 border-t border-white/8">
                      {slide.stats.map((s, k) => (
                        <div key={k} className="text-center">
                          <div className="text-xl font-extrabold gold-morph-text">{s.value}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-[0.15em] mt-1">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Navigation dots */}
              <div className="flex items-center justify-center gap-2.5 mt-6">
                {SLIDES.map((_, i) => (
                  <button key={i} onClick={() => setActiveSlide(i)}
                    className="transition-all duration-300 rounded-full border-none cursor-pointer"
                    style={{
                      width: activeSlide === i ? "28px" : "8px",
                      height: "8px",
                      background: activeSlide === i ? "#8b5cf6" : "rgba(255,255,255,0.2)",
                    }} />
                ))}
              </div>

              {/* Slide label */}
              <p className="text-center text-[11px] text-slate-600 uppercase tracking-[0.2em] mt-4">
                {activeSlide + 1} / {SLIDES.length} · {SLIDES[activeSlide].tag}
              </p>
            </div>
          </div>
        </section>

        {/* ── MODEL MARQUEE ── */}
        <div className="py-10 bg-white/[0.03] border-y border-white/5 overflow-hidden" style={{ mask:"linear-gradient(90deg,transparent,black 10%,black 90%,transparent)" }}>
          <div className="marquee-track">
            {[...Array(2)].map((_, dupe) => (
              <div key={dupe} className="flex items-center gap-14 px-8">
                {[
                  { category:"OpenAI",            label:"GPT-4o" },
                  { category:"Anthropic",          label:"Claude 3.5" },
                  { category:"Google",             label:"Gemini 1.5 Pro" },
                  { category:"Meta Llama",         label:"Llama 3.3" },
                  { category:"DeepSeek",           label:"DeepSeek R1" },
                  { category:"Mistral AI",         label:"Mistral Large" },
                  { category:"xAI",                label:"Grok-3" },
                  { category:"OpenAI",             label:"o1 Pro" },
                  { category:"Black Forest Labs",  label:"FLUX.1" },
                  { category:"Qwen",               label:"Qwen 2.5" },
                ].map((m, i) => (
                  <div
                    key={i}
                    onMouseEnter={(e) => handleModelHover(e, m.label)}
                    onMouseLeave={() => setHoveredModel(null)}
                    className="relative flex items-center gap-3 opacity-40 hover:opacity-100 transition-all duration-300 cursor-pointer select-none"
                  >
                    <ProviderLogo category={m.category} size={24} />
                    <span className="text-sm font-semibold text-slate-300 whitespace-nowrap">{m.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── MODEL SHOWCASE ── */}
        <section id="models" className="py-28 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <h2 className="reveal-left text-4xl md:text-5xl font-bold mb-5 tracking-tight glitch-text" data-text="World-Class Models.">
                World-Class Models.<br />
                <span className="gold-morph-text">Unlimited Potential.</span>
              </h2>
              <p className="reveal-blur stagger-2 text-slate-400 max-w-lg text-[15px] leading-relaxed">The world's most capable AI engines, curated for professional productivity.</p>
            </div>

            {/* Free tier models */}
            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-[0.2em] mb-4 reveal stagger-1">Included Free</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
              {[
                { category:"OpenAI",     iconBg:"bg-emerald-500/10", badge:"Free", badgeCls:"bg-emerald-500/10 text-emerald-400", name:"GPT-4o",         desc:"OpenAI's flagship model, optimized for speed and multi-modal tasks.", stagger:"stagger-1" },
                { category:"Google",     iconBg:"bg-blue-500/10",    badge:"Free", badgeCls:"bg-blue-500/10 text-blue-400",       name:"Gemini 1.5 Pro", desc:"1M token context window. Perfect for deep research.",             stagger:"stagger-2" },
                { category:"Meta Llama", iconBg:"bg-purple-500/10",  badge:"Free", badgeCls:"bg-purple-500/10 text-purple-400",   name:"Llama 4 Scout",  desc:"Meta's latest open-source model. Fast, efficient, and multilingual.", stagger:"stagger-3" },
                { category:"Mistral AI", iconBg:"bg-yellow-500/10",  badge:"Free", badgeCls:"bg-yellow-500/10 text-yellow-400",   name:"Mistral Large 2",desc:"European frontier model. Excellent at structured outputs and reasoning.", stagger:"stagger-4" },
              ].map((m, i) => (
                <div key={i} className={`glass-card gradient-border float-bob p-7 rounded-2xl reveal ${m.stagger}`}>
                  <div className="flex justify-between items-start mb-5">
                    <div className={`w-11 h-11 ${m.iconBg} rounded-xl flex items-center justify-center icon-animated`}>
                      <ProviderLogo category={m.category} size={28} />
                    </div>
                    <span className={`px-3 py-1 ${m.badgeCls} text-[10px] font-bold tracking-[0.12em] rounded-full uppercase`}>{m.badge}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{m.name}</h3>
                  <p className="text-[13px] text-slate-400 leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>

            {/* Premium-only frontier models */}
            <div className="reveal stagger-2 flex items-center justify-between mb-6">
              <div>
                <p className="text-[11px] font-bold text-violet-400 uppercase tracking-[0.2em] mb-1">Premium Exclusive · Frontier Models</p>
                <p className="text-[12px] text-slate-500">Access the world's most powerful AI — requires Premium at <span className="text-violet-300 font-bold">$40/month</span></p>
              </div>
              <button onClick={goToApp}
                className="hidden sm:flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-[12px] font-bold hover:bg-violet-600/30 transition-all cursor-pointer">
                <iconify-icon icon="lucide:crown" class="text-sm" />
                Unlock Premium
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { category:"OpenAI",           iconBg:"bg-emerald-500/10", name:"GPT-5.5",         provider:"OpenAI",         desc:"OpenAI's most advanced reasoning model with breakthrough multimodal understanding.", stagger:"stagger-1" },
                { category:"Anthropic",         iconBg:"bg-orange-500/10",  name:"Claude Opus 4.7", provider:"Anthropic",       desc:"Anthropic's apex model. Extraordinary at long-context analysis and nuanced reasoning.", stagger:"stagger-2" },
                { category:"Moonshot AI",       iconBg:"bg-cyan-500/10",    name:"Kimi K2 (2.6)",   provider:"Moonshot AI",     desc:"Kimi's latest frontier model with ultra-long context and agentic coding capabilities.", stagger:"stagger-3" },
                { category:"Google",            iconBg:"bg-blue-500/10",    name:"Gemini 2.5 Ultra",provider:"Google DeepMind", desc:"Google's most capable model with 2M token context and native multimodal reasoning.", stagger:"stagger-4" },
                { category:"xAI",               iconBg:"bg-white/5",        name:"Grok-4 Heavy",    provider:"xAI",             desc:"xAI's most powerful model with real-time web access and extended deep thinking.", stagger:"stagger-1" },
                { category:"OpenAI",            iconBg:"bg-violet-500/10",  name:"o3 Pro",           provider:"OpenAI",          desc:"OpenAI's chain-of-thought reasoning champion. Unmatched at math and hard science.", stagger:"stagger-2" },
                { category:"DeepSeek",          iconBg:"bg-cyan-500/10",    name:"DeepSeek R2",      provider:"DeepSeek",        desc:"Next-gen reasoning model with superior STEM performance and open-source transparency.", stagger:"stagger-3" },
                { category:"Qwen",              iconBg:"bg-amber-500/10",   name:"Qwen 3 235B",      provider:"Alibaba Cloud",   desc:"Alibaba's massive MoE model delivering top-tier coding and multilingual intelligence.", stagger:"stagger-4" },
              ].map((m, i) => (
                <div key={i} className={`glass-card p-6 rounded-2xl reveal ${m.stagger} relative overflow-hidden ring-1 ring-violet-500/20 hover:ring-violet-500/50 transition-all duration-300`}>
                  {/* Premium badge */}
                  <div className="absolute top-3 right-3">
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-violet-500/15 border border-violet-500/25 rounded-full text-[9px] font-black text-violet-300 uppercase tracking-[0.12em]">
                      🔒 Premium
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mb-4 mt-1">
                    <div className={`w-10 h-10 ${m.iconBg} rounded-xl flex items-center justify-center icon-animated shrink-0`}>
                      <ProviderLogo category={m.category} size={26} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-bold text-white leading-tight truncate">{m.name}</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">{m.provider}</p>
                    </div>
                  </div>
                  <p className="text-[12px] text-slate-400 leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 reveal stagger-5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-violet-500/6 border border-violet-500/20 rounded-2xl px-6 py-5">
              <div>
                <p className="text-[13px] font-bold text-white mb-0.5">Unlock all 200+ models including every frontier release</p>
                <p className="text-[12px] text-slate-500">New models added weekly. Premium members always get them first.</p>
              </div>
              <button onClick={goToApp}
                className="btn-shimmer shrink-0 px-7 py-3 rounded-xl bg-violet-600 text-white text-[13px] font-bold border-none cursor-pointer whitespace-nowrap">
                Get Premium · $40/mo
              </button>
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="py-28 bg-[#0c0c14]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="reveal text-4xl md:text-6xl font-extrabold mb-5 uppercase tracking-tight glitch-text" data-text="Built for the Elite">
                Built for the <span className="gold-morph-text">Elite</span>
              </h2>
              <p className="reveal-blur stagger-2 text-slate-400 max-w-2xl mx-auto text-[15px]">Industrial-grade features for those who demand the absolute best.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-white/5 rounded-2xl overflow-hidden border border-white/5">
              {[
                { icon:"lucide:swords", title:"Frontier Model Terminal", desc:"GPT-5.5, Claude Opus 4.7, Grok-4 Heavy, o3 Pro, Gemini 2.5 Ultra — every cutting-edge model in one place.", tag:"frontier-models", stagger:"stagger-1" },
                { icon:"lucide:users", title:"LITHOVEX Co-Work", desc:"Chain multiple AI agents to collaborate sequentially on complex tasks. Superhuman output.", tag:"collaborative-ai", stagger:"stagger-2" },
                { icon:"lucide:code-2", title:"Lithovex Coder", desc:"Push/pull directly from GitHub. Edit entire apps with AI and deploy in seconds.", tag:"github-integration", stagger:"stagger-3" },
                { icon:"lucide:palette", title:"Art Synthesis", desc:"Generate stunning images with FLUX, SDXL, and Playground v3 via intelligent routing.", tag:"flux · sdxl", stagger:"stagger-4" },
                { icon:"lucide:brain", title:"Neural Memory", desc:"Upload documents and build persistent RAG knowledge bases that remember everything.", tag:"long-term-context", stagger:"stagger-5" },
                { icon:"lucide:globe", title:"Real-Time Insight", desc:"Built-in live web search for today's news, stock data, and accurate current information.", tag:"real-time", stagger:"stagger-6" },
              ].map((f, i) => (
                <div key={i} className={`bg-[#0c0c14] p-9 hover:bg-white/[0.03] transition-all duration-500 reveal ${f.stagger} group`}>
                  <div className="icon-animated mb-5"><iconify-icon icon={f.icon} class="text-3xl text-violet-400" /></div>
                  <h3 className="text-lg font-bold text-white mb-3 tracking-tight">{f.title}</h3>
                  <p className="text-slate-400 text-[13px] leading-relaxed">{f.desc}</p>
                  <span className="inline-block mt-4 text-[10px] font-bold text-violet-400 bg-violet-500/10 px-3 py-1 rounded tracking-[0.1em] uppercase border border-violet-500/20">{f.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WORKFLOW ── */}
        <section id="workflow" className="py-28 px-6 relative">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16">
              <h2 className="reveal text-4xl md:text-5xl font-bold mb-5 tracking-tight">
                Deployed in <span className="gold-morph-text">60s Flat</span>
              </h2>
              <p className="reveal-blur stagger-2 text-slate-400 text-[15px]">From sign-up to superhuman productivity.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { num:"01", icon:"lucide:mouse-pointer-click", title:"Pick Your Engine", desc:"Choose from GPT-5.5, Claude Opus 4.7, Grok-4, o3 Pro and more — or let the AI router pick the best frontier model automatically.", stagger:"stagger-1" },
                { num:"02", icon:"lucide:terminal", title:"Build Anything", desc:"Chat, code, upload docs, or generate images. All from the unified command line.", stagger:"stagger-2" },
                { num:"03", icon:"lucide:sparkles", title:"Enable Co-Work", desc:"Activate sequential processing. Let multiple AIs critique and improve each other.", stagger:"stagger-3" },
                { num:"04", icon:"lucide:rocket", title:"Ship & Scale", desc:"Deploy with GitHub integration. From idea to production without leaving the tab.", stagger:"stagger-4" },
              ].map((s, i) => (
                <div key={i} className={`glass-card gradient-border p-7 rounded-2xl overflow-hidden group reveal ${s.stagger} relative`}>
                  <span className="absolute top-3 right-5 text-7xl font-black text-white/[0.03] group-hover:text-violet-500/10 transition-all duration-700">{s.num}</span>
                  <div className="icon-animated mb-4"><iconify-icon icon={s.icon} class="text-2xl text-violet-400" /></div>
                  <h4 className="text-lg font-bold mb-3">{s.title}</h4>
                  <p className="text-[13px] text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="py-28 px-6 bg-[#0c0c14]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="reveal text-4xl md:text-5xl font-extrabold mb-5 tracking-tight glitch-text" data-text="Investment Tiers">
                Investment <span className="gold-morph-text">Tiers</span>
              </h2>
              <p className="reveal-blur stagger-2 text-slate-400 text-[15px]">Choose the level of power that fits your ambition.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* Free */}
              <div className="glass-card gradient-border p-9 rounded-3xl flex flex-col reveal stagger-1">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-4">Essential</span>
                <div className="text-5xl font-bold text-white mb-1">$0</div>
                <p className="text-[13px] text-slate-500 mb-7">Free Forever</p>
                <div className="h-px bg-white/8 mb-6" style={{ background:"rgba(255,255,255,0.08)" }}></div>
                <ul className="space-y-3.5 mb-9 flex-grow">
                  {["50+ free models incl. GPT-4o","Unlimited basic messaging","FLUX.1 image generation","Built-in web search"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-[13px] text-slate-300">
                      <iconify-icon icon="lucide:check" class="text-emerald-400 text-sm" />{item}
                    </li>
                  ))}
                  <li className="flex items-center gap-3 text-[13px] text-slate-500">
                    <iconify-icon icon="lucide:x" class="text-slate-600 text-sm" />Premium model access
                  </li>
                </ul>
                <button onClick={goToApp} className="w-full py-3.5 text-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-[13px] transition-all duration-300 hover:border-white/20 cursor-pointer">Get Started Free</button>
              </div>
              {/* Pro Yearly */}
              <div className="glass-card p-9 rounded-3xl flex flex-col reveal stagger-2 relative pricing-best ring-2 ring-violet-500/40 shadow-[0_0_60px_rgba(139,92,246,0.15)]">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-violet-600 text-white px-5 py-1 rounded-full text-[10px] font-black tracking-[0.15em] uppercase">Best Value</div>
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-violet-400 mb-4">Pro · Yearly</span>
                <div className="text-5xl font-bold text-white mb-1">$33<span className="text-lg font-normal text-slate-500">/mo</span></div>
                <p className="text-[13px] text-violet-400/70 mb-2">Billed yearly ($400/yr)</p>
                <span className="inline-block text-[12px] text-emerald-400 bg-emerald-400/8 border border-emerald-400/20 px-3 py-1 rounded font-semibold mb-5 w-fit" style={{ background:"rgba(52,211,153,0.08)" }}>Save $80/year</span>
                <div className="h-px bg-white/8 mb-6" style={{ background:"rgba(255,255,255,0.08)" }}></div>
                <ul className="space-y-3.5 mb-9 flex-grow">
                  <li className="flex items-center gap-3 text-[13px] text-white font-semibold"><iconify-icon icon="lucide:sparkles" class="text-violet-400 text-sm" />GPT-5.5 · Claude Opus 4.7 · o3 Pro</li>
                  {["Grok-4 Heavy · Gemini 2.5 Ultra · Kimi K2","DeepSeek R2 · Qwen 3 235B + every new drop","LITHOVEX Co-Work pipeline","Full GitHub integration · Priority speed"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-[13px] text-slate-300"><iconify-icon icon="lucide:check" class="text-emerald-400 text-sm" />{item}</li>
                  ))}
                </ul>
                <button onClick={goToApp} className="btn-shimmer w-full py-3.5 text-center rounded-xl bg-violet-600 text-white font-bold text-[13px] transition-all relative z-10 border-none cursor-pointer">Unlock Pro · $400/year</button>
              </div>
              {/* Monthly */}
              <div className="glass-card gradient-border p-9 rounded-3xl flex flex-col reveal stagger-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-4">Professional</span>
                <div className="text-5xl font-bold text-white mb-1">$40<span className="text-lg font-normal text-slate-500">/mo</span></div>
                <p className="text-[13px] text-slate-500 mb-7">Pay monthly · Cancel anytime</p>
                <div className="h-px bg-white/8 mb-6" style={{ background:"rgba(255,255,255,0.08)" }}></div>
                <ul className="space-y-3.5 mb-9 flex-grow">
                  {["Everything in Free","GPT-5.5 · Claude Opus 4.7 · Grok-4 Heavy","o3 Pro · Gemini 2.5 Ultra · Kimi K2 · More","LITHOVEX Co-Work · Lithovex Coder","GitHub integration · Premium image gen"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-[13px] text-slate-300"><iconify-icon icon="lucide:check" class="text-emerald-400 text-sm" />{item}</li>
                  ))}
                </ul>
                <button onClick={goToApp} className="w-full py-3.5 text-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-[13px] transition-all duration-300 hover:border-white/20 cursor-pointer">Start Monthly · $40/mo</button>
              </div>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section className="py-28 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="reveal text-4xl md:text-5xl font-bold mb-5 tracking-tight">
                Built for Builders. <span className="gold-morph-text">Loved by Everyone.</span>
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { quote:"LITHOVEX Co-Work is a game changer. I had four models debate my app architecture and the synthesized result was better than anything I've seen.", name:"Arafat Rahman", role:"Full-Stack Dev", initials:"AR", stagger:"stagger-1" },
                { quote:"I cancelled every AI subscription I had. Claude Opus 4.7 + GPT-5.5 + Grok-4 all in one terminal for $40? Ridiculous value. The UI is insanely smooth.", name:"Sarah Nkosi", role:"Freelance Designer", initials:"SN", stagger:"stagger-2" },
                { quote:"The Coder integration is elite. Pulling my GitHub repo and having AI audit my entire codebase saved weeks of debugging.", name:"Marcus Kim", role:"Senior Engineer", initials:"MK", stagger:"stagger-3" },
              ].map((t, i) => (
                <div key={i} className={`glass-card gradient-border p-7 rounded-2xl border-l-4 border-l-violet-500 reveal ${t.stagger}`}>
                  <div className="text-violet-500/40 text-3xl mb-3">❝</div>
                  <p className="text-slate-300 text-[13px] mb-7 leading-relaxed italic">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-[11px] font-bold text-violet-400 ring-1 ring-violet-500/40">{t.initials}</div>
                    <div><p className="font-bold text-white text-[12px]">{t.name}</p><p className="text-[10px] text-slate-500 uppercase tracking-[0.12em]">{t.role}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA SECTION ── */}
        <section className="py-28 px-6 relative overflow-hidden" style={{ background:"linear-gradient(180deg, #0c0c14 0%, #0a0a0f 100%)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background:"radial-gradient(ellipse 80% 60% at 50% 50%, rgba(139,92,246,0.10) 0%, transparent 70%)" }}></div>
          <div className="max-w-3xl mx-auto text-center relative">
            <div className="reveal mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/20 text-violet-400/80 text-[11px] font-bold tracking-[0.15em] uppercase" style={{ background:"rgba(139,92,246,0.08)" }}>
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span></span>
              Open Access · No credit card
            </div>
            <h2 className="reveal text-4xl md:text-6xl font-extrabold mb-6 tracking-tight leading-[1.1]">
              Your AI Empire.<br />
              <span className="gold-morph-text">Starts Today.</span>
            </h2>
            <p className="reveal-blur stagger-2 text-slate-400 text-[15px] mb-12 max-w-xl mx-auto leading-relaxed">
              Join thousands of builders running GPT-5.5, Claude Opus 4.7, o3 Pro, and Grok-4 Heavy — all from a single terminal. No more juggling five subscriptions.
            </p>
            <div className="reveal stagger-3 flex flex-col sm:flex-row items-center justify-center gap-5">
              <button onClick={goToApp}
                className="btn-shimmer w-full sm:w-auto px-12 py-5 rounded-2xl bg-violet-600 text-white text-lg font-black transition-all hover:scale-105 relative z-10 border-none cursor-pointer tracking-wide">
                Launch LITHOVEX Free
              </button>
            </div>
            <p className="mt-6 text-slate-600 text-[12px]">No credit card · Instant access · Cancel anytime</p>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="py-14 px-6 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-3">
                <img src={LOGO} alt="LITHOVEX" className="h-8" />
                <span className="text-sm font-bold tracking-[0.2em] gold-morph-text uppercase">LITHOVEX</span>
              </div>
              <div className="flex items-center gap-8">
                <a href="#models" className="nav-link text-[12px] text-slate-500 hover:text-white transition-colors">Models</a>
                <a href="#features" className="nav-link text-[12px] text-slate-500 hover:text-white transition-colors">Features</a>
                <a href="#pricing" className="nav-link text-[12px] text-slate-500 hover:text-white transition-colors">Pricing</a>
                <button onClick={goToApp} className="nav-link text-[12px] text-slate-500 hover:text-white transition-colors bg-transparent border-none cursor-pointer">Launch App</button>
              </div>
              <p className="text-[11px] text-slate-600">© 2025 LITHOVEX. All rights reserved.</p>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
