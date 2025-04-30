import React, { useEffect, useState } from 'react';
import './App.css';
import { ethers } from 'ethers';

// Token price interface
interface TokenPrice {
  [key: string]: number;
}

// API response interfaces
interface PriceResponse {
  source: string;
  timestamp: string;
  prices: TokenPrice;
}

interface SwapEstimate {
  fromToken: string;
  toToken: string;
  inputAmount: number;
  outputAmount: number;
  exchangeRate: number;
  timestamp: number;
}

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [tokens, setTokens] = useState<{ 
    [key: string]: {
      name: string;
      decimals: number;
      address: string;
    }
  }>({});
  const [fromToken, setFromToken] = useState<string>("ETH");
  const [toToken, setToToken] = useState<string>("USDC");
  const [amount, setAmount] = useState<string>("1");
  const [swapResult, setSwapResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [prices, setPrices] = useState<any>({});
  const [features, setFeatures] = useState<any>({});
  const [theme, setTheme] = useState<string>("default");
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [gasEstimates, setGasEstimates] = useState<any>(null);
  const [gasLoading, setGasLoading] = useState(false);
  const [gasError, setGasError] = useState<string | null>(null);
  const [priceData, setPriceData] = useState<PriceResponse | null>(null);
  const [swapAmount, setSwapAmount] = useState<string>("1");
  const [swapEstimate, setSwapEstimate] = useState<SwapEstimate | null>(null);
  const [swapLoading, setSwapLoading] = useState<boolean>(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


  // API base URL - this is where our server is running
  const API_URL = 'http://localhost:4000';
  const PRICES_URL = `${API_URL}/api/prices`;
  const SWAP_URL = `${API_URL}/api/swap-estimate`;

  // Add these function definitions inside the App component, before the useEffect hooks:

  const fetchPrices = async () => {
    try {
      setLoading(true);
      const response = await fetch(PRICES_URL);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      setPriceData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch prices:', err);
      setError('Failed to load price data. Please try again.');
      setPriceData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchGasEstimates = async () => {
    setGasLoading(true);
    setGasError(null);
    try {
      const response = await fetch(`${API_URL}/api/gas-estimates`);
      if (!response.ok) throw new Error('Failed to fetch gas estimates');
      const data = await response.json();
      setGasEstimates(data);
    } catch (err) {
      console.error('Error fetching gas estimates:', err);
      setGasError('Error fetching gas estimates. The cache may be poisoned!');
    } finally {
      setGasLoading(false);
    }
  };

  // Fetch token list on component mount
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const response = await fetch(`${API_URL}/api/tokens`);
        const data = await response.json();
        setTokens(data);
      } catch (error) {
        console.error('Error fetching tokens:', error);
      }
    };

    const fetchFeatures = async () => {
      try {
        const headers = {
          'X-Theme': theme,
          'X-Platform': 'browser',
          'X-App-Version': '1.0',
        };
        const response = await fetch(`${API_URL}/api/features?clientId=web-user`, { headers });
        const data = await response.json();
        setFeatures(data.features || {});
      } catch (error) {
        console.error('Error fetching features:', error);
      }
    };

    fetchTokens();
    fetchPrices(); // Now using the component-level function
    fetchFeatures();
    fetchGasEstimates(); // Now using the component-level function
  }, [theme]);

  // Connect wallet function
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask to use this DApp');
      return;
    }

    setConnecting(true);
    
    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setConnecting(false);
    }
  };

  // Update the useEffect for fetching swap estimates
  const fetchSwapEstimate = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/swap-estimate?fromToken=${fromToken}&toToken=${toToken}&amount=${amount}`
      );
      
      const data = await response.json();
      
      console.log("Data is", data);
      console.log("data type is", typeof data);
      
      if (!response.ok) {
        if (data.error?.includes('Cache Poisoning')) {
          setSwapError(`⚠️ ${data.error}: ${data.message}`);
        } else {
          setSwapError(data.message || 'Swap error');
        }
        setSwapEstimate(null);
      } else {
        setSwapEstimate(data);
        setSwapError(null);
      }
    } catch (err) {
      console.error('Error:', err);
      setSwapError('Invalid server response - check console for details');
    }
  };

  // Available tokens for dropdowns (based on what we receive from the API)
  const availableTokens = priceData ? Object.keys(priceData.prices) : [];

  // Add disconnect function
  const disconnectWallet = () => {
    setAccount(null);
    setSwapEstimate(null);
    setSwapError(null);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Web3 Token Swap DApp</h1>
        
        <div className="header-controls">
          <div className="theme-selector">
            <label>Theme: </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="theme-select"
            >
              <option value="default">Default</option>
              <option value="dark">Dark Mode</option>
              <option value="light">Light Mode</option>
              <option value="special">Special</option>
            </select>
          </div>
          <button 
            onClick={async () => {
              try {
                const response = await fetch(`${API_URL}/admin/clear-cache`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                alert('Cache cleared successfully!\n' + data.message);
               fetchPrices();
               fetchGasEstimates();
               //fetchSwapEstimate();
              } catch (err) {
                console.error('Failed to clear cache:', err);
                alert('Failed to clear cache. Check console for details.');
              }
            }}
            className="clear-cache-button"
            title="Clear poisoned cache entries"
          >
            🗑️ Clear Cache
          </button>
        </div>
        
        {/* Promo Banner - only shows when a promo is active */}
        {promoCode && (
          <div className="promo-banner">
            <span>🎉 Special Offer! Use promo code: <strong>{promoCode}</strong></span>
          </div>
        )}
        
        {/* Wallet Connection Section */}
        <div className="wallet-section">
          {!account ? (
            <button 
              onClick={connectWallet} 
              disabled={connecting} 
              className="connect-button"
            >
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          ) : (
            <div className="account-info">
              <p>Connected: {account.substring(0, 6)}...{account.substring(account.length - 4)}</p>
              <button 
                onClick={disconnectWallet}
                className="disconnect-button"
                title="Disconnect wallet"
              >
                Disconnect
              </button>
              
              {/* Moved Swap Container inside connected state */}
              <div className="swap-container">
                <h3>Token Swap Calculator</h3>
                <div className="swap-form">
                  <div className="form-row">
                    <select value={fromToken} onChange={(e) => setFromToken(e.target.value)}>
                      <option value="">Select token</option>
                      {Object.keys(tokens).map((token) => (
                        <option key={token} value={token}>
                          {tokens[token].name} ({token})
                        </option>
                      ))}
                    </select>
                    <input 
                      type="number" 
                      value={amount} 
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Amount"
                    />
                  </div>
                  <div className="form-row">
                    <select value={toToken} onChange={(e) => setToToken(e.target.value)}>
                      <option value="">Select token</option>
                      {Object.keys(prices).map(token => (
                        <option key={token} value={token}>{token}</option>
                      ))}
                    </select>
                    <button onClick={fetchSwapEstimate} disabled={!fromToken || !toToken || !amount || swapLoading}>
                      Calculate
                    </button>
                  </div>
                </div>
                
                {swapLoading && <p>Loading swap estimate...</p>}
                
                {swapError && (
                  <div className="error-box">
                    <h4>Error</h4>
                    <p>{swapError}</p>
                    <p className="note">This may be caused by a cache poisoning attack. Try clearing the cache and trying again.</p>
                  </div>
                )}
                
                {swapEstimate && !swapError && (
                  <div className="result-box">
                    <h4>Swap Estimate</h4>
                    <p>{swapEstimate.inputAmount} {swapEstimate.fromToken} ≈ {swapEstimate.outputAmount} {swapEstimate.toToken}</p>
                    <p>Rate: 1 {swapEstimate.fromToken} = {swapEstimate.exchangeRate} {swapEstimate.toToken}</p>
                    <p className="timestamp">Last updated: {new Date(swapEstimate.timestamp).toLocaleTimeString()}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Price Table */}
        <div className="price-table">
          <h2>Current Prices</h2>
          {loading ? (
            <p className="loading">Loading prices...</p>
          ) : error ? (
            <p className="error">{error}</p>
          ) : priceData ? (
            <div className="price-grid">
              {Object.entries(priceData.prices).map(([token, price]) => (
                <div key={token} className="price-card">
                  <h3>{token}</h3>
                  <p className="price-value">${price.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No price data available</p>
          )}
        </div>
        
        {/* Feature section - shows the enabled features from our API */}
        {Object.keys(features).length > 0 && (
          <div className="features-section">
            <h2>Available Features</h2>
            <ul className="feature-list">
              {Object.entries(features).map(([key, value]: [string, any]) => (
                <li key={key} className={value ? 'feature-enabled' : 'feature-disabled'}>
                  {key}: {value ? '✅ Enabled' : '❌ Disabled'}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Gas Price Section */}
        <div className="gas-estimates">
          <h2>Gas Estimates (Gwei)</h2>
          {gasLoading ? (
            <p className="loading">Loading gas estimates...</p>
          ) : gasError ? (
            <div className="gas-error">
              <p>{gasError}</p>
              <p>This could be due to cache poisoning DoS</p>
            </div>
          ) : gasEstimates ? (
            <div className="gas-tiers">
              <div className="gas-tier">
                <div className="gas-speed">Slow</div>
                <div className="gas-price">{gasEstimates.slow}</div>
              </div>
              <div className="gas-tier">
                <div className="gas-speed">Average</div>
                <div className="gas-price">{gasEstimates.average}</div>
              </div>
              <div className="gas-tier">
                <div className="gas-speed">Fast</div>
                <div className="gas-price">{gasEstimates.fast}</div>
              </div>
              <p className="timestamp">Last updated: {new Date(gasEstimates.timestamp).toLocaleTimeString()}</p>
            </div>
          ) : (
            <p>No gas data available</p>
          )}
        </div>
        
        <div className="note">
          <p>Note: This is a demonstration app for educational purposes.</p>
          <p>No real transactions will be executed.</p>
        </div>
      </header>
    </div>
  );
}

// Add global type for window.ethereum
declare global {
  interface Window {
    ethereum: any;
  }
}

export default App;
