"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface WalletData {
  balance: number;
  economy?: {
    equilibriumBalance: number;
    todayGrant?: {
      granted: boolean;
      amount: number;
    };
    todayDecay?: {
      applied: boolean;
      decayAmount: number;
    };
  };
}

export function WalletBadge() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const res = await fetch("/api/wallets");
        if (res.ok) {
          const data = await res.json();
          setWallet(data);
        }
      } catch (error) {
        console.error("Failed to fetch wallet:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWallet();
  }, []);

  if (loading) {
    return (
      <div className="badge badge-ghost gap-1">
        <span className="loading loading-spinner loading-xs" />
      </div>
    );
  }

  if (!wallet) {
    return null;
  }

  const equilibrium = wallet.economy?.equilibriumBalance ?? 50;
  const ratio = wallet.balance / equilibrium;

  // 残高に応じた色
  let badgeClass = "badge-primary";
  if (ratio < 0.3) {
    badgeClass = "badge-error";
  } else if (ratio < 0.6) {
    badgeClass = "badge-warning";
  } else if (ratio > 1.2) {
    badgeClass = "badge-success";
  }

  return (
    <Link href="/main/settings" className="tooltip tooltip-bottom" data-tip="トークン残高">
      <div className={`badge ${badgeClass} gap-1 font-mono`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {wallet.balance}
      </div>
    </Link>
  );
}
