/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EncryptedPayload } from "./types";

// Helper: Convert ArrayBuffer to Base64 string
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Convert Base64 string to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Helper: Convert Hex string to Uint8Array
export function hexToBuffer(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, "");
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Helper: Convert Uint8Array to Hex string
export function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derives a 256-bit AES-GCM crypto key from a text passphrase and a salt buffer.
 * It uses PBKDF2 with SHA-256 and 100,000 iterations for secure key strengthening.
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);

  // Import raw passphrase material
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    passphraseBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // Derive AES-GCM 256-bit key
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false, // Must be false for E2EE protection
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a string message using AES-GCM (256-bit).
 * Returns the salt, iv, and ciphertext as Base64.
 */
export async function encryptText(
  text: string,
  key: CryptoKey,
  saltHex: string
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes standard IV for AES-GCM
  const plaintextBytes = encoder.encode(text);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    plaintextBytes
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    salt: saltHex,
  };
}

/**
 * Decrypts a base64 ciphertext back into a human-readable string.
 */
export async function decryptText(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<string> {
  const ivBytes = base64ToBuffer(payload.iv);
  const ciphertextBytes = base64ToBuffer(payload.ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBytes,
    },
    key,
    ciphertextBytes
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Encrypts a file (ArrayBuffer) with AES-GCM.
 * Prepend/outputs standard binary chunk.
 */
export async function encryptFileBuffer(
  fileBuffer: ArrayBuffer,
  key: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    fileBuffer
  );

  return { ciphertext, iv };
}

/**
 * Decrypts an encrypted file (ArrayBuffer) back into its original ArrayBuffer form.
 */
export async function decryptFileBuffer(
  encryptedBuffer: ArrayBuffer,
  ivBytes: Uint8Array,
  key: CryptoKey
): Promise<ArrayBuffer> {
  return window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBytes,
    },
    key,
    encryptedBuffer
  );
}

/**
 * Generates a visual, human-friendly 20-digit security code (Safety Numbers).
 * These numbers are derived from a SHA-256 hash of the derived key.
 * This satisfies Signal Protocol-like off-the-grid channel consistency checks.
 */
export async function generateFingerprint(passphrase: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const rawInput = encoder.encode(passphrase + saltHex);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", rawInput);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert first 12 bytes of the hash into blocks of 5-digit security codes
  const numbers: string[] = [];
  for (let i = 0; i < 4; i++) {
    const start = i * 3;
    const value = (hashArray[start] << 16) | (hashArray[start + 1] << 8) | hashArray[start + 2];
    const padded = (value % 100000).toString().padStart(5, "0");
    numbers.push(padded);
  }

  return numbers.join(" - ");
}
