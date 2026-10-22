import { useVoiceInput } from "agents/voice/react";
import { Mic, Square } from "lucide-react";
import { useEffect } from "react";
import styles from "./pulse.module.css";

/**
 * The composer's microphone (Settings > Jobs > Voice): the Agents SDK's voice
 * input streams the microphone to this org's agent, which transcribes it on
 * Workers AI. Words appear while the member speaks; on stop, the transcript
 * goes into the composer to edit before sending. Loaded only when voice is on.
 */
export default function Dictation({
  orgId,
  disabled,
  onText,
  onInterim,
}: {
  orgId: string;
  disabled: boolean;
  onText: (text: string) => void;
  onInterim: (text: string | null) => void;
}) {
  const { clear, error, interimTranscript, isListening, start, stop, transcript } = useVoiceInput({ agent: "org", name: orgId });
  useEffect(() => {
    onInterim(isListening ? [transcript, interimTranscript].filter(Boolean).join(" ") || null : null);
  }, [interimTranscript, isListening, onInterim, transcript]);

  // Once listening stops, everything said goes to the composer.
  useEffect(() => {
    if (!isListening && transcript.trim()) {
      onText(transcript.trim());
      clear();
    }
  }, [clear, isListening, onText, transcript]);

  return (
    <button
      aria-label={isListening ? "Stop dictating" : "Dictate"}
      aria-pressed={isListening}
      className={styles.attach}
      data-listening={isListening || undefined}
      disabled={disabled}
      onClick={() => (isListening ? stop() : void start())}
      title={error ?? (isListening ? "Stop, and put what you said in the box" : "Speak instead of typing")}
      type="button"
    >
      {isListening ? <Square size={13} /> : <Mic size={15} />}
    </button>
  );
}
