'use client';

import { useState, useEffect } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Eye,
  RefreshCw,
} from 'lucide-react';
import type {  Bot, Order, TradingBot, TradingPosition } from '@/lib/api/types';
import { getToken } from '@/lib/auth';
import { buildGatewayUrl } from '@/lib/config/gateway';

interface TradeOrderData {
  id: number;
  botId: number;
  symbol: string;
  type: string;
  side: string;
  price: number;
  amount: number;
  status: string;
  createdAt: string;
}

const generateMockId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `order-${Math.random().toString(36).slice(2)}`;

const createMockOrder = (overrides: Partial<Order>): Order => ({
  orderId: overrides.orderId ?? Math.floor(Math.random() * 100000),
  orderUuid: overrides.orderUuid ?? generateMockId(),
  userId: overrides.userId ?? 0,
  accountId: overrides.accountId ?? 0,
  symbol: overrides.symbol ?? '',
  side: overrides.side ?? 'BUY',
  orderType: overrides.orderType ?? 'LIMIT',
  quantity: overrides.quantity ?? '0',
  price: overrides.price ?? '0',
  stopPrice: overrides.stopPrice ?? null,
  timeInForce: overrides.timeInForce ?? 'GTC',
  status: overrides.status ?? 'PENDING',
  filledQuantity: overrides.filledQuantity ?? '0',
  averagePrice: overrides.averagePrice ?? null,
  fee: overrides.fee ?? '0',
  exchange: overrides.exchange ?? 'MockExchange',
  clientOrderId: overrides.clientOrderId ?? null,
  exchangeOrderId: overrides.exchangeOrderId ?? null,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  expiresAt: overrides.expiresAt ?? null,
});

const ROW_HEIGHT = 40;
const VISIBLE_ROWS = 4;
const MAX_HEIGHT = 240; // 40px * 4 rows

interface MainPanelProps {
  onBotStatusChange?: (hasRunningBot: boolean) => void;
  onRefresh?: () => void;
}

