"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Message {
  id: number;
  agent: "user" | "pm" | "dev" | "review";
  content: string;
  timestamp: string;
}

const agentConfig = {
  user: {
    name: "You",
    avatar: "👤",
    color: "bg-gray-600",
    borderColor: "border-gray-500",
  },
  pm: {
    name: "PM Claw",
    avatar: "📋",
    color: "bg-blue-600",
    borderColor: "border-blue-500",
  },
  dev: {
    name: "Dev Claw",
    avatar: "💻",
    color: "bg-green-600",
    borderColor: "border-green-500",
  },
  review: {
    name: "Reviewer Claw",
    avatar: "🔍",
    color: "bg-purple-600",
    borderColor: "border-purple-500",
  },
};

const demoConversation: Omit<Message, "id" | "timestamp">[] = [
  { agent: "user", content: "I need to build a landing page for my new SaaS product. Can you help?" },
  { agent: "pm", content: "Absolutely! I've analyzed the requirements. Let me break this down into tasks:\n\n1. Hero section with value proposition\n2. Feature highlights\n3. Pricing section\n4. CTA components\n\nDev Claw, can you start with the hero section?" },
  { agent: "dev", content: "Got it! I'm creating a responsive hero section with:\n\n• Animated gradient background\n• Responsive typography (mobile-first)\n• CTA button with hover effects\n• Accessible markup\n\nStarting implementation now..." },
  { agent: "review", content: "I'll be monitoring the code quality. A few things to keep in mind:\n\n• Ensure proper semantic HTML\n• Add ARIA labels where needed\n• Optimize images for performance\n• Test keyboard navigation\n\nReady to review when you push the code!" },
  { agent: "dev", content: "First commit ready! The hero section is complete with:\n\n✓ Gradient animation using CSS\n✓ Responsive design (375px to 1440px)\n✓ 95+ Lighthouse score\n✓ Full keyboard accessibility\n\nPR created: #1" },
  { agent: "review", content: "Code review complete! Great work overall. Minor suggestions:\n\n• Consider adding prefers-reduced-motion support\n• The gradient could use a slight opacity adjustment\n\nOtherwise, looks good! Approved ✓" },
  { agent: "pm", content: "Excellent teamwork! The hero section is now live. Next up:\n\n• Feature highlights section\n• Testimonials\n• Pricing table\n\nDev Claw, ready for the next feature?" },
];

function TypingIndicator({ agent }: { agent: keyof typeof agentConfig }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-start gap-3 mb-4"
    >
      <div className={`w-10 h-10 rounded-xl ${agentConfig[agent].color} flex items-center justify-center text-lg shadow-lg border-2 ${agentConfig[agent].borderColor}`}>
        {agentConfig[agent].avatar}
      </div>
      <div className="glass rounded-2xl rounded-tl-none px-4 py-3">
        <div className="flex gap-1">
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0 }}
            className="w-2 h-2 bg-gray-400 rounded-full"
          />
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
            className="w-2 h-2 bg-gray-400 rounded-full"
          />
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
            className="w-2 h-2 bg-gray-400 rounded-full"
          />
        </div>
      </div>
    </motion.div>
  );
}

