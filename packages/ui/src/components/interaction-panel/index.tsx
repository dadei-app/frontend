import { useInteractionPanel } from './useInteractionPanel';
import ConversationCard from './ConversationCard';
import { useTutorialEngaged } from '@dadei/ui/contexts/TutorialContext';
import { cn } from '@dadei/ui/lib/shared/cn';

export default function InteractionPanel() {
  const {
    containerRef,
    loading,
    panelLoadError,
    retryPanelLoad,
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
  const tutorialEngaged = useTutorialEngaged();
  const chromeInteractive = !tutorialEngaged;

  return (
    <div
      data-tutorial-target="interaction-panel-root"
      className="flex h-full flex-col overflow-hidden rounded-none bg-zinc-950/30"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/6 bg-zinc-950/95 px-6 py-5 backdrop-blur-sm">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Interactions</h2>
          <p className="text-xs leading-relaxed text-zinc-500 font-secondary">
            Conversations and interactions captured by dadei
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void handleClearAll();
          }}
          disabled={conversationGroups.length === 0 || loading || !chromeInteractive}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-lg border border-white/6 bg-zinc-800/90 px-3.5 py-2 text-sm font-medium text-zinc-400 transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:cursor-not-allowed disabled:opacity-40',
            chromeInteractive &&
              'hover:border-white/10 hover:bg-zinc-700/90 hover:text-zinc-200',
          )}
        >
          <i className="fas fa-trash text-[11px] opacity-80" aria-hidden />
          Clear all
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 space-y-3 overflow-y-auto overscroll-none px-6 py-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
      >
        {panelLoadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="max-w-sm text-sm text-rose-200/90">{panelLoadError}</p>
            <button
              type="button"
              onClick={() => retryPanelLoad()}
              className="rounded-lg border border-white/10 bg-zinc-800/90 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700/90"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
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
