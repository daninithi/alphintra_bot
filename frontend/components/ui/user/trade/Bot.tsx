
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Play, Square, X } from 'lucide-react';
import { buildGatewayUrl } from '@/lib/config/gateway';
import { getToken } from '@/lib/auth';

interface Strategy {
  strategy_id: string;
  name: string;
  description: string;
  type: string;
  access_type?: string;
  total_purchases?: number;
}

interface BotStatus {
  id?: number;
  bot_name: string;
  strategy_name: string;
  coin: string;
  capital: number;
  status: string;
  last_run?: string;
  created_at: string;
}

interface BotProps {
  hasRunningBot?: boolean;
  refreshTrigger?: number;
  onBotChange?: () => void;
}

export default function Bot({ hasRunningBot = false, refreshTrigger = 0, onBotChange }: BotProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');
  const [selectedCoin, setSelectedCoin] = useState<string>('BTC/USDT');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(true);
  const [coins] = useState<string[]>(['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'ADA/USDT', 'DOGE/USDT', 'XRP/USDT']);

  // Fetch strategies from API
  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setStrategiesLoading(true);
        const token = getToken();
        if (!token) {
          console.error('No token found, cannot fetch strategies');
          return;
        }

        const response = await fetch(buildGatewayUrl('/trading/strategies'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.data) {
            setStrategies(data.data);
            // Set first strategy as default
            if (data.data.length > 0 && !selectedStrategy) {
              setSelectedStrategy(data.data[0].strategy_id);
            }
          }
        } else {
          console.error('Failed to fetch strategies:', response.status);
        }
      } catch (error) {
        console.error('Failed to fetch strategies:', error);
      } finally {
        setStrategiesLoading(false);
      }
    };

    fetchStrategies();
  }, []);

  // Set default strategy
  useEffect(() => {
    if (strategies.length > 0 && !selectedStrategy) {
      setSelectedStrategy(strategies[0].strategy_id);
    }
  }, [strategies, selectedStrategy]);

  // Fetch bot status on mount (auto-refresh disabled)
  useEffect(() => {
    fetchBotStatus();
    // Auto-refresh disabled - uncomment to enable polling every 10 seconds
    // const interval = setInterval(fetchBotStatus, 10000);
    // return () => clearInterval(interval);
  }, []);
  
  // Refresh bot status when refresh trigger changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchBotStatus();
    }
  }, [refreshTrigger]);

  const fetchBotStatus = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(buildGatewayUrl('/trading/bot'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          setBotStatus(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch bot status:', error);
    }
  };

  const handleStart = () => {
    setIsModalOpen(true);
  };

  const handleConfirmStart = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) {
        alert('Please login first');
        return;
      }

      console.log('Starting bot with:', { strategy_id: selectedStrategy, coin: selectedCoin, capital: amount });

      const response = await fetch(buildGatewayUrl('/trading/start'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          strategy_id: selectedStrategy,
          coin: selectedCoin,
          capital: amount
        })
      });

      console.log('Response status:', response.status, response.statusText);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        alert(`Failed to start bot: ${response.status} ${response.statusText}`);
        return;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        alert('Server returned invalid response format');
        return;
      }

      const data = await response.json();
      console.log('Bot start response:', data);
      
      if (data.status === 'success') {
        alert(`Bot started successfully! Trading ${selectedCoin} with ${amount}% capital`);
        fetchBotStatus(); // Refresh bot status
        setIsModalOpen(false);
        // Trigger parent refresh to update main panel
        if (onBotChange) {
          onBotChange();
        }
      } else {
        // Handle specific error cases
        if (data.message && data.message.includes('connect your trading account')) {
          alert('⚠️ Wallet Not Connected.');
        } else {
          alert(data.message || 'Failed to start bot');
        }
      }
    } catch (error) {
      console.error('Failed to start bot:', error);
      alert(`Failed to start bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = async () => {
    try {
      setLoading(true);
      const token = getToken();
      if (!token) {
        alert('Please login first');
        return;
      }

      const response = await fetch(buildGatewayUrl('/trading/stop'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok && data.status === 'success') {
        // Immediately update UI to show stopped status
        setBotStatus(null);
        alert('Bot stopped successfully!');
        // Fetch updated status from server
        setTimeout(() => fetchBotStatus(), 500);
        // Trigger parent refresh to update main panel
        if (onBotChange) {
          onBotChange();
        }
      } else {
        alert(data.message || 'Failed to stop bot');
      }
    } catch (error) {
      console.error('Failed to stop bot:', error);
      alert('Failed to stop bot. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setAmount(50); 
  };

  return (
      <div>
        {/* Bot Status Display */}
        
        <div className="flex gap-3 items-end">
          {/* Strategy Selection */}
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-sm font-medium">Strategy</label>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              disabled={hasRunningBot || strategiesLoading}
              className="border border-gray-100 bg-background p-2 rounded-md text-sm h-10"
            >
              {strategiesLoading ? (
                <option value="">Loading strategies...</option>
              ) : strategies.length === 0 ? (
                <option value="">No strategies available</option>
              ) : (
                strategies.map((strategy) => (
                  <option key={strategy.strategy_id} value={strategy.strategy_id}>
                    {strategy.name} {strategy.access_type && strategy.access_type !== 'default' && `(${strategy.access_type})`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Coin Selection */}
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-sm font-medium">Trading Pair</label>
            <select
              value={selectedCoin}
              onChange={(e) => setSelectedCoin(e.target.value)}
              disabled={hasRunningBot}
              className="border border-gray-100 bg-background p-2 rounded-md text-sm h-10"
            >
              {coins.map((coin) => (
                <option key={coin} value={coin}>
                  {coin}
                </option>
              ))}
            </select>
          </div>

          {/* Start Button */}
          <Button 
            onClick={handleStart} 
            disabled={loading || !selectedStrategy || hasRunningBot}
            className='bg-[#0b9981] hover:bg-[#0b9981] hover:scale-105 min-w-[120px] h-10'
            title={hasRunningBot ? 'Stop the running bot before starting a new one' : 'Start bot'}
          >
            <Play className="w-4 h-4 mr-2" />
            Start Bot
          </Button>

          {/* Stop Button */}
          <Button 
            onClick={handleEnd} 
            disabled={loading || !hasRunningBot}
            variant="destructive"
            className='hover:scale-105 min-w-[120px] h-10'
          >
            <Square className="w-4 h-4 mr-2" />
            Stop Bot
          </Button>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg shadow-xl max-w-md w-full mx-4">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h2 className="text-xl font-semibold">Start Trading Bot</h2>
                <button
                  onClick={handleCloseModal}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Bot Description */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Strategy</h3>
                  <p className="text-sm text-muted-foreground">
                    {strategies.find(s => s.strategy_id === selectedStrategy)?.description}
                  </p>
                </div>

                {/* Trading Info */}
                <div className="bg-muted p-3 rounded-md">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Strategy:</span>
                      <p className="font-medium">{strategies.find(s => s.strategy_id === selectedStrategy)?.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Trading Pair:</span>
                      <p className="font-medium">{selectedCoin}</p>
                    </div>
                  </div>
                </div>

                {/* Amount Slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Capital Allocation</label>
                    <span className="text-sm font-semibold text-[#0b9981]">{amount}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-[#0b9981]"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Info Message */}
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-xs text-muted-foreground">
                    This will allocate {amount}% of your available capital ({(amount * 100).toFixed(2)} USDT from 10,000 USDT simulation balance).
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 p-6 border-t border-border">
                <Button
                  onClick={handleCloseModal}
                  disabled={loading}
                  variant="outline"
                  className="flex-1 border-gray-400 dark:border-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmStart}
                  disabled={loading}
                  className="flex-1 bg-[#0b9981] hover:bg-[#0b9981] hover:scale-105"
                >
                  {loading ? (
                    <span>Starting...</span>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Bot
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

  );
}
