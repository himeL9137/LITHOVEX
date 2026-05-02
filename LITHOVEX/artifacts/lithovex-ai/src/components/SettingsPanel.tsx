import { useState, useMemo, useEffect } from "react";
import {
  X, Zap, BrainCircuit, Search, CheckCircle2, Key, Trash2,
  Code2, Bot, Server, ChevronDown, Thermometer, Hash, Percent,
  ExternalLink, Wrench, SlidersHorizontal, Activity,
} from "lucide-react";
import { Input } from "./ui/input";
import { PREMIUM_9_MODELS } from "@/lib/ai-models-config";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet";
import { useKeySlots, describeStatus, formatAgo } from "@/hooks/useKeySlots";

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  tier: "fast" | "expert";
  category: string;
}

export const HF_MODELS: ModelOption[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // PREMIUM 9 MODELS (Apr 2026): Act like their real APIs with system prompts
  // ─────────────────────────────────────────────────────────────────────────────
  ...PREMIUM_9_MODELS,

  // ─────────────────────────────────────────────────────────────────────────────
  // ORIGINAL MODELS
  // (LITHOVEX 2.5 Core / 2.6 Plus are pinned at the top via PREMIUM_9_MODELS.)
  // ─────────────────────────────────────────────────────────────────────────────
  { id: "Qwen/Qwen3-8B", label: "Qwen3 8B", description: "Compact Qwen3 powerhouse — everyday coding, multilingual analysis, and step-by-step reasoning at fast inference speeds. Uses hybrid think...", tier: "fast", category: "Qwen" },
  { id: "Qwen/Qwen3-14B", label: "Qwen3 14B", description: "Mid-size Qwen3 — balanced speed and intelligence. Strong on coding, analysis, and multilingual chat tasks.", tier: "fast", category: "Qwen" },
  { id: "Qwen/Qwen3-32B", label: "Qwen3 32B", description: "32B dense Qwen3 — excels at complex coding, mathematics, and deep multi-step reasoning. Top performer in its size class.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3-30B-A3B", label: "Qwen3 30B-A3B (MoE)", description: "MoE architecture — 30B total with only 3B active params. Efficient & smart: near 32B quality at near 3B speed.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3-48B-Instruct-2507", label: "Qwen3 48B Instruct (Jul 25)", description: "July 2025 Qwen3 48B instruct — updated instruction following, improved coding, and enhanced reasoning.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3-235B-A22B", label: "Qwen3 235B-A22B (MoE)", description: "Flagship Qwen3 — 235B total, 22B active. World-class reasoning, elite coding, 100+ languages. Rivals GPT-4o on most benchmarks.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3-235B-A22B-Instruct-2507", label: "Qwen3 235B-A22B (Jul 25)", description: "July 2025 updated Qwen3-235B — improved instruction following and enhanced capabilities over the base release.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3-235B-A22B-Thinking-2507", label: "Qwen3 235B Thinking (Jul 25)", description: "Thinking-mode Qwen3-235B — always uses extended chain-of-thought. Best for math olympiad problems, scientific reasoning, and agentic tasks.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3-VL-8B-Instruct", label: "Qwen3 VL 8B", description: "Latest Qwen3 vision-language model — understands images, charts, diagrams, and screenshots. Great for UI analysis and image-to-code.", tier: "fast", category: "Qwen" },
  { id: "Qwen/Qwen3-VL-235B-A22B-Thinking", label: "Qwen3 VL 235B Thinking", description: "Largest Qwen vision model — 235B with extended thinking. Elite for complex visual reasoning, scientific diagrams, and multimodal research.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3-Coder-Next", label: "Qwen3 Coder Next", description: "Next-gen Qwen Coder — agentic software engineering, repository-level code understanding, function calling, and autonomous bug fixing.", tier: "fast", category: "Qwen" },
  { id: "Qwen/Qwen3-Coder-Next-FP8", label: "Qwen3 Coder Next FP8", description: "FP8-quantized Qwen3 Coder Next — near-identical quality at lower cost and faster inference.", tier: "fast", category: "Qwen" },
  { id: "Qwen/Qwen3-Coder-30B-A3B-Instruct", label: "Qwen3 Coder 30B-A3B", description: "MoE code specialist — 30B total, 3B active. Excellent for agentic coding workflows, debugging, and multi-step programming tasks.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3-Coder-480B-A35B-Instruct", label: "Qwen3 Coder 480B", description: "Largest Qwen Coder — 480B params, 35B active, 256k context. The flagship for full-codebase agentic software engineering.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8", label: "Qwen3 Coder 480B FP8", description: "FP8 version of the flagship Qwen3 Coder 480B — same elite capabilities at reduced inference cost.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3-Next-80B-A3B-Instruct", label: "Qwen3 Next 80B-A3B", description: "Qwen3 Next 80B MoE — strong general-purpose model with 80B knowledge compressed into 3B active params.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3-Next-80B-A3B-Thinking", label: "Qwen3 Next 80B Thinking", description: "Thinking-mode Qwen3 Next 80B — extended chain-of-thought reasoning for math, science, and complex analysis.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen2.5-7B-Instruct", label: "Qwen2.5 7B Instruct", description: "Previous-gen Qwen2.5 7B — reliable, well-tested, excellent for general instructions, code, and structured output.", tier: "fast", category: "Qwen" },
  { id: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen2.5 72B Instruct", description: "Dense 72B Qwen2.5 — previous flagship, excellent across coding, writing, math, and analysis tasks.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen2.5-Coder-7B-Instruct", label: "Qwen2.5 Coder 7B", description: "Dedicated code model trained specifically on code. Best fast option for programming, bug fixing, and code review.", tier: "fast", category: "Qwen" },
  { id: "Qwen/Qwen2.5-Coder-32B-Instruct", label: "Qwen2.5 Coder 32B", description: "State-of-the-art code model from Qwen2.5 — leads HumanEval and coding benchmarks for 32B class.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen2.5-VL-7B-Instruct", label: "Qwen2.5 VL 7B", description: "Vision-language model — understands images, charts, documents, and screenshots. Great image-to-code and visual Q&A.", tier: "fast", category: "Qwen" },
  { id: "Qwen/Qwen2.5-VL-72B-Instruct", label: "Qwen2.5 VL 72B", description: "Expert-level vision-language model — understands complex images, charts, and documents with deep reasoning capabilities.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3.5-9B", label: "Qwen3.5 9B", description: "Qwen3.5 9B — updated general-purpose model with improved instruction following and creative capabilities.", tier: "fast", category: "Qwen" },
  { id: "Qwen/Qwen3.5-27B", label: "Qwen3.5 27B", description: "Qwen3.5 27B — well-rounded model excelling at creative writing, coding, and analytical tasks.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3.5-35B-A3B", label: "Qwen3.5 35B-A3B (MoE)", description: "MoE Qwen3.5 35B — 35B total, 3B active. Excellent general-purpose capabilities at MoE efficiency.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3.5-122B-A10B", label: "Qwen3.5 122B-A10B (MoE)", description: "Large MoE Qwen3.5 — 122B total, 10B active. Top-tier reasoning and writing at remarkable efficiency.", tier: "expert", category: "Qwen" },
  { id: "Qwen/Qwen3.5-397B-A17B", label: "Qwen3.5 397B-A17B (MoE)", description: "Massive Qwen3.5 MoE — 397B total, 17B active. Near-GPT-4o quality at significantly reduced inference cost.", tier: "expert", category: "Qwen" },
  { id: "deepseek-ai/DeepSeek-R1", label: "DeepSeek-R1", description: "Groundbreaking open reasoning model — rivals OpenAI o1 on math, science, and coding. Transparent chain-of-thought reasoning.", tier: "expert", category: "DeepSeek" },
  { id: "deepseek-ai/DeepSeek-R1-0528", label: "DeepSeek-R1 (May 28)", description: "May 2025 update to DeepSeek-R1 — improved reasoning depth, better code generation, and enhanced benchmark scores.", tier: "expert", category: "DeepSeek" },
  { id: "deepseek-ai/DeepSeek-V3", label: "DeepSeek-V3", description: "DeepSeek flagship chat & code model — top-tier on coding benchmarks, long context tasks, and instruction following.", tier: "expert", category: "DeepSeek" },
  { id: "deepseek-ai/DeepSeek-V3-0324", label: "DeepSeek-V3 (Mar 24)", description: "March 2024 DeepSeek-V3 checkpoint — improved coding and reasoning over the original V3 release.", tier: "expert", category: "DeepSeek" },
  { id: "deepseek-ai/DeepSeek-V3.1", label: "DeepSeek-V3.1", description: "DeepSeek-V3.1 — next iteration with improved instruction following, better coding, and stronger general capabilities.", tier: "expert", category: "DeepSeek" },
  { id: "deepseek-ai/DeepSeek-V3.1-Terminus", label: "DeepSeek-V3.1 Terminus", description: "Terminus edition of DeepSeek-V3.1 — enhanced for agentic workflows, tool use, and complex multi-step tasks.", tier: "expert", category: "DeepSeek" },
  { id: "deepseek-ai/DeepSeek-V3.2-Exp", label: "DeepSeek-V3.2 Exp", description: "Experimental V3.2 — leading SWE-bench scores. Frontier-level coding agent. Not stable release but exceptional performance.", tier: "expert", category: "DeepSeek" },
  { id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B", label: "DeepSeek-R1 Distill Qwen 1.5B", description: "Tiny R1 distillation — astonishing reasoning at 1.5B params. Perfect for local deployment and fast prototyping.", tier: "fast", category: "DeepSeek" },
  { id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B", label: "DeepSeek-R1 Distill Qwen 7B", description: "Fast chain-of-thought reasoning in a compact 7B package. Excellent math, logic, and code at low latency.", tier: "fast", category: "DeepSeek" },
  { id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B", label: "DeepSeek-R1 Distill Qwen 32B", description: "Powerful R1 distillation in a 32B package — matches GPT-4-class performance on math, science, and complex reasoning.", tier: "expert", category: "DeepSeek" },
  { id: "deepseek-ai/DeepSeek-R1-Distill-Llama-8B", label: "DeepSeek-R1 Distill Llama 8B", description: "Llama-based R1 distillation — fast reasoning using Llama-3 architecture backbone. Broadly compatible.", tier: "fast", category: "DeepSeek" },
  { id: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B", label: "DeepSeek-R1 Distill Llama 70B", description: "Large Llama-based R1 distillation — powerful reasoning across math, science, code, and complex analysis.", tier: "expert", category: "DeepSeek" },
  { id: "meta-llama/Llama-3.2-1B-Instruct", label: "Llama 3.2 1B Instruct", description: "Ultra-compact Llama 3.2 — 1B params with 128k context. Ideal for classification, extraction, and simple tasks at maximum speed.", tier: "fast", category: "Meta Llama" },
  { id: "meta-llama/Llama-3.1-8B-Instruct", label: "Llama 3.1 8B Instruct", description: "Meta's widely-used 8B open model with 128k context. Great general assistant, widely compatible, strong instruction following.", tier: "fast", category: "Meta Llama" },
  { id: "meta-llama/Llama-3.1-70B-Instruct", label: "Llama 3.1 70B Instruct", description: "Strong 70B Llama with 128k context — great for complex instruction following, writing, and coding tasks.", tier: "expert", category: "Meta Llama" },
  { id: "meta-llama/Llama-3.3-70B-Instruct", label: "Llama 3.3 70B Instruct", description: "Latest Llama-3.3 70B — exceptional instruction following, coding, and multilingual capabilities across 8 languages.", tier: "expert", category: "Meta Llama" },
  { id: "meta-llama/Meta-Llama-3-8B-Instruct", label: "Llama 3 8B Instruct", description: "Original Llama-3 8B — battle-tested, widely supported, great for general chat and simple coding tasks.", tier: "fast", category: "Meta Llama" },
  { id: "meta-llama/Meta-Llama-3-70B-Instruct", label: "Llama 3 70B Instruct", description: "Original Llama-3 70B — powerful open-weight model for complex reasoning, writing, and coding. 8k context.", tier: "expert", category: "Meta Llama" },
  { id: "meta-llama/Llama-4-Scout-17B-16E-Instruct", label: "Llama 4 Scout 17B (16 Experts)", description: "Llama-4 Scout — MoE model with 10M token context. Unmatched for massive documents, full codebases, and ultra-long tasks.", tier: "fast", category: "Meta Llama" },
  { id: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8", label: "Llama 4 Maverick 17B FP8 (128 Experts)", description: "Llama-4 Maverick — 128-expert MoE, 1M context, multimodal. Top performance on coding, reasoning, and visual tasks.", tier: "fast", category: "Meta Llama" },
  { id: "meta-llama/Llama-Guard-4-12B", label: "Llama Guard 4 12B", description: "Safety classifier — detects unsafe content in LLM inputs/outputs across 13 harm categories. Use for content moderation.", tier: "fast", category: "Meta Llama" },
  { id: "google/gemma-3n-E4B-it", label: "Gemma 3n E4B", description: "Ultra-compact edge model — runs on phones/devices. Best for simple Q&A, quick summaries, on-device applications.", tier: "fast", category: "Google" },
  { id: "google/gemma-3-27b-it", label: "Gemma 3 27B", description: "Google's Gemma-3 27B — excellent coding assistant with strong reasoning, multilingual support, and 128k context.", tier: "expert", category: "Google" },
  { id: "google/gemma-4-268-A4B-it", label: "Gemma 4 268B-A4B", description: "Large Gemma-4 MoE — 268B total, 4B active. Google's open model with multimodal capabilities and strong reasoning.", tier: "expert", category: "Google" },
  { id: "google/gemma-4-318-it", label: "Gemma 4 318B", description: "Google's largest open model — 318B. State-of-the-art on reasoning, coding, knowledge tasks, and multimodal understanding.", tier: "expert", category: "Google" },
  { id: "THUDM/GLM-5.1-FP8", label: "GLM-5.1 FP8", description: "GLM-5.1 with FP8 quantization — advanced reasoning model with strong Chinese/English bilingual performance.", tier: "fast", category: "Zhipu AI" },
  { id: "THUDM/GLM-5", label: "GLM-5", description: "GLM-5 flagship — powerful reasoning model with elite Chinese/English bilingual capabilities and agentic tool use.", tier: "fast", category: "Zhipu AI" },
  { id: "THUDM/GLM-4.5-Air", label: "GLM-4.5 Air", description: "Lightweight GLM-4.5 variant — fast responses for everyday tasks with excellent Chinese language support.", tier: "fast", category: "Zhipu AI" },
  { id: "THUDM/GLM-4.5", label: "GLM-4.5", description: "Full GLM-4.5 — flagship Zhipu model with deep Chinese/English reasoning and agentic capabilities.", tier: "fast", category: "Zhipu AI" },
  { id: "THUDM/GLM-4.5V", label: "GLM-4.5V (Vision)", description: "Vision-capable GLM-4.5 — understands images alongside text. Strong Chinese visual tasks and document analysis.", tier: "fast", category: "Zhipu AI" },
  { id: "THUDM/GLM-4.6", label: "GLM-4.6", description: "GLM-4.6 — strong Chinese/English bilingual model with tool use, function calling, and agentic capabilities.", tier: "fast", category: "Zhipu AI" },
  { id: "THUDM/GLM-4.6V", label: "GLM-4.6V (Vision)", description: "Vision-capable GLM-4.6 — understands images in Chinese and English. Great for Chinese visual tasks.", tier: "fast", category: "Zhipu AI" },
  { id: "THUDM/GLM-4.6V-Flash", label: "GLM-4.6V Flash", description: "Fast vision GLM-4.6 variant — quick image understanding for high-throughput visual applications.", tier: "fast", category: "Zhipu AI" },
  { id: "THUDM/GLM-4.7", label: "GLM-4.7", description: "GLM-4.7 — next iteration with improved reasoning, better code generation, and enhanced bilingual performance.", tier: "fast", category: "Zhipu AI" },
  { id: "THUDM/GLM-4.7-FP8", label: "GLM-4.7 FP8", description: "FP8-quantized GLM-4.7 — near-identical quality to GLM-4.7 at faster inference and lower cost.", tier: "fast", category: "Zhipu AI" },
  { id: "THUDM/GLM-4-32B-0414", label: "GLM-4 32B (Apr 14)", description: "Dense 32B GLM-4 — strong performer for coding, math, and complex Chinese/English reasoning tasks.", tier: "expert", category: "Zhipu AI" },
  { id: "THUDM/AutoGLM-Phone-9B-Multilingual", label: "AutoGLM Phone 9B", description: "Phone/device automation specialist — designed for mobile UI interaction, app control, and device automation tasks.", tier: "fast", category: "Zhipu AI" },
  { id: "CohereForAI/c4ai-command-r7b-12-2024", label: "Command R7B (Dec 24)", description: "Compact Cohere model — optimized for RAG, document search, and grounded generation at fast inference speeds.", tier: "fast", category: "Cohere" },
  { id: "CohereForAI/c4ai-command-r-08-2024", label: "Command R (Aug 24)", description: "Cohere Command R — powerful RAG and retrieval-focused model with excellent grounded generation and citation.", tier: "fast", category: "Cohere" },
  { id: "CohereForAI/c4ai-command-a-03-2025", label: "Command A (Mar 25)", description: "Cohere's enterprise flagship — 111B params, 256k context. Elite for long documents, agentic tasks, and enterprise RAG.", tier: "expert", category: "Cohere" },
  { id: "CohereForAI/command-a-reasoning-08-2025", label: "Command A Reasoning (Aug 25)", description: "Command A with extended reasoning — combines Cohere's enterprise features with chain-of-thought reasoning.", tier: "expert", category: "Cohere" },
  { id: "CohereForAI/command-a-translate-08-2025", label: "Command A Translate (Aug 25)", description: "Command A specialized for translation — enterprise-grade multilingual translation across 23+ languages.", tier: "expert", category: "Cohere" },
  { id: "CohereForAI/command-a-vision-07-2025", label: "Command A Vision (Jul 25)", description: "Command A with vision — processes images with enterprise-grade grounded generation. Great for document analysis.", tier: "expert", category: "Cohere" },
  { id: "CohereForAI/aya-expanse-32b", label: "Aya Expanse 32B", description: "Cohere's multilingual specialist — state-of-the-art performance in 23 languages. Ideal for global content generation.", tier: "expert", category: "Cohere" },
  { id: "CohereForAI/aya-vision-32b", label: "Aya Vision 32B", description: "Multilingual vision model — understands images in 23 languages. Unique cross-lingual visual capability.", tier: "expert", category: "Cohere" },
  { id: "moonshotai/Kimi-K2-Instruct", label: "Kimi-K2 Instruct", description: "Moonshot AI's flagship — 1T MoE param model with exceptional agentic coding, reasoning, and software engineering.", tier: "expert", category: "Moonshot AI" },
  { id: "moonshotai/Kimi-K2-Instruct-0905", label: "Kimi-K2 Instruct (Sep 5)", description: "September 2025 Kimi-K2 — updated with improved agentic performance and enhanced coding capabilities.", tier: "expert", category: "Moonshot AI" },
  { id: "moonshotai/Kimi-K2-Thinking", label: "Kimi-K2 Thinking", description: "Kimi-K2 with extended thinking — chain-of-thought for deep math, science, and complex problem solving.", tier: "expert", category: "Moonshot AI" },
  { id: "moonshotai/Kimi-k2.5", label: "Kimi-k2.5", description: "Faster Kimi variant — strong K2 capabilities at reduced inference cost. Great for agentic coding tasks.", tier: "fast", category: "Moonshot AI" },
  { id: "MiniMaxAI/MiniMax-M1-80k", label: "MiniMax-M1 (80k)", description: "MiniMax M1 reasoning model — linear attention architecture enabling very long context at scale with strong reasoning.", tier: "fast", category: "MiniMax" },
  { id: "MiniMaxAI/MiniMax-M2", label: "MiniMax-M2", description: "MiniMax M2 — improved reasoning and coding over M1 with better instruction following and general capabilities.", tier: "fast", category: "MiniMax" },
  { id: "MiniMaxAI/MiniMax-M2.1", label: "MiniMax-M2.1", description: "MiniMax M2.1 — incremental improvement over M2 with better coding performance and enhanced reasoning.", tier: "fast", category: "MiniMax" },
  { id: "MiniMaxAI/MiniMax-M2.5", label: "MiniMax-M2.5", description: "MiniMax M2.5 with 1M context — one of the longest context models available. Excellent for massive document analysis.", tier: "fast", category: "MiniMax" },
  { id: "MiniMaxAI/MiniMax-M2.7", label: "MiniMax-M2.7", description: "Latest MiniMax flagship — M2.7 with 1M+ context, frontier reasoning, and strong coding capabilities.", tier: "fast", category: "MiniMax" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", description: "Microsoft/OpenAI's open-source GPT model — 20B params optimized for chat, Q&A, and coding tasks.", tier: "expert", category: "Microsoft / OpenAI" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", description: "Microsoft/OpenAI's large OSS model — 120B params with strong performance on coding and reasoning benchmarks.", tier: "expert", category: "Microsoft / OpenAI" },
  { id: "openai/gpt-oss-safeguard-20b", label: "GPT-OSS Safeguard 20B", description: "Safety-focused 20B model — content moderation, policy enforcement, and safety classification tasks.", tier: "expert", category: "Microsoft / OpenAI" },
  { id: "NousResearch/Hermes-2-Pro-Llama-3-8B", label: "Hermes 2 Pro Llama3 8B", description: "Function-calling specialist — excellent at JSON mode, tool use, and structured outputs. Best for agentic workflows.", tier: "fast", category: "Nous Research" },
  { id: "Sao10K/L3-8B-Stheno-v3.2", label: "Stheno L3 8B v3.2", description: "Community creative writing model — fine-tuned Llama-3-8B for storytelling, roleplay, and creative fiction.", tier: "fast", category: "Sao10K" },
  { id: "Sao10K/L3-70B-Furyale-v2.1", label: "Furyale L3 70B v2.1", description: "Community creative powerhouse — fine-tuned Llama-3-70B for storytelling, character creation, and creative writing.", tier: "expert", category: "Sao10K" },
  { id: "Sao10K/L3-8B-Lunaris-v1", label: "Lunaris L3 8B v1", description: "Community creative 8B model — focused on expressive writing, emotional depth, and character immersion.", tier: "fast", category: "Sao10K" },
  { id: "allenai/Olmo-3-7B-Instruct", label: "OLMo-3 7B Instruct", description: "Fully open-source OLMo-3 — transparent training data, weights, and code. Ideal for research and reproducibility.", tier: "fast", category: "AllenAI" },
  { id: "WizardLM/WizardLM-2-8x22B", label: "WizardLM 2 8x22B", description: "WizardLM-2 8x22B MoE — excellent at following complex instructions, creative writing, and complex reasoning tasks.", tier: "expert", category: "WizardLM" },
  { id: "arcee-ai/Arch-Router-1.5B", label: "Arch Router 1.5B", description: "Tiny model router — classifies requests and routes to appropriate models. Use for intent classification and request routing.", tier: "fast", category: "Arcee AI" },
  { id: "baidu/ERNIE-4.5-21B-A3B-PT", label: "ERNIE 4.5 21B-A3B", description: "Baidu's ERNIE 4.5 21B MoE — efficient Chinese language model with broad knowledge and coding capabilities.", tier: "expert", category: "Baidu" },
  { id: "baidu/ERNIE-4.5-300B-A47B-Base-PT", label: "ERNIE 4.5 300B-A47B", description: "Baidu's flagship ERNIE — 300B MoE with elite Chinese language capabilities and broad reasoning.", tier: "expert", category: "Baidu" },
  { id: "baidu/ERNIE-4.5-VL-424B-A47B-Base-PT", label: "ERNIE 4.5 VL 424B", description: "Massive vision-language ERNIE — 424B MoE with vision capabilities. Elite Chinese multimodal understanding.", tier: "expert", category: "Baidu" },
  { id: "aisingapore/Gemma-SEA-LION-v4-27B-IT", label: "Gemma SEA-LION v4 27B", description: "Southeast Asian language specialist — optimized for Thai, Vietnamese, Indonesian, Malay, Filipino, and more.", tier: "expert", category: "AI Singapore" },
  { id: "aisingapore/Qwen-SEA-LION-v4-32B-IT", label: "Qwen SEA-LION v4 32B", description: "Qwen-based SEA-LION — stronger baseline with Qwen2.5 backbone for Southeast Asian languages and code.", tier: "expert", category: "AI Singapore" },
  { id: "mzj-1-instruct", label: "MZJ-1 Instruct", description: "Community instruction-tuned model — general-purpose chat and writing assistant.", tier: "fast", category: "Community" },
  { id: "CohereForAI/aya-water-tiny", label: "Aya Water (Tiny)", description: "Tiny Aya model — ultra-fast multilingual responses for simple tasks and high-throughput applications.", tier: "fast", category: "Cohere" },
  { id: "CohereForAI/aya-global-tiny", label: "Aya Global (Tiny)", description: "Tiny global Aya — multilingual quick responses with global language coverage at maximum speed.", tier: "fast", category: "Cohere" },
  { id: "CohereForAI/aya-earth-tiny", label: "Aya Earth (Tiny)", description: "Tiny Aya Earth — lightweight multilingual model for simple grounded tasks at minimal cost.", tier: "fast", category: "Cohere" },
  { id: "CohereForAI/aya-fire-tiny", label: "Aya Fire (Tiny)", description: "Tiny Aya Fire — fast multilingual model focused on creative and expressive responses.", tier: "fast", category: "Cohere" },
  { id: "kaist-ai/Apertus-70B-Instruct-2509", label: "Apertus 70B Instruct", description: "KAIST AI's 70B instruction model — strong reasoning and academic task performance.", tier: "expert", category: "KAIST AI" },
  { id: "Helsinki-NLP/EuroLLM-22B-Instruct-2512", label: "EuroLLM 22B Instruct", description: "European multilingual LLM — optimized for EU languages with strong performance across 24 European languages.", tier: "expert", category: "Helsinki NLP" },
  { id: "dicta-il/DictaLM-3.0-24B-Thinking", label: "DictaLM 3.0 24B Thinking", description: "Hebrew-specialized LLM with thinking mode — best model for Hebrew language tasks with chain-of-thought reasoning.", tier: "expert", category: "Dicta" },
  { id: "meta-llama/Meta-Llama-3.1-8B-Instruct", label: "Meta Llama 3.1 8B Instruct", description: "Meta's compact 8B chat model with 128k context — fast, broadly compatible, and a solid everyday assistant for general Q&A and instruction following.", tier: "fast", category: "meta-llama" },
  { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral 7B Instruct v0.3", description: "Mistral's polished 7B instruct model — efficient European open-weight chat with strong reasoning per parameter and native function-calling.", tier: "fast", category: "mistralai" },
  { id: "microsoft/Phi-3-mini-4k-instruct", label: "Phi-3 Mini 4K Instruct", description: "Microsoft's tiny 3.8B Phi-3 — punches far above its weight on reasoning and code, ideal for low-latency assistants and on-device deployment.", tier: "fast", category: "microsoft" },
  { id: "google/gemma-2-9b-it", label: "Gemma 2 9B IT", description: "Google's open Gemma-2 9B instruct — derived from Gemini research, excellent at concise answers, summaries, and lightweight chat.", tier: "fast", category: "google" },
  { id: "openchat/openchat-3.5-0106", label: "OpenChat 3.5 (0106)", description: "Community-trained OpenChat 3.5 — outperforms ChatGPT-3.5 on MT-Bench at just 7B params. Friendly, conversational tone.", tier: "fast", category: "openchat" },
  { id: "HuggingFaceH4/zephyr-7b-beta", label: "Zephyr 7B Beta", description: "Hugging Face's helpful assistant fine-tuned from Mistral-7B — known for clear, well-structured answers and great instruction following.", tier: "fast", category: "HuggingFaceH4" },
  { id: "tiiuae/falcon-7b-instruct", label: "Falcon 7B Instruct", description: "TII Abu Dhabi's open Falcon 7B — reliable general-purpose chat trained on 1.5T multilingual tokens. Great baseline assistant.", tier: "fast", category: "tiiuae" },
  { id: "facebook/bart-large-cnn", label: "BART Large CNN", description: "Meta's BART-Large fine-tuned on CNN/DailyMail — gold-standard for fluent abstractive summarization of news articles and long text.", tier: "fast", category: "facebook" },
  { id: "google/pegasus-xsum", label: "PEGASUS XSum", description: "Google's PEGASUS trained on the XSum dataset — produces extremely concise one-sentence summaries that capture the gist of a document.", tier: "fast", category: "google" },
  { id: "philschmid/bart-large-cnn-samsum", label: "BART CNN SAMSum", description: "BART-Large fine-tuned on the SAMSum dialogue dataset — purpose-built for summarizing chat conversations, meetings, and Slack threads.", tier: "fast", category: "philschmid" },
  { id: "facebook/wmt19-en-de", label: "WMT19 EN→DE", description: "Meta's WMT19 winning English-to-German translator — production-grade quality, especially strong on news and formal writing.", tier: "fast", category: "facebook" },
  { id: "Helsinki-NLP/opus-mt-en-zh", label: "Opus MT EN→ZH", description: "Helsinki-NLP's MarianMT trained on the OPUS corpus — fast, lightweight English-to-Chinese translation that runs well on CPU.", tier: "fast", category: "Helsinki NLP" },
  { id: "Helsinki-NLP/opus-mt-en-es", label: "Opus MT EN→ES", description: "Helsinki-NLP MarianMT for English-to-Spanish — natural, fluent translations of everyday text, articles, and short documents.", tier: "fast", category: "Helsinki NLP" },
  { id: "Helsinki-NLP/opus-mt-en-fr", label: "Opus MT EN→FR", description: "Helsinki-NLP MarianMT for English-to-French — high-quality formal and conversational translation with proper accents and grammar.", tier: "fast", category: "Helsinki NLP" },
  { id: "Helsinki-NLP/opus-mt-en-ru", label: "Opus MT EN→RU", description: "Helsinki-NLP MarianMT for English-to-Russian — handles Cyrillic morphology and produces natural, grammatical translations.", tier: "fast", category: "Helsinki NLP" },
  { id: "vennify/t5-base-grammar-correction", label: "T5 Grammar Correction", description: "T5-base fine-tuned to fix grammar, spelling, and punctuation — a Grammarly-style cleanup pass for sentences and short paragraphs.", tier: "fast", category: "vennify" },
  { id: "pszemraj/flan-t5-large-grammar-synthesis", label: "Flan-T5 Grammar Synthesis", description: "Flan-T5 Large tuned for full sentence rewriting — corrects grammar while preserving meaning, useful for ESL writing and email polish.", tier: "fast", category: "pszemraj" },
  { id: "cardiffnlp/twitter-roberta-base-sentiment", label: "Twitter RoBERTa Sentiment", description: "Cardiff NLP's RoBERTa fine-tuned on 124M tweets — classifies text as positive/neutral/negative. Best-in-class for social-media sentiment.", tier: "fast", category: "cardiffnlp" },
  { id: "nlptown/bert-base-multilingual-uncased-sentiment", label: "BERT Multilingual Sentiment", description: "Multilingual BERT trained to predict 1–5 star product-review ratings across English, Dutch, German, French, Spanish, and Italian.", tier: "fast", category: "nlptown" },
  { id: "distilbert-base-uncased-finetuned-sst-2-english", label: "DistilBERT SST-2", description: "DistilBERT fine-tuned on the SST-2 movie-review benchmark — fast, lightweight binary positive/negative sentiment classifier.", tier: "fast", category: "Community" },
  { id: "Qwen/Qwen2.5-Math-7B-Instruct", label: "Qwen2.5 Math 7B Instruct", description: "Alibaba's Qwen2.5 specialized for mathematics — excels at arithmetic, algebra, calculus, and step-by-step word problems with chain-of-thought.", tier: "fast", category: "Qwen" },
  { id: "gradientai/Llama-3-8B-Instruct-Gradient-1048k", label: "Llama 3 8B Gradient 1048K", description: "Llama-3 8B extended to a 1M-token context window by Gradient AI — read entire books, codebases, or massive log files in one prompt.", tier: "fast", category: "gradientai" },
  { id: "NousResearch/Hermes-2-Pro-Llama-3", label: "Hermes 2 Pro Llama 3", description: "Nous Research's Hermes 2 Pro — Llama-3 tuned for creative writing, role-play, and structured JSON/function-call output. Great storyteller.", tier: "fast", category: "NousResearch" },
  { id: "deepseek-ai/deepseek-coder-6.7b-instruct", label: "DeepSeek Coder 6.7B Instruct", description: "DeepSeek's compact code model trained on 2T tokens of code — strong at completion, refactoring, and bug fixes across 80+ languages.", tier: "fast", category: "deepseek-ai" },
  { id: "bigcode/starcoder2-15b", label: "StarCoder2 15B", description: "BigCode's StarCoder2 15B — trained on the Stack v2 with 600+ programming languages. Great for code completion and repository-level tasks.", tier: "fast", category: "bigcode" },
  { id: "codellama/CodeLlama-7b-Instruct-hf", label: "Code Llama 7B Instruct", description: "Meta's Code Llama 7B Instruct — Llama-2 specialized for code generation, with strong infill (FIM) support and 16k context.", tier: "fast", category: "codellama" },
  { id: "bigcode/santacoder", label: "SantaCoder", description: "BigCode's 1.1B SantaCoder — small, fast multi-language code model (Python/Java/JS) ideal for inline IDE completion at low latency.", tier: "fast", category: "bigcode" },
  { id: "mistralai/Codestral-22B-v0.1", label: "Codestral 22B v0.1", description: "Mistral's flagship 22B code model — speaks 80+ languages, excellent at code generation, debugging, fill-in-the-middle, and tests.", tier: "fast", category: "mistralai" },
  { id: "bigcode/starcoder", label: "StarCoder 15B", description: "Original BigCode StarCoder 15B trained on permissively-licensed GitHub code — strong at completion, docstring generation, and refactoring.", tier: "fast", category: "bigcode" },
  { id: "WizardLM/WizardCoder-15B-V1.0", label: "WizardCoder 15B V1.0", description: "WizardLM's Evol-Instruct tuned StarCoder — exceptionally good at explaining code, writing test cases, and producing well-commented snippets.", tier: "fast", category: "WizardLM" },
  { id: "defog/sqlcoder-7b-2", label: "SQLCoder 7B v2", description: "Defog's SQLCoder 7B — generates accurate SQL from natural-language questions over your database schema. Beats GPT-4 on SQL benchmarks.", tier: "fast", category: "defog" },
  { id: "bigcode/starcoderbase-1b", label: "StarCoderBase 1B", description: "BigCode's tiny 1B StarCoder base — quick shell-command suggestions, regex generation, and small one-line code completions.", tier: "fast", category: "bigcode" },
  { id: "black-forest-labs/FLUX.1-schnell", label: "FLUX.1 Schnell", description: "Black Forest Labs' FLUX.1 [schnell] — state-of-the-art open text-to-image at lightning speed (1–4 steps). Crisp photoreal & artistic output.", tier: "fast", category: "black-forest-labs" },
  { id: "stabilityai/stable-diffusion-xl-base-1.0", label: "Stable Diffusion XL 1.0", description: "Stability AI's SDXL base — reliable 1024×1024 photorealistic and artistic image generation with rich prompt understanding.", tier: "fast", category: "stabilityai" },
  { id: "runwayml/stable-diffusion-v1-5", label: "Stable Diffusion 1.5", description: "Runway's classic SD 1.5 — the most widely used open image model. Compatible with thousands of community LoRAs and ControlNets.", tier: "fast", category: "runwayml" },
  { id: "stabilityai/sdxl-turbo", label: "SDXL Turbo", description: "Stability AI's SDXL Turbo — single-step image generation in under a second. Optimized for real-time creative iteration.", tier: "fast", category: "stabilityai" },
  { id: "ByteDance/SDXL-Lightning", label: "SDXL Lightning", description: "ByteDance's SDXL Lightning — distilled SDXL that produces high-quality 1024×1024 images in just 2-8 inference steps.", tier: "fast", category: "ByteDance" },
  { id: "Salesforce/blip-image-captioning-large", label: "BLIP Image Captioning", description: "Salesforce BLIP-Large — describes images in natural English. Reliable workhorse for alt-text, image search, and content moderation.", tier: "fast", category: "Salesforce" },
  { id: "nlpconnect/vit-gpt2-image-captioning", label: "ViT-GPT2 Captioning", description: "ViT vision encoder paired with GPT-2 — fast, lightweight image captioning ideal for batch tagging and accessibility workflows.", tier: "fast", category: "nlpconnect" },
  { id: "vikp/surya_hocr", label: "Surya hOCR", description: "Surya's high-accuracy OCR — extracts text with bounding boxes from scanned pages, screenshots, and photos in 90+ languages.", tier: "fast", category: "vikp" },
  { id: "hustvl/yolos-small", label: "YOLOS Small", description: "Transformer-based YOLO — detects and labels objects in images using the COCO 80-class taxonomy. Compact and fast.", tier: "fast", category: "hustvl" },
  { id: "facebook/detr-resnet-50", label: "DETR ResNet-50", description: "Meta's DETR with a ResNet-50 backbone — end-to-end transformer object detector. Robust on cluttered scenes and complex layouts.", tier: "fast", category: "facebook" },
  { id: "PekingU/rtdetr_r50vd", label: "RT-DETR R50vd", description: "Peking University's real-time DETR — sub-30ms object detection at SOTA accuracy. Great for live video and edge inference.", tier: "fast", category: "PekingU" },
  { id: "facebook/sam-vit-base", label: "SAM ViT Base", description: "Meta's Segment Anything Model — click any point or draw a box, and SAM produces a precise pixel-level mask of that object.", tier: "fast", category: "facebook" },
  { id: "depth-anything/Depth-Anything-V2-Small", label: "Depth Anything V2 Small", description: "Depth Anything V2 — produces accurate monocular depth maps from a single 2D image. Useful for AR, 3D, and background blur effects.", tier: "fast", category: "depth-anything" },
  { id: "caidas/swin2SR-realworld-sr-x4-64-bsrgan-psnr", label: "Swin2SR 4× Upscaler", description: "Swin Transformer-based super-resolution — upscales real-world photos 4× while restoring detail, sharpening edges, and reducing noise.", tier: "fast", category: "caidas" },
  { id: "briaai/RMBG-1.4", label: "BRIA RMBG 1.4", description: "Bria AI's RMBG 1.4 — best-in-class background removal, producing clean transparent PNG cutouts of people, products, and objects.", tier: "fast", category: "briaai" },
  { id: "llava-hf/LLaVA-NeXT-Video-7B-hf", label: "LLaVA-NeXT Video 7B", description: "LLaVA-NeXT extended to video — analyses short clips frame-by-frame and answers natural-language questions about what happens.", tier: "fast", category: "llava-hf" },
  { id: "microsoft/xclip-base-patch32", label: "X-CLIP Base", description: "Microsoft X-CLIP — zero-shot video classification. Match a video to any natural-language label without retraining the model.", tier: "fast", category: "microsoft" },
  { id: "facebook/timesformer-base-finetuned-k400", label: "TimeSformer K400", description: "Meta's TimeSformer fine-tuned on Kinetics-400 — recognises 400 human actions in video clips (running, cooking, sports, etc.).", tier: "fast", category: "facebook" },
  { id: "ali-vilab/text-to-video-ms-1.7b", label: "ModelScope Text→Video 1.7B", description: "Alibaba's ModelScope T2V 1.7B — generates short video clips from text prompts. The original open-source text-to-video model.", tier: "fast", category: "ali-vilab" },
  { id: "cerspense/zeroscope_v2_576w", label: "Zeroscope V2 576w", description: "Cerspense Zeroscope V2 — produces 576×320 watermark-free videos from text. A community favourite for short artistic clips.", tier: "fast", category: "cerspense" },
  { id: "facebook/video-mae-base", label: "VideoMAE Base", description: "Meta's VideoMAE — masked autoencoder for video understanding. Foundation for action recognition and video classification tasks.", tier: "fast", category: "facebook" },
  { id: "MCG-NJU/videomae-base-finetuned-kinetics", label: "VideoMAE Kinetics", description: "VideoMAE fine-tuned on Kinetics-400 — accurate human-action recognition across 400 daily-life and sports activities.", tier: "fast", category: "MCG-NJU" },
  { id: "akhaliq/frame-interpolation-film", label: "FILM Frame Interpolation", description: "Google's FILM — synthesises smooth in-between frames from two photos. Turns a burst of stills into buttery-smooth slow-motion video.", tier: "fast", category: "akhaliq" },
  { id: "SebastianBodza/Video-LLaVA-v1.5-7B", label: "Video-LLaVA 7B", description: "Video-LLaVA v1.5 — unified vision-language model that captions short videos and answers questions about visual events over time.", tier: "fast", category: "SebastianBodza" },
  { id: "controlnet/control_v11p_sd15_openpose", label: "ControlNet OpenPose", description: "ControlNet OpenPose for SD 1.5 — guides image generation using a stick-figure pose skeleton. Pin characters into exact poses.", tier: "fast", category: "controlnet" },
  { id: "openai/whisper-large-v3", label: "Whisper Large V3", description: "OpenAI's flagship Whisper Large V3 — state-of-the-art multilingual speech-to-text. Highly accurate transcription across 99 languages.", tier: "fast", category: "openai" },
  { id: "openai/whisper-medium", label: "Whisper Medium", description: "OpenAI's Whisper Medium — balanced multilingual transcription model. Faster than Large with only a small accuracy trade-off.", tier: "fast", category: "openai" },
  { id: "distil-whisper/distil-large-v3", label: "Distil Whisper Large V3", description: "Hugging Face's Distil-Whisper — 6× faster than Whisper Large V3 and 49% smaller, with within-1% transcription accuracy. English-focused.", tier: "fast", category: "distil-whisper" },
  { id: "facebook/wav2vec2-base-960h", label: "Wav2Vec2 Base", description: "Meta's Wav2Vec2 trained on 960h of LibriSpeech — fast, lightweight English speech-to-text. Great when you need low-latency transcription.", tier: "fast", category: "facebook" },
  { id: "suno/bark", label: "Bark", description: "Suno's Bark — generative text-to-audio that produces realistic speech, music, ambience, and even non-verbal sounds like laughter or sighs.", tier: "fast", category: "suno" },
  { id: "facebook/mms-tts-eng", label: "MMS TTS English", description: "Meta's Massively Multilingual Speech — natural-sounding English text-to-speech. Part of a 1000+ language TTS family.", tier: "fast", category: "facebook" },
  { id: "microsoft/speecht5_tts", label: "SpeechT5 TTS", description: "Microsoft SpeechT5 — unified speech model for text-to-speech with speaker embedding support. Generate audio in any reference voice.", tier: "fast", category: "microsoft" },
  { id: "espnet/kan-bayashi_ljspeech_vits", label: "VITS LJSpeech", description: "ESPnet VITS trained on LJSpeech — produces clear, natural single-speaker English TTS. A research-grade open baseline.", tier: "fast", category: "espnet" },
  { id: "coqui/XTTS-v2", label: "Coqui XTTS v2", description: "Coqui XTTS v2 — clones any voice from just 6 seconds of audio. Multilingual TTS in 17 languages with cross-lingual voice transfer.", tier: "fast", category: "coqui" },
  { id: "myshell-ai/OpenVoice", label: "OpenVoice", description: "MyShell OpenVoice — instant voice cloning with fine-grained control over emotion, accent, rhythm, and style. 1-shot voice replication.", tier: "fast", category: "myshell-ai" },
  { id: "mit/ast-finetuned-audioset-10-10-0.4593", label: "AST AudioSet", description: "MIT Audio Spectrogram Transformer fine-tuned on AudioSet — classifies 527 sound events (music, speech, traffic, animals, etc.).", tier: "fast", category: "mit" },
  { id: "facebook/musicgen-small", label: "MusicGen Small", description: "Meta's MusicGen Small — generates short pieces of music from a text prompt or melody hum. The fast tier of Meta's music model family.", tier: "fast", category: "facebook" },
  { id: "stabilityai/stable-audio-open-1.0", label: "Stable Audio Open 1.0", description: "Stability AI's Stable Audio Open — generates up to 47 seconds of music, sound effects, or ambience from a text description.", tier: "fast", category: "stabilityai" },
  { id: "microsoft/speecht5_vc", label: "SpeechT5 Voice Conversion", description: "Microsoft SpeechT5 voice conversion — transforms a recording so it sounds like it was spoken by a different target voice.", tier: "fast", category: "microsoft" },
  { id: "pyannote/speaker-diarization", label: "Pyannote Diarization", description: "Pyannote's speaker diarization pipeline — identifies who spoke when in a multi-speaker recording (meetings, interviews, podcasts).", tier: "fast", category: "pyannote" },
  { id: "microsoft/trocr-base-printed", label: "TrOCR Printed", description: "Microsoft TrOCR for printed text — transformer OCR model that extracts text from clean printed documents, books, and screenshots.", tier: "fast", category: "microsoft" },
  { id: "microsoft/trocr-base-handwritten", label: "TrOCR Handwritten", description: "Microsoft TrOCR fine-tuned on handwriting — reads handwritten notes, journals, and forms with strong accuracy across cursive and print.", tier: "fast", category: "microsoft" },
  { id: "microsoft/layoutlmv3-base", label: "LayoutLMv3", description: "Microsoft LayoutLMv3 — combines text, layout, and image understanding for parsing forms, receipts, invoices, and structured documents.", tier: "fast", category: "microsoft" },
  { id: "naver-clova-ix/donut-base-finetuned-docvqa", label: "Donut DocVQA", description: "Naver Clova's Donut — OCR-free document understanding. Answers natural-language questions about scanned PDFs, receipts, and forms.", tier: "fast", category: "naver-clova-ix" },
  { id: "impira/layoutlm-document-qa", label: "LayoutLM Document QA", description: "Impira's LayoutLM Document QA — extract field values (e.g. invoice total, vendor, date) from PDFs by simply asking a question.", tier: "fast", category: "impira" },
  { id: "microsoft/table-transformer-detection", label: "Table Transformer", description: "Microsoft Table Transformer — finds tables inside PDFs and document images and isolates them for downstream extraction.", tier: "fast", category: "microsoft" },
  { id: "nielsr/donut-base-finetuned-rvlcdip", label: "Donut RVL-CDIP", description: "Donut fine-tuned on RVL-CDIP — classifies document images into 16 types (letter, invoice, resume, scientific paper, etc.).", tier: "fast", category: "nielsr" },
  { id: "facebook/nougat-small", label: "Nougat Small", description: "Meta's Nougat — converts academic PDFs into clean Markdown, preserving math equations, tables, and inline code blocks.", tier: "fast", category: "facebook" },
  { id: "microsoft/layoutlmv2-base-uncased", label: "LayoutLMv2", description: "Microsoft LayoutLMv2 — earlier-generation document AI well-suited for invoice parsing, key-value extraction, and form filling.", tier: "fast", category: "microsoft" },
  { id: "google/deplot", label: "DePlot", description: "Google DePlot — translates a chart or plot image into a structured table of underlying numbers. Pair with an LLM for chart Q&A.", tier: "fast", category: "google" },
  { id: "microsoft/layoutlm-base-uncased", label: "LayoutLM Base", description: "Microsoft's original LayoutLM — joint text + layout model for understanding forms, expense reports, and visually-rich documents.", tier: "fast", category: "microsoft" },
  { id: "togethercomputer/StripedHyena-Nous-7B", label: "StripedHyena Nous 7B", description: "Together AI × Nous Research StripedHyena 7B — Hyena/state-space hybrid architecture optimized for ultra-long-context document chat.", tier: "fast", category: "togethercomputer" },
  { id: "Salesforce/blip2-opt-2.7b", label: "BLIP-2 OPT 2.7B", description: "Salesforce BLIP-2 with OPT-2.7B — answers natural-language questions about an image (visual question answering).", tier: "fast", category: "Salesforce" },
  { id: "vikp/surya_det3", label: "Surya Det3", description: "Surya's text-line detector — locates text regions and signature blocks on scanned pages. Pairs with OCR for full document parsing.", tier: "fast", category: "vikp" },
  { id: "philschmid/flan-t5-base-samsum", label: "Flan-T5 SAMSum", description: "Flan-T5 base fine-tuned on SAMSum — produces concise bullet-point summaries of meeting transcripts and chat conversations.", tier: "fast", category: "philschmid" },
  { id: "llava-hf/llava-1.5-7b-hf", label: "LLaVA 1.5 7B", description: "LLaVA 1.5 7B — open multimodal chat model that can see images. Describe pictures, read screenshots, or analyse charts conversationally.", tier: "fast", category: "llava-hf" },
  { id: "Qwen/Qwen2-VL-7B-Instruct", label: "Qwen2 VL 7B Instruct", description: "Alibaba's Qwen2-VL 7B — strong open vision-language model. Reads documents, charts, and UI screenshots with chat-style follow-up.", tier: "fast", category: "Qwen" },
  { id: "cogvlm2-llama3-chat-19B", label: "CogVLM2 Llama-3 19B", description: "CogVLM2 19B built on Llama-3 — high-resolution image understanding with strong OCR and detailed visual reasoning capabilities.", tier: "fast", category: "Community" },
  { id: "HuggingFaceM4/idefics2-8b", label: "IDEFICS2 8B", description: "Hugging Face IDEFICS2 8B — multimodal chat model that handles arbitrary interleavings of text and images in the conversation.", tier: "fast", category: "HuggingFaceM4" },
  { id: "Salesforce/instructblip-vicuna-7b", label: "InstructBLIP Vicuna 7B", description: "Salesforce InstructBLIP on Vicuna 7B — strong visual reasoning and detailed image-grounded answer generation.", tier: "fast", category: "Salesforce" },
  { id: "deepseek-ai/deepseek-math-7b-instruct", label: "DeepSeek Math 7B Instruct", description: "DeepSeek's 7B model specialized for mathematics — strong on algebra, calculus, and competition problems with step-by-step solutions.", tier: "fast", category: "deepseek-ai" },
  { id: "allenai/unifiedqa-t5-large", label: "UnifiedQA T5 Large", description: "Allen AI UnifiedQA — single model that handles extractive, multiple-choice, yes/no, and abstractive question answering uniformly.", tier: "fast", category: "allenai" },
  { id: "google/flan-t5-xxl", label: "Flan-T5 XXL", description: "Google Flan-T5 XXL (11B) — instruction-tuned encoder-decoder. Excellent for fact-style Q&A, classification, and zero-shot reasoning.", tier: "fast", category: "google" },
  { id: "gradientai/Llama-3-8B-Instruct-Gradient-4194k", label: "Llama 3 8B Gradient 4194K", description: "Llama-3 8B extended to 4M tokens of context by Gradient AI — chat over entire libraries of documents in a single window.", tier: "fast", category: "gradientai" },
  { id: "OpenAssistant/oasst-sft-4-pythia-12b-epoch-3.5", label: "OpenAssistant Pythia 12B", description: "OpenAssistant's flagship open SFT model on Pythia 12B — community-built ChatGPT-style assistant trained on the OASST conversations dataset.", tier: "fast", category: "OpenAssistant" },
  { id: "gorilla-llm/gorilla-openfunctions-v2", label: "Gorilla OpenFunctions v2", description: "Berkeley Gorilla OpenFunctions v2 — purpose-built for accurate API function calling and tool use, rivaling GPT-4 on the Berkeley Function-Calling leaderboard.", tier: "fast", category: "gorilla-llm" },
  { id: "meetkai/functionary-medium-v2.2", label: "Functionary Medium v2.2", description: "MeetKai Functionary — chat model fine-tuned to reliably emit function-call JSON. Great for tool-using agents and structured output.", tier: "fast", category: "meetkai" },
  { id: "infly/INF-34B-Chat", label: "INF 34B Chat", description: "Infly INF 34B — bilingual English/Chinese chat model strong at structured data analysis, table reasoning, and business Q&A.", tier: "fast", category: "infly" },
  { id: "bigcode/starcoder2-15b-instruct-v0.1", label: "StarCoder2 15B Instruct", description: "BigCode's instruction-tuned StarCoder2 15B — agentic auto-coding, multi-file refactors, and natural-language-to-code generation.", tier: "fast", category: "bigcode" },
];

export const HF_MODEL_COUNT = HF_MODELS.length;

const KEY_LABELS = [
  { index: 1,  label: "Key 1",  email: "Himelhackerbd@gmail.com" },
  { index: 2,  label: "Key 2",  email: "himeliqbal7@gmail.com" },
  { index: 3,  label: "Key 3",  email: "himeliqbal704@gmail.com" },
  { index: 4,  label: "Key 4",  email: "kazianowaruliqbalhimel@gmail.com" },
  { index: 5,  label: "Key 5",  email: "kazianowaruliqbalhimeljunior@gmail.com" },
  { index: 6,  label: "Key 6",  email: "kiqbalhimel@gmail.com" },
  { index: 7,  label: "Key 7",  email: "abh24578@gmail.com" },
  { index: 8,  label: "Key 8",  email: "albabaliimam@gmail.com" },
  { index: 9,  label: "Key 9",  email: "HuggingFace account 9" },
  { index: 10, label: "Key 10", email: "HuggingFace account 10" },
  { index: 11, label: "Key 11", email: "HuggingFace account 11" },
];

const INFERENCE_PROVIDERS = [
  { id: "preferred",    label: "Preferred",                hint: "(your hf preference order)" },
  { id: "hf-serverless",label: "HuggingFace Serverless",   hint: "Free-tier shared GPU queue" },
  { id: "hf-dedicated", label: "HuggingFace Dedicated",    hint: "Dedicated production endpoints" },
  { id: "novita",       label: "Novita AI",                hint: "Cost-efficient open-weight GPUs" },
  { id: "together",     label: "Together AI",              hint: "High-throughput cluster" },
  { id: "deepinfra",    label: "DeepInfra",                hint: "Low-latency serverless" },
  { id: "fireworks",    label: "Fireworks AI",             hint: "Ultra-low latency" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "LITHOVEX":          "#a855f7",
  "Qwen":              "#a855f7",
  "DeepSeek":          "#3b82f6",
  "Meta Llama":        "#f97316",
  "Google":            "#22c55e",
  "GLM":               "#06b6d4",
  "Zhipu AI":          "#06b6d4",
  "Cohere":            "#ec4899",
  "Kimi":              "#6366f1",
  "MiniMax":           "#ef4444",
  "Microsoft":         "#0ea5e9",
  "ERNIE":             "#eab308",
  "Baidu":             "#eab308",
  // Premium 9 providers
  "OpenAI":            "#10a37f",
  "Anthropic":         "#d97757",
  "xAI":               "#000000",
  "Moonshot AI":       "#6366f1",
  // Additional open-source / commercial labs
  "Mistral AI":        "#fa520f",
  "Stability AI":      "#9333ea",
  "Hugging Face":      "#ffb800",
  "Salesforce":        "#00a1e0",
  "ByteDance":         "#000000",
  "TII":               "#0d6efd",
  "AllenAI":           "#1f6feb",
  "Nous Research":     "#22c55e",
  "Arcee AI":          "#7c3aed",
  "Black Forest Labs": "#0ea5e9",
  "BigCode":           "#22c55e",
  "Databricks":        "#ff3621",
  "Runway":            "#000000",
  "01.AI":             "#22c55e",
  "Perplexity":        "#1fb6ff",
  "Suno":              "#ec4899",
  "Together AI":       "#0ea5e9",
  "Gradient":          "#a855f7",
  "Bria AI":           "#f43f5e",
  "Coqui":             "#10b981",
  "OpenAssistant":     "#22c55e",
  "MyShell":           "#8b5cf6",
  "Naver":             "#22c55e",
  "MIT":               "#a31f34",
  "KAIST":             "#004ea2",
  "AI Singapore":      "#dc2626",
  "Defog":             "#0ea5e9",
  "Impira":            "#0ea5e9",
  "Gorilla LLM":       "#f59e0b",
  "Dicta":             "#0ea5e9",
  "Helsinki NLP":      "#0ea5e9",
  "ESPnet":            "#7c3aed",
  "Pyannote":          "#0ea5e9",
  "WizardLM":          "#a21caf",
  "OpenChat":          "#10b981",
  "Code Llama":        "#1877f2",
  "Distil Whisper":    "#10a37f",
  "ControlNet":        "#7c3aed",
  "LLaVA":             "#a855f7",
  "Depth Anything":    "#0ea5e9",
  "ali-vilab":         "#ff6a00",
  "PekingU":           "#7c0a02",
};

// Authentic provider logos served via DuckDuckGo's icon API
// (returns a clean square favicon for the brand's official domain).
// LITHOVEX uses our own brand asset shipped from /public.
//
// Lookup is case- and separator-insensitive (see ProviderLogo below), so a
// HuggingFace-style category like "meta-llama" resolves to the same entry as
// "Meta Llama", "openai" resolves to "OpenAI", etc.
const CATEGORY_LOGOS: Record<string, string> = {
  "LITHOVEX":          "/lithovex-logo-transparent.png",
  "Qwen":              "https://icons.duckduckgo.com/ip3/qwen.ai.ico",
  "DeepSeek":          "https://icons.duckduckgo.com/ip3/deepseek.com.ico",
  "Meta Llama":        "https://icons.duckduckgo.com/ip3/llama.com.ico",
  "Google":            "https://icons.duckduckgo.com/ip3/google.com.ico",
  "GLM":               "https://icons.duckduckgo.com/ip3/bigmodel.cn.ico",
  "Zhipu AI":          "https://icons.duckduckgo.com/ip3/bigmodel.cn.ico",
  "Cohere":            "https://icons.duckduckgo.com/ip3/cohere.com.ico",
  "Kimi":              "https://icons.duckduckgo.com/ip3/moonshot.cn.ico",
  "MiniMax":           "https://icons.duckduckgo.com/ip3/minimax.io.ico",
  "Microsoft":         "https://icons.duckduckgo.com/ip3/microsoft.com.ico",
  "ERNIE":             "https://icons.duckduckgo.com/ip3/baidu.com.ico",
  "Baidu":             "https://icons.duckduckgo.com/ip3/baidu.com.ico",
  // Premium 9 providers
  "OpenAI":            "https://icons.duckduckgo.com/ip3/openai.com.ico",
  "Anthropic":         "https://icons.duckduckgo.com/ip3/anthropic.com.ico",
  "xAI":               "https://icons.duckduckgo.com/ip3/x.ai.ico",
  "Moonshot AI":       "https://icons.duckduckgo.com/ip3/moonshot.cn.ico",
  // Additional open-source / commercial labs commonly seen in HF_MODELS
  "Mistral AI":        "https://icons.duckduckgo.com/ip3/mistral.ai.ico",
  "Stability AI":      "https://icons.duckduckgo.com/ip3/stability.ai.ico",
  "Hugging Face":      "https://icons.duckduckgo.com/ip3/huggingface.co.ico",
  "Salesforce":        "https://icons.duckduckgo.com/ip3/salesforce.com.ico",
  "ByteDance":         "https://icons.duckduckgo.com/ip3/bytedance.com.ico",
  "TII":               "https://icons.duckduckgo.com/ip3/tii.ae.ico",
  "AllenAI":           "https://icons.duckduckgo.com/ip3/allenai.org.ico",
  "Nous Research":     "https://icons.duckduckgo.com/ip3/nousresearch.com.ico",
  "Arcee AI":          "https://icons.duckduckgo.com/ip3/arcee.ai.ico",
  "Black Forest Labs": "https://icons.duckduckgo.com/ip3/blackforestlabs.ai.ico",
  "BigCode":           "https://icons.duckduckgo.com/ip3/bigcode-project.org.ico",
  "Databricks":        "https://icons.duckduckgo.com/ip3/databricks.com.ico",
  "Runway":            "https://icons.duckduckgo.com/ip3/runwayml.com.ico",
  "01.AI":             "https://icons.duckduckgo.com/ip3/01.ai.ico",
  "Perplexity":        "https://icons.duckduckgo.com/ip3/perplexity.ai.ico",
  // Additional orgs that appear in HF_MODELS
  "Suno":              "https://icons.duckduckgo.com/ip3/suno.ai.ico",
  "Together AI":       "https://icons.duckduckgo.com/ip3/together.ai.ico",
  "Gradient":          "https://icons.duckduckgo.com/ip3/gradient.ai.ico",
  "Bria AI":           "https://icons.duckduckgo.com/ip3/bria.ai.ico",
  "Coqui":             "https://icons.duckduckgo.com/ip3/coqui.ai.ico",
  "OpenAssistant":     "https://icons.duckduckgo.com/ip3/open-assistant.io.ico",
  "MyShell":           "https://icons.duckduckgo.com/ip3/myshell.ai.ico",
  "Naver":             "https://icons.duckduckgo.com/ip3/naver.com.ico",
  "MIT":               "https://icons.duckduckgo.com/ip3/mit.edu.ico",
  "KAIST":             "https://icons.duckduckgo.com/ip3/kaist.ac.kr.ico",
  "AI Singapore":      "https://icons.duckduckgo.com/ip3/aisingapore.org.ico",
  "Defog":             "https://icons.duckduckgo.com/ip3/defog.ai.ico",
  "Impira":            "https://icons.duckduckgo.com/ip3/impira.com.ico",
  "Gorilla LLM":       "https://icons.duckduckgo.com/ip3/gorilla.cs.berkeley.edu.ico",
  "Dicta":             "https://icons.duckduckgo.com/ip3/dicta.org.il.ico",
  "Helsinki NLP":      "https://icons.duckduckgo.com/ip3/helsinki.fi.ico",
  "ESPnet":            "https://icons.duckduckgo.com/ip3/espnet.github.io.ico",
  "Pyannote":          "https://icons.duckduckgo.com/ip3/pyannote.github.io.ico",
  "WizardLM":          "https://icons.duckduckgo.com/ip3/microsoft.com.ico",
  "OpenChat":          "https://icons.duckduckgo.com/ip3/openchat.team.ico",
  "Code Llama":        "https://icons.duckduckgo.com/ip3/llama.com.ico",
  "Distil Whisper":    "https://icons.duckduckgo.com/ip3/openai.com.ico",
  "ControlNet":        "https://icons.duckduckgo.com/ip3/huggingface.co.ico",
  "LLaVA":             "https://icons.duckduckgo.com/ip3/llava-vl.github.io.ico",
  "Depth Anything":    "https://icons.duckduckgo.com/ip3/huggingface.co.ico",
  "ali-vilab":         "https://icons.duckduckgo.com/ip3/alibaba.com.ico",
  "PekingU":           "https://icons.duckduckgo.com/ip3/pku.edu.cn.ico",
};

// Default for any HF-hosted research-org / user-account category we don't
// recognise — show the Hugging Face avatar so it still looks like a real logo
// instead of a coloured initial.
const DEFAULT_LOGO_URL = "https://icons.duckduckgo.com/ip3/huggingface.co.ico";

// Normalize a category key for lookup: lowercase + strip spaces/hyphens/dots/slashes.
// This lets HuggingFace-style ids (e.g. "meta-llama", "deepseek-ai", "stabilityai",
// "mistralai", "facebook", "openai") resolve to the same logo as their pretty-name
// counterparts ("Meta Llama", "DeepSeek", "Stability AI", "Mistral AI", "Microsoft",
// "OpenAI"). Aliases handle a few brand → org renames.
const norm = (s: string) => s.toLowerCase().replace(/[\s\-_./]/g, "");

const CATEGORY_ALIASES: Record<string, string> = {
  "metallama":         "Meta Llama",
  "facebook":          "Meta Llama",
  "codellama":         "Code Llama",
  "deepseekai":        "DeepSeek",
  "stabilityai":       "Stability AI",
  "stableai":          "Stability AI",
  "mistralai":         "Mistral AI",
  "tiiuae":            "TII",
  "allenai":           "AllenAI",
  "nousresearch":      "Nous Research",
  "blackforestlabs":   "Black Forest Labs",
  "bigcode":           "BigCode",
  "huggingfaceh4":     "Hugging Face",
  "huggingfacem4":     "Hugging Face",
  "huggingface":       "Hugging Face",
  "microsoftopenai":   "Microsoft",
  "googledeepmind":    "Google",
  "kimik":             "Moonshot AI",
  // New aliases
  "togethercomputer":  "Together AI",
  "together":          "Together AI",
  "gradientai":        "Gradient",
  "briaai":            "Bria AI",
  "coqui":             "Coqui",
  "openassistant":     "OpenAssistant",
  "myshellai":         "MyShell",
  "navercloavix":      "Naver",
  "naverclovaix":      "Naver",
  "mit":               "MIT",
  "kaistai":           "KAIST",
  "aisingapore":       "AI Singapore",
  "defog":             "Defog",
  "impira":            "Impira",
  "gorillallm":        "Gorilla LLM",
  "dicta":             "Dicta",
  "helsinkinlp":       "Helsinki NLP",
  "espnet":            "ESPnet",
  "pyannote":          "Pyannote",
  "wizardlm":          "WizardLM",
  "openchat":          "OpenChat",
  "distilwhisper":     "Distil Whisper",
  "controlnet":        "ControlNet",
  "llavahf":           "LLaVA",
  "depthanything":     "Depth Anything",
  "alivilab":          "ali-vilab",
  "pekingu":           "PekingU",
  "runwayml":          "Runway",
  "suno":              "Suno",
};

const NORMALIZED_LOGOS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(CATEGORY_LOGOS)) out[norm(k)] = v;
  for (const [k, target] of Object.entries(CATEGORY_ALIASES)) {
    if (CATEGORY_LOGOS[target]) out[k] = CATEGORY_LOGOS[target];
  }
  return out;
})();

const NORMALIZED_COLORS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(CATEGORY_COLORS)) out[norm(k)] = v;
  for (const [k, target] of Object.entries(CATEGORY_ALIASES)) {
    if (CATEGORY_COLORS[target]) out[k] = CATEGORY_COLORS[target];
  }
  return out;
})();

export function ProviderLogo({
  category, size = 16, className = "",
}: { category?: string; size?: number; className?: string }) {
  const [errored, setErrored] = useState(false);
  const cat = category ?? "";
  const key = norm(cat);
  // 1. Direct match  2. Normalized/alias match  3. Hugging Face default
  //    (every model in HF_MODELS is HF-hosted, so this gives a real logo
  //     even for small research-org accounts we don't recognise).
  const url =
    (cat && CATEGORY_LOGOS[cat]) ?? NORMALIZED_LOGOS[key] ?? DEFAULT_LOGO_URL;
  const color =
    (cat && CATEGORY_COLORS[cat]) ?? NORMALIZED_COLORS[key] ?? "#a855f7";
  if (!url || errored) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 ${className}`}
        style={{ width: size, height: size, backgroundColor: color, fontSize: Math.max(8, size * 0.5) }}
      >
        {(cat[0] ?? "?").toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={`${cat || "model"} logo`}
      onError={() => setErrored(true)}
      loading="lazy"
      className={`rounded-full object-contain bg-white/5 shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

type RightTab = "params" | "keys" | "tools";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  model: string;
  setModel: (m: string) => void;
  hfKeyIndex: number;
  setHfKeyIndex: (k: number) => void;
  temperature: number;
  setTemperature: (t: number) => void;
  topP: number;
  setTopP: (p: number) => void;
  maxTokens: number;
  setMaxTokens: (n: number) => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (v: boolean) => void;
  autoCodeMode: boolean;
  setAutoCodeMode: (v: boolean) => void;
  autoDecisionMode: boolean;
  setAutoDecisionMode: (v: boolean) => void;
  expertMode: boolean;
  setExpertMode: (v: boolean) => void;
  onClearAll: () => void;
}

// ─── Read-only key list for OpenRouter / Gemini ─────────────────────────
// HF keys are user-selectable (legacy behaviour); OR + Gemini are managed
// purely server-side. This component renders one row per configured key
// with the same live "in use" indicator the HF list uses.
function ProviderKeySection({
  title,
  subtitle,
  accent,
  slots,
  activeIndex,
  liveNow,
}: {
  title: string;
  subtitle: string;
  accent: "violet" | "sky";
  slots: ReturnType<typeof useKeySlots>["byProvider"]["openrouter"];
  activeIndex: number | null;
  liveNow: number;
}) {
  const accentClasses =
    accent === "violet"
      ? {
          dot: "from-violet-500 to-fuchsia-600",
          text: "text-violet-300",
        }
      : {
          dot: "from-sky-500 to-cyan-600",
          text: "text-sky-300",
        };

  const configuredCount = slots.filter((s) => s.configured).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            {title}
          </h4>
          <p className="text-[10px] text-zinc-500">{subtitle}</p>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <Activity className="w-3 h-3" />
          {activeIndex != null ? (
            <span className="text-emerald-400 font-semibold">
              Key {activeIndex} live
            </span>
          ) : (
            <span className="italic">
              {configuredCount > 0 ? "ready" : "none configured"}
            </span>
          )}
        </span>
      </div>

      {configuredCount === 0 ? (
        <div className="px-3 py-2.5 rounded-xl border border-white/8 bg-white/[0.02] text-[11px] text-zinc-500 italic">
          No {title} keys configured on the server.
        </div>
      ) : (
        <div className="space-y-1.5">
          {slots
            .filter((s) => s.configured)
            .map((slot) => {
              const status = describeStatus(slot);
              const isLive = activeIndex === slot.index;
              return (
                <div
                  key={`${title}-key-${slot.index}`}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left relative ${
                    isLive
                      ? "border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                      : "border-white/8 bg-white/[0.02]"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isLive
                        ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                        : `bg-gradient-to-br ${accentClasses.dot} text-white`
                    }`}
                  >
                    {slot.index}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-xs font-semibold truncate ${
                          isLive ? "text-emerald-300" : accentClasses.text
                        }`}
                      >
                        {title} key #{slot.index}
                      </p>
                      {isLive && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-bold text-emerald-300 uppercase tracking-wide shrink-0">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                          </span>
                          In use
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      <span className={status.text}>{status.label}</span>
                      <span className="text-zinc-600">·</span>
                      <span className="text-zinc-500">
                        {formatAgo(slot.lastUsed ?? null, liveNow)}
                      </span>
                      {slot.cooldownRemainingMs != null && slot.cooldownRemainingMs > 0 && (
                        <>
                          <span className="text-zinc-600">·</span>
                          <span className="text-amber-400/80">
                            cools in {Math.ceil(slot.cooldownRemainingMs / 1000)}s
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({
  isOpen, onClose,
  model, setModel,
  hfKeyIndex, setHfKeyIndex,
  temperature, setTemperature,
  topP, setTopP,
  maxTokens, setMaxTokens,
  webSearchEnabled, setWebSearchEnabled,
  autoCodeMode, setAutoCodeMode,
  autoDecisionMode, setAutoDecisionMode,
  expertMode, setExpertMode,
  onClearAll,
}: SettingsPanelProps) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | "fast" | "expert">("all");
  const [provider, setProvider] = useState("preferred");
  const [providerOpen, setProviderOpen] = useState(false);
  const [tab, setTab] = useState<RightTab>("params");
  const [enableTemp, setEnableTemp] = useState(true);
  const [enableMaxTokens, setEnableMaxTokens] = useState(true);
  const [enableTopP, setEnableTopP] = useState(true);
  const isMobile = useIsMobile();

  // Live key health — only polls while the API Keys tab is visible.
  const {
    slots: keySlots,
    byProvider: keysByProvider,
    activeIndex: liveActiveKey,
    activeByProvider: liveActiveByProvider,
    now: liveNow,
  } = useKeySlots(isOpen && tab === "keys");

  const filtered = useMemo(() => HF_MODELS.filter((m) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      m.label.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q);
    const matchTier = tierFilter === "all" || m.tier === tierFilter;
    return matchSearch && matchTier;
  }), [search, tierFilter]);

  const selected = HF_MODELS.find((m) => m.id === model) ?? HF_MODELS[0];
  const [creator, modelName] = useMemo(() => {
    const parts = (selected?.id ?? "").split("/");
    return parts.length > 1 ? [parts[0], parts[1]] : ["", parts[0] ?? ""];
  }, [selected]);
  const accent = CATEGORY_COLORS[selected?.category ?? ""] ?? "#a855f7";

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const body = (
    <>
      {/* Header */}
      <div
        className={`flex items-start justify-between border-b border-white/8 shrink-0 ${
          isMobile ? "px-4 py-3 sticky top-0 z-20 bg-[#0e0e10]" : "px-6 py-4"
        }`}
      >
        <div>
          <h2 className={`font-semibold text-white ${isMobile ? "text-base" : "text-lg"}`}>
            Model Settings
          </h2>
          <p className={`text-zinc-500 mt-0.5 ${isMobile ? "text-[11px]" : "text-xs"}`}>
            Manage your model settings.
          </p>
        </div>
        <button
          onClick={onClose}
          className={`rounded-lg text-zinc-400 hover:text-white hover:bg-white/8 transition-colors inline-flex items-center justify-center ${
            isMobile ? "h-11 w-11" : "p-1.5"
          }`}
          aria-label="Close"
        >
          <X className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
        </button>
      </div>

      <div
        className={`flex-1 min-h-0 ${
          isMobile
            ? "grid grid-cols-1 grid-rows-[auto_1fr] overflow-hidden"
            : "grid grid-cols-[260px_1fr]"
        }`}
      >
        {/* ── Left: Model list ─────────────────────────────────────────── */}
        <aside
          className={`flex flex-col min-h-0 ${
            isMobile
              ? "border-b border-white/8 max-h-[36dvh]"
              : "border-r border-white/8"
          }`}
        >
          <div className={`shrink-0 ${isMobile ? "p-3 sticky top-0 bg-[#0e0e10] z-10" : "p-3"}`}>
            <div className="relative">
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 ${
                  isMobile ? "w-4 h-4" : "w-3.5 h-3.5"
                }`}
              />
              <Input
                placeholder="Search models"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-indigo-500/50 rounded-lg ${
                  isMobile ? "pl-9 h-11 text-[15px]" : "pl-8 h-9 text-xs"
                }`}
                style={isMobile ? { fontSize: "16px" } : undefined}
              />
            </div>
            <div className="flex gap-1 mt-2">
              {(["all", "fast", "expert"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={`flex-1 rounded-md font-semibold uppercase tracking-wide transition-colors ${
                    isMobile ? "h-11 text-[11px]" : "h-6 text-[10px]"
                  } ${
                    tierFilter === t
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                      : "bg-white/5 text-zinc-500 border border-white/8 hover:border-white/15"
                  }`}
                >
                  {t === "all" ? `All ${HF_MODELS.length}` : t}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`flex-1 overflow-y-auto ${isMobile ? "px-2 pb-3 space-y-1" : "px-2 pb-3 space-y-0.5"}`}
            style={isMobile ? ({ WebkitOverflowScrolling: "touch" } as React.CSSProperties) : undefined}
          >
            {filtered.map((m) => {
              const isActive = m.id === model;
              return (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`w-full flex items-center gap-2 rounded-lg text-left transition-colors group ${
                    isMobile ? "px-3 py-2.5 min-h-[52px]" : "px-2.5 py-2"
                  } ${
                    isActive
                      ? "bg-indigo-600/15 text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                  title={m.id}
                >
                  <ProviderLogo category={m.category} size={isMobile ? 24 : 18} />
                  <span className={`flex-1 min-w-0 flex flex-col ${isMobile ? "" : "truncate"}`}>
                    <span
                      className={`font-medium truncate ${
                        isMobile ? "text-[14px] leading-tight" : "text-xs"
                      }`}
                    >
                      {isMobile ? m.label : `${m.id.split("/")[0]}/ ${m.label}`}
                    </span>
                    {isMobile && (
                      <span className="text-[11px] text-zinc-500 truncate mt-0.5">
                        {m.id.split("/")[0]}
                      </span>
                    )}
                  </span>
                  {m.tier === "fast" ? (
                    <Zap className={`text-blue-400/70 shrink-0 ${isMobile ? "w-4 h-4" : "w-3 h-3"}`} />
                  ) : (
                    <BrainCircuit className={`text-purple-400/70 shrink-0 ${isMobile ? "w-4 h-4" : "w-3 h-3"}`} />
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-xs text-zinc-600 py-6">No models match.</p>
            )}
          </div>
        </aside>

        {/* ── Right: Selected model details ────────────────────────────── */}
        <section className="flex flex-col min-h-0">
          {/* Selected model header */}
          <div
            className={`flex items-center justify-between border-b border-white/8 shrink-0 ${
              isMobile ? "px-4 py-3 sticky top-0 bg-[#0e0e10] z-10" : "px-6 py-4"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <ProviderLogo
                category={selected?.category ?? ""}
                size={isMobile ? 32 : 36}
                className="shadow-lg"
              />
              <div className="min-w-0">
                <div
                  className={`font-semibold text-white truncate ${
                    isMobile ? "text-[15px]" : "text-sm"
                  }`}
                >
                  {selected?.label ?? modelName}
                </div>
                <div className={`text-zinc-500 truncate ${isMobile ? "text-[12px]" : "text-[11px]"}`}>
                  by {creator || "—"}
                </div>
              </div>
            </div>
            <a
              href={`https://huggingface.co/${selected?.id ?? ""}`}
              target="_blank"
              rel="noreferrer"
              className={`rounded-lg text-zinc-400 hover:text-white hover:bg-white/8 transition-colors inline-flex items-center justify-center ${
                isMobile ? "h-11 w-11" : "p-2"
              }`}
              title="Open on HuggingFace"
            >
              <ExternalLink className={isMobile ? "w-4 h-4" : "w-3.5 h-3.5"} />
            </a>
          </div>

          {/* Tabs */}
          <div
            className={`flex border-b border-white/8 shrink-0 ${
              isMobile ? "px-2 sticky top-[calc(env(safe-area-inset-top,0px))] bg-[#0e0e10] z-10 overflow-x-auto" : "px-6"
            }`}
            style={isMobile ? ({ WebkitOverflowScrolling: "touch" } as React.CSSProperties) : undefined}
          >
            {([
              { id: "params" as const, label: "Parameters",   icon: SlidersHorizontal },
              { id: "keys"   as const, label: "API Keys",      icon: Key },
              { id: "tools"  as const, label: "Tools",         icon: Wrench },
            ]).map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center justify-center gap-1.5 font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                    isMobile ? "flex-1 min-h-[44px] py-3 px-3 text-[13px]" : "py-2.5 px-3 text-xs"
                  } ${
                    active
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Icon className={isMobile ? "w-4 h-4" : "w-3.5 h-3.5"} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div
            className={`flex-1 overflow-y-auto ${
              isMobile ? "px-4 py-4 space-y-4" : "px-6 py-5 space-y-4"
            }`}
            style={isMobile ? ({ WebkitOverflowScrolling: "touch", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" } as React.CSSProperties) : undefined}
          >
              {tab === "params" && (
                <>
                  {/* Inference Provider */}
                  <div className="p-4 rounded-xl border border-white/8 bg-white/[0.02]">
                    <div className="text-sm font-semibold text-white mb-1">Inference provider</div>
                    <div className="text-[11px] text-zinc-500 mb-3">
                      Choose which Inference Provider to use with this model
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setProviderOpen((o) => !o)}
                        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/30 text-sm text-zinc-100 hover:border-amber-500/50 transition-colors"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Server className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="font-medium">
                            {INFERENCE_PROVIDERS.find((p) => p.id === provider)?.label}
                          </span>
                          <span className="text-[11px] text-zinc-500 truncate">
                            {INFERENCE_PROVIDERS.find((p) => p.id === provider)?.hint}
                          </span>
                        </span>
                        <ChevronDown className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform ${providerOpen ? "rotate-180" : ""}`} />
                      </button>
                      {providerOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-10 bg-[#161618] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
                          {INFERENCE_PROVIDERS.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => { setProvider(p.id); setProviderOpen(false); }}
                              className={`w-full flex flex-col items-start gap-0.5 px-3.5 py-2.5 text-left hover:bg-white/5 transition-colors ${
                                p.id === provider ? "bg-indigo-600/10 text-indigo-300" : "text-zinc-200"
                              }`}
                            >
                              <span className="text-xs font-medium">{p.label}</span>
                              <span className="text-[10px] text-zinc-500">{p.hint}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Temperature */}
                  <ParamCard
                    icon={<Thermometer className="w-4 h-4 text-rose-400" />}
                    title="Temperature"
                    desc="Tunes the creativity vs. predictability trade-off."
                    enabled={enableTemp}
                    onToggle={setEnableTemp}
                    value={temperature.toFixed(2)}
                  >
                    <input
                      type="range" min={0} max={2} step={0.01} value={temperature}
                      disabled={!enableTemp}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full accent-rose-500 cursor-pointer disabled:opacity-40"
                    />
                  </ParamCard>

                  {/* Max Tokens */}
                  <ParamCard
                    icon={<Hash className="w-4 h-4 text-blue-400" />}
                    title="Max Tokens"
                    desc="Sets the absolute limit for generated content length."
                    enabled={enableMaxTokens}
                    onToggle={setEnableMaxTokens}
                    value={maxTokens >= 1024 ? `${(maxTokens / 1024).toFixed(1)}k` : String(maxTokens)}
                  >
                    <input
                      type="range" min={256} max={32768} step={256} value={maxTokens}
                      disabled={!enableMaxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer disabled:opacity-40"
                    />
                  </ParamCard>

                  {/* Top-P */}
                  <ParamCard
                    icon={<Percent className="w-4 h-4 text-emerald-400" />}
                    title="Top-P"
                    desc="Nucleus sampling — controls diversity of token choice."
                    enabled={enableTopP}
                    onToggle={setEnableTopP}
                    value={topP.toFixed(2)}
                  >
                    <input
                      type="range" min={0} max={1} step={0.01} value={topP}
                      disabled={!enableTopP}
                      onChange={(e) => setTopP(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer disabled:opacity-40"
                    />
                  </ParamCard>
                </>
              )}

              {tab === "keys" && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    Provider priority: OpenRouter → Gemini → HuggingFace. Keys rotate automatically on rate limits.
                  </p>

                  {/* ── OpenRouter ─────────────────────────────────────── */}
                  <ProviderKeySection
                    title="OpenRouter"
                    subtitle="Tried first for every chat request"
                    accent="violet"
                    slots={keysByProvider.openrouter}
                    activeIndex={liveActiveByProvider.openrouter}
                    liveNow={liveNow}
                  />

                  {/* ── Gemini ─────────────────────────────────────────── */}
                  <ProviderKeySection
                    title="Google Gemini"
                    subtitle="Second-priority fallback"
                    accent="sky"
                    slots={keysByProvider.gemini}
                    activeIndex={liveActiveByProvider.gemini}
                    liveNow={liveNow}
                  />

                  {/* ── HuggingFace (selectable, back-compat behaviour) ── */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                          HuggingFace
                        </h4>
                        <p className="text-[10px] text-zinc-500">
                          Final fallback · pick a preferred slot below
                        </p>
                      </div>
                      <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <Activity className="w-3 h-3" />
                        {liveActiveKey != null ? (
                          <span className="text-emerald-400 font-semibold">
                            Key {liveActiveKey} live
                          </span>
                        ) : (
                          <span className="italic">idle</span>
                        )}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {KEY_LABELS.map((k) => {
                        const slot = keySlots.find((s) => s.index === k.index);
                        const status = describeStatus(slot);
                        const isLive = liveActiveKey === k.index;
                        const isSelected = hfKeyIndex === k.index;
                        return (
                          <button
                            key={`key-${k.index}`}
                            onClick={() => setHfKeyIndex(k.index)}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left relative ${
                              isLive
                                ? "border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                                : isSelected
                                  ? "border-indigo-500/60 bg-indigo-500/10"
                                  : "border-white/8 bg-white/[0.02] hover:border-white/15"
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isLive
                                ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                                : isSelected
                                  ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                                  : "bg-white/8 text-zinc-400"
                            }`}>{k.index}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-xs font-semibold truncate ${
                                  isLive ? "text-emerald-300" : isSelected ? "text-indigo-300" : "text-zinc-200"
                                }`}>
                                  {k.label}
                                </p>
                                {isLive && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-bold text-emerald-300 uppercase tracking-wide shrink-0">
                                    <span className="relative flex h-1.5 w-1.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                                    </span>
                                    In use
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-500 truncate">{k.email}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                <span className={status.text}>{status.label}</span>
                                <span className="text-zinc-600">·</span>
                                <span className="text-zinc-500">{formatAgo(slot?.lastUsed ?? null, liveNow)}</span>
                                {slot && slot.cooldownRemainingMs != null && slot.cooldownRemainingMs > 0 && (
                                  <>
                                    <span className="text-zinc-600">·</span>
                                    <span className="text-amber-400/80">
                                      cools in {Math.ceil(slot.cooldownRemainingMs / 1000)}s
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            {isSelected && !isLive && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-600 text-center pt-1">
                    {keysByProvider.openrouter.filter((s) => s.configured).length} OpenRouter ·{" "}
                    {keysByProvider.gemini.filter((s) => s.configured).length} Gemini ·{" "}
                    {KEY_LABELS.length} HuggingFace · automatic failover enabled
                  </p>
                </div>
              )}

              {tab === "tools" && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 mb-1">Configure AI tools and modes.</p>
                  {[
                    { id: "web-search",    icon: <Search className="w-4 h-4 text-purple-400" />,    label: "Web Search",        desc: "Allow AI to search the web for up-to-date information",      value: webSearchEnabled,   onChange: setWebSearchEnabled },
                    { id: "auto-code",     icon: <Code2 className="w-4 h-4 text-emerald-400" />,    label: "AUTO CODE Mode",    desc: "Continuously iterate on code until the project is complete", value: autoCodeMode,       onChange: setAutoCodeMode },
                    { id: "auto-decision", icon: <Bot className="w-4 h-4 text-indigo-400" />,       label: "Auto Decision Mode",desc: "AI autonomously decides next tasks and executes in cycles",  value: autoDecisionMode,   onChange: setAutoDecisionMode },
                    { id: "expert-mode",   icon: <BrainCircuit className="w-4 h-4 text-blue-400" />,label: "Expert Mode",       desc: "Enhanced prompting with expert-level system instructions",   value: expertMode,         onChange: setExpertMode },
                  ].map((tool) => (
                    <div key={tool.id} className="flex items-start gap-3 p-3.5 rounded-xl border border-white/8 bg-white/[0.02]">
                      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        {tool.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-100">{tool.label}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{tool.desc}</p>
                      </div>
                      <Toggle checked={tool.value} onChange={tool.onChange} />
                    </div>
                  ))}

                  <div className="pt-2">
                    <button
                      onClick={onClearAll}
                      className="w-full p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear All Chat History
                    </button>
                  </div>
                </div>
              )}
          </div>
        </section>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent
          side="bottom"
          className="h-[100dvh] max-h-[100dvh] w-full p-0 border-0 bg-[#0e0e10] text-white overflow-hidden flex flex-col gap-0 [&>button]:hidden"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}
        >
          <SheetTitle className="sr-only">Model Settings</SheetTitle>
          <SheetDescription className="sr-only">
            Manage your model settings.
          </SheetDescription>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden lvx-mobile-settings">
            {body}
          </div>
          {/* Larger slider thumbs for thumb-friendly dragging on touch devices. */}
          <style>{`
            .lvx-mobile-settings input[type=range] {
              height: 28px;
            }
            .lvx-mobile-settings input[type=range]::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 24px;
              height: 24px;
              border-radius: 9999px;
              background: currentColor;
              border: 2px solid rgba(255,255,255,0.85);
              box-shadow: 0 1px 4px rgba(0,0,0,0.45);
              cursor: pointer;
            }
            .lvx-mobile-settings input[type=range]::-moz-range-thumb {
              width: 24px;
              height: 24px;
              border-radius: 9999px;
              background: currentColor;
              border: 2px solid rgba(255,255,255,0.85);
              box-shadow: 0 1px 4px rgba(0,0,0,0.45);
              cursor: pointer;
            }
          `}</style>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl h-[640px] max-h-[90vh] bg-[#0e0e10] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden flex flex-col">
        {body}
      </div>
    </div>
  );
}

function ParamCard({
  icon, title, desc, enabled, onToggle, value, children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-xl border border-white/8 bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5">{icon}</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{title}</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">{desc}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-zinc-300 tabular-nums">{value}</span>
          <Toggle checked={enabled} onChange={onToggle} />
        </div>
      </div>
      <div className={enabled ? "" : "opacity-50"}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-9 h-5 bg-white/10 rounded-full peer peer-focus:outline-none peer-checked:bg-indigo-600 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
    </label>
  );
}
