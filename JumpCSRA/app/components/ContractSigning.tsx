import React, { useState, useEffect } from 'react';

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
  calendarDateRange: [Date | null, Date | null];
  deliveryAddress: string;
  total: number;
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
      const autoInitials = `${userProfile.firstName.charAt(0).toUpperCase()}${userProfile.lastName.charAt(0).toUpperCase()}`;
      setCustomerInitials(autoInitials);
    }
  }, [userProfile, customerInitials]);

  // Handle section initialing
  const handleSectionInitial = (sectionId: string) => {
    // Automatically generate initials from user's firstName and lastName
    const autoInitials = userProfile?.firstName && userProfile?.lastName 
      ? `${userProfile.firstName.charAt(0).toUpperCase()}${userProfile.lastName.charAt(0).toUpperCase()}`
      : customerInitials.trim() || 'XX'; // Fallback to existing initials or XX
    
    // Set the initials if not already set
    if (!customerInitials.trim()) {
      setCustomerInitials(autoInitials);
    }
    
    setContractSections(prev => 
      prev.map(section => 
        section.id === sectionId 
          ? { ...section, isInitialed: !section.isInitialed, initialedAt: new Date().toISOString() }
          : section
      )
    );
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
          Event Date: {calendarDateRange[0]?.toLocaleDateString()} - {calendarDateRange[1]?.toLocaleDateString()}
        </p>
      </div>

      {/* Contract Details */}
      <div style={{ 
        marginBottom: '2rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        border: '1px solid #ddd'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.95rem' }}>
          <div>
            <p style={{ margin: '0.25rem 0' }}><strong>Agreement Date:</strong> {new Date().toLocaleDateString()}</p>
            <p style={{ margin: '0.25rem 0' }}><strong>Customer:</strong> {
              userProfile?.firstName && userProfile?.lastName 
                ? `${userProfile.firstName} ${userProfile.lastName}`
                : userProfile?.name || user?.displayName || user?.email
            }</p>
            <p style={{ margin: '0.25rem 0' }}><strong>Email:</strong> {user?.email}</p>
          </div>
          <div>
            <p style={{ margin: '0.25rem 0' }}><strong>Event Date:</strong> {calendarDateRange[0]?.toLocaleDateString()} - {calendarDateRange[1]?.toLocaleDateString()}</p>
            <p style={{ margin: '0.25rem 0' }}><strong>Delivery Address:</strong> {deliveryAddress}</p>
            <p style={{ margin: '0.25rem 0' }}><strong>Total Amount:</strong> ${total.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Main Agreement Terms */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: '1.3rem',
          textAlign: 'center',
          textTransform: 'uppercase',
          borderBottom: '1px solid #ccc',
          paddingBottom: '0.5rem'
        }}>
          Terms and Conditions
        </h3>
        
        <p style={{ marginBottom: '1.5rem', fontStyle: 'italic', textAlign: 'center', color: '#666' }}>
          By initialing each section below, the Customer acknowledges understanding and agreement to these terms:
        </p>

        {contractSections.filter(section => !section.isFinePrint).map((section, index) => (
          <div key={section.id} style={{ 
            marginBottom: '1.5rem',
            padding: '1rem',
            border: section.isInitialed ? '2px solid #28a745' : '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: section.isInitialed ? '#f8fff8' : '#fff',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ 
                minWidth: '80px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '0.5rem'
              }}>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  cursor: 'pointer',
                  gap: '0.5rem'
                }}
                onClick={() => handleSectionInitial(section.id)}
                >
                  <div style={{ 
                    display: 'inline-block',
                    minWidth: '50px',
                    padding: '0.25rem 0.5rem',
                    border: '2px solid #000',
                    borderRadius: '0px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    backgroundColor: section.isInitialed ? '#e8f5e8' : '#fff',
                    textAlign: 'center',
                    fontFamily: 'Times, serif'
                  }}>
                    {section.isInitialed ? customerInitials : '____'}
                  </div>
                </div>
                <small style={{ fontSize: '0.7rem', color: '#666', textAlign: 'center' }}>Initial</small>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ 
                  margin: '0 0 0.5rem 0', 
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  color: '#333'
                }}>
                  {index + 1}. {section.title}
                </h4>
                <p style={{ 
                  margin: 0, 
                  color: '#333', 
                  lineHeight: '1.5',
                  fontSize: '0.95rem',
                  textAlign: 'justify'
                }}>
                  {section.content}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fine Print Section */}
      <div style={{ 
        marginBottom: '2rem',
        padding: '1rem',
        backgroundColor: '#f9f9f9',
        border: '1px solid #ccc',
        borderRadius: '4px'
      }}>
        <h4 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: '1.1rem',
          textAlign: 'center',
          textTransform: 'uppercase',
          color: '#666'
        }}>
          Additional Legal Terms and Conditions
        </h4>
        
        {contractSections.filter(section => section.isFinePrint).map((section, index) => (
          <div key={section.id} style={{ marginBottom: '1rem' }}>
            <h5 style={{ 
              margin: '0 0 0.5rem 0', 
              fontSize: '1rem',
              fontWeight: 'bold',
              color: '#333'
            }}>
              {section.title}
            </h5>
            <p style={{ 
              margin: 0, 
              color: '#555', 
              lineHeight: '1.4',
              fontSize: '0.85rem',
              textAlign: 'justify'
            }}>
              {section.content}
            </p>
          </div>
        ))}
      </div>

      {/* Signature Section */}
      <div style={{ 
        marginBottom: '2rem',
        padding: '2rem',
        border: '2px solid #000',
        borderRadius: '0px',
        backgroundColor: '#fff'
      }}>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: '1.3rem',
          textAlign: 'center',
          textTransform: 'uppercase',
          borderBottom: '1px solid #ccc',
          paddingBottom: '0.5rem'
        }}>
          Customer Signature
        </h3>
        
        <p style={{ 
          marginBottom: '2rem', 
          textAlign: 'center',
          color: '#666',
          fontStyle: 'italic'
        }}>
          By signing below, I acknowledge that I have read, understood, and agree to all terms and conditions outlined in this agreement.
        </p>
        
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          <div style={{ flex: 1 }}>
            <label style={{ 
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              fontSize: '1rem'
            }}>
              Customer Signature:
            </label>
            <input
              type="text"
              value={typedSignature}
              onChange={(e) => setTypedSignature(e.target.value)}
              onClick={handleSignatureClick}
              placeholder="Type your full name here"
              style={{
                width: '100%',
                padding: '1rem',
                border: 'none',
                borderBottom: '2px solid #000',
                borderRadius: '0px',
                fontSize: '1.3rem',
                fontFamily: 'cursive',
                backgroundColor: 'transparent',
                textAlign: 'center'
              }}
            />
          </div>
          <div style={{ 
            minWidth: '150px',
            textAlign: 'center'
          }}>
            <label style={{ 
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              fontSize: '1rem'
            }}>
              Date:
            </label>
            <div style={{
              padding: '1rem',
              borderBottom: '2px solid #000',
              fontSize: '1.1rem',
              fontFamily: 'Times, serif'
            }}>
              {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={clearSignature}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear Signature
          </button>
          
          {typedSignature.trim() && (
            <span style={{ color: '#28a745', fontSize: '0.9rem' }}>
              ✓ Signature entered
            </span>
          )}
        </div>

        {/* Contract Completion Status */}
        <div style={{ 
          marginTop: '2rem', 
          padding: '1.5rem', 
          backgroundColor: '#f8f9fa',
          border: '1px solid #ddd',
          borderRadius: '0px',
          textAlign: 'center'
        }}>
          <h4 style={{ 
            margin: '0 0 1rem 0', 
            fontWeight: 'bold',
            textTransform: 'uppercase',
            fontSize: '1.1rem'
          }}>
            Contract Completion Status
          </h4>
          <div style={{ display: 'flex', justifyContent: 'space-around', gap: '2rem' }}>
            <div style={{ 
              color: allSectionsInitialed() ? '#28a745' : '#dc3545',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}>
              ✓ Sections Initialed: {contractSections.filter(s => !s.isFinePrint && s.isInitialed).length} / {contractSections.filter(s => !s.isFinePrint).length}
            </div>
            <div style={{ 
              color: typedSignature.trim() ? '#28a745' : '#dc3545',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}>
              ✓ Signature: {typedSignature.trim() ? 'Complete' : 'Required'}
            </div>
          </div>
        </div>
      </div>

      {/* Contract Completion Button */}
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button
          onClick={() => onContractComplete({
            sections: contractSections,
            signature: typedSignature,
            initials: customerInitials
          })}
          disabled={!allSectionsInitialed() || !typedSignature.trim()}
          style={{
            backgroundColor: allSectionsInitialed() && typedSignature.trim() ? '#28a745' : '#6c757d',
            color: 'white',
            border: 'none',
            padding: '1rem 2rem',
            borderRadius: '8px',
            cursor: allSectionsInitialed() && typedSignature.trim() ? 'pointer' : 'not-allowed',
            fontSize: '1.1rem',
            fontWeight: 'bold'
          }}
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