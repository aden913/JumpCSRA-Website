import React from "react";
import type { Route } from "./+types/privacy-policy";
import "../styles/privacy-policy.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Privacy Policy - Jump CSRA" },
    {
      name: "description",
      content: "Privacy Policy for Jump CSRA customer information, bookings, marketing communications, and third-party services.",
    },
  ];
}

const sections = [
  {
    title: "Information We Collect",
    body: [
      {
        heading: "Personal Information",
        intro: "When you create an account, submit a booking request, or contact us, we may collect:",
        items: ["Name", "Email address", "Phone number", "Delivery or event address", "Account information"],
      },
      {
        heading: "Booking Information",
        intro: "When placing a rental order or booking, we may collect:",
        items: [
          "Event dates and times",
          "Rental items selected",
          "Delivery details",
          "Booking notes or preferences",
          "Payment status information",
        ],
      },
      {
        heading: "Technical Information",
        intro: "We may automatically collect limited technical information including:",
        items: ["IP address", "Browser type", "Device information", "Website usage information", "Cookies and local storage preferences"],
      },
    ],
  },
  {
    title: "How We Use Information",
    intro: "We use collected information to:",
    items: [
      "Process and manage bookings",
      "Deliver rental services",
      "Communicate regarding orders and reservations",
      "Provide customer support",
      "Improve website functionality and user experience",
      "Prevent fraud or misuse",
      "Send account-related notifications",
      "Send promotional or marketing emails when users opt in",
    ],
  },
  {
    title: "Marketing Emails and Communications",
    paragraphs: [
      "Users may choose to opt in to receive promotional emails, discounts, special offers, and updates from JumpCSRA.",
      "Marketing emails are optional, and users may unsubscribe at any time using the unsubscribe link included in marketing emails or through their account settings.",
      "Even if a user unsubscribes from marketing communications, we may still send transactional or service-related emails including:",
    ],
    items: ["Booking confirmations", "Payment receipts", "Delivery reminders", "Account notifications", "Customer support communications"],
  },
  {
    title: "Text Messaging",
    paragraphs: [
      "If users provide a phone number, we may send text messages related to bookings, delivery coordination, customer support, or account-related notifications.",
      "Message and data rates may apply depending on the user's mobile carrier.",
      "Users may opt out of non-essential text communications where applicable.",
    ],
  },
  {
    title: "Payment Information",
    paragraphs: [
      "Payments are processed through third-party payment providers including PayPal. We do not store full payment card information on our servers.",
      "Please review the privacy policies of third-party payment providers for additional information regarding their handling of payment data.",
    ],
  },
  {
    title: "Third-Party Services",
    intro: "We may use trusted third-party services to operate portions of our website and business operations, including but not limited to:",
    items: ["PayPal", "Firebase", "SendGrid", "Twilio", "Google services and APIs"],
    paragraphs: ["These services may process limited information as necessary to provide their functionality."],
  },
  {
    title: "Cookies and Local Storage",
    intro: "Our website may use cookies and local storage technologies to:",
    items: ["Maintain user sessions", "Remember preferences", "Improve website performance", "Enhance user experience"],
    paragraphs: ["Users may disable cookies through their browser settings, though some website functionality may be affected."],
  },
  {
    title: "Data Retention",
    intro: "We retain customer information for as long as reasonably necessary to:",
    items: ["Provide services", "Maintain business records", "Comply with legal obligations", "Resolve disputes", "Enforce agreements"],
  },
  {
    title: "Data Security",
    paragraphs: [
      "We implement reasonable administrative, technical, and physical safeguards designed to help protect personal information from unauthorized access, disclosure, or misuse.",
      "However, no method of electronic transmission or storage is completely secure, and we cannot guarantee absolute security.",
    ],
  },
  {
    title: "User Rights and Choices",
    intro: "Users may:",
    items: [
      "Update account information",
      "Opt out of marketing emails",
      "Request deletion of their account or personal information where applicable",
    ],
    paragraphs: ["Requests may be submitted by contacting us directly."],
  },
  {
    title: "Children's Privacy",
    paragraphs: ["Our services are not directed toward children under the age of 13, and we do not knowingly collect personal information directly from children."],
  },
  {
    title: "Changes to This Policy",
    paragraphs: ["We may update this Privacy Policy periodically. Changes will become effective upon posting the updated version on this page."],
  },
];

export default function PrivacyPolicy() {
  return (
    <main className="privacy-policy-page">
      <article className="privacy-policy-container">
        <header className="privacy-policy-header">
          <p className="privacy-policy-kicker">JumpCSRA</p>
          <h1>Privacy Policy</h1>
          <p className="privacy-policy-updated">Last Updated: June 2, 2026</p>
          <p>
            JumpCSRA ("we," "our," or "us") values your privacy and is committed to protecting your personal
            information. This Privacy Policy explains what information we collect, how we use it, and the choices
            you have regarding your information when using our website and services.
          </p>
        </header>

        <div className="privacy-policy-content">
          {sections.map((section) => (
            <section key={section.title} className="privacy-policy-section">
              <h2>{section.title}</h2>
              {"intro" in section && section.intro && <p>{section.intro}</p>}
              {"paragraphs" in section &&
                section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {"items" in section && section.items && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {"body" in section &&
                section.body?.map((group) => (
                  <div key={group.heading} className="privacy-policy-subsection">
                    <h3>{group.heading}</h3>
                    <p>{group.intro}</p>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </section>
          ))}

          <section className="privacy-policy-section privacy-policy-contact">
            <h2>Contact Us</h2>
            <p>If you have questions regarding this Privacy Policy or your information, please contact us at:</p>
            <a href="mailto:jumpcsra@gmail.com">jumpcsra@gmail.com</a>
            <p>JumpCSRA</p>
          </section>
        </div>
      </article>
    </main>
  );
}
