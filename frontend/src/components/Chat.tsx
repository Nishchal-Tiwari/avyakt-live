import { Chat as LiveKitChat } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export default function Chat({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col relative bg-[#202124] text-[#e8eaed]">
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

      <div className="custom-chat-container mt-14 h-[calc(100%-3.5rem)] flex-1">
        <LiveKitChat />
      </div>
    </div>
  );
}
