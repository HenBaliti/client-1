import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SIGNALING_URL = "https://server-1arc.onrender.com";

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
    socketRef.current?.emit("find");
  }

  function next() {
    setStatus("Next...");
    cleanupPeerConnection();
    resetConversationUI();
    setQueueInfo(null);

    socketRef.current?.emit("next");
    socketRef.current?.emit("find");
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

  // Landing screen (RTL Hebrew)
  if (!onboardingDone) {
    return (
      <div className="landing rtl">
        <header className="landingHeader">
          <div className="logoTitle">FlirtChat</div>
          <div className="subtitle">פוגש אנשים חדשים בווידאו צ׳אט</div>
        </header>

        <section className="features">
          <div className="featureCard">
            <div className="featureTitle">וידאו צ׳אט אקראי</div>
            <div className="featureSub">פוגש אנשים חדשים בווידאו</div>
          </div>
          <div className="featureCard">
            <div className="featureTitle">גלובלי</div>
            <div className="featureSub">משתמשים מכל העולם</div>
          </div>
          <div className="featureCard">
            <div className="featureTitle">בטוח ומאובטח</div>
            <div className="featureSub">מערכת דיווחים ומודרציה</div>
          </div>
          <div className="featureCard">
            <div className="featureTitle">פילטרים מתקדמים</div>
            <div className="featureSub">עם חשבון פרימיום</div>
          </div>
        </section>

        <section className="ageGate">
          <div className="ageWarning">אזהרת גיל +18</div>
          <label className="ageCheck">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
            />
            אני מאשר/ת שאני מעל גיל 18 ומסכימ/ה לתנאי השימוש
          </label>
          <button
            className="ctaStart"
            disabled={!ageConfirmed}
            onClick={() => {
              setOnboardingDone(true);
              start();
            }}
          >
            התחל צ׳אט עכשיו
          </button>
        </section>

        <footer className="bottomNav">
          <div className="navItem">בית</div>
          <div className="navItem">פרימיום</div>
          <div className="navItem">פרופיל</div>
          <div className="navItem">ניהול</div>
        </footer>
      </div>
    );
  }

  return (
    <div className="app rtl">
      <header className="topbar">
        <div className="onlinePill">
          מחובר <span className="dot" />
        </div>
        <div className="statusPill">
          {queueInfo
            ? `תור #${queueInfo.position} · ETA ${queueInfo.etaSec}s · המתנה ${queueInfo.waitedSec}s`
            : status}
        </div>
      </header>

      <main className="stage">
        <div className="videoStage">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="stageVideo"
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="pip"
          />

          {!isInCall && (
            <div className="stageOverlay">
              <div className="overlayIcon">📹</div>
              <div className="overlayText">מחובר!</div>
            </div>
          )}

          <div className="placeholderBar">
            placeholder זהו - כרגע יתווסף WebRTC הבא
          </div>
        </div>

        {showChat && (
          <aside className="chatPanel">
            <div className="chatHeader">צ׳אט טקסט</div>
            <div className="chatBody">
              {chat.length === 0 ? (
                <div className="empty">
                  {isInCall ? "תגידו שלום 👋" : "התחל התאמה כדי לצ׳וטט…"}
                </div>
              ) : (
                chat.map((m) => (
                  <div key={m.id} className={`bubble ${m.mine ? "mine" : ""}`}>
                    {m.text}
                  </div>
                ))
              )}
            </div>
            <div className="chatInput">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={isInCall ? "כתבו הודעה…" : "ממתין להתאמה…"}
                disabled={!isInCall}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendChat();
                }}
              />
              <button className="btn" onClick={sendChat} disabled={!isInCall}>
                שלח
              </button>
            </div>
          </aside>
        )}
      </main>

      <div className="controlBar">
        <button className="ctrl danger" onClick={stop} title="סיום">
          ✖
        </button>
        <button
          className={`ctrl ${micOn ? "" : "off"}`}
          onClick={toggleMic}
          title="מיקרופון"
        >
          🎤
        </button>
        <button className="ctrl" onClick={next} title="הבא">
          ⏭
        </button>
        <button
          className={`ctrl ${camOn ? "" : "off"}`}
          onClick={toggleCam}
          title="מצלמה"
        >
          📷
        </button>
        <button
          className="ctrl"
          onClick={() => setShowChat((v) => !v)}
          title="צ׳אט"
        >
          💬
        </button>
      </div>

      <footer className="bottomNav">
        <div className="navItem">בית</div>
        <div className="navItem">פרימיום</div>
        <div className="navItem">פרופיל</div>
        <div className="navItem">ניהול</div>
      </footer>
    </div>
  );
}
