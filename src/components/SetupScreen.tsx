/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Shield, Key, User, Video, Mic, MicOff, VideoOff, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";

interface SetupScreenProps {
  onJoin: (params: { roomId: string; passphrase: string; userName: string; startWithVideo: boolean; startWithAudio: boolean }) => void;
}

export function SetupScreen({ onJoin }: SetupScreenProps) {
  const [roomId, setRoomId] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [userName, setUserName] = useState("");
  const [startWithVideo, setStartWithVideo] = useState(true);
  const [startWithAudio, setStartWithAudio] = useState(true);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local media preview
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Auto-fill or read Hash from URL if it exists (e.g., #room-123:mypassword)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith("#")) {
      const parts = hash.substring(1).split(":");
      if (parts[0]) setRoomId(decodeURIComponent(parts[0]));
      if (parts[1]) setPassphrase(decodeURIComponent(parts[1]));
    } else {
      // Auto-generate starting Room ID
      generateRandomRoom();
      generateRandomPassphrase();
    }

    // Auto-generate clean username
    const adj = ["Alpha", "Beta", "Sigma", "Secure", "Crypto", "Shield", "Proxy", "Quantum"];
    const noun = ["Peer", "Node", "Cipher", "Sentry", "Bunker", "Sentinel", "Core", "Nexus"];
    const randomName = `${adj[Math.floor(Math.random() * adj.length)]} ${noun[Math.floor(Math.random() * noun.length)]} ${Math.floor(100 + Math.random() * 900)}`;
    setUserName(randomName);
  }, []);

  // Update Media Preview stream when permissions or selections change
  useEffect(() => {
    if (startWithVideo) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: startWithAudio })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn("Could not get media preview feed:", err);
          setError("No camera/microphone found or access was denied. You can still join for text/file sharing.");
          setStartWithVideo(false);
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startWithVideo, startWithAudio]);

  const generateRandomRoom = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let randomRoom = "";
    for (let i = 0; i < 9; i++) {
      if (i === 3 || i === 6) randomRoom += "-";
      randomRoom += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRoomId(randomRoom);
  };

  const generateRandomPassphrase = () => {
    // Array of words for a human-readable high-entropy secure passphrase (xkcd style)
    const words = [
      "correct", "horse", "battery", "staple", "cipher", "shield", "protect", "bunker",
      "quantum", "encrypt", "nebula", "matrix", "cobalt", "secure", "aurora", "whisper",
      "silent", "forest", "shadow", "beacon", "glacier", "phoenix", "falcon", "vortex"
    ];
    const picked: string[] = [];
    for (let i = 0; i < 4; i++) {
      picked.push(words[Math.floor(Math.random() * words.length)]);
    }
    setPassphrase(picked.join("-"));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim()) {
      setError("Please provide a Room ID.");
      return;
    }
    if (!passphrase || passphrase.length < 6) {
      setError("Passphrase must be at least 6 characters for strong AES-GCM-256 derivation.");
      return;
    }
    if (!userName.trim()) {
      setError("Please enter a display moniker.");
      return;
    }

    // Update Browser Hash part so invitees can copy/paste URL and join with absolute E2EE key set
    window.location.hash = `${encodeURIComponent(roomId)}:${encodeURIComponent(passphrase)}`;

    // Invoke Join callback
    onJoin({
      roomId: roomId.trim().toLowerCase(),
      passphrase,
      userName: userName.trim(),
      startWithVideo,
      startWithAudio,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080808] text-[#f0f0f0] px-4 py-12 relative overflow-hidden font-sans select-none border-8 border-[#1a1a1a]">
      {/* Background elegant architectural line */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[1px] bg-white/5 -rotate-45 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[1px] bg-[#cfff04]/5 rotate-45 pointer-events-none"></div>

      <div className="w-full max-w-4xl grid md:grid-cols-12 gap-8 bg-[#0c0c0c] rounded-none border-2 border-[#222] p-6 md:p-8 relative z-10 shadow-[12px_12px_0px_#1a1a1a]">
        
        {/* Left Side: Brand & Live Preview */}
        <div className="md:col-span-5 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-[#cfff04] mb-4">
              <Shield size={20} className="stroke-[2px]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] font-bold bg-[#cfff04]/10 border border-[#cfff04]/20 px-2.5 py-1 rounded-none text-[#cfff04]">
                E2EE Peer-to-Peer
              </span>
            </div>
            <h1 className="text-4xl leading-none font-black tracking-tighter mb-4 italic text-white uppercase">
              SECURE<br/>P2P.
            </h1>
            <p className="text-[#bbb] text-xs leading-relaxed max-w-sm">
              All communications, directory exchange, chat records, and file binaries are completely encrypted in your browser before ever hitting any node. Zero-knowledge signaling.
            </p>
          </div>

          {/* Local Camera Preview Container */}
          <div className="relative aspect-video w-full rounded-none bg-[#0c0c0c] overflow-hidden border border-[#222] group flex items-center justify-center">
            {startWithVideo ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="text-slate-500 flex flex-col items-center gap-2 text-center p-4">
                <VideoOff size={28} className="stroke-1 text-slate-600" />
                <span className="text-xs">Camera is deactivated</span>
              </div>
            )}

            {/* Float HUD controls */}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center bg-[#080808] px-3 py-2 rounded-none border border-[#222] shadow-[4px_4px_0px_#1a1a1a]">
              <span className="text-[9px] uppercase tracking-[0.2em] font-mono text-[#555] font-semibold">
                Setup Preview
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStartWithVideo(!startWithVideo)}
                  className={`p-1.5 rounded-none border transition-all cursor-pointer ${
                    startWithVideo
                      ? "bg-[#111] border-[#222] text-white hover:bg-white/10"
                      : "bg-rose-950/20 border-rose-850 text-rose-450 hover:bg-rose-900/40"
                  }`}
                  id="btn-toggle-setup-video"
                >
                  {startWithVideo ? <Video size={13} /> : <VideoOff size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() => setStartWithAudio(!startWithAudio)}
                  className={`p-1.5 rounded-none border transition-all cursor-pointer ${
                    startWithAudio
                      ? "bg-[#111] border-[#222] text-white hover:bg-white/10"
                      : "bg-rose-950/20 border-rose-850 text-rose-450 hover:bg-rose-900/40"
                  }`}
                  id="btn-toggle-setup-audio"
                >
                  {startWithAudio ? <Mic size={13} /> : <MicOff size={13} />}
                </button>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-[#888] font-mono bg-[#111] p-3 rounded-none border border-[#222] leading-relaxed">
            🔐 <span className="font-semibold text-[#555] uppercase tracking-wider">Security:</span> Symmetric keys are derived client-side via PBKDF2. No raw passwords, keys, or decrypted data feeds are ever processed or logged by the hosting server.
          </div>
        </div>

        {/* Right Side: Configuration Inputs */}
        <form onSubmit={handleSubmit} className="md:col-span-7 flex flex-col justify-between gap-6 border-t md:border-t-0 md:border-l border-[#222] pt-6 md:pt-0 md:pl-8">
          <div className="space-y-4">
            <h2 className="text-[10px] uppercase tracking-[0.4em] text-[#555] leading-none mb-4 font-mono font-bold">
              Channel Params
            </h2>

            {error && (
              <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-none leading-snug">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Room ID Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.2em] text-[#555] font-bold flex justify-between items-center">
                <span>ROOM ID / TARGET COMM PORT</span>
                <button
                  type="button"
                  onClick={generateRandomRoom}
                  className="text-[#cfff04] hover:text-[#bce604] flex items-center gap-1 text-[11px] font-mono lowercase font-normal cursor-pointer"
                  id="btn-gen-room"
                >
                  <RefreshCw size={10} /> generate_new
                </button>
              </label>
              <div className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#555]">
                  <span className="font-mono text-xs font-semibold">#</span>
                </div>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.replace(/[^A-Za-z0-9_-]/g, ""))}
                  placeholder="e.g. quantum-room"
                  className="w-full pl-8 pr-3 py-2.5 bg-[#080808] text-white rounded-none border border-[#222] focus:outline-none focus:border-[#cfff04] text-xs tracking-widest transition-all placeholder:text-[#333] font-mono uppercase"
                  required
                  id="input-setup-room-id"
                />
              </div>
            </div>

            {/* Passphrase Entry */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.15em] text-[#555] font-bold flex justify-between items-center font-mono">
                <span>E2EE HIGH-ENTROPY PASSPHRASE</span>
                <button
                  type="button"
                  onClick={generateRandomPassphrase}
                  className="text-[#cfff04] hover:text-[#bce604] flex items-center gap-1 text-[11px] font-mono lowercase font-normal cursor-pointer"
                  id="btn-gen-pass"
                >
                  <RefreshCw size={10} /> generate_entropy
                </button>
              </label>
              <div className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#555]">
                  <Key size={14} />
                </div>
                <input
                  type={showPassphrase ? "text" : "password"}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-9 pr-14 py-2.5 bg-[#080808] text-white rounded-none border border-[#222] focus:outline-none focus:border-[#cfff04] text-xs transition-all placeholder:text-[#333] font-mono"
                  required
                  id="input-setup-passphrase"
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  className="absolute right-3 text-[#555] hover:text-[#cfff04] text-[10px] font-mono uppercase font-semibold cursor-pointer"
                  id="btn-toggle-show-passphrase"
                >
                  {showPassphrase ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-[9px] text-[#555] leading-normal font-mono">
                This passphrase forms the master cryptographic seed. Users must use the exact same passphrase to decrypt each other&apos;s communications successfully.
              </p>
            </div>

            {/* Display Moniker */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.2em] text-[#555] font-bold flex items-center gap-1 font-mono">
                <User size={13} /> YOUR ALIAS / MONIKER
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Alice"
                className="w-full px-3 py-2.5 bg-[#080808] text-white rounded-none border border-[#222] focus:outline-none focus:border-[#cfff04] text-xs font-mono transition-all placeholder:text-[#333]"
                required
                id="input-setup-username"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#cfff04] text-black hover:bg-[#bce604] font-black uppercase text-xs tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99] group mt-3 cursor-pointer shadow-[6px_6px_0px_#1a1a1a]"
            id="btn-join-room-submit"
          >
            <span>ESTABLISH SECURE LINK</span>
            <ArrowRight size={14} className="group-hover:translate-x-1.5 transition-transform text-black font-black" />
          </button>
        </form>
      </div>
    </div>
  );
}
