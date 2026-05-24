/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, Peer, CryptoLog } from "../types";
import { CryptoLogPanel } from "./CryptoLogPanel";
import { 
  ShieldCheck, Video, VideoOff, Mic, MicOff, Send, FileText, 
  X, Lock, Users, Copy, Check, FolderUp, MessageSquare, 
  PhoneOff, Terminal, Sparkles, ShieldAlert 
} from "lucide-react";

interface MainCallScreenProps {
  roomId: string;
  userName: string;
  passphrase: string;
  fingerprint: string;
  peers: Peer[];
  messages: ChatMessage[];
  logs: CryptoLog[];
  localStream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onSendMessage: (text: string) => void;
  onSendFile: (file: File) => void;
  onLeave: () => void;
  onClearLogs: () => void;
}

export function MainCallScreen({
  roomId,
  userName,
  passphrase,
  fingerprint,
  peers,
  messages,
  logs,
  localStream,
  videoEnabled,
  audioEnabled,
  onToggleVideo,
  onToggleAudio,
  onSendMessage,
  onSendFile,
  onLeave,
  onClearLogs,
}: MainCallScreenProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "logs">("chat");
  const [inputText, setInputText] = useState("");
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<{ [peerId: string]: HTMLVideoElement | null }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bind local stream to video tag
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Bind remote peer streams to video tags
  useEffect(() => {
    peers.forEach((peer) => {
      const ref = remoteVideoRefs.current[peer.id];
      if (ref) {
        if (peer.stream) {
          ref.srcObject = peer.stream;
        } else {
          ref.srcObject = null;
        }
      }
    });
  }, [peers]);

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}${window.location.pathname}#${encodeURIComponent(roomId)}:${encodeURIComponent(passphrase)}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  // Drag and Drop files
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onSendFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onSendFile(e.target.files[0]);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Connected remote peer counting
  const connectedPeers = peers.filter(p => p.connectionState === "connected");

  return (
    <div className="min-h-screen bg-[#080808] text-[#f0f0f0] flex flex-col font-sans select-none overflow-hidden h-screen border-8 border-[#1a1a1a]">
      
      {/* Upper Navigation HUD */}
      <header className="bg-[#0c0c0c] border-b border-[#222] px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-4 z-20 shrink-0 font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#cfff04]/15 border border-[#cfff04]/30 text-[#cfff04] font-mono text-[10px] rounded-none uppercase tracking-widest font-bold">
            <Lock size={11} className="stroke-[2.5px]" />
            <span>Encrypted Node Link</span>
          </div>
          <div className="h-4 w-px bg-[#222] hidden sm:block"></div>
          <div className="text-[10px] text-[#555] font-mono hidden sm:block uppercase tracking-wider">
            Room: <span className="text-[#cfff04] font-bold">#{roomId}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Invite Code button */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111] hover:bg-[#161616] active:bg-[#111] text-[#f0f0f0] rounded-none text-[10px] uppercase font-mono tracking-wider transition-all border border-[#222] shadow-[3px_3px_0px_#1a1a1a] cursor-pointer"
            id="btn-copy-invite"
          >
            {copied ? (
              <>
                <Check size={11} className="text-[#cfff04] font-bold" />
                <span className="text-[#cfff04] font-bold">LINK COPIED!</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>COPY SECURE INVITE</span>
              </>
            )}
          </button>

          <button
            onClick={onLeave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/20 hover:bg-rose-900/30 text-rose-350 rounded-none text-[10px] uppercase font-mono tracking-wider transition-all border border-rose-800/20 cursor-pointer shadow-[3px_3px_0px_#1a1a1a]"
            id="btn-leave-call"
          >
            <PhoneOff size={11} />
            <span>TERMINATE</span>
          </button>
        </div>
      </header>

      {/* Main Container Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* Left Aspect Side: Active Peer Feeds & Video Stage */}
        <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden relative bg-[#080808]">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-center relative rounded-none bg-[#0c0c0c] border border-[#222] p-4">
            
            {/* Remote Feed Aspect */}
            {peers.length === 0 ? (
              <div className="col-span-1 md:col-span-2 h-full flex flex-col items-center justify-center p-8 text-center bg-[#0c0c0c] rounded-none border border-dashed border-[#222] relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-[1px] bg-[#cfff04]/5 rotate-12"></div>
                
                <div className="w-16 h-16 rounded-none bg-[#080808] border border-[#222] flex items-center justify-center mb-4 relative shadow-[4px_4px_0px_#1a1a1a]">
                  <Lock size={24} className="text-[#cfff04]" />
                </div>
                <h3 className="font-bold text-lg text-white uppercase tracking-wider font-mono">AWAITING Peer...</h3>
                <p className="text-[11px] text-[#888] max-w-sm mt-2 leading-relaxed font-mono uppercase tracking-wider">
                  SHARE THE E2EE INVITE LINK WITH ANOTHER NODE. ONCE THEY OPEN IT AND INPUT THE EXACT SAME PASSPHRASE, A DIRECT PEER-TO-PEER WEBRTC LINK WILL FORM INSTANTLY.
                </p>
                
                {/* Visual fingerprint matching check */}
                <div className="mt-6 bg-[#080808] border border-[#222] px-4 py-2.5 rounded-none flex items-center gap-2 shadow-[4px_4px_0px_#1a1a1a]">
                  <Terminal size={12} className="text-[#cfff04]" />
                  <span className="text-[10px] font-mono text-[#888]">
                    Local Key Fingerprint: <span className="text-[#cfff04] font-bold">{fingerprint}</span>
                  </span>
                </div>
              </div>
            ) : (
              peers.map((peer) => (
                <div 
                  key={peer.id} 
                  className={`relative aspect-video w-full h-full max-h-[75vh] rounded-none bg-[#0c0c0c] overflow-hidden border ${
                    peer.connectionState === "connected" ? "border-[#cfff04]/40 shadow-[6px_6px_0px_#1a1a1a]" : "border-[#222]"
                  } flex items-center justify-center group`}
                >
                  {peer.stream ? (
                    <video
                      ref={(el) => { remoteVideoRefs.current[peer.id] = el; }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-slate-500 flex flex-col items-center gap-2 p-4 text-center">
                      <div className="w-12 h-12 rounded-none bg-[#080808] border border-[#222] flex items-center justify-center text-[#cfff04] font-bold uppercase text-sm font-mono shadow-[3px_3px_0px_#1a1a1a]">
                        {peer.name.charAt(0)}
                      </div>
                      <span className="text-xs font-bold font-mono uppercase text-[#bbb] mt-2">{peer.name}</span>
                      <span className="text-[9px] font-mono uppercase bg-[#080808] px-2 py-1 rounded-none border border-[#222] text-amber-400 mt-1">
                        {peer.connectionState === "connecting" ? "Establishing P2P..." : "No video feed"}
                      </span>
                    </div>
                  )}

                  {/* Peer metadata tag overlay */}
                  <div className="absolute top-3 left-3 bg-[#080808] border border-[#222] px-2.5 py-1 rounded-none flex items-center gap-1.5 backdrop-blur text-[10px] font-bold text-white font-mono uppercase tracking-wider shadow-[2px_2px_0px_#1a1a1a]">
                    <span className={`w-1.5 h-1.5 rounded-full ${peer.connectionState === "connected" ? "bg-[#cfff04]" : "bg-amber-400"}`} />
                    <span>{peer.name}</span>
                    <span className="text-[8px] font-mono text-[#555] bg-[#0c0c0c] border border-[#222] px-1 py-0.2 rounded shrink-0">
                      P2P
                    </span>
                  </div>
                </div>
              ))
            )}

            {/* Float HUD: Local Micro Self stream inside video stage frame */}
            {localStream && (
              <div className="absolute bottom-6 right-6 w-32 md:w-44 aspect-video rounded-none bg-[#080808] border-2 border-[#222] overflow-hidden shadow-[6px_6px_0px_#1a1a1a] z-10 hover:scale-105 transition-all">
                {videoEnabled ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#080808] text-[#555] gap-1 p-2 text-center text-[10px] font-mono uppercase">
                    <VideoOff size={14} />
                    <span>Video off</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-[#080808]/90 border border-[#222] px-1.5 py-0.5 rounded-none text-[8px] text-[#cfff04] font-mono font-bold uppercase tracking-wider">
                  Me ({userName.split(" ")[0]})
                </div>
              </div>
            )}
          </div>

          {/* Interactive media control docks */}
          <div className="mt-4 flex justify-center items-center gap-3 shrink-0">
            <button
              onClick={onToggleVideo}
              className={`p-3 rounded-none border transition-all cursor-pointer ${
                videoEnabled
                  ? "bg-[#0c0c0c] border-[#222] text-white hover:bg-white/10"
                  : "bg-rose-950/20 border-rose-800/40 text-rose-450 hover:bg-rose-900/40"
              }`}
              title={videoEnabled ? "Mute Camera Video" : "Activate Camera"}
              id="btn-toggle-video"
            >
              {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
            <button
              onClick={onToggleAudio}
              className={`p-3 rounded-none border transition-all cursor-pointer ${
                audioEnabled
                  ? "bg-[#0c0c0c] border-[#222] text-white hover:bg-white/10"
                  : "bg-rose-950/20 border-rose-800/40 text-rose-450 hover:bg-rose-900/40"
              }`}
              title={audioEnabled ? "Mute Audio Mic" : "Unmute Audio Mic"}
              id="btn-toggle-audio"
            >
              {audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
          </div>
        </main>

        {/* Right Aspect Panel: Chats & Audits Sidepanel */}
        <aside className="w-full lg:w-[440px] border-t lg:border-t-0 lg:border-l border-[#222] bg-[#0c0c0c] flex flex-col overflow-hidden shrink-0 h-[45vh] lg:h-full">
          {/* Tab Selection */}
          <div className="flex bg-[#0c0c0c] border-b border-[#222] p-1 shrink-0 font-mono">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] uppercase tracking-wider font-bold rounded-none transition-all border-none outline-none cursor-pointer ${
                activeTab === "chat"
                  ? "bg-[#111] text-[#cfff04] border-b-2 border-[#cfff04]"
                  : "text-[#555] hover:text-[#bbb]"
              }`}
              id="tab-select-chat"
            >
              <MessageSquare size={13} />
              <span>Encrypted Chat &amp; Files</span>
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] uppercase tracking-wider font-bold rounded-none transition-all border-none outline-none cursor-pointer ${
                activeTab === "logs"
                  ? "bg-[#111] text-[#cfff04] border-b-2 border-[#cfff04]"
                  : "text-[#555] hover:text-[#bbb]"
              }`}
              id="tab-select-logs"
            >
              <Terminal size={13} />
              <span>Cryptographic Logs</span>
              {logs.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#cfff04] animate-pulse inline-block" />
              )}
            </button>
          </div>

          {/* Active Tab Container */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            
            {activeTab === "chat" ? (
              <div 
                className={`flex-grow flex flex-col h-full overflow-hidden transition-all ${
                  dragActive ? "border-2 border-dashed border-[#cfff04]/30 bg-[#cfff04]/5" : ""
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                
                {/* Scroll chat area */}
                <div className="flex-grow overflow-y-auto p-4 space-y-3.5 custom-scrollbar min-h-0 bg-[#080808]/40">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2 p-6 text-center">
                      <Sparkles size={24} className="stroke-1 text-[#444]" />
                      <p className="text-xs font-mono uppercase tracking-wider text-[#555]">Secure channel active.</p>
                      <p className="text-[10px] text-[#444] font-mono leading-relaxed max-w-[240px]">
                        Say hello or drop any physical file into this tab to perform a secure AES-GCM P2P exchange!
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`flex flex-col ${msg.isIncoming ? "items-start" : "items-end"} gap-1`}
                      >
                        {/* Header metadata */}
                        <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#555] px-1 uppercase tracking-wider">
                          <span className="font-bold text-[#888]">{msg.senderName}</span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </div>

                        {/* Encrypted Envelope view */}
                        <div className="max-w-[85%] group relative">
                          {msg.type === "text" ? (
                            <div 
                              className={`px-3.5 py-2 rounded-none text-xs leading-normal relative font-mono ${
                                msg.isIncoming 
                                  ? "bg-[#111] text-[#f0f0f0] border border-[#222]" 
                                  : "bg-[#cfff04] text-black font-bold"
                              }`}
                            >
                              {msg.decryptionFailed ? (
                                <div className="flex items-center gap-1.5 text-rose-400 font-mono">
                                  <ShieldAlert size={12} className="shrink-0" />
                                  <span>Decryption Failure: Password mismatch</span>
                                </div>
                              ) : (
                                <span>{msg.text}</span>
                              )}
                            </div>
                          ) : (
                            /* File attachment bubble template */
                            <div 
                              className={`p-3 rounded-none flex flex-col gap-2 ${
                                msg.isIncoming 
                                  ? "bg-[#111] text-[#f0f0f0] border border-[#222]" 
                                  : "bg-[#111] text-[#f0f0f0] border border-[#cfff04]/35"
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <div className="w-8 h-8 rounded-none bg-[#080808] border border-[#222] flex items-center justify-center shrink-0">
                                  <FileText size={16} className="text-[#cfff04]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-bold font-mono truncate text-[#f0f0f0] break-all leading-snug">
                                    {msg.fileName}
                                  </h4>
                                  <span className="text-[10px] font-mono text-[#555] select-none">
                                    {formatSize(msg.fileSize)}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Decrypted Download Button */}
                              {msg.fileDataUrl ? (
                                <a 
                                  href={msg.fileDataUrl}
                                  download={msg.fileName}
                                  className="w-full text-center py-1.5 bg-[#cfff04] hover:bg-[#bce604] text-black hover:scale-[1.01] rounded-none text-[9px] font-black uppercase tracking-wider inline-flex items-center justify-center gap-1 transition-all shadow-[2px_2px_0px_#1a1a1a]"
                                  id={`btn-download-file-${msg.id}`}
                                >
                                  🔐 DOWNLOAD FILE
                                </a>
                              ) : (
                                <span className="text-[9px] font-mono text-center text-[#555] italic block py-1 border border-dashed border-[#222] bg-[#080808]/40">
                                  Decrypting stream payload...
                                </span>
                              )}
                            </div>
                          )}

                          {/* Hover ciphertext helper info */}
                          <div className="absolute top-full text-[9px] font-mono text-[#444] group-hover:block hidden pt-1 z-10 whitespace-nowrap overflow-hidden max-w-[200px] bg-[#0c0c0c] border border-[#222] p-1.5 mt-0.5 leading-normal shadow-[4px_4px_0px_#1a1a1a]">
                            <div>CIPHERTEXT: <span className="text-[#cfff04]/85">{msg.encryptedPayload.ciphertext.substring(0, 16)}...</span></div>
                            <div>IV: <span className="text-blue-400">{msg.encryptedPayload.iv.substring(0, 10)}...</span></div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Dropzone overlay */}
                {dragActive && (
                  <div className="absolute inset-0 z-10 bg-[#080808]/95 flex flex-col items-center justify-center text-[#cfff04] gap-2 border border-dashed border-[#cfff04]/30 rounded-none m-4 pointer-events-none font-mono">
                    <FolderUp size={36} className="animate-bounce text-[#cfff04]" />
                    <span className="font-black text-xs uppercase tracking-widest">DRAG DROP TO SECURE CHANNELS</span>
                    <span className="text-[9px] text-[#555]">File is processed client-side via AES-GCM-256</span>
                  </div>
                )}

                {/* Footer Send Input */}
                <div className="p-4 bg-[#0c0c0c] border-t border-[#222] shrink-0 font-sans">
                  <form onSubmit={handleSend} className="flex gap-2 items-center">
                    {/* Add local physical file prompt */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 bg-[#111] hover:bg-white/5 text-[#555] hover:text-[#cfff04] border border-[#222] rounded-none transition-all cursor-pointer shrink-0"
                      title="Attach Encrypted File"
                      id="btn-click-attach-file"
                    >
                      <FolderUp size={15} />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      id="input-physical-file"
                    />

                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="MESSAGE PAYLOAD..."
                      className="flex-1 bg-[#080808] text-white border border-[#222] focus:outline-none focus:border-[#cfff04] px-3.5 py-2.5 rounded-none text-xs transition-colors font-mono uppercase tracking-widest placeholder:text-[#333]"
                      id="input-chat-message"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className="p-2.5 bg-[#cfff04] disabled:bg-[#111] text-black disabled:text-[#333] rounded-none transition-all enabled:hover:scale-105 enabled:active:scale-95 cursor-pointer shrink-0"
                      id="btn-send-message"
                    >
                      <Send size={15} className="stroke-[2.5px]" />
                    </button>
                  </form>
                </div>

              </div>
            ) : (
              <div className="flex-grow h-full overflow-hidden p-4 bg-[#080808]/30">
                <CryptoLogPanel 
                  logs={logs} 
                  onClear={onClearLogs} 
                  fingerprint={fingerprint} 
                />
              </div>
            )}

          </div>
        </aside>

      </div>
    </div>
  );
}
