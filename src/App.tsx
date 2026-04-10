import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  type SubscriptionTier,
  type UserSubscription,
  getSkipsRemaining,
  isPremiumOrHigher,
} from "./types/subscription";
import {
  SubscriptionModal,
  PremiumBadge,
  SkipCounter,
} from "./components/SubscriptionModal";

const SIGNALING_URL = "http://localhost:3001";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

type Role = "caller" | "callee" | null;

type QueueInfo = {
  position: number;
  etaSec: number;
  waitedSec: number;
};

type ChatMsg = {
  id: string;
  text: string;
  ts: number;
  mine: boolean;
};

export default function App() {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<string>("Idle");
  const [role, setRole] = useState<Role>(null);

  // UI state
  const [onboardingDone, setOnboardingDone] = useState<boolean>(false);
  const [ageConfirmed, setAgeConfirmed] = useState<boolean>(false);
  const [showChat, setShowChat] = useState<boolean>(true);
  const [micOn, setMicOn] = useState<boolean>(true);
  const [camOn, setCamOn] = useState<boolean>(true);

  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);

  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState<string>("");

  // Subscription state
  const [subscription, setSubscription] = useState<UserSubscription>(() => {
    const saved = localStorage.getItem("cw_subscription");
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
        lastSkipReset: new Date(parsed.lastSkipReset),
      };
    }
    return {
      tier: "free" as SubscriptionTier,
      expiresAt: null,
      skipsToday: 0,
      lastSkipReset: new Date(),
    };
  });
  const [showSubscription, setShowSubscription] = useState(false);

  // Reset daily skips at midnight
  useEffect(() => {
    const now = new Date();
    const lastReset = new Date(subscription.lastSkipReset);
    if (now.toDateString() !== lastReset.toDateString()) {
      setSubscription((prev) => ({
        ...prev,
        skipsToday: 0,
        lastSkipReset: now,
      }));
    }
  }, []);

  // Save subscription to localStorage
  useEffect(() => {
    localStorage.setItem("cw_subscription", JSON.stringify(subscription));
  }, [subscription]);

  function handleUpgrade(tier: SubscriptionTier) {
    // In production, this would go through payment processing
    setSubscription((prev) => ({
      ...prev,
      tier,
      expiresAt: tier === "free" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }));
    setShowSubscription(false);
  }

  function consumeSkip(): boolean {
    const remaining = getSkipsRemaining(subscription);
    if (remaining <= 0) {
      setShowSubscription(true);
      return false;
    }
    setSubscription((prev) => ({
      ...prev,
      skipsToday: prev.skipsToday + 1,
    }));
    return true;
  }

  async function ensureLocalMedia() {
    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }

  function cleanupPeerConnection() {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setRole(null);
  }

  function resetConversationUI() {
    setChat([]);
    setDraft("");
  }

  async function createPeerConnection() {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    const localStream = await ensureLocalMedia();
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("rtc-ice", { candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      setStatus(`RTC: ${pc.connectionState}`);
    };

    return pc;
  }

  async function start() {
    setStatus("Requesting camera...");
    await ensureLocalMedia();
    setStatus("Searching match...");
    resetConversationUI();
    setQueueInfo(null);
    socketRef.current?.emit("find", {
      subscription: subscription.tier,
      filters: isPremiumOrHigher(subscription.tier) ? { gender: filterGender, region: filterRegion } : {},
    });
  }

  function next() {
    // Check skip limit
    if (!consumeSkip()) return;
    
    setStatus("Next...");
    cleanupPeerConnection();
    resetConversationUI();
    setQueueInfo(null);

    socketRef.current?.emit("next");
    socketRef.current?.emit("find", {
      subscription: subscription.tier,
      filters: isPremiumOrHigher(subscription.tier) ? { gender: filterGender, region: filterRegion } : {},
    });
  }

  function stop() {
    setStatus("Stopped");
    cleanupPeerConnection();
    resetConversationUI();
    setQueueInfo(null);
    socketRef.current?.emit("stop");
  }

  function toggleMic() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micOn;
    stream.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }

  function toggleCam() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camOn;
    stream.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  }

  function sendChat() {
    const text = draft.trim();
    if (!text) return;

    const msg = { id: crypto.randomUUID(), text, ts: Date.now() };
    socketRef.current?.emit("chat-message", msg);

    setChat((prev) => [...prev, { ...msg, mine: true }]);
    setDraft("");
  }

  useEffect(() => {
    const socket = io(SIGNALING_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    // ===== anonymous clientId for reconnect =====
    const clientIdKey = "cc_client_id";
    const clientId = localStorage.getItem(clientIdKey) ?? crypto.randomUUID();
    localStorage.setItem(clientIdKey, clientId);
    socket.emit("hello", { clientId });

    socket.on("connect", () => setStatus("Connected to signaling"));
    socket.on("welcome", () => setStatus("Connected"));
    socket.on("reconnected", () => setStatus("Reconnected"));
    socket.on("waiting", () => setStatus("Waiting for partner..."));

    socket.on("queue-status", (info: QueueInfo) => setQueueInfo(info));
    socket.on("queue-timeout", () => {
      // אפשר גם טוסט/נוטיפיקציה - כרגע רק סטטוס
      setStatus("Still waiting... (no partner yet)");
    });

    socket.on("matched", async ({ role }: { role: Role }) => {
      setRole(role);
      setQueueInfo(null);
      resetConversationUI();
      setStatus(`Matched as ${role}`);

      const pc = await createPeerConnection();

      if (role === "caller") {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("rtc-offer", { sdp: offer });
      }
    });

    socket.on("partner-left", () => {
      setStatus("Partner left. Waiting...");
      cleanupPeerConnection();
      resetConversationUI();
      socket.emit("find");
    });

    socket.on("reset", () => {
      setStatus("Reset");
      cleanupPeerConnection();
      resetConversationUI();
    });

    // ===== Text chat =====
    socket.on(
      "chat-message",
      (msg: { id: string; text: string; ts: number }) => {
        setChat((prev) => [...prev, { ...msg, mine: false }]);
      },
    );

    // ===== WebRTC signaling =====
    socket.on(
      "rtc-offer",
      async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        const pc = pcRef.current ?? (await createPeerConnection());
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("rtc-answer", { sdp: answer });
      },
    );

    socket.on(
      "rtc-answer",
      async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        const pc = pcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      },
    );

    socket.on(
      "rtc-ice",
      async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        const pc = pcRef.current;
        if (!pc) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          // Sometimes ICE arrives before setRemoteDescription — ignore for POC
        }
      },
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
      cleanupPeerConnection();
    };
  }, []);

  const isInCall = role !== null && pcRef.current !== null;
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterGender, setFilterGender] = useState<string>("anyone");
  const [filterRegion, setFilterRegion] = useState<string>("global");

  // Landing page
  if (!onboardingDone) {
    return (
      <div className="landing">
        <header className="landing-header">
          <div className="logo">
            <div className="logo-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            ChatWave
          </div>
        </header>

        <div className="landing-content">
          <div className="landing-left">
            <h1 className="landing-title">
              Connect with <span className="highlight">Strangers</span>{" "}
              Worldwide
            </h1>
            <p className="landing-subtitle">
              Start random video chats with people from around the globe. Make
              new friends, have interesting conversations, and explore different
              cultures— all with complete anonymity.
            </p>

            <div className="feature-grid">
              <div className="feature-item">
                <svg
                  className="feature-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="feature-text">HD Video Chat</span>
              </div>
              <div className="feature-item">
                <svg
                  className="feature-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                <span className="feature-text">Global Network</span>
              </div>
              <div className="feature-item">
                <svg
                  className="feature-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span className="feature-text">100% Anonymous</span>
              </div>
              <div className="feature-item">
                <svg
                  className="feature-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span className="feature-text">Instant Matching</span>
              </div>
            </div>
          </div>

          <div className="landing-right">
            <div className="start-card">
              <div className="sparkle-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h2>Start Chatting Now</h2>

              <div className="checkbox-group">
                <div
                  className={`checkbox-item ${ageConfirmed ? "checked" : ""}`}
                  onClick={() => setAgeConfirmed(!ageConfirmed)}
                >
                  <div className="checkbox-circle">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="checkbox-content">
                    <h4>I am 18 years or older</h4>
                    <p>You must be at least 18 to use this service</p>
                  </div>
                </div>

                <div
                  className={`checkbox-item ${termsAccepted ? "checked" : ""}`}
                  onClick={() => setTermsAccepted(!termsAccepted)}
                >
                  <div className="checkbox-circle">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="checkbox-content">
                    <h4>I accept the Terms of Service</h4>
                    <p>Including community guidelines and privacy policy</p>
                  </div>
                </div>
              </div>

              <button
                className="start-button"
                disabled={!ageConfirmed || !termsAccepted}
                onClick={() => {
                  setOnboardingDone(true);
                  start();
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Start Video Chat
              </button>

              <p className="privacy-note">
                🔒 Your privacy is protected. <a href="#">Learn more</a>
              </p>
            </div>
          </div>
        </div>

        <footer className="landing-footer">
          © 2024 ChatWave. All rights reserved.
        </footer>
      </div>
    );
  }

  return (
    <div className="chat-app">
      <header className="chat-header">
        <button
          className="back-button"
          onClick={() => {
            stop();
            setOnboardingDone(false);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="header-logo">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          ChatWave
          <PremiumBadge tier={subscription.tier} />
        </div>
        
        <div className="header-user">
          <SkipCounter subscription={subscription} onUpgrade={() => setShowSubscription(true)} />
          {subscription.tier === 'free' && (
            <button className="upgrade-btn" onClick={() => setShowSubscription(true)}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Upgrade
            </button>
          )}
        </div>
      </header>

      <div className="chat-main">
        <div className="videos-container">
          <div className="video-box">
            <video ref={remoteVideoRef} autoPlay playsInline />
            <span className="video-label">Stranger</span>
            {isInCall && (
              <div className="connection-badge">
                <span className="dot"></span>
                Connected
              </div>
            )}
            {!isInCall && (
              <div className="video-placeholder">
                <div className="placeholder-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="10" r="3" />
                    <path d="M7 20.662V19a2 2 0 012-2h6a2 2 0 012 2v1.662" />
                  </svg>
                </div>
                <span className="placeholder-text">
                  {queueInfo
                    ? `Waiting #${queueInfo.position} · ETA ${queueInfo.etaSec}s`
                    : status === "Connected"
                      ? "Finding someone..."
                      : status}
                </span>
              </div>
            )}
          </div>

          <div className="video-box">
            <video ref={localVideoRef} autoPlay playsInline muted />
            <span className="video-label">You</span>
          </div>
        </div>

        {showChat && (
          <aside className="chat-panel">
            <div className="chat-panel-header">
              <h3>Chat</h3>
              <p>
                {isInCall
                  ? "Connected with stranger"
                  : "Waiting for connection..."}
              </p>
            </div>

            <div className="chat-messages">
              {chat.length === 0 ? (
                <div className="chat-empty">
                  {isInCall
                    ? "Say hello! 👋\nStart the conversation."
                    : "Connect with someone to start chatting..."}
                </div>
              ) : (
                chat.map((m) => (
                  <div
                    key={m.id}
                    className={`message ${m.mine ? "sent" : "received"}`}
                  >
                    {m.text}
                  </div>
                ))
              )}
            </div>

            <div className="chat-input-container">
              <button className="emoji-button">😊</button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  isInCall ? "Type a message..." : "Waiting for connection..."
                }
                disabled={!isInCall}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendChat();
                }}
              />
              <button
                className="send-button"
                onClick={sendChat}
                disabled={!isInCall}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </aside>
        )}
      </div>

      <div className="control-bar">
        <button
          className={`control-btn ${!micOn ? "off" : ""}`}
          onClick={toggleMic}
          title="Microphone"
        >
          {micOn ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
              <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v4M8 23h8" />
            </svg>
          )}
        </button>

        <button
          className={`control-btn ${!camOn ? "off" : ""}`}
          onClick={toggleCam}
          title="Camera"
        >
          {camOn ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          )}
        </button>

        <button className="control-btn primary" onClick={next} title="Next">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="5 4 15 12 5 20 5 4" />
            <line x1="19" y1="5" x2="19" y2="19" />
          </svg>
          Next
        </button>

        <button className="control-btn danger" onClick={stop} title="End">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <button
          className="control-btn"
          onClick={() => setShowFilters(true)}
          title="Filters"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
        </button>

        <button
          className="control-btn"
          onClick={() => setShowChat(!showChat)}
          title="Chat"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>

        <button className="control-btn warning" title="Report">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </button>
      </div>

      {/* Filters Modal */}
      {showFilters && (
        <div className="modal-overlay" onClick={() => setShowFilters(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                Matching Filters
              </h2>
              <button
                className="modal-close"
                onClick={() => setShowFilters(false)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="filter-section">
                <div className="filter-label">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Gender Preference
                  {!isPremiumOrHigher(subscription.tier) && (
                    <span className="filter-lock">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                      Premium
                    </span>
                  )}
                </div>
                <div className="filter-options">
                  {["anyone", "male", "female"].map((g) => (
                    <button
                      key={g}
                      className={`filter-chip ${filterGender === g ? "selected" : ""}`}
                      onClick={() => {
                        if (!isPremiumOrHigher(subscription.tier) && g !== "anyone") {
                          setShowSubscription(true);
                          return;
                        }
                        setFilterGender(g);
                      }}
                      disabled={!isPremiumOrHigher(subscription.tier) && g !== "anyone"}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-section">
                <div className="filter-label">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </svg>
                  Region
                  {!isPremiumOrHigher(subscription.tier) && (
                    <span className="filter-lock">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                      Premium
                    </span>
                  )}
                </div>
                <div className="filter-options">
                  {[
                    "global",
                    "north-america",
                    "europe",
                    "asia",
                    "south-america",
                  ].map((r) => (
                    <button
                      key={r}
                      className={`filter-chip ${filterRegion === r ? "selected" : ""}`}
                      onClick={() => {
                        if (!isPremiumOrHigher(subscription.tier) && r !== "global") {
                          setShowSubscription(true);
                          return;
                        }
                        setFilterRegion(r);
                      }}
                      disabled={!isPremiumOrHigher(subscription.tier) && r !== "global"}
                    >
                      {r
                        .split("-")
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(" ")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-btn secondary"
                onClick={() => {
                  setFilterGender("anyone");
                  setFilterRegion("global");
                }}
              >
                Reset
              </button>
              <button
                className="modal-btn primary"
                onClick={() => setShowFilters(false)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={showSubscription}
        onClose={() => setShowSubscription(false)}
        currentSubscription={subscription}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}
