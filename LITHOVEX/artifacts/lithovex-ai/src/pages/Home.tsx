import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Code2, Lightbulb, Globe, Layers,
  Monitor,
} from "lucide-react";
import lithovexLogo from "@/assets/lithovex-logo.png";
import {
  useListChats,
  useCreateChat,
  useUpdateChat,
  useDeleteChat,
  getListChatsQueryKey
} from "@workspace/api-client-react";
import type { ChatHistory, ChatMessage } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessageList } from "@/components/ChatMessageList";
import { ChatInput } from "@/components/ChatInput";
import { TopBar } from "@/components/TopBar";
import { SettingsPanel, HF_MODELS } from "@/components/SettingsPanel";
import { PREMIUM_9_MODELS } from "@/lib/ai-models-config";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFileExplorer } from "@/hooks/useFileExplorer";
import { FileExplorerLayout } from "@/components/FileExplorer/FileExplorerLayout";
import { extractCodeBlocks } from "@/lib/codeExtractor";
import { getSmartParams, buildMessageContent } from "@/lib/smartRouter";
import type { ProcessedFile } from "@/lib/smartRouter";
import { encodeAttachmentMarker } from "@/lib/messageAttachments";
import {
  isImageGenModel,
  BEST_IMAGE_GEN_MODEL,
  friendlyImageModelLabel,
  generateImage,
} from "@/lib/imageGen";
import AgentCoWork from "@/pages/AgentCoWork";

interface EvolutionCycle {
  cycle: number;
  task: string;
  reasoning: string;
  status: "pending" | "running" | "done" | "complete";
}

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const AUTO_CODE_CONTINUATION_PROMPT =
  "Continue from where you left off. Keep building, fixing bugs, and improving the code. " +
  "Report what you changed (files, line counts). If everything is fully complete and production-ready, " +
  "end your reply with the exact token: [AUTO CODE COMPLETE]";

const GREETING_LINES = [
  "the night feels unusually quiet today, like the world pressed pause for a second.",
  "ever noticed how rain smells different depending on where you are?",
  "Wanna explore a city where nobody knows your name?",
  "octopuses have three hearts and blue blood, pretty wild right?",
  "if you could time travel once, would you go forward or back?",
  "Buy me a cup of coffee will ya? I'll tell you a secret in return.",
  "honey never spoils, jars found in ancient tombs are still edible.",
  "sometimes the smallest decisions change everything in ways we never see.",
  "Wanna just disappear into the mountains for a week?",
  "sharks existed before trees, imagine that timeline.",
  "the brain can generate enough electricity to power a small light bulb.",
  "what's the most random memory you still remember clearly?",
  "Wanna race through an empty highway at midnight?",
  "bananas are technically berries, but strawberries aren't.",
  "ever feel like you're the main character in a quiet scene?",
  "the moon is slowly drifting away from Earth every year.",
  "Wanna build something crazy just for fun?",
  "your fingerprints are unique, even identical twins don't share them.",
  "if silence had a color, what do you think it would be?",
  "somewhere out there, someone is having the best day of their life right now.",
  "a day on Venus is longer than a year on Venus, time gets weird out there.",
  "Wanna chase a sunset until it actually catches you?",
  "what would your ten-year-old self think of who you are today?",
  "lightning is five times hotter than the surface of the sun.",
  "sometimes the best ideas show up while you're doing absolutely nothing.",
  "Wanna stay up just to watch the sky shift colors at dawn?",
  "there are more possible chess games than atoms in the observable universe.",
];

function getDisplayName(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem("lithovex.user.displayName");
    if (stored && stored.trim()) return stored.trim();
    window.localStorage.setItem("lithovex.user.displayName", "Vilian2k21");
    return "Vilian2k21";
  } catch {
    return "Vilian2k21";
  }
}

function pickLocalGreeting(name: string): string {
  const line = GREETING_LINES[Math.floor(Math.random() * GREETING_LINES.length)];
  if (!name) return line.charAt(0).toUpperCase() + line.slice(1);
  return `Hey ${name} ${line}`;
}

const QUICK_ACTIONS = [
  { icon: Code2,      label: "Generate Code",         prompt: "Generate a complete, production-ready code example for me." },
  { icon: Lightbulb,  label: "Create Business Idea",  prompt: "Give me a unique and detailed business idea with a plan." },
  { icon: Globe,      label: "Build a Website",       prompt: "Build a modern, responsive website for me from scratch." },
  { icon: Layers,     label: "UI Components",         prompt: "Create beautiful, reusable UI components with Tailwind CSS." },
  { icon: Monitor,    label: "Landing Page",          prompt: "Design and code a stunning landing page from scratch." },
];

