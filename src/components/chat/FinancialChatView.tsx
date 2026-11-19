'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Currency, Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { generateChatResponse } from '@/lib/chat/chatEngine';
import { EmptyState } from '@/components/ui/empty-state';
import type { ChatMessage } from '@/lib/chat/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Send,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  Receipt,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

let messageSeq = 0;
function createMessageId(prefix: string) {
  messageSeq += 1;
  return `msg_${prefix}_${messageSeq}`;
}

function getFormattedTime() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

interface FinancialChatViewProps {
  currency: Currency;
  transactions: Transaction[];
  onViewTransactions: (filter?: {
    category?: string;
    type?: string;
    merchant?: string;
    search?: string;
  }) => void;
}

const SUGGESTED_PROMPTS = [
  'How much did I spend on food and dining?',
  'What was my true external income vs living expenses?',
  'How much did I sweep into savings vaults?',
  'Who are my top merchants by spending?',
  'What was my daily burn rate?',
  'Did I pay any bank charges or transfer fees?',
  'Show me my largest single transactions',
  'What is my overall net cash flow?',
];

export function FinancialChatView({ currency, transactions, onViewTransactions }: FinancialChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg_welcome',
      role: 'assistant',
      content: `Hello! I am your **Financial AI Analyst**. You can ask me any question about your uploaded bank statement—such as spending by category, merchant charges, income, savings sweeps, or cash flow.\n\n🔒 **Strict Grounding Guarantee:** Every answer I provide queries your real calculation engine and cites exact transaction records. I never fabricate numbers or invent transactions.`,
      timestamp: 'Today',
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: createMessageId('user'),
      role: 'user',
      content: query,
      timestamp: getFormattedTime(),
    };

    const assistantMsg = generateChatResponse(query, transactions, currency);

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const toggleCitations = (msgId: string) => {
    setExpandedCitations((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'msg_welcome',
        role: 'assistant',
        content: `Conversation reset. I am ready to answer any questions about your verified financial statement.`,
        timestamp: 'Today',
      },
    ]);
  };

  if (transactions.length === 0) {
    return (
      <EmptyState
        badge="AI Financial Chat"
        badgeVariant="info"
        title="No Bank Statement Loaded for Chat"
        description="Upload your bank statement so the AI analyst can answer specific questions with 100% mathematical precision and zero hallucinations."
        actionLabel="Upload Bank Statement"
        onAction={() => onViewTransactions()}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Top Banner: Financial AI Chat Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Financial Statement Chat
              </h1>
              <Badge variant="success" className="gap-1 font-mono text-[10px]">
                <ShieldCheck className="w-3.5 h-3.5" /> Deterministic Verification
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Natural-language query engine grounded in your verified statement records ({transactions.length} active transactions)
            </p>
          </div>
        </div>

        <button
          onClick={handleResetChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-medium transition-colors self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Chat</span>
        </button>
      </div>

      {/* Suggested Quick Prompt Pills */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 pl-1">
          Suggested Financial Inquiries
        </p>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap transition-all shadow-2xs hover:shadow-xs"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Main Conversation Window */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 shadow-xs flex flex-col min-h-[460px]">
        <CardContent className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4 max-h-[580px]">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const qr = msg.queryResult;
            const isExpanded = qr ? expandedCitations[msg.id] : false;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs leading-relaxed ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`space-y-2.5 max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-2xs ${
                    isUser
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-br-xs'
                      : 'bg-white border border-slate-200/90 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 rounded-bl-xs'
                  }`}
                >
                  {/* Message Prose Content */}
                  <div className="whitespace-pre-wrap font-sans text-xs sm:text-[13px] leading-relaxed">
                    {msg.content.split('\n\n').map((para, i) => (
                      <p key={i} className="mb-2 last:mb-0">
                        {para.split('**').map((chunk, j) =>
                          j % 2 === 1 ? <strong key={j} className="font-semibold">{chunk}</strong> : chunk
                        )}
                      </p>
                    ))}
                  </div>

                  {/* Assistant Grounding Badge & Result Strip */}
                  {!isUser && qr && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Grounded in Real Data
                        </span>

                        {qr.traceFilter && (
                          <button
                            onClick={() => onViewTransactions(qr.traceFilter)}
                            className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors"
                          >
                            <span>Filter in Ledger</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Cited Transactions Accordion */}
                      {qr.citedTransactions.length > 0 && (
                        <div className="rounded-xl border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 p-2.5 text-xs">
                          <div
                            onClick={() => toggleCitations(msg.id)}
                            className="flex items-center justify-between cursor-pointer text-slate-600 dark:text-slate-300 font-medium"
                          >
                            <span className="flex items-center gap-1.5">
                              <Receipt className="w-3.5 h-3.5 text-slate-400" />
                              {qr.citedTransactions.length} Cited Transaction{qr.citedTransactions.length > 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600">
                              {isExpanded ? 'Hide' : 'View'}
                              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </span>
                          </div>

                          {isExpanded && (
                            <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-700 divide-y divide-slate-200/60 dark:divide-slate-700/60">
                              {qr.citedTransactions.map((tx) => (
                                <div
                                  key={tx.id}
                                  onClick={() => onViewTransactions({ search: tx.id })}
                                  className="py-1.5 flex items-center justify-between gap-2 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                >
                                  <div className="truncate max-w-[200px] sm:max-w-[260px]">
                                    <p className="font-medium truncate">{tx.description}</p>
                                    <p className="text-[10px] text-slate-400">{tx.date} • {tx.category}</p>
                                  </div>
                                  <span className={`font-mono font-semibold whitespace-nowrap ${tx.direction === 'DEBIT' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {tx.direction === 'DEBIT' ? '-' : '+'}{formatCurrency(tx.amount, currency)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <p className={`text-[10px] ${isUser ? 'text-slate-300 dark:text-slate-500' : 'text-slate-400'} text-right`}>
                    {msg.timestamp}
                  </p>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5 text-xs font-semibold">
                    You
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input Bar Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your spending, income, merchants, or savings..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/60 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputQuery.trim()}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm transition-colors shadow-xs"
            >
              <span>Ask</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