export default function MainPanel({ onBotStatusChange, onRefresh }: MainPanelProps) {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeOrderData[]>([]);
  const [tradingBots, setTradingBots] = useState<TradingBot[]>([]);
  const [tradingPositions, setTradingPositions] = useState<TradingPosition[]>([]);
  const [botLogs, setBotLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [selectedBotLogs, setSelectedBotLogs] = useState<any[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null);

  const fetchBotLogs = async () => {
    try {
      const response = await fetch(buildGatewayUrl('/trading/logs'), {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const logs = await response.json();
        setBotLogs(logs);
        return logs; // Return logs for immediate use
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch bot logs:', error);
      return [];
    }
  };

  const openLogsModal = async (botId: number) => {
    setSelectedBotId(botId);
    setLogsModalOpen(true);
    // Fetch latest logs and filter immediately
    const logs = await fetchBotLogs();
    const botSpecificLogs = logs.filter((log: any) => log.bot_execution_id === botId);
    setSelectedBotLogs(botSpecificLogs);
  };

  // Auto-refresh logs every 2 minutes when modal is open
  useEffect(() => {
    if (!logsModalOpen || !selectedBotId) {
      return;
    }

    const refreshLogs = async () => {
      const logs = await fetchBotLogs();
      const botSpecificLogs = logs.filter((log: any) => log.bot_execution_id === selectedBotId);
      setSelectedBotLogs(botSpecificLogs);
    };
    
    // Set up interval for auto-refresh every 2 minutes (120000 ms)
    const interval = setInterval(refreshLogs, 120000);
    
    // Cleanup interval when modal closes or component unmounts
    return () => {
      clearInterval(interval);
    };
  }, [logsModalOpen, selectedBotId]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch pending orders, open positions, and trade history from new trading endpoints
      const [ordersResponse, positionsResponse, tradesResponse, botResponse] = await Promise.all([
        fetch(buildGatewayUrl('/trading/orders/pending'), {
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          }
        }).then(res => res.json()).catch(err => {
          console.error('[Trading UI] Failed to fetch pending orders:', err);
          return { status: 'error', data: [] };
        }),
        fetch(buildGatewayUrl('/trading/positions/open'), {
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          }
        }).then(res => res.json()).catch(err => {
          console.error('[Trading UI] Failed to fetch open positions:', err);
          return { status: 'error', data: [] };
        }),
        fetch(buildGatewayUrl('/trading/trades/history?limit=50'), {
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          }
        }).then(res => res.json()).catch(err => {
          console.error('[Trading UI] Failed to fetch trade history:', err);
          return { status: 'error', data: [] };
        }),
        fetch(buildGatewayUrl('/trading/bot'), {
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          }
        }).then(res => res.json()).catch(err => {
          console.error('[Trading UI] Failed to fetch bot:', err);
          return { status: 'error', data: null };
        }),
      ]);
      
      // Parse pending orders (convert to Order format)
      const orders = (ordersResponse.status === 'success' && ordersResponse.data) 
        ? ordersResponse.data.map((order: any) => createMockOrder({
            orderId: order.id,
            symbol: order.symbol,
            side: order.side,
            orderType: order.order_type,
            price: order.price?.toString() || '0',
            quantity: order.quantity?.toString() || '0',
            status: order.status,
            createdAt: order.created_at
          }))
        : [];

      // Parse positions
      const positions = (positionsResponse.status === 'success' && positionsResponse.data)
        ? positionsResponse.data.map((pos: any) => ({
            id: pos.id,
            userId: pos.user_id,
            botId: pos.bot_execution_id,
            asset: pos.symbol,
            symbol: pos.symbol,
            entryPrice: pos.entry_price,
            quantity: pos.quantity,
            current_price: pos.current_price,
            unrealized_pnl: pos.unrealized_pnl,
            stop_loss: pos.stop_loss,
            take_profit: pos.take_profit,
            openedAt: pos.opened_at,
            closedAt: null,
            status: 'OPEN'
          }))
        : [];

      // Parse trade history
      const trades = (tradesResponse.status === 'success' && tradesResponse.data)
        ? tradesResponse.data.map((trade: any) => ({
            id: trade.id,
            botId: trade.bot_execution_id,
            exchangeOrderId: `TRADE-${trade.id}`,
            symbol: trade.symbol,
            type: 'MARKET',
            side: trade.result === 'PROFIT' ? 'SELL' : 'BUY',
            price: trade.sell_price,
            buyPrice: trade.buy_price,
            amount: trade.quantity,
            pnl: trade.pnl,
            result: trade.result,
            status: 'FILLED',
            createdAt: trade.closed_at
          }))
        : [];

      // Parse bot data (now returns array of all user's bots)
      const bots = (botResponse.status === 'success' && botResponse.data) 
        ? botResponse.data
        : [];

      setPendingOrders(orders);
      setTradingPositions(positions);
      setTradeHistory(trades);
      setTradingBots(bots);
      
      // Check if any bot is running and notify parent
      const hasRunning = bots.some((bot: TradingBot) => bot.status === 'running');
      if (onBotStatusChange) {
        onBotStatusChange(hasRunning);
      }
      
      console.log('[Trading UI] Data loaded:', { 
        orders: orders.length, 
        positions: positions.length,
        trades: trades.length, 
        bots: bots.length,
        hasRunningBot: hasRunning
      });
    } catch (err) {
      console.error('[Trading UI] Failed to fetch trading data', err);
      setError("Failed to fetch trading data");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchAllData();
    if (onRefresh) {
      onRefresh();
    }
  };

  useEffect(() => {
    let mounted = true;

    // Wrapper to check mounted state before updating
    const fetchDataIfMounted = async () => {
      await fetchAllData();
      if (!mounted) {
        // If unmounted during fetch, don't proceed
        return;
      }
    };

    fetchDataIfMounted();
    
    // Auto-refresh disabled - will only refresh on manual click or bot start/stop
    // const interval = setInterval(fetchDataIfMounted, 10000);

    return () => {
      mounted = false;
      // clearInterval(interval);
    };
  }, [onRefresh]);

  return ( 
    <div className="space-y-4">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleRefresh}
          disabled={loading}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Tabs defaultValue="bots" className="w-full max-w-full">
      <TabsList className="flex flex-col flex-nowrap w-full gap-1 sm:grid sm:grid-cols-2 md:grid-cols-4 sm:gap-2 min-w-[300px] p-0">
        <TabsTrigger
          value="bots"
          className="w-full text-xs sm:text-sm py-3 px-2 text-left sm:text-center min-h-[44px] box-border"
        >
          Active Bots ({tradingBots.filter(b => b.status === 'running').length})
        </TabsTrigger>
        <TabsTrigger
          value="orders"
          className="w-full text-xs sm:text-sm py-3 px-2 text-left sm:text-center min-h-[44px] box-border"
        >
          Pending Orders ({pendingOrders.length})
        </TabsTrigger>
        <TabsTrigger
          value="positions"
          className="w-full text-xs sm:text-sm py-3 px-2 text-left sm:text-center min-h-[44px] box-border"
        >
          Open Positions ({tradingPositions.filter(p => p.status === 'OPEN').length})
        </TabsTrigger>
        <TabsTrigger
          value="history"
          className="w-full text-xs sm:text-sm py-3 px-2 text-left sm:text-center min-h-[44px] box-border"
        >
          Trade History ({tradeHistory.length})
        </TabsTrigger>
      </TabsList>
      <div className="mt-2 sm:mt-4 rounded-lg border bg-card text-card-foreground shadow-sm">
        <TabsContent value="bots">
          <ScrollArea style={{ maxHeight: MAX_HEIGHT }}>
            {loading ? (
              <p className="p-2 sm:p-4 text-xs sm:text-sm">Loading bots...</p>
            ) : error ? (
              <p className="p-2 sm:p-4 text-xs sm:text-sm text-red-500">{error}</p>
            ) : tradingBots.length > 0 ? (
              <TradingBotsTable data={tradingBots} onOpenLogs={openLogsModal} />
            ) : (
              <p className="p-2 sm:p-4 text-xs sm:text-sm text-muted-foreground">No active bots</p>
            )}
          </ScrollArea>
        </TabsContent>
        <TabsContent value="orders">
          <ScrollArea style={{ maxHeight: MAX_HEIGHT }}>
            {loading ? (
              <p className="p-2 sm:p-4 text-xs sm:text-sm">Loading orders...</p>
            ) : error ? (
              <p className="p-2 sm:p-4 text-xs sm:text-sm text-red-500">{error}</p>
            ) : pendingOrders.length > 0 ? (
              <PendingOrdersTable data={pendingOrders} />
            ) : (
              <p className="p-2 sm:p-4 text-xs sm:text-sm text-muted-foreground">No pending orders</p>
            )}
          </ScrollArea>
        </TabsContent>
        <TabsContent value="positions">
          <ScrollArea style={{ maxHeight: MAX_HEIGHT }}>
            {loading ? (
              <p className="p-2 sm:p-4 text-xs sm:text-sm">Loading positions...</p>
            ) : error ? (
              <p className="p-2 sm:p-4 text-xs sm:text-sm text-red-500">{error}</p>
            ) : tradingPositions.filter(p => p.status === 'OPEN').length > 0 ? (
              <TradingPositionsTable data={tradingPositions.filter(p => p.status === 'OPEN')} />
            ) : (
              <p className="p-2 sm:p-4 text-xs sm:text-sm text-muted-foreground">No open positions</p>
            )}
          </ScrollArea>
        </TabsContent>
        <TabsContent value="history">
          <ScrollArea style={{ maxHeight: MAX_HEIGHT }}>
            {loading ? (
              <p className="p-2 sm:p-4 text-xs sm:text-sm">Loading trades...</p>
            ) : error ? (
              <p className="p-2 sm:p-4 text-xs sm:text-sm text-red-500">{error}</p>
            ) : tradeHistory.length > 0 ? (
              <TradeHistoryTable data={tradeHistory} />
            ) : (
              <p className="p-2 sm:p-4 text-xs sm:text-sm text-muted-foreground">No trade history</p>
            )}
          </ScrollArea>
        </TabsContent>
      </div>

      {/* Logs Modal */}
      <Dialog open={logsModalOpen} onOpenChange={setLogsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Bot #{selectedBotId} Logs</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 h-[60vh] overflow-y-auto">
            <div className="space-y-2 pr-4">
              {selectedBotLogs.length > 0 ? (
                selectedBotLogs.map((log, index) => (
                  <div key={index} className="flex items-start space-x-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                    <span className="text-xs text-gray-900 dark:text-gray-100 font-mono min-w-[80px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <Badge
                      variant={
                        log.level === 'INFO'
                          ? 'default'
                          : log.level === 'WARNING'
                          ? 'secondary'
                          : log.level === 'ERROR'
                          ? 'destructive'
                          : 'outline'
                      }
                      className={
                        log.level === 'INFO'
                          ? 'bg-blue-500 text-white text-xs'
                          : log.level === 'WARNING'
                          ? 'bg-yellow-500 text-white text-xs'
                          : log.level === 'ERROR'
                          ? 'bg-red-500 text-white text-xs'
                          : 'text-xs'
                      }
                    >
                      {log.level}
                    </Badge>
                    <span className="font-mono text-xs flex-1 break-all text-gray-900 dark:text-gray-100">
                      {log.message}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No logs available for this bot</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Tabs>
    </div>
  );
}

const PendingOrdersTable = ({ data }: { data: Order[] }) => (
  <div className="overflow-x-auto">
    <Table className="min-w-[600px]">
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs sm:text-sm">Asset</TableHead>
          <TableHead className="text-xs sm:text-sm">Type</TableHead>
          <TableHead className="text-xs sm:text-sm">Side</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">Price</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">Quantity</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((order, index) => (
          <TableRow key={`${order.symbol}-${index}`} style={{ height: ROW_HEIGHT }}>
            <TableCell className="font-medium text-xs sm:text-sm">{order.symbol}</TableCell>
            <TableCell className="text-xs sm:text-sm">{order.orderType}</TableCell>
            <TableCell className={`text-xs sm:text-sm ${order.side === 'BUY' ? 'text-[#0b9981]' : 'text-red-500'}`}>
              {order.side}
            </TableCell>
            <TableCell className="text-right text-xs sm:text-sm">${parseFloat(order.price).toLocaleString()}</TableCell>
            <TableCell className="text-right text-xs sm:text-sm">{parseFloat(order.quantity).toLocaleString()}</TableCell>
            <TableCell className="text-right text-xs sm:text-sm">
              <Badge variant="outline">{order.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const TradeHistoryTable = ({ data }: { data: TradeOrderData[] }) => (
  <div className="overflow-x-auto">
    <Table className="min-w-[600px]">
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs sm:text-sm">Time</TableHead>
          <TableHead className="text-xs sm:text-sm">Asset</TableHead>
          <TableHead className="text-xs sm:text-sm">Type</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">Buy Price</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">Sell Price</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">Quantity</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">PnL</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((trade) => {
          const buyPrice = (trade as any).buyPrice || 0;
          const sellPrice = trade.price || 0;
          const pnl = (trade as any).pnl || 0;
          const pnlPositive = pnl >= 0;
          
          return (
            <TableRow key={trade.id} style={{ height: ROW_HEIGHT }}>
              <TableCell className="text-xs sm:text-sm">
                {new Date(trade.createdAt).toLocaleString()}
              </TableCell>
              <TableCell className="font-medium text-xs sm:text-sm">
                {trade.symbol}
              </TableCell>
              <TableCell className="text-xs sm:text-sm">
                <Badge variant="outline" className="text-xs">
                  {trade.type}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-xs sm:text-sm">
                ${buyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right text-xs sm:text-sm">
                ${sellPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right text-xs sm:text-sm">
                {trade.amount.toFixed(4)}
              </TableCell>
              <TableCell className={`text-right text-xs sm:text-sm font-medium ${pnlPositive ? 'text-[#0b9981]' : 'text-red-500'}`}>
                {pnlPositive ? '+' : ''}${pnl.toFixed(2)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </div>
);

const TradingPositionsTable = ({ data }: { data: TradingPosition[] }) => (
  <div className="overflow-x-auto">
    <Table className="min-w-[800px]">
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs sm:text-sm">Asset</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">Entry Price</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">Current Price</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">Quantity</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">Stop Loss</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">Take Profit</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">Unrealized PnL</TableHead>
          <TableHead className="text-xs sm:text-sm">Opened At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((position) => {
          const unrealizedPnl = (position as any).unrealized_pnl || 0;
          const currentPrice = (position as any).current_price || position.entryPrice;
          const stopLoss = (position as any).stop_loss;
          const takeProfit = (position as any).take_profit;
          const pnlPositive = unrealizedPnl >= 0;
          
          return (
            <TableRow key={position.id} style={{ height: ROW_HEIGHT }}>
              <TableCell className="font-medium text-xs sm:text-sm text-[#0b9981]">{position.symbol}</TableCell>
              <TableCell className="text-right text-xs sm:text-sm">${position.entryPrice.toLocaleString()}</TableCell>
              <TableCell className="text-right text-xs sm:text-sm">${currentPrice.toLocaleString()}</TableCell>
              <TableCell className="text-right text-xs sm:text-sm">{position.quantity.toFixed(8)}</TableCell>
              <TableCell className="text-right text-xs sm:text-sm text-red-500">
                {stopLoss ? `$${stopLoss.toLocaleString()}` : '-'}
              </TableCell>
              <TableCell className="text-right text-xs sm:text-sm text-[#0b9981]">
                {takeProfit ? `$${takeProfit.toLocaleString()}` : '-'}
              </TableCell>
              <TableCell className={`text-right text-xs sm:text-sm font-medium ${pnlPositive ? 'text-[#0b9981]' : 'text-red-500'}`}>
                {pnlPositive ? '+' : ''}${unrealizedPnl.toFixed(2)}
              </TableCell>
              <TableCell className="text-xs sm:text-sm">
                {new Date(position.openedAt).toLocaleString()}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </div>
);

const TradingBotsTable = ({ data, onOpenLogs }: { data: TradingBot[]; onOpenLogs: (botId: number) => void }) => (
  <div className="overflow-x-auto">
    <Table className="min-w-[600px]">
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs sm:text-sm">Bot ID</TableHead>
          <TableHead className="text-xs sm:text-sm">Strategy</TableHead>
          <TableHead className="text-xs sm:text-sm">Coin</TableHead>
          <TableHead className="text-xs sm:text-sm">Status</TableHead>
          <TableHead className="text-xs sm:text-sm text-right">Capital (USDT)</TableHead>
          <TableHead className="text-xs sm:text-sm">Created At</TableHead>
          <TableHead className="text-xs sm:text-sm">Stopped At</TableHead>
          <TableHead className="text-xs sm:text-sm">Logs</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((bot) => (
          <TableRow key={bot.id} style={{ height: ROW_HEIGHT }}>
            <TableCell className="font-medium text-xs sm:text-sm">#{bot.id}</TableCell>
            <TableCell className="text-xs sm:text-sm">{bot.strategy_name}</TableCell>
            <TableCell className="text-xs sm:text-sm font-medium text-[#0b9981]">{bot.coin}</TableCell>
            <TableCell className="text-xs sm:text-sm">
              <Badge
                variant={
                  bot.status === 'running'
                    ? 'default'
                    : bot.status === 'stopped'
                    ? 'secondary'
                    : 'destructive'
                }
                className={bot.status === 'running' ? 'bg-[#0b9981] text-white' : ''}
              >
                {bot.status.toUpperCase()}
              </Badge>
            </TableCell>
            <TableCell className="text-right text-xs sm:text-sm">${bot.capital.toLocaleString()}</TableCell>
            <TableCell className="text-xs sm:text-sm">
              {new Date(bot.created_at).toLocaleString()}
            </TableCell>
            <TableCell className="text-xs sm:text-sm">
              {bot.stopped_at ? new Date(bot.stopped_at).toLocaleString() : '-'}
            </TableCell>
            <TableCell className="text-xs sm:text-sm">
              <button
                onClick={() => onOpenLogs(bot.id)}
                disabled={bot.status === 'stopped'}
                className={`p-1 rounded ${bot.status === 'stopped' ? 'text-gray-400 cursor-not-allowed' : 'text-blue-500 hover:text-blue-700'}`}
                title={bot.status === 'stopped' ? 'Logs not available for stopped bots' : 'View logs'}
              >
                <Eye className="h-4 w-4" />
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
