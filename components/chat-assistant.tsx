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
import { useCartStore } from '@/lib/store' // Đã thêm thư viện gọi Giỏ hàng

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function useGeminiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  // Đã thêm: Kéo số bàn từ giỏ hàng ra
  const tableNumber = useCartStore((state) => state.tableNumber)

  const sendMessage = useCallback(async (text: string) => {
    // 1. Hiển thị tin nhắn của khách lên màn hình
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)

    // 2. Tạo một bong bóng chat trống để đợi AI trả lời
    const assistantId = `assistant-${Date.now()}`
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      // 3. Gửi tin nhắn lên "Bộ não" (kèm theo số bàn)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, tableNumber }), // Đã gói thêm tableNumber
      })

      const data = await res.json()

      // 4. Cập nhật câu trả lời của AI vào bong bóng chat
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: data.reply } : m
        )
      )

      // 5. Nếu AI vừa chốt đơn xong, chạy thêm hiệu ứng hoặc thông báo
      if (data.action === "order_created") {
        console.log("🎉 Ting! Khách vừa chốt đơn qua Chatbot thành công!")
      }

    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Xin lỗi, hệ thống đang bận: ${(err as Error).message}` }
            : m
        )
      )
    } finally {
      setIsLoading(false)
    }
  }, [tableNumber]) // Cập nhật dependency

  return { messages, sendMessage, isLoading }
}

export function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, isLoading } = useGeminiChat()

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

  // Đã sửa lại gợi ý cho hợp với menu đồ uống
  const quickActions = [
    { label: 'Gợi ý món best-seller', icon: Sparkles },
    { label: 'Cho 1 Nước Cam', icon: Coffee },
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
                    {isLoading ? 'Đang soạn tin...' : 'Trực tuyến'}
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
                    Xin chào!
                  </h4>
                  <p className="mb-6 max-w-[250px] text-sm text-muted-foreground">
                    Mình là trợ lý ảo của quán. Bạn muốn gọi món gì hay cần tư vấn đồ uống cứ nhắn mình nhé!
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
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
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
                  placeholder="Gõ tin nhắn để đặt món..."
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
                Powered by Gemini AI - Hệ thống tự động chốt đơn
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}