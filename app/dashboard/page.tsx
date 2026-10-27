'use client'

import { useEffect, useMemo, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast';
import { io } from 'socket.io-client' 
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, History, LayoutGrid, X, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BACKEND_URL, updateOrderStatus, updatePaymentStatus } from '@/lib/backend'
import { formatVND } from '@/lib/utils'
import client from '@/lib/mqttClient'; 
import { useDashboardLanguageStore } from '@/lib/dashboardLanguageStore';

const translateOption = (opt?: string) => {
  if (opt === 'none') return 'None';
  if (opt === 'light') return 'Less';
  if (opt === 'normal') return 'Regular';
  if (opt === 'extra') return 'Extra';
  return opt;
};

const getSafeDateString = (dateVal: string | Date) => {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

interface KitchenOrderItem {
  id: number
  name: string
  quantity: number
  price: number
  customizations?: { ice?: string; sugar?: string } | string
}

interface KitchenOrder {
  id: number
  order_number: string
  table_number: string
  total: number
  status: string
  created_at: string
  items: KitchenOrderItem[]
  payment_status?: string
}

interface TableDetail {
  tableNum: string;
  isOccupied: boolean;
  hasUnpaid: boolean;
  totalUnpaid: number;
  activeOrders: KitchenOrder[];
}

export default function DashboardPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [mqttConnected, setMqttConnected] = useState(false)
  
  const [activeTab, setActiveTab] = useState<'orders' | 'statistics' | 'tables'>('orders');
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTableDetails, setSelectedTableDetails] = useState<TableDetail | null>(null);
  
  // Store ngôn ngữ riêng biệt cho Dashboard
  const { lang, setLang, t } = useDashboardLanguageStore();

  useEffect(() => {
    setIsMounted(true);
    setSelectedDate(getSafeDateString(new Date()));
  }, []);

  const handleGoiKhach = async (soBan: string) => {
    const FIREBASE_URL = "https://cafe-thong-bao-default-rtdb.firebaseio.com/thong_bao.json";
  
    try {
      const response = await fetch(FIREBASE_URL, {
        method: "PUT", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ban: soBan,
          trang_thai: "READY",
          thoi_gian: Date.now()
        }),
      });
  
      if (response.ok) toast.success(`📶 Buzzer signal sent to Firebase for Table ${soBan}!`);
      else {
        const errText = await response.text();
        toast.error(`❌ Firebase access blocked: Error ${response.status}\n${errText}`, { duration: 6000 });
      }
    } catch (error: any) {
      toast.error(`❌ Web network error: ${error.message}`);
    }
  };

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => Number(b.id) - Number(a.id)),
    [orders]
  )

  const activeKitchenOrders = useMemo(() => {
    const todayStr = getSafeDateString(new Date());
    return sortedOrders.filter(o => getSafeDateString(o.created_at) === todayStr);
  }, [sortedOrders])

  const stats = useMemo(() => {
    const todayStr = getSafeDateString(new Date());
    const ordersToday = orders.filter((order) => getSafeDateString(order.created_at) === todayStr);
    const totalOrdersToday = ordersToday.length;
    
    const revenueToday = ordersToday.reduce((sum, order) => {
      if (order.status === 'completed') return sum + (Number(order.total) || 0);
      return sum;
    }, 0);
    const pendingCount = orders.filter((order) => order.status === 'pending' || order.status === 'preparing').length;

    return { totalOrdersToday, revenueToday, pendingCount };
  }, [orders]);

  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const safeDateStr = getSafeDateString(date); 
      const displayDateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;

      const dailyTotal = orders
        .filter(order => getSafeDateString(order.created_at) === safeDateStr && order.status === 'completed')
        .reduce((sum, order) => sum + (Number(order.total) || 0), 0);

      data.push({ name: displayDateStr, total: dailyTotal });
    }
    return data;
  }, [orders]);

  const availableDates = useMemo(() => {
    const dates = orders.map(order => getSafeDateString(order.created_at));
    return Array.from(new Set(dates));
  }, [orders]);

  const historyOrders = useMemo(() => {
    return orders.filter(order => getSafeDateString(order.created_at) === selectedDate);
  }, [orders, selectedDate]);

  const TOTAL_TABLES = 3; 
  
  const tableStatus = useMemo(() => {
    const newTableStatus = Array.from({ length: TOTAL_TABLES }, (_, i) => {
      const tableNum = String(i + 1);
      
      const tableOrders = orders.filter((o) => {
        const rawTable = String(o.table_number || "").trim();
        const matches = rawTable.match(/\d+/);
        const dbTableNum = matches ? matches[0] : "1"; 
        return dbTableNum === tableNum && o.status !== 'completed';
      });

      const isOccupied = tableOrders.length > 0;
      const hasUnpaid = tableOrders.some(o => o.payment_status !== 'paid');
      const totalUnpaid = tableOrders
        .filter(o => o.payment_status !== 'paid')
        .reduce((sum, o) => sum + Number(o.total), 0);

      return { tableNum, isOccupied, hasUnpaid, totalUnpaid, activeOrders: tableOrders };
    });

    if (selectedTableDetails) {
      const updatedSelectedTable = newTableStatus.find(t => t.tableNum === selectedTableDetails.tableNum);
      if (updatedSelectedTable && JSON.stringify(updatedSelectedTable) !== JSON.stringify(selectedTableDetails)) {
         setTimeout(() => setSelectedTableDetails(updatedSelectedTable), 0);
      }
    }

    return newTableStatus;
  }, [orders, selectedTableDetails]);

  // ====================== LISTEN TO ESP32 (MQTT) ======================
  useEffect(() => {
    const handleMqttMessage = (topic: string, message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        if (topic === 'cafe/dashboard/status' && data.status === 'COMPLETED') {
          console.log('✅ ESP32 order completed:', data);
          toast.success(`Hardware completed order #${data.id}!`);
          setOrders((prev) =>
            prev.map((order) =>
              String(order.id) === String(data.id) || String(order.order_number) === String(data.id)
                ? { ...order, status: 'completed' }
                : order
            )
          );
        }
      } catch (error) { console.error('MQTT parse failed:', error); }
    };

    const handleConnect = () => setMqttConnected(true);
    const handleDisconnect = () => setMqttConnected(false);

    client.on('connect', handleConnect);
    client.on('reconnect', handleDisconnect);
    client.on('offline', handleDisconnect);
    if (client.connected) setMqttConnected(true);

    client.subscribe('cafe/dashboard/status');
    client.on('message', handleMqttMessage);

    return () => {
      client.removeListener('message', handleMqttMessage);
      client.removeListener('connect', handleConnect);
      client.removeListener('reconnect', handleDisconnect);
      client.removeListener('offline', handleDisconnect);
      client.unsubscribe('cafe/dashboard/status');
    };
  }, [])

  // ====================== LISTEN TO WEB BACKEND (SOCKET.IO) ======================
  useEffect(() => {
    setIsLoading(true)
    fetch(`${BACKEND_URL}/api/orders`)
      .then((res) => res.json())
      .then((data) => setOrders(data || []))
      .catch(console.error)
      .finally(() => setIsLoading(false))

    const socket = io(BACKEND_URL);

    socket.on('order:new', (newOrder) => {
      setOrders((prev) => {
        if (prev.some((o) => String(o.id) === String(newOrder.id))) return prev;
        return [newOrder, ...prev];
      });
      toast.success(`📥 New order received from Table ${newOrder.table_number}!`);
    });

    socket.on('order:updated', (updatedOrder) => {
      setOrders((prev) => 
        prev.map((o) => (String(o.id) === String(updatedOrder.id) ? updatedOrder : o))
      );
    });

    return () => {
      socket.disconnect();
    }
  }, [])

  if (!isMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Initializing interface...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 relative">
      <Toaster />
      <div className="mx-auto max-w-5xl space-y-6">
        
        <div className="rounded-3xl bg-card p-6 shadow-lg border border-border">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
                {t('Trạm Barista', 'Barista Station')}
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">
                {t('Hệ thống Quản lý Quán Cà Phê', 'Coffee Management System')}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <div className={`flex items-center gap-2 rounded-full px-3 py-1 ${mqttConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${mqttConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                  {mqttConnected ? t('Đã kết nối MQTT (Phần cứng)', 'MQTT Connected (Hardware)') : t('Mất kết nối MQTT...', 'MQTT Disconnected...')}
                </div>
                <div className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                  ⏳ {stats.pendingCount} {t('đơn chờ xử lý', 'pending orders')}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Nút chuyển ngôn ngữ riêng biệt cho Dashboard */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
                className="rounded-full gap-1.5 text-xs font-semibold px-3 h-10"
              >
                <Globe className="h-4 w-4" />
                {lang === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}
              </Button>

              <div className="flex bg-muted/50 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                    activeTab === 'orders' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LayoutDashboard size={18} /> {t('Đơn hàng', 'Orders')}
                </button>
                
                <button
                  onClick={() => setActiveTab('tables')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                    activeTab === 'tables' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LayoutGrid size={18} /> {t('Sơ đồ bàn', 'Tables')}
                </button>

                <button
                  onClick={() => setActiveTab('statistics')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                    activeTab === 'statistics' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <History size={18} /> {t('Thống kê', 'Analytics')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ======================= TAB 1: ORDERS ======================= */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground font-medium">{t('QUÁ TRÌNH PHA CHẾ', 'KITCHEN PROGRESS')}</p>
                <h2 className="text-xl font-bold text-foreground mt-1">{t('Đơn hàng hôm nay', "Today's Orders")}</h2>
              </div>
              <div className="flex items-center gap-3 bg-blue-500/10 text-blue-600 px-5 py-3 rounded-2xl">
                <span className="text-2xl">⏳</span>
                <span className="text-3xl font-bold">{stats.pendingCount}</span>
                <span className="font-medium text-sm ml-1">{t('chờ xử lý', 'pending')}</span>
              </div>
            </div>

            <section className="grid gap-4">
              {isLoading && <div className="rounded-3xl bg-muted/50 p-6 text-center text-muted-foreground">{t('Đang tải đơn hàng...', 'Loading orders...')}</div>}
              {!isLoading && activeKitchenOrders.length === 0 && <div className="rounded-3xl bg-muted/50 p-6 text-center text-muted-foreground">{t('Không có đơn hàng nào trong ngày hôm nay.', 'No orders received today.')}</div>}
              
              {activeKitchenOrders.map((order) => (
                <div key={order.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm hover:border-primary/20 transition-colors">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t(`Đơn #${order.order_number} - Bàn ${order.table_number}`, `Order #${order.order_number} - Table ${order.table_number}`)}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-foreground">
                        {order.items.length} {t('món', 'items')}
                      </h2>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`rounded-full px-3 py-1 font-medium ${
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                        order.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {order.status === 'pending' ? t('Chờ xử lý', 'Pending') : order.status === 'preparing' ? t('Đang pha chế', 'Preparing') : order.status === 'ready' ? t('Sẵn sàng', 'Ready') : t('Hoàn thành', 'Completed')}
                      </span>
                      
                      {order.payment_status === 'paid' ? (
                        <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 font-medium flex items-center gap-1">
                          🟢 {t('Đã thanh toán', 'Paid')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 text-red-700 px-3 py-1 font-medium flex items-center gap-1">
                          🔴 {t('Chưa thanh toán', 'Unpaid')}
                        </span>
                      )}

                      <span className="rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground">{formatVND(order.total)}</span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex flex-col rounded-2xl bg-muted/50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">{item.quantity} x {item.name}</span>
                            <span>{formatVND(item.quantity * item.price)}</span>
                          </div>
                          
                          {item.customizations && (
                            <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                              {typeof item.customizations === 'string' ? (
                                <span>{item.customizations}</span>
                              ) : (
                                <>
                                  {item.customizations.ice && (
                                    <span>❄️ {t('Đá', 'Ice')}: {translateOption(item.customizations.ice)}</span>
                                  )}
                                  {item.customizations.sugar && (
                                    <span>
                                      🍯 {['Cà Phê Sữa', 'Bạc Xỉu'].includes(item.name) ? t('Sữa', 'Milk') : t('Đường', 'Sugar')}: {translateOption(item.customizations.sugar)}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="rounded-3xl border border-border bg-background/80 p-4 flex flex-col justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{t('Thời gian tạo', 'Created at')}</p>
                        <p className="mt-1 text-sm text-foreground">{new Date(order.created_at).toLocaleString('en-US')}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {order.status === 'pending' && (
                          <Button size="sm" onClick={() => updateOrderStatus(order.id, 'preparing').then(() => {
                            setOrders((prev) => prev.map((item) => String(item.id) === String(order.id) ? { ...item, status: 'preparing' } : item));
                          })}>
                            {t('Nhận đơn (Bắt đầu pha chế)', 'Accept (Start Preparing)')}
                          </Button>
                        )}
                        
                        {order.status === 'preparing' && (
                          <Button size="sm" onClick={async () => {
                            await updateOrderStatus(order.id, 'ready');
                            setOrders((prev) => prev.map((item) => String(item.id) === String(order.id) ? { ...item, status: 'ready' } : item));
                            
                            const matchSoBan = String(order.table_number).match(/\d+/);
                            const soBanNum = matchSoBan ? matchSoBan[0] : "1";

                            const payloadMQTT = JSON.stringify({
                              order_number: order.order_number,
                              table: `Table ${soBanNum}`,
                              message: `Order ready for Table ${soBanNum}`
                            });

                            client.publish('coffee/ready_announcement', payloadMQTT, { qos: 0 }, (err) => {
                              if (!err) {
                                toast.success(`📢 Announcement sent to AI Speaker for Table ${soBanNum}!`);
                              } else {
                                toast.error("❌ MQTT publish failed!");
                              }
                            });

                            try {
                              await fetch('https://cafe-thong-bao-default-rtdb.firebaseio.com/thong_bao.json', {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  ban: soBanNum,
                                  trang_thai: "READY",
                                  thoi_gian: Date.now()
                                }),
                              });
                            } catch (error) {
                              console.error("❌ Firebase trigger error:", error);
                            }
                          }}>
                            {t('Đánh dấu Sẵn sàng (Phục vụ)', 'Mark as Ready (Serve)')}
                          </Button>
                        )}
                        
                        {order.payment_status !== 'paid' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500 text-red-600 hover:bg-red-50"
                            onClick={async () => {
                              try {
                                const res = await updatePaymentStatus(order.id, 'paid');
                                if (res.ok) {
                                  setOrders((prev) =>
                                    prev.map((item) => String(item.id) === String(order.id) ? { ...item, payment_status: 'paid' } : item)
                                  );
                                  toast.success(`Payment confirmed for Order #${order.order_number}`);
                                } else {
                                  toast.error("⚠️ Error: Server declined request!");
                                }
                              } catch (error) {
                                toast.error("⚠️ Connection error!");
                              }
                            }}
                          >
                            💰 {t('Thu tiền', 'Collect Payment')}
                          </Button>
                        )}

                        {order.status === 'ready' && (
                          <Button size="sm" variant="secondary" onClick={() => {
                            if (order.payment_status !== 'paid') {
                               if(!window.confirm(t("⚠️ Bàn này chưa thanh toán. Vẫn đóng đơn?", "⚠️ This table is unpaid. Close order anyway?"))) return;
                            }
                            
                            updateOrderStatus(order.id, 'completed').then(() => {
                              setOrders((prev) => prev.map((item) => String(item.id) === String(order.id) ? { ...item, status: 'completed' } : item));
                              toast.success(`Order #${order.order_number} closed!`);
                            });
                          }}>
                            🧹 {t('Dọn bàn (Hoàn thành)', 'Clear Table (Complete)')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {/* ======================= TAB 2: TABLES ======================= */}
        {activeTab === 'tables' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">{t('Sơ đồ bàn quán', 'Table Floor Plan')}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t('Bấm vào một bàn để xem chi tiết đơn hàng hoạt động', 'Click on a table to view active order details')}</p>
              </div>
              
              <div className="hidden sm:flex gap-4 text-xs font-medium bg-card p-3 rounded-2xl border border-border">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-muted-foreground/30"></span> {t('Trống', 'Available')}</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-400"></span> {t('Có khách (Đã trả tiền)', 'Occupied (Paid)')}</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-400"></span> {t('Có khách (Chưa trả tiền)', 'Occupied (Unpaid)')}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {tableStatus.map((table) => (
                <div 
                  key={table.tableNum}
                  onClick={() => setSelectedTableDetails(table)}
                  className={`cursor-pointer hover:scale-[1.02] relative overflow-hidden rounded-3xl border p-5 shadow-sm flex flex-col items-center justify-center text-center transition-all min-h-[140px]
                    ${!table.isOccupied ? 'bg-card border-border hover:bg-muted/50' : 
                      table.hasUnpaid ? 'bg-red-50 border-red-200 dark:bg-red-950/20' : 'bg-green-50 border-green-200 dark:bg-green-950/20'
                    }`}
                >
                  <h3 className={`text-2xl font-bold ${table.isOccupied ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {t(`Bàn ${table.tableNum}`, `Table ${table.tableNum}`)}
                  </h3>
                  
                  {table.isOccupied ? (
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                        table.hasUnpaid ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'
                      }`}>
                        {table.hasUnpaid ? t('Chưa trả', 'Unpaid') : t('Đã trả', 'Paid')}
                      </span>
                      
                      {table.hasUnpaid && (
                        <p className="font-bold text-red-600 text-lg">
                          {formatVND(table.totalUnpaid)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="mt-3 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      {t('Trống', 'Available')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================= TAB 3: ANALYTICS & HISTORY ======================= */}
        {activeTab === 'statistics' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-center items-center">
                <p className="text-sm text-muted-foreground font-medium mb-2">{t("ĐƠN HÀNG HÔM NAY", "TODAY'S ORDERS")}</p>
                <div className="flex items-center gap-2">
                  <span className="text-red-500 text-2xl">🔥</span>
                  <h2 className="text-4xl font-bold text-foreground">{stats.totalOrdersToday}</h2>
                </div>
              </div>
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-center items-center">
                <p className="text-sm text-muted-foreground font-medium mb-2">{t("DOANH THU HÔM NAY", "TODAY'S REVENUE")}</p>
                <h2 className="text-4xl font-bold text-foreground text-green-600">{formatVND(stats.revenueToday)}</h2>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-foreground mb-6">{t('Doanh thu (7 ngày gần nhất)', 'Revenue (Last 7 Days)')}</h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(value) => value === 0 ? '0' : `${value / 1000}k`} />
                    <Tooltip formatter={(value: number) => [formatVND(value), t('Doanh thu', 'Revenue')]} labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '4px' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                    <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{t('Lịch sử đơn hàng', 'Order History')}</h2>
                  <p className="text-sm text-muted-foreground">{t('Lọc lịch sử đơn hàng theo ngày', 'Filter historical orders by date')}</p>
                </div>
                <select 
                  className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                >
                  {selectedDate && <option value={selectedDate}>{t('Đang xem', 'Viewing')}: {selectedDate}</option>}
                  {availableDates.filter(date => date !== selectedDate).map(date => (
                    <option key={date} value={date}>{date}</option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">{t('Mã đơn', 'Order ID')}</th>
                      <th className="pb-3 pr-4 font-medium">{t('Thời gian', 'Time')}</th>
                      <th className="pb-3 pr-4 font-medium">{t('Bàn', 'Table')}</th>
                      <th className="pb-3 pr-4 font-medium">{t('Món', 'Items')}</th>
                      <th className="pb-3 pr-4 font-medium">{t('Tổng tiền', 'Total')}</th>
                      <th className="pb-3 pr-4 font-medium">{t('Thanh toán', 'Payment')}</th>
                      <th className="pb-3 font-medium">{t('Trạng thái', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {historyOrders.length === 0 ? (
                      <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">{t('Không có đơn hàng nào trong ngày này.', 'No orders recorded for this date.')}</td></tr>
                    ) : (
                      historyOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 pr-4 font-semibold">#{order.order_number}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{new Date(order.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-3 pr-4 font-medium">{t(`Bàn ${order.table_number}`, `Table ${order.table_number}`)}</td>
                          <td className="py-3 pr-4 text-muted-foreground max-w-[200px] truncate">{order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}</td>
                          <td className="py-3 pr-4 font-semibold">{formatVND(order.total)}</td>
                          <td className="py-3 pr-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {order.payment_status === 'paid' ? t('Đã trả', 'Paid') : t('Chưa trả', 'Unpaid')}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${order.status === 'completed' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                              {order.status === 'completed' ? t('Hoàn thành', 'Completed') : order.status === 'ready' ? t('Sẵn sàng', 'Ready') : t('Đang pha chế', 'Preparing')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Table details modal */}
      {selectedTableDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-lg rounded-3xl border border-border p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-xl font-bold">
                  {t(`Chi tiết Bàn ${selectedTableDetails.tableNum}`, `Table ${selectedTableDetails.tableNum} Details`)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedTableDetails.isOccupied 
                    ? t('Bàn đang có đơn hàng hoạt động', 'Active orders in progress')
                    : t('Bàn hiện đang trống', 'Table is currently available')}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedTableDetails(null)} className="rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4">
              {selectedTableDetails.activeOrders.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {t('Không có đơn hàng nào tại bàn này.', 'No active orders for this table.')}
                </div>
              ) : (
                selectedTableDetails.activeOrders.map((order) => (
                  <div key={order.id} className="rounded-2xl border border-border bg-muted/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">#{order.order_number}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        order.status === 'completed' ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{item.quantity}x {item.name}</span>
                          <span>{formatVND(item.quantity * item.price)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border font-bold">
                      <span>{t('Tổng cộng', 'Total')}:</span>
                      <span className="text-primary">{formatVND(order.total)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button onClick={() => setSelectedTableDetails(null)} className="rounded-xl">
                {t('Đóng', 'Close')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}