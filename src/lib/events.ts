import { EventEmitter } from 'events';

export const appEvents = new EventEmitter();

// Default limit is 10 listeners per event — raise it to avoid warnings
appEvents.setMaxListeners(20);