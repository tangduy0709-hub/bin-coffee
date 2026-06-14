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
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  currentOrder: null,
  tableNumber: '',

  addItem: (item, customizations) => {
    set((state) => {
      const customizationsStr = JSON.stringify(customizations || {})
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
          { ...item, cartItemId, quantity: 1, customizations },
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

  updateOrderStatus: (status) => {
    set((state) => ({
      currentOrder: state.currentOrder
        ? { ...state.currentOrder, status }
        : null,
    }))
  },
}))

export const menuItems: MenuItem[] = [
  {
    id: '1',
    name: 'Espresso Đặc Biệt',
    description: 'Espresso đôi đậm đà với hương vị socola đen',
    price: 25000,
    category: 'coffee',
    image: '/images/espresso.jpg',
    tags: ['Mạnh', 'Cổ điển'],
    recommended: true,
  },
  {
    id: '2',
    name: 'Latte Caramel',
    description: 'Latte kem mịn với caramel tự chế và vani',
    price: 32000,
    category: 'coffee',
    image: '/images/caramel-latte.jpg',
    tags: ['Ngọt', 'Phổ biến'],
    recommended: true,
  },
  {
    id: '3',
    name: 'Cappuccino Sữa Yến Mạch',
    description: 'Cappuccino mịn với bọt sữa yến mạch hữu cơ',
    price: 30000,
    category: 'coffee',
    image: '/images/cappuccino.jpg',
    tags: ['Thực vật', 'Kem mịn'],
  },
  {
    id: '4',
    name: 'Cà Phê Lạnh',
    description: 'Cà phê ngâm 24 giờ, mượt mà và tươi mát',
    price: 28000,
    category: 'coffee',
    image: '/images/cold-brew.jpg',
    tags: ['Tươi mát', 'Mượt mà'],
  },
  {
    id: '5',
    name: 'Latte Matcha',
    description: 'Matcha cấp độ lễ hội với sữa tùy chọn',
    price: 32000,
    category: 'tea',
    image: '/images/matcha.jpg',
    tags: ['Mộc mạc', 'Tỉnh táo'],
    recommended: true,
  },
  {
    id: '6',
    name: 'Latte Chai',
    description: 'Hỗn hợp chai gia vị với quế ấm áp và thảo quả',
    price: 30000,
    category: 'tea',
    image: '/images/chai.jpg',
    tags: ['Gia vị', 'Ấm áp'],
  },
  {
    id: '7',
    name: 'Croissant Hạnh Nhân',
    description: 'Croissant bơ lùn nhân kem hạnh nhân',
    price: 25000,
    category: 'pastry',
    image: '/images/croissant.jpg',
    tags: ['Tươi', 'Bán chạy'],
    recommended: true,
  },
  {
    id: '8',
    name: 'Bánh Cuộn Quế',
    description: 'Bánh cuộn quế ấm áp với kem phô mai',
    price: 26000,
    category: 'pastry',
    image: '/images/cinnamon-roll.jpg',
    tags: ['Ngọt', 'Thoải mái'],
  },
  {
    id: '9',
    name: 'Mocha Cacao',
    description: 'Espresso với cacao đậm và sữa hơi nóng',
    price: 32000,
    category: 'specialty',
    image: '/images/mocha.jpg',
    tags: ['Socola', 'Xa xỉ'],
  },
  {
    id: '10',
    name: 'Affogato',
    description: 'Espresso rót trên kem vani Ý',
    price: 35000,
    category: 'specialty',
    image: '/images/affogato.jpg',
    tags: ['Tráng miệng', 'Đặc biệt'],
  },
]
