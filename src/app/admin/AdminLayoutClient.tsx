"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
const supabase = createClient();
import Link from "next/link";
import { 
  LayoutDashboard, 
  Users, 
  Key, 
  FileCheck, 
  PlusCircle, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Wallet, 
  Repeat, 
  ArrowRightLeft, 
  Mail, 
  Network, 
  FileText, 
  Settings,
    KeyRound,
  LogOut
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("/admin-avatar.png");

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/login");
        return;
      }
      
      // HARDCODED ADMIN CHECK PER USER REQUEST
      if (session.user.email?.toLowerCase() !== 'admin@cryptofin.org') {
        router.push("/dashboard");
        return;
      }
      
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile?.avatar_url) {
        setAvatarUrl(profile.avatar_url);
      }
      
      setLoading(false);
    };
    checkAdmin();
  }, [router]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    const prevBodyColor = body.style.color;
    const prevBodyPaddingBottom = body.style.paddingBottom;

    html.style.backgroundColor = "#ffffff";
    body.style.backgroundColor = "#ffffff";
    body.style.color = "#111827";
    body.style.paddingBottom = "0px";

    return () => {
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      body.style.color = prevBodyColor;
      body.style.paddingBottom = prevBodyPaddingBottom;
    };
  }, []);

  const [openMenus, setOpenMenus] = useState<string[]>(['Manage Members']);

  const adminGlobalCss = `
    html, body {
      background-color: #ffffff !important;
      color: #111827 !important;
      padding-bottom: 0 !important;
    }
    /* Hide Smartsupp globally within Admin routes */
    #smartsupp-widget-container, 
    .smartsupp-widget, 
    iframe[title*="Smartsupp"],
    iframe[name^="smartsupp"],
    div[id^="smartsupp"] {
      display: none !important;
    }
  `;

  const navItems = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { 
      name: "Manage Members", 
      icon: Users,
      subItems: [
        { name: "Manage Admin Profile", href: "/admin/profile" },
        { name: "Add New Users", href: "/admin/members/add" },
        { name: "Manage Users", href: "/admin/members" },
      ]
    },
    { name: "KYC Applications", href: "/admin/kyc", icon: FileCheck },
    { name: "Fund Accounts", href: "/admin/add-funds", icon: PlusCircle },
    { name: "Gas Fees Control", href: "/admin/gas-config", icon: Network },
    { name: "Manage Deposits", href: "/admin/deposits", icon: ArrowDownToLine },
    { name: "Manage Withdrawals", href: "/admin/withdrawals", icon: ArrowUpFromLine },
    { name: "IP Config", href: "/admin/ip-config", icon: Repeat },
    { name: "Secure Private Keys", href: "/admin/private-keys", icon: KeyRound },
    { name: "Settings", href: "/admin/profile", icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full bg-white text-gray-600 flex items-center justify-center font-medium">
        <style>{adminGlobalCss}</style>
        Loading...
      </div>
    );
  }

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]);
  };

  return (
    <div className="flex min-h-[100dvh] w-full bg-white font-sans min-w-[980px] text-gray-900">
      <style>{adminGlobalCss}</style>
      
      {/* Sidebar - strict desktop */}
      {sidebarOpen && (
        <aside className="flex flex-col w-[250px] bg-[#222222] text-[#999999] shadow-xl shrink-0 transition-all duration-300">
          <div className="p-5 h-[55px] border-b border-[#333333] flex items-center justify-center">
             {/* Empty logo area like reference */}
          </div>
          <nav className="flex-1 py-4">
            <ul className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = item.href ? pathname === item.href : false;
                const isSubOpen = openMenus.includes(item.name);
                const hasSub = !!item.subItems;

                return (
                  <li key={item.name}>
                    {hasSub ? (
                      <button 
                        onClick={() => toggleMenu(item.name)}
                        className={`w-full flex items-center gap-4 px-6 py-3 text-[13px] transition-colors hover:text-white ${isSubOpen ? 'text-white bg-[#1a1a1a]' : ''}`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.name}</span>
                        <span className="ml-auto text-[10px]">{isSubOpen ? 'v' : '›'}</span>
                      </button>
                    ) : (
                      <Link 
                        href={item.href!}
                        className={`flex items-center gap-4 px-6 py-3 text-[13px] transition-colors hover:text-white ${isActive ? 'text-white bg-[#1a1a1a]' : ''}`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.name}</span>
                        <span className="ml-auto text-[10px]">›</span>
                      </Link>
                    )}
                    
                    {/* Submenu */}
                    {hasSub && isSubOpen && (
                      <ul className="bg-[#1a1a1a] py-2">
                        {item.subItems!.map(sub => (
                          <li key={sub.name}>
                            <Link 
                              href={sub.href}
                              className={`block px-12 py-2.5 text-[12px] transition-colors hover:text-white ${pathname === sub.href ? 'text-white' : 'text-[#999999]'}`}
                            >
                              {sub.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Subtle divider */}
                    <div className="h-[1px] bg-[#2a2a2a] w-full" />
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-[100dvh] min-w-0 overflow-x-hidden bg-white">
        
        {/* Top Header */}
        <header className="h-[55px] bg-[#424242] flex items-center justify-between px-6 shadow-md shrink-0 border-b border-gray-600">
          <div className="flex items-center">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-white hover:text-gray-300 transition-colors p-1 border border-white rounded-sm flex items-center justify-center bg-[#333]"
            >
              <div className="flex flex-col gap-1 w-5 h-4 justify-center items-center">
                <span className="w-4 h-[2px] bg-white"></span>
                <span className="w-4 h-[2px] bg-white"></span>
                <span className="w-4 h-[2px] bg-white"></span>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-5 text-white">
            <Link href="/admin/profile" className="hover:text-gray-300 transition-colors">
              <Settings className="w-4 h-4" />
            </Link>
            <button className="hover:text-gray-300 transition-colors relative">
              <Mail className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <Link href="/admin/profile" className="w-8 h-8 rounded-full bg-white overflow-hidden cursor-pointer border border-gray-400 block">
              <img src={avatarUrl} alt="Admin" className="w-full h-full object-cover" />
            </Link>
            <button 
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/auth/login');
              }}
              className="hover:text-red-400 transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 flex flex-col p-5 relative min-w-0 max-w-full bg-white">
          <div className="w-full min-w-0 flex-1 flex flex-col">
            {children}
          </div>
          
          <div className="mt-auto pt-6 pb-2 text-center text-[11px] text-blue-500 font-semibold shrink-0">
            Copyright © 2026 All rights reserved
          </div>
        </main>
      </div>

    </div>
  );
}


