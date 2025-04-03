import { EmbedEvents } from '../types';
type EventHandler = {
    [key in EmbedEvents['event']]?: (data: Extract<EmbedEvents, {
        event: key;
    }>) => void;
};
export declare function handleEvent(event: MessageEvent, handlers: EventHandler, baseUrl?: string): void;
export {};
//# sourceMappingURL=handleEvent.d.ts.map