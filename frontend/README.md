# Vue 3 + Vite + TypeScript Frontend for Qwen Real-Time API

This is a Vue 3 frontend application built with Vite and TypeScript for interacting with the Qwen Real-Time API through the WebSocket proxy backend.

## Features

- ✨ Vue 3 with Composition API and `<script setup>` syntax
- 🎨 Vite for fast development and optimized builds
- 📘 TypeScript for type safety
- 🔌 WebSocket service with auto-reconnection and message queuing
- 🎙️ Real-time transcription display
- 📁 Audio file upload support
- 🔴 Recording controls
- 📊 Connection status indicator
- 🎯 Responsive design

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Vue components
│   │   ├── ConnectionStatus.vue    # Connection status indicator
│   │   ├── RecordButton.vue        # Recording control button
│   │   ├── FileUpload.vue          # File upload component
│   │   └── TranscriptPanel.vue     # Transcript display
│   ├── composables/         # Vue composables
│   │   └── useWebSocket.ts  # WebSocket hook
│   ├── services/            # Business logic
│   │   └── websocket.ts     # WebSocket service with auto-reconnect
│   ├── styles/              # Global styles
│   │   └── main.css         # Global CSS and variables
│   ├── types/               # TypeScript types
│   │   └── websocket.ts     # WebSocket types
│   ├── App.vue              # Root component
│   └── main.ts              # Application entry point
├── index.html               # HTML entry point
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── package.json             # Dependencies and scripts
└── README.md                # This file
```

## Prerequisites

- Node.js 16.x or higher
- npm 7.x or higher
- Backend server running on localhost:8080 (or configured URL)

## Getting Started

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment (Optional)

Copy the environment example and update as needed:

```bash
cp .env.example .env.local
```

The default configuration connects to `ws://localhost:8080/ws`. To change this:

```env
VITE_WS_PROTOCOL=ws
VITE_WS_HOST=localhost
VITE_WS_PORT=8080
```

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

The optimized build will be created in the `dist/` directory.

### 5. Preview Production Build

```bash
npm run preview
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production with type checking
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint and auto-fix issues
- `npm run type-check` - Check TypeScript types without emitting

## WebSocket Service

### Basic Usage

The WebSocket service is automatically initialized and connected when components mount.

```typescript
import { useWebSocket } from '@/composables/useWebSocket'

export default {
  setup() {
    const { 
      connectionStatus,  // 'connected' | 'connecting' | 'disconnected'
      lastMessage,       // Last received message
      error,             // Error object if any
      queuedMessages,    // Number of queued messages
      connect,           // Manual connect function
      disconnect,        // Disconnect function
      send,              // Send message function
    } = useWebSocket()

    return {
      connectionStatus,
      lastMessage,
      error,
      queuedMessages,
      connect,
      disconnect,
      send,
    }
  },
}
```

### Features

- **Auto-reconnection**: Automatically reconnects on connection loss with exponential backoff
- **Message Queuing**: Messages sent while disconnected are queued and sent when reconnected
- **Event Emitters**: Simple event system for connection, disconnection, messages, and errors
- **Type Safe**: Full TypeScript support

### Sending Messages

```typescript
const { send } = useWebSocket()

// Send a message
send({
  type: 'session.update',
  session: {
    modalities: ['text'],
    input_audio_format: 'pcm',
    sample_rate: 16000,
  },
})
```

## Components

### ConnectionStatus

Displays current WebSocket connection status with indicator.

### RecordButton

Start/stop audio recording. Disabled when not connected.

### FileUpload

Upload audio files with drag-and-drop support.

### TranscriptPanel

Display transcriptions and messages from the server in real-time.

## Styling

Global styling uses CSS variables for easy theming:

```css
:root {
  --color-primary: #3b82f6;
  --color-success: #10b981;
  --color-error: #ef4444;
  --color-text: #1f2937;
  --color-bg: #ffffff;
  /* ... more variables ... */
}
```

To customize, edit `src/styles/main.css`.

## Troubleshooting

### WebSocket Connection Fails

1. Ensure the backend server is running on the configured URL
2. Check browser console for error messages
3. Verify the correct `VITE_WS_*` environment variables are set
4. Try clearing browser cache and restarting the dev server

### Build Fails

1. Run `npm run type-check` to identify TypeScript errors
2. Ensure all dependencies are installed: `npm install`
3. Check Node.js version is 16.x or higher: `node --version`

### Styling Issues

1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh the page (Ctrl+Shift+R)
3. Check if CSS variables are loaded in DevTools

## Development Tips

- Use Vue DevTools browser extension for component debugging
- Check browser console for WebSocket events and messages
- Use TypeScript strict mode to catch errors early
- Run `npm run lint` before committing code

## License

MIT
