'use client';

import { useChat } from 'ai/react';
import { useRef, useEffect, useState } from 'react';
import { Send, Bot, Loader2, Building2, Sun, Moon } from 'lucide-react';

export default function ChatPage() {
  const [selectedDoc] = useState('company-policy');
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { messages, input, handleInputChange, isLoading, append, setInput } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  // Streaming states
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved ? saved === 'dark' : prefersDark;
    
    setDarkMode(shouldBeDark);
    
    const htmlElement = document.documentElement;
    if (shouldBeDark) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
      
      const htmlElement = document.documentElement;
      if (newDarkMode) {
        htmlElement.classList.add('dark');
      } else {
        htmlElement.classList.remove('dark');
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (input && errorMessage) setErrorMessage(null);
  }, [input, errorMessage]);

  // Word-by-word streaming function
  const streamText = (fullText: string) => {
    const words = fullText.split(' ');
    let currentIndex = 0;
    setStreamingMessage('');
    setIsStreaming(true);

    const streamNextWord = () => {
      if (currentIndex < words.length) {
        setStreamingMessage(prev => 
          prev + (currentIndex > 0 ? ' ' : '') + words[currentIndex]
        );
        currentIndex++;
        setTimeout(streamNextWord, 80); // Adjust speed here (80ms per word)
      } else {
        // Streaming complete, add to messages
        setIsStreaming(false);
        append({ role: 'assistant', content: fullText });
        setStreamingMessage('');
      }
    };

    streamNextWord();
  };

  const handleFormSubmit = async (e: React.FormEvent, quickPrompt?: string) => {
    e.preventDefault();
    const content = (quickPrompt ?? input).trim();
    if (!content) return;

    setErrorMessage(null);
    setIsTyping(true);
    setStreamingMessage('');
    setIsStreaming(false);
    setInput('');

    // Add user message immediately
    await append({ role: 'user', content });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content }],
          selectedDoc: 'company-policy'
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
        if (value) assistantMessage += decoder.decode(value);
      }

      setIsTyping(false);
      
      // Start word-by-word streaming
      streamText(assistantMessage);

    } catch (err) {
      console.error('Chat error:', err);
      setErrorMessage('Something went wrong. Please try again.');
      setIsTyping(false);
      setIsStreaming(false);
    }
  };

  const isEmpty = messages.length === 0;

  const policyPrompts = [
    'What are the company policies?',
    'How do I submit a leave?',
    'What is the code of conduct?',
    'How do I submit complain to HR?'
  ];

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black text-gray-900 dark:text-white transition-colors">
      {/* Header */}
      <header className="flex items-center justify-center h-12 border-b border-gray-200 dark:border-gray-800 relative">
        <h1 className="text-sm font-medium">BXTrack Policy Guider</h1>
        
        {/* <button
          onClick={toggleDarkMode}
          className="absolute right-4 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle theme"
        >
          {darkMode ? (
            <Sun className="w-4 h-4 text-yellow-500" />
          ) : (
            <Moon className="w-4 h-4 text-gray-600" />
          )}
        </button> */}
      </header>

      {/* Main chat area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4">
            {/* Empty state */}
            {isEmpty && !isStreaming && (
              <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] py-8">
                <div className="w-10 h-10 rounded-full bg-black dark:bg-white flex items-center justify-center mb-4">
                  <Bot className="w-5 h-5 text-white dark:text-black" />
                </div>
                
                <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                  How can I help you today?
                </h2>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 text-center">
                  Ask me about company policies and procedures
                </p>

                {/* Prompt cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                  {policyPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={(e) => handleFormSubmit(e, prompt)}
                      className="p-4 text-left text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="py-8">
              {messages.map((message, index) => (
                <div key={index} className="mb-6 last:mb-0">
                  {message.role === 'user' ? (
                    <div className="flex justify-end">
                      <div className="bg-black dark:bg-white text-white dark:text-black rounded-3xl px-5 py-3 max-w-[70%]">
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap leading-6">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming message */}
              {isStreaming && (
                <div className="mb-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap leading-6">
                        {streamingMessage}
                        <span className="animate-pulse">|</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Thinking animation */}
              {isTyping && (
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-1 min-w-0 py-2">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" 
                           style={{
                             animation: 'chatgpt-thinking 1.4s ease-in-out infinite',
                             transformOrigin: 'center'
                           }}>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="max-w-3xl mx-auto px-4 pb-4">
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            {errorMessage}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        <div className="max-w-3xl mx-auto">
          <form className="relative" onSubmit={(e) => handleFormSubmit(e)}>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Message BXTrack Policy Guider"
                  maxLength={500}
                  disabled={isLoading || isStreaming}
                  rows={1}
                  className="w-full px-4 py-3 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 resize-none transition-colors text-sm leading-6"
                  style={{ minHeight: '48px', maxHeight: '200px' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleFormSubmit(e);
                    }
                  }}
                />
                <div className="absolute bottom-3 right-16 text-xs text-gray-400 dark:text-gray-500">
                  {input.length}/500
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isLoading || isStreaming || !input.trim()}
                className="w-8 h-8 rounded-full bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 disabled:bg-gray-300 dark:disabled:bg-gray-700 flex items-center justify-center transition-colors flex-shrink-0 mb-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 text-white dark:text-black animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-white dark:text-black" />
                )}
              </button>
            </div>
          </form>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
            BXTrack Policy Guider can make mistakes. Check important info.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes chatgpt-thinking {
          0%, 100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.5);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
