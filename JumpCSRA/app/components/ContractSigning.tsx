import React, { useState, useEffect } from 'react';
import '../styles/ContractSigning.css';

// Contract interfaces
interface ContractSection {
  id: string;
  title: string;
  content: string;
  isInitialed: boolean;
  isFinePrint: boolean;
  initialedAt?: string;
}

interface UserProfile {
  firstName?: string;
  lastName?: string;
  name?: string;
}

interface ContractSigningProps {
  user: any; // Firebase user object
  userProfile: UserProfile | null;
  calendarDateRange?: [Date | null, Date | null];
  deliveryAddress?: string;
  total?: number;
  onContractComplete: (contractData: { 
    sections: ContractSection[], 
    signature: string, 
    initials: string 
  }) => void;
}

export const ContractSigning: React.FC<ContractSigningProps> = ({
  user,
  userProfile,
  calendarDateRange,
  deliveryAddress,
  total,
  onContractComplete
}) => {
  // Contract state
  const [typedSignature, setTypedSignature] = useState<string>("");
  const [customerInitials, setCustomerInitials] = useState<string>("");
  const [contractSections, setContractSections] = useState<ContractSection[]>([]);

  // Initialize contract sections when component mounts
  useEffect(() => {
    if (contractSections.length === 0) {
      const renterName = userProfile?.name || user?.displayName || 'Renter';
      
      const sections: ContractSection[] = [
        {
          id: "renter-responsibilities",
          title: "Renter Responsibilities",
          content: `Renter (${renterName}) agrees to:\n\n1. Provide a 110volt/20amp electric circuit per unit within 75ft, or rent a generator.\n\n2. Ensure Jumpers remove shoes, eyeglasses, and any sharp objects.\n\n3. Supervise jumpers to go down the slide feet first, one rider at a time per lane.\n\n4. In the event of high wind / rain ensure all participants exit the unit.\n\n5. Supervise jumpers to not climb on the outside of the inflatable.\n\n6. Provide a water hose that reaches to the water rental or add one to your rental order.`,
          isInitialed: false,
          isFinePrint: false
        },
        {
          id: "damage-waiver",
          title: "Damage Waiver",
          content: "A $50 temporary damage/cleaning hold (not a charge) will be placed on the renter's card and released after pickup and inspection if the inflatable is returned clean, dry, fully inflated, and undamaged. The $50 may be charged if the unit is damaged, excessively dirty, contains water, is not inflated at pickup, or has food, drinks, candy, pet marks, water balloons, silly string, soap, paint, or other substances on or inside the inflatable.\n\nTo avoid charges, the renter agrees to re-inflate the unit by 7:00 AM, rinse and drain mud as needed, remove all water and debris, and keep the inflatable fully inflated until our team arrives.",
          isInitialed: false,
          isFinePrint: false
        },
        {
          id: "cancellation-policy",
          title: "Cancellation and Rain Policy",
          content: "Once signed, this contract is a legally binding agreement. If you need to cancel or reschedule your rental, please review the following policy:\n\n• Cancel 14+ days before your event: You'll receive a full refund.\n• Cancel within 6–13 days of your event: You'll receive a gift card for 100% of your payment, which can be used for any future rental—no expiration date.\n• Cancel with less than 5 days' notice: You'll receive a gift card for 50% of your payment. The remaining 50% is non-refundable.\n\nIf Jump CSRA cancels due to weather: You will receive a full refund.\n\nWe encourage you to keep an eye on the forecast and communicate with us early if concerns arise. Our goal is to work with you and make sure your event is a success—safely.",
          isInitialed: false,
          isFinePrint: false
        },
        {
          id: "assumption-of-risk",
          title: "Assumption of Risk & Liability Waiver",
          content: "Customer (\"Lessee\") acknowledges and understands that the use of inflatable and amusement rental equipment involves inherent and unavoidable risks, including but not limited to bodily injury, property damage, paralysis, or death. Lessee voluntarily assumes all such risks associated with the delivery, setup, possession, use, operation, and return of the equipment. To the fullest extent permitted by the laws of the States of Georgia and South Carolina, Lessee hereby releases, waives, and discharges Jump CSRA (\"Lessor\"), its owners, officers, employees, and agents from any and all claims, demands, causes of action, or liability arising out of or related to the rental or use of the equipment, except to the extent caused by Lessor's gross negligence or willful misconduct as determined by a court of competent jurisdiction. Lessor shall not be liable for injuries or damages resulting from acts of God, weather conditions, or other circumstances beyond Lessor's reasonable control.",
          isInitialed: false,
          isFinePrint: true
        },
        {
          id: "indemnification",
          title: "Indemnification & Hold Harmless",
          content: "Lessee agrees to indemnify, defend, and hold harmless Jump CSRA, its owners, officers, employees, and agents from and against any and all claims, actions, damages, losses, liabilities, costs, and expenses, including reasonable attorney's fees, arising from or related to Lessee's use, misuse, supervision, or operation of the rental equipment, or from any breach of this Agreement, except to the extent prohibited by applicable law. Lessee further assumes full responsibility for any loss, theft, damage, or destruction of the equipment during the rental period and any extension thereof, regardless of cause, ordinary wear and tear excepted.",
          isInitialed: false,
          isFinePrint: true
        },
        {
          id: "equipment-care",
          title: "Equipment Care, Cleaning, Return & Force Majeure",
          content: "Lessee agrees to properly supervise and care for the rental equipment at all times and to return it in the same condition as received, normal wear and tear excepted. Lessee acknowledges that excessive dirt, sand, mud, food, drink, or other debris may result in additional cleaning fees. Neither party shall be liable for failure or delay in performance due to events beyond their reasonable control, including but not limited to severe weather, natural disasters, acts of God, governmental orders, or other force majeure events.",
          isInitialed: false,
          isFinePrint: true
        },
        {
          id: "governing-law",
          title: "Governing Law, Merger & Severability",
          content: "This Agreement, together with the signed Instruction Manual and Reservation Form, constitutes the entire agreement between Lessor and Lessee and supersedes all prior or contemporaneous agreements or representations. This Agreement shall be governed by and construed in accordance with the laws of the State of Georgia or the State of South Carolina, depending on the location where the rental equipment is delivered and used. Any amendment must be in writing and signed by all parties. If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.",
          isInitialed: false,
          isFinePrint: true
        }
      ];
      setContractSections(sections);
    }
  }, [contractSections.length, userProfile, user]);

  // Auto-generate initials from user profile
  useEffect(() => {
    if (!customerInitials.trim() && userProfile?.firstName && userProfile?.lastName) {
      const firstInitial = userProfile.firstName.charAt(0);
      const lastInitial = userProfile.lastName.charAt(0);
      
      if (firstInitial && lastInitial) {
        const autoInitials = `${firstInitial.toUpperCase()}${lastInitial.toUpperCase()}`;
        setCustomerInitials(autoInitials);
      }
    }
  }, [userProfile, customerInitials]);

  // Focus first unsigned initial box when component mounts
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      const firstUnsignedSection = contractSections.find(section => !section.isFinePrint && !section.isInitialed);
      if (firstUnsignedSection) {
        const firstInitialBox = document.querySelector(`[data-section-id="${firstUnsignedSection.id}"] .initial-box`);
        if (firstInitialBox) {
          firstInitialBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => (firstInitialBox as HTMLElement).focus(), 500);
        }
      } else if (contractSections.length > 0) {
        // All sections are initialed, focus the signature input
        const signatureInput = document.querySelector('.signature-input');
        if (signatureInput) {
          signatureInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => (signatureInput as HTMLElement).focus(), 500);
        }
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [contractSections]);

  // Handle section initialing
  const handleSectionInitial = (sectionId: string) => {
    // Automatically generate initials from user's firstName and lastName
    let autoInitials = 'XX'; // Default fallback
    
    if (userProfile?.firstName && userProfile?.lastName) {
      const firstInitial = userProfile.firstName.charAt(0);
      const lastInitial = userProfile.lastName.charAt(0);
      
      if (firstInitial && lastInitial) {
        autoInitials = `${firstInitial.toUpperCase()}${lastInitial.toUpperCase()}`;
      }
    } else if (customerInitials.trim()) {
      autoInitials = customerInitials.trim();
    }
    
    // Set the initials if not already set
    if (!customerInitials.trim()) {
      setCustomerInitials(autoInitials);
    }
    
    setContractSections(prev => {
      const updated = prev.map(section => 
        section.id === sectionId 
          ? { ...section, isInitialed: !section.isInitialed, initialedAt: new Date().toISOString() }
          : section
      );
      
      // After updating, focus the next unsigned box or signature input
      setTimeout(() => {
        const nextUnsignedSection = updated.find(section => 
          !section.isFinePrint && !section.isInitialed
        );
        
        if (nextUnsignedSection) {
          // Focus next unsigned box
          const nextInitialBox = document.querySelector(`[data-section-id="${nextUnsignedSection.id}"] .initial-box`);
          if (nextInitialBox) {
            nextInitialBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => (nextInitialBox as HTMLElement).focus(), 500);
          }
        } else {
          // All sections are initialed, focus the signature input
          const signatureInput = document.querySelector('.signature-input');
          if (signatureInput) {
            signatureInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => (signatureInput as HTMLElement).focus(), 500);
          }
        }
      }, 150);
      
      return updated;
    });
  };

  // Check if all sections are initialed (excluding fine print)
  const allSectionsInitialed = () => {
    const sectionsRequiringInitials = contractSections.filter(section => !section.isFinePrint);
    return sectionsRequiringInitials.length > 0 && sectionsRequiringInitials.every(section => section.isInitialed);
  };

  // Handle signature click
  const handleSignatureClick = () => {
    // Auto-populate with user's full name if available
    if (!typedSignature.trim() && userProfile?.firstName && userProfile?.lastName) {
      const fullName = `${userProfile.firstName} ${userProfile.lastName}`;
      setTypedSignature(fullName);
    }
  };

  // Clear signature
  const clearSignature = () => {
    setTypedSignature("");
  };

  return (
    <>
      {/* Contract Header */}
      <div className="contract-header">
        <h1 className="contract-title">
          JUMP CSRA PARTY RENTAL AGREEMENT
        </h1>
      </div>

      {/* Contract Details */}
      <div className="contract-details">
        <div className="contract-details-grid">
          <div>
            <p className="contract-details-item"><strong>Agreement Date:</strong> {new Date().toLocaleDateString()}</p>
            <p className="contract-details-item"><strong>Customer:</strong> {
              userProfile?.firstName && userProfile?.lastName 
                ? `${userProfile.firstName} ${userProfile.lastName}`
                : userProfile?.name || user?.displayName || user?.email
            }</p>
            <p className="contract-details-item"><strong>Email:</strong> {user?.email}</p>
          </div>
          <div>
            <p className="contract-details-item"><strong>Event Date:</strong> {calendarDateRange?.[0]?.toLocaleDateString() || 'TBD'} - {calendarDateRange?.[1]?.toLocaleDateString() || 'TBD'}</p>
            <p className="contract-details-item"><strong>Delivery Address:</strong> {deliveryAddress || 'TBD'}</p>
            <p className="contract-details-item"><strong>Total Amount:</strong> ${(total || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Main Agreement Terms */}
      <div className="terms-section">
        <h3 className="terms-title">
          Terms and Conditions
        </h3>
        
        <p className="terms-subtitle">
          By initialing each section below, the Customer acknowledges understanding and agreement to these terms:
        </p>

        {contractSections.filter(section => !section.isFinePrint).map((section, index) => (
          <div key={section.id} className={`contract-section ${section.isInitialed ? 'initialed' : ''}`}>
            <div className="section-content">
              <div className="initial-section">
                <div 
                  className="initial-container"
                  data-section-id={section.id}
                  onClick={() => handleSectionInitial(section.id)}
                >
                  <div 
                    className={`initial-box ${section.isInitialed ? 'filled' : ''}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSectionInitial(section.id);
                      }
                    }}
                  >
                    {section.isInitialed ? customerInitials : '____'}
                  </div>
                </div>
                <small className="initial-label">Initial</small>
              </div>
              <div className="section-text">
                <h4 className="section-title">
                  {index + 1}. {section.title}
                </h4>
                <p className="section-content-text">
                  {section.content}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fine Print Section */}
      <div className="fine-print-section">
        <h4 className="fine-print-title">
          Additional Legal Terms and Conditions
        </h4>
        
        {contractSections.filter(section => section.isFinePrint).map((section, index) => (
          <div key={section.id} className="fine-print-item">
            <h5 className="fine-print-item-title">
              {section.title}
            </h5>
            <p className="fine-print-item-text">
              {section.content}
            </p>
          </div>
        ))}
      </div>

      {/* Signature Section */}
      <div className="signature-section">
        <h3 className="signature-title">
          Customer Signature
        </h3>
        
        <p className="signature-disclaimer">
          By signing below, I acknowledge that I have read, understood, and agree to all terms and conditions outlined in this agreement.
        </p>
        
        <div className="signature-input-container">
          <div className="signature-input-section">
            <label className="signature-label">
              Customer Signature:
            </label>
            <input
              type="text"
              value={typedSignature}
              onChange={(e) => setTypedSignature(e.target.value)}
              onClick={handleSignatureClick}
              placeholder="Type your full name here"
              className="signature-input"
            />
          </div>
          <div className="signature-date-section">
            <label className="signature-label">
              Date:
            </label>
            <div className="signature-date-display">
              {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
        
        <div className="signature-buttons">
          <button
            onClick={clearSignature}
            className="clear-signature-btn"
          >
            Clear Signature
          </button>
          
          {typedSignature.trim() && (
            <span className="signature-status">
              ✓ Signature entered
            </span>
          )}
        </div>

        {/* Contract Completion Status */}
        <div className="completion-status">
          <h4 className="completion-status-title">
            Contract Completion Status
          </h4>
          <div className="completion-status-items">
            <div className={`status-item ${allSectionsInitialed() ? 'complete' : 'incomplete'}`}>
              ✓ Sections Initialed: {contractSections.filter(s => !s.isFinePrint && s.isInitialed).length} / {contractSections.filter(s => !s.isFinePrint).length}
            </div>
            <div className={`status-item ${typedSignature.trim() ? 'complete' : 'incomplete'}`}>
              ✓ Signature: {typedSignature.trim() ? 'Complete' : 'Required'}
            </div>
          </div>
        </div>
      </div>

      {/* Contract Completion Button */}
      <div className="contract-completion">
        <button
          onClick={() => onContractComplete({
            sections: contractSections,
            signature: typedSignature,
            initials: customerInitials
          })}
          disabled={!allSectionsInitialed() || !typedSignature.trim()}
          className={`completion-button ${allSectionsInitialed() && typedSignature.trim() ? 'enabled' : 'disabled'}`}
        >
          {allSectionsInitialed() && typedSignature.trim() 
            ? 'Complete Contract & Proceed to Payment' 
            : 'Complete All Required Fields Above'}
        </button>
      </div>
    </>
  );
};

export default ContractSigning;