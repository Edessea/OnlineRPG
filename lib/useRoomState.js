'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function useRoomState(roomId) {
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomId) return;

    const fetchInitialData = async () => {
      try {
        const [roomRes, playersRes, messagesRes] = await Promise.all([
          supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
          supabase.from('players').select('*').eq('room_id', roomId).order('join_order', { ascending: true }),
          supabase.from('messages').select('*').eq('room_id', roomId).order('created_at', { ascending: true })
        ]);

        if (roomRes.error) throw roomRes.error;
        if (!roomRes.data) throw new Error('La sala de juego no existe.');
        if (playersRes.error) throw playersRes.error;
        if (messagesRes.error) throw messagesRes.error;

        setRoom(roomRes.data);
        setPlayers(playersRes.data || []);
        setMessages(messagesRes.data || []);
        setLoading(false);
      } catch (err) {
        console.error('Error al inicializar la sala:', err);
        setError(err.message || 'Error al conectar con la sala.');
        setLoading(false);
      }
    };

    fetchInitialData();

    // Subscribe to Postgres Changes in Realtime
    const channel = supabase
      .channel(`room:${roomId}`)
      // 1. Listen for room updates
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          setRoom(payload.new);
        }
      )
      // 2. Listen for players modifications
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPlayers((prev) => {
              if (prev.some((p) => p.id === payload.new.id)) return prev;
              return [...prev, payload.new].sort((a, b) => a.join_order - b.join_order);
            });
          } else if (payload.eventType === 'UPDATE') {
            setPlayers((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new : p)).sort((a, b) => a.join_order - b.join_order)
            );
          } else if (payload.eventType === 'DELETE') {
            setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      // 3. Listen for message logs
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev
                .map((m) => (m.id === payload.new.id ? payload.new : m))
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return { room, players, messages, loading, error };
}
