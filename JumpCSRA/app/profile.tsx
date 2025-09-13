import React, { useState, useEffect } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import "./styles/profile.css";

const TABS = ["Profile Information", "Past Events"];

export default function Profile() {
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
    zip: ""
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [guest, setGuest] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setGuest(true);
        setLoading(false);
        return;
      }
      setUser(u);
      const db = getFirestore();
      const docRef = doc(db, "users", u.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile({ ...profile, ...docSnap.data() });
      } else {
        setProfile({ ...profile, name: u.displayName || "", email: u.email || "" });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!user) return;
    setEditing(false);
    const db = getFirestore();
    if (!user) return;
    const docRef = doc(db, "users", user.uid);
    await updateDoc(docRef, {
      phone: profile.phone,
      company: profile.company,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zip: profile.zip
    });
  };

  if (loading) return <div className="profile-loading">Loading...</div>;
  if (guest) {
    return (
      <div className="profile-guest">
        <h2>Sign in to view your profile</h2>
        <button className="profile-signin-btn" onClick={() => navigate("/login")}>Sign In</button>
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
            <div className="profile-row">
              <label>Name:</label>
              <span>{profile.name}</span>
            </div>
            <div className="profile-row">
              <label>Email:</label>
              <span>{profile.email}</span>
              <button className="profile-edit-btn" onClick={() => navigate("/login")}>Change (Re-login)</button>
            </div>
            <div className="profile-row">
              <label>Phone:</label>
              <input name="phone" value={profile.phone} onChange={handleChange} disabled={!editing} />
            </div>
            <div className="profile-row">
              <label>Password:</label>
              <button className="profile-edit-btn" onClick={() => navigate("/login")}>View/Change (Re-login)</button>
            </div>
            <div className="profile-row">
              <label>Company/Org:</label>
              <input name="company" value={profile.company} onChange={handleChange} disabled={!editing} />
            </div>
            <div className="profile-row">
              <label>Address:</label>
              <input name="address" value={profile.address} onChange={handleChange} disabled={!editing} />
            </div>
            <div className="profile-row">
              <label>City:</label>
              <input name="city" value={profile.city} onChange={handleChange} disabled={!editing} />
            </div>
            <div className="profile-row">
              <label>State:</label>
              <input name="state" value={profile.state} onChange={handleChange} disabled={!editing} />
            </div>
            <div className="profile-row">
              <label>Zip:</label>
              <input name="zip" value={profile.zip} onChange={handleChange} disabled={!editing} />
            </div>
            <div className="profile-actions">
              {editing ? (
                <button className="profile-save-btn" onClick={handleSave}>Save</button>
              ) : (
                <button className="profile-edit-btn" onClick={() => setEditing(true)}>Edit</button>
              )}
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
