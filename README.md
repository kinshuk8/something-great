# Something Great — End-to-End Encrypted Real-Time Chat App

A modern, high-performance, and feature-rich real-time chat application built using **TanStack Start** (Vite + React Router) for the frontend and **Convex** for the real-time serverless backend. 

Security is a core design principle: all text messages, image attachments, and voice notes are **fully encrypted end-to-end (E2E)** on the client using the Web Crypto API before being transmitted or stored.

---

## Key Features

- 🔒 **End-to-End Encryption (E2E):** Client-side encryption using AES-GCM for message contents and media attachments. Key exchange is performed securely using RSA-OAEP public/private key pairs.
- 🔑 **Secure Key Backup & Restore:** Optional passphrase-derived backup stored securely on the backend (using PBKDF2 key derivation) to recover chat keys when logging in from new devices.
- 💬 **Rich Communication Rooms:**
  - **Global Chat:** Public room open to all users.
  - **Custom Rooms:** Public or Private rooms (private rooms require room password/owner approval).
  - **Direct Messages (DMs):** Private one-on-one encrypted rooms with typing and read-receipt indicators.
- 🎤 **Voice Messages:** Record, send, and listen to voice notes directly in the chat with a customized, responsive media player.
- 🖼️ **Image Attachments:** Select and upload images securely via **UploadThing** integration.
- 👾 **GIPHY Integration:** Search and share GIFs instantly using the inline GIPHY picker.
- ↩️ **Swipe-to-Reply / Mentions:** Swipe any message bubble left to reply, and tag other users using `@username` mentions.
- 🛠️ **Message Actions (PC & Mobile):**
  - **PC:** Right-click on any message to trigger options.
  - **Mobile:** Long-press (500ms hold) to slide up a native-feeling actions drawer.
  - **Delete Message:** Erases encrypted content from Convex database and purges binary files from UploadThing, leaving a context-specific placeholder (e.g. *"A sound wave was silenced"*).
  - **Forward Message:** Decrypts the message on-the-fly and re-encrypts it with the target room's key (including file re-uploads) to securely forward text or media.
- 👥 **Friends & Invitations:** Manage friends, send requests, accept invites, and start instant DMs.
- 🎨 **Responsive Glassmorphism Styling:** Premium dark-mode UI with smooth micro-animations, mobile-collapsible menus, responsive modals, and dynamic keyboard safe-area adjustments.

---

## Technology Stack

- **Frontend Framework:** [TanStack Start](https://tanstack.com/start) (React + React Router)
- **Backend Service:** [Convex](https://convex.dev)
- **Database & Real-time Sync:** Convex Documents
- **File Storage:** [UploadThing](https://uploadthing.com)
- **Analytics:** [PostHog](https://posthog.com)
- **CSS Utility:** Tailwind CSS v4
- **Package Manager / Runtime:** [Bun](https://bun.sh)

---

## Getting Started & Local Development

### 1. Prerequisites

Ensure you have [Bun](https://bun.sh) installed. You will also need accounts and API credentials for the following services:
- **Convex Account:** To host the database and backend mutations/queries.
- **UploadThing Account:** For storing encrypted media files.
- **PostHog Account:** (Optional) For analytics.
- **GIPHY Developers Account:** For fetching GIFs.

---

### 2. Environment Setup

Create a `.env.local` file in the root directory and add the following keys:

```env
# Convex Backend Configuration
# (Automatically populated if you run "bun convex dev")
CONVEX_DEPLOYMENT=your_convex_deployment_id
VITE_CONVEX_URL=https://your_convex_project.convex.cloud
VITE_CONVEX_SITE_URL=https://your_convex_project.convex.site

# UploadThing Storage Configuration
# Token can be found in the API Keys tab in your UploadThing Dashboard
UPLOADTHING_TOKEN=your_uploadthing_token_here

# GIPHY API Configuration
# Get your API key from https://developers.giphy.com
VITE_GIPHY_API_KEY=your_giphy_api_key_here

# PostHog Analytics (Optional)
VITE_POSTHOG_KEY=your_posthog_project_key
# VITE_POSTHOG_HOST=https://us.i.posthog.com
```

In the Convex dashboard, make sure you configure your backend environment variables (specifically `UPLOADTHING_TOKEN`) so backend functions can delete media files during message deletion.

---

### 3. Installation & Run

Follow these steps to spin up the application:

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Start the Convex backend (Syncs schema and functions in real-time):**
   ```bash
   bun convex dev
   ```
   *(On first run, this command will prompt you to log into Convex and configure a new dev project).*

3. **Start the local development server (Vite + TanStack Start):**
   ```bash
   bun dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

### 4. Running Tests & Quality Checks

- **Run unit tests (Vitest):**
  ```bash
  bun run test
  ```
- **Lint the codebase:**
  ```bash
  bun run lint
  ```
- **Format code using Prettier:**
  ```bash
  bun run format
  ```

---

## Production Build & Deployment

### Building Locally

To verify build compilation or build for self-hosting:

```bash
bun run build
```

This compiles client-side bundles under `.output/public` and generates a standalone server application ready to run on Node/Bun.

### Deploying to Railway

This project is fully compatible with [Railway](https://railway.com) using the included `nixpacks.toml` configuration:

1. Push this repository to your GitHub account.
2. Go to **Railway**, create a new project, and select your GitHub repository.
3. In the project **Variables** tab, add all environment variables defined in `.env.local`.
4. Railway will automatically build, deploy, and serve the application.

---

## Cryptography Design (Client-Side E2E)

This application guarantees security through client-side encryption. The backend is "blind" to message content:

1. **User Identity Keys:** On signup/login, the browser generates an **RSA-OAEP Public/Private Key pair**. The public key is stored in the database so other users can encrypt keys for them. The private key is saved in the browser's local IndexedDB.
2. **Chatroom Symmetric Keys:** Every DM and private room has a unique **AES-GCM (256-bit) symmetric key**.
3. **Key Exchange:** When joining or starting a chat, the chatroom symmetric key is encrypted using the recipient's RSA public key. Only the recipient's private key can decrypt the symmetric key.
4. **Message Encryption:** Text body, voice notes, and image data are encrypted in the browser with the room's AES-GCM key and a random Initialization Vector (IV).
5. **Key Backup:** If enabled, the user derives a secure wrapper key from their passphrase using PBKDF2. The wrapper key encrypts their private RSA key, which is then backed up to the database so they can regain access on other devices.
