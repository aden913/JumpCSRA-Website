"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testFunction = void 0;
const functions = require("firebase-functions");
// Simple test function
exports.testFunction = functions.https.onCall(async (data, context) => {
    console.log('Test function called successfully');
    return {
        success: true,
        message: 'Test function is working!',
        timestamp: new Date().toISOString()
    };
});
//# sourceMappingURL=test.js.map