function MessageBubble({ message, isTyping }: { message: Message; isTyping: boolean }) {
  const [displayedContent, setDisplayedContent] = useState("");
  const isUser = message.agent === "user";

  useEffect(() => {
    if (isTyping) {
      let index = 0;
      const content = message.content;
      setDisplayedContent("");
      
      const interval = setInterval(() => {
        if (index < content.length) {
          setDisplayedContent(content.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
        }
      }, 15);

      return () => clearInterval(interval);
    } else {
      setDisplayedContent(message.content);
    }
  }, [message.content, isTyping]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-start gap-3 mb-4 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div className={`w-10 h-10 rounded-xl ${agentConfig[message.agent].color} flex items-center justify-center text-lg shadow-lg border-2 ${agentConfig[message.agent].borderColor} flex-shrink-0`}>
        {agentConfig[message.agent].avatar}
      </div>
      <div className={`max-w-[70%] ${isUser ? "bg-primary-600/20 border-primary-500/30" : "glass"} rounded-2xl ${isUser ? "rounded-tr-none" : "rounded-tl-none"} px-4 py-3 border`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-semibold ${isUser ? "text-primary-400" : "text-white"}`}>
            {agentConfig[message.agent].name}
          </span>
          <span className="text-xs text-gray-500">{message.timestamp}</span>
        </div>
        <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
          {displayedContent}
          {isTyping && displayedContent.length < message.content.length && (
            <motion.span
              animate={{ opacity: [0, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="inline-block w-2 h-4 bg-primary-400 ml-1"
            />
          )}
        </p>
      </div>
    </motion.div>
  );
}

export default function DemoPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [currentTypingId, setCurrentTypingId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (currentIndex < demoConversation.length) {
      setIsTyping(true);
      
      const timer = setTimeout(() => {
        const newMessage: Message = {
          id: currentIndex,
          ...demoConversation[currentIndex],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        
        setMessages((prev) => [...prev, newMessage]);
        setCurrentTypingId(currentIndex);
        setIsTyping(false);
        
        setTimeout(() => {
          setCurrentTypingId(null);
          setCurrentIndex((prev) => prev + 1);
        }, newMessage.content.length * 15 + 500);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [currentIndex]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleRestart = () => {
    setMessages([]);
    setCurrentIndex(0);
    setIsTyping(false);
    setCurrentTypingId(null);
  };

  return (
    <div className="min-h-screen bg-dark flex flex-col">
      <header className="glass border-b border-dark-100 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              ← Back
            </Link>
            <div className="h-6 w-px bg-dark-100" />
            <h1 className="text-xl font-bold gradient-text">AI Team Demo</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {["📋", "💻", "🔍"].map((emoji, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-dark-50 flex items-center justify-center border-2 border-dark text-sm">
                  {emoji}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              All agents active
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        <div className="glass rounded-2xl p-6 min-h-[60vh] max-h-[70vh] overflow-y-auto hide-scrollbar border border-dark-100">
          <div className="text-center py-8 border-b border-dark-100 mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Team Chat</h2>
            <p className="text-gray-400 text-sm">Watch your AI team collaborate in real-time</p>
          </div>

          <AnimatePresence>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isTyping={currentTypingId === message.id}
              />
            ))}
          </AnimatePresence>

          {isTyping && currentIndex < demoConversation.length && (
            <TypingIndicator agent={demoConversation[currentIndex].agent} />
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="mt-6 flex justify-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRestart}
            className="px-6 py-3 glass rounded-xl text-white font-medium hover:bg-dark-100 transition-colors"
          >
            🔄 Restart Demo
          </motion.button>
          {currentIndex >= demoConversation.length && (
            <Link href="/chat">
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 rounded-xl text-white font-medium shadow-lg shadow-primary-500/30"
              >
                ✨ Start Your Project
              </motion.button>
            </Link>
          )}
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { emoji: "📋", label: "PM Claw", status: "Analyzing", color: "bg-blue-500" },
            { emoji: "💻", label: "Dev Claw", status: "Building", color: "bg-green-500" },
            { emoji: "🔍", label: "Reviewer Claw", status: "Monitoring", color: "bg-purple-500" },
          ].map((agent) => (
            <motion.div
              key={agent.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass rounded-xl p-4 text-center"
            >
              <div className="text-2xl mb-2">{agent.emoji}</div>
              <div className="text-sm font-medium text-white">{agent.label}</div>
              <div className="flex items-center justify-center gap-2 mt-1">
                <div className={`w-2 h-2 ${agent.color} rounded-full animate-pulse`} />
                <span className="text-xs text-gray-400">{agent.status}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
