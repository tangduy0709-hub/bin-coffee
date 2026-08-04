import { create } from 'zustand'

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: 'coffee' | 'tea' | 'pastry' | 'specialty'
  image: string
  tags?: string[]
  recommended?: boolean
}

export interface CartItem extends MenuItem {
  cartItemId: string
  quantity: number
  customizations?: {
    size?: 'small' | 'medium' | 'large'
    milk?: 'whole' | 'oat' | 'almond' | 'soy'
    ice?: 'none' | 'light' | 'normal' | 'extra'
    sugar?: 'none' | 'light' | 'normal' | 'extra'
    extras?: string[]
  }
}

export interface Order {
  id: string
  order_number?: string 
  items: CartItem[]
  total: number
  status: 'pending' | 'preparing' | 'ready' | 'completed'
  createdAt: Date
  estimatedTime: number
  tableNumber?: string
}

interface CartStore {
  items: CartItem[]
  currentOrder: Order | null
  tableNumber: string
  addItem: (item: MenuItem, customizations?: CartItem['customizations']) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
  setTableNumber: (tableNumber: string) => void
  placeOrder: () => Order | null
  updateOrderStatus: (status: Order['status']) => void
  setRealOrder: (order: any) => void
  setOrder: (order: any) => void
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  currentOrder: null,
  tableNumber: '',

  addItem: (item, customizations) => {
    set((state) => {
      const normalizedCustomizations =
        customizations &&
        customizations.ice === 'normal' &&
        customizations.sugar === 'normal'
          ? undefined
          : customizations

      const customizationsStr = JSON.stringify(normalizedCustomizations || {})
      const cartItemId = `${item.id}-${Math.random().toString(36).substr(2, 9)}`

      const existingItem = state.items.find(
        (i) =>
          i.id === item.id &&
          JSON.stringify(i.customizations || {}) === customizationsStr
      )
      if (existingItem) {
        return {
          items: state.items.map((i) =>
            i.cartItemId === existingItem.cartItemId
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        }
      }
      return {
        items: [
          ...state.items,
          { ...item, cartItemId, quantity: 1, customizations: normalizedCustomizations },
        ],
      }
    })
  },

  removeItem: (cartItemId) => {
    set((state) => ({
      items: state.items.filter((i) => i.cartItemId !== cartItemId),
    }))
  },

  updateQuantity: (cartItemId, quantity) => {
    set((state) => ({
      items:
        quantity === 0
          ? state.items.filter((i) => i.cartItemId !== cartItemId)
          : state.items.map((i) =>
              i.cartItemId === cartItemId ? { ...i, quantity } : i
            ),
    }))
  },

  clearCart: () => {
    set({ items: [] })
  },

  getTotal: () => {
    const { items } = get()
    return items.reduce((total, item) => total + item.price * item.quantity, 0)
  },

  getItemCount: () => {
    const { items } = get()
    return items.reduce((count, item) => count + item.quantity, 0)
  },

  setTableNumber: (tableNumber) => {
    set({ tableNumber })
  },

  placeOrder: () => {
    const { items, getTotal, tableNumber, clearCart } = get()
    if (items.length === 0) return null

    const order: Order = {
      id: `ORD-${Date.now().toString(36).toUpperCase()}`,
      items: [...items],
      total: getTotal(),
      status: 'pending',
      createdAt: new Date(),
      estimatedTime: 5 + Math.floor(Math.random() * 10),
      tableNumber,
    }

    set({ currentOrder: order })
    clearCart()
    return order
  },

  updateOrderStatus: (status) =>
    set((state) => ({
      currentOrder: state.currentOrder
        ? { ...state.currentOrder, status: status }
        : null,
    })),

  setRealOrder: (order) => set({ currentOrder: order }),
  setOrder: (order) => set({ currentOrder: order }),
}))

export const menuItems: MenuItem[] = [
  {
    id: '3',
    name: 'Bạc Xỉu',
    description: 'Cà phê nhẹ nhàng pha nhiều sữa, vị mềm mịn',
    price: 32000,
    category: 'coffee',
    image: '/images/bac-xiu.jpg',
    tags: ['Mềm'],
    recommended: true,
  },
  {
    id: '4',
    name: 'Trà Đào',
    description: 'Trà đào đá tươi, thơm mùi đào',
    price: 28000,
    category: 'tea',
    image: '/images/tra-dao.jpg',
    tags: ['Trái cây'],
  },
  {
    id: '5',
    name: 'Nước Cam',
    description: 'Nước cam vắt tươi, không đường',
    price: 35000,
    category: 'specialty',
    image: '/images/nuoc-cam.jpg',
    tags: ['Tươi'],
  },
  {
    id: '1',
    name: 'Cà Phê Đá',
    description: 'Cà phê pha phin, phục vụ kèm đá',
    price: 28000,
    category: 'coffee',
    image: '/images/ca-phe-da.jpg',
    tags: ['Tươi'],
    recommended: false,
  },
  {
    id: '2',
    name: 'Cà Phê Sữa',
    description: 'Cà phê pha với sữa đặc, thơm và ngọt dịu',
    price: 30000,
    category: 'coffee',
    image: '/images/ca-phe-sua.jpg',
    tags: ['Ngọt'],
    recommended: false,
  },
]