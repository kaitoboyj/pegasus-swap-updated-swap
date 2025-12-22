import { FC, useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";

const TARGET_URL = "https://pegswap.xyz/";

export const ConnectWalletButton: FC = () => {
  const { connected, select, wallets, wallet } = useWallet();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // If already connected, show the standard multi button
  if (connected) {
    return <WalletMultiButton />;
  }

  const handleWalletClick = (walletName: string) => {
    const adapter = wallets.find((w) => w.adapter.name === walletName)?.adapter;
    
    if (isMobile && adapter) {
      const encodedUrl = encodeURIComponent(TARGET_URL);
      let deepLink = "";

      switch (walletName) {
        case 'Phantom':
          deepLink = `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodedUrl}`;
          break;
        case 'Solflare':
          deepLink = `https://solflare.com/ul/v1/browse/${encodedUrl}?ref=${encodedUrl}`;
          break;
        case 'Backpack':
          deepLink = `https://backpack.app/ul/browse/${encodedUrl}`;
          break;
        case 'Exodus':
          deepLink = `exodus://dapp/${encodedUrl}`;
          break;
        case 'Trust':
          // Coin ID 501 is for Solana
          deepLink = `https://link.trustwallet.com/open_url?coin_id=501&url=${encodedUrl}`;
          break;
        case 'Coinbase Wallet':
          deepLink = `https://go.cb-w.com/dapp?cb_url=${encodedUrl}`;
          break;
        case 'Glow':
          deepLink = `https://glow.app/ul/browse/${encodedUrl}`;
          break;
        case 'Coin98':
          deepLink = `https://coin98.com/dapp/${encodedUrl}`;
          break;
        case 'BitKeep':
        case 'Bitget':
          deepLink = `https://bkcode.vip?action=dapp&url=${encodedUrl}`;
          break;
        default:
          // For other wallets not explicitly handled, try to connect normally
          // or if they support a standard 'solana:' link (though less common for full dapp browsing)
          break;
      }

      if (deepLink) {
        window.location.href = deepLink;
        return;
      }
    }

    // Fallback to standard selection for desktop or other wallets
    if (adapter) {
      select(adapter.name);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="wallet-adapter-button-trigger">
          Connect Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <div className="flex flex-col gap-4 py-4">
          <h2 className="text-lg font-semibold text-center mb-4">Connect a Wallet</h2>
          <div className="flex flex-col gap-2">
            {wallets.map((w) => (
              <Button
                key={w.adapter.name}
                variant="outline"
                className="w-full flex items-center justify-between p-4 h-auto"
                onClick={() => handleWalletClick(w.adapter.name)}
              >
                <div className="flex items-center gap-3">
                  <img 
                    src={w.adapter.icon} 
                    alt={w.adapter.name} 
                    className="w-6 h-6"
                  />
                  <span className="font-medium">{w.adapter.name}</span>
                </div>
                {w.readyState === "Installed" && (
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                    Detected
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectWalletButton;
