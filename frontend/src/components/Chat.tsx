import { useEffect, useRef, useState } from "react";
import { useChat } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type ChatProps = {
  onClose?: () => void;
  /** When false the panel stays mounted (hidden) so LiveKit keeps delivering messages. */
  open?: boolean;
  /** Unread count while the panel is closed (0 when open). */
  onUnreadChange?: (count: number) => void;
};

/**
 * Meeting chat. Must stay mounted for the room lifetime — LiveKit's useChat only
 * accumulates messages while subscribed; unmounting drops history and can miss
 * registerTextStreamHandler until reopen (same pattern as VideoConference).
 */
export default function Chat({ onClose, open = true, onUnreadChange }: ChatProps) {
  const { chatMessages, send, isSending } = useChat();
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seenWhileOpenRef = useRef(0);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (open) {
      seenWhileOpenRef.current = chatMessages.length;
      onUnreadChange?.(0);
    } else {
      onUnreadChange?.(Math.max(0, chatMessages.length - seenWhileOpenRef.current));
    }
  }, [chatMessages.length, open, onUnreadChange]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chatMessages.length, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft("");
    try {
      await send(text);
    } catch (err) {
      console.error("Chat send failed", err);
      setDraft(text);
    }
  }

  return (
    <div
      className="flex h-full flex-col relative bg-[#202124] text-[#e8eaed]"
      hidden={!open}
      aria-hidden={!open}
    >
      <div className="absolute left-0 right-0 top-0 z-10 flex h-14 items-center justify-between border-b border-[#303134] bg-[#292a2d] px-5">
        <h3 className="text-[15px] font-semibold tracking-tight">Chat</h3>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 rounded-full text-[#9aa0a6] hover:bg-[#3c4043] hover:text-[#e8eaed]"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="mt-14 flex h-[calc(100%-3.5rem)] flex-1 flex-col">
        <ul ref={listRef} className="lk-list lk-chat-messages flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {chatMessages.length === 0 && (
            <li className="py-8 text-center text-sm text-[#9aa0a6]">No messages yet</li>
          )}
          {chatMessages.map((msg, i) => {
            const name =
              msg.from?.name || msg.from?.identity || (msg.from?.isLocal ? "You" : "Participant");
            const isLocal = Boolean(msg.from?.isLocal);
            const time = new Date(msg.timestamp).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <li
                key={msg.id ?? `${msg.timestamp}-${i}`}
                className={`flex flex-col gap-0.5 ${isLocal ? "items-end" : "items-start"}`}
              >
                <span className="text-[11px] text-[#9aa0a6]">
                  <strong className="font-medium text-[#e8eaed]">{isLocal ? "You" : name}</strong>
                  {" · "}
                  {time}
                </span>
                <span
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                    isLocal ? "bg-[#8ab4f8] text-[#202124]" : "bg-[#3c4043] text-[#e8eaed]"
                  }`}
                >
                  {msg.message}
                </span>
              </li>
            );
          })}
        </ul>

        <form
          className="flex gap-2 border-t border-[#303134] bg-[#292a2d] p-3"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <input
            ref={inputRef}
            className="min-w-0 flex-1 rounded-full border border-[#5f6368] bg-[#202124] px-4 py-2 text-sm text-[#e8eaed] outline-none placeholder:text-[#9aa0a6] focus:border-[#8ab4f8]"
            type="text"
            value={draft}
            disabled={isSending}
            placeholder="Enter a message…"
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="shrink-0 rounded-full bg-[#8ab4f8] px-4 py-2 text-sm font-semibold text-[#202124] hover:bg-[#aecbfa] disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
