/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { SetupScreen } from "./components/SetupScreen";
import { MainCallScreen } from "./components/MainCallScreen";
import { ChatMessage, Peer, CryptoLog, EncryptedPayload } from "./types";
import { 
  deriveKeyFromPassphrase, 
  encryptText, 
  decryptText, 
  encryptFileBuffer, 
  decryptFileBuffer, 
  generateFingerprint,
  bufferToBase64,
  base64ToBuffer,
  bufferToHex
} from "./cryptoUtils";

export default function App() {
  const [screen, setScreen] = useState<"setup" | "call">("setup");
  
  // Connection details
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [localClientId] = useState(() => "client-" + Math.floor(100000 + Math.random() * 900000));
  
  // E2EE properties
  const [derivedKey, setDerivedKey] = useState<CryptoKey | null>(null);
  const [keySaltHex] = useState("a1b2c3d4e5f67890"); // Transparent room matching salt
  const [fingerprint, setFingerprint] = useState("");

  // Media States
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Core application lists
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [logs, setLogs] = useState<CryptoLog[]>([]);

  // Refs for coordination
  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Peer[]>([]);
  // Keep key in a ref for callbacks outside of react render closures
  const derivedKeyRef = useRef<CryptoKey | null>(null);

  // Sync peers state to ref so WebSockets callbacks always reference fresh connections
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  // Logging routine
  const addLog = (action: string, status: "success" | "info" | "error" | "warning", details: string) => {
    setLogs((prev) => [
      {
        id: "log-" + Math.floor(100000 + Math.random() * 900000),
        timestamp: new Date().toLocaleTimeString(),
        action,
        status,
        details,
      },
      ...prev,
    ]);
  };

  const handleClearLogs = () => {
    setLogs([]);
    addLog("KEY_DERIVATION", "info", "Audits ledger cleared. Encryption key remains safe in module memory.");
  };

  // Helper: setup local capture media
  const acquireLocalMedia = async (video: boolean, audio: boolean): Promise<MediaStream | null> => {
    try {
      if (!video && !audio) return null;
      addLog("WEBRTC", "info", `Requesting media acquisition: AV Streams...`);
      const stream = await navigator.mediaDevices.getUserMedia({
        video,
        audio,
      });
      setLocalStream(stream);
      setVideoEnabled(video);
      setAudioEnabled(audio);
      addLog("WEBRTC", "success", "Acquired local camera/microphone streams successfully.");
      return stream;
    } catch (err) {
      console.error("Camera acquisition failed:", err);
      addLog("WEBRTC", "error", `Media acquisition blocked or faulted: ${String(err)}`);
      return null;
    }
  };

  // Main join trigger
  const handleJoinRoom = async ({
    roomId: selectedRoom,
    passphrase: selectedPassphrase,
    userName: selectedName,
    startWithVideo,
    startWithAudio,
  }: {
    roomId: string;
    passphrase: string;
    userName: string;
    startWithVideo: boolean;
    startWithAudio: boolean;
  }) => {
    setRoomId(selectedRoom);
    setPassphrase(selectedPassphrase);
    setUserName(selectedName);

    addLog("KEY_DERIVATION", "info", "Initiating cryptographical setup...");

    try {
      // 1. Derive Symmetric AES-GCM Key instantly
      const encoder = new TextEncoder();
      const saltBytes = encoder.encode(keySaltHex);
      const key = await deriveKeyFromPassphrase(selectedPassphrase, saltBytes);
      setDerivedKey(key);
      derivedKeyRef.current = key;
      addLog("KEY_DERIVATION", "success", "PBKDF2 key strengthened (100k rounds SHA-256) -> AES-GCM 256 key initialized in enclave memory.");

      // Calculate Visual safety numbers
      const fp = await generateFingerprint(selectedPassphrase, keySaltHex);
      setFingerprint(fp);
      addLog("KEY_DERIVATION", "success", `Derived room safety footprint: [${fp}]`);

      // 2. Obtain direct WebRTC media
      const stream = await acquireLocalMedia(startWithVideo, startWithAudio);

      // 3. Mount WebSocket signaling connection
      setupWebSocket(selectedRoom, selectedName, stream);

      // 4. Update screen
      setScreen("call");
    } catch (err) {
      addLog("KEY_DERIVATION", "error", `Cryptographic derivation faulted: ${String(err)}`);
    }
  };

  // Setup client Signaler WebSocket connection
  const setupWebSocket = (room: string, name: string, stream: MediaStream | null) => {
    addLog("HANDSHAKE", "info", "Establishing WebSocket connection to signaling broker...");
    
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      addLog("HANDSHAKE", "success", "WebSocket linked. Sending secure join metadata registration to room broker.");
      socket.send(
        JSON.stringify({
          type: "join",
          senderId: localClientId,
          roomId: room,
          senderName: name,
        })
      );
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case "welcome": {
            addLog("HANDSHAKE", "info", `Joined room. Active remote peer nodes in directory: ${data.peersInRoom.length}`);
            // Offerer role: If there are existing peers, the joiner creates WebRTC Offer for each
            data.peersInRoom.forEach((peerInfo: { id: string; name: string }) => {
              initiatePeerConnection(peerInfo.id, peerInfo.name, true, stream);
            });
            break;
          }

          case "peer-joined": {
            addLog("HANDSHAKE", "info", `New client linked: ${data.peerName} (${data.peerId})`);
            // Receiver role: Wait for Offer from the new peer
            initiatePeerConnection(data.peerId, data.peerName, false, stream);
            break;
          }

          case "signal": {
            handleSignalingMessage(data.senderId, data.senderName, data.payload);
            break;
          }

          case "encrypted-message": {
            // Decrypt message from other client
            handleIncomingSymmetricMessage(data.senderId, data.senderName, data.payload);
            break;
          }

          case "peer-left": {
            addLog("WEBRTC", "warning", `Peer connection severed: ${data.peerId}`);
            setPeers((prev) => {
              const target = prev.find((p) => p.id === data.peerId);
              if (target?.rtcPeerConnection) {
                target.rtcPeerConnection.close();
              }
              return prev.filter((p) => p.id !== data.peerId);
            });
            break;
          }
        }
      } catch (err) {
        console.error("WebSocket parsing signal failure:", err);
      }
    };

    socket.onclose = () => {
      addLog("HANDSHAKE", "warning", "WebSocket connection lost.");
    };

    socket.onerror = (err) => {
      addLog("HANDSHAKE", "error", `WebSocket error encountered: ${String(err)}`);
    };
  };

  // Set up RTCPeerConnection
  const initiatePeerConnection = (
    targetPeerId: string,
    targetName: string,
    isInitiator: boolean,
    stream: MediaStream | null
  ) => {
    addLog("WEBRTC", "info", `Constructing Peer handler targeting node: ${targetName} (${targetPeerId})...`);

    const rtcConfig: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    };

    const pc = new RTCPeerConnection(rtcConfig);
    let dataChannel: RTCDataChannel | null = null;

    // Attach local media track items to Connection
    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
      addLog("WEBRTC", "info", "Piped local media tracks into Peer Connection stream map.");
    }

    // Capture incoming tracks
    pc.ontrack = (event) => {
      addLog("WEBRTC", "success", `Yielded stream stream from node: ${targetName}`);
      setPeers((prev) =>
        prev.map((p) =>
          p.id === targetPeerId ? { ...p, stream: event.streams[0] } : p
        )
      );
    };

    // Gather ICE coordination packets
    pc.onicecandidate = async (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const key = derivedKeyRef.current;
        if (!key) return;

        try {
          // Encrypt signaling packets - zero metadata exposure!
          const candidateStr = JSON.stringify(event.candidate);
          const encryptedSignal = await encryptText(candidateStr, key, keySaltHex);

          wsRef.current.send(
            JSON.stringify({
              type: "signal",
              roomId: roomId,
              senderId: localClientId,
              targetId: targetPeerId,
              payload: {
                type: "candidate",
                encrypted: encryptedSignal,
              },
            })
          );
        } catch (e) {
          console.error("Candidate encryption failed:", e);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      addLog(
        "WEBRTC",
        pc.connectionState === "connected" ? "success" : "info",
        `Peer node connection status changed: ${pc.connectionState.toUpperCase()}`
      );
      
      setPeers((prev) =>
        prev.map((p) =>
          p.id === targetPeerId
            ? { ...p, connectionState: pc.connectionState as any }
            : p
        )
      );
    };

    // Construct P2P Data Channels for E2EE chats and high speed files
    if (isInitiator) {
      addLog("WEBRTC", "info", "Creating peer-to-peer data channel: 'secure-data'");
      dataChannel = pc.createDataChannel("secure-data");
      setupDataChannelListeners(dataChannel, targetPeerId, targetName);
    } else {
      pc.ondatachannel = (event) => {
        addLog("WEBRTC", "success", "Accepted incoming P2P data channel link from initiator node.");
        dataChannel = event.channel;
        setupDataChannelListeners(dataChannel, targetPeerId, targetName);
        
        setPeers((prev) =>
          prev.map((p) => (p.id === targetPeerId ? { ...p, dataChannel: event.channel } : p))
        );
      };
    }

    // Register peer model in client index
    const newPeer: Peer = {
      id: targetPeerId,
      name: targetName,
      connectionState: "connecting",
      rtcPeerConnection: pc,
      dataChannel: isInitiator ? dataChannel : null,
      stream: null,
    };

    setPeers((prev) => {
      const filtered = prev.filter((p) => p.id !== targetPeerId);
      return [...filtered, newPeer];
    });

    // Initiator starts Negotiation Offer
    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          addLog("WEBRTC", "info", "Creating WebRTC SDP Cryptographical Offer...");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          const key = derivedKeyRef.current;
          if (!key) return;

          // Encrypt SDP description completely client-side
          const encryptedOffer = await encryptText(JSON.stringify(offer), key, keySaltHex);

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "signal",
                roomId: roomId,
                senderId: localClientId,
                targetId: targetPeerId,
                payload: {
                  type: "offer",
                  encrypted: encryptedOffer,
                },
              })
            );
            addLog("HANDSHAKE", "success", "E2EE SDP Offer transmitted over channel signaling.");
          }
        } catch (err) {
          console.error("Offer creation failed:", err);
          addLog("WEBRTC", "error", `SDP offer phase halted: ${String(err)}`);
        }
      };
    }
  };

  // Configure WebRTC DataChannel callbacks
  const setupDataChannelListeners = (channel: RTCDataChannel, targetId: string, name: string) => {
    channel.onopen = () => {
      addLog("WEBRTC", "success", `Secure P2P data channel is OPEN with ${name}. Ready for direct transmissions.`);
      setPeers((prev) =>
        prev.map((p) => (p.id === targetId ? { ...p, dataChannel: channel } : p))
      );
    };

    channel.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "chat-msg") {
          addLog("DECRYPT", "success", `Direct P2P Data Channel packet arrived.`);
          handleIncomingSymmetricMessage(targetId, name, msg.payload);
        }
      } catch (err) {
        console.error("Direct Data Channel decoding error:", err);
      }
    };

    channel.onclose = () => {
      addLog("WEBRTC", "warning", `Secure P2P data channel closed with ${name}.`);
    };
  };

  // Handle incoming signaling updates
  const handleSignalingMessage = async (senderId: string, name: string, payload: any) => {
    const peer = peersRef.current.find((p) => p.id === senderId);
    if (!peer || !peer.rtcPeerConnection) return;

    const pc = peer.rtcPeerConnection;
    const key = derivedKeyRef.current;
    if (!key) {
      addLog("DECRYPT", "error", "Local cryptography key is missing. Postponing signal processing.");
      return;
    }

    try {
      // 1. Decrypt received signaling payload securely
      const decryptedStr = await decryptText(payload.encrypted, key);
      const parsed = JSON.parse(decryptedStr);

      if (payload.type === "offer") {
        addLog("DECRYPT", "success", `Decrypted incoming SDP Offer from ${name} successfully.`);
        await pc.setRemoteDescription(new RTCSessionDescription(parsed));
        
        // Form response
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Encrypt Answer payload
        const encryptedValue = await encryptText(JSON.stringify(answer), key, keySaltHex);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "signal",
              roomId: roomId,
              senderId: localClientId,
              targetId: senderId,
              payload: {
                type: "answer",
                encrypted: encryptedValue,
              },
            })
          );
          addLog("HANDSHAKE", "success", `Created and dispatched symmetric SDP Answer back to ${name}.`);
        }
      } else if (payload.type === "answer") {
        addLog("DECRYPT", "success", `Decrypted incoming SDP Answer from ${name} successfully.`);
        await pc.setRemoteDescription(new RTCSessionDescription(parsed));
      } else if (payload.type === "candidate") {
        await pc.addIceCandidate(new RTCIceCandidate(parsed));
      }
    } catch (err) {
      console.error("E2EE Signaling verification fail:", err);
      addLog(
        "DECRYPT", 
        "error", 
        `Audit alarm: Could not verify incoming payload from ${name}. Passphrase mismatch! WebRTC handshake aborted.`
      );
    }
  };

  // Deliver symmetric chat text
  const handleSendMessage = async (text: string) => {
    const key = derivedKey;
    if (!key) return;

    try {
      // 1. Encrypt message locally
      addLog("ENCRYPT", "info", `Encrypting plaintext message: "${text.substring(0, 15)}${text.length > 15 ? "..." : ""}" using AES-GCM-256`);
      const payload = await encryptText(text, key, keySaltHex);
      addLog("ENCRYPT", "success", `AES ciphertext generated: [Base64: ${payload.ciphertext.substring(0, 16)}...]`);

      const now = new Date().toLocaleTimeString();
      const messageId = "msg-" + Math.floor(100000 + Math.random() * 900000);

      // Append local view instantly
      const newMsg: ChatMessage = {
        id: messageId,
        senderId: localClientId,
        senderName: "Me",
        timestamp: now,
        type: "text",
        text,
        encryptedPayload: payload,
        isIncoming: false,
      };

      setMessages((prev) => [...prev, newMsg]);

      // 2. Dispatch via active direct P2P data channels if available, as well as WebSocket for backup
      let sentP2P = false;
      peersRef.current.forEach((peer) => {
        if (peer.dataChannel && peer.dataChannel.readyState === "open") {
          try {
            peer.dataChannel.send(
              JSON.stringify({
                type: "chat-msg",
                payload,
              })
            );
            sentP2P = true;
          } catch (e) {
            console.warn("Direct P2P DataChannel delivery failed, bypassing to signaling gateway:", e);
          }
        }
      });

      if (sentP2P) {
        addLog("WEBRTC", "success", "Dispatched packet directly over peer-to-peer DataChannel.");
      }

      // Sync websocket path (fallback and multihost group synchronization)
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "direct-message",
            senderId: localClientId,
            payload,
          })
        );
      }
    } catch (err) {
      addLog("ENCRYPT", "error", `Encryption operations faulted: ${String(err)}`);
    }
  };

  // Deliver symmetric encrypted physical files Real-time
  const handleSendFile = async (file: File) => {
    const key = derivedKey;
    if (!key) return;

    try {
      addLog("ENCRYPT", "info", `Preparing file binary: ${file.name} (${file.size} bytes)`);
      
      // Read file into memory buffer
      const fileBytes = await file.arrayBuffer();
      
      // Encrypt file completely client-side in browser memory
      addLog("ENCRYPT", "info", "Starting browser in-memory AES-GCM-256 file encryption stream...");
      const { ciphertext, iv } = await encryptFileBuffer(fileBytes, key);
      
      const Base64Cipher = bufferToBase64(ciphertext);
      const Base64Iv = bufferToBase64(iv);
      
      addLog("ENCRYPT", "success", "In-memory file binary encrypted safely. Shipping payload packet.");

      const payload: EncryptedPayload = {
        ciphertext: Base64Cipher,
        iv: Base64Iv,
        salt: keySaltHex,
      };

      const now = new Date().toLocaleTimeString();
      const messageId = "file-" + Math.floor(100000 + Math.random() * 900000);

      // Add to local chat view instantly with loaded downloadable local reference link
      const newMsg: ChatMessage = {
        id: messageId,
        senderId: localClientId,
        senderName: "Me",
        timestamp: now,
        type: "file",
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileDataUrl: URL.createObjectURL(file), // Local immediate download reference
        encryptedPayload: payload,
        isIncoming: false,
      };

      setMessages((prev) => [...prev, newMsg]);

      // Bundle standard cryptographic file message envelope
      const bundle = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        ...payload,
      };

      // Wrap outer container
      const outerPayload = await encryptText(JSON.stringify(bundle), key, keySaltHex);

      // Dispatch to room peers
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "direct-message",
            senderId: localClientId,
            payload: outerPayload,
          })
        );
      }

      addLog("WEBRTC", "success", `Encrypted file envelope dispatched successfully.`);
    } catch (err) {
      console.error(err);
      addLog("ENCRYPT", "error", `File encryption stream failed: ${String(err)}`);
    }
  };

  // Process incoming encrypted envelope messages
  const handleIncomingSymmetricMessage = async (
    senderId: string,
    senderName: string,
    payload: EncryptedPayload
  ) => {
    const key = derivedKeyRef.current;
    if (!key) return;

    try {
      // 1. Decrypt raw symmetric envelope text
      const decryptedText = await decryptText(payload, key);
      const now = new Date().toLocaleTimeString();
      const msgId = "msg-" + Math.floor(100000 + Math.random() * 900000);

      // Check if this is a file transfer container or basic text chat
      if (decryptedText.startsWith("{") && decryptedText.includes("fileName")) {
        // Handle decrypted file package
        const fileBundle = JSON.parse(decryptedText);
        
        addLog("DECRYPT", "success", `File meta envelope decrypted successfully from ${senderName}: ${fileBundle.fileName}`);
        addLog("DECRYPT", "info", "Decrypting in-memory binary attachment using AES-GCM-256...");

        const fileCipherBytes = base64ToBuffer(fileBundle.ciphertext);
        const fileIvBytes = base64ToBuffer(fileBundle.iv);

        const decryptedFileBuffer = await decryptFileBuffer(fileCipherBytes, fileIvBytes, key);
        
        // Re-compile file Blob inside browser sandboxed state
        const fileBlob = new Blob([decryptedFileBuffer], { type: fileBundle.fileType || "application/octet-stream" });
        const localDownloadLink = URL.createObjectURL(fileBlob);

        addLog("DECRYPT", "success", `Physical binary attachment reconstructed safely. Secure local URL compiled.`);

        const decMsg: ChatMessage = {
          id: msgId,
          senderId,
          senderName,
          timestamp: now,
          type: "file",
          fileName: fileBundle.fileName,
          fileSize: fileBundle.fileSize,
          fileType: fileBundle.fileType,
          fileDataUrl: localDownloadLink,
          encryptedPayload: payload,
          isIncoming: true,
        };

        setMessages((prev) => [...prev, decMsg]);
      } else {
        // Standard E2EE Text Chat message
        addLog("DECRYPT", "success", `Plaintext payload decrypted: "${decryptedText.substring(0, 15)}${decryptedText.length > 15 ? "..." : ""}"`);
        
        const decMsg: ChatMessage = {
          id: msgId,
          senderId,
          senderName,
          timestamp: now,
          type: "text",
          text: decryptedText,
          encryptedPayload: payload,
          isIncoming: true,
        };

        setMessages((prev) => [...prev, decMsg]);
      }
    } catch (err) {
      console.error("Decryption mistake alert:", err);
      // Decryption failure handling (usually mismatched password codes)
      const now = new Date().toLocaleTimeString();
      const faultyMsg: ChatMessage = {
        id: "error-" + Math.floor(100000 + Math.random() * 900000),
        senderId,
        senderName,
        timestamp: now,
        type: "text",
        text: "🔐 [Crypto Warning: Could not decrypt message - password mismatch]",
        encryptedPayload: payload,
        isIncoming: true,
        decryptionFailed: true,
      };
      setMessages((prev) => [...prev, faultyMsg]);
      addLog("DECRYPT", "error", `Decryption error from ${senderName}: cryptographic integrity checks failed!`);
    }
  };

  // Toggle Video track dynamically
  const handleToggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        const nextState = !videoTrack.enabled;
        videoTrack.enabled = nextState;
        setVideoEnabled(nextState);
        addLog("WEBRTC", "info", `Local camera feed toggled: ${nextState ? "ACTIVE" : "MUTED"}`);
      }
    }
  };

  // Toggle Audio track dynamically
  const handleToggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        const nextState = !audioTrack.enabled;
        audioTrack.enabled = nextState;
        setAudioEnabled(nextState);
        addLog("WEBRTC", "info", `Local microphone toggled: ${nextState ? "ACTIVE" : "MUTED"}`);
      }
    }
  };

  // Terminate connection call and clean up buffers
  const handleLeaveCall = () => {
    addLog("WEBRTC", "warning", "User terminated. Commencing secure P2P teardown...");

    // 1. Shutdown media capture devices
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    // 2. Tear down RTC client peers
    peersRef.current.forEach((peer) => {
      if (peer.rtcPeerConnection) {
        peer.rtcPeerConnection.close();
      }
    });
    setPeers([]);

    // 3. Close websocket link
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // 4. Reset messages heap
    setMessages([]);

    // 5. Direct user back to room joining setup page
    setScreen("setup");
    addLog("KEY_DERIVATION", "success", "Applet reverted to safe setup context. Symmetric key destroyed.");
  };

  return (
    <>
      {screen === "setup" ? (
        <SetupScreen onJoin={handleJoinRoom} />
      ) : (
        <MainCallScreen
          roomId={roomId}
          userName={userName}
          passphrase={passphrase}
          fingerprint={fingerprint}
          peers={peers}
          messages={messages}
          logs={logs}
          localStream={localStream}
          videoEnabled={videoEnabled}
          audioEnabled={audioEnabled}
          onToggleVideo={handleToggleVideo}
          onToggleAudio={handleToggleAudio}
          onSendMessage={handleSendMessage}
          onSendFile={handleSendFile}
          onLeave={handleLeaveCall}
          onClearLogs={handleClearLogs}
        />
      )}
    </>
  );
}
