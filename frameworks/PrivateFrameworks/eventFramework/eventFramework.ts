import EventEmitter from 'events';
import { Hexley } from '../../../kernels/hexleyDuo/hexleyDuo-v3.1.0';

/**
 * Event Framework (AuroraEvents)
 * Provides a unified, structured event system for Hexley components.
 * This is an abstraction over Node.js/Bun EventEmitter to allow for structured
 * events like waitForEmit.
 */

// Internal instance of the event emitter
const internalEmitter = new EventEmitter();

export const eventFramework = {
    frameworkColor: '#39FF14',
    
    // Core EventEmitter methods exposed publicly
    emit: (eventName: string, ...args: any[]) => {
        const result = internalEmitter.emit(eventName, ...args);
        
        // Log the successful emission of an event
        if (typeof Hexley !== 'undefined' && Hexley.log) {
            const color = result ? Hexley.frameworks?.aurora?.tintGreen : Hexley.frameworks?.aurora?.tintYellow;
            const logMsg = result 
                ? `Event emitted successfully: '${eventName}'`
                : `Event emitted but had no listeners: '${eventName}'`;
            Hexley.log(`${Hexley.frameworks?.aurora?.colorText('[eventFramework/emit]', color)} ${logMsg}`);
        }

        return result;
    },

    on: (eventName: string, listener: (...args: any[]) => void) => {
        internalEmitter.on(eventName, listener);

        // Log the successful registration of an event listener
        if (typeof Hexley !== 'undefined' && Hexley.log) {
            const color = Hexley.frameworks?.aurora?.tintGreen;
            Hexley.log(`${Hexley.frameworks?.aurora?.colorText('[eventFramework/on]', color)} Listener registered for event: '${eventName}'`);
        }
    },

    once: (eventName: string, listener: (...args: any[]) => void) => {
        internalEmitter.once(eventName, listener);

        // Log the successful registration of a one-time event listener
        if (typeof Hexley !== 'undefined' && Hexley.log) {
            const color = Hexley.frameworks?.aurora?.tintGreen;
            Hexley.log(`${Hexley.frameworks?.aurora?.colorText('[eventFramework/once]', color)} One-time listener registered for event: '${eventName}'`);
        }
    },

    /**
     * Waits for a specific event to be emitted. Returns a Promise that resolves 
     * with the arguments passed to the event.
     * @param {string} eventName - The name of the event to wait for.
     * @returns {Promise<any[]>} - A promise resolving with event arguments.
     */
    waitForEmit: (eventName: string): Promise<any[]> => {
        
        // Log that a component is waiting for an event
        if (typeof Hexley !== 'undefined' && Hexley.log) {
            const color = Hexley.frameworks?.aurora?.tintYellow;
            Hexley.log(`${Hexley.frameworks?.aurora?.colorText('[eventFramework/waitForEmit]', color)} Component waiting for event: '${eventName}'`);
        }

        return new Promise(resolve => {
            internalEmitter.once(eventName, (...args) => {
                
                // Log that the awaited event was received
                if (typeof Hexley !== 'undefined' && Hexley.log) {
                    const color = Hexley.frameworks?.aurora?.tintGreen;
                    Hexley.log(`${Hexley.frameworks?.aurora?.colorText('[eventFramework/waitForEmit]', color)} Awaited event received: '${eventName}'`);
                }
                
                resolve(args);
            });
        });
    },

    /**
     * Initializes the Event Framework.
     * @param {any} Hexley - The main Hexley global object.
     */
    async initializeEvents(Hexley: any) {
        Hexley.log(`${Hexley.frameworks?.aurora?.colorText('[eventFramework/initializeEvents]', this.frameworkColor)} Initializing...`);
        
        // Replace the Hexley.core EventEmitter with the framework's own instance
        Hexley.core = internalEmitter;

        Hexley.resources.framework.event!.isLoaded = true;
        Hexley.log(`${Hexley.frameworks?.aurora?.colorText('[eventFramework/initializeEvents]', this.frameworkColor)} Initialized! Event Framework is now ready.`);
    }
    
};
