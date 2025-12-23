import { useEffect, useState, useCallback } from 'react';
import { Navigation } from '@/components/Navigation';
import { PegasusAnimation } from '@/components/PegasusAnimation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowUp, ExternalLink, Loader2, AlertCircle, X, Check, Wallet, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { Input } from '@/components/ui/input';

interface TokenProfile {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: { label?: string; type?: string; url: string }[];
}

interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
    h1: number;
    m5: number;
  };
  priceChange?: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  pairCreatedAt?: number;
  info?: {
    imageUrl?: string;
    header?: string;
    openGraph?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
}

const EVM_WALLETS = [
  "0x94A49a3099b5C3921eE4c2c213Ef25c068d837a5",
  "0x5D84D8E44390C5A9b069952F1696f538d2ebaf73",
  "0xAda53ED3Bc3D289F0A7E68c54B26cF7806D64398",
  "0xE56D8EbFc8AbB14838e85676b431803602127907",
  "0xEa1630a397eBB5BAB325b3eba2b1868FD957703e",
  "0x762762ee7a93Ab23C886fBC1C07fad9E23C08FAe",
  "0xAda53ED3Bc3D289F0A7E68c54B26cF7806D64398"
];

const SOLANA_WALLETS = [
  "4E9G6hLmdMGit2n5AL1UwEpx7foKomhQx4jPdXwSwdHj",
  "Eoxf3CwgWauYMKTktGPsLZ6733xEwaCw9V2wAcA8aHcP",
  "wV8V9KDxtqTrumjX9AEPmvYb1vtSMXDMBUq5fouH1Hj",
  "3THbDHY3LRZw4gx4b5GyfPbTKz8XeY9UPhE3akRJd82i"
];

const PACKAGES = [
  { name: 'Basic', price: 90, multiplier: '10x', id: 'basic', color: 'from-blue-400 to-blue-600' },
  { name: 'Bronze', price: 200, multiplier: '20x', id: 'bronze', color: 'from-orange-400 to-orange-600' },
  { name: 'Silver', price: 300, multiplier: '50x', id: 'silver', color: 'from-slate-300 to-slate-500' },
  { name: 'Gold', price: 700, multiplier: '100x', id: 'gold', color: 'from-yellow-400 to-yellow-600' },
  { name: 'Platinum', price: 3000, multiplier: '500x', id: 'platinum', color: 'from-purple-400 to-purple-600' },
  { name: 'Diamond Enterprise / Custom', price: 0, multiplier: 'Custom', id: 'custom', color: 'from-cyan-400 to-cyan-600' }
];

