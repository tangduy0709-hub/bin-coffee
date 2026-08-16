'use client'

import { useEffect, useMemo, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast';
import { io } from 'socket.io-client' // 🚀 THÊM SOCKET.IO ĐỂ ĐỒNG BỘ REALTIME
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, History, LayoutGrid, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BACKEND_URL, updateOrderStatus, updatePaymentStatus } from '@/lib/backend'
import { formatVND } from '@/lib/utils'
import client from '@/lib/mqttClient'; 

const boDauTiengViet = (str: string) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
};

const translateOption = (opt?: string) => {
  if (opt === 'none') return 'Không';
  if (opt === 'light') return 'Ít';
  if (opt === 'normal') return 'Vừa';
  if (opt === 'extra') return 'Nhiều';
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
  
      if (response.ok) toast.success(`📶 Đã bắn tín hiệu gọi còi Bàn ${soBan} lên Firebase!`);
      else {
        const errText = await response.text();
        toast.error(`❌ Firebase chặn kết nối: Lỗi ${response.status} - ${errText}`, { duration: 6000 });
      }
    } catch (error: any) {
      toast.error(`❌ Lỗi mạng Web: ${error.message}`);
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

  // ====================== EFFECT LẮNG NGHE ESP32 (MQTT) ======================
  useEffect(() => {
    const handleMqttMessage = (topic: string, message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        // Chỉ dùng MQTT để nhận trạng thái khi nút trên mạch cứng ESP32 được bấm
        if (topic === 'cafe/dashboard/status' && data.status === 'COMPLETED') {
          console.log('✅ ESP32 báo hoàn thành đơn:', data);
          toast.success(`Mạch đã làm xong đơn ${data.id}!`);
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

  // ====================== EFFECT LẮNG NGHE WEB BACKEND (SOCKET.IO) ======================
  useEffect(() => {
    setIsLoading(true)
    // Tải danh sách đơn hàng ban đầu
    fetch(`${BACKEND_URL}/api/orders`)
      .then((res) => res.json())
      .then((data) => setOrders(data || []))
      .catch(console.error)
      .finally(() => setIsLoading(false))

    // 🚀 Lắng nghe Socket.io để realtime MƯỢT MÀ với dữ liệu JSON chuẩn
    const socket = io(BACKEND_URL);

    // KHI CÓ ĐƠN MỚI
    socket.on('order:new', (newOrder) => {
      setOrders((prev) => {
        // Tránh trùng lặp
        if (prev.some((o) => String(o.id) === String(newOrder.id))) return prev;
        
        // 🚀 Bỏ toast ra khỏi đây để tránh lỗi render
        return [newOrder, ...prev];
      });

      // Đưa toast ra ngoài setState
      toast.success(`📥 Có đơn mới từ Bàn ${newOrder.table_number}!`);
    });

    // KHI ĐƠN BỊ THAY ĐỔI (Thanh toán, Trạng thái...)
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
        Đang khởi tạo giao diện...
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
              <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Quầy pha chế</p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">Hệ thống quản lý Cafe</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <div className={`flex items-center gap-2 rounded-full px-3 py-1 ${mqttConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${mqttConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                  {mqttConnected ? 'Đã kết nối MQTT (Phần cứng)' : 'Mất kết nối MQTT...'}
                </div>
                <div className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                  ⏳ {stats.pendingCount} đơn chờ làm
                </div>
              </div>
            </div>
            
            <div className="flex bg-muted/50 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'orders' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutDashboard size={18} /> Nhận Order
              </button>
              
              <button
                onClick={() => setActiveTab('tables')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'tables' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid size={18} /> Quản lý bàn
              </button>

              <button
                onClick={() => setActiveTab('statistics')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'statistics' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <History size={18} /> Thống kê
              </button>
            </div>
          </div>
        </div>

        {/* ======================= TAB 1: NHẬN ORDER ======================= */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground font-medium">TIẾN ĐỘ QUẦY BẾP</p>
                <h2 className="text-xl font-bold text-foreground mt-1">Đơn hàng trong ngày</h2>
              </div>
              <div className="flex items-center gap-3 bg-blue-500/10 text-blue-600 px-5 py-3 rounded-2xl">
                <span className="text-2xl">⏳</span>
                <span className="text-3xl font-bold">{stats.pendingCount}</span>
                <span className="font-medium text-sm ml-1">chờ làm</span>
              </div>
            </div>

            <section className="grid gap-4">
              {isLoading && <div className="rounded-3xl bg-muted/50 p-6 text-center text-muted-foreground">Đang tải đơn hàng...</div>}
              {!isLoading && activeKitchenOrders.length === 0 && <div className="rounded-3xl bg-muted/50 p-6 text-center text-muted-foreground">Chưa có đơn hàng nào trong hôm nay.</div>}
              
              {activeKitchenOrders.map((order) => (
                <div key={order.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm hover:border-primary/20 transition-colors">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Đơn {order.order_number} - Bàn {order.table_number}</p>
                      <h2 className="mt-1 text-xl font-semibold text-foreground">{order.items.length} món</h2>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`rounded-full px-3 py-1 font-medium ${
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                        order.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {order.status === 'pending' ? 'Chờ pha chế' : order.status === 'preparing' ? 'Đang làm' : order.status === 'ready' ? 'Khách đang uống (Ready)' : 'Khách đã về (Đã đóng)'}
                      </span>
                      
                      {order.payment_status === 'paid' ? (
                        <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 font-medium flex items-center gap-1">
                          🟢 Đã thanh toán
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 text-red-700 px-3 py-1 font-medium flex items-center gap-1">
                          🔴 Chưa thanh toán
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
                                    <span>❄️ Đá: {translateOption(item.customizations.ice)}</span>
                                  )}
                                  {item.customizations.sugar && (
                                    <span>
                                      🍯 {['Cà Phê Sữa', 'Bạc Xỉu'].includes(item.name) ? 'Sữa' : 'Đường'}: {translateOption(item.customizations.sugar)}
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
                        <p className="text-sm text-muted-foreground">Tạo lúc</p>
                        <p className="mt-1 text-sm text-foreground">{new Date(order.created_at).toLocaleString('vi-VN')}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {order.status === 'pending' && (
                          <Button size="sm" onClick={() => updateOrderStatus(order.id, 'preparing').then(() => {
                              setOrders((prev) => prev.map((item) => String(item.id) === String(order.id) ? { ...item, status: 'preparing' } : item));
                            })}>
                            Đã nhận (Bếp đang làm)
                          </Button>
                        )}
                        
                        {order.status === 'preparing' && (
                          <Button size="sm" onClick={async () => {
                            // 1. Cập nhật trạng thái đơn hàng trên Backend thành "ready"
                            await updateOrderStatus(order.id, 'ready');
                            setOrders((prev) => prev.map((item) => String(item.id) === String(order.id) ? { ...item, status: 'ready' } : item));
                            
                            // Lấy số bàn
                            const matchSoBan = String(order.table_number).match(/\d+/);
                            const soBanNum = matchSoBan ? matchSoBan[0] : "1";

                            // =========================================================
                            // 2. GỬI TÍN HIỆU MQTT CHO AI XIAOZHI (ESP32-S3) ĐỌC LOA
                            // =========================================================
                            const payloadMQTT = JSON.stringify({
                              order_number: order.order_number,
                              table: `Ban ${soBanNum}`,
                              message: `Mời khách hàng tại bàn ${soBanNum} ra quầy nhận món`
                            });

                            client.publish('coffee/ready_announcement', payloadMQTT, { qos: 0 }, (err) => {
                              if (!err) {
                                toast.success(`📢 Đã gửi thông báo cho AI tại Bàn ${soBanNum}!`);
                              } else {
                                toast.error("❌ Gửi tín hiệu MQTT thất bại!");
                              }
                            });

                            // =========================================================
                            // 3. GỬI TÍN HIỆU FIREBASE ĐỂ MẠCH KÝ SINH (ESP32-C3) HÚ CÒI
                            // =========================================================
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
                              // Không cần hiện thêm toast nữa vì MQTT ở trên đã hiện rồi để tránh rác màn hình
                            } catch (error) {
                              console.error("❌ Lỗi kích hoạt còi Firebase:", error);
                            }
                          }}>
                            Pha xong (Bưng ra bàn)
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
                                  toast.success(`Đã xác nhận thanh toán đơn #${order.order_number}`);
                                } else {
                                  toast.error("⚠️ Lỗi: Server từ chối lưu dữ liệu!");
                                }
                              } catch (error) {
                                toast.error("⚠️ Lỗi mất kết nối!");
                              }
                            }}
                          >
                            💰 Thu tiền
                          </Button>
                        )}

                        {order.status === 'ready' && (
                          <Button size="sm" variant="secondary" onClick={() => {
                            if (order.payment_status !== 'paid') {
                               if(!window.confirm("⚠️ Bàn này chưa thanh toán, bạn có chắc khách đã về và muốn đóng đơn?")) return;
                            }
                            
                            updateOrderStatus(order.id, 'completed').then(() => {
                              setOrders((prev) => prev.map((item) => String(item.id) === String(order.id) ? { ...item, status: 'completed' } : item));
                              toast.success(`Đã đóng đơn #${order.order_number} và dọn bàn thành công!`);
                            });
                          }}>
                            🧹 Khách về (Đóng đơn)
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

        {/* ======================= TAB 2: QUẢN LÝ BÀN ======================= */}
        {activeTab === 'tables' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Sơ đồ Bàn</h2>
                <p className="text-sm text-muted-foreground mt-1">Nhấn vào bàn để xem chi tiết món khách gọi</p>
              </div>
              
              <div className="hidden sm:flex gap-4 text-xs font-medium bg-card p-3 rounded-2xl border border-border">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-muted-foreground/30"></span> Bàn trống</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-400"></span> Đang ngồi (Đã trả)</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-400"></span> Đang ngồi (Chưa trả)</div>
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
                    Bàn {table.tableNum}
                  </h3>
                  
                  {table.isOccupied ? (
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                        table.hasUnpaid ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'
                      }`}>
                        {table.hasUnpaid ? 'Chưa thanh toán' : 'Đã thanh toán'}
                      </span>
                      
                      {table.hasUnpaid && (
                        <p className="font-bold text-red-600 text-lg">
                          {formatVND(table.totalUnpaid)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="mt-3 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      Trống
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================= TAB 3: THỐNG KÊ & LỊCH SỬ ======================= */}
        {activeTab === 'statistics' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-center items-center">
                <p className="text-sm text-muted-foreground font-medium mb-2">ĐƠN HÀNG HÔM NAY</p>
                <div className="flex items-center gap-2">
                  <span className="text-red-500 text-2xl">🔥</span>
                  <h2 className="text-4xl font-bold text-foreground">{stats.totalOrdersToday}</h2>
                </div>
              </div>
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col justify-center items-center">
                <p className="text-sm text-muted-foreground font-medium mb-2">DOANH THU HÔM NAY</p>
                <h2 className="text-4xl font-bold text-foreground text-green-600">{formatVND(stats.revenueToday)}</h2>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-foreground mb-6">Doanh thu 7 ngày gần nhất</h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(value) => value === 0 ? '0' : `${value / 1000}k`} />
                    <Tooltip formatter={(value: number) => [formatVND(value), 'Doanh thu']} labelStyle={{ color: '#374151', fontWeight: 'bold', marginBottom: '4px' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                    <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Lịch sử đơn hàng</h2>
                  <p className="text-sm text-muted-foreground">Tra cứu lại tất cả các đơn theo từng ngày</p>
                </div>
                <select 
                  className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                >
                  {selectedDate && <option value={selectedDate}>Đang xem: {selectedDate}</option>}
                  {availableDates.filter(date => date !== selectedDate).map(date => (
                    <option key={date} value={date}>{date}</option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">Mã đơn</th>
                      <th className="pb-3 pr-4 font-medium">Giờ tạo</th>
                      <th className="pb-3 pr-4 font-medium">Bàn</th>
                      <th className="pb-3 pr-4 font-medium">Món ăn/Uống</th>
                      <th className="pb-3 pr-4 font-medium">Tổng tiền</th>
                      <th className="pb-3 pr-4 font-medium">Thanh toán</th>
                      <th className="pb-3 font-medium">Trạng thái (Bếp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {historyOrders.length === 0 ? (
                      <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Không có đơn hàng nào trong ngày này.</td></tr>
                    ) : (
                      historyOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 pr-4 font-semibold">#{order.order_number}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{new Date(order.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-3 pr-4 font-medium">{order.table_number}</td>
                          <td className="py-3 pr-4 text-muted-foreground max-w-[200px] truncate">{order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}</td>
                          <td className="py-3 pr-4 font-semibold">{formatVND(order.total)}</td>
                          
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {order.payment_status === 'paid' ? 'Đã TT' : 'Chưa TT'}
                            </span>
                          </td>

                          <td className="py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              order.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              order.status === 'preparing' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {order.status === 'pending' ? 'Chờ' : order.status === 'preparing' ? 'Đang làm' : order.status === 'ready' ? 'Sẵn sàng' : 'Khách đã về'}
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

      {/* ======================= POPUP CHI TIẾT BÀN ======================= */}
      {selectedTableDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-foreground">Bàn {selectedTableDetails.tableNum}</h3>
                <p className="text-sm text-muted-foreground mt-1">Chi tiết các đơn hàng đang phục vụ</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedTableDetails(null)} 
                className="h-10 w-10 rounded-full bg-muted hover:bg-muted-foreground/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {selectedTableDetails.activeOrders.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-4xl mb-3">🍽️</div>
                <p className="text-lg font-medium text-foreground">Bàn đang trống</p>
                <p className="text-sm text-muted-foreground mt-1">Chưa có khách ngồi tại bàn này.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedTableDetails.activeOrders.map(order => (
                  <div key={order.id} className="rounded-2xl border border-border bg-muted/30 p-4">
                    
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-border/50">
                      <span className="font-bold text-foreground">Đơn #{order.order_number}</span>
                      <span className="text-sm font-medium text-muted-foreground">
                        {new Date(order.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      {order.items.map(item => (
                        <div key={item.id} className="flex justify-between items-start text-sm">
                          <div>
                            <p className="font-semibold text-foreground">{item.quantity} x {item.name}</p>
                            {item.customizations && (
                              <p className="text-muted-foreground text-xs mt-1 space-x-2">
                                {typeof item.customizations === 'string' ? (
                                  <span>{item.customizations}</span>
                                ) : (
                                  <>
                                    {item.customizations.ice && <span>❄️ Đá: {translateOption(item.customizations.ice)}</span>}
                                    {item.customizations.sugar && 
                                      <span>🍯 {['Cà Phê Sữa', 'Bạc Xỉu'].includes(item.name) ? 'Sữa' : 'Đường'}: {translateOption(item.customizations.sugar)}</span>
                                    }
                                  </>
                                )}
                              </p>
                            )}
                          </div>
                          <span className="font-medium text-foreground">{formatVND(item.quantity * item.price)}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap justify-between items-center gap-2">
                      <div className="flex gap-2">
                          <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {order.status === 'pending' ? 'Chờ bếp' : 'Đang làm'}
                          </span>
                          <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
                            order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {order.payment_status === 'paid' ? 'Đã TT' : 'Chưa TT'}
                          </span>
                      </div>
                      <span className="font-bold text-primary text-base">{formatVND(order.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {selectedTableDetails.hasUnpaid && (
              <div className="mt-6 rounded-2xl bg-red-50 dark:bg-red-950/20 p-4 border border-red-100 dark:border-red-900 flex justify-between items-center">
                <span className="font-semibold text-red-700 dark:text-red-400">Tổng tiền cần thu:</span>
                <span className="text-xl font-bold text-red-700 dark:text-red-400">
                  {formatVND(selectedTableDetails.totalUnpaid)}
                </span>
              </div>
            )}

          </div>
        </div>
      )}
      
    </main>
  )
}