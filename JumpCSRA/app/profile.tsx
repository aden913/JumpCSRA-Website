import React, { useState, useEffect } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth, firestore } from "./components/FirebaseConfig";
import { onAuthStateChanged, unlink  } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import "./styles/profile.css";

const TABS = ["Profile Information", "Past Events"];

export default function Profile() {
  const [canEditEmail, setCanEditEmail] = useState(false);
  const [canEditPassword, setCanEditPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [emailChangeMsg, setEmailChangeMsg] = useState<string | null>(null);
  const [passwordChangeMsg, setPasswordChangeMsg] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<"email" | "password" | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState(0);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [guest, setGuest] = useState(false);

  // New states for email verification flow
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [showVerifyNewEmail, setShowVerifyNewEmail] = useState(false);

  const navigate = useNavigate();

  // 🔐 Re-authenticate user
  const handleConfirmPassword = async () => {
    if (!user || !profile.email) return;
    setAuthError(null);
    try {
      const { EmailAuthProvider, reauthenticateWithCredential } = await import("firebase/auth");
      const credential = EmailAuthProvider.credential(profile.email, confirmPassword);
      await reauthenticateWithCredential(user, credential);

      if (showPasswordModal === "email") setCanEditEmail(true);
      if (showPasswordModal === "password") setCanEditPassword(true);

      setShowPasswordModal(null);
      setConfirmPassword("");
    } catch (err: any) {
      if (err.code === "auth/wrong-password") {
        setAuthError("Incorrect password. Please try again.");
      } else {
        setAuthError("Authentication failed. Please try again.");
      }
    }
  };

  // 🔄 Load user + Firestore profile
  useEffect(() => {
     // On mount, restore pendingEmail from localStorage if present
  const storedPendingEmail = localStorage.getItem("pendingEmail");
  if (storedPendingEmail) {
    setPendingEmail(storedPendingEmail);
    setShowVerifyNewEmail(true);
  }
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setGuest(true);
        setLoading(false);
        return;
      }

    await u.reload(); // Refresh user info from Firebase

      setUser(u);

      // If pendingEmail and user.emailVerified, unlink Google
    if (pendingEmail && u.email === pendingEmail && u.emailVerified) {
      try {
        await unlink(u, "google.com");
        setPendingEmail(null);
        localStorage.removeItem("pendingEmail");
        setShowVerifyNewEmail(false);
        setEmailChangeMsg("Email verified and Google account unlinked.");
      } catch (err: any) {
        setEmailChangeMsg("Email verified, but failed to unlink Google: " + err.message);
      }
    }

      const db = firestore;
      const docRef = doc(db, "users", u.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setProfile((prev) => ({
          ...prev,
          ...docSnap.data(),
        }));
      } else {
        setProfile({
          ...profile,
          name: u.displayName || "",
          email: u.email || "",
          phone: "",
          company: "",
          address: "",
          city: "",
          state: "",
          zip: "",
        });
      }

      // 🔄 Always sync email from Firebase Auth to Firestore
      if (u.email && profile.email !== u.email) {
        await updateDoc(docRef, { email: u.email });
        setProfile((prev) => ({ ...prev, email: u.email || "" }));
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [pendingEmail]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!user) return;
    setEditing(false);

    const db = firestore;
    const docRef = doc(db, "users", user.uid);

    await updateDoc(docRef, {
      phone: profile.phone,
      company: profile.company,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zip: profile.zip,
    });
  };

  if (loading) return <div className="profile-loading">Loading...</div>;
  if (guest) {
    return (
      <div className="profile-guest">
        <h2>Sign in to view your profile</h2>
        <button className="profile-signin-btn" onClick={() => navigate("/")}>
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-left">
        <div className="profile-tabs">
          {TABS.map((tab, idx) => (
            <button
              key={tab}
              className={`profile-tab${activeTab === idx ? " active" : ""}`}
              onClick={() => setActiveTab(idx)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="profile-right">
        {activeTab === 0 ? (
          <div className="profile-info">
            {/* Name */}
            <div className="profile-row">
              <label>Name:</label>
              <span>{profile.name}</span>
            </div>

            {/* Email */}
            <div className="profile-row">
              <label>Email:</label>
              {showVerifyNewEmail && pendingEmail ? (
                <div className="verify-msg">
                  <p>
                    We’ve sent a verification link to <b>{pendingEmail}</b>.
                  </p>
                  <p>Please check your inbox and confirm your new email address.</p>

                  <button
                    className="resend-btn"
                    onClick={async () => {
                      if (user) {
                        const { verifyBeforeUpdateEmail } = await import("firebase/auth");
                        const verificationUrl = "http://localhost:5173/profile";
                        console.log("Sending verification to:", verificationUrl);
                        await verifyBeforeUpdateEmail(user, pendingEmail, {
                          url: "http://localhost:5173/profile",
                          handleCodeInApp: true,
                        });
                        setEmailChangeMsg("Verification email resent!");
                      }
                    }}
                  >
                    Resend Verification Email
                  </button>

                  <button
                    className="back-btn"
                    onClick={() => {
                      setShowVerifyNewEmail(false);
                      setPendingEmail(null);
                      localStorage.removeItem("pendingEmail");
                    }}
                  >
                    Cancel
                  </button>

                  {emailChangeMsg && (
                    <div style={{ marginTop: "0.5rem", color: "#1976d2" }}>
                      {emailChangeMsg}
                    </div>
                  )}
                </div>
              ) : canEditEmail ? (
                <>
                  <input
                    name="newEmail"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter new email"
                    style={{ width: "60%" }}
                  />
                 <button
  className="profile-save-btn"
  onClick={async () => {
    setEmailChangeMsg(null);
    try {
      if (!user) return;
      const { verifyBeforeUpdateEmail } = await import("firebase/auth");
      console.log("verifyBeforeUpdateEmail:", {
        user,
        newEmail,
        url: "http://localhost:5173/profile",
      });
      await verifyBeforeUpdateEmail(user, newEmail, {
        url: "http://localhost:5173/profile",
        handleCodeInApp: true,
      });

      setPendingEmail(newEmail);
      localStorage.setItem("pendingEmail", newEmail);
      setShowVerifyNewEmail(true);
      setCanEditEmail(false);
    } catch (err: any) {
      console.error("verifyBeforeUpdateEmail error:", err);
      if (err.code === "auth/email-already-in-use") {
        setEmailChangeMsg("That email is already in use.");
      } else if (err.code === "auth/requires-recent-login") {
        setEmailChangeMsg("Please re-login to confirm this action.");
      } else if (err.code === "auth/invalid-continue-uri") {
        setEmailChangeMsg("The verification link is not allowed. Check your Firebase authorized domains.");
      } else {
        setEmailChangeMsg(err.message || "Failed to update email");
      }
    }
  }}
>
  Save
</button>
                  <button
                    className="profile-edit-btn"
                    style={{ marginLeft: "1rem" }}
                    onClick={() => {
                      setCanEditEmail(false);
                      setNewEmail("");
                    }}
                  >
                    Cancel
                  </button>
                  {emailChangeMsg && (
                    <div style={{ color: "#c00", marginTop: "0.5rem" }}>{emailChangeMsg}</div>
                  )}
                </>
              ) : (
                <>
                  <span>{profile.email}</span>
                  <button
                    className="profile-edit-btn"
                    onClick={() => setShowPasswordModal("email")}
                  >
                    Change (Re-login)
                  </button>
                </>
              )}
            </div>

            {/* Phone */}
            <div className="profile-row">
              <label>Phone:</label>
              <input
                name="phone"
                value={profile.phone}
                onChange={handleChange}
                disabled={!editing}
              />
            </div>

            {/* Password */}
            <div className="profile-row">
              <label>Password:</label>
              {canEditPassword ? (
                <>
                  <input
                    name="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    style={{ width: "60%" }}
                  />
                  <button
                    className="profile-save-btn"
                    onClick={async () => {
                      setPasswordChangeMsg(null);

                      if (
                        newPassword.length < 8 ||
                        !/[A-Z]/.test(newPassword) ||
                        !/[0-9]/.test(newPassword)
                      ) {
                        setPasswordChangeMsg(
                          "Password must be at least 8 characters, include a number and an uppercase letter."
                        );
                        return;
                      }

                      try {
                        if (!user) return;
                        const { updatePassword } = await import("firebase/auth");
                        await updatePassword(user, newPassword);
                        setPasswordChangeMsg("Password updated!");
                        setCanEditPassword(false);
                      } catch (err: any) {
                        setPasswordChangeMsg(err.message || "Failed to update password");
                      }
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="profile-edit-btn"
                    style={{ marginLeft: "1rem" }}
                    onClick={() => {
                      setCanEditPassword(false);
                      setNewPassword("");
                    }}
                  >
                    Cancel
                  </button>
                  {passwordChangeMsg && (
                    <div
                      style={{
                        color: passwordChangeMsg.includes("updated") ? "#1976d2" : "#c00",
                        marginTop: "0.5rem",
                      }}
                    >
                      {passwordChangeMsg}
                    </div>
                  )}
                </>
              ) : (
                <button
                  className="profile-edit-btn"
                  onClick={() => setShowPasswordModal("password")}
                >
                  View/Change (Re-login)
                </button>
              )}
            </div>

            {/* Re-authentication modal */}
            {showPasswordModal && (
              <div
                className="modal-overlay fade-in"
                onClick={() => setShowPasswordModal(null)}
              >
                <div className="modal-shadow" />
                <div
                  className="modal-content popup"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="modal-title">Confirm Your Password</h2>
                  <div style={{ marginBottom: "1rem" }}>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="identifier-input"
                      style={{ width: "100%", padding: "0.5rem", fontSize: "1rem" }}
                    />
                  </div>
                  {authError && (
                    <div style={{ color: "#c00", marginBottom: "1rem" }}>{authError}</div>
                  )}
                  <button className="profile-save-btn" onClick={handleConfirmPassword}>
                    Confirm
                  </button>
                  <button
                    className="profile-edit-btn"
                    style={{ marginLeft: "1rem" }}
                    onClick={() => setShowPasswordModal(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Company + Address */}
            <div className="profile-row">
              <label>Company/Org:</label>
              <input
                name="company"
                value={profile.company}
                onChange={handleChange}
                disabled={!editing}
              />
            </div>
            <div className="profile-row">
              <label>Address:</label>
              <input
                name="address"
                value={profile.address}
                onChange={handleChange}
                disabled={!editing}
              />
            </div>
            <div className="profile-row">
              <label>City:</label>
              <input
                name="city"
                value={profile.city}
                onChange={handleChange}
                disabled={!editing}
              />
            </div>
            <div className="profile-row">
              <label>State:</label>
              <input
                name="state"
                value={profile.state}
                onChange={handleChange}
                disabled={!editing}
              />
            </div>
            <div className="profile-row">
              <label>Zip:</label>
              <input
                name="zip"
                value={profile.zip}
                onChange={handleChange}
                disabled={!editing}
              />
            </div>

            <div className="profile-actions">
              {editing ? (
                <button className="profile-save-btn" onClick={handleSave}>
                  Save
                </button>
              ) : (
                <button className="profile-edit-btn" onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
            </div>
            {/* Delete Account Button */}
<div style={{ marginTop: "2rem", textAlign: "center" }}>
  <button
    className="profile-delete-btn"
    style={{ background: "#c00", color: "#fff", padding: "0.75rem 2rem", borderRadius: "6px", border: "none", fontWeight: "bold" }}
    onClick={async () => {
      if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) return;
      if (!user) return;
      try {
        // Delete Firestore user document
        const docRef = doc(firestore, "users", user.uid);
        await updateDoc(docRef, { deleted: true }); // Optional: mark as deleted before actual delete
        await (await import("firebase/firestore")).deleteDoc(docRef);

        // Delete Firebase Auth user
        await user.delete();

        // Sign out and redirect
        await auth.signOut();
        navigate("/");
      } catch (err: any) {
        alert("Failed to delete account: " + (err.message || err));
      }
    }}
  >
    Delete Account
  </button>
</div>
          </div>
        ) : (
          <div className="profile-events">
            <h3>Past Events</h3>
            <div className="profile-events-placeholder">Your past events will appear here.</div>
          </div>
        )}
      </div>
    </div>
  );
}
