'use client';

import { useChat } from 'ai/react';
import { useRef, useEffect, useState } from 'react';
import { Send, Bot, Loader2, Building2, Sun, Moon, ArrowUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

export default function ChatPage() {
  const [selectedDoc] = useState('company-policy');
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { messages, input, handleInputChange, isLoading, append, setInput } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isTyping, setIsTyping] = useState(false);

  // Streaming states
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Dark mode initialization
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

  // ✅ Fixed word-by-word streaming function
  const streamText = (fullText: string) => {
    const words = fullText.split(' ');
    let currentIndex = 0;
    setStreamingMessage(''); // Clear any previous streaming message
    setIsStreaming(true);

    const streamNextWord = () => {
      if (currentIndex < words.length) {
        // ✅ Build message progressively, ensuring first word is included
        const currentMessage = words.slice(0, currentIndex + 1).join(' ');
        setStreamingMessage(currentMessage);
        currentIndex++;
        setTimeout(streamNextWord, 80);
      } else {
        // ✅ Clean transition: First clear streaming, then add final message
        setTimeout(() => {
          setIsStreaming(false);
          setStreamingMessage(''); // Clear streaming message first
          // ✅ Add final message after clearing streaming state
          setTimeout(() => {
            append({ role: 'assistant', content: fullText });
          }, 50); // Small delay to ensure clean state transition
        }, 100);
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
    setStreamingMessage(''); // ✅ Clear any previous streaming message
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

      // ✅ Ensure clean state before starting stream
      setTimeout(() => {
        streamText(assistantMessage);
      }, 100);

    } catch (err) {
      console.error('Chat error:', err);
      setErrorMessage('Something went wrong. Please try again.');
      setIsTyping(false);
      setIsStreaming(false);
    }
  };

  // Properly typed markdown components
  const markdownComponents: Components = {
    strong: ({ children, ...props }) => (
      <span className="font-bold text-gray-900 dark:text-white" {...props}>
        {children}
      </span>
    ),
    em: ({ children, ...props }) => (
      <span className="italic text-gray-800 dark:text-gray-200" {...props}>
        {children}
      </span>
    ),
    p: ({ children, ...props }) => (
      <p className="mb-3 last:mb-0 leading-relaxed" {...props}>
        {children}
      </p>
    ),
    h1: ({ children, ...props }) => (
      <h1 className="text-lg font-bold mb-3 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-base font-bold mb-2 text-gray-900 dark:text-white" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200" {...props}>
        {children}
      </h3>
    ),
    ul: ({ children, ...props }) => (
      <ul className="list-disc list-inside mb-3 space-y-1 ml-4" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="list-decimal list-inside mb-3 space-y-1 ml-4" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="text-gray-900 dark:text-white" {...props}>
        {children}
      </li>
    ),
    code: ({ children, className, ...props }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
            {children}
          </code>
        );
      }
      return (
        <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg mb-3 overflow-x-auto">
          <code className="text-sm font-mono text-gray-900 dark:text-white" {...props}>
            {children}
          </code>
        </pre>
      );
    },
    blockquote: ({ children, ...props }) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-3 bg-blue-50 dark:bg-blue-900/20 italic" {...props}>
        {children}
      </blockquote>
    ),
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto mb-3">
        <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead className="bg-gray-50 dark:bg-gray-800" {...props}>
        {children}
      </thead>
    ),
    tbody: ({ children, ...props }) => (
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700" {...props}>
        {children}
      </tbody>
    ),
    tr: ({ children, ...props }) => (
      <tr {...props}>{children}</tr>
    ),
    td: ({ children, ...props }) => (
      <td className="px-4 py-2 text-sm border-r border-gray-200 dark:border-gray-700 last:border-r-0" {...props}>
        {children}
      </td>
    ),
    th: ({ children, ...props }) => (
      <th className="px-4 py-2 text-sm font-semibold text-left border-r border-gray-200 dark:border-gray-700 last:border-r-0" {...props}>
        {children}
      </th>
    ),
  };

  const isEmpty = messages.length === 0;

  const policyPrompts = [
    'What are the company vacation policies?',
    'What are the office timings?',
    'What is the leave policy?',
    'How do I file a complaint?',
  ];

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black text-gray-900 dark:text-white transition-colors">
      {/* Header */}
      <header className="flex items-center justify-center h-12 border-b border-gray-200 dark:border-gray-800 relative">
        <h1 className="text-sm font-medium">BXTrack Policy Guider</h1>

        <button
          onClick={toggleDarkMode}
          className="absolute right-4 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle theme"
        >
          {darkMode ? (
            <Sun className="w-4 h-4 text-yellow-500" />
          ) : (
            <Moon className="w-4 h-4 text-gray-600" />
          )}
        </button>
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
                        {/* Enhanced markdown rendering for assistant messages */}
                        <div className="text-sm leading-6 prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown components={markdownComponents}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* ✅ Fixed streaming message rendering */}
              {isStreaming && streamingMessage && (
                <div className="mb-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Enhanced markdown rendering for streaming */}
                      <div className="text-sm leading-6 prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown components={markdownComponents}>
                          {streamingMessage}
                        </ReactMarkdown>
                        <span className="animate-pulse text-gray-500 ml-1">|</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Thinking animation */}
              {isTyping && !isStreaming && (
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
            <div className="relative flex items-center">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                placeholder="Message BXTrack Policy Guider"
                maxLength={500}
                disabled={isLoading || isStreaming}
                rows={1}
                className="w-full px-4 py-3 pr-12 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 resize-none transition-colors text-sm leading-6"
                style={{ minHeight: '48px', maxHeight: '200px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleFormSubmit(e);
                  }
                }}
              />

              {/* Button positioned with flexbox centering */}
              <button
                type="submit"
                disabled={isLoading || isStreaming || !input.trim()}
                className="absolute right-2 w-9 h-9 rounded-full bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 disabled:bg-gray-300 dark:disabled:bg-gray-700 flex items-center justify-center transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 text-white dark:text-black animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4 text-white dark:text-black" />
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
