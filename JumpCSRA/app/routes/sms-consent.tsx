import React from "react";
import type { Route } from "./+types/sms-consent";
import "../styles/sms-consent.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "SMS Consent - Jump CSRA" },
    { name: "description", content: "SMS messaging consent and usage policy for Jump CSRA customer communications." }
  ];
}

export default function SMSConsent() {
  return (
    <div className="sms-consent-page">
      <div className="consent-container">
        <header className="consent-header">
          <h1>SMS Messaging Consent</h1>
          <p className="company-info">Jump CSRA Party Rentals</p>
          <p className="address">410 Carolina Springs Rd, North Augusta, SC 29841</p>
        </header>

        <section className="consent-content">
          <h2>How We Use Your Phone Number</h2>
          
          <div className="usage-explanation">
            <p>
              When you provide your phone number to Jump CSRA, we use it exclusively for 
              business communication purposes related to your party rental services.
            </p>

            <h3>Specific Uses Include:</h3>
            <ul>
              <li><strong>Order confirmations</strong> - Confirming your rental booking details</li>
              <li><strong>Delivery coordination</strong> - Scheduling and confirming delivery times</li>
              <li><strong>Customer service</strong> - Responding to questions about your rental</li>
              <li><strong>Event reminders</strong> - Reminding you about upcoming deliveries or pickups</li>
              <li><strong>Issue resolution</strong> - Addressing any problems with your rental equipment</li>
            </ul>
          </div>

          <div className="forwarding-policy">
            <h3>Message Forwarding</h3>
            <p>
              When you send SMS messages to our business number, these messages are automatically 
              forwarded to our business owners' personal phones to ensure prompt response and 
              excellent customer service. This forwarding system allows us to:
            </p>
            <ul>
              <li>Provide faster response times to customer inquiries</li>
              <li>Ensure availability during business hours and emergencies</li>
              <li>Maintain consistent communication throughout your rental experience</li>
            </ul>
          </div>

          <div className="consent-details">
            <h3>Your Consent</h3>
            <p>
              By providing your phone number to Jump CSRA, you consent to:
            </p>
            <ul>
              <li>Receiving SMS messages related to your party rental services</li>
              <li>Having your messages forwarded to our business owners for prompt response</li>
              <li>Standard messaging rates applying as determined by your carrier</li>
            </ul>

            <p>
              <strong>Frequency:</strong> Message frequency varies based on your rental activity and communication needs. 
              We typically send 2-5 messages per rental booking.
            </p>

            <p>
              <strong>Opt-out:</strong> You may opt out of SMS communications at any time by replying 
              "STOP" to any message or by contacting us directly.
            </p>
          </div>

          <div className="privacy-assurance">
            <h3>Privacy Protection</h3>
            <p>
              We take your privacy seriously:
            </p>
            <ul>
              <li>Your phone number is never shared with third parties for marketing purposes</li>
              <li>We only use your number for legitimate business communications</li>
              <li>All forwarded messages remain confidential within our business team</li>
              <li>We comply with all applicable telecommunications and privacy regulations</li>
            </ul>
          </div>

          <div className="contact-info">
            <h3>Questions or Concerns?</h3>
            <p>
              If you have any questions about our SMS usage policy or wish to modify your 
              communication preferences, please contact us:
            </p>
            <ul>
              <li><strong>Phone:</strong> (803) 123-4567</li>
              <li><strong>Email:</strong> info@jumpcsra.com</li>
              <li><strong>Address:</strong> 410 Carolina Springs Rd, North Augusta, SC 29841</li>
            </ul>
          </div>
        </section>

        <footer className="consent-footer">
          <p className="last-updated">Last Updated: December 1, 2025</p>
          <p className="company-footer">© 2025 Jump CSRA Party Rentals. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}