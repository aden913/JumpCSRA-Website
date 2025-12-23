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
      const sections: ContractSection[] = [
        {
          id: "payment-policy",
          title: "Payment Policy",
          content: "Customer agrees to pay the total rental fee as specified in this agreement. Payment is due in full at the time of booking unless otherwise arranged. Late fees may apply for overdue payments.",
          isInitialed: false,
          isFinePrint: false
        },
        {
          id: "damage-liability",
          title: "Damage and Liability",
          content: "Customer is responsible for any damage to rental equipment beyond normal wear and tear. Customer agrees to supervise the use of all equipment and ensure it is used safely and appropriately.",
          isInitialed: false,
          isFinePrint: false
        },
        {
          id: "delivery-setup",
          title: "Delivery and Setup",
          content: "Jump CSRA will deliver and set up equipment at the specified location. Customer must ensure adequate space and access for delivery. Setup area must be clear of debris and level.",
          isInitialed: false,
          isFinePrint: false
        },
        {
          id: "weather-conditions",
          title: "Weather and Cancellation",
          content: "Outdoor events are subject to weather conditions. Jump CSRA reserves the right to cancel or postpone delivery for unsafe weather conditions including high winds, storms, or severe weather warnings.",
          isInitialed: false,
          isFinePrint: false
        },
        {
          id: "safety-compliance",
          title: "Safety and Compliance",
          content: "Customer agrees to follow all safety guidelines and capacity limits for rental equipment. Adult supervision is required at all times during use. Customer is responsible for ensuring all participants follow safety rules.",
          isInitialed: false,
          isFinePrint: false
        },
        {
          id: "liability-waiver",
          title: "Liability Waiver",
          content: "Customer acknowledges that use of rental equipment involves inherent risks. Customer agrees to hold Jump CSRA harmless from any injuries or damages that may occur during the rental period, except in cases of gross negligence by Jump CSRA.",
          isInitialed: false,
          isFinePrint: true
        },
        {
          id: "indemnification",
          title: "Indemnification",
          content: "Customer agrees to indemnify and hold harmless Jump CSRA, its officers, employees, and agents from any claims, damages, losses, or expenses arising from Customer's use of the rental equipment or breach of this agreement.",
          isInitialed: false,
          isFinePrint: true
        },
        {
          id: "equipment-care",
          title: "Equipment Care and Return",
          content: "Customer is responsible for the proper care of all rental equipment. Equipment must be returned in the same condition as received, allowing for normal wear. Customer will be charged for cleaning fees if equipment is returned excessively dirty.",
          isInitialed: false,
          isFinePrint: true
        },
        {
          id: "force-majeure",
          title: "Force Majeure",
          content: "Neither party shall be liable for any failure to perform due to unforeseen circumstances or causes beyond their reasonable control, including but not limited to acts of God, natural disasters, government regulations, or other force majeure events.",
          isInitialed: false,
          isFinePrint: true
        }
      ];
      setContractSections(sections);
    }
  }, [contractSections.length]);

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
        <p className="contract-date">
          Event Date: {calendarDateRange?.[0]?.toLocaleDateString() || 'TBD'} - {calendarDateRange?.[1]?.toLocaleDateString() || 'TBD'}
        </p>
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