export interface SpeechResultEvent {resultIndex:number;results:{length:number;[index:number]:{isFinal:boolean;[index:number]:{transcript:string}}}}
export interface SpeechRecognitionHandle {continuous:boolean;interimResults:boolean;onresult:((event:SpeechResultEvent)=>void)|null;onerror:(()=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void}
export type SpeechWindow=Window&{SpeechRecognition?:new()=>SpeechRecognitionHandle;webkitSpeechRecognition?:new()=>SpeechRecognitionHandle};
