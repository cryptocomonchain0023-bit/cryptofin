"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  titleTop: string;
  titleMain: React.ReactNode;
  subtitle: string;
  imageSrc: string;
}

export function AuthPageWrapper({ children, titleTop, titleMain, subtitle, imageSrc }: AuthLayoutProps) {
  const router = useRouter();
  
  // Interactive background logic
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerHeight > 0) {
        setMousePos({
          x: e.clientX / window.innerWidth,
          y: e.clientY / window.innerHeight
        });
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-[#FBF9F1] text-[#111111] flex flex-col font-sans relative overflow-hidden">
      {/* Interactive geometric background */}
      <div 
        className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-gradient-to-br from-[#D4FF00]/10 to-[#0052FF]/5 blur-[120px] pointer-events-none transition-transform duration-1000 ease-out"
        style={{ transform: `translate(${mousePos.x * -40}px, ${mousePos.y * -40}px)` }}
      />
      <div 
        className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#0052FF]/5 to-transparent blur-[100px] pointer-events-none transition-transform duration-1000 ease-out"
        style={{ transform: `translate(${mousePos.x * 40}px, ${mousePos.y * 40}px)` }}
      />
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[url('/landing/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20 pointer-events-none" />

      {/* Header */}
      <header className="w-full p-6 lg:px-12 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-6">
          <button 
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push('/');
              }
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:text-[#111111] hover:border-[#111111] transition-all shadow-sm active:scale-95 cursor-pointer"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center">
            <img src="/landing/logo.png" alt="CRYPTOFIN" className="h-6 sm:h-8 object-contain" />
          </Link>
        </div>
      </header>

      {/* Main Content Split */}
      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-center p-6 lg:px-12 gap-12 lg:gap-24 z-10 relative pb-20">
        
        {/* Left Side: Copy & Hero Image */}
        <div className="w-full lg:w-1/2 flex flex-col items-start max-w-lg">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0052FF]" />
            <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">{titleTop}</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-[70px] font-black leading-[0.95] tracking-tighter text-[#111111] mb-6 drop-shadow-sm">
            {titleMain}
          </h1>
          
          <p className="text-slate-500 font-medium text-sm sm:text-base mb-12 max-w-sm leading-relaxed">
            {subtitle}
          </p>

          <div className="w-full flex justify-center lg:justify-start">
            <img src={imageSrc} alt="Hero illustration" className="w-[80%] max-w-[320px] object-contain drop-shadow-2xl transition-transform duration-700 hover:scale-105" />
          </div>
        </div>

        {/* Right Side: Form Card */}
        <div className="w-full lg:w-1/2 flex justify-center lg:justify-end">
          <div className="w-full max-w-[480px]">
            {children}
          </div>
        </div>

      </main>
    </div>
  );
}
