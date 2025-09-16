declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
  interface SpeechRecognition {
    start(): void;
    stop(): void;
    abort(): void;
    onaudiostart: any;
    onresult: any;
  }
}

export {};
