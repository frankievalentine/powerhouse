import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./job-window.module.css";

/**
 * Reads a finished job's answer aloud (Settings > Jobs > Voice): the Worker
 * turns it into speech with the Agents SDK's Workers AI voice (Aura 1),
 * billed per character, so it runs only when clicked.
 */
export function ReadAloud({ runId }: { runId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    audio.current?.pause();
    if (audio.current?.src) {
      URL.revokeObjectURL(audio.current.src);
    }
    audio.current = null;
    setState("idle");
  };

  // Closing the window stops the voice.
  useEffect(() => stop, []);

  const play = async () => {
    setError(null);
    setState("loading");
    try {
      const response = await fetch("/api/voice/speak", {
        body: JSON.stringify({ runId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? "Could not read it aloud.");
      }
      const player = new Audio(URL.createObjectURL(await response.blob()));
      player.onended = stop;
      audio.current = player;
      await player.play();
      setState("playing");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      stop();
    }
  };

  return (
    <button
      aria-label={state === "playing" ? "Stop reading" : "Read the answer aloud"}
      className={styles.iconButton}
      disabled={state === "loading"}
      onClick={() => (state === "playing" ? stop() : void play())}
      title={error ?? (state === "playing" ? "Stop reading" : "Read the answer aloud")}
      type="button"
    >
      {state === "playing" ? <VolumeX size={14} /> : <Volume2 size={14} />}
    </button>
  );
}
