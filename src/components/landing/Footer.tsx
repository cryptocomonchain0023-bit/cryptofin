import { ArrowUpRight } from 'lucide-react'

export const Footer = () => {
  return (
    <footer className="border-t border-slate-200 bg-[#FBF9F1] pt-14 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12">
        
        {/* Main Footer Links */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 sm:gap-8 pb-12 border-b border-slate-200">
          
          {/* Brand Col */}
          <div className="col-span-2 space-y-3.5">
            <img src="/landing/logo.png" alt="CRYPTOFIN" className="h-7 w-auto object-contain" />
            <p className="text-xs sm:text-sm text-slate-500 max-w-xs leading-relaxed">
              The calm web wallet for holding, swapping, and moving your digital balance with non-custodial peace of mind.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-mono text-slate-500 font-semibold">14 Chains • 100% Operational</span>
            </div>
          </div>

          {/* Col 1: Product */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
              Product
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-600 font-medium">
              <li><a href="#home" className="hover:text-black transition-colors">Web Wallet</a></li>
              <li><a href="#features" className="hover:text-black transition-colors">Multi-Chain Swaps</a></li>
              <li><a href="#features" className="hover:text-black transition-colors">MPC Staking Yields</a></li>
              <li><a href="#utility" className="hover:text-black transition-colors">dApp Connect</a></li>
            </ul>
          </div>

          {/* Col 2: Security */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
              Security
            </div>
            <ul className="space-y-2 text-sm text-slate-600 font-medium">
              <li><a href="#security-showcase" className="hover:text-black transition-colors">MPC Architecture</a></li>
              <li><a href="#security-showcase" className="hover:text-black transition-colors">CertiK & Halborn</a></li>
              <li><a href="#security-showcase" className="hover:text-black transition-colors">Passkey Enclave</a></li>
              <li><a href="#fiat-bridge" className="hover:text-black transition-colors">1:1 Reserves</a></li>
            </ul>
          </div>

          {/* Col 3: Connect */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
              Community
            </div>
            <ul className="space-y-2 text-sm text-slate-600 font-medium">
              <li>
                <a href="https://x.com" target="_blank" rel="noreferrer" className="hover:text-black transition-colors flex items-center gap-1">
                  <span>X (Twitter)</span>
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a href="https://t.me" target="_blank" rel="noreferrer" className="hover:text-black transition-colors flex items-center gap-1">
                  <span>Telegram</span>
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-black transition-colors flex items-center gap-1">
                  <span>Help & FAQ</span>
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Regulatory Disclaimers & Copyright */}
        <div className="pt-6 space-y-3 text-[11px] text-slate-400 leading-relaxed">
          <p>
            Disclaimer: CRYPTOFIN is non-custodial web wallet software. Digital asset values fluctuate and involve risk. Cryptographic key shards are generated mathematically on your hardware and never held in singular possession by CRYPTOFIN.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 text-slate-500">
            <span>© 2026 CRYPTOFIN. All rights reserved.</span>
            <div className="flex gap-4">
              <a href="#faq" className="hover:text-black">Privacy</a>
              <a href="#faq" className="hover:text-black">Terms</a>
              <a href="#faq" className="hover:text-black">Disclosures</a>
            </div>
          </div>
        </div>

      </div>
    </footer>
  )
}
