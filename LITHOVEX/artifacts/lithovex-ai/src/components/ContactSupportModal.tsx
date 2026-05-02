import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, LifeBuoy } from "lucide-react";

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SUPPORT_WHATSAPP_NUMBER = "8801989379895";

export function ContactSupportModal({ isOpen, onClose }: ContactSupportModalProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => textareaRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    const text = encodeURIComponent(`Hello, I need help with this issue:\n\n${trimmed}`);
    window.open(`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${text}`, "_blank", "noopener,noreferrer");
    setMessage("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="contact-support-title"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close support"
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-default"
          />

          {/* Modal card */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #1e1a2e 0%, #1a1625 60%, #16121f 100%)",
              border: "1px solid rgba(139, 92, 246, 0.35)",
              boxShadow: "0 0 0 1px rgba(139,92,246,0.1), 0 32px 80px -12px rgba(0,0,0,0.8), 0 0 60px -20px rgba(139,92,246,0.4)",
            }}
          >
            {/* Top gradient accent bar */}
            <div className="h-[2px] w-full" style={{ background: "linear-gradient(90deg, transparent, #8b5cf6 40%, #a78bfa 60%, transparent)" }} />

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                  <LifeBuoy className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h2 id="contact-support-title" className="text-[15px] font-bold text-white leading-tight">
                    Contact Support
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    We'll open WhatsApp with your message
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: "rgba(255,255,255,0.4)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)", e.currentTarget.style.color = "white")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent", e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Divider */}
            <div className="mx-6 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

            {/* Form */}
            <form onSubmit={handleSend} className="px-6 pt-5 pb-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "rgba(167,139,250,0.8)" }}>
                  Describe your issue
                </label>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Tell us what's going wrong…"
                  className="w-full px-4 py-3 rounded-xl resize-none text-[13px] leading-relaxed transition-all outline-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#e2e8f0",
                  }}
                  onFocus={e => (e.currentTarget.style.border = "1px solid rgba(139,92,246,0.5)", e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.12)")}
                  onBlur={e => (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)", e.currentTarget.style.boxShadow = "none")}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)", e.currentTarget.style.color = "white")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent", e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!message.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
                  onMouseEnter={e => { if (message.trim()) e.currentTarget.style.background = "linear-gradient(135deg, #8b5cf6, #7c3aed)"; }}
                  onMouseLeave={e => (e.currentTarget.style.background = "linear-gradient(135deg, #7c3aed, #6d28d9)")}
                >
                  <MessageCircle className="w-4 h-4" />
                  Send via WhatsApp
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
