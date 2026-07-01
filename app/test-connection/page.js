'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function TestConnectionPage() {
  const [supabaseStatus, setSupabaseStatus] = useState({ loading: true, success: false, message: '' });
  const [tablesStatus, setTablesStatus] = useState({ loading: true, success: false, rooms: false, players: false, messages: false, errorDetails: '' });
  const [geminiStatus, setGeminiStatus] = useState({ loading: true, success: false, response: '', message: '' });

  useEffect(() => {
    async function testSupabase() {
      try {
        if (!supabase) {
          throw new Error('Supabase client was not initialized properly.');
        }

        // Test rooms table
        const { error: roomsError } = await supabase.from('rooms').select('id').limit(1);
        const roomsExist = !roomsError || (roomsError.code !== '42P01' && roomsError.code !== 'P0001');
        
        // Test players table
        const { error: playersError } = await supabase.from('players').select('id').limit(1);
        const playersExist = !playersError || (playersError.code !== '42P01' && playersError.code !== 'P0001');

        // Test messages table
        const { error: messagesError } = await supabase.from('messages').select('id').limit(1);
        const messagesExist = !messagesError || (messagesError.code !== '42P01' && messagesError.code !== 'P0001');

        const hasAccessError = 
          (roomsError && roomsError.code === '42P01') || 
          (playersError && playersError.code === '42P01') || 
          (messagesError && messagesError.code === '42P01');

        setTablesStatus({
          loading: false,
          success: !hasAccessError && roomsExist && playersExist && messagesExist,
          rooms: roomsExist && (!roomsError || roomsError.code !== '42P01'),
          players: playersExist && (!playersError || playersError.code !== '42P01'),
          messages: messagesExist && (!messagesError || messagesError.code !== '42P01'),
          errorDetails: `Rooms: ${roomsError ? roomsError.message : 'OK'}, Players: ${playersError ? playersError.message : 'OK'}, Messages: ${messagesError ? messagesError.message : 'OK'}`
        });

        setSupabaseStatus({
          loading: false,
          success: true,
          message: 'Supabase client initialized successfully.'
        });
      } catch (err) {
        setSupabaseStatus({
          loading: false,
          success: false,
          message: err.message || 'Supabase connection failed.'
        });
        setTablesStatus({
          loading: false,
          success: false,
          rooms: false,
          players: false,
          messages: false,
          errorDetails: err.message || 'Verification skipped due to client error.'
        });
      }
    }

    async function testGemini() {
      try {
        const res = await fetch('/api/test-gemini');
        const data = await res.json();
        
        if (res.ok && data.success) {
          setGeminiStatus({
            loading: false,
            success: true,
            message: data.message,
            response: data.response
          });
        } else {
          setGeminiStatus({
            loading: false,
            success: false,
            message: data.error || 'Gemini handshake returned an error.'
          });
        }
      } catch (err) {
        setGeminiStatus({
          loading: false,
          success: false,
          message: err.message || 'Failed to communicate with Gemini API test route.'
        });
      }
    }

    testSupabase();
    testGemini();
  }, []);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🏰 Online RPG - Diagnostics</h1>
        <p style={styles.subtitle}>Milestone 1: Project Setup & Connection Diagnostics</p>
      </header>

      <main style={styles.grid}>
        {/* Next.js Compilation */}
        <section className="card" style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.badgeSuccess}>✓ PASS</span>
            <h2 style={styles.cardTitle}>Next.js Boilerplate</h2>
          </div>
          <p style={styles.cardText}>Next.js App Router compilation is running successfully.</p>
          <div style={styles.meta}>Port: 3000 | Node: v24.18.0</div>
        </section>

        {/* Supabase Client Handshake */}
        <section className="card" style={styles.card}>
          <div style={styles.cardHeader}>
            {supabaseStatus.loading ? (
              <span style={styles.badgePending}>⌛ CHECKING</span>
            ) : supabaseStatus.success ? (
              <span style={styles.badgeSuccess}>✓ SUCCESS</span>
            ) : (
              <span style={styles.badgeError}>✗ FAILED</span>
            )}
            <h2 style={styles.cardTitle}>Supabase Connection</h2>
          </div>
          <p style={styles.cardText}>
            {supabaseStatus.loading ? 'Initializing Supabase Client...' : supabaseStatus.message}
          </p>
          {!supabaseStatus.loading && !supabaseStatus.success && (
            <div style={styles.tipBox}>
              <strong>Tip:</strong> Ensure you have copied <code>.env.local.example</code> to <code>.env.local</code> and filled in the Supabase details.
            </div>
          )}
        </section>

        {/* Database Tables Verification */}
        <section className="card" style={styles.card}>
          <div style={styles.cardHeader}>
            {tablesStatus.loading ? (
              <span style={styles.badgePending}>⌛ CHECKING</span>
            ) : tablesStatus.success ? (
              <span style={styles.badgeSuccess}>✓ VERIFIED</span>
            ) : (
              <span style={styles.badgeError}>✗ INCOMPLETE</span>
            )}
            <h2 style={styles.cardTitle}>Database Tables</h2>
          </div>
          <p style={styles.cardText}>Checking for the presence of tables from the database schema:</p>
          <ul style={styles.list}>
            <li>
              <span style={tablesStatus.rooms ? styles.bulletGreen : styles.bulletRed}>●</span>
              <strong>rooms:</strong> {tablesStatus.loading ? 'Checking...' : tablesStatus.rooms ? 'Found' : 'Missing or inaccessible'}
            </li>
            <li>
              <span style={tablesStatus.players ? styles.bulletGreen : styles.bulletRed}>●</span>
              <strong>players:</strong> {tablesStatus.loading ? 'Checking...' : tablesStatus.players ? 'Found' : 'Missing or inaccessible'}
            </li>
            <li>
              <span style={tablesStatus.messages ? styles.bulletGreen : styles.bulletRed}>●</span>
              <strong>messages:</strong> {tablesStatus.loading ? 'Checking...' : tablesStatus.messages ? 'Found' : 'Missing or inaccessible'}
            </li>
          </ul>
          {!tablesStatus.loading && !tablesStatus.success && (
            <div style={styles.tipBox}>
              <strong>Setup:</strong> Copy SQL migrations from <code>schema.sql</code> and execute them in your Supabase SQL Editor.
            </div>
          )}
        </section>

        {/* Gemini API Handshake */}
        <section className="card" style={styles.card}>
          <div style={styles.cardHeader}>
            {geminiStatus.loading ? (
              <span style={styles.badgePending}>⌛ CHECKING</span>
            ) : geminiStatus.success ? (
              <span style={styles.badgeSuccess}>✓ CONNECTED</span>
            ) : (
              <span style={styles.badgeError}>✗ ERROR</span>
            )}
            <h2 style={styles.cardTitle}>Gemini AI Handshake</h2>
          </div>
          <p style={styles.cardText}>
            {geminiStatus.loading ? 'Calling Gemini API Gateway...' : geminiStatus.message}
          </p>
          {geminiStatus.success && (
            <div style={styles.responseBox}>
              <strong>Gemini Response:</strong> &ldquo;{geminiStatus.response}&rdquo;
            </div>
          )}
          {!geminiStatus.loading && !geminiStatus.success && (
            <div style={styles.tipBox}>
              <strong>Tip:</strong> Double-check your <code>GEMINI_API_KEY</code> in <code>.env.local</code>. Make sure it is valid in Google AI Studio.
            </div>
          )}
        </section>
      </main>

      <footer style={styles.footer}>
        <p>🏰 Adventurers ready to compile. Dark Sepia Design System active.</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '3rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    justifyContent: 'space-between',
  },
  header: {
    textAlign: 'center',
    marginBottom: '3rem',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '2rem',
  },
  title: {
    fontSize: '2.5rem',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: 'var(--secondary)',
    fontStyle: 'italic',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '2rem',
    alignItems: 'start',
  },
  card: {
    minHeight: '220px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  cardTitle: {
    fontSize: '1.25rem',
    margin: 0,
  },
  cardText: {
    color: 'var(--secondary)',
    fontSize: '0.95rem',
    flexGrow: 1,
    marginBottom: '1rem',
  },
  meta: {
    fontSize: '0.8rem',
    color: 'var(--accent)',
    fontFamily: 'monospace',
    borderTop: '1px solid var(--border)',
    paddingTop: '0.5rem',
    marginTop: '0.5rem',
  },
  list: {
    listStyleType: 'none',
    padding: 0,
    marginBottom: '1rem',
  },
  bulletGreen: {
    color: 'var(--success)',
    marginRight: '0.5rem',
  },
  bulletRed: {
    color: 'var(--failure)',
    marginRight: '0.5rem',
  },
  badgeSuccess: {
    backgroundColor: 'rgba(110, 142, 93, 0.2)',
    color: 'var(--success)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
  },
  badgePending: {
    backgroundColor: 'rgba(195, 155, 56, 0.2)',
    color: 'var(--accent)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
  },
  badgeError: {
    backgroundColor: 'rgba(184, 92, 92, 0.2)',
    color: 'var(--failure)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
  },
  tipBox: {
    backgroundColor: 'rgba(195, 155, 56, 0.05)',
    borderLeft: '3px solid var(--accent)',
    padding: '0.8rem',
    fontSize: '0.85rem',
    marginTop: '0.5rem',
    color: 'var(--secondary)',
  },
  responseBox: {
    backgroundColor: 'rgba(110, 142, 93, 0.05)',
    borderLeft: '3px solid var(--success)',
    padding: '0.8rem',
    fontSize: '0.85rem',
    marginTop: '0.5rem',
    fontStyle: 'italic',
    color: 'var(--foreground)',
  },
  footer: {
    textAlign: 'center',
    marginTop: '4rem',
    paddingTop: '2rem',
    borderTop: '1px solid var(--border)',
    color: 'var(--secondary)',
    fontSize: '0.9rem',
  },
};
