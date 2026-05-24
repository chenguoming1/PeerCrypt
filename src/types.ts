/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface EncryptedPayload {
  ciphertext: string; // Base64 ciphertext
  iv: string;         // Base64 WebCrypto IV
  salt: string;       // Base64 salt used for PBKDF2
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  timestamp: string;
  type: "text" | "file";
  text?: string;       // Decrypted text, exists only client-side after successful decryption
  fileName?: string;   // Decrypted file name
  fileSize?: number;
  fileType?: string;
  fileDataUrl?: string;// Decrypted local Object URL for download
  encryptedPayload: EncryptedPayload;
  isIncoming: boolean;
  decryptionFailed?: boolean;
}

export interface Peer {
  id: string;
  name: string;
  connectionState: "connecting" | "connected" | "disconnected" | "failed" | "none";
  rtcPeerConnection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  stream: MediaStream | null;
}

export interface CryptographicContext {
  passphrase: string;
  saltHex: string;
  fingerprint: string; // Peer verification Safety Numbers
  derivedKey: CryptoKey | null;
}

export interface CryptoLog {
  id: string;
  timestamp: string;
  action: string;      // "ENCRYPT" | "DECRYPT" | "KEY_DERIVATION" | "WEBRTC" | "HANDSHAKE"
  status: "success" | "info" | "error" | "warning";
  details: string;
}
