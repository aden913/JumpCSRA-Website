/**
 * Environment variable utilities for React Router v7
 * 
 * Server-side (in loaders/actions): Use process.env directly
 * Client-side (in components): Get env vars via loader data
 * 
 * This module provides type-safe access to environment variables
 * with proper SSR handling.
 */

// Type-safe environment variables
export interface Env {
  FIREBASE_API_KEY: string;
  FIREBASE_AUTH_DOMAIN: string;
  FIREBASE_DATABASE_URL: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_STORAGE_BUCKET: string;
  FIREBASE_MESSAGING_SENDER_ID: string;
  FIREBASE_APP_ID: string;
  EMAIL_API_KEY?: string;
  NODE_ENV: string;
}

/**
 * Get environment variables (server-side only)
 * Use this in loaders/actions, then pass to client via loader data
 */
export function getServerEnv(): Env {
  if (typeof process === 'undefined') {
    throw new Error('getServerEnv() can only be called on the server');
  }

  return {
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '',
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL || '',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '',
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || '',
    EMAIL_API_KEY: process.env.EMAIL_API_KEY || process.env.VITE_EMAIL_API_KEY,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
}

/**
 * Check if code is running in development mode
 * Safe to use in both server and client code
 */
export function isDevelopment(): boolean {
  return typeof process !== 'undefined' 
    ? process.env.NODE_ENV === 'development'
    : false;
}

/**
 * Check if code is running on the server
 */
export function isServer(): boolean {
  return typeof document === 'undefined';
}
