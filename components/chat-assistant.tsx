'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle,
  X,
  Send,
  Coffee,
  Sparkles,
  Bot,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SESSION_KEY = 'qwenpaw_session_id'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = `coffee-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

function useQwenpawChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const sessionIdRef = useRef<string>('')

  useEffect(() => {
    sessionIdRef.current = getSessionId()
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }

    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    const assistantId = `assistant-${Date.now()}`
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          session_id: sessionIdRef.current,
        }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: `Error: ${event.error.message}` }
                    : m,
                ),
              )
              setIsLoading(false)
              return
            }

            if (
              event.status === 'in_progress' ||
              event.status === 'completed'
            ) {
              if (event.output) {
                for (const item of event.output) {
                  if (item.role === 'assistant') {
                    for (const content of item.content || []) {
                      if (content.type === 'text') {
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.id === assistantId
                              ? { ...m, content: content.text }
                              : m,
                          ),
                        )
                      }
                    }
                  }
                }
              }
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Connection error: ${(err as Error).message}` }
            : m,
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { messages, sendMessage, isLoading }
}

export function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, isLoading } = useQwenpawChat()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput('')
  }

  const quickActions = [
    { label: 'Recommend a drink', icon: Coffee },
    { label: 'What pairs with latte?', icon: Sparkles },
  ]

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-28 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/25"
          >
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
              AI
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 bottom-4 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl sm:bottom-6 sm:left-auto sm:right-6 sm:top-auto sm:h-[600px] sm:w-[380px]"
          >
            <div className="flex items-center justify-between border-b border-border/50 bg-primary/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Coffee className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-foreground">
                    Trợ lý Barista
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isLoading ? 'Đang trả lời...' : 'Sẵn sàng'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-8 w-8 text-primary" />
                  </div>
                  <h4 className="mb-2 font-serif text-lg font-semibold text-foreground">
                    Hi there!
                  </h4>
                  <p className="mb-6 max-w-[250px] text-sm text-muted-foreground">
                    {"I'm your personal barista assistant. Ask me anything about our menu or get personalized recommendations!"}
                  </p>
                  <div className="flex flex-col gap-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => sendMessage(action.label)}
                        className="flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-4 py-2 text-sm text-foreground transition-colors hover:bg-primary/5 hover:border-primary/30"
                      >
                        <action.icon className="h-4 w-4 text-primary" />
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          message.role === 'user'
                            ? 'bg-accent/20'
                            : 'bg-primary/10'
                        }`}
                      >
                        {message.role === 'user' ? (
                          <User className="h-4 w-4 text-accent-foreground" />
                        ) : (
                          <Coffee className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-muted/50 text-foreground rounded-tl-sm'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">
                          {message.content || (isLoading ? '...' : '')}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && !messages[messages.length - 1].content && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Coffee className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted/50 px-4 py-3">
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                          className="h-2 w-2 rounded-full bg-primary/60"
                        />
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                          className="h-2 w-2 rounded-full bg-primary/60"
                        />
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                          className="h-2 w-2 rounded-full bg-primary/60"
                        />
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="border-t border-border/50 bg-background/50 p-4"
            >
              <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Hỏi về thực đơn hoặc đặt món..."
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  className="h-8 w-8 shrink-0 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Powered by QwenPaw AI - Your friendly barista assistant
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
