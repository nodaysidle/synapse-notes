import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioRecorderReturn {
    isRecording: boolean;
    isPaused: boolean;
    duration: number;
    audioBlob: Blob | null;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    pauseRecording: () => void;
    resumeRecording: () => void;
    getDuration: () => number;
    error: string | null;
}

const MAX_RECORDING_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
const WARNING_DURATION = 8 * 60 * 1000; // 8 minutes in milliseconds

export function useAudioRecorder(): UseAudioRecorderReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const pausedTimeRef = useRef<number>(0);
    const pauseStartRef = useRef<number>(0);   // declared here so pauseRecording can use it
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const warningShownRef = useRef(false);

    // Clean up timer on unmount
    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, []);

    const getDuration = useCallback((): number => {
        return duration;
    }, [duration]);

    const startRecording = useCallback(async () => {
        try {
            setError(null);
            setAudioBlob(null);
            audioChunksRef.current = [];
            warningShownRef.current = false;

            // Check browser support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Your browser does not support audio recording. Please use a modern browser like Chrome, Firefox, or Safari.');
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Check MediaRecorder support
            const MediaRecorderClass = window.MediaRecorder || (window as any).webkitMediaRecorder;
            if (!MediaRecorderClass) {
                throw new Error('MediaRecorder is not supported in your browser.');
            }

            // Create MediaRecorder with appropriate MIME type
            let mimeType = 'audio/webm';
            const supportedTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/ogg',
                'audio/mp4',
                'audio/wav',
            ];

            for (const type of supportedTypes) {
                if (MediaRecorderClass.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }

            const mediaRecorder = new MediaRecorderClass(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: mimeType });
                setAudioBlob(blob);

                // Stop all tracks to release microphone
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start(1000); // Collect data every second
            startTimeRef.current = Date.now();
            pausedTimeRef.current = 0;
            setDuration(0);
            setIsRecording(true);
            setIsPaused(false);

            // Start timer
            timerIntervalRef.current = setInterval(() => {
                const elapsed = Date.now() - startTimeRef.current - pausedTimeRef.current;
                setDuration(elapsed);

                // Check for 8-minute warning
                if (elapsed >= WARNING_DURATION && !warningShownRef.current) {
                    warningShownRef.current = true;
                    // Warning is handled in the component via the duration state
                }

                // Stop at 10-minute limit
                if (elapsed >= MAX_RECORDING_DURATION) {
                    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                        mediaRecorderRef.current.stop();
                    }
                    setIsRecording(false);
                    setIsPaused(false);
                    if (timerIntervalRef.current) {
                        clearInterval(timerIntervalRef.current);
                    }
                }
            }, 100);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
            setError(errorMessage);
            console.error('Error starting recording:', err);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);

            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        }
    }, []);

    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
            pauseStartRef.current = Date.now();

            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        }
    }, []);

    const resumeRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            // Track how long we were paused
            if (pauseStartRef.current > 0) {
                pausedTimeRef.current += Date.now() - pauseStartRef.current;
                pauseStartRef.current = 0;
            }
            mediaRecorderRef.current.resume();
            setIsPaused(false);

            timerIntervalRef.current = setInterval(() => {
                const elapsed = Date.now() - startTimeRef.current - pausedTimeRef.current;
                setDuration(elapsed);

                // Check for 8-minute warning
                if (elapsed >= WARNING_DURATION && !warningShownRef.current) {
                    warningShownRef.current = true;
                }

                // Stop at 10-minute limit
                if (elapsed >= MAX_RECORDING_DURATION) {
                    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                        mediaRecorderRef.current.stop();
                    }
                    setIsRecording(false);
                    setIsPaused(false);
                    if (timerIntervalRef.current) {
                        clearInterval(timerIntervalRef.current);
                    }
                }
            }, 100);
        }
    }, []);

    return {
        isRecording,
        isPaused,
        duration,
        audioBlob,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        getDuration,
        error,
    };
}
