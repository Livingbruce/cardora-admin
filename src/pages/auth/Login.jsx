import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../utils/supabase";
import cardoralogo from "../../assets/cardoralogo.jpeg";
import {
  clearTabSessionId,
  setTabSessionId
} from "../../utils/sessionGuard";
import "../../styles/auth/Login.css";

const toAuthLoginId = (cleanUsername) =>
  cleanUsername.includes("@")
    ? cleanUsername
    : `${cleanUsername}@cardora.local`;

const UPPER_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER_CHARS = "abcdefghjkmnpqrstuvwxyz";
const DIGIT_CHARS = "23456789";
const ALL_CAPTCHA_CHARS = `${UPPER_CHARS}${LOWER_CHARS}${DIGIT_CHARS}`;

const getRandomUint32 = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
};

const pickFromPool = (pool) => pool[getRandomUint32() % pool.length];

const generateCaptchaCode = (length = 6) => {
  const safeLength = Math.max(4, length);
  const chars = [
    pickFromPool(UPPER_CHARS),
    pickFromPool(LOWER_CHARS),
    pickFromPool(DIGIT_CHARS)
  ];

  while (chars.length < safeLength) {
    chars.push(pickFromPool(ALL_CAPTCHA_CHARS));
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = getRandomUint32() % (i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join("");
};

const isExactCaptchaMatch = (input, expected) => {
  if (input.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i += 1) {
    if (input[i] !== expected[i]) {
      return false;
    }
  }
  return true;
};

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaCode, setCaptchaCode] = useState(() => generateCaptchaCode(6));
  const [websiteTrap, setWebsiteTrap] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const canvasRef = useRef(null);
  const formMountTimeRef = useRef(null);
  const navigate = useNavigate();

  const drawCaptchaCanvas = useCallback((code) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() * 8 - 4), height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y + (Math.random() * 6 - 3));
      ctx.stroke();
    }

    for (let i = 0; i < 140; i += 1) {
      ctx.fillStyle = `rgba(148, 163, 184, ${(0.22 + Math.random() * 0.52).toFixed(2)})`;

      ctx.beginPath();
      ctx.arc(
        Math.random() * width,
        Math.random() * height,
        0.9 + Math.random() * 1.9,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    for (let i = 0; i < 7; i += 1) {
      ctx.strokeStyle =
        i % 2 === 0
          ? "rgba(250, 204, 21, 0.45)"
          : "rgba(56, 189, 248, 0.45)";

      ctx.lineWidth = 1.3 + Math.random() * 1.1;
      ctx.beginPath();

      ctx.moveTo(0, Math.random() * height);

      ctx.bezierCurveTo(
        width * 0.25,
        Math.random() * height,
        width * 0.75,
        Math.random() * height,
        width,
        Math.random() * height
      );

      ctx.stroke();
    }

    const step = width / (code.length + 1);

    for (let i = 0; i < code.length; i += 1) {
      const char = code[i];
      const x = step * (i + 1) + (Math.random() * 4 - 2);
      const y = height * 0.55 + (Math.random() * 12 - 6);
      const angle = Math.random() * 0.72 - 0.36;
      const skewX = Math.random() * 0.42 - 0.21;

      ctx.save();
      ctx.transform(1, 0, skewX, 1, x, y);
      ctx.rotate(angle);
      ctx.font = "800 22px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "rgba(2, 6, 23, 0.85)";
      ctx.strokeText(char, 0, 0);
      ctx.fillStyle = i % 2 === 0 ? "#f8fafc" : "#facc15";
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }
  }, []);

  const refreshCaptcha = useCallback(() => {
    const nextCode = generateCaptchaCode(6);

    setCaptchaCode(nextCode);
    setCaptchaInput("");
    formMountTimeRef.current = Date.now();
    drawCaptchaCanvas(nextCode);
  }, [drawCaptchaCanvas]);

  useEffect(() => {
    formMountTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    drawCaptchaCanvas(captchaCode);
  }, [captchaCode, drawCaptchaCanvas]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (websiteTrap.trim() !== "") {
      setErrorMsg("Verification failed. Please try again.");
      refreshCaptcha();
      return;
    }

    const mountedAt = formMountTimeRef.current;
    const elapsedMs =
      mountedAt === null ? 0 : Date.now() - mountedAt;

    if (elapsedMs < 1200) {
      setErrorMsg("Please complete the captcha before submitting.");
      refreshCaptcha();
      return;
    }

    const submittedCaptcha = captchaInput.trim();
    if (!isExactCaptchaMatch(submittedCaptcha, captchaCode)) {
      setErrorMsg(
        "Wrong Captcha please try again!"
      );
      refreshCaptcha();
      return;
    }

    const cleanUsername = username.trim().replace(/^@/, "").toLowerCase();

    if (!cleanUsername || !password) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: toAuthLoginId(cleanUsername),
          password
        });

      if (authError || !authData?.user) {
        clearTabSessionId();
        setErrorMsg("Invalid admin username or password.");
        refreshCaptcha();
        return;
      }

      const authUserId = authData.user.id;

      const { data: adminRecord, error: adminError } = await supabase
        .from("admins")
        .select("id, uid, username, role, is_active")
        .eq("uid", authUserId)
        .maybeSingle();

      if (adminError || !adminRecord || adminRecord.role !== "admin") {
        await supabase.auth.signOut({ scope: "local" });
        clearTabSessionId();
        setErrorMsg("Access denied: account is not an active admin.");
        refreshCaptcha();
        return;
      }

      if (adminRecord.is_active === false) {
        await supabase.auth.signOut({ scope: "local" });
        clearTabSessionId();
        setErrorMsg("This admin account is disabled.");
        refreshCaptcha();
        return;
      }

      const tabSessionId = setTabSessionId();

      const { error: sessionError } = await supabase
        .from("admins")
        .update({ active_session_id: tabSessionId })
        .eq("id", adminRecord.id);

      if (sessionError) {
        await supabase.auth.signOut({ scope: "local" });
        clearTabSessionId();
        setErrorMsg("Failed to initialize active admin session.");
        refreshCaptcha();
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Admin login error:", err);
      clearTabSessionId();
      setErrorMsg("An unexpected error occurred during login.");
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <form onSubmit={handleLogin} className="login-form">
        <img
          src={cardoralogo}
          alt="Cardora Logo"
          className="login-logo"
        />

        <h2 className="login-heading">CARDORA</h2>

        {errorMsg && (
          <div
            style={{
              backgroundColor: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fca5a5",
              borderRadius: "6px",
              padding: "10px 12px",
              marginBottom: "14px",
              fontSize: "0.88rem",
              fontWeight: 600
            }}
          >
            {errorMsg}
          </div>
        )}

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-9999px",
            width: "1px",
            height: "1px",
            overflow: "hidden"
          }}
        >
          <label htmlFor="companyWebsite">Website</label>

          <input
            id="companyWebsite"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={websiteTrap}
            onChange={(e) => setWebsiteTrap(e.target.value)}
          />
        </div>

        <div className="login-input-group">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            required
            className="login-input"
          />
        </div>

        <div className="login-input-group">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            className="login-input"
          />
        </div>

        <div className="login-input-group">
          <div
            style={{
              marginBottom: "8px"
            }}
          >
            <canvas
              ref={canvasRef}
              width={220}
              height={52}
              aria-label="Captcha image"
              style={{
                width: "100%",
                height: "52px",
                display: "block",
                borderRadius: "6px",
                border: "1px solid #334155"
              }}
            />
          </div>

          <input
            type="text"
            value={captchaInput}
            onChange={(e) => setCaptchaInput(e.target.value)}
            placeholder="Captcha"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            required
            className="login-input"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="login-submit-btn"
        >
          {loading ? "Please wait..." : "Login"}
        </button>
      </form>
    </div>
  );
}