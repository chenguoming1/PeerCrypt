/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { CryptoLog } from "../types";
import { ShieldCheck, Terminal, Trash2, Database, KeyRound, Radio } from "lucide-react";

interface CryptoLogPanelProps {
  logs: CryptoLog[];
  onClear: () => void;
  fingerprint: string;
}

export function CryptoLogPanel({ logs, onClear, fingerprint }: CryptoLogPanelProps) {
  const [filter, setFilter] = useState<string>("ALL");

  const filteredLogs = logs.filter((log) => {
    if (filter === "ALL") return true;
    return log.action === filter;
  });

  return (
    <div className="flex flex-col h-full bg-[#080808] font-mono text-xs border border-[#222] rounded-none overflow-hidden shadow-[4px_4px_0px_#1a1a1a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0c0c0c] border-b border-[#222] shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[#cfff04] animate-pulse" />
          <span className="font-bold text-[#f0f0f0] uppercase tracking-wider">Cryptographic Ledger / Audits</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="p-1 text-[#555] hover:text-rose-450 transition-colors cursor-pointer"
            title="Clear Ledger"
            id="btn-clear-ledger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Safety Numbers / Fingerprint */}
      <div className="px-4 py-3 bg-[#0c0c0c] border-b border-[#222] flex flex-col md:flex-row md:items-center justify-between gap-2 text-[10px] shrink-0 uppercase tracking-wider">
        <div className="flex items-center gap-2 font-mono">
          <KeyRound size={13} className="text-[#cfff04]" />
          <span className="text-[#555] font-bold">P2P Session Fingerprint (Safety Numbers):</span>
        </div>
        <div className="bg-[#080808] px-3 py-1 text-[#cfff04] font-bold select-all border border-[#222] leading-none">
          {fingerprint || "Deriving Key..."}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 p-2 bg-[#0c0c0c] border-b border-[#222] overflow-x-auto text-[9px] uppercase tracking-widest shrink-0">
        {["ALL", "KEY_DERIVATION", "ENCRYPT", "DECRYPT", "WEBRTC", "HANDSHAKE"].map((category) => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            className={`px-2 py-0.5 rounded-none transition-all whitespace-nowrap cursor-pointer ${
              filter === category
                ? "bg-[#cfff04]/10 text-[#cfff04] border border-[#cfff04]/30"
                : "text-[#555] hover:text-[#bbb]"
            }`}
            id={`filter-ledger-${category.toLowerCase()}`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Logs Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 select-text custom-scrollbar">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#444] gap-2 uppercase tracking-widest text-[10px]">
            <ShieldCheck size={28} className="stroke-1 opacity-20" />
            <span>No security audits recorded yet.</span>
          </div>
        ) : (
          filteredLogs.map((log) => {
            let statusColor = "text-[#666]";
            let actionIcon = <Database size={10} />;

            if (log.status === "success") statusColor = "text-[#cfff04]";
            if (log.status === "error") statusColor = "text-rose-450 font-bold";
            if (log.status === "warning") statusColor = "text-amber-500";
            if (log.status === "info") statusColor = "text-[#888]";

            if (log.action === "ENCRYPT") actionIcon = <ShieldCheck size={10} className="text-[#cfff04]" />;
            if (log.action === "DECRYPT") actionIcon = <ShieldCheck size={10} className="text-[#cfff04]" />;
            if (log.action === "KEY_DERIVATION") actionIcon = <KeyRound size={10} className="text-amber-400" />;
            if (log.action === "WEBRTC" || log.action === "HANDSHAKE") actionIcon = <Radio size={10} className="text-teal-400" />;

            return (
              <div
                key={log.id}
                className="bg-[#0c0c0c] p-2.5 rounded-none border border-[#222] hover:border-[#333] transition-colors flex flex-col gap-1 leading-normal"
              >
                <div className="flex items-center justify-between text-[9px] uppercase tracking-wider font-bold">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {actionIcon}
                    <span className={statusColor}>{log.action}</span>
                  </div>
                  <span className="text-[#444] font-mono text-[9px]">{log.timestamp}</span>
                </div>
                <div className="text-[#bbb] break-all text-[10px] whitespace-pre-wrap font-mono select-all">
                  {log.details}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary Footer */}
      <div className="px-3 py-1.5 bg-[#0c0c0c] border-t border-[#222] text-[9px] text-[#555] uppercase tracking-wider font-bold flex justify-between items-center shrink-0">
        <span>Verified E2EE Sub-layer</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#cfff04] animate-pulse"></span>
          Active
        </span>
      </div>
    </div>
  );
}
