import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, Volume2, Square, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';

export default function VoiceAssistant() {
  const { profile } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  
  const connect = async () => {
    try {
      setIsConnecting(true);
      
      // Initialize Audio Context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      // Request Microphone
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
      sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      
      // Create ScriptProcessor for capturing audio
      processorNodeRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are a helpful school banking assistant for AL Bashaer International School. You can help students understand their balance, how to transfer money, and learn about financial literacy. The user currently talking to you is ${profile?.full_name} (@${profile?.username}), a ${profile?.role}. Their current balance is ${profile?.balance} EGP.`,
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            setTranscript(prev => [...prev, "Connected to AL Bashaer Voice Assistant."]);
            
            // Start sending audio
            processorNodeRef.current!.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // Convert Float32 to Int16
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                let s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              
              // Base64 encode
              const buffer = new ArrayBuffer(pcm16.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < pcm16.length; i++) {
                view.setInt16(i * 2, pcm16[i], true); // true for little-endian
              }
              
              let binary = '';
              const bytes = new Uint8Array(buffer);
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64Data = btoa(binary);
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              });
            };
            
            sourceNodeRef.current!.connect(processorNodeRef.current!);
            processorNodeRef.current!.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              // Decode base64 to ArrayBuffer
              const binaryString = atob(base64Audio);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              // Convert Int16 to Float32
              const int16Array = new Int16Array(bytes.buffer);
              const float32Array = new Float32Array(int16Array.length);
              for (let i = 0; i < int16Array.length; i++) {
                float32Array[i] = int16Array[i] / 32768.0;
              }
              
              playbackQueueRef.current.push(float32Array);
              playNextAudio();
            }
            
            if (message.serverContent?.interrupted) {
              playbackQueueRef.current = [];
              isPlayingRef.current = false;
            }
          },
          onclose: () => {
            disconnect();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            disconnect();
          }
        }
      });
      
      sessionRef.current = await sessionPromise;
      
    } catch (err) {
      console.error("Failed to connect:", err);
      setIsConnecting(false);
      setTranscript(prev => [...prev, "Failed to connect to Voice Assistant."]);
    }
  };
  
  const playNextAudio = () => {
    if (isPlayingRef.current || playbackQueueRef.current.length === 0 || !audioContextRef.current) return;
    
    isPlayingRef.current = true;
    const audioData = playbackQueueRef.current.shift()!;
    
    const audioBuffer = audioContextRef.current.createBuffer(1, audioData.length, 24000); // Gemini returns 24kHz
    audioBuffer.getChannelData(0).set(audioData);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      playNextAudio();
    };
    source.start();
  };

  const disconnect = () => {
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current.onaudioprocess = null;
    }
    if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setTranscript(prev => [...prev, "Disconnected."]);
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
        <div className="flex justify-center mb-6">
          <Logo className="w-24 h-auto" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Voice Assistant</h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          Talk to your AI assistant about your balance, how to transfer funds, or ask for financial advice.
        </p>
        
        <div className="flex justify-center gap-4">
          {!isConnected && !isConnecting && (
            <button 
              onClick={connect}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-8 py-4 rounded-full font-medium transition-colors shadow-lg shadow-teal-600/20"
            >
              <Mic className="w-5 h-5" />
              Start Conversation
            </button>
          )}
          
          {isConnecting && (
            <button 
              disabled
              className="flex items-center gap-2 bg-teal-400 text-white px-8 py-4 rounded-full font-medium cursor-not-allowed"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              Connecting...
            </button>
          )}
          
          {isConnected && (
            <button 
              onClick={disconnect}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full font-medium transition-colors shadow-lg shadow-red-600/20 animate-pulse"
            >
              <Square className="w-5 h-5 fill-current" />
              Stop Conversation
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Log</h3>
        <div className="bg-gray-50 rounded-xl p-4 h-64 overflow-y-auto font-mono text-sm text-gray-600 space-y-2">
          {transcript.length === 0 ? (
            <p className="text-gray-400 italic">No activity yet...</p>
          ) : (
            transcript.map((t, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-teal-600">[{new Date().toLocaleTimeString()}]</span>
                <span>{t}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
