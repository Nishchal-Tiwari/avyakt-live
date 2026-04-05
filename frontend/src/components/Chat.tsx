import { Chat as LiveKitChat } from "@livekit/components-react";

export default function Chat({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col w-80 md:w-96 h-full bg-stone-800 border-l border-stone-700 relative">
      <div className="flex justify-between items-center p-3 border-b border-stone-700 bg-stone-900 absolute top-0 left-0 right-0 z-10 h-[52px]">
        <h3 className="text-white font-medium">Meeting Chat</h3>
        {onClose && (
          <button 
            type="button"
            onClick={onClose} 
            className="text-stone-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Container for the actual LiveKit Chat component */}
      <div className="flex-1 mt-[52px] h-[calc(100%-52px)] custom-chat-container">
        <LiveKitChat />
      </div>
    </div>
  );
}
