"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const agents = [
  {
    name: "PM Claw",
    role: "Product Manager",
    emoji: "📋",
    color: "from-blue-500 to-blue-600",
    description: "Strategizes & coordinates",
  },
  {
    name: "Dev Claw",
    role: "Developer",
    emoji: "💻",
    color: "from-green-500 to-green-600",
    description: "Builds & implements",
  },
  {
    name: "Reviewer Claw",
    role: "Code Reviewer",
    emoji: "🔍",
    color: "from-purple-500 to-purple-600",
    description: "Reviews & improves",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-dark via-dark-50 to-dark" />
      
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl animate-pulse-slow delay-1000" />
      
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-block mb-6"
          >
            <span className="px-4 py-2 rounded-full glass text-primary-400 text-sm font-medium border border-primary-500/30">
              ✨ The Future of Solo Entrepreneurship
            </span>
          </motion.div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="text-white">One Person. </span>
            <span className="gradient-text">Infinite Power.</span>
          </h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-8"
          >
            Build your dream team with AI agents that work together seamlessly.
            PM, Dev, Review — all synchronized.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="flex gap-4 justify-center flex-wrap"
          >
            <Link
              href="/team"
              className="px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-105"
            >
              Start Chatting →
            </Link>
            <Link
              href="/office"
              className="px-8 py-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105"
            >
              虚拟办公室 →
            </Link>
            <Link
              href="/demo"
              className="px-8 py-4 glass text-white font-semibold rounded-xl hover:bg-dark-100 transition-all duration-300"
            >
              View Demo
            </Link>
            <Link
              href="/dashboard"
              className="px-8 py-4 glass text-white font-semibold rounded-xl hover:bg-dark-100 transition-all duration-300 border border-primary-500/30"
            >
              Dashboard
            </Link>
          </motion.div>
        </motion.div>
        
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mt-8"
        >
          {agents.map((agent, index) => (
            <motion.div
              key={agent.name}
              variants={itemVariants}
              whileHover={{ scale: 1.05, y: -10 }}
              className="glass rounded-2xl p-6 glow-border"
            >
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-3xl mb-4 shadow-lg`}>
                {agent.emoji}
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{agent.name}</h3>
              <p className="text-primary-400 text-sm mb-2">{agent.role}</p>
              <p className="text-gray-400">{agent.description}</p>
              
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.8 + index * 0.2, duration: 0.8 }}
                className={`h-1 bg-gradient-to-r ${agent.color} rounded-full mt-4`}
              />
            </motion.div>
          ))}
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-16 text-center"
        >
          <div className="flex items-center justify-center gap-8 text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span>All agents online</span>
            </div>
            <div className="text-2xl">|</div>
            <div>
              <span className="text-white font-bold">10x</span> productivity boost
            </div>
            <div className="text-2xl">|</div>
            <div>
              <span className="text-white font-bold">24/7</span> availability
            </div>
          </div>
        </motion.div>
      </div>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-gray-500"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      </motion.div>
    </div>
  );
}
