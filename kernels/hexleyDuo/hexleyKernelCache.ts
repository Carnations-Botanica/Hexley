import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Function to get the current User's Username
export function getCurrentUsername() {
    return os.userInfo().username;
}

// Function that gets the CPU architecture
export function getHostArchitecture() {
    return os.arch().toUpperCase();
}

// Function that gets the CPU platform
export function getHostPlatform() {
    return os.platform().toUpperCase();
}

// Function to check if a folder exists
export function folderExists(folderPath: string) {
    return fs.existsSync(folderPath);
}

// Function to generate a root UUID
export function generateRootUUID() {
    return uuidv4();
}

// Function to generate a random Hex value
export function generateRandomHex() {
    const hexDigits = '0123456789ABCDEF';
    let hexValue = '0x';
    for (let i = 0; i < 6; i++) {
        hexValue += hexDigits[Math.floor(Math.random() * 16)];
    }
    return hexValue;
}

// Function to get the current date in XNU Kernel Format
export function generateBuildDate() {
    const date = new Date();

    const options = {
        weekday: 'short',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
        year: 'numeric'
    } as const;

    return new Intl.DateTimeFormat('en-US', options).format(date);
}

// Function to randomly choose a thread of the host CPU for a kernel panic
export function getRandomThreadCount() {
    const maxThreads = os.cpus().length * 1;
    return Math.floor(Math.random() * (maxThreads + 1));
}

// Function to calculate the elapsed time
export function getElapsedTime(Hexley: any) {
    const elapsedTime = Date.now() - Hexley.startTime;
    const seconds = Math.floor(elapsedTime / 1000);
    const milliseconds = elapsedTime % 1000;
    return `[${seconds}.${milliseconds.toString().padStart(3, '0')}s]`;
}

// Function to get the elapsed time in nanoseconds
export function getElapsedTimeHelper(Hexley: any) {
    const [seconds, nanoseconds] = process.hrtime(Hexley.startTimeArray);
    return BigInt(seconds) * BigInt(1_000_000_000) + BigInt(nanoseconds);
}

// Function to calculate the elapsed time in nanoseconds
export function getSystemUptime(Hexley: any) {
    const elapsedTimeNanoSeconds = getElapsedTimeHelper(Hexley);
    return elapsedTimeNanoSeconds;
}

// Function to generate the kernel build string
export function getKernelBuildString(Hexley: any): string {
    const versionInfo = Hexley.versions['hexleyDuo'];
    return `Hexley System Version ${versionInfo ? versionInfo.version : 'N/A'}: ${Hexley.hexBuildDate}; ${Hexley.username}:CarnationsInternal/${Hexley.buildType}_${Hexley.architecture}`;
}

// Print the copyright message
export function printCopyright(Hexley: any) {
    Hexley.log(`Copyright (c) 2022, 2023, 2024, 2025 - BSD 3-Clause License`);
    console.log(`\t The Carnations Botánica Foundation. All rights reserved.\n`);
}
