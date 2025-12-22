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
      if (walletName === 'Phantom') {
        const deepLink = `https://phantom.app/ul/browse/${encodeURIComponent(TARGET_URL)}?ref=${encodeURIComponent(TARGET_URL)}`;
        window.location.href = deepLink;
        return;
      }
      
      if (walletName === 'Solflare') {
        const deepLink = `https://solflare.com/ul/v1/browse/${encodeURIComponent(TARGET_URL)}?ref=${encodeURIComponent(TARGET_URL)}`;
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
