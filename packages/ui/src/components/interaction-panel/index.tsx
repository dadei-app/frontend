import { useInteractionPanel } from './useInteractionPanel';
import ConversationCard from './ConversationCard';

export default function InteractionPanel() {
  const {
    containerRef,
    loading,
    conversationGroups,
    displayGroups,
    prefersReducedMotion,
    armedInteractionDeleteId,
    armedConversationDeleteId,
    setArmedInteractionDeleteId,
    setArmedConversationDeleteId,
    toggleConversation,
    handleDeleteInteraction,
    handleDeleteConversation,
    handleClearAll,
    getPersonDisplay,
  } = useInteractionPanel();

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-none bg-zinc-950/30">
      <div className="flex items-center justify-between border-b border-white/8 bg-zinc-950/40 px-6 py-6 backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-zinc-100">Interactions</h2>
        <button
          type="button"
          onClick={() => {
            void handleClearAll();
          }}
          disabled={conversationGroups.length === 0 || loading}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-300/95 transition-all duration-200 hover:border-emerald-500/45 hover:bg-emerald-950/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <i className="fas fa-trash" />
          Clear All
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 space-y-3 overflow-y-auto overscroll-none px-6 py-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <i className="fas fa-spinner fa-spin text-3xl text-emerald-400/80" />
          </div>
        ) : displayGroups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <i className="fas fa-robot mb-4 text-5xl text-zinc-600 opacity-50" />
            <p className="mb-2 text-lg font-medium text-zinc-500">No conversations yet</p>
            <small className="text-sm text-zinc-600 opacity-90 font-secondary">
              Start speaking to interact with your AI assistant
            </small>
          </div>
        ) : (
          displayGroups.map((group, groupIndex) => (
            <div key={group.conversation?.id || `orphan-${groupIndex}`} className="min-w-0 space-y-2">
              <ConversationCard
                group={group}
                groupIndex={groupIndex}
                prefersReducedMotion={!!prefersReducedMotion}
                armedConversationDeleteId={armedConversationDeleteId}
                armedInteractionDeleteId={armedInteractionDeleteId}
                setArmedConversationDeleteId={setArmedConversationDeleteId}
                setArmedInteractionDeleteId={setArmedInteractionDeleteId}
                toggleConversation={toggleConversation}
                handleDeleteConversation={handleDeleteConversation}
                handleDeleteInteraction={handleDeleteInteraction}
                getPersonDisplay={getPersonDisplay}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
