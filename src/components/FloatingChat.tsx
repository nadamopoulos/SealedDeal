import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, X, Loader2, Sparkles } from 'lucide-react';
import { askDeal } from '../services/api';
import type { Deal, Document } from '../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  dealId: string;
  deal: Deal;
  documents: Document[];
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  pendingPrompt?: string | null;
  onClearPendingPrompt?: () => void;
  chatMessages: ChatMessage[];
  onAddMessage: (msg: ChatMessage) => void;
}

const STARTER_QUESTIONS = [
  'What are the key financial metrics?',
  'Summarize the management team',
  'What are the main risk factors?',
  'Competitive landscape overview',
];

export default function FloatingChat({
  dealId,
  deal,
  documents,
  isOpen,
  onToggle,
  pendingPrompt,
  onClearPendingPrompt,
  chatMessages,
  onAddMessage,
}: Props) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingHandled = useRef(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle pending prompt
  useEffect(() => {
    if (pendingPrompt && isOpen && !pendingHandled.current && !isLoading) {
      pendingHandled.current = true;
      handleSubmit(pendingPrompt);
      onClearPendingPrompt?.();
    }
    if (!pendingPrompt) {
      pendingHandled.current = false;
    }
  }, [pendingPrompt, isOpen, isLoading]);

  const handleSubmit = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: question.trim() };
    onAddMessage(userMessage);
    setInput('');
    setIsLoading(true);

    try {
      const { answer } = await askDeal({
        dealId,
        question: question.trim(),
        dealName: deal.name,
        company: deal.company,
        industry: deal.industry,
      });

      onAddMessage({ role: 'assistant', content: answer });
    } catch (err: any) {
      onAddMessage({
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to get a response. Please try again.'}`,
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(input);
  };

  return (
    <>
      {/* Chat Panel */}
      <div
        className={`fixed bottom-20 right-5 z-50 w-[380px] max-h-[70vh] flex flex-col bg-white rounded shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.12)] transition-all duration-200 origin-bottom-right ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
        }`}
        style={{ borderRadius: '4px' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 flex items-center justify-center rounded"
              style={{ background: 'var(--purple-bg)', borderRadius: '4px' }}
            >
              <MessageCircle className="w-3.5 h-3.5 text-ds-purple" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-semibold text-ds-black">Ask the Deal</h3>
              <p className="font-mono text-[10px] text-ds-gray-500 leading-tight">
                {documents.length} doc{documents.length !== 1 ? 's' : ''} indexed
              </p>
            </div>
          </div>
          <button
            onClick={() => onToggle(false)}
            className="p-1.5 hover:bg-ds-gray-100 rounded transition-colors"
            style={{ borderRadius: '4px' }}
          >
            <X className="w-4 h-4 text-ds-gray-500" />
          </button>
        </div>

        {/* Messages Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3"
          style={{ maxHeight: 'calc(70vh - 120px)' }}
        >
          {/* Empty state */}
          {chatMessages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div
                className="w-10 h-10 flex items-center justify-center rounded mb-3"
                style={{ background: 'var(--purple-bg)', borderRadius: '4px' }}
              >
                <Sparkles className="w-5 h-5 text-ds-purple" />
              </div>
              <p className="font-heading text-sm font-medium text-ds-black mb-1">
                Ask anything about this deal
              </p>
              <p className="font-body text-xs text-ds-gray-500 mb-4 text-center px-4">
                AI analyzes {documents.length} document{documents.length !== 1 ? 's' : ''} to answer
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 px-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSubmit(q)}
                    className="px-2.5 py-1 bg-ds-gray-50 border text-[11px] font-mono text-ds-gray-600 hover:bg-ds-gray-100 hover:text-ds-black transition-colors"
                    style={{
                      borderRadius: '4px',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-ds-purple text-white'
                    : 'bg-ds-gray-100 text-ds-black'
                }`}
                style={{ borderRadius: '4px' }}
              >
                {msg.role === 'assistant' ? (
                  <pre className="font-body text-xs leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </pre>
                ) : (
                  <p className="font-body text-xs leading-relaxed">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div
                className="bg-ds-gray-100 px-3 py-2"
                style={{ borderRadius: '4px' }}
              >
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-ds-purple animate-spin" />
                  <span className="font-mono text-[11px] text-ds-gray-500">
                    Analyzing documents...
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleFormSubmit}
          className="shrink-0 px-3 py-2.5 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div
            className="flex items-center gap-2 bg-ds-gray-50 border px-2 py-1 focus-within:border-ds-purple/50 transition-colors"
            style={{ borderRadius: '4px', borderColor: 'var(--border-subtle)' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={isLoading}
              className="flex-1 bg-transparent font-body text-xs text-ds-black placeholder-ds-gray-400 px-1 py-1.5 outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-1.5 bg-ds-purple hover:bg-ds-purple-dark disabled:bg-ds-gray-100 disabled:text-ds-gray-400 text-white transition-colors shrink-0"
              style={{ borderRadius: '4px' }}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Floating Toggle Button */}
      <button
        onClick={() => onToggle(!isOpen)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 flex items-center justify-center bg-ds-purple hover:bg-ds-purple-dark text-white shadow-[0_2px_12px_rgba(103,58,183,0.35)] transition-all duration-200 hover:scale-105"
        style={{ borderRadius: '4px' }}
        aria-label="Toggle chat"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-5 h-5" />
        )}
      </button>
    </>
  );
}
