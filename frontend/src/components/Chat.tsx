import { Chat as LiveKitChat } from "@livekit/components-react";

export default function Chat({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full relative" style={{ background: "#202124" }}>
      <div
        className="flex justify-between items-center px-5 py-4 absolute top-0 left-0 right-0 z-10 h-[56px]"
        style={{ borderBottom: "1px solid #303134", background: "#292a2d" }}
      >
        <h3 className="text-[#e8eaed] font-semibold text-[15px]">Chat</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-colors"
            style={{ color: "#9aa0a6" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#3c4043";
              e.currentTarget.style.color = "#e8eaed";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#9aa0a6";
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 mt-[56px] h-[calc(100%-56px)] custom-chat-container">
        <LiveKitChat />
      </div>
    </div>
  );
}
