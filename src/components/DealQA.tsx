import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Loader2, Sparkles } from 'lucide-react';
import { askDeal } from '../services/api';
import type { Deal } from '../types';

interface Props {
  deal: Deal;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STARTER_QUESTIONS = [
  'What are the key financial metrics?',
  'Summarize the management team',
  'What are the main risk factors?',
  'What does the competitive landscape look like?',
];

export default function DealQA({ deal }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: question.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { answer } = await askDeal({
        dealId: deal.id,
        question: question.trim(),
        dealName: deal.name,
        company: deal.company,
        industry: deal.industry,
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to get a response. Please try again.'}`,
        },
      ]);
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
    <div className="max-w-4xl mx-auto flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="p-2 bg-[#0f477b]/8 rounded-lg">
          <MessageCircle className="w-5 h-5 text-[#0f477b]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[#171717]">Deal Q&A</h2>
          <p className="text-xs text-[#888888]">
            Ask questions about {deal.company}'s documents
          </p>
        </div>
      </div>

      {/* Message Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 space-y-4 pb-4 pr-1 scrollbar-thin scrollbar-thumb-[#d4d4d4] scrollbar-track-transparent"
      >
        {/* Starter Questions (shown when no messages) */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="p-3 bg-[#0f477b]/8 rounded-2xl mb-4">
              <Sparkles className="w-8 h-8 text-[#0f477b]" />
            </div>
            <h3 className="text-lg font-semibold text-[#171717] mb-1">Ask anything about this deal</h3>
            <p className="text-sm text-[#888888] mb-6 text-center max-w-sm">
              AI will analyze {deal.documents.length} uploaded document
              {deal.documents.length !== 1 ? 's' : ''} to answer your questions.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSubmit(q)}
                  className="px-3 py-1.5 bg-white border border-[#eaeaea] rounded-full text-xs text-[#666666] hover:bg-[#f5f5f5] hover:border-[#d4d4d4] hover:text-[#171717] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-[#0f477b] text-white rounded-br-md'
                  : 'bg-[#fafafa] border border-[#eaeaea] text-[#171717] rounded-bl-md'
              }`}
            >
              {msg.role === 'assistant' ? (
                <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {msg.content}
                </pre>
              ) : (
                <p className="text-sm leading-relaxed">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#fafafa] border border-[#eaeaea] text-[#171717] px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[#0f477b] animate-spin" />
                <span className="text-sm text-[#666666]">Analyzing documents...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={handleFormSubmit} className="shrink-0 pt-3 border-t border-[#f0f0f0]">
        <div className="flex items-center gap-2 bg-white border border-[#eaeaea] rounded-xl p-1.5 focus-within:border-[#0f477b]/50 transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about this deal..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-[#171717] placeholder-[#a1a1a1] px-3 py-2 outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 bg-[#0f477b] hover:bg-[#1a5c9e] disabled:bg-[#fafafa] disabled:text-[#a1a1a1] text-white rounded-lg transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