export default function Home() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [greeting, setGreeting] = useState<string>(() => pickLocalGreeting(getDisplayName()));

  useEffect(() => {
    const name = getDisplayName();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    fetch(`/api/greeting?name=${encodeURIComponent(name)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.text === "string" && data.text.trim()) {
          setGreeting(data.text.trim());
        }
      })
      .catch(() => { /* keep local fallback */ })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  // Default model: LITHOVEX 2.5 Core — the flagship surgical code specialist.
  // The user can switch to any of the 217 available models from the picker.
  const [model, setModel] = useState<string>("lithovex-2.5-core");
  const [hfKeyIndex, setHfKeyIndex] = useState<number>(1);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [topP, setTopP] = useState<number>(0.9);
  const [maxTokens, setMaxTokens] = useState<number>(4096);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  // Auto-scroll defaults to OFF on the homepage chat — users found the
  // constant scroll-to-bottom while reading mid-conversation distracting.
  // The toggle is still available in the TopBar for anyone who wants it back.
  const [autoScroll, setAutoScroll] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Sidebar default: closed on every viewport. The user can open it via the
  // toggle in the top bar; we no longer auto-open it on desktop on first load.
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [projectContext, setProjectContext] = useState<string>("");
  const [isPending, setIsPending] = useState(false);

  const [autoDecisionMode, setAutoDecisionMode] = useState(false);
  const [evolutionCycles, setEvolutionCycles] = useState<EvolutionCycle[]>([]);
  const [currentCycle, setCurrentCycle] = useState(0);
  const [isEvolving, setIsEvolving] = useState(false);

  const [autoCodeMode, setAutoCodeMode] = useState(false);
  const [isAutoCoding, setIsAutoCoding] = useState(false);
  const [expertMode, setExpertMode] = useState(true);
  const [coWorkMode, setCoWorkMode] = useState(false);
  const [imageGenEnabled, setImageGenEnabledState] = useState(false);

  const autoModeRef = useRef(false);
  const autoCodeRef = useRef(false);
  const completedTasksRef = useRef<string[]>([]);
  const cycleCountRef = useRef(0);
  const activeChatIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);

  const fileExplorer = useFileExplorer(activeChatId);
  const fileExplorerRef = useRef(fileExplorer);
  fileExplorerRef.current = fileExplorer;
  const [showFileExplorer, setShowFileExplorer] = useState(false);

  // Keep sidebar collapsed whenever the viewport is in mobile range. This
  // protects against a user resizing from desktop down to phone width with
  // the sidebar still open and covering the chat.
  const isMobile = useIsMobile();
  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
    // Only reacts to isMobile flipping — closing sidebar when screen shrinks
    // to mobile width without disturbing manual toggle on same-size devices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  const { data: chatData } = useListChats();
  const chats = chatData?.chats || [];

  const createChat = useCreateChat();
  const updateChat = useUpdateChat();
  const deleteChat = useDeleteChat();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const activeChat = chats.find(c => c.id === activeChatId);
  const serverMessages = activeChat?.messages || [];
  const messages = localMessages.length > 0 ? localMessages : serverMessages;

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);
  useEffect(() => {
    autoCodeRef.current = autoCodeMode;
    if (!autoCodeMode) setIsAutoCoding(false);
  }, [autoCodeMode]);

  /**
   * Image-Generation toggle wrapper.
   *
   * When the user flips Image Generation ON while a non-image-capable model
   * is selected (e.g. a chat LLM like Qwen or Llama), we:
   *   1. Show a toast explaining that the current model can't generate
   *      images and that we're switching them.
   *   2. Auto-switch the active model to FLUX.1 Schnell — the best free
   *      text-to-image model on the HF Router.
   * If the model already supports image generation, we just flip the bit.
   * Turning the toggle OFF is always a no-op switch.
   */
  const setImageGenEnabled = useCallback((next: boolean) => {
    if (next && !isImageGenModel(model)) {
      const previousLabel =
        HF_MODELS.find((m) => m.id === model)?.label ?? model;
      toast({
        title: `${previousLabel} can't generate images`,
        description: `Switching to ${friendlyImageModelLabel(BEST_IMAGE_GEN_MODEL)} — the best image-generation model available. Pick a different one anytime from the model selector.`,
      });
      setModel(BEST_IMAGE_GEN_MODEL);
    }
    setImageGenEnabledState(next);
  }, [model, toast]);

  const handleNewChat = () => { setActiveChatId(null); setLocalMessages([]); };

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    autoCodeRef.current = false;
    autoModeRef.current = false;
    setAutoCodeMode(false);
    setIsAutoCoding(false);
    setAutoDecisionMode(false);
    setIsEvolving(false);
    setIsPending(false);
    setStreamingContent(null);
  }, []);

  const handleClearCurrentChat = useCallback(async () => {
    return;
  }, []);

  const handleClearAllChats = useCallback(async () => {
    if (!confirm("Delete all conversations?")) return;
    for (const chat of chats) {
      try { await deleteChat.mutateAsync({ id: chat.id }); } catch { /* continue */ }
    }
    setActiveChatId(null);
    queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
    toast({ title: "All chats cleared" });
  }, [chats, deleteChat, queryClient, toast]);

  const [streamingContent, setStreamingContent] = useState<string | null>(null);

  // Convert raw upstream/failover diagnostics into a user-friendly message.
  // The server's failover loop emits messages like
  //   "model=foo/bar key=#1 → 400: {\"error\":{...}}"
  // which is great for logs but terrible to surface in a toast. This helper
  // pattern-matches the common cases and returns a clean sentence; if
  // nothing matches we strip any leading "model=… key=… → NNN:" prefix and
  // truncate so the user gets a short readable line instead of a JSON wall.
  const humanizeAiError = (raw: string): string => {
    const text = (raw || "").trim();
    if (!text) return "The AI didn't respond. Please try again.";
    if (/abort/i.test(text)) return "Request was cancelled.";
    if (/not supported by any provider/i.test(text)) {
      return "None of the configured Hugging Face accounts have an inference provider enabled for this model. Open huggingface.co → Settings → Inference Providers and enable Together AI / Fireworks / Novita / DeepInfra, then try again.";
    }
    if (/is not a chat model|not.*chat.*model|model_not_supported/i.test(text)) {
      return "That model isn't available for chat right now. The system already failed over through the backup models — try a different one (Qwen 2.5 72B, Llama 3.3 70B, or DeepSeek-V3 are reliable picks).";
    }
    if (/model.*not found|model.*does not exist|unknown model/i.test(text)) {
      return "The selected model couldn't be found upstream. It may have been deprecated — try a different model.";
    }
    if (/depleted .* monthly included credits|insufficient.*credit|payment required/i.test(text)) {
      return "Your Hugging Face credits are exhausted. Add pre-paid credits, switch to a PRO plan, or try again after the monthly reset.";
    }
    if (/invalid username or password|bad credentials|invalid token|unauthorized/i.test(text)) {
      return "One of the configured API tokens is invalid. The system will keep trying with the others.";
    }
    if (/rate limit|too many requests|429/i.test(text)) {
      return "Hit a rate limit. The system is rotating tokens — please retry in a few seconds.";
    }
    if (/timed? out|timeout|ETIMEDOUT|fetch failed/i.test(text)) {
      return "The request timed out reaching the AI provider. Please try again.";
    }
    if (/no huggingface_api_key/i.test(text)) {
      return "No Hugging Face API tokens are configured on the server.";
    }
    if (/all .* keys? failed|all .* models? .* failed/i.test(text)) {
      return "All AI providers are currently unavailable. Please try again in a moment.";
    }
    // Generic cleanup: drop the noisy "model=… key=#… → NNN:" prefix.
    let cleaned = text.replace(/^model=[^\s]+\s+key=#\d+\s+→\s+\d+:\s*/i, "");
    // If the rest is a JSON envelope, try to pull out the inner message.
    const m = cleaned.match(/"message"\s*:\s*"([^"]{4,300})"/);
    if (m) cleaned = m[1] ?? cleaned;
    if (cleaned.length > 220) cleaned = cleaned.slice(0, 220) + "…";
    return cleaned || "The AI request failed. Please try again.";
  };

  const sendMessageToAI = useCallback(async (
    msgs: ChatMessage[],
    onChunk?: (text: string) => void,
    overrides?: { model?: string; temperature?: number; maxTokens?: number; topP?: number },
  ) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const resp = await fetch(`${BASE_URL}/api/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: overrides?.model ?? model,
        messages: msgs,
        use_web_search: webSearchEnabled,
        project_context: projectContext || "",
        temperature: overrides?.temperature ?? temperature,
        top_p: overrides?.topP ?? topP,
        max_tokens: overrides?.maxTokens ?? maxTokens,
        hf_key_index: hfKeyIndex,
        stream: true,
      }),
    });

    if (!resp.ok) {
      // Try to read a JSON or text error body so the message is meaningful
      // before we hand it off to humanizeAiError.
      let bodyText = "";
      try {
        bodyText = await resp.text();
      } catch {/* ignore */}
      throw new Error(humanizeAiError(bodyText) || `Service unavailable (HTTP ${resp.status})`);
    }
    if (!resp.body) throw new Error("No response from the AI service.");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let content = "";
    let buffer = "";
    // Track open <think> block so reasoning chunks are streamed live as
    // chain-of-thought (parsed by ChatMessageList → ReasoningPanel).
    // Reasoning models like DeepSeek-R1 / Qwen-Thinking / o3 emit
    // delta.reasoning or delta.reasoning_content BEFORE delta.content;
    // we wrap those chunks in <think>…</think> so the existing UI shows
    // a live "Thinking… → Thought for Xs" panel containing the actual
    // reasoning text instead of a generic placeholder.
    let thinkOpen = false;
    const emit = (text: string) => {
      content += text;
      onChunk?.(text);
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const raw = trimmed.slice(5).trim();
        if (raw === "[DONE]") continue;
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (parsed?.error) {
          throw new Error(
            humanizeAiError(
              typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error),
            ),
          );
        }
        const delta = parsed?.choices?.[0]?.delta;
        // Reasoning models emit chain-of-thought via `delta.reasoning`
        // (HF Router / Together) or `delta.reasoning_content` (DeepSeek
        // upstream / OpenAI o-series). Surface both as a live <think>
        // block so ChatMessageList's ReasoningPanel renders them.
        const reasoningChunk: string | undefined =
          delta?.reasoning ?? delta?.reasoning_content;
        if (reasoningChunk) {
          if (!thinkOpen) {
            emit("<think>");
            thinkOpen = true;
          }
          emit(reasoningChunk);
        }
        if (delta?.content) {
          if (thinkOpen) {
            emit("</think>\n\n");
            thinkOpen = false;
          }
          emit(delta.content);
        }
      }
    }

    // If the upstream ended with reasoning still open (model hit a hard
    // stop mid-thought), close the tag so the UI doesn't render a raw
    // "<think>" string in the bubble.
    if (thinkOpen) {
      emit("</think>");
      thinkOpen = false;
    }

    if (!content) throw new Error("The AI returned an empty response. Please try again.");
    return { content };
  }, [model, webSearchEnabled, projectContext, temperature, topP, maxTokens, hfKeyIndex]);

  const insertSystemMessage = useCallback(async (chatId: string, currentMessages: ChatMessage[], text: string) => {
    const sysMsg: ChatMessage = { role: "assistant", content: `🔑 ${text}` };
    const updated = [...currentMessages, sysMsg];
    try {
      await updateChat.mutateAsync({ id: chatId, data: { messages: updated } });
      queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
    } catch { /* non-blocking */ }
    return updated;
  }, [updateChat, queryClient]);

  const handleSendMessage = useCallback(async (content: string, files?: ProcessedFile[]): Promise<string | null> => {
    let currentChatId = activeChatIdRef.current;
    let currentMessages: ChatMessage[] = [];

    const cached = queryClient.getQueryData<{ chats: ChatHistory[] }>(getListChatsQueryKey());
    const cachedChat = cached?.chats.find(c => c.id === currentChatId);
    if (cachedChat) currentMessages = [...cachedChat.messages];

    // Build message content (inject file context, multipart for images)
    const attachedFiles = files ?? [];
    const messageContent = buildMessageContent(content, attachedFiles);

    // Smart routing: pick optimal model/params for this query + files
    const sp = getSmartParams(content, attachedFiles, model, temperature, maxTokens, topP);
    // Auto-routing happens silently — no toast shown (respect user's selected model UX).

    const chatTitle = content.substring(0, 45) ||
      (attachedFiles[0] ? attachedFiles[0].name : "New Chat");

    if (!currentChatId) {
      try {
        const newChat = await createChat.mutateAsync({ data: { title: chatTitle } });
        currentChatId = newChat.id;
        activeChatIdRef.current = newChat.id;
        queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
        setActiveChatId(newChat.id);
      } catch {
        toast({ title: "Error creating chat", variant: "destructive" });
        return null;
      }
    }

    // Store the user's visible text in history. Attachments are persisted
    // as a hidden marker appended to the content so the renderer can show
    // proper previews (image/video/audio/pdf/code/file tile) on reload.
    // The AI request itself uses the multipart `messageContent` built above.
    const attachMarker = encodeAttachmentMarker(attachedFiles);
    const displayContent = content + attachMarker;

    currentMessages.push({ role: "user", content: displayContent });
    setLocalMessages([...currentMessages]);

    // For the actual API call, use the full content (possibly multipart)
    const apiMessages = [
      ...currentMessages.slice(0, -1),
      { role: "user" as const, content: messageContent as string | object },
    ];

    try {
      await updateChat.mutateAsync({ id: currentChatId, data: { messages: currentMessages } });
      queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
    } catch {
      toast({ title: "Error saving message", variant: "destructive" });
      return null;
    }

    // ─── Image-Generation branch ────────────────────────────────────────────
    // When the Image Generation tool is on, skip the chat-completion path
    // entirely: the user's text becomes the image prompt, we hit the
    // text-to-image endpoint with whatever image-capable model is selected
    // (the toggle wrapper above guarantees one is), and we persist the
    // result as an assistant bubble containing a markdown image embed so
    // the existing renderer just works.
    if (imageGenEnabled) {
      setIsPending(true);
      setStreamingContent(null);
      const imagePrompt = content.trim();
      // Belt-and-braces fallback: if the model somehow isn't image-capable
      // here (e.g. user changed it after flipping the toggle), upgrade it
      // silently to FLUX so the request always succeeds.
      const imageModel = isImageGenModel(model) ? model : BEST_IMAGE_GEN_MODEL;
      try {
        const result = await generateImage({
          prompt: imagePrompt,
          model: imageModel,
        });
        const modelLabel = friendlyImageModelLabel(result.model);
        const assistantBody =
          `![Generated image](${result.dataUrl})\n\n` +
          `_Generated with **${modelLabel}** from your prompt: "${imagePrompt}"._`;
        currentMessages.push({ role: "assistant", content: assistantBody });
        setLocalMessages([...currentMessages]);
        await updateChat.mutateAsync({
          id: currentChatId,
          data: { messages: currentMessages },
        });
        await queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
        setLocalMessages([]);
        return assistantBody;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast({
          title: "Image generation failed",
          description: message,
          variant: "destructive",
        });
        const errorBody = `⚠️ Image generation failed: ${message}`;
        currentMessages.push({ role: "assistant", content: errorBody });
        setLocalMessages([...currentMessages]);
        await updateChat.mutateAsync({
          id: currentChatId,
          data: { messages: currentMessages },
        }).catch(() => { /* non-blocking */ });
        await queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
        setLocalMessages([]);
        return null;
      } finally {
        setIsPending(false);
      }
    }

    setIsPending(true);
    let partial = "";
    setStreamingContent("");
    try {
      const { content: aiContent } = await sendMessageToAI(
        apiMessages,
        (chunk) => { partial += chunk; setStreamingContent(prev => (prev ?? "") + chunk); },
        { model: sp.model, temperature: sp.temperature, maxTokens: sp.maxTokens, topP: sp.topP },
      );
      setStreamingContent(null);

      // Auto-extract code blocks and save to this chat's file explorer
      const autoBlocks = extractCodeBlocks(aiContent);
      if (autoBlocks.length > 0) {
        fileExplorerRef.current.addCodeBlocks(autoBlocks);
        setShowFileExplorer(true);
      }

      currentMessages.push({ role: "assistant", content: aiContent });
      setLocalMessages([...currentMessages]);
      await updateChat.mutateAsync({ id: currentChatId, data: { messages: currentMessages } });
      await queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
      setLocalMessages([]);

      if (autoCodeRef.current && !aiContent.includes("[AUTO CODE COMPLETE]")) {
        runAutoCodeContinuation(currentChatId!, currentMessages);
      } else if (autoCodeRef.current && aiContent.includes("[AUTO CODE COMPLETE]")) {
        setAutoCodeMode(false);
        setIsAutoCoding(false);
        toast({ title: "AUTO CODE Complete", description: "All code is built and production-ready!" });
      }
      return aiContent;
    } catch (err: unknown) {
      setStreamingContent(null);
      const isAbort = err instanceof Error && (err.name === "AbortError" || /abort/i.test(err.message));
      if (isAbort) {
        const stopped = (partial || "").trim();
        const finalContent = stopped ? `${stopped}\n\n_⏹ Stopped by user_` : "_⏹ Stopped by user_";
        currentMessages.push({ role: "assistant", content: finalContent });
        setLocalMessages([...currentMessages]);
        try {
          await updateChat.mutateAsync({ id: currentChatId, data: { messages: currentMessages } });
          queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
          setLocalMessages([]);
        } catch { /* non-blocking */ }
        autoCodeRef.current = false;
        autoModeRef.current = false;
        setAutoCodeMode(false);
        setIsAutoCoding(false);
        setAutoDecisionMode(false);
        setIsEvolving(false);
        return null;
      }
      const friendly =
        err instanceof Error
          ? humanizeAiError(err.message)
          : "Couldn't reach the AI right now. Please try again.";
      toast({
        title: "AI unavailable",
        description: friendly,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsPending(false);
      abortControllerRef.current = null;
    }
  }, [sendMessageToAI, createChat, updateChat, queryClient, toast, setStreamingContent, model, temperature, maxTokens, topP, imageGenEnabled]);

  const runAutoCodeContinuation = useCallback(async (chatId: string, currentMessages: ChatMessage[]) => {
    if (!autoCodeRef.current) return;
    setIsAutoCoding(true);
    await new Promise(r => setTimeout(r, 1500));
    if (!autoCodeRef.current) { setIsAutoCoding(false); return; }

    const updatedMessages = [...currentMessages, { role: "user" as const, content: AUTO_CODE_CONTINUATION_PROMPT }];
    try { await updateChat.mutateAsync({ id: chatId, data: { messages: updatedMessages } }); queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() }); } catch { /* non-blocking */ }

    setIsPending(true);
    setStreamingContent("");
    try {
      const { content: aiContent } = await sendMessageToAI(
        updatedMessages,
        (chunk) => setStreamingContent(prev => (prev ?? "") + chunk),
      );
      setStreamingContent(null);
      if (!aiContent) { setIsAutoCoding(false); return; }
      let finalMessages = updatedMessages;

      // Auto-extract code blocks and save to this chat's file explorer
      const autoBlocks = extractCodeBlocks(aiContent);
      if (autoBlocks.length > 0) {
        fileExplorerRef.current.addCodeBlocks(autoBlocks);
        setShowFileExplorer(true);
      }

      finalMessages = [...finalMessages, { role: "assistant", content: aiContent }];
      await updateChat.mutateAsync({ id: chatId, data: { messages: finalMessages } });
      queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });

      if (autoCodeRef.current && !aiContent.includes("[AUTO CODE COMPLETE]")) {
        runAutoCodeContinuation(chatId, finalMessages);
      } else {
        setAutoCodeMode(false);
        setIsAutoCoding(false);
        if (aiContent.includes("[AUTO CODE COMPLETE]")) toast({ title: "AUTO CODE Complete", description: "All code is built and production-ready!" });
      }
    } catch (err: unknown) {
      setStreamingContent(null);
      setIsAutoCoding(false);
      if (err instanceof Error && (err.name === "AbortError" || /abort/i.test(err.message))) {
        autoCodeRef.current = false;
        setAutoCodeMode(false);
      }
    } finally { setIsPending(false); abortControllerRef.current = null; }
  }, [sendMessageToAI, updateChat, queryClient, toast, setStreamingContent]);

  const callAutoEvolve = useCallback(async (payload: { projectContext?: string; previousTasks?: string[]; model?: string; cycleNumber?: number; hfKeyIndex?: number }) => {
    const resp = await fetch(`${BASE_URL}/api/chat/auto-evolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_context: payload.projectContext ?? projectContext,
        previous_tasks: (payload.previousTasks ?? []).map(t => ({ task: t })),
        model: payload.model ?? model,
        hf_key_index: payload.hfKeyIndex ?? hfKeyIndex,
      }),
    });
    if (!resp.ok) throw new Error("Auto-evolve request failed");
    return resp.json() as Promise<{ nextTask: string; reasoning: string; searchQueries: string[]; status: "continue" | "complete"; cycleNumber: number }>;
  }, [hfKeyIndex, projectContext, model]);

  const runEvolutionCycle = useCallback(async () => {
    if (!autoModeRef.current) return;
    const cycleNum = cycleCountRef.current + 1;
    cycleCountRef.current = cycleNum;
    setCurrentCycle(cycleNum);
    setIsEvolving(true);
    setEvolutionCycles(prev => [...prev, { cycle: cycleNum, task: "Thinking...", reasoning: "", status: "pending" }]);

    try {
      const evolveResult = await callAutoEvolve({ projectContext, previousTasks: completedTasksRef.current, model, cycleNumber: cycleNum });
      if (!autoModeRef.current) return;

      setEvolutionCycles(prev => prev.map(c => c.cycle === cycleNum ? { ...c, task: evolveResult.nextTask, reasoning: evolveResult.reasoning, status: "running" } : c));
      await handleSendMessage(`[AUTO DECISION MODE — Cycle ${cycleNum}]\n\n${evolveResult.nextTask}`);
      if (!autoModeRef.current) return;

      completedTasksRef.current = [...completedTasksRef.current, evolveResult.nextTask.split("\n")[0].slice(0, 120)];
      const isDone = evolveResult.status === "complete";
      setEvolutionCycles(prev => prev.map(c => c.cycle === cycleNum ? { ...c, status: isDone ? "complete" : "done" } : c));

      if (isDone) {
        autoModeRef.current = false;
        setAutoDecisionMode(false);
        setIsEvolving(false);
        toast({ title: "Auto Decision Mode Complete", description: `Evolved through ${cycleNum} cycles!` });
        return;
      }
      if (autoModeRef.current) setTimeout(() => { if (autoModeRef.current) runEvolutionCycle(); }, 2000);
    } catch {
      if (!autoModeRef.current) return;
      setEvolutionCycles(prev => prev.map(c => c.cycle === cycleNum ? { ...c, task: "Failed to get next task", status: "done" } : c));
      setTimeout(() => { if (autoModeRef.current) runEvolutionCycle(); }, 5000);
    } finally {
      if (autoModeRef.current) setIsEvolving(false);
    }
  }, [projectContext, model, handleSendMessage, callAutoEvolve, toast]);

  useEffect(() => {
    if (autoDecisionMode) {
      autoModeRef.current = true;
      completedTasksRef.current = [];
      cycleCountRef.current = 0;
      setEvolutionCycles([]);
      setCurrentCycle(0);
      const startLoop = async () => {
        if (!activeChatIdRef.current) {
          try {
            const newChat = await createChat.mutateAsync({ data: { title: "Auto Evolution Session" } });
            setActiveChatId(newChat.id);
            activeChatIdRef.current = newChat.id;
            queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
          } catch {
            // Chat creation failed — abort evolution rather than running on null ID
            autoModeRef.current = false;
            setAutoDecisionMode(false);
            return;
          }
        }
        runEvolutionCycle();
      };
      startLoop();
    } else {
      autoModeRef.current = false;
      setIsEvolving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDecisionMode]);

  const handleDeleteChat = async (id: string) => {
    try {
      await deleteChat.mutateAsync({ id });
      if (activeChatId === id) setActiveChatId(null);
      queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
    } catch {
      toast({ title: "Error deleting chat", variant: "destructive" });
    }
  };

  const isBusy = isPending || isEvolving || isAutoCoding;
  const showWelcome = !activeChatId && messages.length === 0;

  if (coWorkMode) {
    return <AgentCoWork onExit={() => setCoWorkMode(false)} />;
  }

  return (
    <div className="flex h-[100dvh] w-full bg-[#0f0f0f] text-gray-100 overflow-hidden">

      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={(id) => { setLocalMessages([]); setActiveChatId(id); }}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(o => !o)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        {/* Auto-hiding top bar (desktop): slides down on hover.
            On mobile/touch, stays visible since hover doesn't exist. */}
        <div className="group md:absolute md:top-0 md:inset-x-0 md:z-30">
          <div className="md:-translate-y-full md:group-hover:translate-y-0 md:focus-within:translate-y-0 md:transition-transform md:duration-300 md:ease-out">
            <TopBar
              model={model}
              webSearchEnabled={webSearchEnabled}
              setWebSearchEnabled={setWebSearchEnabled}
              autoScroll={autoScroll}
              setAutoScroll={setAutoScroll}
              autoDecisionMode={autoDecisionMode}
              setAutoDecisionMode={setAutoDecisionMode}
              autoCodeMode={autoCodeMode}
              setAutoCodeMode={setAutoCodeMode}
              expertMode={expertMode}
              setExpertMode={setExpertMode}
              coWorkMode={coWorkMode}
              setCoWorkMode={setCoWorkMode}
              onOpenExplorer={() => setShowFileExplorer(v => !v)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onToggleSidebar={() => setIsSidebarOpen(o => !o)}
              activeChatTitle={activeChat?.title || "LITHOVEX AI"}
            />
          </div>
          {/* Invisible hover trigger strip — only on desktop */}
          <div className="hidden md:block h-3 -mt-px" aria-hidden="true" />
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {showWelcome ? (
            <div className="flex-1 flex flex-col items-center justify-center px-3 md:px-4 overflow-y-auto relative">
              {/* Purple atmospheric glow — LITHOVEX signature */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-purple-600/[0.06] blur-[100px]" />
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-violet-700/[0.08] blur-[80px]" />
              </div>
              <motion.div
                className="w-full max-w-2xl relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="text-center mb-6 md:mb-8">
                  <div className="relative inline-block mb-3 md:mb-5">
                    <div className="absolute inset-0 rounded-full bg-purple-600/20 blur-2xl scale-150 pointer-events-none" />
                    <img
                      src={lithovexLogo}
                      alt="LITHOVEX"
                      className="relative w-10 h-10 md:w-28 md:h-28 object-contain mx-auto logo-glow"
                    />
                  </div>
                  <h1 className="text-xl md:text-3xl font-semibold text-white mb-1 tracking-tight">
                    <motion.span
                      key={greeting}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="inline-block bg-gradient-to-r from-white via-purple-100 to-white bg-clip-text text-transparent"
                    >
                      {greeting}
                    </motion.span>
                  </h1>
                  <motion.div
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="mx-auto mt-2 h-px w-24 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"
                  />
                </div>

                <ChatInput
                  onSend={handleSendMessage}
                  disabled={isBusy}
                  isStreaming={isBusy}
                  onStop={handleStop}
                  model={model}
                  onModelChange={setModel}
                  models={HF_MODELS}
                  featuredModelIds={PREMIUM_9_MODELS.map(m => m.id)}
                  onOpenAllModels={() => setIsSettingsOpen(true)}
                  showTools
                  webSearchEnabled={webSearchEnabled}
                  setWebSearchEnabled={setWebSearchEnabled}
                  autoCodeMode={autoCodeMode}
                  setAutoCodeMode={setAutoCodeMode}
                  imageGenEnabled={imageGenEnabled}
                  setImageGenEnabled={setImageGenEnabled}
                  onTypingStart={() => setIsSidebarOpen(false)}
                />

                {/* Quick actions
                    • Mobile : 2-col grid, ≥72px tap targets, rounded-xl card style.
                    • Desktop: original wrap-flow pill style. */}
                <div className="grid grid-cols-2 gap-2 mt-5 md:flex md:flex-wrap md:items-center md:justify-center md:gap-2">
                  {QUICK_ACTIONS.map((a, i) => (
                    <motion.button
                      key={i}
                      onClick={() => handleSendMessage(a.prompt)}
                      disabled={isBusy}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.08 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                      className="
                        flex items-center gap-2 p-3 rounded-xl border border-white/10 bg-black/40
                        text-neutral-300 hover:text-white hover:bg-white/8 hover:border-white/20
                        transition-all duration-150 text-sm font-medium min-h-[72px]
                        disabled:opacity-40 disabled:cursor-not-allowed text-left
                        md:rounded-full md:gap-1.5 md:px-3.5 md:py-1.5 md:text-xs md:min-h-0
                        md:text-neutral-400 md:text-center md:items-center md:justify-center
                      "
                    >
                      <a.icon className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0" />
                      <span className="truncate">{a.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            <>
              <ChatMessageList messages={messages} isTyping={isPending && !streamingContent} streamingContent={streamingContent} autoScroll={autoScroll} />
              <div className="px-3 md:px-4 pb-3 md:pb-4 pt-2 shrink-0 safe-bottom">
                <div className="max-w-3xl mx-auto">
                  <ChatInput
                  onSend={handleSendMessage}
                  disabled={isBusy}
                  isStreaming={isBusy}
                  onStop={handleStop}
                  model={model}
                  onModelChange={setModel}
                  models={HF_MODELS}
                  featuredModelIds={PREMIUM_9_MODELS.map(m => m.id)}
                  onOpenAllModels={() => setIsSettingsOpen(true)}
                  showTools
                  webSearchEnabled={webSearchEnabled}
                  setWebSearchEnabled={setWebSearchEnabled}
                  autoCodeMode={autoCodeMode}
                  setAutoCodeMode={setAutoCodeMode}
                  imageGenEnabled={imageGenEnabled}
                  setImageGenEnabled={setImageGenEnabled}
                  onTypingStart={() => setIsSidebarOpen(false)}
                />
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* File explorer — FileExplorerLayout self-handles mobile (Drawer + Tabs)
          and desktop (inline side panel) via its internal useIsMobile hook. */}
      <FileExplorerLayout
        isOpen={showFileExplorer}
        onClose={() => setShowFileExplorer(false)}
        state={fileExplorer.state}
        tree={fileExplorer.tree}
        selectedNode={fileExplorer.selectedNode}
        fileCount={fileExplorer.fileCount}
        folderCount={fileExplorer.folderCount}
        addCodeBlocks={fileExplorer.addCodeBlocks}
        addSingleFile={fileExplorer.addSingleFile}
        addMultipleFiles={fileExplorer.addMultipleFiles}
        remove={fileExplorer.remove}
        updateContent={fileExplorer.updateContent}
        rename={fileExplorer.rename}
        move={fileExplorer.move}
        toggleExpand={fileExplorer.toggleExpand}
        select={fileExplorer.select}
        createFolder={fileExplorer.createFolder}
        clearAll={fileExplorer.clearAll}
      />

      {/* Settings panel — SettingsPanel self-handles mobile (full-height bottom
          Sheet with sticky headings & larger tap targets) and desktop (centered
          modal) via its internal useIsMobile hook. */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        model={model}
        setModel={setModel}
        hfKeyIndex={hfKeyIndex}
        setHfKeyIndex={setHfKeyIndex}
        temperature={temperature}
        setTemperature={setTemperature}
        topP={topP}
        setTopP={setTopP}
        maxTokens={maxTokens}
        setMaxTokens={setMaxTokens}
        webSearchEnabled={webSearchEnabled}
        setWebSearchEnabled={setWebSearchEnabled}
        autoCodeMode={autoCodeMode}
        setAutoCodeMode={setAutoCodeMode}
        autoDecisionMode={autoDecisionMode}
        setAutoDecisionMode={setAutoDecisionMode}
        expertMode={expertMode}
        setExpertMode={setExpertMode}
        onClearAll={handleClearAllChats}
      />
    </div>
  );
}
