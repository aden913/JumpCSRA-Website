// Development Email Testing Component
// Only shows in development mode for testing email functionality

import { useState } from 'react';
import { runEmailSystemDiagnostics, displayDiagnosticsResults } from '../utils/emailTestUtils';

export function EmailTestPanel() {
  const [testEmail, setTestEmail] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const runTests = async () => {
    if (!testEmail.trim()) {
      alert('Please enter a test email address');
      return;
    }

    setIsRunning(true);
    setResults(null);

    try {
      console.log('🔬 Starting email system diagnostics...');
      const diagnostics = await runEmailSystemDiagnostics(testEmail);
      
      setResults(diagnostics);
      displayDiagnosticsResults(diagnostics);
      
      // Show summary alert
      const { deploymentCheck, emailTest, invoiceTest } = diagnostics;
      let summary = `Email System Test Results:\n\n`;
      summary += `✅ Functions Available: ${deploymentCheck.availableFunctions.length}\n`;
      summary += `❌ Errors: ${deploymentCheck.errors.length}\n`;
      
      if (emailTest) {
        summary += `📧 Email Test: ${emailTest.success ? 'PASSED' : 'FAILED'}\n`;
      }
      
      if (invoiceTest) {
        summary += `💰 Invoice Test: ${invoiceTest.success ? 'PASSED' : 'FAILED'}\n`;
      }
      
      if (deploymentCheck.errors.length > 0) {
        summary += `\nErrors:\n${deploymentCheck.errors.join('\n')}`;
      }
      
      alert(summary);
      
    } catch (error) {
      console.error('Email test failed:', error);
      alert(`Test failed: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const runQuickTest = async () => {
    if (!testEmail.trim()) {
      alert('Please enter a test email address');
      return;
    }

    setIsRunning(true);

    try {
      const { runEmailSystemDiagnostics } = await import('../utils/emailTestUtils');
      const results = await runEmailSystemDiagnostics();
      
      console.log('Quick test results:', results);
      
      const functionCount = results.deploymentCheck.availableFunctions.length;
      const errorCount = results.deploymentCheck.errors.length;
      
      alert(`Quick Test Results:\n\n✅ ${functionCount} functions available\n❌ ${errorCount} errors found\n\nCheck console for details`);
      
    } catch (error) {
      console.error('Quick test failed:', error);
      alert(`Quick test failed: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      width: '300px',
      background: '#f8f9fa',
      border: '2px solid #007bff',
      borderRadius: '8px',
      padding: '15px',
      zIndex: 9999,
      fontSize: '14px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        background: '#007bff',
        color: 'white',
        padding: '8px 12px',
        margin: '-15px -15px 15px -15px',
        borderRadius: '6px 6px 0 0',
        fontWeight: 'bold'
      }}>
        🔧 Email System Test Panel
      </div>
      
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Test Email Address:
        </label>
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="your-email@example.com"
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '13px'
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={runTests}
          disabled={isRunning}
          style={{
            background: '#28a745',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 'bold'
          }}
        >
          {isRunning ? '🔄 Running Tests...' : '🧪 Run Full Test'}
        </button>
        
        <button
          onClick={runQuickTest}
          disabled={isRunning}
          style={{
            background: '#ffc107',
            color: 'black',
            border: 'none',
            padding: '6px 10px',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          {isRunning ? '⏳ Testing...' : '⚡ Quick Check'}
        </button>
      </div>

      {results && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          background: '#e9ecef',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Last Test Results:</div>
          <div>
            ✅ Functions: {results.deploymentCheck.availableFunctions.length}
          </div>
          <div>
            ❌ Errors: {results.deploymentCheck.errors.length}
          </div>
          {results.emailTest && (
            <div>
              📧 Email: {results.emailTest.success ? '✅' : '❌'}
            </div>
          )}
          {results.invoiceTest && (
            <div>
              💰 Invoice: {results.invoiceTest.success ? '✅' : '❌'}
            </div>
          )}
        </div>
      )}

      <div style={{
        marginTop: '12px',
        padding: '8px',
        background: '#fff3cd',
        borderRadius: '4px',
        fontSize: '11px',
        color: '#856404'
      }}>
        ⚠️ DEV ONLY: This panel only appears in development mode. Check browser console for detailed logs.
      </div>
    </div>
  );
}