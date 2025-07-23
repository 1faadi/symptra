'use client';

import { useChat } from 'ai/react';
import { useRef, useEffect, useState } from 'react';
import { Send, Bot, Loader2, Stethoscope, Building2, Sparkles } from 'lucide-react';

export default function ChatPage() {
  const [selectedDoc, setSelectedDoc] = useState('company-policy'); // Changed default to company-policy

  const {
    messages,
    input,
    handleInputChange,
    isLoading,
    append,
    setInput // Added setInput to clear the input
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (input && errorMessage) {
      setErrorMessage(null);
    }
  }, [input, errorMessage]);

  useEffect(() => {
    setIsTyping(isLoading);
  }, [isLoading]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const currentInput = input; // Store current input
    setErrorMessage(null);
    setIsTyping(true);

    // Clear input immediately after submission
    setInput('');

    // 1. Add user message immediately
    await append({
      role: 'user',
      content: currentInput
    });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: currentInput }],
          selectedDoc
        })
      });

      if (!response.ok || !response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantMessage = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value);
        assistantMessage += chunk;
      }

      await append({
        role: 'assistant',
        content: assistantMessage
      });
    } catch (err) {
      console.error('Chat error:', err);
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-all duration-300">
              <Bot className="w-7 h-7 text-white" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                {selectedDoc === 'company-policy' ? 'BXTrack Policy Guider' : 'Dengue Medical Assistant'}
              </h1>
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                {selectedDoc === 'company-policy' 
                  ? 'Your comprehensive guide to company policies & procedures'
                  : 'Expert medical guidance for dengue-related queries'
                }
              </p>
            </div>
          </div>

          {/* Dropdown for knowledge source */}
          <div className="relative">
            <select
              value={selectedDoc}
              onChange={(e) => setSelectedDoc(e.target.value)}
              className="appearance-none bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-gray-700 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200 cursor-pointer"
            >
              <option value="company-policy">
                🏢 Company Policy
              </option>
              <option value="dengue" className="flex items-center">
                🦟 Dengue Specialist
              </option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      {/* Messages display */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {isEmpty && (
          <div className="text-center mt-20">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              {selectedDoc === 'company-policy' ? (
                <Building2 className="w-10 h-10 text-blue-600" />
              ) : (
                <Stethoscope className="w-10 h-10 text-blue-600" />
              )}
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              How can I help you today?
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Ask me about {selectedDoc === 'company-policy' ? 'company policies and procedures' : 'dengue symptoms, treatments, or prevention'}
            </p>
          </div>
        )}
        {messages.map((m, index) => (
          <div
            key={index}
            className={`flex ${
              m.role === 'user' ? 'justify-end' : 'justify-start'
            } animate-in slide-in-from-bottom-2 duration-300`}
          >
            <div
              className={`px-5 py-4 rounded-2xl max-w-2xl text-sm leading-relaxed shadow-sm transition-all duration-200 hover:shadow-md ${
                m.role === 'user'
                  ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-blue-500/20'
                  : 'bg-white/90 backdrop-blur-sm text-gray-800 border border-gray-100'
              }`}
            >
              {m.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2 opacity-70">
                  <Bot className="w-4 h-4" />
                  <span className="text-xs font-medium">Assistant</span>
                </div>
              )}
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start animate-in slide-in-from-bottom-2 duration-300">
            <div className="px-5 py-4 rounded-2xl bg-white/90 backdrop-blur-sm border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2 opacity-70">
                <Bot className="w-4 h-4" />
                <span className="text-xs font-medium">Assistant</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm animate-in slide-in-from-bottom-2 duration-300">
          {errorMessage}
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200/50 bg-white/80 backdrop-blur-xl px-6 py-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              className="w-full px-6 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed pr-16 text-gray-800 placeholder-gray-500 bg-white/90 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 text-sm"
              value={input}
              onChange={handleInputChange}
              placeholder={selectedDoc === 'company-policy' 
                ? "Ask about company policies or procedures..." 
                : "Ask about dengue symptoms, prevention, or treatment..."
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleFormSubmit(e);
                }
              }}
              disabled={isLoading}
              maxLength={500}
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 font-medium">
              {input.length}/500
            </div>
          </div>
            <button
              type="submit"
              onClick={handleFormSubmit}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl font-medium flex items-center gap-3 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 disabled:shadow-none disabled:scale-100"
              disabled={isLoading || !input.trim()}
            >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            <span className="hidden sm:inline">Send</span>
            </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse inline-block"></span>
            {selectedDoc === 'company-policy' ? 'BXTrack Policy Guider' : 'Dengue Medical Assistant'} • Always verify medical or policy info with the relevant authority
          </p>
        </div>
      </div>
    </div>
  );
}