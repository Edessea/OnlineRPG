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

    let channel = null;

    const initializeRoom = async () => {
      try {
        // Resolve room by UUID or 5-letter code
        const isUuid = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(roomId);
        let roomQuery = supabase.from('rooms').select('*');
        if (isUuid) {
          roomQuery = roomQuery.eq('id', roomId);
        } else {
          roomQuery = roomQuery.eq('code', roomId.toUpperCase());
        }

        const { data: roomData, error: roomError } = await roomQuery.maybeSingle();

        if (roomError) throw roomError;
        if (!roomData) throw new Error('La sala de juego no existe.');

        const roomUuid = roomData.id;

        // Fetch players and messages in parallel using UUID
        const [playersRes, messagesRes] = await Promise.all([
          supabase.from('players').select('*').eq('room_id', roomUuid).order('join_order', { ascending: true }),
          supabase.from('messages').select('*').eq('room_id', roomUuid).order('created_at', { ascending: true })
        ]);

        if (playersRes.error) throw playersRes.error;
        if (messagesRes.error) throw messagesRes.error;

        setRoom(roomData);
        setPlayers(playersRes.data || []);
        setMessages(messagesRes.data || []);
        setLoading(false);

        // Subscribe to Realtime Updates using UUID
        channel = supabase
          .channel(`room:${roomUuid}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomUuid}` },
            (payload) => {
              setRoom(payload.new);
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomUuid}` },
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
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomUuid}` },
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
      } catch (err) {
        console.error('Error al inicializar la sala:', err);
        setError(err.message || 'Error al conectar con la sala.');
        setLoading(false);
      }
    };

    initializeRoom();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [roomId]);

  return { room, players, messages, loading, error };
}
