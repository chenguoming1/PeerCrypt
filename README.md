# SECURE P2P — Zero-Knowledge Encrypted Link

SECURE P2P is a highly secure, decentralized, zero-knowledge peer-to-peer web application that facilitates fully encrypted messaging, real-time audio/video calls, and direct binary file sharing. Built with a responsive, high-contrast, Swiss neo-brutalist custom aesthetic, it ensures no decrypted keys or raw payloads ever touch a central server.

---

## 🎨 Design Philosophy
The application features a calibrated **Swiss Neo-Brutalist** theme:
*   **Achromatic Base**: High-contrast, pure-black canvas and off-white monospace values designed for raw focus.
*   **Signature Contrast Accent**: Energetic lime/high-vis branding elements (`#cfff04`).
*   **Sharp Structural Grid**: Thick, sharp borders and heavy, flat 2D shadows (`shadow-[12px_12px_0px_#1a1a1a]`) instead of generic gradients or fuzzy soft-shadow aesthetics.
*   **Transparent Cryptographic Ledger**: Custom aesthetic status monitors display actual hex ciphertexts, IV parameters, and handshake stages right inside the sidebar under a real-time ledger tab.

---

## 🛡️ Cryptographic Architecture
How your communication is secured:
1.  **High-Entropy Key Derivation (PBKDF2)**: When you input your room Passphrase, symmetric cryptokeys are immediately derived **locally** using standard `PBKDF2` (100,000 iterations of SHA-256 with a saline modifier). The master password is never sent to the server.
2.  **Symmetric Encryption (AES-GCM-256)**: Every individual text payload, file metadata object, and binary file buffer is encrypted in-browser inside the client container before leaving the localhost node. This ensures true zero-knowledge transport.
3.  **Peer-to-Peer Sublayer (WebRTC)**: The Node.js signaling hub only acts as a temporary facilitator. It delivers WebRTC connection handshakes over encrypted WebSockets. Once connected, media and data streams flow directly between browsers using DTLS/SRTP cryptography, entirely bypassing the server for maximum privacy and scalability.

---

## 💻 Local Installation & Setup

Set up SECUREP2P directly on your local computer.

### System Prerequisites
*   **Node.js**: Version 22 LTS or greater
*   **npm**: Pre-packaged with Node

### 1. Manual Installation
Clone or dry-extract this repository into your chosen directory on your laptop, then open a terminal inside the root directory and execute:

```bash
# 1. Install required full-stack dependencies
npm install

# 2. Start the hot-reloading development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application setup.

### 2. Standard Production Build
Compile optimized frontend static bundles alongside the Express backend node:
```bash
# Compile and bundle the application into /dist
npm run build

# Boot the node production server
npm run start
```

---

## 🐳 Docker Stack (Docker Compose)
To run the server inside an isolated Docker container without managing local dependencies manually, use the pre-built multi-stage Docker setup.

### Run with Docker Compose
From the root directory, simply trigger:
```bash
# Spin up the containers in the background
docker-compose up --build -d
```
The application will immediately build the frontend assets, bundle the server files inside the builder stage, and launch a lightweight production container serving on:
*   [http://localhost:3000](http://localhost:3000)

### Spin Down Containers
```bash
docker-compose down
```

---

## 🚀 Connecting Outside Localhost (Alternative to Port Forwarding)
Because WebRTC establishes links between remote network nodes, the two browser profiles must be able to reach each other or point to a valid signaling hub.

If you don't have access to your router management portal to set up static Port Forwarding or Dynamic DNS (DDNS) mapping, you can use these instant secure tunnel layers instead:

### 1. Cloudflare Tunnels (Recommended & Most Secure)
Cloudflare Tunnels run as a local daemon inside your house and securely route HTTPS requests from Cloudflare’s edge directly to your local port without exposing any open ports to the wild web.
```bash
# Install cloudflared via brew/chocolatey/apt, then login:
cloudflared tunnel login

# Create a tunnel named "p2p-tunnel"
cloudflared tunnel create p2p-tunnel

# Expose your local port 3000 securely
cloudflared tunnel route dns p2p-tunnel secure-chat.yourdomain.com
cloudflared tunnel run p2p-tunnel --url http://localhost:3000
```

### 2. Instant Temporary Proxies

#### A. Localtunnel
Quickly share your local process with a temporary, shareable public domain:
```bash
npx localtunnel --port 3000
```

#### B. ngrok
Configure ngrok to route to your local port:
```bash
ngrok http 3000
```

*Note: For perfect P2P performance across complex NAT/Firewalls, a STUN server (such as Google's default stun.l.google.com:19302 mapped in the applet) handles standard translation seamlessly.*