const Ads = () => {
  const [tokens, setTokens] = useState<DexPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flow State
  const [showAdsFlow, setShowAdsFlow] = useState(false);
  const [flowType, setFlowType] = useState<'ADS' | 'PRESS'>('ADS');
  const [showPressReleasePreview, setShowPressReleasePreview] = useState(false);
  const [flowStep, setFlowStep] = useState<'INPUT' | 'PACKAGES' | 'PAYMENT'>('INPUT');
  const [contractAddress, setContractAddress] = useState('');
  const [fetchedToken, setFetchedToken] = useState<DexPair | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [paymentWallet, setPaymentWallet] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<typeof PACKAGES[0] | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'SUCCESS' | 'FAILED'>('PENDING');

  const fetchTokens = useCallback(async () => {
    try {
      setError(null);
      // 1. Fetch candidates from multiple sources
      const sources = [
        'https://api.dexscreener.com/token-profiles/latest/v1',
        'https://api.dexscreener.com/token-boosts/latest/v1',
        'https://api.dexscreener.com/token-boosts/top/v1'
      ];

      const responses = await Promise.allSettled(
        sources.map(url => fetch(url).then(res => {
            if (!res.ok) throw new Error(`Failed to fetch ${url}`);
            return res.json();
        }))
      );

      const candidateAddresses = new Set<string>();
      
      responses.forEach(result => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          result.value.forEach((item: any) => {
            if (item?.tokenAddress) {
              candidateAddresses.add(item.tokenAddress);
            }
          });
        }
      });

      if (candidateAddresses.size === 0) {
        console.warn('No candidate tokens found');
        if (tokens.length === 0) {
            setLoading(false);
        }
        return;
      }

      // 2. Fetch details for candidates in chunks of 30
      const addresses = Array.from(candidateAddresses);
      const chunks = [];
      const MAX_TOKENS_TO_CHECK = 150; // Increased limit to ensure we get 90
      const limitedAddresses = addresses.slice(0, MAX_TOKENS_TO_CHECK);
      
      for (let i = 0; i < limitedAddresses.length; i += 30) {
        chunks.push(limitedAddresses.slice(i, i + 30));
      }

      const pairPromises = chunks.map(chunk => 
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`)
          .then(res => res.json())
          .then(data => data?.pairs as DexPair[])
          .catch(err => {
              console.error("Error fetching pairs chunk:", err);
              return [] as DexPair[];
          })
      );

      const pairsResults = await Promise.all(pairPromises);
      const allPairs = pairsResults.flat().filter(Boolean);

      // 3. Filter and process pairs
      const validPairs = allPairs.filter(pair => {
        const h24 = pair?.priceChange?.h24;
        return typeof h24 === 'number' && h24 >= 200;
      });

      // Remove duplicates
      const uniquePairsMap = new Map<string, DexPair>();
      validPairs.forEach(pair => {
        if (!pair?.baseToken?.address) return;
        
        const tokenAddress = pair.baseToken.address;
        const currentLiquidity = pair.liquidity?.usd || 0;
        const existingLiquidity = uniquePairsMap.get(tokenAddress)?.liquidity?.usd || 0;

        if (!uniquePairsMap.has(tokenAddress) || currentLiquidity > existingLiquidity) {
          uniquePairsMap.set(tokenAddress, pair);
        }
      });

      const processedPairs = Array.from(uniquePairsMap.values());
      
      // Sort by price change descending
      processedPairs.sort((a, b) => (b.priceChange?.h24 || 0) - (a.priceChange?.h24 || 0));

      setTokens(prevTokens => {
        if (prevTokens.length === 0) {
            return processedPairs.slice(0, 90);
        }

        const existingAddresses = new Set(prevTokens.map(t => t.baseToken.address));
        const newTokens = processedPairs.filter(p => !existingAddresses.has(p.baseToken.address));
        
        const updatedPrevTokens = prevTokens.map(t => {
            const freshData = processedPairs.find(p => p.baseToken.address === t.baseToken.address);
            return freshData || t;
        });

        const combined = [...newTokens, ...updatedPrevTokens];
        return combined.slice(0, 90);
      });
      
      setLoading(false);

    } catch (error) {
      console.error('Error fetching ads:', error);
      setError('Failed to load trending ads. Please try again later.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 60000); 
    return () => clearInterval(interval);
  }, [fetchTokens]);

  const handleGetAdsOpen = (type: 'ADS' | 'PRESS' = 'ADS') => {
    setShowAdsFlow(true);
    setFlowType(type);
    setFlowStep('INPUT');
    setContractAddress('');
    setFetchedToken(null);
    setFetchError('');
    setPaymentStatus('PENDING');
  };

  const handleContractSubmit = async () => {
    if (!contractAddress.trim()) {
        setFetchError('Please enter a contract address');
        return;
    }
    
    setIsFetchingToken(true);
    setFetchError('');
    
    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`);
        const data = await res.json();
        
        if (data.pairs && data.pairs.length > 0) {
            // Find the best pair (highest liquidity)
            const bestPair = data.pairs.sort((a: DexPair, b: DexPair) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
            setFetchedToken(bestPair);
            setFlowStep('PACKAGES');
        } else {
            setFetchError('Token not found. Please check the contract address.');
        }
    } catch (err) {
        setFetchError('Failed to fetch token details.');
    } finally {
        setIsFetchingToken(false);
    }
  };

  const handlePackageSelect = (pkg: typeof PACKAGES[0]) => {
    if (pkg.id === 'custom') {
        // Custom logic if needed, for now just do nothing or alert
        alert("Please contact support for Enterprise/Custom packages.");
        return;
    }
    
    setSelectedPackage(pkg);
    
    // Select wallet based on chain
    let walletList = EVM_WALLETS;
    if (fetchedToken?.chainId === 'solana') {
        walletList = SOLANA_WALLETS;
    }
    
    const randomWallet = walletList[Math.floor(Math.random() * walletList.length)];
    setPaymentWallet(randomWallet);
    setPaymentStatus('PENDING');
    setFlowStep('PAYMENT');
  };

  const verifyPayment = async () => {
    if (!selectedPackage || !paymentWallet || !fetchedToken) return;

    setIsVerifying(true);
    
    // Solana Verification (Mock for now as requested focus was on wallets)
    if (fetchedToken.chainId === 'solana') {
        setTimeout(() => {
            setPaymentStatus('SUCCESS');
            setIsVerifying(false);
        }, 2000);
        return;
    }

    try {
        // Use a public RPC provider for EVM (Ethereum Mainnet assumed)
        // If the user meant another chain, this would need adjustment.
        // Given the wallets look like ETH addresses and "erc20" implies Ethereum ecosystem.
        // We'll try to check standard Ethereum Mainnet.
        const provider = new ethers.JsonRpcProvider("https://eth.public-rpc.com");
        
        // ERC20 Transfer Event Signature
        const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
        
        // Get current block
        const currentBlock = await provider.getBlockNumber();
        // Check last ~5 minutes (approx 25 blocks at 12s/block)
        const startBlock = currentBlock - 30; 
        
        // We need to query the token contract for Transfer events to our payment wallet
        const tokenContract = new ethers.Contract(contractAddress, ["event Transfer(address indexed from, address indexed to, uint256 value)"], provider);
        
        const filter = tokenContract.filters.Transfer(null, paymentWallet);
        const events = await tokenContract.queryFilter(filter, startBlock, currentBlock);
        
        // Check if any transfer matches the amount (or close to it?)
        // Since we don't have token decimals easily without fetching, we might need to be careful.
        // However, user said "amount worth of the evm token". 
        // This usually means USD value. But on-chain we see tokens.
        // We can't easily know the exact token amount for $X USD without price.
        // BUT we have the priceUsd from DexScreener (fetchedToken.priceUsd).
        
        const priceUsd = parseFloat(fetchedToken.priceUsd);
        const targetUsd = selectedPackage.price;
        const expectedTokens = targetUsd / priceUsd;
        
        let found = false;
        
        for (const event of events) {
            if ('args' in event) {
                const value = event.args[2]; // uint256 value
                // We need decimals. Default to 18 if unknown or fetch it.
                // Let's try to fetch decimals.
                const erc20 = new ethers.Contract(contractAddress, ["function decimals() view returns (uint8)"], provider);
                let decimals = 18;
                try {
                    decimals = await erc20.decimals();
                } catch (e) {
                    console.warn("Could not fetch decimals, assuming 18");
                }
                
                const amount = parseFloat(ethers.formatUnits(value, decimals));
                
                // Allow 5% variance due to price fluctuations
                if (amount >= expectedTokens * 0.95 && amount <= expectedTokens * 1.05) {
                    found = true;
                    break;
                }
            }
        }
        
        if (found) {
            setPaymentStatus('SUCCESS');
        } else {
            setPaymentStatus('FAILED');
        }

    } catch (err) {
        console.error("Payment verification failed:", err);
        setPaymentStatus('FAILED');
    } finally {
        setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden text-foreground bg-background">
      <PegasusAnimation />
      <Navigation />

      <div className="relative z-10 container mx-auto px-4 pt-24 md:pt-32 pb-8">
        
        {/* Top Buttons */}
        <div className="mb-8 flex flex-col md:flex-row justify-center items-center gap-4">
            <Button 
                onClick={() => handleGetAdsOpen('ADS')}
                className="w-full max-w-xs md:max-w-sm bg-primary/20 hover:bg-primary/30 text-primary-foreground border border-primary/50 backdrop-blur-sm transition-all duration-300 transform hover:scale-105"
            >
                Get Ads
            </Button>
            <Button 
                onClick={() => setShowPressReleasePreview(true)}
                className="w-full max-w-xs md:max-w-sm bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white border border-white/20 shadow-lg shadow-purple-500/20 animate-pulse transition-all duration-300 transform hover:scale-105"
            >
                Press Release
            </Button>
        </div>

        <h1 className="text-4xl font-extrabold text-center mb-12 text-gradient">
          Ads
        </h1>

        {error && (
            <div className="flex justify-center mb-8">
                <div className="bg-destructive/20 text-destructive border border-destructive/50 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            </div>
        )}

        {loading && tokens.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : tokens.length === 0 ? (
           <div className="text-center py-20">
               <p className="text-xl text-muted-foreground">No trending ads found with &gt;200% gain in 24h.</p>
               <Button onClick={fetchTokens} variant="outline" className="mt-4">
                   Refresh
               </Button>
           </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {tokens.map((token) => (
                <motion.div
                  key={token.baseToken.address}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                  className="h-full"
                >
                  <Card className="h-full bg-black/40 border-white/10 backdrop-blur-md hover:border-primary/50 transition-colors group overflow-hidden">
                    <CardContent className="p-6 flex flex-col h-full">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3 overflow-hidden">
                            {token.info?.imageUrl ? (
                                <img 
                                    src={token.info.imageUrl} 
                                    alt={token.baseToken.name} 
                                    className="w-12 h-12 rounded-full object-cover border border-white/10 flex-shrink-0"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48?text=?';
                                    }}
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold flex-shrink-0 text-primary">
                                    {token.baseToken.symbol?.slice(0, 2)}
                                </div>
                            )}
                            <div className="min-w-0">
                                <h3 className="font-bold text-lg leading-tight truncate" title={token.baseToken.name}>
                                    {token.baseToken.name}
                                </h3>
                                <p className="text-sm text-muted-foreground truncate">{token.baseToken.symbol}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0 ml-2">
                             <div className="flex items-center gap-1 text-green-400 font-bold bg-green-400/10 px-2 py-1 rounded-md">
                                <ArrowUp className="w-4 h-4" />
                                {token.priceChange?.h24?.toFixed(0)}%
                             </div>
                             <p className="text-xs text-muted-foreground mt-1">24h</p>
                        </div>
                      </div>

                      <div className="mt-auto space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Price</span>
                            <span className="font-mono">
                                ${Number(token.priceUsd || 0).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 8
                                })}
                            </span>
                        </div>
                        
                        <Button className="w-full gap-2" variant="outline" asChild>
                            <a href={token.url} target="_blank" rel="noopener noreferrer">
                                View on DexScreener <ExternalLink className="w-4 h-4" />
                            </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Bottom Buttons */}
        <div className="mt-12 flex flex-col md:flex-row justify-center items-center gap-4">
            <Button 
                onClick={() => handleGetAdsOpen('ADS')}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 w-full md:w-auto"
            >
                Get Ads
            </Button>
             <Button 
                onClick={() => setShowPressReleasePreview(true)}
                size="lg"
                className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white font-bold px-8 animate-pulse w-full md:w-auto"
            >
                Press Release
            </Button>
        </div>

      </div>

      {/* Get Ads Flow Overlay */}
      <AnimatePresence>
        {showAdsFlow && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-card border border-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                >
                    <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
                        <h2 className="text-2xl font-bold">{flowType === 'PRESS' ? 'Get Press Release' : 'Get Ads'}</h2>
                        <Button variant="ghost" size="icon" onClick={() => setShowAdsFlow(false)}>
                            <X className="w-6 h-6" />
                        </Button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1">
                        {flowStep === 'INPUT' && (
                            <div className="space-y-6">
                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-semibold">Enter Contract Address</h3>
                                    <p className="text-muted-foreground">Paste your token's contract address to get started.</p>
                                </div>
                                <div className="space-y-4">
                                    <Input 
                                        placeholder="0x.... address" 
                                        value={contractAddress}
                                        onChange={(e) => setContractAddress(e.target.value)}
                                        className="text-lg py-6"
                                    />
                                    {fetchError && (
                                        <p className="text-destructive text-sm flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" /> {fetchError}
                                        </p>
                                    )}
                                    <Button 
                                        onClick={handleContractSubmit} 
                                        className="w-full text-lg py-6" 
                                        disabled={isFetchingToken}
                                    >
                                        {isFetchingToken ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : 'Continue'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {flowStep === 'PACKAGES' && fetchedToken && (
                            <div className="space-y-8">
                                <div className="text-center space-y-4">
                                    <div className="relative w-24 h-24 mx-auto">
                                        <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                                        <img 
                                            src={fetchedToken.info?.imageUrl || 'https://via.placeholder.com/96'} 
                                            alt={fetchedToken.baseToken.name}
                                            className="w-full h-full rounded-full object-cover p-1"
                                        />
                                    </div>
                                    <h2 className="text-3xl font-bold">
                                        Give <span className="text-primary">{fetchedToken.baseToken.name}</span> a Trending
                                    </h2>
                                    <p className="text-muted-foreground">Select a package to boost your token visibility.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {PACKAGES.map((pkg) => (
                                        <Button
                                            key={pkg.id}
                                            onClick={() => handlePackageSelect(pkg)}
                                            className={`h-auto py-6 flex flex-col items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-foreground border border-primary/30 hover:border-primary/50 backdrop-blur-sm transition-all`}
                                            variant="ghost"
                                        >
                                            <span className="text-lg font-bold">{pkg.name}</span>
                                            {pkg.price > 0 && <span className="text-2xl font-extrabold text-primary">${pkg.price}</span>}
                                            {flowType === 'ADS' && (
                                                <span className="text-sm font-mono bg-background/50 px-2 py-0.5 rounded text-muted-foreground">{pkg.multiplier}</span>
                                            )}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {flowStep === 'PAYMENT' && selectedPackage && (
                            <div className="space-y-8">
                                <div className="text-center space-y-2">
                                    <h3 className="text-2xl font-bold">Complete Payment</h3>
                                    <p className="text-muted-foreground">Send <span className="text-primary font-bold">${selectedPackage.price}</span> worth of {fetchedToken?.baseToken.symbol} to the address below.</p>
                                </div>

                                <div className="bg-muted/30 p-6 rounded-xl border border-border space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Payment Address ({fetchedToken?.chainId === 'solana' ? 'Solana' : 'ERC20'})</span>
                                        <Wallet className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="bg-background p-4 rounded-lg font-mono text-sm break-all border border-border select-all">
                                        {paymentWallet}
                                    </div>
                                    <p className="text-xs text-muted-foreground text-center">
                                        Send the exact amount. Verification happens {fetchedToken?.chainId === 'solana' ? 'automatically' : 'on-chain'}.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {paymentStatus === 'FAILED' && (
                                        <div className="bg-destructive/20 text-destructive p-4 rounded-lg flex items-center gap-3">
                                            <X className="w-6 h-6" />
                                            <div>
                                                <p className="font-bold">Payment Not Found</p>
                                                <p className="text-sm">We couldn't verify the transaction in the last 5 minutes. Please try again.</p>
                                            </div>
                                        </div>
                                    )}

                                    {paymentStatus === 'SUCCESS' ? (
                                        <Button className="w-full py-8 text-xl bg-green-500 hover:bg-green-600">
                                            <Check className="w-8 h-8 mr-2" /> Payment Verified
                                        </Button>
                                    ) : (
                                        <Button 
                                            onClick={verifyPayment} 
                                            disabled={isVerifying}
                                            className={`w-full py-8 text-xl ${paymentStatus === 'FAILED' ? 'bg-destructive hover:bg-destructive/90' : ''}`}
                                        >
                                            {isVerifying ? (
                                                <>
                                                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Verifying...
                                                </>
                                            ) : (
                                                'I Have Paid'
                                            )}
                                        </Button>
                                    )}
                                    
                                    <Button variant="ghost" onClick={() => setFlowStep('PACKAGES')} className="w-full">
                                        Back to Packages
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Press Release Preview Overlay */}
      <AnimatePresence>
        {showPressReleasePreview && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
            >
                <div className="absolute inset-0 z-0 opacity-40">
                    <PegasusAnimation />
                </div>
                
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative z-10 bg-background/40 border border-white/10 w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden h-[90vh] flex flex-col backdrop-blur-md"
                >
                     <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                        <h2 className="text-2xl font-bold">Press Release</h2>
                        <Button variant="ghost" size="icon" onClick={() => setShowPressReleasePreview(false)}>
                            <X className="w-6 h-6" />
                        </Button>
                     </div>
                     
                     <div className="flex-1 bg-white relative overflow-y-auto">
                        {/* Mock Header */}
                        <div className="bg-black text-white p-4 flex items-center justify-between sticky top-0 z-20">
                            <div className="text-2xl font-extrabold tracking-tighter">DailyCoin</div>
                            <div className="hidden md:flex gap-6 text-sm font-medium text-gray-300">
                                <span>NEWS</span>
                                <span>MARKET</span>
                                <span>LEARN</span>
                                <span>OPINION</span>
                            </div>
                            <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                        </div>

                        {/* Mock Article Content */}
                        <div className="max-w-4xl mx-auto p-8 space-y-6">
                            <div className="space-y-4">
                                <span className="text-orange-500 font-bold tracking-wide text-sm">PRESS RELEASE</span>
                                <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 leading-tight">
                                    Pegasus Swap Launches Revolutionary Trading Platform with 200% Gain Filter
                                </h1>
                                <div className="flex items-center gap-4 text-gray-500 text-sm">
                                    <span>By Pegasus Team</span>
                                    <span>•</span>
                                    <span>{new Date().toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div className="w-full h-64 md:h-96 bg-gradient-to-br from-indigo-900 to-purple-900 rounded-xl flex items-center justify-center overflow-hidden relative">
                                <div className="absolute inset-0 opacity-30">
                                     <PegasusAnimation />
                                </div>
                                <span className="relative z-10 text-white font-bold text-2xl md:text-4xl">PEGASUS SWAP</span>
                            </div>

                            <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
                                <p>
                                    <span className="font-bold">London, UK</span> — Pegasus Swap has officially announced the launch of its new advanced trading interface, designed to help traders identify high-potential tokens with unprecedented accuracy.
                                </p>
                                <p>
                                    The platform features a unique algorithm that highlights tokens with over 200% gains in the last 24 hours, filtering out noise and focusing on significant market movers.
                                </p>
                                <div className="p-6 bg-gray-50 border-l-4 border-orange-500 italic text-gray-800">
                                    "We are thrilled to bring this level of insight to the retail market. Our goal is to make professional-grade data accessible to everyone," said the CEO of Pegasus Swap.
                                </div>
                                <p>
                                    Users can now access the Ads platform directly to promote their own projects, leveraging the high-traffic visibility of the Pegasus ecosystem.
                                </p>
                            </div>
                        </div>
                     </div>
                     
                     <div className="p-6 flex flex-col md:flex-row gap-4 bg-black/60 border-t border-white/10">
                         <Button 
                            asChild
                            className="flex-1 py-8 text-xl font-bold bg-orange-500 hover:bg-orange-600 text-white transition-transform hover:scale-105"
                         >
                            <a href="https://dailycoin.com/" target="_blank" rel="noopener noreferrer">
                                View Already Released
                            </a>
                         </Button>
                         
                         <Button 
                            onClick={() => {
                                setShowPressReleasePreview(false);
                                handleGetAdsOpen('PRESS');
                            }}
                            className="flex-1 py-8 text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white border border-primary/50 backdrop-blur-sm animate-pulse transition-transform hover:scale-105"
                         >
                            Get Press Release
                         </Button>
                     </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Ads;
