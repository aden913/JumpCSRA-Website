import React, { useState, useEffect } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { useNavigate } from "react-router";
import { RouterNav } from "./components/RouterNav";
import { GooglePlacesAutocomplete } from "./components/GooglePlacesAutocomplete";
import { auth, firestore } from "./components/FirebaseConfig";
import { onAuthStateChanged, unlink  } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import "./styles/profile.css";
import { useInflateables } from "./hooks/useInflateables";
import { useCategories } from "./hooks/useCategories";
import type { CartItem } from "./components/CartSidebar";

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

  // Add phone validation state
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const navigate = useNavigate();
  
  // Add hooks for navbar functionality
  const inflateables = useInflateables();
  const categories = useCategories(inflateables);
  
  // Cart and calendar data for navbar
  const [cart, setCart] = useState<CartItem[]>([]);
  const [calendarDateRange, setCalendarDateRange] = useState<[Date | null, Date | null]>([null, null]);

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
        const data = docSnap.data();
        // Convert phone to E.164 format if it exists and doesn't start with +
        let phone = data.phone || "";
        if (phone && !phone.startsWith("+")) {
          // Assume US number if no country code
          phone = phone.startsWith("1") ? `+${phone}` : `+1${phone}`;
        }
        setProfile((prev) => ({
          ...prev,
          ...data,
          phone,
        }));
      } else {
        // Convert phone to E.164 format if it exists and doesn't start with +
        let phone = u.phoneNumber || "";
        if (phone && !phone.startsWith("+")) {
          phone = phone.startsWith("1") ? `+${phone}` : `+1${phone}`;
        }
        
        setProfile({
          ...profile,
          name: u.displayName || "",
          email: u.email || "",
          phone,
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

  // Load cart and calendar data for navbar
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
      }
    }

    const savedDates = localStorage.getItem('calendarDateRange');
    if (savedDates) {
      try {
        const parsed = JSON.parse(savedDates);
        setCalendarDateRange([
          parsed[0] ? new Date(parsed[0]) : null,
          parsed[1] ? new Date(parsed[1]) : null,
        ]);
      } catch (error) {
        console.error('Error loading calendar dates from localStorage:', error);
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  // PhoneInput change handler
  const handlePhoneChange = (value: string | undefined) => {
    setProfile({ ...profile, phone: value ?? "" });
    setPhoneError(null);
  };

  // Handle Google Places address selection
  const handlePlaceSelected = (place: google.maps.places.PlaceResult) => {
    if (!place.address_components) return;

    const addressComponents = place.address_components;
    let streetNumber = '';
    let streetName = '';
    let city = '';
    let state = '';
    let zipCode = '';

    // Extract address components
    addressComponents.forEach(component => {
      const types = component.types;
      
      if (types.includes('street_number')) {
        streetNumber = component.long_name;
      } else if (types.includes('route')) {
        streetName = component.long_name;
      } else if (types.includes('locality') || types.includes('administrative_area_level_3')) {
        city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        state = component.short_name;
      } else if (types.includes('postal_code')) {
        zipCode = component.long_name;
      }
    });

    // Build full address
    const fullAddress = `${streetNumber} ${streetName}`.trim();

    // Update profile with all address information
    setProfile(prev => ({
      ...prev,
      address: fullAddress,
      city: city,
      state: state,
      zip: zipCode
    }));
  };

  // Handle manual address input change
  const handleAddressChange = (value: string) => {
    setProfile({ ...profile, address: value });
  };

  const handleSave = async () => {
    if (!user) return;
    setEditing(false);

    // Ensure phone number is in E.164 format
    let formattedPhone = profile.phone;
    if (formattedPhone && !formattedPhone.startsWith("+")) {
      // Assume US number if no country code
      formattedPhone = formattedPhone.startsWith("1") ? `+${formattedPhone}` : `+1${formattedPhone}`;
    }

    // Validate phone number (must be E.164 format and at least 10 digits)
    if (!formattedPhone || !/^\+?[1-9]\d{9,14}$/.test(formattedPhone)) {
      setPhoneError("Please enter a valid phone number.");
      setEditing(true);
      return;
    }

    const db = firestore;
    const docRef = doc(db, "users", user.uid);

    await updateDoc(docRef, {
      phone: formattedPhone,
      company: profile.company,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zip: profile.zip,
    });

    // Update local state with formatted phone
    setProfile(prev => ({ ...prev, phone: formattedPhone }));
  };

  if (loading) return <div className="profile-loading">Loading...</div>;
  if (guest) {
    return (
      <div className="profile-guest">
        <h2>Sign in to view your profile</h2>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <button className="profile-signin-btn" onClick={() => navigate("/")}>
            Sign In
          </button>
          <button className="profile-signin-btn" onClick={() => navigate("/home")}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <RouterNav />
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
              <input
                name="name"
                value={profile.name}
                onChange={handleChange}
                disabled={!editing}
                style={!editing ? { backgroundColor: "#f0f0f0", color: "#888" } : {}}
              />
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
                  <input
                    name="email"
                    value={profile.email}
                    disabled
                    style={{ backgroundColor: "#f0f0f0", color: "#888" }}
                  />
                  <button
                    className="profile-edit-btn"
                    onClick={() => setShowPasswordModal("email")}
                  >
                    Change
                  </button>
                </>
              )}
            </div>

            {/* Phone */}
            <div className="profile-row">
              <label>Phone:</label>
              {editing ? (
                <>
                  <PhoneInput
                    defaultCountry="US"
                    value={profile.phone}
                    onChange={handlePhoneChange}
                    className="identifier-input"
                    disabled={!editing}
                    placeholder="Enter phone number"
                  />
                  {phoneError && (
                    <div style={{ color: "#c00", marginTop: "0.25rem" }}>{phoneError}</div>
                  )}
                </>
              ) : (
                <PhoneInput
                  defaultCountry="US"
                  value={profile.phone}
                  onChange={() => {}}
                  className="identifier-input"
                  disabled
                  placeholder="Enter phone number"
                />
              )}
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
                style={!editing ? { backgroundColor: "#f0f0f0", color: "#888" } : {}}
              />
            </div>
            <div className="profile-row">
              <label>Address:</label>
              <GooglePlacesAutocomplete
                name="address"
                value={profile.address}
                onChange={handleAddressChange}
                onPlaceSelected={handlePlaceSelected}
                disabled={!editing}
                style={!editing ? { backgroundColor: "#f0f0f0", color: "#888" } : {}}
                placeholder="Enter your address"
              />
            </div>
            <div className="profile-row">
              <label>City:</label>
              <input
                name="city"
                value={profile.city}
                onChange={handleChange}
                disabled={!editing}
                style={!editing ? { backgroundColor: "#f0f0f0", color: "#888" } : {}}
              />
            </div>
            <div className="profile-row">
              <label>State:</label>
              <input
                name="state"
                value={profile.state}
                onChange={handleChange}
                disabled={!editing}
                style={!editing ? { backgroundColor: "#f0f0f0", color: "#888" } : {}}
              />
            </div>
            <div className="profile-row">
              <label>Zip:</label>
              <input
                name="zip"
                value={profile.zip}
                onChange={handleChange}
                disabled={!editing}
                style={!editing ? { backgroundColor: "#f0f0f0", color: "#888" } : {}}
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
            
            {/* Account Actions */}
            <div style={{ marginTop: "2rem", textAlign: "center", display: "flex", gap: "1rem", justifyContent: "center" }}>
              {/* Sign Out Button */}
              <button
                className="profile-signout-btn"
                style={{ background: "#1976d2", color: "#fff", padding: "0.75rem 2rem", borderRadius: "6px", border: "none", fontWeight: "bold" }}
                onClick={async () => {
                  try {
                    await auth.signOut();
                    navigate("/");
                  } catch (err: any) {
                    alert("Failed to sign out: " + (err.message || err));
                  }
                }}
              >
                Sign Out
              </button>
              
              {/* Delete Account Button */}
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

        {/* Back button */}
      <div style={{ marginBottom: "1rem" }}>
        <button
          className="profile-back-btn"
          onClick={() => navigate("/home")}
        >
          &larr; Back
        </button>
      </div>
      </div>
    </div>
    </>
  );
}
